/**
 * remove-spotlight-photos.mjs
 * Removes specific photos from the memoryMedia collection in Firestore.
 * Targets the 7 trashed photos from the Casa Blanca album.
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const envContent = readFileSync("C:\\Users\\TakersLifestyle\\all-access-platform\\web\\.env.local", "utf8");
const saLine = envContent.split("\n").find(l => l.startsWith("GOOGLE_APPLICATION_CREDENTIALS_JSON="));
const serviceAccount = JSON.parse(saLine.replace("GOOGLE_APPLICATION_CREDENTIALS_JSON=", "").trim());

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const ALBUM_ID = "casa-blanca-dj-lankz-and-friends";
const FILENAMES = [
  "DSC09115.jpg",
  "DSC09116.jpg",
  "DSC09123.jpg",
  "DSC09124.jpg",
  "DSC09125.jpg",
  "DSC09126.jpg",
  "DSC09127.jpg",
];

async function main() {
  console.log(`\n🗑️  Removing ${FILENAMES.length} photos from memories spotlight...`);
  console.log(`   Album: ${ALBUM_ID}\n`);

  let deleted = 0;
  let notFound = [];

  for (const filename of FILENAMES) {
    const snap = await db.collection("memoryMedia")
      .where("albumId", "==", ALBUM_ID)
      .where("originalFilename", "==", filename)
      .get();

    if (snap.empty) {
      console.log(`  ⚠️  Not found: ${filename}`);
      notFound.push(filename);
      continue;
    }

    for (const doc of snap.docs) {
      await doc.ref.delete();
      console.log(`  ✓ Deleted: ${filename} (${doc.id})`);
      deleted++;
    }
  }

  console.log(`\n✅ Done! Deleted ${deleted} docs.`);
  if (notFound.length) console.log(`   Not found: ${notFound.join(", ")}`);
  process.exit(0);
}

main().catch(err => { console.error("❌", err); process.exit(1); });
