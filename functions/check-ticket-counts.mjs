import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const env = readFileSync("../web/.env.local", "utf8").split("\n");
const line = env.find(l => l.startsWith("GOOGLE_APPLICATION_CREDENTIALS_JSON="));
const raw = line.slice("GOOGLE_APPLICATION_CREDENTIALS_JSON=".length).trim();
initializeApp({ credential: cert(JSON.parse(raw)) });
const db = getFirestore();

// All events
const events = await db.collection("events").get();
console.log("── Events ──────────────────────────────────────────");
for (const doc of events.docs) {
  const d = doc.data();
  // Count paid ticketOrders for this event
  const orders = await db.collection("ticketOrders")
    .where("eventId", "==", doc.id)
    .where("paymentStatus", "==", "paid")
    .get();
  const ticketsSold = orders.docs.reduce((sum, o) => sum + (o.data().quantity ?? 1), 0);
  const remaining = (d.ticketCapacity ?? d.capacity ?? "?") - ticketsSold;
  console.log(`\n${d.title}`);
  console.log(`  ID:              ${doc.id}`);
  console.log(`  status:          ${d.status}`);
  console.log(`  capacity:        ${d.ticketCapacity ?? d.capacity ?? "not set"}`);
  console.log(`  ticketsRemaining:${d.ticketsRemaining ?? "not set"} (Firestore)`);
  console.log(`  paid orders:     ${orders.size} orders → ${ticketsSold} tickets sold`);
  console.log(`  expected remain: ${remaining}`);
  if ((d.ticketsRemaining ?? null) !== remaining) {
    console.log(`  ⚠️  MISMATCH — Firestore says ${d.ticketsRemaining}, actual ${remaining}`);
  } else {
    console.log(`  ✓ count correct`);
  }
}

process.exit(0);
