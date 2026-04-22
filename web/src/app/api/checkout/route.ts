// Membership subscription checkout — $25/month CAD
// Membership is optional — for community supporters
// Does NOT gate event ticket access

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb } from "@/lib/firebase-admin";

const APP_URL = (process.env.APP_URL ?? "https://allaccesswinnipeg.ca").replace(/\/$/, "");

export async function POST(req: NextRequest) {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey?.trim()) {
      return NextResponse.json({ error: "Missing STRIPE_SECRET_KEY" }, { status: 500 });
    }

    const stripe = new Stripe(stripeKey);

    let uid: string | null = null;
    try {
      const body = await req.json();
      uid = body?.uid ?? null;
    } catch { /* no body */ }

    // Look up existing Stripe customer ID to avoid duplicates
    let customerId: string | undefined;
    if (uid) {
      try {
        const db = adminDb();
        const userDoc = await db.collection("users").doc(uid).get();
        customerId = userDoc.data()?.stripeCustomerId ?? undefined;
      } catch { /* new user — no customer yet */ }
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price_data: {
            currency: "cad",
            unit_amount: 2500, // $25.00 CAD in cents
            recurring: { interval: "month" },
            product_data: {
              name: "ALL ACCESS Community Membership",
              description:
                "Support the community. Help grow the platform. " +
                "Optional monthly membership — cancel anytime.",
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${APP_URL}/profile?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/profile?checkout=cancel`,
      allow_promotion_codes: true,
      ...(uid ? { client_reference_id: uid } : {}),
      ...(customerId ? { customer: customerId } : {}),
    } as any);

    if (!session.url) {
      return NextResponse.json({ error: "Stripe returned no URL" }, { status: 500 });
    }

    console.log(`[checkout] membership session created | sessionId=${session.id} uid=${uid ?? "anon"}`);

    return NextResponse.json({ url: session.url });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[checkout] error:", message);
    return NextResponse.json({ error: "Checkout failed", details: message }, { status: 500 });
  }
}
