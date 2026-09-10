/**
 * upload-roca-jpegs.mjs
 *
 * Uploads Lightroom-exported JPEGs from Downloads/ROCAFIESTA to Firebase.
 * Photos already have edits + "All Access Winnipeg" watermark baked in.
 *
 * Run from functions/:
 *   node upload-roca-jpegs.mjs
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { readFileSync, readdirSync } from "fs";
import { join, basename, extname } from "path";
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

const PHOTOS_DIR  = "C:\\Users\\TakersLifestyle\\Downloads\\ROCAFIESTA";
const ALBUM_ID    = "rocafiesta-konfam-2026";
const CONCURRENCY = 3;

const UPLOADER_NAME = "ALL ACCESS Admin";
const UPLOADER_UID  = "admin";

// ─── Process + upload one JPEG ─────────────────────────────────────────────────

async function processAndUpload(jpegPath, index) {
  const filename = basename(jpegPath);

  try {
    // Read the exported JPEG (already edited + watermarked by Lightroom)
    const jpegBuf = readFileSync(jpegPath);

    // Auto-correct EXIF orientation — keep full resolution, just re-encode
    const corrected = await sharp(jpegBuf)
      .rotate()          // apply EXIF orientation
      .jpeg({ quality: 92, progressive: true })
      .toBuffer();

    // Upload to Firebase Storage
    const ts          = Date.now() + index; // ensure unique timestamps
    const storagePath = `memories/${ALBUM_ID}/photos/${ts}_${index}_${filename}`;
    const storageFile = storage.file(storagePath);

    await storageFile.save(corrected, {
      metadata: {
        contentType: "image/jpeg",
        cacheControl: "public, max-age=31536000",
      },
    });

    const [url] = await storageFile.getSignedUrl({
      action:  "read",
      expires: "01-01-2099",
    });

    // Create memoryMedia Firestore doc
    await db.collection("memoryMedia").add({
      albumId:         ALBUM_ID,
      type:            "photo",
      url,
      storagePath,
      caption:         "",
      isPinned:        false,
      isFeatured:      false,
      downloadEnabled: true,
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

console.log("\n📸 ROCAFIESTA — Lightroom JPEG Uploader");
console.log("─────────────────────────────────────────\n");

// Find all JPEG files (skip videos and system files)
const files = readdirSync(PHOTOS_DIR);
const jpegFiles = files
  .filter(f => {
    const ext = extname(f).toLowerCase();
    return (ext === ".jpg" || ext === ".jpeg") && !f.startsWith(".");
  })
  .sort()
  .map(f => join(PHOTOS_DIR, f));

console.log(`Found ${jpegFiles.length} JPEG files in ${PHOTOS_DIR}`);

if (jpegFiles.length === 0) {
  console.error("❌ No JPEG files found. Has the Lightroom export finished?");
  process.exit(1);
}

console.log(`Target album: ${ALBUM_ID}`);
console.log(`Uploading with edits + watermark already baked in by Lightroom\n`);

// Create the album doc if it doesn't exist
const albumRef  = db.collection("memoryAlbums").doc(ALBUM_ID);
const albumSnap = await albumRef.get();

if (!albumSnap.exists) {
  console.log("Creating album doc...");
  await albumRef.set({
    id:          ALBUM_ID,
    title:       "ROCAFIESTA — A Spiritual Experience with Konfam",
    description: "A night with Konfam. Community, culture, and vibes at ROCAFIESTA.",
    category:    "community_spotlight",
    coverUrl:    "",
    photoCount:  0,
    isPublished: true,
    isFeatured:  false,
    featuredOrder: null,
    createdAt:   FieldValue.serverTimestamp(),
    updatedAt:   FieldValue.serverTimestamp(),
  });
  console.log("✓ Album doc created\n");
} else {
  console.log(`✓ Album exists: "${albumSnap.data().title}" (${albumSnap.data().photoCount} photos currently)\n`);
}

// Run uploads
let done   = 0;
let failed = 0;
const errors = [];

const tasks = jpegFiles.map((file, index) => async () => {
  const result = await processAndUpload(file, index);
  if (result.ok) {
    done++;
  } else {
    failed++;
    errors.push(result);
  }
  const total = done + failed;
  const pct   = Math.round((total / jpegFiles.length) * 100);
  process.stdout.write(`\r  ⬆️  ${total}/${jpegFiles.length} (${pct}%) — ✅ ${done} uploaded  ❌ ${failed} failed      `);
});

await runWithConcurrency(tasks, CONCURRENCY);

// Update album photoCount
await albumRef.update({
  photoCount: FieldValue.increment(done),
  updatedAt:  FieldValue.serverTimestamp(),
});

// Summary
console.log(`\n\n${"─".repeat(50)}`);
console.log(`✅ Upload complete`);
console.log(`   JPEGs processed: ${jpegFiles.length}`);
console.log(`   Successfully uploaded: ${done}`);
if (failed > 0) {
  console.log(`   Failed: ${failed}`);
  errors.forEach(e => console.log(`     ❌ ${e.file}: ${e.error}`));
}
console.log(`   Admin: https://allaccesswinnipeg.ca/admin/memories`);
console.log(`   Public: https://allaccesswinnipeg.ca/memories/${ALBUM_ID}`);
console.log(`${"─".repeat(50)}\n`);
console.log("Next: go to admin/memories → ROCAFIESTA album → hover a photo → Set Cover\n");

process.exit(0);
