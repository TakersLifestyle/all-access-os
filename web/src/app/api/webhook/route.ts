// Stripe webhook — syncs subscription status to Firestore + Firebase Auth custom claims
// Custom claims (role, status) are read by Firestore security rules — zero extra reads
// Also sends transactional emails via Resend after confirmed payments
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { sendMembershipWelcome, sendTicketConfirmation } from "@/lib/email";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

type PlatformStatus = "active" | "inactive" | "past_due" | "cancelled";

function stripeStatusToPlatformStatus(
  stripeStatus: Stripe.Subscription.Status
): PlatformStatus {
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

async function syncUser(params: {
  uid: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripeStatus: Stripe.Subscription.Status | "canceled";
  stripeCurrentPeriodEnd?: number;
  stripeCancelAtPeriodEnd?: boolean;
}) {
  const db = adminDb();
  const auth = adminAuth();
  const {
    uid,
    stripeCustomerId,
    stripeSubscriptionId,
    stripeStatus,
    stripeCurrentPeriodEnd,
    stripeCancelAtPeriodEnd,
  } = params;

  const platformStatus = stripeStatusToPlatformStatus(
    stripeStatus as Stripe.Subscription.Status
  );

  // Preserve existing role — admins stay admins regardless of subscription
  let role: "admin" | "member" = "member";
  try {
    const userDoc = await db.collection("users").doc(uid).get();
    if (userDoc.exists && userDoc.data()?.role === "admin") {
      role = "admin";
    }
  } catch {
    // Default to member
  }

  // 1. Sync Firestore doc
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
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

  // 2. Set Firebase Auth custom claims
  // These are read by Firestore rules as request.auth.token.role / .status
  // Client must call user.getIdToken(true) to pick up new claims immediately
  await auth.setCustomUserClaims(uid, {
    role,
    status: platformStatus,
  });

  console.log(
    `[webhook] synced uid=${uid} role=${role} status=${platformStatus} stripeStatus=${stripeStatus}`
  );
}

async function uidFromCustomerId(customerId: string): Promise<string | null> {
  const db = adminDb();
  const snap = await db
    .collection("users")
    .where("stripeCustomerId", "==", customerId)
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0].id;
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig || !webhookSecret) {
    return NextResponse.json(
      { error: "Missing signature or webhook secret" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Webhook signature verification failed:", msg);
    return NextResponse.json({ error: `Webhook Error: ${msg}` }, { status: 400 });
  }

  try {
    switch (event.type) {

      // ── Checkout completed — route by type ───────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // ── Event ticket purchase ──────────────────────────
        if (session.metadata?.type === "event_ticket") {
          const { orderId, eventId, quantity } = session.metadata;
          const paymentIntentId = session.payment_intent as string | null;
          const qty = parseInt(quantity ?? "1", 10);

          if (!orderId || !eventId) {
            console.error("[webhook] event_ticket — missing orderId or eventId");
            break;
          }

          const db = adminDb();

          // Use transaction to safely decrement ticketsRemaining
          let alreadyPaid = false;
          let savedOrderData: FirebaseFirestore.DocumentData | undefined;

          await db.runTransaction(async (tx) => {
            const eventRef = db.collection("events").doc(eventId);
            const orderRef = db.collection("ticketOrders").doc(orderId);

            const [eventSnap, orderSnap] = await Promise.all([
              tx.get(eventRef),
              tx.get(orderRef),
            ]);

            if (!eventSnap.exists) {
              console.error(`[webhook] event_ticket — event ${eventId} not found`);
              return;
            }

            if (!orderSnap.exists) {
              console.error(`[webhook] event_ticket — order ${orderId} not found`);
              return;
            }

            // Idempotency — don't double-process
            if (orderSnap.data()?.paymentStatus === "paid") {
              console.log(`[webhook] event_ticket — order ${orderId} already paid, skipping`);
              alreadyPaid = true;
              return;
            }

            savedOrderData = orderSnap.data();
            const eventData = eventSnap.data()!;
            const currentRemaining = typeof eventData.ticketsRemaining === "number"
              ? eventData.ticketsRemaining
              : (eventData.capacity ?? 0);

            const newRemaining = Math.max(0, currentRemaining - qty);

            // Mark order as paid
            tx.update(orderRef, {
              paymentStatus: "paid",
              stripePaymentIntentId: paymentIntentId ?? null,
              stripeCheckoutSessionId: session.id,
              paidAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });

            // Decrement ticketsRemaining, auto-mark sold_out if needed
            tx.update(eventRef, {
              ticketsRemaining: newRemaining,
              ...(newRemaining === 0 ? { status: "sold_out" } : {}),
              updatedAt: new Date().toISOString(),
            });
          });

          console.log(`[webhook] event_ticket confirmed — orderId=${orderId} eventId=${eventId} qty=${qty}`);

          // ── Send ticket confirmation email (after transaction, idempotent) ──
          if (!alreadyPaid && savedOrderData) {
            const toEmail = savedOrderData.userEmail ?? session.customer_details?.email;
            if (toEmail) {
              // Fetch event data for details
              const eventSnap = await db.collection("events").doc(eventId).get();
              const eventData = eventSnap.data() ?? {};

              // Resolve display name: try Auth first, fall back to session
              let displayName: string | null = null;
              const buyerUid = savedOrderData.userId || session.client_reference_id;
              if (buyerUid) {
                try {
                  const auth = adminAuth();
                  const userRecord = await auth.getUser(buyerUid);
                  displayName = userRecord.displayName ?? null;
                } catch { /* no-op */ }
              }

              await sendTicketConfirmation({
                orderId,
                toEmail,
                displayName,
                eventTitle: savedOrderData.eventTitle ?? eventData.title ?? "Your Event",
                eventDate: eventData.date ?? "",
                eventLocation: eventData.location ?? "",
                quantity: qty,
                unitPriceCents: Math.round((savedOrderData.unitPrice ?? 0) * 100),
                totalPaidCents: Math.round((savedOrderData.totalPrice ?? 0) * 100),
                stripePaymentIntentId: paymentIntentId ?? session.id,
                paidAt: new Date().toISOString(),
              }).catch((err) =>
                console.error("[webhook] ticket confirmation email failed:", err)
              );
            } else {
              console.warn(`[webhook] event_ticket — no email address for orderId=${orderId}`);
            }
          }

          break;
        }

        // ── Membership subscription checkout ──────────────
        const uid = session.client_reference_id ?? session.metadata?.uid;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (!uid || !subscriptionId) {
          console.error("[webhook] checkout.session.completed — missing uid or subscriptionId");
          break;
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await syncUser({
          uid,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          stripeStatus: subscription.status,
          stripeCurrentPeriodEnd: (subscription as any).billing_cycle_anchor,
          stripeCancelAtPeriodEnd: subscription.cancel_at_period_end,
        });

        // ── Send membership welcome email (idempotent) ────
        {
          const toEmail =
            session.customer_details?.email ??
            session.customer_email ??
            null;

          if (toEmail) {
            // Resolve display name from Firebase Auth
            let displayName: string | null = null;
            try {
              const auth = adminAuth();
              const userRecord = await auth.getUser(uid);
              displayName = userRecord.displayName ?? null;
            } catch { /* no-op */ }

            // Amount paid = first invoice line total (cents)
            const amountPaidCents = session.amount_total ?? 0;
            const paidAt = session.created; // Unix timestamp

            await sendMembershipWelcome({
              uid,
              toEmail,
              displayName,
              amountPaidCents,
              stripeSessionId: session.id,
              paidAt,
            }).catch((err) =>
              console.error("[webhook] membership welcome email failed:", err)
            );
          } else {
            console.warn(`[webhook] membership — no email address for uid=${uid}`);
          }
        }

        break;
      }

      // ── Subscription renewed or changed ───────────────────
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const uid = await uidFromCustomerId(sub.customer as string);
        if (!uid) break;

        await syncUser({
          uid,
          stripeCustomerId: sub.customer as string,
          stripeSubscriptionId: sub.id,
          stripeStatus: sub.status,
          stripeCurrentPeriodEnd: (sub as any).billing_cycle_anchor,
          stripeCancelAtPeriodEnd: sub.cancel_at_period_end,
        });
        break;
      }

      // ── Subscription cancelled ────────────────────────────
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const uid = await uidFromCustomerId(sub.customer as string);
        if (!uid) break;

        await syncUser({
          uid,
          stripeCustomerId: sub.customer as string,
          stripeSubscriptionId: sub.id,
          stripeStatus: "canceled",
          stripeCurrentPeriodEnd: (sub as any).billing_cycle_anchor,
          stripeCancelAtPeriodEnd: false,
        });
        break;
      }

      // ── Invoice paid (renewal confirmed) ─────────────────
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.billing_reason === "subscription_create") break; // Handled above
        const subId = (invoice as any).subscription as string | null;
        if (!subId) break;

        const customerId = (invoice as any).customer as string;
        const uid = await uidFromCustomerId(customerId);
        if (!uid) break;

        const subscription = await stripe.subscriptions.retrieve(subId);
        await syncUser({
          uid,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subId,
          stripeStatus: subscription.status,
          stripeCurrentPeriodEnd: (subscription as any).billing_cycle_anchor,
          stripeCancelAtPeriodEnd: subscription.cancel_at_period_end,
        });
        break;
      }

      // ── Payment failed → past_due ─────────────────────────
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = (invoice as any).customer as string;
        const subId = (invoice as any).subscription as string | null;
        const uid = await uidFromCustomerId(customerId);
        if (!uid) break;

        await syncUser({
          uid,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subId ?? "",
          stripeStatus: "past_due",
          stripeCurrentPeriodEnd: undefined,
          stripeCancelAtPeriodEnd: false,
        });
        break;
      }

      default:
        console.log(`[webhook] unhandled: ${event.type}`);
    }
  } catch (err: unknown) {
    console.error("[webhook] handler error:", err);
    // Return 200 — prevents Stripe retrying for logic errors
    return NextResponse.json({ received: true, warning: "Internal error — logged" });
  }

  return NextResponse.json({ received: true });
}
