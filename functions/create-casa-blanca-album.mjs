import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const ALBUM_ID = "casa-blanca-dj-lankz-and-friends";

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
    title: "CASA BLANCA — DJ LANKZ & FRIENDS",
    eventDate: "2026-08-16",
    location: "Winnipeg, MB",
    category: "Community Spotlight",
    description: "Casa Blanca — hosted by DAN and headlined by DJ LANKZ & Friends. ALL ACCESS was personally invited out for another successful night. The energy, the crowd, the vibes — all documented.",
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
}

main().catch(err => { console.error("❌", err); process.exit(1); });
