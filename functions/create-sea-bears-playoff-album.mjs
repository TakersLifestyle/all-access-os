import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const ALBUM_ID = "sea-bears-first-ever-home-playoff-win";

const envContent = readFileSync("C:\\Users\\TakersLifestyle\\all-access-platform\\web\\.env.local", "utf8");
const saLine = envContent.split("\n").find(l => l.startsWith("GOOGLE_APPLICATION_CREDENTIALS_JSON="));
const serviceAccount = JSON.parse(saLine.replace("GOOGLE_APPLICATION_CREDENTIALS_JSON=", "").trim());

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function main() {
  // Check it doesn't already exist
  const existing = await db.collection("memoryAlbums").doc(ALBUM_ID).get();
  if (existing.exists) {
    console.log("⚠️  Album already exists — aborting to avoid overwrite.");
    process.exit(0);
  }

  await db.collection("memoryAlbums").doc(ALBUM_ID).set({
    title: "SEA BEARS — FIRST EVER HOME PLAYOFF WIN",
    eventDate: "2026-08-05",
    location: "Canada Life Centre · Winnipeg, MB",
    category: "Community Spotlight",
    description: "ALL ACCESS Winnipeg was invited back to support the Sea Bears for their first-ever home playoff game. An incredible night in Winnipeg, capped off with a big playoff victory. 🏀🔥",
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
  console.log(`\n   Ready to upload photos.`);
}

main().catch(err => { console.error("❌", err); process.exit(1); });
