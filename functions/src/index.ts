import * as path from "path";
import * as crypto from "crypto";
import * as dotenv from "dotenv";
import { onRequest } from "firebase-functions/v2/https";
import { onObjectFinalized } from "firebase-functions/v2/storage";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import Stripe from "stripe";
import sharp from "sharp";

// Local dev only — production env vars injected by Cloud Functions runtime
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

// Initialize Firebase Admin (once)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const auth = admin.auth();

const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");

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

// NOTE: Stripe webhook is handled by the Next.js API route at /api/webhook (Vercel).
// No Cloud Function needed here.

// ─────────────────────────────────────────────────────────────────────────────
// MEMORY THUMBNAIL GENERATOR
// Triggers on every new file in memories/*/photos/**
// Resizes to max 800×800, stores in memories/*/thumbnails/, updates Firestore
// ─────────────────────────────────────────────────────────────────────────────
export const generateMemoryThumbnail = onObjectFinalized(
  { region: "us-east1", memory: "1GiB", timeoutSeconds: 300 },
  async (event) => {
    const filePath = event.data.name;
    const bucketName = event.data.bucket;
    const contentType = event.data.contentType ?? "";

    // Only handle images inside memories/*/photos/
    if (!filePath || !filePath.match(/^memories\/[^/]+\/photos\//)) return;
    if (!contentType.startsWith("image/")) return;

    try {
      const bucket = admin.storage().bucket(bucketName);

      const [buffer] = await bucket.file(filePath).download();

      const resized = await sharp(buffer)
        .resize(800, 800, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 82, progressive: true })
        .toBuffer();

      const thumbPath = filePath.replace("/photos/", "/thumbnails/");
      const thumbFile = bucket.file(thumbPath);
      const token = crypto.randomUUID();

      await thumbFile.save(resized, {
        metadata: {
          contentType: "image/jpeg",
          metadata: { firebaseStorageDownloadTokens: token },
        },
      });

      const encodedPath = encodeURIComponent(thumbPath);
      const thumbnailUrl =
        `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${token}`;

      // Update the Firestore memoryMedia doc for this original path
      const snap = await db
        .collection("memoryMedia")
        .where("storagePath", "==", filePath)
        .limit(1)
        .get();

      if (!snap.empty) {
        await snap.docs[0].ref.update({ thumbnailUrl });
        console.log(`[thumbnail] ✓ ${filePath}`);
      } else {
        console.warn(`[thumbnail] no Firestore doc for: ${filePath}`);
      }
    } catch (err) {
      console.error(`[thumbnail] error for ${filePath}:`, err);
    }
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

// ─────────────────────────────────────────────────────────────────────────────
// BACKFILL THUMBNAILS (one-time utility — call once, then redeploy to remove)
// GET /backfillThumbnails?secret=<BACKFILL_SECRET>&offset=0&limit=20
// Generates thumbnails for existing memoryMedia photos that don't have one yet.
// Process in batches by incrementing offset until processed === 0.
// ─────────────────────────────────────────────────────────────────────────────
export const backfillThumbnails = onRequest(
  { region: "us-central1", memory: "2GiB", timeoutSeconds: 540, invoker: "public" },
  async (req, res) => {
    if (req.query["secret"] !== (process.env.BACKFILL_SECRET || "allaccess2026")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const offset = parseInt(String(req.query["offset"] || "0"), 10);
    const limit = parseInt(String(req.query["limit"] || "20"), 10);

    try {
      const snap = await db.collection("memoryMedia")
        .where("type", "==", "photo")
        .limit(limit)
        .offset(offset)
        .get();

      const missing = snap.docs.filter(d => !d.data().thumbnailUrl);
      const results: string[] = [];

      for (const doc of missing) {
        const data = doc.data();
        const filePath: string = data.storagePath;
        if (!filePath) { results.push(`skip(no path):${doc.id}`); continue; }

        try {
          const bucket = admin.storage().bucket(data.bucketName || undefined);
          const [buffer] = await bucket.file(filePath).download();
          const resized = await sharp(buffer)
            .resize(800, 800, { fit: "inside", withoutEnlargement: true })
            .jpeg({ quality: 82, progressive: true })
            .toBuffer();

          const thumbPath = filePath.replace("/photos/", "/thumbnails/");
          const thumbFile = bucket.file(thumbPath);
          const token = crypto.randomUUID();
          await thumbFile.save(resized, {
            metadata: { contentType: "image/jpeg", metadata: { firebaseStorageDownloadTokens: token } },
          });

          const bucketName = bucket.name;
          const encodedPath = encodeURIComponent(thumbPath);
          const thumbnailUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${token}`;
          await doc.ref.update({ thumbnailUrl });
          results.push(`✓ ${filePath}`);
        } catch (err: unknown) {
          results.push(`✗ ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      res.status(200).json({
        offset,
        fetched: snap.docs.length,
        processed: missing.length,
        results,
        nextOffset: snap.docs.length < limit ? null : offset + limit,
      });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  }
);
