/**
 * backfill-album-covers.mjs
 *
 * Sweeps every memoryAlbums document and ensures coverStoragePath is set.
 * Resolution order per album:
 *   1. coverStoragePath already set → skip (already good)
 *   2. coverImageUrl present → extract path (and bucket) from URL, write coverStoragePath
 *   3. Neither → query memoryMedia for first photo, use its storagePath or extract from url
 *
 * Run from functions/ folder (has firebase-admin):
 *   cd ~/all-access-platform/functions
 *   node ../scripts/backfill-album-covers.mjs
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Firebase init ────────────────────────────────────────────────────────────
const envPath = resolve(__dirname, "../web/.env.local");
const envContent = readFileSync(envPath, "utf-8");
const match = envContent.match(/GOOGLE_APPLICATION_CREDENTIALS_JSON=(.+)/);
if (!match) throw new Error("No GOOGLE_APPLICATION_CREDENTIALS_JSON in .env.local");
const serviceAccount = JSON.parse(match[1]);

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ── Helper: extract path + bucket from Firebase Storage URL ─────────────────
function resolveFromUrl(url) {
  try {
    const pathMatch = url.match(/\/o\/(.+?)(?:\?|$)/);
    if (!pathMatch?.[1]) return undefined;
    const path = decodeURIComponent(pathMatch[1]);
    const bucketMatch = url.match(/\/b\/([^/]+)\/o\//);
    const bucket = bucketMatch?.[1] ? decodeURIComponent(bucketMatch[1]) : undefined;
    return { path, bucket };
  } catch {
    return undefined;
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("📸 Sweeping memoryAlbums for missing cover paths...\n");

  const albumsSnap = await db.collection("memoryAlbums").get();
  console.log(`Found ${albumsSnap.size} albums total.\n`);

  const results = {
    alreadyGood: [],
    repairedFromUrl: [],
    repairedFromMedia: [],
    genuinelyEmpty: [],
    errors: [],
  };

  for (const doc of albumsSnap.docs) {
    const albumId = doc.id;
    const data = doc.data();
    const title = data.title ?? albumId;

    // 1. Already has coverStoragePath → nothing to do
    if (data.coverStoragePath) {
      results.alreadyGood.push(title);
      continue;
    }

    // 2. Has coverImageUrl → extract path from it
    if (typeof data.coverImageUrl === "string" && data.coverImageUrl.includes("/o/")) {
      const resolved = resolveFromUrl(data.coverImageUrl);
      if (resolved?.path) {
        const update = { coverStoragePath: resolved.path };
        if (resolved.bucket) update.coverBucket = resolved.bucket;
        try {
          await db.collection("memoryAlbums").doc(albumId).update(update);
          results.repairedFromUrl.push(`${title} → ${resolved.path}${resolved.bucket ? ` [${resolved.bucket}]` : ""}`);
          continue;
        } catch (e) {
          results.errors.push(`${title}: failed to update from URL — ${e.message}`);
          continue;
        }
      }
    }

    // 3. No cover at all → find first photo in memoryMedia
    try {
      const mediaSnap = await db
        .collection("memoryMedia")
        .where("albumId", "==", albumId)
        .where("type", "==", "photo")
        .limit(1)
        .get();

      if (mediaSnap.empty) {
        results.genuinelyEmpty.push(title);
        continue;
      }

      const photoData = mediaSnap.docs[0].data();
      let path = photoData.storagePath;
      let bucket;

      if (!path && typeof photoData.url === "string") {
        const resolved = resolveFromUrl(photoData.url);
        path = resolved?.path;
        bucket = resolved?.bucket;
      }

      if (!path) {
        results.genuinelyEmpty.push(`${title} (has media but no path)`);
        continue;
      }

      const update = { coverStoragePath: path };
      if (bucket) update.coverBucket = bucket;
      if (photoData.url) update.coverImageUrl = photoData.url;
      await db.collection("memoryAlbums").doc(albumId).update(update);
      results.repairedFromMedia.push(`${title} → ${path}${bucket ? ` [${bucket}]` : ""}`);

    } catch (e) {
      results.errors.push(`${title}: media fallback failed — ${e.message}`);
    }
  }

  // ── Report ─────────────────────────────────────────────────────────────────
  console.log(`\n✅ Already had coverStoragePath (${results.alreadyGood.length}):`);
  results.alreadyGood.forEach(t => console.log(`   • ${t}`));

  console.log(`\n🔧 Repaired from coverImageUrl (${results.repairedFromUrl.length}):`);
  results.repairedFromUrl.forEach(t => console.log(`   • ${t}`));

  console.log(`\n🖼️  Repaired from memoryMedia first photo (${results.repairedFromMedia.length}):`);
  results.repairedFromMedia.forEach(t => console.log(`   • ${t}`));

  console.log(`\n⚠️  Genuinely empty — no photos at all (${results.genuinelyEmpty.length}):`);
  results.genuinelyEmpty.forEach(t => console.log(`   • ${t}`));

  if (results.errors.length) {
    console.log(`\n❌ Errors (${results.errors.length}):`);
    results.errors.forEach(t => console.log(`   • ${t}`));
  }

  const totalRepaired = results.repairedFromUrl.length + results.repairedFromMedia.length;
  console.log(`\n📊 Summary: ${totalRepaired} repaired, ${results.genuinelyEmpty.length} genuinely empty, ${results.errors.length} errors.`);
}

main().catch(err => { console.error(err); process.exit(1); });
