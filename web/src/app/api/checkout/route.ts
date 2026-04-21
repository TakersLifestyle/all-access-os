import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb } from "@/lib/firebase-admin";

const FOUNDING_LIMIT = 50;
const FOUNDING_COUPON_ID = "FOUNDING_MEMBER_50";

/**
 * Ensure the founding-member coupon exists in Stripe (idempotent).
 * $49 CAD off once → makes $99/mo first month = $50.
 */
async function ensureFoundingCoupon(stripe: Stripe): Promise<string> {
  try {
    await stripe.coupons.retrieve(FOUNDING_COUPON_ID);
    return FOUNDING_COUPON_ID;
  } catch {
    // Doesn't exist yet — create it
    const coupon = await stripe.coupons.create({
      id: FOUNDING_COUPON_ID,
      name: "Founding Member — First Month $50",
      amount_off: 4900,
      currency: "cad",
      duration: "once",
      max_redemptions: FOUNDING_LIMIT,
    });
    return coupon.id;
  }
}

export async function POST(req: NextRequest) {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const priceId = process.env.STRIPE_PRICE_ID;
    const appUrl = process.env.APP_URL ?? "https://allaccesswinnipeg.ca";

    if (!stripeKey?.trim()) {
      return NextResponse.json({ error: "Missing STRIPE_SECRET_KEY" }, { status: 500 });
    }
    if (!priceId?.trim()) {
      return NextResponse.json({ error: "Missing STRIPE_PRICE_ID" }, { status: 500 });
    }

    const stripe = new Stripe(stripeKey);

    let uid: string | null = null;
    try {
      const body = await req.json();
      uid = body?.uid ?? null;
    } catch { /* no body */ }

    // Look up existing Stripe customer ID
    let customerId: string | undefined;
    if (uid) {
      try {
        const db = adminDb();
        const userDoc = await db.collection("users").doc(uid).get();
        customerId = userDoc.data()?.stripeCustomerId ?? undefined;
      } catch { /* new user */ }
    }

    // Count active members to determine founding status
    let activeCount = 0;
    try {
      const db = adminDb();
      const snap = await db.collection("users").where("status", "==", "active").get();
      activeCount = snap.size;
    } catch { /* assume full */ }

    const isFoundingSlotAvailable = activeCount < FOUNDING_LIMIT;

    // Get or create the founding coupon when slots remain
    let couponId: string | undefined;
    if (isFoundingSlotAvailable) {
      try {
        couponId = await ensureFoundingCoupon(stripe);
      } catch (e) {
        console.warn("[checkout] Could not ensure founding coupon:", e);
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/profile?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/profile?checkout=cancel`,
      // Only allow manual promo codes when no auto-discount is applied
      allow_promotion_codes: !couponId,
      ...(uid ? { client_reference_id: uid } : {}),
      ...(customerId ? { customer: customerId } : {}),
      ...(couponId ? { discounts: [{ coupon: couponId }] } : {}),
    });

    if (!session.url) {
      return NextResponse.json({ error: "Stripe returned no URL" }, { status: 500 });
    }

    return NextResponse.json({
      url: session.url,
      isFoundingMember: isFoundingSlotAvailable,
      spotsRemaining: Math.max(0, FOUNDING_LIMIT - activeCount),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[checkout] error:", message);
    return NextResponse.json({ error: "Checkout failed", details: message }, { status: 500 });
  }
}
