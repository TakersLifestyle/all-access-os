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

// List all FRIENDS promo codes
const promos = await stripe.promotionCodes.list({ code: "FRIENDS", limit: 10 });
console.log("=== PROMO CODES ===");
for (const p of promos.data) {
  console.log(`id: ${p.id} | active: ${p.active} | times_redeemed: ${p.times_redeemed} | max: ${p.max_redemptions}`);
  const coupon = await stripe.coupons.retrieve(p.coupon.id);
  console.log(`  coupon: ${coupon.id} | duration: ${coupon.duration} | pct: ${coupon.percent_off}% | valid: ${coupon.valid}`);
  console.log(`  applies_to:`, coupon.applies_to ?? "all products");
}
