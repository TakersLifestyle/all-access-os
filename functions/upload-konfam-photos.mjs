/**
 * upload-konfam-photos.mjs
 *
 * Uploads all JPEG photos + MP4 video exported to
 * C:\Users\TakersLifestyle\Downloads\DAN\ to the Casa Blanca album.
 *
 * Run from functions/ folder after Lightroom finishes exporting:
 *   node upload-konfam-photos.mjs
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { readFileSync, readdirSync, statSync } from "fs";
import { basename, join } from "path";

const EXPORT_DIR = "C:\\Users\\TakersLifestyle\\Downloads\\DAN";
const BUCKET = "studio-4850154113-14e56.firebasestorage.app";
const ALBUM_ID = "casa-blanca-dj-lankz-and-friends";

const envContent = readFileSync(
  "C:\\Users\\TakersLifestyle\\all-access-platform\\web\\.env.local", "utf8"
);
const saLine = envContent.split("\n").find(l => l.startsWith("GOOGLE_APPLICATION_CREDENTIALS_JSON="));
const serviceAccount = JSON.parse(saLine.replace("GOOGLE_APPLICATION_CREDENTIALS_JSON=", "").trim());

initializeApp({ credential: cert(serviceAccount), storageBucket: BUCKET });
const db = getFirestore();
const bucket = getStorage().bucket();

async function uploadFile(localPath, storageDest, contentType) {
  await bucket.upload(localPath, {
    destination: storageDest,
    metadata: { contentType, cacheControl: "public, max-age=31536000" },
    public: true,
  });
  return `https://storage.googleapis.com/${BUCKET}/${storageDest}`;
}

async function main() {
  const allFiles = readdirSync(EXPORT_DIR)
    .filter(f => /\.(jpg|jpeg|mp4|mov)$/i.test(f) && !f.startsWith("."))
    .sort((a, b) => a.localeCompare(b));

  const photos = allFiles.filter(f => /\.(jpg|jpeg)$/i.test(f));
  const videos = allFiles.filter(f => /\.(mp4|mov)$/i.test(f));

  if (photos.length === 0 && videos.length === 0) {
    console.error("❌ No photos or videos found in", EXPORT_DIR);
    process.exit(1);
  }

  console.log(`\n🎞️  Found ${photos.length} photos + ${videos.length} video(s)`);
  console.log(`   First photo: ${photos[0] || "none"}`);
  console.log(`   Last photo:  ${photos[photos.length - 1] || "none"}`);
  if (videos.length) console.log(`   Video(s):    ${videos.join(", ")}`);
  console.log(`   Album: ${ALBUM_ID}\n`);

  let uploadedPhotos = 0;
  let uploadedVideos = 0;
  let coverUrl = "";

  // Upload photos
  for (const [i, name] of photos.entries()) {
    const filePath = join(EXPORT_DIR, name);
    const dest = `memories/${ALBUM_ID}/photos/${Date.now()}_${name}`;
    process.stdout.write(`  [photo ${i + 1}/${photos.length}] ${name}...`);

    try {
      const url = await uploadFile(filePath, dest, "image/jpeg");
      const isFirst = uploadedPhotos === 0;
      if (isFirst) coverUrl = url;

      await db.collection("memoryMedia").add({
        albumId: ALBUM_ID,
        type: "photo",
        url,
        thumbnailUrl: url,
        storagePath: dest,
        originalFilename: name,
        isPinned: isFirst,
        isFeatured: isFirst,
        featuredOrder: isFirst ? Date.now() : null,
        featuredAt: isFirst ? FieldValue.serverTimestamp() : null,
        likedBy: [],
        createdAt: FieldValue.serverTimestamp(),
      });

      console.log(" ✓");
      uploadedPhotos++;
    } catch (err) {
      console.log(` ✗ ${err.message}`);
    }
  }

  // Upload video(s)
  for (const name of videos) {
    const filePath = join(EXPORT_DIR, name);
    const dest = `memories/${ALBUM_ID}/videos/${Date.now()}_${name}`;
    const sizeMB = (statSync(filePath).size / 1024 / 1024).toFixed(1);
    process.stdout.write(`  [video] ${name} (${sizeMB} MB)...`);

    try {
      const url = await uploadFile(filePath, dest, "video/mp4");

      await db.collection("memoryMedia").add({
        albumId: ALBUM_ID,
        type: "video",
        url,
        thumbnailUrl: coverUrl || url,
        storagePath: dest,
        originalFilename: name,
        isPinned: false,
        isFeatured: false,
        featuredOrder: null,
        featuredAt: null,
        likedBy: [],
        createdAt: FieldValue.serverTimestamp(),
      });

      console.log(" ✓");
      uploadedVideos++;
    } catch (err) {
      console.log(` ✗ ${err.message}`);
    }
  }

  // Update album counts
  const albumUpdate = {
    photoCount: FieldValue.increment(uploadedPhotos),
    videoCount: FieldValue.increment(uploadedVideos),
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (coverUrl) albumUpdate.coverImageUrl = coverUrl;
  await db.collection("memoryAlbums").doc(ALBUM_ID).update(albumUpdate);

  console.log(`\n✅ Done!`);
  console.log(`   Photos uploaded: ${uploadedPhotos}`);
  console.log(`   Videos uploaded: ${uploadedVideos}`);
  console.log(`   View: https://allaccesswinnipeg.ca/memories/${ALBUM_ID}`);
  process.exit(0);
}

main().catch(err => { console.error("❌", err); process.exit(1); });
