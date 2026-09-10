/**
 * upload-arw-photos.mjs
 *
 * Extracts the full-resolution embedded JPEG from each Sony ARW raw file
 * in Downloads/ROCAFIESTA, resizes to 2400px, and uploads to Firebase Storage
 * under the existing "ROCAFIESTA — A Spiritual Experience with Konfam" album.
 *
 * No Lightroom export needed — extracts Sony's own embedded 7008×4672 JPEG preview.
 *
 * Run from functions/:
 *   node upload-arw-photos.mjs
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { readFileSync, readdirSync } from "fs";
import { join, basename } from "path";
import sharp from "sharp";

// ─── Init ──────────────────────────────────────────────────────────────────────

const env = readFileSync("../web/.env.local", "utf8").split("\n");
const getEnv = k => env.find(l => l.startsWith(k + "="))?.slice(k.length + 1).trim();

const serviceAccount = JSON.parse(getEnv("GOOGLE_APPLICATION_CREDENTIALS_JSON"));
const storageBucket  = getEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET") || `${serviceAccount.project_id}.appspot.com`;

initializeApp({ credential: cert(serviceAccount), storageBucket });
const db      = getFirestore();
const storage = getStorage().bucket();

// ─── Config ────────────────────────────────────────────────────────────────────

const PHOTOS_DIR   = "C:\\Users\\TakersLifestyle\\Downloads\\ROCAFIESTA";
const ALBUM_ID     = "rocafiesta-konfam-2026";  // existing album to add photos to
const CONCURRENCY  = 4;
const OUTPUT_WIDTH = 2400;   // max long edge after resize
const JPEG_QUALITY = 87;     // high quality for member downloads

const UPLOADER_NAME = "ALL ACCESS Admin";
const UPLOADER_UID  = "admin";

// ─── Extract largest embedded JPEG from Sony ARW binary ────────────────────────

function extractEmbeddedJpeg(arwBuffer) {
  const found = [];

  for (let i = 0; i < arwBuffer.length - 3; i++) {
    if (arwBuffer[i] === 0xFF && arwBuffer[i+1] === 0xD8 && arwBuffer[i+2] === 0xFF) {
      // Scan forward for JPEG end marker
      let end = -1;
      for (let j = i + 2; j < arwBuffer.length - 1; j++) {
        if (arwBuffer[j] === 0xFF && arwBuffer[j+1] === 0xD9) {
          end = j + 2;
          break;
        }
      }
      if (end > i) {
        found.push({ start: i, end, size: end - i });
      }
      i += 100; // skip ahead — don't scan inside the found JPEG
    }
  }

  if (found.length === 0) return null;

  // Return the largest — Sony ARW embeds: thumbnail (~1KB), small preview (~7KB),
  // medium preview (~311KB), and full-res JPEG (~3.5MB at 7008×4672)
  found.sort((a, b) => b.size - a.size);
  const best = found[0];
  return arwBuffer.slice(best.start, best.end);
}

// ─── Process + upload one ARW ──────────────────────────────────────────────────

async function processAndUpload(arwPath, index, total) {
  const filename = basename(arwPath);
  const jpegName = filename.replace(/\.ARW$/i, ".jpg");

  try {
    // 1. Read ARW binary
    const arwBuf = readFileSync(arwPath);

    // 2. Extract embedded full-res JPEG
    const embeddedJpeg = extractEmbeddedJpeg(arwBuf);
    if (!embeddedJpeg) throw new Error("No embedded JPEG found");

    // 3. Resize to 2400px long edge with sharp + auto-rotate EXIF
    const resized = await sharp(embeddedJpeg)
      .rotate()           // correct EXIF orientation
      .resize({
        width: OUTPUT_WIDTH,
        height: OUTPUT_WIDTH,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: JPEG_QUALITY, progressive: true, mozjpeg: true })
      .toBuffer();

    // 4. Upload to Firebase Storage
    const ts          = Date.now();
    const storagePath = `memories/${ALBUM_ID}/photos/${ts}_${index}_${jpegName}`;
    const storageFile = storage.file(storagePath);

    await storageFile.save(resized, {
      metadata: {
        contentType: "image/jpeg",
        cacheControl: "public, max-age=31536000",
      },
    });

    const [url] = await storageFile.getSignedUrl({
      action:  "read",
      expires: "01-01-2099",
    });

    // 5. Create memoryMedia doc
    await db.collection("memoryMedia").add({
      albumId:         ALBUM_ID,
      type:            "photo",
      url,
      storagePath,
      caption:         "",
      isPinned:        false,
      isFeatured:      false,
      downloadEnabled: true,   // visible; download gated to $10/mo server-side
      likesCount:      0,
      commentsCount:   0,
      uploadedBy:      UPLOADER_UID,
      uploadedByName:  UPLOADER_NAME,
      createdAt:       FieldValue.serverTimestamp(),
      likedBy:         [],
    });

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message, file: filename };
  }
}

// ─── Concurrency runner ────────────────────────────────────────────────────────

async function runWithConcurrency(tasks, limit) {
  let i = 0;
  const results = [];
  async function runNext() {
    if (i >= tasks.length) return;
    const idx = i++;
    results[idx] = await tasks[idx]();
    await runNext();
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, runNext));
  return results;
}

// ─── Main ──────────────────────────────────────────────────────────────────────

console.log("\n📸 ROCAFIESTA — ARW Photo Uploader");
console.log("────────────────────────────────────\n");

// Find all ARW files
const files = readdirSync(PHOTOS_DIR);
const arwFiles = files
  .filter(f => f.toUpperCase().endsWith(".ARW") && !f.startsWith("."))
  .sort()
  .map(f => join(PHOTOS_DIR, f));

console.log(`Found ${arwFiles.length} ARW files`);
console.log(`Target album: ${ALBUM_ID}`);
console.log(`Extracting embedded 7008×4672 JPEG → resizing to ${OUTPUT_WIDTH}px → uploading\n`);

// Verify album exists
const albumDoc = await db.collection("memoryAlbums").doc(ALBUM_ID).get();
if (!albumDoc.exists) {
  console.error(`❌ Album ${ALBUM_ID} not found in Firestore`);
  process.exit(1);
}
console.log(`✓ Album: "${albumDoc.data().title}" (currently ${albumDoc.data().photoCount} photos)\n`);

// Run uploads
let done = 0;
let failed = 0;
const errors = [];

const tasks = arwFiles.map((file, index) => async () => {
  const result = await processAndUpload(file, index, arwFiles.length);
  if (result.ok) {
    done++;
  } else {
    failed++;
    errors.push(result);
  }
  const total = done + failed;
  const pct = Math.round((total / arwFiles.length) * 100);
  process.stdout.write(`\r  ⬆️  ${total}/${arwFiles.length} (${pct}%) — ✅ ${done} uploaded  ❌ ${failed} failed      `);
});

await runWithConcurrency(tasks, CONCURRENCY);

// Update album photoCount
const currentCount = albumDoc.data().photoCount ?? 0;
const newCount = currentCount + done;
await db.collection("memoryAlbums").doc(ALBUM_ID).update({
  photoCount: newCount,
});

// Summary
console.log(`\n\n${"─".repeat(50)}`);
console.log(`✅ Upload complete`);
console.log(`   ARW files processed: ${arwFiles.length}`);
console.log(`   Successfully uploaded: ${done}`);
if (failed > 0) {
  console.log(`   Failed: ${failed}`);
  errors.forEach(e => console.log(`     ❌ ${e.file}: ${e.error}`));
}
console.log(`   Album total photos: ${newCount}`);
console.log(`   Admin: https://allaccesswinnipeg.ca/admin/memories`);
console.log(`   Public: https://allaccesswinnipeg.ca/memories/${ALBUM_ID}`);
console.log(`${"─".repeat(50)}\n`);

process.exit(0);
