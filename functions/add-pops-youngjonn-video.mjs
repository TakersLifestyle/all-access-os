import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const ALBUM_ID = "community-spotlight-pops-young-jonn";
const VIDEO_URL = "https://www.youtube.com/watch?v=cAW3tXQKWYs";
const YT_ID = "cAW3tXQKWYs";

const envContent = readFileSync("C:\\Users\\TakersLifestyle\\all-access-platform\\web\\.env.local", "utf8");
const saLine = envContent.split("\n").find(l => l.startsWith("GOOGLE_APPLICATION_CREDENTIALS_JSON="));
const serviceAccount = JSON.parse(saLine.replace("GOOGLE_APPLICATION_CREDENTIALS_JSON=", "").trim());

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function main() {
  const docRef = db.collection("memoryMedia").doc();
  await docRef.set({
    albumId: ALBUM_ID,
    type: "video",
    url: VIDEO_URL,
    thumbnailUrl: `https://img.youtube.com/vi/${YT_ID}/maxresdefault.jpg`,
    caption: "ALL ACCESS went to see Young Jonn live in Winnipeg",
    isPinned: false,
    isFeatured: false,
    downloadEnabled: false,
    likesCount: 0,
    commentsCount: 0,
    uploadedBy: "admin",
    uploadedByName: "Admin",
    createdAt: FieldValue.serverTimestamp(),
    likedBy: [],
  });

  // Increment videoCount on the album doc
  await db.collection("memoryAlbums").doc(ALBUM_ID).update({
    videoCount: FieldValue.increment(1),
  });

  console.log(`✅ Video added — doc ID: ${docRef.id}`);
  console.log(`   Album: ${ALBUM_ID}`);
  console.log(`   URL: ${VIDEO_URL}`);
}

main().catch(err => { console.error("❌", err); process.exit(1); });
