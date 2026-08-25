import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { readFileSync, readdirSync } from "fs";
import { join, extname } from "path";

const ALBUM_ID = "community-spotlight-pops-young-jonn";
const PHOTO_DIR = "C:\\Users\\TakersLifestyle\\Downloads\\POPS_EXTRACTED\\P0P$ x YOUNG JOHN LIVE IN WINNIPEG";
const BUCKET = "studio-4850154113-14e56.firebasestorage.app";

const envContent = readFileSync("C:\\Users\\TakersLifestyle\\all-access-platform\\web\\.env.local", "utf8");
const saLine = envContent.split("\n").find(l => l.startsWith("GOOGLE_APPLICATION_CREDENTIALS_JSON="));
const serviceAccount = JSON.parse(saLine.replace("GOOGLE_APPLICATION_CREDENTIALS_JSON=", "").trim());

initializeApp({ credential: cert(serviceAccount), storageBucket: BUCKET });
const db = getFirestore();
const bucket = getStorage().bucket();

const EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function getPhotos(dir) {
  return readdirSync(dir)
    .filter(f => EXTENSIONS.has(extname(f).toLowerCase()))
    .sort();
}

async function alreadyUploaded(filename) {
  const snap = await db.collection("memoryMedia")
    .where("albumId", "==", ALBUM_ID)
    .where("originalFilename", "==", filename)
    .limit(1)
    .get();
  return !snap.empty;
}

async function uploadPhoto(filename) {
  const filePath = join(PHOTO_DIR, filename);
  const dest = `memories/${ALBUM_ID}/photos/${Date.now()}_${filename}`;

  await bucket.upload(filePath, {
    destination: dest,
    metadata: { contentType: "image/jpeg", cacheControl: "public, max-age=31536000" },
    public: true,
  });

  const publicUrl = `https://storage.googleapis.com/${BUCKET}/${dest}`;

  await db.collection("memoryMedia").add({
    albumId: ALBUM_ID,
    type: "photo",
    url: publicUrl,
    thumbnailUrl: publicUrl,
    storagePath: dest,
    originalFilename: filename,
    isPinned: false,
    isFeatured: false,
    likedBy: [],
    createdAt: new Date().toISOString(),
  });

  return publicUrl;
}

async function main() {
  const photos = getPhotos(PHOTO_DIR);
  console.log(`Found ${photos.length} photos in folder.\n`);

  let uploaded = 0;
  let skipped = 0;

  for (const filename of photos) {
    const already = await alreadyUploaded(filename);
    if (already) {
      console.log(`  SKIP: ${filename}`);
      skipped++;
      continue;
    }

    process.stdout.write(`  Uploading ${filename}...`);
    try {
      await uploadPhoto(filename);
      console.log(" ✓");
      uploaded++;
    } catch (err) {
      console.log(` ✗ ${err.message}`);
    }
  }

  if (uploaded > 0) {
    await db.collection("memoryAlbums").doc(ALBUM_ID).update({
      photoCount: FieldValue.increment(uploaded),
    });
  }

  console.log(`\nDone. Uploaded: ${uploaded} | Skipped (already exist): ${skipped}`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
