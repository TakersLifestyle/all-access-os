import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const env = readFileSync("../web/.env.local", "utf8").split("\n");
const getEnv = k => env.find(l => l.startsWith(k + "="))?.slice(k.length + 1).trim();
const serviceAccount = JSON.parse(getEnv("GOOGLE_APPLICATION_CREDENTIALS_JSON"));
initializeApp({ credential: cert(serviceAccount) });

const db = getFirestore();
const ALBUM_ID = "hOK43bha5jGuBXG0uspB";

// Get photos — no orderBy so no composite index needed
const snap = await db.collection("memoryMedia")
  .where("albumId", "==", ALBUM_ID)
  .limit(50)
  .get();

if (snap.empty) { console.log("No photos found"); process.exit(1); }

// Sort by storagePath (timestamp_index_filename) to get the first uploaded
const photos = snap.docs
  .map(d => ({ id: d.id, ...d.data() }))
  .filter(d => d.type === "photo")
  .sort((a, b) => a.storagePath.localeCompare(b.storagePath));

console.log(`Found ${photos.length} photos in first batch`);
const firstPhoto = photos[0];
const url = firstPhoto.url;
const storagePath = firstPhoto.storagePath;

console.log("Setting cover to:", url);
console.log("storagePath:", storagePath);

await db.collection("memoryAlbums").doc(ALBUM_ID).update({
  coverImageUrl: url,
  ...(storagePath ? { coverStoragePath: storagePath } : {}),
});

console.log("✅ Cover updated successfully");
