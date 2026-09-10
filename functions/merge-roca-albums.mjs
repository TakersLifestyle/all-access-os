/**
 * merge-roca-albums.mjs
 *
 * Finds the two ROCA FIESTA albums, moves all photos from the new one
 * into the existing "ROCAFIESTA — A Spiritual Experience with Konfam" album,
 * deletes all videos from the new album, then deletes the new album doc.
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const env = readFileSync("../web/.env.local", "utf8").split("\n");
const getEnv = k => env.find(l => l.startsWith(k + "="))?.slice(k.length + 1).trim();
initializeApp({ credential: cert(JSON.parse(getEnv("GOOGLE_APPLICATION_CREDENTIALS_JSON"))) });
const db = getFirestore();

// ─── Find both albums ──────────────────────────────────────────────────────────

console.log("\n🔍 Finding ROCAFIESTA albums...\n");

const albumsSnap = await db.collection("memoryAlbums")
  .where("eventId", "==", "MCzwl8mGF8P1rL5goEab")
  .get();

if (albumsSnap.empty) {
  // fallback — search by title
  const all = await db.collection("memoryAlbums").get();
  const roca = all.docs.filter(d => d.data().title?.toUpperCase().includes("ROCA"));
  roca.forEach(d => console.log(`  ${d.id}  "${d.data().title}"  photos=${d.data().photoCount}  videos=${d.data().videoCount}`));
} else {
  albumsSnap.docs.forEach(d => console.log(`  ${d.id}  "${d.data().title}"  photos=${d.data().photoCount}  videos=${d.data().videoCount}  featured=${d.data().isFeatured}`));
}

// ─── Print all for manual confirmation ────────────────────────────────────────

console.log("\n📋 All memoryAlbums with 'ROCA' in title:\n");
const allAlbums = await db.collection("memoryAlbums").get();
const rocaAlbums = allAlbums.docs
  .filter(d => d.data().title?.toUpperCase().includes("ROCA"))
  .sort((a, b) => (b.data().photoCount ?? 0) - (a.data().photoCount ?? 0));

rocaAlbums.forEach(d => {
  const data = d.data();
  console.log(`  ID: ${d.id}`);
  console.log(`  Title: "${data.title}"`);
  console.log(`  Photos: ${data.photoCount}  Videos: ${data.videoCount}  Featured: ${data.isFeatured}`);
  console.log(`  Status: ${data.status}  Date: ${data.eventDate}`);
  console.log();
});

// ─── Hardcoded IDs (confirmed from Firestore listing above) ───────────────────

const NEW_ALBUM_ID      = "OILUvOsTDiggjWkHSHsb";       // "ROCA FIESTA" — DELETE THIS
const EXISTING_ALBUM_ID = "rocafiesta-konfam-2026";      // "ROCAFIESTA — A Spiritual Experience" — KEEP

const newAlbum      = rocaAlbums.find(d => d.id === NEW_ALBUM_ID);
const existingAlbum = rocaAlbums.find(d => d.id === EXISTING_ALBUM_ID);

if (!newAlbum || !existingAlbum) {
  console.error("❌ Could not find albums by ID. Check IDs.");
  process.exit(1);
}

console.log(`✓ NEW album (to delete):     ${newAlbum.id}  "${newAlbum.data().title}"  (${newAlbum.data().photoCount} photos)`);
console.log(`✓ EXISTING album (to keep):  ${existingAlbum.id}  "${existingAlbum.data().title}"  (${existingAlbum.data().photoCount} photos)`);
console.log();

// ─── Get all media from the new album ─────────────────────────────────────────

const mediaSnap = await db.collection("memoryMedia")
  .where("albumId", "==", newAlbum.id)
  .get();

const photos = mediaSnap.docs.filter(d => d.data().type === "photo");
const videos = mediaSnap.docs.filter(d => d.data().type === "video");

console.log(`  Found ${photos.length} photos + ${videos.length} videos in new album`);

// ─── Move photos → existing album ─────────────────────────────────────────────

console.log(`\nMoving ${photos.length} photos → "${existingAlbum.data().title}"...`);

let moved = 0;
for (const photo of photos) {
  await db.collection("memoryMedia").doc(photo.id).update({
    albumId: existingAlbum.id,
  });
  moved++;
  process.stdout.write(`\r  📸 ${moved}/${photos.length} moved`);
}
console.log(`\n  ✓ ${moved} photos moved`);

// ─── Delete videos from new album (not moving — user doesn't want videos) ─────

if (videos.length > 0) {
  console.log(`\nDeleting ${videos.length} videos from new album...`);
  let deleted = 0;
  for (const video of videos) {
    await db.collection("memoryMedia").doc(video.id).delete();
    deleted++;
    process.stdout.write(`\r  🗑️  ${deleted}/${videos.length} deleted`);
  }
  console.log(`\n  ✓ ${deleted} videos deleted`);
}

// ─── Update existing album photoCount ─────────────────────────────────────────

const newTotal = (existingAlbum.data().photoCount ?? 0) + moved;
await db.collection("memoryAlbums").doc(existingAlbum.id).update({
  photoCount: newTotal,
  isFeatured: true,    // make sure the right album is featured
  status: "active",
});
console.log(`\n✓ Existing album photoCount → ${newTotal}, isFeatured=true`);

// ─── Delete the new album doc ──────────────────────────────────────────────────

await db.collection("memoryAlbums").doc(newAlbum.id).delete();
console.log(`✓ Deleted new album doc: ${newAlbum.id}`);

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`
${"─".repeat(50)}
✅  Done!
    Photos moved:   ${moved}
    Videos removed: ${videos.length}
    Active album:   "${existingAlbum.data().title}"
    Total photos:   ${newTotal}
    Album ID:       ${existingAlbum.id}
    Admin:          https://allaccesswinnipeg.ca/admin/memories
    Public:         https://allaccesswinnipeg.ca/memories/${existingAlbum.id}
${"─".repeat(50)}
`);

process.exit(0);
