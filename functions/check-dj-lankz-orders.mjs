import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import Stripe from "stripe";
import { readFileSync } from "fs";

const env = readFileSync("../web/.env.local", "utf8").split("\n");
const getEnv = k => env.find(l => l.startsWith(k + "="))?.slice(k.length + 1).trim();
initializeApp({ credential: cert(JSON.parse(getEnv("GOOGLE_APPLICATION_CREDENTIALS_JSON"))) });
const db = getFirestore();
const stripe = new Stripe(getEnv("STRIPE_SECRET_KEY"));

// Find DJ LANKZ event
const events = await db.collection("events").get();
let djLankzId = null;
for (const doc of events.docs) {
  const t = (doc.data().title ?? "").toLowerCase();
  if (t.includes("lankz") || t.includes("dj lank")) {
    djLankzId = doc.id;
    console.log(`Event: ${doc.data().title} → ${doc.id}`);
  }
}

if (!djLankzId) { console.error("DJ LANKZ event not found"); process.exit(1); }

const orders = await db.collection("ticketOrders")
  .where("eventId", "==", djLankzId)
  .where("paymentStatus", "==", "paid")
  .get();

console.log(`\nFound ${orders.size} paid orders:\n`);

for (const doc of orders.docs) {
  const o = doc.data();
  let email = o.userEmail ?? null;

  // Backfill missing email from Stripe
  if (!email && o.stripeCheckoutSessionId) {
    try {
      const sess = await stripe.checkout.sessions.retrieve(o.stripeCheckoutSessionId);
      email = sess.customer_details?.email ?? null;
      const name = sess.customer_details?.name ?? null;
      if (email) {
        await doc.ref.update({ userEmail: email, ...(name ? { userName: name } : {}) });
        console.log(`  (backfilled ${email})`);
      }
    } catch(e) { /* no-op */ }
  }

  console.log(JSON.stringify({
    id: doc.id,
    email,
    qty: o.quantity ?? 1,
    tier: o.ticketTierName ?? o.tierName ?? "General Admission",
    unitPriceCents: o.unitPriceCents ?? null,
    emailSent: !!o.confirmationEmailSentAt,
    sentAt: o.confirmationEmailSentAt ?? null,
  }));
}
process.exit(0);
