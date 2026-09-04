/**
 * Scans memoryMedia for actual video docs and syncs videoCount + photoCount
 * back to every memoryAlbum doc that is out of sync.
 *
 * Run from: cd functions && node fix-video-counts.mjs
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const env = readFileSync("../web/.env.local", "utf8").split("\n");
const line = env.find(l => l.startsWith("GOOGLE_APPLICATION_CREDENTIALS_JSON="));
const raw = line.slice("GOOGLE_APPLICATION_CREDENTIALS_JSON=".length).trim();
initializeApp({ credential: cert(JSON.parse(raw)) });
const db = getFirestore();

// 1. Load all albums
const albumSnap = await db.collection("memoryAlbums").get();
console.log(`Found ${albumSnap.size} albums.\n`);

// 2. Load all media docs (type-indexed)
const mediaSnap = await db.collection("memoryMedia").get();
console.log(`Found ${mediaSnap.size} total media docs.\n`);

// Build per-album counts from actual media
const counts = {};
for (const doc of mediaSnap.docs) {
  const { albumId, type } = doc.data();
  if (!albumId) continue;
  if (!counts[albumId]) counts[albumId] = { photos: 0, videos: 0 };
  if (type === "video") counts[albumId].videos++;
  else counts[albumId].photos++;
}

// 3. Compare + fix
let fixed = 0;
for (const albumDoc of albumSnap.docs) {
  const albumId = albumDoc.id;
  const data = albumDoc.data();
  const actual = counts[albumId] ?? { photos: 0, videos: 0 };

  const storedPhoto = data.photoCount ?? 0;
  const storedVideo = data.videoCount ?? 0;

  const photoOff = storedPhoto !== actual.photos;
  const videoOff = storedVideo !== actual.videos;

  if (!photoOff && !videoOff) continue;

  console.log(`📁 ${data.title ?? albumId}`);
  if (photoOff) console.log(`   photoCount: ${storedPhoto} → ${actual.photos}`);
  if (videoOff) console.log(`   videoCount: ${storedVideo} → ${actual.videos}`);

  await albumDoc.ref.update({
    photoCount: actual.photos,
    videoCount: actual.videos,
  });
  console.log(`   ✓ Fixed`);
  fixed++;
}

if (fixed === 0) console.log("All counts already correct.");
else console.log(`\n✓ Fixed ${fixed} album(s).`);

process.exit(0);
