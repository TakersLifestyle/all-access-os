import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import Stripe from "stripe";
import { readFileSync } from "fs";

const env = readFileSync("../web/.env.local", "utf8").split("\n");
const getEnv = k => env.find(l => l.startsWith(k + "="))?.slice(k.length + 1).trim();
initializeApp({ credential: cert(JSON.parse(getEnv("GOOGLE_APPLICATION_CREDENTIALS_JSON"))) });
const db = getFirestore();
const stripe = new Stripe(getEnv("STRIPE_SECRET_KEY"));

const ref = db.collection("ticketOrders").doc("AFps2pLJcIOTZzuE8Lp0");
const snap = await ref.get();
const o = snap.data();

const session = await stripe.checkout.sessions.retrieve(o.stripeCheckoutSessionId);
const email = session.customer_details?.email;
const name  = session.customer_details?.name;

await ref.update({ userEmail: email, ...(name ? { userName: name } : {}) });
console.log(`✓ Updated → ${email} (${name})`);
process.exit(0);
