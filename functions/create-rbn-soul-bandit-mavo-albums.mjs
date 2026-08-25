import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const envContent = readFileSync("C:\\Users\\TakersLifestyle\\all-access-platform\\web\\.env.local", "utf8");
const saLine = envContent.split("\n").find(l => l.startsWith("GOOGLE_APPLICATION_CREDENTIALS_JSON="));
const serviceAccount = JSON.parse(saLine.replace("GOOGLE_APPLICATION_CREDENTIALS_JSON=", "").trim());

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const ALBUMS = [
  {
    id: "rbn-soul-bandit-mavo-part-1",
    data: {
      title: "RBN x SOUL BANDIT — LIVE IN WINNIPEG",
      eventDate: "2026-08-08",
      location: "City Oasis Hall · Winnipeg, MB",
      category: "Community Spotlight",
      description: "Part 1 of 2. The journey to the show and the opening acts — RBN and Soul Bandit took the stage and set the tone for the night. ALL ACCESS was there from the start.",
      coverImageUrl: "",
      status: "active",
      photoCount: 0,
      videoCount: 0,
      creatorCount: 0,
      attendeeCount: 0,
      isFeatured: false,
    }
  },
  {
    id: "rbn-soul-bandit-mavo-part-2",
    data: {
      title: "MAVO LIVE IN WINNIPEG — The Headlining Set",
      eventDate: "2026-08-08",
      location: "City Oasis Hall · Winnipeg, MB",
      category: "Community Spotlight",
      description: "Part 2 of 2. MAVO took the stage as the headliner and delivered. ALL ACCESS documented the full set, the energy, and the moment.",
      coverImageUrl: "",
      status: "active",
      photoCount: 0,
      videoCount: 0,
      creatorCount: 0,
      attendeeCount: 0,
      isFeatured: false,
    }
  }
];

async function main() {
  for (const album of ALBUMS) {
    const existing = await db.collection("memoryAlbums").doc(album.id).get();
    if (existing.exists) {
      console.log(`⚠️  Already exists, skipping: ${album.id}`);
      continue;
    }
    await db.collection("memoryAlbums").doc(album.id).set({
      ...album.data,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`✅ Created: ${album.id}`);
    console.log(`   URL: https://allaccesswinnipeg.ca/memories/${album.id}`);
  }

  console.log(`\n📋 Lightroom export guide:`);
  console.log(`   Part 1 (RBN x Soul Bandit): Select DSC07464 → DSC08200, export to a folder`);
  console.log(`   Part 2 (MAVO): Select DSC08200 → DSC08597, export to a separate folder`);
  console.log(`   Then share the folder paths and I'll upload both batches.`);
}

main().catch(err => { console.error("❌", err); process.exit(1); });
