import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import Stripe from "stripe";
import { readFileSync } from "fs";

const env = readFileSync("../web/.env.local", "utf8").split("\n");
const getEnv = k => env.find(l => l.startsWith(k + "="))?.slice(k.length + 1).trim();
initializeApp({ credential: cert(JSON.parse(getEnv("GOOGLE_APPLICATION_CREDENTIALS_JSON"))) });
const db = getFirestore();
const stripe = new Stripe(getEnv("STRIPE_SECRET_KEY"));

const orders = await db.collection("ticketOrders")
  .where("eventId", "==", "MCzwl8mGF8P1rL5goEab")
  .where("paymentStatus", "==", "paid")
  .get();

for (const doc of orders.docs) {
  const o = doc.data();
  let amountCents = null;
  if (o.stripePaymentIntentId) {
    try {
      const pi = await stripe.paymentIntents.retrieve(o.stripePaymentIntentId);
      amountCents = pi.amount_received;
    } catch(e) { amountCents = `ERR:${e.message}`; }
  }
  console.log(JSON.stringify({
    id: doc.id,
    email: o.userEmail,
    qty: o.quantity ?? 1,
    tierName: o.ticketTierName ?? "",
    amountCents,
    unitPriceCents: o.unitPriceCents ?? null,
    unitPrice: o.unitPrice ?? null,
  }));
}
process.exit(0);
