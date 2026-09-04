import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const env = readFileSync("../web/.env.local", "utf8").split("\n");
const line = env.find(l => l.startsWith("GOOGLE_APPLICATION_CREDENTIALS_JSON="));
const raw = line.slice("GOOGLE_APPLICATION_CREDENTIALS_JSON=".length).trim();
initializeApp({ credential: cert(JSON.parse(raw)) });
const db = getFirestore();

const TARGETS = [
  "community-spotlight-rbn-no11-opening-night",
  "konfam-rocafiesta-photoshoot-2026",
  "community-spotlight-pops-young-jonn",
];

for (const albumId of TARGETS) {
  const doc = await db.collection("memoryAlbums").doc(albumId).get();
  const d = doc.data();
  console.log(`\n── ${d.title} ──`);
  console.log(`  coverImageUrl:    ${d.coverImageUrl?.slice(0, 80)}...`);
  console.log(`  coverStoragePath: ${d.coverStoragePath}`);
  console.log(`  cacheVersion:     ${d.cacheVersion}`);
}
process.exit(0);
