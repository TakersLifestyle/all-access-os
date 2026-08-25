/**
 * update-rocafiesta-pricing.mjs
 * Syncs ROCAFIESTA Firestore pricing with the new tier structure:
 * - Tier 1 (regular): sold out
 * - Tier 2: now active at $25
 * - bundle3: $60 (was $50)
 * - bundle5: $100 (was $80)
 * - generalPrice / memberPrice: $25
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const envContent = readFileSync("C:\\Users\\TakersLifestyle\\all-access-platform\\web\\.env.local", "utf8");
const saLine = envContent.split("\n").find(l => l.startsWith("GOOGLE_APPLICATION_CREDENTIALS_JSON="));
const serviceAccount = JSON.parse(saLine.replace("GOOGLE_APPLICATION_CREDENTIALS_JSON=", "").trim());

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const EVENT_ID = "MCzwl8mGF8P1rL5goEab";

await db.collection("events").doc(EVENT_ID).update({
  generalPrice: 25,
  memberPrice: 25,
  "ticketTiers.bundle3.price": 60,
  "ticketTiers.bundle3.description": "3 tickets for $60 — save $15.",
  "ticketTiers.bundle5.price": 100,
  "ticketTiers.bundle5.description": "5 tickets for $100 — save $25.",
  updatedAt: FieldValue.serverTimestamp(),
});

console.log("✅ Firestore updated:");
console.log("   generalPrice / memberPrice → $25");
console.log("   bundle3 → $60 (save $15)");
console.log("   bundle5 → $100 (save $25)");
process.exit(0);
