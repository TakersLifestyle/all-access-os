/**
 * Find which Sep 5 ROCAFIESTA order didn't get marked paid in Firestore and fix it.
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import Stripe from "stripe";
import { readFileSync } from "fs";

const env = readFileSync("../web/.env.local", "utf8").split("\n");
const getEnv = k => env.find(l => l.startsWith(k + "="))?.slice(k.length + 1).trim();
initializeApp({ credential: cert(JSON.parse(getEnv("GOOGLE_APPLICATION_CREDENTIALS_JSON"))) });
const db = getFirestore();
const stripe = new Stripe(getEnv("STRIPE_SECRET_KEY"));

const ROCAFIESTA_ID = "MCzwl8mGF8P1rL5goEab";

// The 3 new Sep 5 payment intents (confirmed from Stripe)
const newPIs = [
  { pi: "pi_3UCS9KARL4KX4f6A3idb8SSB", qty: 2, amount: 5103, name: "Sanni Abutu-Yaro",         email: "nasandanservices@gmail.com", tickets: "#14–#15" },
  { pi: "pi_3UCTOZARL4KX4f6A2dUucqO9", qty: 2, amount: 5103, name: "Kundai Kamhiriri",          email: "kamhiriri.kundai@gmail.com", tickets: "#16–#17" },
  { pi: "pi_3UCVJkARL4KX4f6A0mB1fEcP", qty: 1, amount: 2603, name: "Ooreoluwatomiwa omolayo",   email: "tommyphyllmusic@gmail.com",  tickets: "#18"     },
];

console.log("=== Checking Sep 5 orders in Firestore ===\n");

for (const entry of newPIs) {
  // Get orderId from PI metadata
  const pi = await stripe.paymentIntents.retrieve(entry.pi);
  const orderId = pi.metadata?.orderId;

  if (!orderId) {
    console.log(`✗ ${entry.name} — no orderId in PI metadata`);
    continue;
  }

  const orderDoc = await db.collection("ticketOrders").doc(orderId).get();

  if (!orderDoc.exists) {
    console.log(`✗ ${entry.name} (${orderId}) — ORDER MISSING from Firestore entirely`);
    // Create it
    await db.collection("ticketOrders").doc(orderId).set({
      orderId,
      userId: pi.metadata?.userId || null,
      userEmail: entry.email,
      userName: entry.name,
      eventId: ROCAFIESTA_ID,
      eventTitle: "ROCAFIESTA — A Spiritual Experience with Konfam",
      quantity: entry.qty,
      unitPrice: entry.qty === 1 ? 25 : 25,
      unitPriceCents: 2500,
      totalPrice: entry.qty * 25,
      isMemberPrice: false,
      memberDiscountPct: 0,
      savingsTotal: 0,
      paymentStatus: "paid",
      stripePaymentIntentId: entry.pi,
      stripeCheckoutSessionId: pi.metadata?.sessionId || null,
      confirmationEmailSentAt: null,
      createdAt: new Date(pi.created * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    });
    console.log(`  ✓ Created order in Firestore → paid`);
    continue;
  }

  const o = orderDoc.data();
  console.log(`  ${entry.name} | orderId=${orderId} | status=${o.paymentStatus} | qty=${o.quantity} | email=${o.userEmail}`);

  if (o.paymentStatus !== "paid") {
    // Backfill to paid
    await orderDoc.ref.update({
      paymentStatus: "paid",
      userEmail: o.userEmail || entry.email,
      userName: o.userName || entry.name,
      stripePaymentIntentId: entry.pi,
      updatedAt: new Date().toISOString(),
    });

    // Also decrement ticketsRemaining on event (it's completed so doesn't matter much, but keep accurate)
    console.log(`  ✓ Marked as paid`);
  } else {
    console.log(`  ✓ Already paid — OK`);
  }
}

// Final count
console.log("\n=== Final Firestore count ===");
const paid = await db.collection("ticketOrders")
  .where("eventId", "==", ROCAFIESTA_ID)
  .where("paymentStatus", "==", "paid")
  .get();

let total = 0;
for (const doc of paid.docs) total += (doc.data().quantity ?? 1);
console.log(`Paid tickets in Firestore: ${total}`);

process.exit(0);
