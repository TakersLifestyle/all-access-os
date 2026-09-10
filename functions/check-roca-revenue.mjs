import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const env = readFileSync("../web/.env.local", "utf8").split("\n");
const getEnv = k => env.find(l => l.startsWith(k + "="))?.slice(k.length + 1).trim();
const serviceAccount = JSON.parse(getEnv("GOOGLE_APPLICATION_CREDENTIALS_JSON"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const ROCA_EVENT_ID = "MCzwl8mGF8P1rL5goEab";

const eventSnap = await db.collection("events").doc(ROCA_EVENT_ID).get();
const event = eventSnap.data();
console.log("Event: " + event.title);
console.log("Status: " + event.status);
console.log("Capacity: " + event.capacity + " | Remaining: " + event.ticketsRemaining);
console.log("Sold: " + (event.capacity - event.ticketsRemaining));
console.log("Price: $" + event.generalPrice);
console.log("");

const ordersSnap = await db.collection("ticketOrders")
  .where("eventId", "==", ROCA_EVENT_ID)
  .where("paymentStatus", "==", "paid")
  .get();

console.log("Paid orders: " + ordersSnap.size);
let totalTickets = 0;
let totalRevenue = 0;

ordersSnap.docs.forEach(d => {
  const o = d.data();
  totalTickets += o.quantity || 0;
  totalRevenue += o.totalPrice || 0;
  console.log("  " + (o.userEmail ?? o.userId ?? "unknown") + " — " + o.quantity + "x @ $" + o.unitPrice + " | paid $" + o.totalPrice + " | " + (o.paidAt ? o.paidAt.slice(0,10) : "?"));
});

console.log("");
console.log("Total tickets sold: " + totalTickets);
console.log("Total revenue: $" + totalRevenue.toFixed(2) + " CAD");
process.exit(0);
