import Stripe from "stripe";
import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../web/.env.local") });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Create $25 CAD/month community membership price
const product = await stripe.products.create({
  name: "ALL ACCESS Community Membership",
  description: "Support the community. Unlock member pricing on events, 6+ local perks, and early access.",
});

const price = await stripe.prices.create({
  product: product.id,
  unit_amount: 2500,   // $25.00 CAD
  currency: "cad",
  recurring: { interval: "month" },
  nickname: "Community Monthly",
});

console.log("✓ Product ID:", product.id);
console.log("✓ Price ID:", price.id);
console.log("\nAdd to Vercel env vars:");
console.log(`STRIPE_PRICE_ID=${price.id}`);
