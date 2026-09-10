/**
 * update-skales-ticket-tiers.mjs
 * Adds ticket tier pricing to the DJ LANKZ / SKALES event in Firestore.
 * Early Bird: SOLD OUT ($25 — historical)
 * General Admission: $35
 * VIP (Skip the Line): $50
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const env = readFileSync("../web/.env.local", "utf8").split("\n");
const getEnv = k => env.find(l => l.startsWith(k + "="))?.slice(k.length + 1).trim();
const serviceAccount = JSON.parse(getEnv("GOOGLE_APPLICATION_CREDENTIALS_JSON"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const EVENT_ID = "EQIimnVZ5jPhVKPLyAJ2";

const snap = await db.collection("events").doc(EVENT_ID).get();
if (!snap.exists) { console.error("Event not found"); process.exit(1); }
console.log(`Event: "${snap.data().title}"`);
console.log(`Current generalPrice: ${snap.data().generalPrice}`);

await db.collection("events").doc(EVENT_ID).update({
  earlyBirdPrice:   25,
  earlyBirdSoldOut: true,
  generalPrice:     35,   // replaces old $25 — used by default checkout flow
  vipPrice:         50,
  updatedAt:        new Date().toISOString(),
});

console.log("✅ Ticket tiers updated:");
console.log("   Early Bird: $25 — SOLD OUT");
console.log("   General Admission: $35");
console.log("   VIP (Skip the Line): $50");
process.exit(0);
