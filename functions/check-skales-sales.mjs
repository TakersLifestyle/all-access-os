import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const env = readFileSync("../web/.env.local", "utf8").split("\n");
const getEnv = k => env.find(l => l.startsWith(k + "="))?.slice(k.length + 1).trim();
const serviceAccount = JSON.parse(getEnv("GOOGLE_APPLICATION_CREDENTIALS_JSON"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const EVENT_ID = "EQIimnVZ5jPhVKPLyAJ2";

const eventSnap = await db.collection("events").doc(EVENT_ID).get();
const event = eventSnap.data();
console.log("Event: " + event.title);
console.log("Status: " + event.status);
console.log("Capacity: " + event.capacity);
console.log("ticketsRemaining: " + event.ticketsRemaining);
console.log("Sold: " + (event.capacity - event.ticketsRemaining));
console.log("earlyBirdSoldOut: " + event.earlyBirdSoldOut);
console.log("Prices: EB $" + event.earlyBirdPrice + " | GA $" + event.generalPrice + " | VIP $" + event.vipPrice);
console.log("");

const ordersSnap = await db.collection("ticketOrders")
  .where("eventId", "==", EVENT_ID)
  .where("paymentStatus", "==", "paid")
  .get();

console.log("Paid orders: " + ordersSnap.size);
let totalTickets = 0;
let totalRevenue = 0;
const byType = {};

ordersSnap.docs.forEach(d => {
  const o = d.data();
  totalTickets += o.quantity || 0;
  totalRevenue += o.totalPrice || 0;
  const type = o.ticketType || "general";
  if (!byType[type]) byType[type] = { count: 0, tickets: 0, revenue: 0 };
  byType[type].count++;
  byType[type].tickets += o.quantity || 0;
  byType[type].revenue += o.totalPrice || 0;
  console.log("  " + (o.userEmail ?? o.userId ?? "unknown") + " — " + o.quantity + "x " + type + " @ $" + o.unitPrice + " | paid $" + o.totalPrice + " | " + (o.paidAt ? o.paidAt.slice(0,10) : "?"));
});

console.log("");
console.log("── By ticket type ──────────────────────");
for (const [type, data] of Object.entries(byType)) {
  console.log("  " + type + ": " + data.tickets + " tickets across " + data.count + " orders — $" + data.revenue.toFixed(2) + " revenue");
}
console.log("── TOTALS ───────────────────────────────");
console.log("  Total tickets sold: " + totalTickets);
console.log("  Total revenue: $" + totalRevenue.toFixed(2) + " CAD");
process.exit(0);
