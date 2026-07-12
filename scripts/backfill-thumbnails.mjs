/**
 * Backfill thumbnails for existing memory photos that don't have one yet.
 *
 * Run from the functions/ directory (where firebase-admin + sharp are installed):
 *   cd ~/all-access-platform/functions
 *   node ../scripts/backfill-thumbnails.mjs
 *
 * Safe to re-run — skips docs that already have thumbnailUrl set.
 */

import { createRequire } from "module";
import crypto from "crypto";

const require = createRequire(import.meta.url);
const admin = require("firebase-admin");
const sharp = require("sharp");

// Load service account credentials from the functions .env.local
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../functions/.env.local") });

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

async function generateThumbnail(doc) {
  const data = doc.data();
  const filePath = data.storagePath;

  if (!filePath) {
    console.warn(`  skip — no storagePath: ${doc.id}`);
    return;
  }

  try {
    const [buffer] = await bucket.file(filePath).download();

    const resized = await sharp(buffer)
      .resize(800, 800, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82, progressive: true })
      .toBuffer();

    const thumbPath = filePath.replace("/photos/", "/thumbnails/");
    const thumbFile = bucket.file(thumbPath);
    const token = crypto.randomUUID();

    await thumbFile.save(resized, {
      metadata: {
        contentType: "image/jpeg",
        metadata: { firebaseStorageDownloadTokens: token },
      },
    });

    const encodedPath = encodeURIComponent(thumbPath);
    const thumbnailUrl =
      `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${token}`;

    await doc.ref.update({ thumbnailUrl });
    console.log(`  ✓ ${filePath}`);
  } catch (err) {
    console.error(`  ✗ ${filePath}:`, err.message);
  }
}

async function main() {
  console.log("Backfilling memory photo thumbnails…\n");

  const snap = await db.collection("memoryMedia")
    .where("type", "==", "photo")
    .get();

  const missing = snap.docs.filter(d => !d.data().thumbnailUrl);
  console.log(`Found ${snap.docs.length} photos, ${missing.length} missing thumbnails.\n`);

  if (missing.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  // Process in batches of 5 to avoid overwhelming Storage
  const BATCH = 5;
  for (let i = 0; i < missing.length; i += BATCH) {
    const batch = missing.slice(i, i + BATCH);
    process.stdout.write(`[${i + 1}–${Math.min(i + BATCH, missing.length)} / ${missing.length}] `);
    await Promise.all(batch.map(generateThumbnail));
  }

  console.log("\nDone.");
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
