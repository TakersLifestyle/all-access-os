/**
 * create-friends-promo.mjs
 * Creates a 99% off Stripe coupon + FRIENDS promo code for the Skales event
 * Run from the functions/ folder:
 *   node create-friends-promo.mjs
 */

import Stripe from "stripe";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load STRIPE_SECRET_KEY from web/.env.local
let stripeKey = process.env.STRIPE_SECRET_KEY;
if (!stripeKey) {
  try {
    const env = readFileSync(resolve("../web/.env.local"), "utf8");
    const match = env.match(/^STRIPE_SECRET_KEY=(.+)$/m);
    if (match) stripeKey = match[1].trim();
  } catch { /* no .env.local */ }
}

if (!stripeKey) {
  console.error("❌  STRIPE_SECRET_KEY not found. Set it as an env var or add to web/.env.local");
  process.exit(1);
}

const stripe = new Stripe(stripeKey);

// ── 1. Create coupon ────────────────────────────────────────────────────────
const coupon = await stripe.coupons.create({
  percent_off: 99,
  duration: "once",          // applies to a single payment (not subscription)
  name: "FRIENDS — 99% off (Staff/Guest)",
  currency: "cad",
  max_redemptions: 50,       // cap at 50 uses — change if needed
});

console.log(`✅  Coupon created: ${coupon.id} (${coupon.percent_off}% off)`);

// ── 2. Create promotion code ────────────────────────────────────────────────
const promo = await stripe.promotionCodes.create({
  coupon: coupon.id,
  code: "FRIENDS",
  max_redemptions: 50,       // same cap
  active: true,
  restrictions: {
    first_time_transaction: false,
  },
});

console.log(`✅  Promo code created: ${promo.code}`);
console.log(`\n🎟  Code: FRIENDS`);
console.log(`💸  Discount: 99% off — $25 ticket → $0.25 CAD`);
console.log(`🔢  Max uses: 50`);
console.log(`\nShare this with DJ LANKZ for guest/comp tickets at checkout.`);
console.log(`Works at: https://allaccesswinnipeg.ca/skales`);
