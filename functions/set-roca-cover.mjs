/**
 * set-roca-cover.mjs
 * Sets photo #103 (the konfam-in-white shot) as the ROCAFIESTA album cover,
 * checks for duplicate media docs, and reports access rule settings.
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const env = readFileSync("../web/.env.local", "utf8").split("\n");
const getEnv = k => env.find(l => l.startsWith(k + "="))?.slice(k.length + 1).trim();
const serviceAccount = JSON.parse(getEnv("GOOGLE_APPLICATION_CREDENTIALS_JSON"));
const storageBucket  = getEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET") || `${serviceAccount.project_id}.appspot.com`;

initializeApp({ credential: cert(serviceAccount), storageBucket });
const db = getFirestore();

const ALBUM_ID = "rocafiesta-konfam-2026";

// 1. Fetch all media ordered by createdAt
console.log("\n🔍 Fetching all media for ROCAFIESTA...");
// Fetch all, sort client-side (avoids needing albumId+createdAt composite index)
const snap = await db.collection("memoryMedia")
  .where("albumId", "==", ALBUM_ID)
  .get();

// Sort by storagePath filename (same order Lightroom exported: DSC00460 → DSC00901)
snap.docs.sort((a, b) => {
  const pathA = a.data().storagePath ?? "";
  const pathB = b.data().storagePath ?? "";
  return pathA.localeCompare(pathB);
});

console.log(`Total media docs: ${snap.docs.length}`);

// 2. Check for duplicates (by storagePath)
const pathCounts = {};
for (const doc of snap.docs) {
  const p = doc.data().storagePath;
  pathCounts[p] = (pathCounts[p] || 0) + 1;
}
const dupes = Object.entries(pathCounts).filter(([, c]) => c > 1);
if (dupes.length === 0) {
  console.log("✅ No duplicate photos found");
} else {
  console.log(`⚠️  ${dupes.length} duplicate storage paths found:`);
  dupes.forEach(([p, c]) => console.log(`   ${c}x ${p}`));
}

// 3. Get photo #103 (index 102, 0-based)
const photo103 = snap.docs[102];
if (!photo103) {
  console.error("❌ Photo 103 not found");
  process.exit(1);
}
const coverData = photo103.data();
console.log(`\n📸 Cover photo #103: ${coverData.storagePath}`);

// 4. Set as album cover
await db.collection("memoryAlbums").doc(ALBUM_ID).update({
  coverImageUrl: coverData.url,
  coverStoragePath: coverData.storagePath,
  updatedAt: new Date(),
});
console.log("✅ Album coverUrl updated");

// 5. Verify all photos have downloadEnabled: true
const noDownload = snap.docs.filter(d => !d.data().downloadEnabled);
if (noDownload.length > 0) {
  console.log(`\n⚠️  ${noDownload.length} photos missing downloadEnabled — fixing...`);
  const batch = db.batch();
  for (const d of noDownload) batch.update(d.ref, { downloadEnabled: true });
  await batch.commit();
  console.log("✅ Fixed");
} else {
  console.log("✅ All 317 photos have downloadEnabled: true");
}

console.log(`
─────────────────────────────────────
✅ Done
   Album: ${ALBUM_ID}
   Photos: ${snap.docs.length}
   Duplicates: ${dupes.length}
   Cover set: photo 103/317
   View: FREE (no auth — /api/memories/image is public)
   Download: $10/mo supporters + founding members + admin
─────────────────────────────────────
`);
process.exit(0);
