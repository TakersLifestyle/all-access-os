/**
 * Deletes all memoryMedia docs + Storage files for casa-blanca-dj-lankz-and-friends
 * and resets the album photoCount to 0.
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { readFileSync } from "fs";

const ALBUM_ID = "casa-blanca-dj-lankz-and-friends";
const BUCKET = "studio-4850154113-14e56.firebasestorage.app";

const envContent = readFileSync("C:\\Users\\TakersLifestyle\\all-access-platform\\web\\.env.local", "utf8");
const saLine = envContent.split("\n").find(l => l.startsWith("GOOGLE_APPLICATION_CREDENTIALS_JSON="));
const serviceAccount = JSON.parse(saLine.replace("GOOGLE_APPLICATION_CREDENTIALS_JSON=", "").trim());

initializeApp({ credential: cert(serviceAccount), storageBucket: BUCKET });
const db = getFirestore();
const bucket = getStorage().bucket();

async function main() {
  console.log(`\n🗑️  Cleaning up ${ALBUM_ID}...\n`);

  // 1. Get all memoryMedia docs for this album
  const snapshot = await db.collection("memoryMedia")
    .where("albumId", "==", ALBUM_ID)
    .get();

  console.log(`   Found ${snapshot.size} media docs to delete`);

  let deleted = 0;
  let storageDeleted = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();

    // Delete from Storage
    if (data.storagePath) {
      try {
        await bucket.file(data.storagePath).delete();
        storageDeleted++;
      } catch (err) {
        // File may already be gone
      }
    }

    // Delete Firestore doc
    await doc.ref.delete();
    deleted++;
    if (deleted % 50 === 0) console.log(`   Deleted ${deleted}/${snapshot.size}...`);
  }

  // 2. Reset album
  await db.collection("memoryAlbums").doc(ALBUM_ID).update({
    photoCount: 0,
    videoCount: 0,
    coverImageUrl: "",
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log(`\n✅ Done!`);
  console.log(`   Firestore docs deleted: ${deleted}`);
  console.log(`   Storage files deleted:  ${storageDeleted}`);
  console.log(`   Album reset to 0 photos — ready for clean re-upload`);
  process.exit(0);
}

main().catch(err => { console.error("❌", err); process.exit(1); });
