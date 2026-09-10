import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const env = readFileSync("../web/.env.local", "utf8").split("\n");
const getEnv = k => env.find(l => l.startsWith(k + "="))?.slice(k.length + 1).trim();
const serviceAccount = JSON.parse(getEnv("GOOGLE_APPLICATION_CREDENTIALS_JSON"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const ROCA_ID = "MCzwl8mGF8P1rL5goEab";
const SKALES_ID = "EQIimnVZ5jPhVKPLyAJ2";

const [rocaSnap, skalesSnap] = await Promise.all([
  db.collection("ticketOrders").where("eventId", "==", ROCA_ID).where("paymentStatus", "==", "paid").get(),
  db.collection("ticketOrders").where("eventId", "==", SKALES_ID).where("paymentStatus", "==", "paid").get(),
]);

const emails = new Map(); // email -> { name, events[] }

const addOrder = (snap, eventLabel) => {
  snap.docs.forEach(d => {
    const o = d.data();
    const email = o.userEmail;
    if (!email) return;
    if (!emails.has(email)) {
      emails.set(email, { events: [] });
    }
    const entry = emails.get(email);
    if (!entry.events.includes(eventLabel)) entry.events.push(eventLabel);
  });
};

addOrder(rocaSnap, "ROCAFIESTA");
addOrder(skalesSnap, "SKALES");

console.log("Total unique emails: " + emails.size);
console.log("");
for (const [email, data] of emails.entries()) {
  console.log(email + " — " + data.events.join(" + "));
}
process.exit(0);
