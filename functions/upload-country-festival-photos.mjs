/**
 * Bulk-upload COUNTRY RISING FESTIVAL photos to Firebase Storage + Firestore
 * Source: C:\Users\TakersLifestyle\Downloads\SOCIAL HOUSE ENT\  (JPEGs only)
 * Album:  memoryAlbums/jjpYTmkzf1pz0ngILMS4
 *
 * Run from functions/ folder:
 *   node --env-file=.env.local ../functions/upload-country-festival-photos.mjs
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { readFileSync, readdirSync } from "fs";
import { join, extname } from "path";
import { randomUUID } from "crypto";

const serviceAccount = JSON.parse(
  process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ||
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
  "{}"
);

const PROJECT_ID = serviceAccount.project_id || "studio-4850154113-14e56";
const BUCKET = `${PROJECT_ID}.firebasestorage.app`;

initializeApp({
  credential: cert(serviceAccount),
  storageBucket: BUCKET,
});

const db = getFirestore();
const bucket = getStorage().bucket();

const ALBUM_ID   = "jjpYTmkzf1pz0ngILMS4";
const SOURCE_DIR = "C:\\Users\\TakersLifestyle\\Downloads\\SOCIAL HOUSE ENT";

// ── helpers ────────────────────────────────────────────────────────────────

function buildDownloadUrl(storagePath, token) {
  const encoded = encodeURIComponent(storagePath);
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encoded}?alt=media&token=${token}`;
}

async function uploadPhoto(filePath, filename, index) {
  const ts = Date.now();
  const storagePath = `memories/${ALBUM_ID}/photos/${ts}_${index}_${filename}`;
  const token = randomUUID();

  const fileBuffer = readFileSync(filePath);
  const file = bucket.file(storagePath);

  await file.save(fileBuffer, {
    metadata: {
      contentType: "image/jpeg",
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });

  const url = buildDownloadUrl(storagePath, token);

  await db.collection("memoryMedia").add({
    albumId: ALBUM_ID,
    type: "photo",
    url,
    storagePath,
    caption: "",
    isPinned: false,
    isFeatured: false,
    downloadEnabled: true,
    uploadedByName: "ALL ACCESS Admin",
    likesCount: 0,
    commentsCount: 0,
    likedBy: [],
    createdAt: FieldValue.serverTimestamp(),
  });

  return url;
}

// ── main ───────────────────────────────────────────────────────────────────

const allFiles = readdirSync(SOURCE_DIR)
  .filter(f => [".jpg", ".jpeg"].includes(extname(f).toLowerCase()))
  .sort();

const total = allFiles.length;
console.log(`📸 Found ${total} JPEGs in ${SOURCE_DIR}`);
console.log(`🚀 Uploading to album: ${ALBUM_ID}\n`);

let done = 0;
let errors = 0;
const BATCH_SIZE = 10; // parallel uploads per batch

for (let i = 0; i < allFiles.length; i += BATCH_SIZE) {
  const batch = allFiles.slice(i, i + BATCH_SIZE);
  await Promise.all(
    batch.map((filename, j) =>
      uploadPhoto(join(SOURCE_DIR, filename), filename, i + j)
        .then(() => {
          done++;
          if (done % 50 === 0 || done === total) {
            console.log(`  ✅ ${done}/${total} uploaded`);
          }
        })
        .catch(err => {
          errors++;
          console.error(`  ❌ ${filename}: ${err.message}`);
        })
    )
  );
}

// Update photoCount on the album
await db.collection("memoryAlbums").doc(ALBUM_ID).update({
  photoCount: FieldValue.increment(done),
});

console.log(`\n✅ Done! ${done} photos uploaded, ${errors} errors.`);
console.log(`   Album photoCount updated (+${done})`);
console.log(`   Admin: https://allaccesswinnipeg.ca/admin/memories`);
process.exit(0);
