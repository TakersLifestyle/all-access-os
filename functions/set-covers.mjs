import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const env = readFileSync("../web/.env.local", "utf8").split("\n");
const line = env.find(l => l.startsWith("GOOGLE_APPLICATION_CREDENTIALS_JSON="));
const raw = line.slice("GOOGLE_APPLICATION_CREDENTIALS_JSON=".length).trim();
initializeApp({ credential: cert(JSON.parse(raw)) });
const db = getFirestore();

const TARGETS = [
  { albumId: "community-spotlight-rbn-no11-opening-night", title: "NIGHT OUT WITH RBN",        position: 198 },
  { albumId: "konfam-rocafiesta-photoshoot-2026",          title: "KONFAM — BEHIND THE LENS",  position: 14  },
  { albumId: "community-spotlight-pops-young-jonn",        title: "P0PS x YOUNG JONN",         position: 19  },
];

async function getPhotos(albumId) {
  try {
    const snap = await db.collection("memoryMedia")
      .where("albumId", "==", albumId).where("type", "==", "photo")
      .orderBy("order", "asc").get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    const snap = await db.collection("memoryMedia")
      .where("albumId", "==", albumId).where("type", "==", "photo").get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
}

for (const { albumId, title, position } of TARGETS) {
  const photos = await getPhotos(albumId);
  const photo = photos[position - 1];
  if (!photo) { console.log(`✗ ${title}: no photo at ${position}`); continue; }
  const url = photo.url;
  const pathMatch = url.match(/\/o\/(.+?)(?:\?|$)/);
  const storagePath = pathMatch?.[1] ? decodeURIComponent(pathMatch[1]) : undefined;
  const update = { coverImageUrl: url, cacheVersion: Date.now() };
  if (storagePath) update.coverStoragePath = storagePath;
  await db.collection("memoryAlbums").doc(albumId).update(update);
  console.log(`✓ ${title} → photo ${position}`);
}

console.log("Done.");
process.exit(0);
