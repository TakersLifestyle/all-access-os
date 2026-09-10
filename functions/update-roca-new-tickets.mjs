import Stripe from "stripe";
import { readFileSync } from "fs";
const env = readFileSync("../web/.env.local", "utf8").split("\n");
const getEnv = k => env.find(l => l.startsWith(k + "="))?.slice(k.length + 1).trim();
const stripe = new Stripe(getEnv("STRIPE_SECRET_KEY"));

const updates = [
  { pi: "pi_3UCTOZARL4KX4f6A2dUucqO9", desc: "ROCAFIESTA — Ticket #16–#17" }, // Kundai Kamhiriri
  { pi: "pi_3UCVJkARL4KX4f6A0mB1fEcP", desc: "ROCAFIESTA — Ticket #18"     }, // Ooreoluwatomiwa omolayo
];

for (const { pi, desc } of updates) {
  await stripe.paymentIntents.update(pi, { description: desc });
  console.log(`✓ ${pi} → ${desc}`);
}
process.exit(0);
