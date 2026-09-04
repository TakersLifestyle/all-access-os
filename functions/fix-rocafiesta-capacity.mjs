import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const env = readFileSync("../web/.env.local", "utf8").split("\n");
const line = env.find(l => l.startsWith("GOOGLE_APPLICATION_CREDENTIALS_JSON="));
const raw = line.slice("GOOGLE_APPLICATION_CREDENTIALS_JSON=".length).trim();
initializeApp({ credential: cert(JSON.parse(raw)) });
const db = getFirestore();

const ROCAFIESTA_ID = "MCzwl8mGF8P1rL5goEab";
const CAPACITY = 100;

// Count actual paid tickets
const orders = await db.collection("ticketOrders")
  .where("eventId", "==", ROCAFIESTA_ID)
  .where("paymentStatus", "==", "paid")
  .get();

const ticketsSold = orders.docs.reduce((sum, o) => sum + (o.data().quantity ?? 1), 0);
const ticketsRemaining = CAPACITY - ticketsSold;

await db.collection("events").doc(ROCAFIESTA_ID).update({
  ticketCapacity: CAPACITY,
  capacity: CAPACITY,
  ticketsRemaining,
});

console.log(`✓ ROCAFIESTA capacity set to ${CAPACITY}`);
console.log(`  Tickets sold:      ${ticketsSold}`);
console.log(`  Tickets remaining: ${ticketsRemaining}`);
process.exit(0);
