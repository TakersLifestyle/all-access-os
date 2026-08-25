import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const ALBUM_ID = "pops-konfam-mavo-live-in-winnipeg";

const envContent = readFileSync("C:\\Users\\TakersLifestyle\\all-access-platform\\web\\.env.local", "utf8");
const saLine = envContent.split("\n").find(l => l.startsWith("GOOGLE_APPLICATION_CREDENTIALS_JSON="));
const serviceAccount = JSON.parse(saLine.replace("GOOGLE_APPLICATION_CREDENTIALS_JSON=", "").trim());

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function main() {
  const existing = await db.collection("memoryAlbums").doc(ALBUM_ID).get();
  if (existing.exists) {
    console.log("⚠️  Album already exists — aborting.");
    process.exit(0);
  }

  await db.collection("memoryAlbums").doc(ALBUM_ID).set({
    title: "P0P$ x KONFAM x MAVO LIVE IN WINNIPEG",
    eventDate: "2026-08-08",
    location: "City Oasis Hall · Winnipeg, MB",
    category: "Community Spotlight",
    description: "P0P$ and KONFAM reached another milestone as they opened for MAVO live in Winnipeg. ALL ACCESS came out to support two of our own and document another special night for the community.",
    coverImageUrl: "",
    status: "active",
    photoCount: 0,
    videoCount: 0,
    creatorCount: 0,
    attendeeCount: 0,
    isFeatured: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log(`✅ Album created!`);
  console.log(`   ID:  ${ALBUM_ID}`);
  console.log(`   URL: https://allaccesswinnipeg.ca/memories/${ALBUM_ID}`);
  console.log(`\n   Automatically linked to other Community Spotlight albums`);
  console.log(`   (Pops x Young Jonn, Pops x Fola, RBN, etc.)\n`);
  console.log(`   Ready for photos.`);
}

main().catch(err => { console.error("❌", err); process.exit(1); });
