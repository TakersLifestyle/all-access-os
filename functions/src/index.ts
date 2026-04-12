import * as path from "path";
import * as dotenv from "dotenv";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import Stripe from "stripe";

// Local development only — no-op in production (env vars injected by runtime).
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");

/**
 * Health check
 */
export const helloWorld = onRequest(
  { region: "us-central1" },
  (_req, res) => {
    res.status(200).send("helloWorld OK");
  }
);

/**
 * Stripe checkout session creator
 */
export const createCheckoutSession = onRequest(
  { region: "us-central1", cors: true, secrets: [stripeSecretKey] },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    try {
      // In production: read from Secret Manager via defineSecret.
      // In local dev: fall back to process.env populated by dotenv.
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

      // Pull uid from request body — used as client_reference_id so the webhook
      // knows which Firestore user to activate after payment.
      const uid: string | undefined =
        typeof req.body?.uid === "string" && req.body.uid ? req.body.uid : undefined;

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${appUrl}/profile?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/profile?checkout=cancel`,
        allow_promotion_codes: true,
        ...(uid ? { client_reference_id: uid } : {}),
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
