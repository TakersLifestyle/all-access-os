/**
 * upload-rbn-photos.mjs
 *
 * Uploads all exported photos from C:\Users\TakersLifestyle\Downloads\RBN_MAVO_EXPORT\
 * to two Firestore albums, split by filename at the midpoint:
 *
 *   Part 1 → rbn-soul-bandit-mavo-part-1  (RBN x Soul Bandit — opening acts)
 *   Part 2 → rbn-soul-bandit-mavo-part-2  (MAVO — the headlining set)
 *
 * The script sorts all JPEG files alphabetically by filename (DSC order),
 * then splits at the midpoint. The first half goes to Part 1, the second half to Part 2.
 *
 * Run from functions/ folder:
 *   node upload-rbn-photos.mjs
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { readFileSync, readdirSync, existsSync } from "fs";
import { basename, extname, join } from "path";

const EXPORT_DIR = "C:\\Users\\TakersLifestyle\\Downloads\\RBN_MAVO_EXPORT";
const BUCKET = "studio-4850154113-14e56.firebasestorage.app";
const ALBUM_PART1 = "rbn-soul-bandit-mavo-part-1";
const ALBUM_PART2 = "rbn-soul-bandit-mavo-part-2";

// ── Load credentials ───────────────────────────────────────────────────────
const envContent = readFileSync(
  "C:\\Users\\TakersLifestyle\\all-access-platform\\web\\.env.local",
  "utf8"
);
const saLine = envContent
  .split("\n")
  .find((l) => l.startsWith("GOOGLE_APPLICATION_CREDENTIALS_JSON="));
const serviceAccount = JSON.parse(
  saLine.replace("GOOGLE_APPLICATION_CREDENTIALS_JSON=", "").trim()
);

initializeApp({ credential: cert(serviceAccount), storageBucket: BUCKET });
const db = getFirestore();
const bucket = getStorage().bucket();

function mimeType(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

async function uploadFile(localPath, storageDest) {
  await bucket.upload(localPath, {
    destination: storageDest,
    metadata: {
      contentType: mimeType(localPath),
      cacheControl: "public, max-age=31536000",
    },
    public: true,
  });
  return `https://storage.googleapis.com/${BUCKET}/${storageDest}`;
}

async function uploadBatch(files, albumId) {
  let uploaded = 0;
  let coverUrl = "";

  console.log(`\n📸 Uploading ${files.length} photos to ${albumId}...\n`);

  for (const [i, filePath] of files.entries()) {
    const name = basename(filePath);
    const dest = `memories/${albumId}/photos/${Date.now()}_${name}`;
    process.stdout.write(`  [${i + 1}/${files.length}] ${name}...`);

    try {
      const url = await uploadFile(filePath, dest);
      const isFirst = uploaded === 0;
      if (isFirst) coverUrl = url;

      await db.collection("memoryMedia").add({
        albumId,
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
      uploaded++;
    } catch (err) {
      console.log(` ✗ ${err.message}`);
    }
  }

  // Update album doc
  const albumUpdate = {
    photoCount: FieldValue.increment(uploaded),
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (coverUrl) albumUpdate.coverImageUrl = coverUrl;

  await db.collection("memoryAlbums").doc(albumId).update(albumUpdate);

  console.log(`\n  ✅ ${albumId}: ${uploaded} photos uploaded`);
  if (coverUrl) console.log(`     Cover set to first photo`);
  return uploaded;
}

async function main() {
  if (!existsSync(EXPORT_DIR)) {
    console.error(`❌ Export folder not found: ${EXPORT_DIR}`);
    console.error(
      `   Make sure Lightroom has finished exporting before running this script.`
    );
    process.exit(1);
  }

  // Collect all JPEG/JPG files, sort alphabetically by filename
  const allFiles = readdirSync(EXPORT_DIR)
    .filter((f) => /\.(jpg|jpeg)$/i.test(f))
    .sort() // alphabetical = DSC order
    .map((f) => join(EXPORT_DIR, f));

  const total = allFiles.length;

  if (total === 0) {
    console.error(
      `❌ No JPEG files found in ${EXPORT_DIR}. Has Lightroom finished exporting?`
    );
    process.exit(1);
  }

  console.log(`\n🎞️  Found ${total} exported photos in ${EXPORT_DIR}`);

  // Split at midpoint
  const mid = Math.floor(total / 2);
  const part1Files = allFiles.slice(0, mid);
  const part2Files = allFiles.slice(mid);

  console.log(`   Part 1 (${ALBUM_PART1}): files 1–${mid} (${part1Files.length} photos)`);
  console.log(
    `   Part 2 (${ALBUM_PART2}): files ${mid + 1}–${total} (${part2Files.length} photos)`
  );
  console.log(`\n   First file Part 1: ${basename(part1Files[0])}`);
  console.log(`   First file Part 2: ${basename(part2Files[0])}`);
  console.log(`   Last file  Part 2: ${basename(part2Files[part2Files.length - 1])}`);

  const uploaded1 = await uploadBatch(part1Files, ALBUM_PART1);
  const uploaded2 = await uploadBatch(part2Files, ALBUM_PART2);

  console.log(`\n🏁 All done!`);
  console.log(`   Part 1: ${uploaded1} photos → /memories/${ALBUM_PART1}`);
  console.log(`   Part 2: ${uploaded2} photos → /memories/${ALBUM_PART2}`);
  console.log(`\n   View:`);
  console.log(
    `   https://allaccesswinnipeg.ca/memories/${ALBUM_PART1}`
  );
  console.log(
    `   https://allaccesswinnipeg.ca/memories/${ALBUM_PART2}`
  );

  process.exit(0);
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
