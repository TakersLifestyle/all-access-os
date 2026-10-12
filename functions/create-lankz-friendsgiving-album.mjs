import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const env = readFileSync("../web/.env.local", "utf8").split("\n");
const getEnv = k => env.find(l => l.startsWith(k + "="))?.slice(k.length + 1).trim();
const serviceAccount = JSON.parse(getEnv("GOOGLE_APPLICATION_CREDENTIALS_JSON"));
initializeApp({ credential: cert(serviceAccount) });

const db = getFirestore();

const album = {
  title: "DJ LANKZ & FRIENDSGIVING",
  eventDate: "2026-10-09",
  location: "Red Sea, Winnipeg",
  category: "Community Spotlight",
  description: "A Friendsgiving to remember. DJ LANKZ brought the community together for a night of music, vibes, and real connection at Red Sea. ALL ACCESS was there to capture every moment.",
  coverImageUrl: "",
  coverStoragePath: "",
  status: "draft",
  photoCount: 0,
  videoCount: 0,
  creatorCount: 0,
  attendeeCount: 0,
  isFeatured: false,
  createdAt: FieldValue.serverTimestamp(),
};

const ref = await db.collection("memoryAlbums").add(album);
console.log("✅ Album created:", ref.id);
console.log("   Title:", album.title);
console.log("   Date:", album.eventDate);
console.log("   Status: draft — publish via Admin > Memories after uploading photos");
