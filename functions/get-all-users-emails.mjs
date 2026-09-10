import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const env = readFileSync("../web/.env.local", "utf8").split("\n");
const getEnv = k => env.find(l => l.startsWith(k + "="))?.slice(k.length + 1).trim();
const serviceAccount = JSON.parse(getEnv("GOOGLE_APPLICATION_CREDENTIALS_JSON"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const snap = await db.collection("users").get();
console.log("Total users:", snap.size);
console.log("");

const emails = [];
snap.docs.forEach(d => {
  const u = d.data();
  const email = u.email ?? null;
  const status = u.status ?? "unknown";
  const name = u.displayName ?? u.name ?? "";
  if (email) {
    emails.push({ email, status, name });
    console.log(`${email} | ${status} | ${name || "(no name)"}`);
  } else {
    console.log(`(no email) | uid=${d.id} | ${status}`);
  }
});

console.log("");
console.log("Emails found:", emails.length);
process.exit(0);
