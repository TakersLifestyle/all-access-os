/**
 * Set specific photos as album covers.
 * Run from: cd functions && node ../scripts/set-album-covers.mjs
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { readFileSync } from "fs";

// Load service account
const svcPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH ?? "../web/.env.local";
let serviceAccount;
try {
  // Try direct JSON file first
  serviceAccount = JSON.parse(readFileSync("service-account.json", "utf8"));
} catch {
  // Fall back to parsing from .env.local
  const env = readFileSync("../.env.local", "utf8").split("\n");
  const line = env.find(l => l.startsWith("FIREBASE_SERVICE_ACCOUNT_KEY="));
  if (!line) throw new Error("Cannot find FIREBASE_SERVICE_ACCOUNT_KEY in ../.env.local");
  serviceAccount = JSON.parse(line.replace("FIREBASE_SERVICE_ACCOUNT_KEY=", "").replace(/^'|'$/g, ""));
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// Targets: albumSlug → photo position (1-based, as shown in lightbox counter)
const TARGETS = [
  { titleContains: "POPS",    position: 19  },   // Concert stage, 19/236
  { titleContains: "RBN",     position: 197 },   // Group of 4, 197/392
  { titleContains: "KONFAM",  position: null },  // Rooftop — will list first 10 to identify
];

async function getAlbumByTitle(titleContains) {
  const snap = await db.collection("memoryAlbums").get();
  const match = snap.docs.find(d =>
    d.data().title?.toUpperCase().includes(titleContains.toUpperCase())
  );
  if (!match) throw new Error(`Album not found containing "${titleContains}"`);
  return { id: match.id, ...match.data() };
}

async function getPhotos(albumId) {
  const snap = await db
    .collection("memoryMedia")
    .where("albumId", "==", albumId)
    .where("type", "==", "photo")
    .orderBy("order", "asc")
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function setCover(albumId, photo) {
  const url = photo.url;
  const pathMatch = url.match(/\/o\/(.+?)(?:\?|$)/);
  const storagePath = pathMatch?.[1] ? decodeURIComponent(pathMatch[1]) : undefined;

  const update = { coverImageUrl: url, cacheVersion: Date.now() };
  if (storagePath) update.coverStoragePath = storagePath;

  await db.collection("memoryAlbums").doc(albumId).update(update);
  console.log(`✓ Cover set for album ${albumId}`);
  console.log(`  URL: ${url.substring(0, 100)}...`);
  if (storagePath) console.log(`  Path: ${storagePath}`);
}

async function main() {
  for (const target of TARGETS) {
    console.log(`\n─── ${target.titleContains} ───`);
    const album = await getAlbumByTitle(target.titleContains);
    console.log(`Album: "${album.title}" (${album.id})`);

    const photos = await getPhotos(album.id);
    console.log(`Total photos: ${photos.length}`);

    if (target.position === null) {
      // List first 10 so we can identify the rooftop photo
      console.log("\nFirst 10 photos (to identify rooftop shot):");
      photos.slice(0, 10).forEach((p, i) => {
        console.log(`  [${i + 1}] ${p.url?.substring(0, 120)}`);
      });
      console.log("\n  → Re-run with position set once you identify the photo index.");
      continue;
    }

    const idx = target.position - 1; // convert 1-based to 0-based
    const photo = photos[idx];
    if (!photo) {
      console.error(`  ✗ No photo at position ${target.position} (only ${photos.length} total)`);
      continue;
    }
    await setCover(album.id, photo);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
