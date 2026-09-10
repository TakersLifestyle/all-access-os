/**
 * create-rocafiesta-memories.mjs
 *
 * Creates the ROCA FIESTA community memories album and bulk-uploads
 * all photos (JPEG) and videos (MP4/MOV) from Downloads/ROCAFIESTA
 * into Firebase Storage + Firestore.
 *
 * Run from functions/ folder after Lightroom export is complete:
 *   node create-rocafiesta-memories.mjs
 *
 * FEATURES:
 *   - Anyone can VIEW photos at low-res (800px grid / 1200px lightbox)
 *   - Downloads require active $10/mo ALL ACCESS membership (server-enforced)
 *   - Non-members see "Go ALL ACCESS — $10/mo" upgrade modal
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { readFileSync, readdirSync } from "fs";
import { join, extname, basename } from "path";

// ─── Init ──────────────────────────────────────────────────────────────────────

const env = readFileSync("../web/.env.local", "utf8").split("\n");
const getEnv = k => env.find(l => l.startsWith(k + "="))?.slice(k.length + 1).trim();

const serviceAccount = JSON.parse(getEnv("GOOGLE_APPLICATION_CREDENTIALS_JSON"));
const storageBucket  = getEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET") || `${serviceAccount.project_id}.appspot.com`;

initializeApp({
  credential: cert(serviceAccount),
  storageBucket,
});

const db      = getFirestore();
const storage = getStorage().bucket();

// ─── Config ────────────────────────────────────────────────────────────────────

const PHOTOS_DIR = "C:\\Users\\TakersLifestyle\\Downloads\\ROCAFIESTA";

const ALBUM_DATA = {
  title:         "ROCA FIESTA",
  eventDate:     "2026-09-05",
  location:      "Winnipeg, MB",
  category:      "Nightlife",
  eventId:       "MCzwl8mGF8P1rL5goEab",   // ROCAFIESTA event ID
  description:   "The night that brought Winnipeg together. ROCA FIESTA — real energy, real people, real community.",
  status:        "active",    // live immediately — visible to all members
  isFeatured:    true,        // pinned to top of Memories page
  photoCount:    0,           // updated to real count at end
  videoCount:    0,           // updated to real count at end
  creatorCount:  0,
  attendeeCount: 18,
};

const UPLOADER_NAME = "ALL ACCESS Admin";
const UPLOADER_UID  = "admin";

// Upload concurrency
const PHOTO_CONCURRENCY = 5;
const VIDEO_CONCURRENCY = 2;  // videos are large — lower concurrency

// ─── File type maps ────────────────────────────────────────────────────────────

const PHOTO_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic"]);
const VIDEO_EXTS = new Set([".mp4", ".mov", ".avi", ".webm", ".m4v"]);
const RAW_EXTS   = new Set([".arw", ".cr2", ".cr3", ".nef", ".dng", ".raf"]);

// ─── Scan folder ───────────────────────────────────────────────────────────────

function scanFolder(dir) {
  let files;
  try {
    files = readdirSync(dir);
  } catch {
    console.error(`\n❌ Folder not found: ${dir}`);
    console.error("   Export photos from Lightroom first (File → Export → JPEG).");
    process.exit(1);
  }

  const photos = [];
  const videos = [];
  const raws   = [];
  const other  = [];

  for (const f of files) {
    if (f.startsWith(".")) continue;          // skip hidden/temp files
    const ext = extname(f).toLowerCase();
    const full = join(dir, f);
    if (PHOTO_EXTS.has(ext)) photos.push(full);
    else if (VIDEO_EXTS.has(ext)) videos.push(full);
    else if (RAW_EXTS.has(ext)) raws.push(full);
    else other.push(f);
  }

  photos.sort();
  videos.sort();
  raws.sort();

  return { photos, videos, raws, other };
}

// ─── Upload helpers ────────────────────────────────────────────────────────────

async function uploadFile(localPath, storagePath, contentType) {
  const fileBuffer = readFileSync(localPath);
  const storageFile = storage.file(storagePath);

  await storageFile.save(fileBuffer, {
    metadata: {
      contentType,
      cacheControl: "public, max-age=31536000",
    },
  });

  // Long-lived signed URL (MM-DD-YYYY format required by Firebase Admin)
  const [url] = await storageFile.getSignedUrl({
    action:  "read",
    expires: "01-01-2099",
  });

  return url;
}

// Run a list of async tasks with limited concurrency
async function runWithConcurrency(tasks, limit) {
  let i = 0;
  async function runNext() {
    if (i >= tasks.length) return;
    const idx = i++;
    await tasks[idx]();
    await runNext();
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, runNext));
}

// ─── Upload photos ─────────────────────────────────────────────────────────────

async function uploadPhotos(photos, albumId) {
  if (photos.length === 0) return 0;

  console.log(`\nUploading ${photos.length} photos (${PHOTO_CONCURRENCY} concurrent)…\n`);
  const ts = Date.now();
  let done = 0;

  const tasks = photos.map((file, index) => async () => {
    const filename    = basename(file);
    const storagePath = `memories/${albumId}/photos/${ts}_${index}_${filename}`;

    try {
      const url = await uploadFile(file, storagePath, "image/jpeg");

      // ── memoryMedia doc ────────────────────────────────────────────────────
      // downloadEnabled: true  → download icon shown in UI
      // BUT /api/memories/download verifies $10/mo membership server-side
      // on every request — non-members see "Go ALL ACCESS — $10/mo" modal.
      // Viewing is free at low-res via unauthenticated /api/memories/image.
      await db.collection("memoryMedia").add({
        albumId,
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

      done++;
      const pct = Math.round((done / photos.length) * 100);
      process.stdout.write(`\r  📸 ${done}/${photos.length} (${pct}%)  — ${filename}                `);
    } catch (err) {
      console.error(`\n  ❌ Failed: ${filename} — ${err.message}`);
    }
  });

  await runWithConcurrency(tasks, PHOTO_CONCURRENCY);
  console.log(`\n  ✓ ${done}/${photos.length} photos uploaded`);
  return done;
}

// ─── Upload videos ─────────────────────────────────────────────────────────────

async function uploadVideos(videos, albumId) {
  if (videos.length === 0) return 0;

  console.log(`\nUploading ${videos.length} videos (${VIDEO_CONCURRENCY} concurrent)…\n`);
  const ts = Date.now();
  let done = 0;

  const tasks = videos.map((file, index) => async () => {
    const filename    = basename(file);
    const ext         = extname(filename).toLowerCase();
    const contentType = ext === ".mp4" ? "video/mp4"
                      : ext === ".mov" ? "video/quicktime"
                      : "video/mp4";
    const storagePath = `memories/${albumId}/videos/${ts}_${index}_${filename}`;

    try {
      const url = await uploadFile(file, storagePath, contentType);

      await db.collection("memoryMedia").add({
        albumId,
        type:            "video",
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

      done++;
      const pct = Math.round((done / videos.length) * 100);
      process.stdout.write(`\r  🎥 ${done}/${videos.length} (${pct}%)  — ${filename}                `);
    } catch (err) {
      console.error(`\n  ❌ Failed: ${filename} — ${err.message}`);
    }
  });

  await runWithConcurrency(tasks, VIDEO_CONCURRENCY);
  console.log(`\n  ✓ ${done}/${videos.length} videos uploaded`);
  return done;
}

// ─── Main ──────────────────────────────────────────────────────────────────────

console.log("\n🎉 ROCA FIESTA — Community Memories Album Creator");
console.log("──────────────────────────────────────────────────\n");

// 1. Scan folder
const { photos, videos, raws, other } = scanFolder(PHOTOS_DIR);

console.log(`📁 Folder scan: ${PHOTOS_DIR}`);
console.log(`   📸 Photos (JPEG/PNG):  ${photos.length}`);
console.log(`   🎥 Videos (MP4/MOV):   ${videos.length}`);
if (raws.length > 0) {
  console.log(`   ⚠️  RAW files (ARW etc): ${raws.length}  ← SKIPPED — export from Lightroom as JPEG first`);
}
console.log();

if (photos.length === 0 && videos.length === 0) {
  if (raws.length > 0) {
    console.error("❌ Only RAW files found. Open Lightroom → select all → File → Export → JPEG, then re-run.");
  } else {
    console.error("❌ No photos or videos found in the folder. Check the export is complete.");
  }
  process.exit(1);
}

if (raws.length > 0) {
  console.log(`⚠️  ${raws.length} RAW files will be SKIPPED.`);
  console.log(`   To include them: Lightroom → select those files → File → Export → JPEG → same folder.`);
  console.log(`   Then delete the ARW files and re-run this script.\n`);
}

// 2. Create album document
console.log("Creating album in Firestore…");
const albumRef = await db.collection("memoryAlbums").add({
  ...ALBUM_DATA,
  coverImageUrl:    "",
  coverStoragePath: "",
  createdAt: FieldValue.serverTimestamp(),
});
const albumId = albumRef.id;
console.log(`✓ Album created: ${albumId}`);
console.log(`  Title:    "${ALBUM_DATA.title}"`);
console.log(`  Date:     ${ALBUM_DATA.eventDate} · ${ALBUM_DATA.location}`);
console.log(`  Status:   active · Featured: true`);

// 3. Upload photos
const photosDone = await uploadPhotos(photos, albumId);

// 4. Upload videos
const videosDone = await uploadVideos(videos, albumId);

// 5. Auto-set cover = first photo
console.log("\nSetting cover image…");
const firstMediaSnap = await db.collection("memoryMedia")
  .where("albumId", "==", albumId)
  .where("type", "==", "photo")
  .limit(1)
  .get();

let coverUrl = "", coverStoragePath = "";
if (!firstMediaSnap.empty) {
  const d = firstMediaSnap.docs[0].data();
  coverUrl         = d.url;
  coverStoragePath = d.storagePath;
  console.log(`✓ Cover → ${basename(coverStoragePath)}`);
} else {
  console.log("⚠️  No photos uploaded — set cover manually in admin.");
}

// 6. Update album with final counts + cover
await albumRef.update({
  photoCount:       photosDone,
  videoCount:       videosDone,
  coverImageUrl:    coverUrl,
  coverStoragePath: coverStoragePath,
});

// 7. Summary
console.log(`\n${"─".repeat(50)}`);
console.log(`✅  ROCA FIESTA album is LIVE`);
console.log(`    Album ID:   ${albumId}`);
console.log(`    Photos:     ${photosDone}`);
console.log(`    Videos:     ${videosDone}`);
if (raws.length > 0) {
  console.log(`    RAW skipped: ${raws.length}  (export as JPEG to add)`);
}
console.log(`    Status:     active · Featured`);
console.log(`    Admin:      https://allaccesswinnipeg.ca/admin/memories`);
console.log(`    Public:     https://allaccesswinnipeg.ca/memories/${albumId}`);
console.log(`${"─".repeat(50)}\n`);

process.exit(0);
