import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const env = readFileSync("../web/.env.local", "utf8").split("\n");
const getEnv = k => env.find(l => l.startsWith(k + "="))?.slice(k.length + 1).trim();
const serviceAccount = JSON.parse(getEnv("GOOGLE_APPLICATION_CREDENTIALS_JSON"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const snap = await db.collection("users")
  .where("status", "==", "active")
  .get();

console.log("Active members: " + snap.size);
snap.docs.forEach(d => {
  const u = d.data();
  if (u.stripeSubscriptionId) {
    console.log("  " + (u.email ?? d.id) + " | sub: " + u.stripeSubscriptionId + " | since: " + (u.welcomeEmailSentAt ?? u.updatedAt ?? "?"));
  }
});
process.exit(0);
