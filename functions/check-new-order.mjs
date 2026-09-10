import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const env = readFileSync("../web/.env.local", "utf8").split("\n");
const getEnv = k => env.find(l => l.startsWith(k + "="))?.slice(k.length + 1).trim();
initializeApp({ credential: cert(JSON.parse(getEnv("GOOGLE_APPLICATION_CREDENTIALS_JSON"))) });
const db = getFirestore();

// Check most recent ROCAFIESTA paid orders
const orders = await db.collection("ticketOrders")
  .where("eventId", "==", "MCzwl8mGF8P1rL5goEab")
  .where("paymentStatus", "==", "paid")
  .get();

for (const doc of orders.docs) {
  const o = doc.data();
  // Show orders from today
  const createdAt = o.createdAt ?? o.paidAt ?? "";
  if (createdAt.includes("2026-09-05") || o.userEmail === "daghenghen@gmail.com") {
    console.log(JSON.stringify({
      id: doc.id,
      email: o.userEmail,
      qty: o.quantity,
      tier: o.ticketTierName,
      emailSent: !!o.confirmationEmailSentAt,
      sentAt: o.confirmationEmailSentAt ?? null,
      createdAt,
    }, null, 2));
  }
}
process.exit(0);
