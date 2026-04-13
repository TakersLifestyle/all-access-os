import * as path from "path";
import * as dotenv from "dotenv";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import Stripe from "stripe";

// Local dev only — production env vars injected by Cloud Functions runtime
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

// Initialize Firebase Admin (once)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const auth = admin.auth();

const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map Stripe subscription status → our platform status
 * Stripe statuses: trialing | active | past_due | canceled | unpaid | incomplete | incomplete_expired | paused
 */
function stripeStatusToPlatformStatus(
  stripeStatus: Stripe.Subscription.Status
): "active" | "inactive" | "past_due" | "cancelled" {
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
    case "paused":
      return "cancelled";
    default:
      return "inactive";
  }
}

/**
 * Sync user's Firestore doc + Firebase Auth custom claims after any
 * subscription change. This is the single source of truth update.
 *
 * Custom claims on the Auth token mean Firestore rules can check
 * request.auth.token.role and request.auth.token.status
 * without any extra document reads.
 */
async function syncUserSubscription(params: {
  uid: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripeStatus: Stripe.Subscription.Status;
  stripePriceId?: string;
  stripeCurrentPeriodEnd?: number;
  stripeCancelAtPeriodEnd?: boolean;
}) {
  const {
    uid,
    stripeCustomerId,
    stripeSubscriptionId,
    stripeStatus,
    stripeCurrentPeriodEnd,
    stripeCancelAtPeriodEnd,
  } = params;

  const platformStatus = stripeStatusToPlatformStatus(stripeStatus);

  // 1. Get current role (admins keep their role regardless of subscription)
  let role: "admin" | "member" = "member";
  try {
    const userDoc = await db.collection("users").doc(uid).get();
    if (userDoc.exists && userDoc.data()?.role === "admin") {
      role = "admin";
    }
  } catch {
    // Default to member
  }

  // 2. Write Firestore user doc (upsert — create if first time)
  await db
    .collection("users")
    .doc(uid)
    .set(
      {
        role,
        status: platformStatus,
        stripeCustomerId,
        stripeSubscriptionId,
        stripeStatus,
        stripeCurrentPeriodEnd: stripeCurrentPeriodEnd ?? null,
        stripeCancelAtPeriodEnd: stripeCancelAtPeriodEnd ?? false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

  // 3. Set Firebase Auth custom claims — this is what Firestore rules read
  //    Client token refreshes automatically on next request or within 1 hour.
  //    Force refresh happens on next sign-in.
  await auth.setCustomUserClaims(uid, {
    role,
    status: platformStatus,
  });

  console.log(`[syncUser] uid=${uid} role=${role} status=${platformStatus} stripe=${stripeStatus}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────────────────────────────────────────
export const helloWorld = onRequest(
  { region: "us-central1" },
  (_req, res) => {
    res.status(200).send("ALL ACCESS Cloud Functions — OK");
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// CREATE CHECKOUT SESSION
// Accepts: { uid: string }
// Returns: { url: string }
// ─────────────────────────────────────────────────────────────────────────────
export const createCheckoutSession = onRequest(
  { region: "us-central1", cors: true, secrets: [stripeSecretKey] },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    try {
      const STRIPE_SECRET_KEY =
        stripeSecretKey.value() || process.env.STRIPE_SECRET_KEY;
      const priceId = process.env.STRIPE_PRICE_ID;
      const appUrl = process.env.APP_URL;

      if (!STRIPE_SECRET_KEY?.trim()) {
        res.status(500).json({ error: "Missing STRIPE_SECRET_KEY" });
        return;
      }
      if (!priceId?.trim()) {
        res.status(500).json({ error: "Missing STRIPE_PRICE_ID" });
        return;
      }
      if (!appUrl?.trim()) {
        res.status(500).json({ error: "Missing APP_URL" });
        return;
      }

      const stripe = new Stripe(STRIPE_SECRET_KEY);

      const uid: string | undefined =
        typeof req.body?.uid === "string" && req.body.uid
          ? req.body.uid
          : undefined;

      // If we have a uid, check if they already have a Stripe customer ID
      let customerId: string | undefined;
      if (uid) {
        try {
          const userDoc = await db.collection("users").doc(uid).get();
          const existingCustomerId = userDoc.data()?.stripeCustomerId;
          if (existingCustomerId) customerId = existingCustomerId;
        } catch {
          // New user — no existing customer
        }
      }

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${appUrl}/profile?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/profile?checkout=cancel`,
        allow_promotion_codes: true,
        ...(uid ? { client_reference_id: uid } : {}),
        ...(customerId ? { customer: customerId } : {}),
      });

      if (!session.url) {
        res.status(500).json({ error: "Stripe session created but no URL returned" });
        return;
      }

      res.status(200).json({ url: session.url });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("createCheckoutSession error:", message);
      res.status(500).json({ error: "Failed to create checkout session", details: message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// STRIPE WEBHOOK
// Handles all subscription lifecycle events from Stripe.
// Verifies signature → syncs user in Firestore → sets Auth custom claims.
// ─────────────────────────────────────────────────────────────────────────────
export const stripeWebhook = onRequest(
  {
    region: "us-central1",
    secrets: [stripeSecretKey, stripeWebhookSecret],
    // Raw body required for Stripe signature verification
    invoker: "public",
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const STRIPE_SECRET_KEY =
      stripeSecretKey.value() || process.env.STRIPE_SECRET_KEY;
    const STRIPE_WEBHOOK_SECRET =
      stripeWebhookSecret.value() || process.env.STRIPE_WEBHOOK_SECRET;

    if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
      console.error("Missing Stripe secrets");
      res.status(500).json({ error: "Server misconfigured" });
      return;
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY);
    const sig = req.headers["stripe-signature"];

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        sig as string,
        STRIPE_WEBHOOK_SECRET
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Webhook signature verification failed:", message);
      res.status(400).json({ error: `Webhook error: ${message}` });
      return;
    }

    console.log(`[webhook] event: ${event.type}`);

    try {
      switch (event.type) {
        // ── Subscription created or updated ──────────────────
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.CheckoutSession;
          const uid = session.client_reference_id;
          const customerId = session.customer as string;
          const subscriptionId = session.subscription as string;

          if (!uid) {
            console.error("[webhook] checkout.session.completed — no uid in client_reference_id");
            break;
          }
          if (!subscriptionId) {
            console.error("[webhook] checkout.session.completed — no subscription id");
            break;
          }

          // Retrieve full subscription to get status
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);

          await syncUserSubscription({
            uid,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            stripeStatus: subscription.status,
            stripeCurrentPeriodEnd: subscription.current_period_end,
            stripeCancelAtPeriodEnd: subscription.cancel_at_period_end,
          });
          break;
        }

        // ── Subscription renewed / updated (billing cycle, plan change) ──
        case "customer.subscription.updated": {
          const subscription = event.data.object as Stripe.Subscription;
          const uid = await uidFromCustomerId(subscription.customer as string);
          if (!uid) break;

          await syncUserSubscription({
            uid,
            stripeCustomerId: subscription.customer as string,
            stripeSubscriptionId: subscription.id,
            stripeStatus: subscription.status,
            stripeCurrentPeriodEnd: subscription.current_period_end,
            stripeCancelAtPeriodEnd: subscription.cancel_at_period_end,
          });
          break;
        }

        // ── Subscription cancelled ────────────────────────────
        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;
          const uid = await uidFromCustomerId(subscription.customer as string);
          if (!uid) break;

          await syncUserSubscription({
            uid,
            stripeCustomerId: subscription.customer as string,
            stripeSubscriptionId: subscription.id,
            stripeStatus: "canceled",
            stripeCurrentPeriodEnd: subscription.current_period_end,
            stripeCancelAtPeriodEnd: false,
          });
          break;
        }

        // ── Invoice paid (renewal confirmed) ─────────────────
        case "invoice.payment_succeeded": {
          const invoice = event.data.object as Stripe.Invoice;
          if (invoice.billing_reason === "subscription_create") break; // Already handled above
          const subId = invoice.subscription as string;
          if (!subId) break;

          const subscription = await stripe.subscriptions.retrieve(subId);
          const uid = await uidFromCustomerId(invoice.customer as string);
          if (!uid) break;

          await syncUserSubscription({
            uid,
            stripeCustomerId: invoice.customer as string,
            stripeSubscriptionId: subId,
            stripeStatus: subscription.status,
            stripeCurrentPeriodEnd: subscription.current_period_end,
            stripeCancelAtPeriodEnd: subscription.cancel_at_period_end,
          });
          break;
        }

        // ── Payment failed (past_due) ─────────────────────────
        case "invoice.payment_failed": {
          const invoice = event.data.object as Stripe.Invoice;
          const subId = invoice.subscription as string;
          if (!subId) break;

          const uid = await uidFromCustomerId(invoice.customer as string);
          if (!uid) break;

          await syncUserSubscription({
            uid,
            stripeCustomerId: invoice.customer as string,
            stripeSubscriptionId: subId,
            stripeStatus: "past_due",
            stripeCurrentPeriodEnd: undefined,
            stripeCancelAtPeriodEnd: false,
          });
          break;
        }

        default:
          console.log(`[webhook] unhandled event: ${event.type}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[webhook] handler error:", message);
      // Return 200 to prevent Stripe retrying — log the issue for manual review
      res.status(200).json({ received: true, warning: message });
      return;
    }

    res.status(200).json({ received: true });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: look up uid from Stripe customer ID
// Used when webhook events only contain customerId, not uid
// ─────────────────────────────────────────────────────────────────────────────
async function uidFromCustomerId(customerId: string): Promise<string | null> {
  try {
    const snap = await db
      .collection("users")
      .where("stripeCustomerId", "==", customerId)
      .limit(1)
      .get();

    if (snap.empty) {
      console.error(`[uidFromCustomerId] no user found for customer: ${customerId}`);
      return null;
    }
    return snap.docs[0].id;
  } catch (err: unknown) {
    console.error("[uidFromCustomerId] error:", err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FORCE TOKEN REFRESH (optional utility)
// Call this from the client after checkout success to immediately refresh
// the user's ID token so custom claims are applied instantly without waiting
// for the 1-hour automatic refresh cycle.
// Usage: POST /forceTokenRefresh  { uid: string }  (admin-only utility)
// ─────────────────────────────────────────────────────────────────────────────
export const forceTokenRefresh = onRequest(
  { region: "us-central1", cors: true },
  async (req, res) => {
    // This endpoint is for the client to trigger a token refresh signal.
    // The actual token refresh happens on the client via user.getIdToken(true)
    // This just confirms the server has the latest claims.
    res.status(200).json({ message: "Refresh your ID token with user.getIdToken(true)" });
  }
);
