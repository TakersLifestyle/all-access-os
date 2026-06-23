/**
 * seed-memories-flyers.mjs
 *
 * Uploads two flyer images to Firebase Storage and seeds the
 * "meet-the-founding-15-episode-1" memory album in Firestore.
 *
 * Usage (run from the repo root or any directory):
 *   node scripts/seed-memories-flyers.mjs <path-to-image1> <path-to-image2>
 *
 * Example:
 *   node scripts/seed-memories-flyers.mjs ./flyer1.jpg ./flyer2.jpg
 *
 * Image 1 → album cover + featured moment (pinned)
 * Image 2 → second photo in gallery (pinned)
 *
 * Note: firebase-admin must be installed (run from functions/ if needed,
 * or ensure node_modules is resolvable). The script loads credentials from
 * web/.env.local — no manual config required.
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname, basename, extname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load credentials ───────────────────────────────────────────────────────
const envPath = resolve(__dirname, "../web/.env.local");
if (!existsSync(envPath)) {
  console.error("❌  Could not find web/.env.local — run this from the repo root.");
  process.exit(1);
}
const envContent = readFileSync(envPath, "utf-8");
const match = envContent.match(/GOOGLE_APPLICATION_CREDENTIALS_JSON=(.+)/);
if (!match) {
  console.error("❌  GOOGLE_APPLICATION_CREDENTIALS_JSON not found in web/.env.local");
  process.exit(1);
}
const serviceAccount = JSON.parse(match[1]);
const projectId = serviceAccount.project_id;

// ── Firebase init ──────────────────────────────────────────────────────────
if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
    storageBucket: `${projectId}.firebasestorage.app`,
  });
}
const db = getFirestore();
const bucket = getStorage().bucket();

// ── Args ───────────────────────────────────────────────────────────────────
const [, , img1Arg, img2Arg] = process.argv;
if (!img1Arg || !img2Arg) {
  console.error("Usage: node scripts/seed-memories-flyers.mjs <image1> <image2>");
  process.exit(1);
}
const img1Path = resolve(img1Arg);
const img2Path = resolve(img2Arg);
for (const p of [img1Path, img2Path]) {
  if (!existsSync(p)) {
    console.error(`❌  File not found: ${p}`);
    process.exit(1);
  }
}

// ── Config ─────────────────────────────────────────────────────────────────
const ALBUM_ID = "meet-the-founding-15-episode-1";
const STORAGE_PREFIX = `memories/${ALBUM_ID}`;

function mimeType(filePath) {
  const ext = extname(filePath).toLowerCase();
  return ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
}

async function uploadImage(localPath, storageName) {
  const destination = `${STORAGE_PREFIX}/${storageName}`;
  console.log(`  Uploading ${basename(localPath)} → gs://${bucket.name}/${destination}`);
  await bucket.upload(localPath, {
    destination,
    metadata: {
      contentType: mimeType(localPath),
      cacheControl: "public, max-age=31536000",
    },
    public: true,
  });
  const file = bucket.file(destination);
  const [metadata] = await file.getMetadata();
  // Public download URL via Firebase Storage CDN
  const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(destination)}?alt=media&token=${metadata.metadata?.firebaseStorageDownloadTokens ?? ""}`;
  // Simpler: use the public URL directly if the bucket is public
  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${destination}`;
  console.log(`  ✓ Uploaded → ${publicUrl}`);
  return publicUrl;
}

async function main() {
  console.log("\n🚀  Seeding Founding 15 — Episode 1 memories...\n");

  // Upload images
  const coverUrl = await uploadImage(img1Path, "cover.jpg");
  const photo2Url = await uploadImage(img2Path, "photo-002.jpg");

  // Update the album doc: set coverImageUrl + photoCount
  const albumRef = db.collection("memoryAlbums").doc(ALBUM_ID);
  await albumRef.update({
    coverImageUrl: coverUrl,
    photoCount: 2,
    updatedAt: FieldValue.serverTimestamp(),
  });
  console.log(`\n  ✓ Album coverImageUrl updated`);

  // Create media doc 1 — cover image (pinned + featured)
  const now = Date.now();
  const media1Ref = db.collection("memoryMedia").doc();
  await media1Ref.set({
    albumId: ALBUM_ID,
    type: "photo",
    url: coverUrl,
    thumbnailUrl: coverUrl,
    caption: "The flyer that started it all. Meet The Founding 15 — Episode 1.",
    isPinned: true,
    isFeatured: true,
    featuredOrder: now,
    featuredAt: FieldValue.serverTimestamp(),
    creatorName: "ALL ACCESS Winnipeg",
    creatorRole: "Community Platform",
    uploadedByName: "ALL ACCESS Winnipeg",
    likedBy: [],
    createdAt: FieldValue.serverTimestamp(),
  });
  console.log(`  ✓ Media doc 1 created (cover / featured / pinned): ${media1Ref.id}`);

  // Create media doc 2 — second flyer (pinned)
  const media2Ref = db.collection("memoryMedia").doc();
  await media2Ref.set({
    albumId: ALBUM_ID,
    type: "photo",
    url: photo2Url,
    thumbnailUrl: photo2Url,
    caption: "Meet The Founding 15. Episode 1 — RBN family: Tkemz, RocBoy, Heaven At Last.",
    isPinned: true,
    isFeatured: false,
    creatorName: "ALL ACCESS Winnipeg",
    creatorRole: "Community Platform",
    uploadedByName: "ALL ACCESS Winnipeg",
    likedBy: [],
    createdAt: FieldValue.serverTimestamp(),
  });
  console.log(`  ✓ Media doc 2 created (pinned): ${media2Ref.id}`);

  console.log("\n✅  Done! Album is live at /memories/meet-the-founding-15-episode-1\n");
  console.log(`   Cover image: ${coverUrl}`);
  console.log(`   Photo 2:     ${photo2Url}`);
}

main().catch(err => {
  console.error("\n❌ Script failed:", err.message);
  process.exit(1);
});
