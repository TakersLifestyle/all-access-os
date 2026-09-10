import Stripe from "stripe";
import { readFileSync } from "fs";
const env = readFileSync("../web/.env.local", "utf8").split("\n");
const getEnv = k => env.find(l => l.startsWith(k + "="))?.slice(k.length + 1).trim();
const stripe = new Stripe(getEnv("STRIPE_SECRET_KEY"));

await stripe.paymentIntents.update("pi_3UCLryARL4KX4f6A2oJV0SEF", {
  description: "ROCAFIESTA — Ticket #13",
});
console.log("✓ Updated → ROCAFIESTA — Ticket #13 (daghenghen@gmail.com)");
process.exit(0);
