/**
 * Find Hauwa's ROCAFIESTA payment intent and update the description to
 * "ROCAFIESTA — Ticket #5" so it shows correctly in Stripe dashboard.
 *
 * Searches by amount + email instead of hardcoding the ID (avoids screenshot typos).
 *
 * Run: node --env-file=.env.local --env-file=../web/.env.local ../functions/fix-hauwa-stripe-desc.mjs
 */
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ── Check key mode ─────────────────────────────────────────────────────────────
const isLive = (process.env.STRIPE_SECRET_KEY || "").startsWith("sk_live");
console.log(`Stripe key mode: ${isLive ? "LIVE ✅" : "TEST ⚠️  — live payments will not be found"}`);

// ── Search recent payment intents for $26.03 (2603 cents) ─────────────────────
console.log("\nSearching Stripe payment intents for $26.03 CAD around Aug 27…");

const list = await stripe.paymentIntents.list({
  limit: 100,
  created: {
    gte: Math.floor(new Date("2026-08-26").getTime() / 1000),
    lte: Math.floor(new Date("2026-08-29").getTime() / 1000),
  },
});

console.log(`Found ${list.data.length} payment intents in that date range`);

const hauwa = list.data.find(pi =>
  pi.amount === 2603 &&
  (pi.receipt_email?.includes("hauwa") ||
   pi.description?.includes("hauwa") ||
   JSON.stringify(pi.metadata).toLowerCase().includes("hauwa") ||
   pi.amount === 2603)
);

if (!hauwa) {
  console.log("\nNo $26.03 payment intent found — printing all intents in range:");
  list.data.forEach(pi => {
    console.log(`  ${pi.id}  $${(pi.amount/100).toFixed(2)}  ${pi.status}  email:${pi.receipt_email ?? "—"}  desc:${pi.description ?? "—"}`);
  });
  process.exit(0);
}

console.log(`\nFound: ${hauwa.id}`);
console.log(`  amount:  $${(hauwa.amount/100).toFixed(2)}`);
console.log(`  status:  ${hauwa.status}`);
console.log(`  current desc: ${hauwa.description ?? "(none)"}`);

// ── Update the description ─────────────────────────────────────────────────────
const updated = await stripe.paymentIntents.update(hauwa.id, {
  description: "ROCAFIESTA — Ticket #5",
});
console.log(`\n✅ Updated description to: "${updated.description}"`);
process.exit(0);
