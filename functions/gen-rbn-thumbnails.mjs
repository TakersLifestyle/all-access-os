import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { readFileSync } from "fs";
import sharp from "sharp";

const ALBUM_ID = "community-spotlight-rbn-no11-opening-night";
const BUCKET = "studio-4850154113-14e56.firebasestorage.app";

const envContent = readFileSync("C:\\Users\\TakersLifestyle\\all-access-platform\\web\\.env.local", "utf8");
const saLine = envContent.split("\n").find(l => l.startsWith("GOOGLE_APPLICATION_CREDENTIALS_JSON="));
const serviceAccount = JSON.parse(saLine.replace("GOOGLE_APPLICATION_CREDENTIALS_JSON=", "").trim());

initializeApp({ credential: cert(serviceAccount), storageBucket: BUCKET });
const db = getFirestore();
const bucket = getStorage().bucket();

async function main() {
  const snap = await db.collection("memoryMedia")
    .where("albumId", "==", ALBUM_ID)
    .where("type", "==", "photo")
    .get();

  console.log(`Generating thumbnails for ${snap.docs.length} photos...\n`);

  let done = 0;
  let skipped = 0;
  let errors = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const storagePath = data.storagePath;
    if (!storagePath) { skipped++; continue; }

    // Skip if thumbnail already set to a different URL (already processed)
    const thumbPath = storagePath.replace("/photos/", "/thumbnails/");
    if (data.thumbnailUrl && data.thumbnailUrl.includes("/thumbnails/")) { skipped++; continue; }

    const filename = storagePath.split("/").pop();
    process.stdout.write(`  ${filename}...`);

    try {
      const [buffer] = await bucket.file(storagePath).download();

      const resized = await sharp(buffer)
        .resize(800, 800, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 82, progressive: true })
        .toBuffer();

      const thumbFile = bucket.file(thumbPath);
      await thumbFile.save(resized, {
        metadata: { contentType: "image/jpeg", cacheControl: "public, max-age=31536000" },
        public: true,
      });

      const thumbnailUrl = `https://storage.googleapis.com/${BUCKET}/${thumbPath}`;
      await docSnap.ref.update({ thumbnailUrl });

      console.log(" ✓");
      done++;
    } catch (err) {
      console.log(` ✗ ${err.message}`);
      errors++;
    }
  }

  console.log(`\nDone. Thumbnails generated: ${done} | Skipped: ${skipped} | Errors: ${errors}`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
