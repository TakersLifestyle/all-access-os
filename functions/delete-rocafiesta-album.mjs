/**
 * delete-rocafiesta-album.mjs
 *
 * Deletes the ROCAFIESTA memories album:
 *   - All memoryMedia docs for the album
 *   - All Storage files under memories/rocafiesta-konfam-2026/
 *   - The memoryAlbums doc itself
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { readFileSync } from "fs";

const env = readFileSync("../web/.env.local", "utf8").split("\n");
const getEnv = k => env.find(l => l.startsWith(k + "="))?.slice(k.length + 1).trim();

const serviceAccount = JSON.parse(getEnv("GOOGLE_APPLICATION_CREDENTIALS_JSON"));
const storageBucket  = getEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET") || `${serviceAccount.project_id}.appspot.com`;

initializeApp({ credential: cert(serviceAccount), storageBucket });
const db      = getFirestore();
const storage = getStorage().bucket();

const ALBUM_ID = "rocafiesta-konfam-2026";

console.log("\n🗑️  Deleting ROCAFIESTA album...\n");

// 1. Delete all memoryMedia docs
const mediaSnap = await db.collection("memoryMedia").where("albumId", "==", ALBUM_ID).get();
console.log(`Found ${mediaSnap.docs.length} media docs — deleting...`);

let deleted = 0;
for (const doc of mediaSnap.docs) {
  await doc.ref.delete();
  deleted++;
  process.stdout.write(`\r  🗑️  ${deleted}/${mediaSnap.docs.length} media docs deleted`);
}
console.log(`\n✓ ${deleted} media docs deleted`);

// 2. Delete all Storage files under memories/rocafiesta-konfam-2026/
console.log(`\nDeleting Storage files under memories/${ALBUM_ID}/...`);
const [files] = await storage.getFiles({ prefix: `memories/${ALBUM_ID}/` });
console.log(`Found ${files.length} storage files`);

let filesDeleted = 0;
for (const file of files) {
  await file.delete();
  filesDeleted++;
  process.stdout.write(`\r  🗑️  ${filesDeleted}/${files.length} storage files deleted`);
}
console.log(`\n✓ ${filesDeleted} storage files deleted`);

// 3. Delete the album doc
await db.collection("memoryAlbums").doc(ALBUM_ID).delete();
console.log(`✓ Album doc deleted: ${ALBUM_ID}`);

console.log(`\n${"─".repeat(50)}`);
console.log(`✅ Done — album completely removed`);
console.log(`${"─".repeat(50)}\n`);

process.exit(0);
