/**
 * Backfill userEmail into ticketOrders for guest checkouts that have no email stored.
 * Pulls email from Stripe checkout session. Run: node backfill-order-emails.mjs
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

const orders = await db.collection("ticketOrders")
  .where("eventId", "==", ROCAFIESTA_ID)
  .where("paymentStatus", "==", "paid")
  .get();

let updated = 0;
let skipped = 0;

for (const doc of orders.docs) {
  const o = doc.data();
  if (o.userEmail) { skipped++; continue; } // already has email

  if (!o.stripeCheckoutSessionId) {
    console.log(`⚠  ${doc.id} — no stripeCheckoutSessionId, skipping`);
    skipped++;
    continue;
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(o.stripeCheckoutSessionId);
    const email = session.customer_details?.email ?? null;
    const name  = session.customer_details?.name  ?? null;

    if (!email) {
      console.log(`⚠  ${doc.id} — Stripe session has no email`);
      skipped++;
      continue;
    }

    await doc.ref.update({
      userEmail: email,
      ...(name && !o.userName ? { userName: name } : {}),
    });

    console.log(`✓ ${doc.id} → ${email}${name ? ` (${name})` : ""}`);
    updated++;
  } catch (err) {
    console.warn(`✗ ${doc.id} — ${err.message}`);
    skipped++;
  }
}

console.log(`\n✅ Done — ${updated} updated, ${skipped} skipped`);
process.exit(0);
