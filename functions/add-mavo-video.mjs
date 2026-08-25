import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const envContent = readFileSync("C:\\Users\\TakersLifestyle\\all-access-platform\\web\\.env.local", "utf8");
const saLine = envContent.split("\n").find(l => l.startsWith("GOOGLE_APPLICATION_CREDENTIALS_JSON="));
const serviceAccount = JSON.parse(saLine.replace("GOOGLE_APPLICATION_CREDENTIALS_JSON=", "").trim());

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const ALBUM_ID = "rbn-soul-bandit-mavo-part-1";
const YOUTUBE_URL = "https://www.youtube.com/watch?v=ZgX5cEEx5CA";
const THUMBNAIL = "https://img.youtube.com/vi/ZgX5cEEx5CA/maxresdefault.jpg";

const docRef = await db.collection("memoryMedia").add({
  albumId: ALBUM_ID,
  type: "video",
  url: YOUTUBE_URL,
  thumbnailUrl: THUMBNAIL,
  storagePath: null,
  originalFilename: "mavo-part1-youtube.mp4",
  isPinned: false,
  isFeatured: false,
  featuredOrder: null,
  featuredAt: null,
  likedBy: [],
  createdAt: FieldValue.serverTimestamp(),
});

await db.collection("memoryAlbums").doc(ALBUM_ID).update({
  videoCount: FieldValue.increment(1),
  updatedAt: FieldValue.serverTimestamp(),
});

console.log(`✅ Mavo video added to ${ALBUM_ID}`);
console.log(`   Doc ID: ${docRef.id}`);
console.log(`   URL: ${YOUTUBE_URL}`);
process.exit(0);
