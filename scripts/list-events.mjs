import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// firebase-admin lives in functions/node_modules — run from functions/
const keyPath = resolve(__dirname, "../../Downloads/studio-4850154113-14e56-firebase-adminsdk-fbsvc-cb96543206.json");
const creds = JSON.parse(readFileSync(keyPath, "utf8"));

initializeApp({ credential: cert(creds) });
const db = getFirestore();

const snap = await db.collection("events").get();
snap.docs.forEach(d => {
  const e = d.data();
  console.log(`ID: ${d.id}`);
  console.log(`  title: ${e.title}`);
  console.log(`  status: ${e.status}`);
  console.log(`  date: ${e.date}`);
  console.log(`  capacity: ${e.capacity}`);
  console.log(`  ticketsRemaining: ${e.ticketsRemaining}`);
  console.log(`  generalPrice: ${e.generalPrice}`);
  console.log(`  memberPrice: ${e.memberPrice}`);
  console.log("");
});
process.exit(0);
