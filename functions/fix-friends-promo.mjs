/**
 * fix-friends-promo.mjs — sets FRIENDS to 98% off
 * 98% off hits Stripe's $0.50 CAD minimum on a $25 ticket/membership
 * Run: node fix-friends-promo.mjs
 */
import Stripe from "stripe";
import { readFileSync } from "fs";
import { resolve } from "path";

let stripeKey = process.env.STRIPE_SECRET_KEY;
if (!stripeKey) {
  try {
    const env = readFileSync(resolve("../web/.env.local"), "utf8");
    const match = env.match(/^STRIPE_SECRET_KEY=(.+)$/m);
    if (match) stripeKey = match[1].trim();
  } catch {}
}
const stripe = new Stripe(stripeKey);

// Deactivate all existing FRIENDS codes
const existing = await stripe.promotionCodes.list({ code: "FRIENDS", limit: 10 });
for (const pc of existing.data) {
  if (pc.active) {
    await stripe.promotionCodes.update(pc.id, { active: false });
    console.log(`🗑  Deactivated: ${pc.id}`);
  }
}

// New coupon — 98% off, works for both one-time payments + subscriptions
const coupon = await stripe.coupons.create({
  percent_off: 98,
  duration: "repeating",
  duration_in_months: 1,
  name: "FRIENDS — 98% off (Staff/Guest comp)",
  currency: "cad",
  max_redemptions: 50,
});
console.log(`✅  Coupon: ${coupon.id} (98% off)`);

const promo = await stripe.promotionCodes.create({
  coupon: coupon.id,
  code: "FRIENDS",
  max_redemptions: 50,
  active: true,
});

console.log(`✅  Promo code: ${promo.code}`);
console.log(`\n🎟  Code: FRIENDS`);
console.log(`💸  98% off — $25 → $0.50 CAD (Stripe minimum met)`);
console.log(`📋  Works on: event tickets + membership`);
