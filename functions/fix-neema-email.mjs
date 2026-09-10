/**
 * Fix Neema's typo order — update userEmail from neema.mithumwa to neema.muthumwa
 * Order: WMiKjOmG6b7BNMHwM5Ji
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const env = readFileSync("../web/.env.local", "utf8").split("\n");
const getEnv = k => env.find(l => l.startsWith(k + "="))?.slice(k.length + 1).trim();

initializeApp({ credential: cert(JSON.parse(getEnv("GOOGLE_APPLICATION_CREDENTIALS_JSON"))) });
const db = getFirestore();

const ORDER_ID   = "WMiKjOmG6b7BNMHwM5Ji";
const WRONG_EMAIL = "neema.mithumwa@gmail.com";
const RIGHT_EMAIL = "neema.muthumwa@gmail.com";

const ref = db.collection("ticketOrders").doc(ORDER_ID);
const snap = await ref.get();

if (!snap.exists) {
  console.error("Order not found:", ORDER_ID);
  process.exit(1);
}

const current = snap.data().userEmail;
console.log(`Current email: ${current}`);

if (current === RIGHT_EMAIL) {
  console.log("✓ Already correct — nothing to do.");
  process.exit(0);
}

await ref.update({ userEmail: RIGHT_EMAIL });
console.log(`✓ Updated ${ORDER_ID}: ${WRONG_EMAIL} → ${RIGHT_EMAIL}`);
process.exit(0);
