// Membership subscription checkout — $10/month CAD (ALL ACCESS)
// Membership unlocks downloads, reactions, high-res Memories + perks
// Does NOT gate event ticket access
//
// Stripe fee passthrough: buyer pays Stripe fee so ALL ACCESS nets the full $10
//   chargeAmount = ceil((base + 30) / (1 - 0.029))
//   ceil((1000 + 30) / 0.971) = ceil(1060.76) = 1061 cents = $10.61 charged → $10.00 net

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

    // Fee passthrough: buyer covers Stripe's 2.9% + $0.30 so ALL ACCESS nets the full $10
    const BASE_CENTS = 1000; // $10.00 CAD
    const chargeCents = Math.ceil((BASE_CENTS + 30) / (1 - 0.029)); // → 1061 = $10.61

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price_data: {
            currency: "cad",
            unit_amount: chargeCents,
            recurring: { interval: "month" },
            product_data: {
              name: "ALL ACCESS Membership",
              description:
                "High-res Memories, downloads, reactions, 30% off tickets, partner perks. " +
                "Cancel anytime. (Includes processing fee)",
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
      subscription_data: {
        description: "ALL ACCESS Membership — $10/month CAD",
      },
    });

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
