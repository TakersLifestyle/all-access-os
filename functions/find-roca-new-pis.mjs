/**
 * Find the 3 new ROCAFIESTA payment intents from Sep 5 night and update their descriptions.
 * Looks up by customer email since we can't read the PI IDs from screenshots precisely.
 */
import Stripe from "stripe";
import { readFileSync } from "fs";
const env = readFileSync("../web/.env.local", "utf8").split("\n");
const getEnv = k => env.find(l => l.startsWith(k + "="))?.slice(k.length + 1).trim();
const stripe = new Stripe(getEnv("STRIPE_SECRET_KEY"));

// Search for ROCAFIESTA payment intents created Sep 5 with no description set
// Created after Sep 4 midnight UTC = 1757001600
const pis = await stripe.paymentIntents.list({
  created: { gte: 1757001600 }, // Sep 5, 2026 UTC
  limit: 50,
});

const rocaFiestaNew = pis.data.filter(pi =>
  pi.status === "succeeded" &&
  !pi.description &&
  pi.metadata?.type === "event_ticket" &&
  pi.metadata?.eventId === "MCzwl8mGF8P1rL5goEab"
);

console.log(`Found ${rocaFiestaNew.length} ROCAFIESTA PIs without descriptions:\n`);
for (const pi of rocaFiestaNew) {
  const cs = await stripe.checkout.sessions.retrieve(pi.metadata.checkoutSessionId || "none").catch(() => null);
  console.log(JSON.stringify({
    id: pi.id,
    amount: pi.amount,
    email: pi.receipt_email ?? pi.customer_details?.email ?? null,
    created: new Date(pi.created * 1000).toISOString(),
    orderId: pi.metadata?.orderId,
    qty: pi.metadata?.quantity,
  }));
}

// Also try listing recent successful PIs by amount
console.log("\n--- All Sep 5+ succeeded PIs (ROCAFIESTA amounts) ---");
const all = pis.data.filter(pi => pi.status === "succeeded" && [2603, 5103].includes(pi.amount));
for (const pi of all) {
  console.log(`${pi.id} | $${(pi.amount/100).toFixed(2)} | ${pi.receipt_email ?? "no email"} | desc: "${pi.description ?? "(none)"}" | ${new Date(pi.created*1000).toISOString()}`);
}
process.exit(0);
