import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const env = readFileSync("../web/.env.local", "utf8").split("\n");
const getEnv = k => env.find(l => l.startsWith(k + "="))?.slice(k.length + 1).trim();
initializeApp({ credential: cert(JSON.parse(getEnv("GOOGLE_APPLICATION_CREDENTIALS_JSON"))) });
const db = getFirestore();

// bforsonfoidart bought Group of 3 @ $60 total → stored as qty=1, $60 unit
// Fix: qty=3, unitPriceCents=2000 ($20/ticket), totalPrice=$60
await db.collection("ticketOrders").doc("QWxWMoleK2YhJq1rLsXe").update({
  quantity: 3,
  unitPriceCents: 2000,
  unitPrice: 20,
  totalPrice: 60,
  updatedAt: new Date().toISOString(),
});
console.log("✓ bforsonfoidart (QWxWMoleK2YhJq1rLsXe) → qty: 3, unitPriceCents: 2000");

// Verify final count
const paid = await db.collection("ticketOrders")
  .where("eventId", "==", "MCzwl8mGF8P1rL5goEab")
  .where("paymentStatus", "==", "paid")
  .get();
let total = 0;
for (const doc of paid.docs) total += (doc.data().quantity ?? 1);
console.log(`\nFirestore paid ticket count (including admin test): ${total}`);
console.log(`Real customer tickets (excluding admin $15 test):   ${total - 1}`);
process.exit(0);
