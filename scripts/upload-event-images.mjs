import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMP = "C:\\Users\\TakersLifestyle\\AppData\\Local\\Temp";

// Load service account
const envPath = resolve(__dirname, "../web/.env.local");
const envContent = readFileSync(envPath, "utf-8");
const match = envContent.match(/GOOGLE_APPLICATION_CREDENTIALS_JSON=(.+)/);
if (!match) throw new Error("No GOOGLE_APPLICATION_CREDENTIALS_JSON in .env.local");
const serviceAccount = JSON.parse(match[1]);

const projectId = "studio-4850154113-14e56";

initializeApp({
  credential: cert(serviceAccount),
  storageBucket: `${projectId}.firebasestorage.app`,
});

const db = getFirestore();
const storage = getStorage();
const bucket = storage.bucket();

// Map: which file → event title keyword → storage name
// Based on file analysis:
// 2ae28516 = WebP 1920x2485 (portrait) = dark rooftop party photo = VIP Launch Night
// b2b7f23f = JPEG 962x641 = Sea Bears courtside arena (colorful teal crowd)
// 6ed89939 = PNG 1390x876 (29MB, large) = luxury mansion + pool
// adc34845 = PNG 2600x2466 = rooftop terrace with city/fireplace = Winnipeg After Dark
const uploads = [
  {
    tmpFile: `${TEMP}\\2ae28516-4bc6-488e-a23f-0460ec632da8.tmp`,
    storageName: "events/vip-launch-rooftop.webp",
    contentType: "image/webp",
    matchKeyword: "VIP Launch",
  },
  {
    tmpFile: `${TEMP}\\b2b7f23f-7487-416d-8e84-8623e264b976.tmp`,
    storageName: "events/sea-bears-courtside.jpg",
    contentType: "image/jpeg",
    matchKeyword: "Sea Bears",
  },
  {
    tmpFile: `${TEMP}\\6ed89939-c10f-4dbd-8863-1c51567364a6.tmp`,
    storageName: "events/mansion-party.png",
    contentType: "image/png",
    matchKeyword: "Mansion",
  },
  {
    tmpFile: `${TEMP}\\adc34845-5fdb-4222-ab7f-d69d8cc78c43.tmp`,
    storageName: "events/winnipeg-after-dark.png",
    contentType: "image/png",
    matchKeyword: "Winnipeg After Dark",
  },
];

async function uploadAndUpdate() {
  console.log("🔥 Uploading event images to Firebase Storage...\n");

  for (const item of uploads) {
    try {
      const fileBuffer = readFileSync(item.tmpFile);
      console.log(`📁 ${item.matchKeyword}: ${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB`);

      const file = bucket.file(item.storageName);
      await file.save(fileBuffer, {
        metadata: {
          contentType: item.contentType,
          cacheControl: "public, max-age=31536000",
        },
      });
      await file.makePublic();

      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${item.storageName}`;
      console.log(`✅ Uploaded: ${publicUrl}`);

      // Update matching Firestore events
      const snap = await db.collection("events").get();
      for (const docSnap of snap.docs) {
        const title = docSnap.data().title || "";
        // Check if title contains any word from the keyword (case insensitive)
        const kwWords = item.matchKeyword.toLowerCase().split(" ");
        const titleLow = title.toLowerCase();
        if (kwWords.some((w) => w.length > 3 && titleLow.includes(w))) {
          await docSnap.ref.update({ imageUrl: publicUrl });
          console.log(`   ↳ Updated: "${title}"`);
        }
      }
      console.log();
    } catch (err) {
      console.error(`❌ Failed ${item.matchKeyword}: ${err.message}\n`);
    }
  }

  // Final summary
  console.log("📋 Final event states:\n");
  const snap = await db.collection("events").get();
  for (const d of snap.docs) {
    const data = d.data();
    console.log(`  ✓ ${data.title}`);
    console.log(`    imageUrl: ${data.imageUrl ? "✅ SET" : "❌ MISSING"}\n`);
  }

  process.exit(0);
}

uploadAndUpdate().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
