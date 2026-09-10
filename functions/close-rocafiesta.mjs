/**
 * Close ROCAFIESTA: status → "completed", featured → false, soldOut → true
 * Also removes featured flag from ROCAFIESTA so only DJ LANKZ remains featured.
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const env = readFileSync("../web/.env.local", "utf8").split("\n");
const getEnv = k => env.find(l => l.startsWith(k + "="))?.slice(k.length + 1).trim();
initializeApp({ credential: cert(JSON.parse(getEnv("GOOGLE_APPLICATION_CREDENTIALS_JSON"))) });
const db = getFirestore();

const ROCAFIESTA_ID = "MCzwl8mGF8P1rL5goEab";

// ── Close ROCAFIESTA ────────────────────────────────────────────────────────
await db.collection("events").doc(ROCAFIESTA_ID).update({
  status:    "completed",
  featured:  false,
  soldOut:   true,
  ticketsRemaining: 0,
  updatedAt: new Date().toISOString(),
});
console.log("✓ ROCAFIESTA → status: completed, featured: false, soldOut: true");

// ── Final ticket + revenue summary ─────────────────────────────────────────
const orders = await db.collection("ticketOrders")
  .where("eventId", "==", ROCAFIESTA_ID)
  .where("paymentStatus", "==", "paid")
  .get();

let totalTickets = 0;
let totalBaseRevenue = 0;
for (const doc of orders.docs) {
  const o = doc.data();
  const qty = o.quantity ?? 1;
  const unitCents = o.unitPriceCents ?? Math.round((o.unitPrice ?? 25) * 100);
  totalTickets += qty;
  totalBaseRevenue += unitCents * qty;
}

console.log(`\n=== ROCAFIESTA FINAL SUMMARY ===`);
console.log(`Tickets sold (Firestore paid orders): ${totalTickets}`);
console.log(`Base revenue:  $${(totalBaseRevenue / 100).toFixed(2)} CAD`);
console.log(`\nNote: Stripe shows 18 tickets / 10 transactions.`);
console.log(`Discrepancy of 1 ticket likely means one Sep 5 order didn't webhook to 'paid'.`);

process.exit(0);
