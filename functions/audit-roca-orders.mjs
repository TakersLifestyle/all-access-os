import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const env = readFileSync("../web/.env.local", "utf8").split("\n");
const getEnv = k => env.find(l => l.startsWith(k + "="))?.slice(k.length + 1).trim();
initializeApp({ credential: cert(JSON.parse(getEnv("GOOGLE_APPLICATION_CREDENTIALS_JSON"))) });
const db = getFirestore();

const ROCAFIESTA_ID = "MCzwl8mGF8P1rL5goEab";

// All orders regardless of status
const all = await db.collection("ticketOrders")
  .where("eventId", "==", ROCAFIESTA_ID)
  .get();

console.log(`Total orders (all statuses): ${all.size}\n`);

let paidTickets = 0;
for (const doc of all.docs) {
  const o = doc.data();
  const qty = o.quantity ?? 1;
  if (o.paymentStatus === "paid") paidTickets += qty;
  console.log(JSON.stringify({
    id: doc.id,
    status: o.paymentStatus,
    qty,
    unitPriceCents: o.unitPriceCents,
    email: o.userEmail,
    createdAt: o.createdAt?.slice(0,10),
  }));
}
console.log(`\nTotal paid tickets: ${paidTickets}`);
process.exit(0);
