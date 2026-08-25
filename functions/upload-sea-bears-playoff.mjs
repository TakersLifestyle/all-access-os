import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { readFileSync, existsSync } from "fs";
import { basename, extname } from "path";

const ALBUM_ID = "sea-bears-first-ever-home-playoff-win";
const BUCKET = "studio-4850154113-14e56.firebasestorage.app";

const envContent = readFileSync("C:\\Users\\TakersLifestyle\\all-access-platform\\web\\.env.local", "utf8");
const saLine = envContent.split("\n").find(l => l.startsWith("GOOGLE_APPLICATION_CREDENTIALS_JSON="));
const serviceAccount = JSON.parse(saLine.replace("GOOGLE_APPLICATION_CREDENTIALS_JSON=", "").trim());

initializeApp({ credential: cert(serviceAccount), storageBucket: BUCKET });
const db = getFirestore();
const bucket = getStorage().bucket();

// ── Files to upload ────────────────────────────────────────────────────────
const PHOTOS = [
  "C:\\Users\\TakersLifestyle\\Downloads\\IMG_5507.JPG",
  "C:\\Users\\TakersLifestyle\\Downloads\\IMG_5517.JPG",
  "C:\\Users\\TakersLifestyle\\Downloads\\IMG_5519.JPG",
  "C:\\Users\\TakersLifestyle\\Downloads\\IMG_5523.JPG",
  "C:\\Users\\TakersLifestyle\\Downloads\\IMG_5526.JPG",
  "C:\\Users\\TakersLifestyle\\Downloads\\3E700F1E-9B13-4EB0-B1FA-4713379C6EBD.JPG",
];

const VIDEOS = [
  "C:\\Users\\TakersLifestyle\\Downloads\\BD4F0D17-6908-4700-95E4-5ED39489BE97.MOV",
  "C:\\Users\\TakersLifestyle\\Downloads\\D47D4479-4178-4247-84A4-3DBD26DA37A1.MOV",
  "C:\\Users\\TakersLifestyle\\Downloads\\A88D6FB6-FE44-49EA-8700-73DE22A89F0C.MOV",
  "C:\\Users\\TakersLifestyle\\Downloads\\D6B4B754-334B-4EB0-AC62-9F00A6CD4B1C.MOV",
  "C:\\Users\\TakersLifestyle\\Downloads\\IMG_5508.MP4",
  "C:\\Users\\TakersLifestyle\\Downloads\\IMG_5510.MP4",
  "C:\\Users\\TakersLifestyle\\Downloads\\IMG_5512.MP4",
  "C:\\Users\\TakersLifestyle\\Downloads\\IMG_5521.MP4",
  "C:\\Users\\TakersLifestyle\\Downloads\\IMG_5525.MP4",
];

function mimeType(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".mov") return "video/quicktime";
  if (ext === ".mp4") return "video/mp4";
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

async function main() {
  let photoCount = 0;
  let videoCount = 0;
  let coverUrl = "";

  // ── Upload photos ──────────────────────────────────────────────────────
  console.log(`\n📸 Uploading ${PHOTOS.length} photos...\n`);
  for (const [i, filePath] of PHOTOS.entries()) {
    if (!existsSync(filePath)) { console.log(`  SKIP (not found): ${basename(filePath)}`); continue; }
    const dest = `memories/${ALBUM_ID}/photos/${Date.now()}_${basename(filePath)}`;
    process.stdout.write(`  [${i + 1}/${PHOTOS.length}] ${basename(filePath)}...`);
    try {
      const url = await uploadFile(filePath, dest);
      const isFirst = photoCount === 0;
      if (isFirst) coverUrl = url;
      await db.collection("memoryMedia").add({
        albumId: ALBUM_ID,
        type: "photo",
        url,
        thumbnailUrl: url,
        storagePath: dest,
        originalFilename: basename(filePath),
        isPinned: isFirst,           // pin first photo
        isFeatured: isFirst,         // feature first photo as cover moment
        featuredOrder: isFirst ? Date.now() : null,
        featuredAt: isFirst ? FieldValue.serverTimestamp() : null,
        likedBy: [],
        createdAt: FieldValue.serverTimestamp(),
      });
      console.log(" ✓");
      photoCount++;
    } catch (err) {
      console.log(` ✗ ${err.message}`);
    }
  }

  // ── Upload videos ──────────────────────────────────────────────────────
  console.log(`\n🎥 Uploading ${VIDEOS.length} videos...\n`);
  for (const [i, filePath] of VIDEOS.entries()) {
    if (!existsSync(filePath)) { console.log(`  SKIP (not found): ${basename(filePath)}`); continue; }
    const dest = `memories/${ALBUM_ID}/videos/${Date.now()}_${basename(filePath)}`;
    process.stdout.write(`  [${i + 1}/${VIDEOS.length}] ${basename(filePath)}...`);
    try {
      const url = await uploadFile(filePath, dest);
      await db.collection("memoryMedia").add({
        albumId: ALBUM_ID,
        type: "video",
        url,
        thumbnailUrl: "",
        storagePath: dest,
        originalFilename: basename(filePath),
        isPinned: false,
        isFeatured: false,
        downloadEnabled: false,
        likesCount: 0,
        likedBy: [],
        createdAt: FieldValue.serverTimestamp(),
      });
      console.log(" ✓");
      videoCount++;
    } catch (err) {
      console.log(` ✗ ${err.message}`);
    }
  }

  // ── Update album doc ───────────────────────────────────────────────────
  const albumUpdate = {
    photoCount: FieldValue.increment(photoCount),
    videoCount: FieldValue.increment(videoCount),
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (coverUrl) albumUpdate.coverImageUrl = coverUrl;

  await db.collection("memoryAlbums").doc(ALBUM_ID).update(albumUpdate);

  console.log(`\n✅ Done!`);
  console.log(`   Photos uploaded: ${photoCount}`);
  console.log(`   Videos uploaded: ${videoCount}`);
  if (coverUrl) console.log(`   Cover set to first photo`);
  console.log(`\n   View: https://allaccesswinnipeg.ca/memories/${ALBUM_ID}`);
  process.exit(0);
}

main().catch(err => { console.error("❌", err); process.exit(1); });
