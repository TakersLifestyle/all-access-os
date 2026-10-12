import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";

const env = readFileSync("../web/.env.local", "utf8").split("\n");
const getEnv = k => env.find(l => l.startsWith(k + "="))?.slice(k.length + 1).trim();
const serviceAccount = JSON.parse(getEnv("GOOGLE_APPLICATION_CREDENTIALS_JSON"));

initializeApp({
  credential: cert(serviceAccount),
  storageBucket: "studio-4850154113-14e56.firebasestorage.app",
});

const db = getFirestore();
const bucket = getStorage().bucket();

const ALBUM_ID = "hOK43bha5jGuBXG0uspB";
const PHOTOS_DIR = "C:\\Users\\TakersLifestyle\\Downloads\\lankz & Friendsgiving";
const CONCURRENCY = 5; // upload 5 at a time

// Get all JPG files
const allFiles = readdirSync(PHOTOS_DIR)
  .filter(f => [".jpg", ".jpeg", ".png", ".webp"].includes(extname(f).toLowerCase()))
  .sort();

console.log(`Found ${allFiles.length} photos to upload to album ${ALBUM_ID}`);
console.log("Album: DJ LANKZ & FRIENDSGIVING");
console.log("Location: Red Sea Night Lounge, Winnipeg");
console.log("─".repeat(50));

let uploaded = 0;
let failed = 0;
const ts = Date.now();

async function uploadOne(filename, index) {
  const localPath = join(PHOTOS_DIR, filename);
  const storagePath = `memories/${ALBUM_ID}/photos/${ts}_${index}_${filename}`;

  try {
    const fileData = readFileSync(localPath);
    const ext = extname(filename).toLowerCase();
    const contentType = ext === ".png" ? "image/png"
      : ext === ".webp" ? "image/webp"
      : "image/jpeg";

    const fileRef = bucket.file(storagePath);
    await fileRef.save(fileData, {
      metadata: { contentType },
      resumable: false,
    });

    // Make publicly accessible + get token-based download URL
    await fileRef.makePublic();
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${encodeURIComponent(storagePath).replace(/%2F/g, "/")}`;

    // Create Firestore media doc
    await db.collection("memoryMedia").add({
      albumId: ALBUM_ID,
      type: "photo",
      url: publicUrl,
      storagePath,
      caption: "",
      isPinned: false,
      isFeatured: false,
      downloadEnabled: true,
      likesCount: 0,
      commentsCount: 0,
      uploadedBy: "admin",
      uploadedByName: "Admin",
      createdAt: FieldValue.serverTimestamp(),
      likedBy: [],
    });

    uploaded++;
    process.stdout.write(`\r✅ ${uploaded}/${allFiles.length} uploaded  (${failed} failed)`);
  } catch (err) {
    failed++;
    console.error(`\n❌ Failed: ${filename} — ${err.message}`);
  }
}

// Process in batches of CONCURRENCY
for (let i = 0; i < allFiles.length; i += CONCURRENCY) {
  const batch = allFiles.slice(i, i + CONCURRENCY);
  await Promise.all(batch.map((f, j) => uploadOne(f, i + j)));
}

// Update photoCount on the album
await db.collection("memoryAlbums").doc(ALBUM_ID).update({
  photoCount: FieldValue.increment(uploaded),
});

console.log("\n" + "─".repeat(50));
console.log(`\n✅ Done! ${uploaded} photos uploaded, ${failed} failed`);
console.log(`📸 Album: https://allaccesswinnipeg.ca/memories/${ALBUM_ID}`);
console.log(`🔧 Admin: https://allaccesswinnipeg.ca/admin/memories`);
console.log("\nNext: set a cover photo and publish the album in Admin > Memories");
