import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { readFileSync } from "fs";

const ALBUM_ID = "konfam-rocafiesta-photoshoot-2026";
const BUCKET = "studio-4850154113-14e56.firebasestorage.app";

const envContent = readFileSync("C:\\Users\\TakersLifestyle\\all-access-platform\\web\\.env.local", "utf8");
const saLine = envContent.split("\n").find(l => l.startsWith("GOOGLE_APPLICATION_CREDENTIALS_JSON="));
const serviceAccount = JSON.parse(saLine.replace("GOOGLE_APPLICATION_CREDENTIALS_JSON=", "").trim());

initializeApp({ credential: cert(serviceAccount), storageBucket: BUCKET });
const db = getFirestore();
const bucket = getStorage().bucket();

async function main() {
  const snap = await db.collection("memoryMedia")
    .where("albumId", "==", ALBUM_ID)
    .get();

  console.log(`Fixing ${snap.docs.length} photos...\n`);

  let fixed = 0;
  let errors = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();

    // Pull storagePath set in previous run, or extract from URL
    let storagePath = data.storagePath;
    if (!storagePath) {
      const m = (data.url || "").match(/\/o\/(.+?)[\?&]/);
      if (!m) { console.log(`  SKIP: ${docSnap.id}`); continue; }
      storagePath = decodeURIComponent(m[1]);
    }

    const filename = storagePath.split("/").pop();
    process.stdout.write(`  ${filename}...`);

    try {
      const file = bucket.file(storagePath);

      // Make the object publicly readable via GCS ACL
      await file.makePublic();

      // Clean public URL — fast, no token, no expiry, works everywhere
      const publicUrl = `https://storage.googleapis.com/${BUCKET}/${storagePath}`;

      await docSnap.ref.update({
        url: publicUrl,
        thumbnailUrl: publicUrl,
        storagePath,
      });

      console.log(" ✓");
      fixed++;
    } catch (err) {
      console.log(` ✗ ${err.message}`);
      errors++;
    }
  }

  console.log(`\nDone. Fixed: ${fixed} | Errors: ${errors}`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
