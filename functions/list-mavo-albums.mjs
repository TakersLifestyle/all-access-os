import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const envContent = readFileSync("C:\\Users\\TakersLifestyle\\all-access-platform\\web\\.env.local", "utf8");
const saLine = envContent.split("\n").find(l => l.startsWith("GOOGLE_APPLICATION_CREDENTIALS_JSON="));
const serviceAccount = JSON.parse(saLine.replace("GOOGLE_APPLICATION_CREDENTIALS_JSON=", "").trim());

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const snap = await db.collection("memoryAlbums").get();
snap.forEach(doc => {
  const d = doc.data();
  if (d.title?.toLowerCase().includes("mavo") || doc.id.includes("mavo")) {
    console.log(`ID: ${doc.id}`);
    console.log(`Title: ${d.title}`);
    console.log(`Photos: ${d.photoCount} | Videos: ${d.videoCount}`);
    console.log("---");
  }
});
process.exit(0);
