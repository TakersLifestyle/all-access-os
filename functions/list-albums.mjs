import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const env = readFileSync("../web/.env.local", "utf8").split("\n");
const line = env.find(l => l.startsWith("GOOGLE_APPLICATION_CREDENTIALS_JSON="));
const raw = line.slice("GOOGLE_APPLICATION_CREDENTIALS_JSON=".length).trim();
initializeApp({ credential: cert(JSON.parse(raw)) });
const db = getFirestore();

const snap = await db.collection("memoryAlbums").get();
snap.docs.forEach(d => {
  const { title, mediaCount } = d.data();
  console.log(`${d.id} | "${title}" | ${mediaCount ?? "?"} photos`);
});
console.log(`\nTotal: ${snap.size} albums`);
process.exit(0);
