/**
 * fix-roca-cover.mjs
 * Finds the actual 103rd photo by createdAt order (how the lightbox sorts)
 * and sets it as the album cover.
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const env = readFileSync("../web/.env.local", "utf8").split("\n");
const getEnv = k => env.find(l => l.startsWith(k + "="))?.slice(k.length + 1).trim();
const serviceAccount = JSON.parse(getEnv("GOOGLE_APPLICATION_CREDENTIALS_JSON"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const ALBUM_ID = "rocafiesta-konfam-2026";

console.log("Fetching all media docs...");
const snap = await db.collection("memoryMedia").where("albumId", "==", ALBUM_ID).get();
console.log(`Total: ${snap.docs.length}`);

// Sort by createdAt ascending — same as the lightbox
const sorted = snap.docs.slice().sort((a, b) => {
  const ta = a.data().createdAt?.toMillis?.() ?? 0;
  const tb = b.data().createdAt?.toMillis?.() ?? 0;
  return ta - tb;
});

// Photo 103 = index 102
const photo103 = sorted[102];
const d = photo103.data();
const filename = (d.storagePath ?? "").split("/").pop();

console.log(`\nPhoto 103 by createdAt:`);
console.log(`  storagePath: ${d.storagePath}`);
console.log(`  filename:    ${filename}`);

// Set as cover
await db.collection("memoryAlbums").doc(ALBUM_ID).update({
  coverImageUrl:    d.url,
  coverStoragePath: d.storagePath,
  updatedAt:        new Date(),
});

console.log(`✅ Cover set to ${filename}`);
console.log("\nAlso logging photos 100–106 so you can verify:");
for (let i = 99; i <= 105 && i < sorted.length; i++) {
  const f = (sorted[i].data().storagePath ?? "").split("/").pop();
  console.log(`  #${i+1}: ${f}`);
}
process.exit(0);
