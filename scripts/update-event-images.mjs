import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../functions/.env.local") });

const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
  readFileSync(resolve(__dirname, "../functions/service-account.json"), "utf8")
);

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const IMAGE_MAP = [
  { titleFragment: "VIP Launch",        imageUrl: "/events/vip-launch-rooftop.jpg" },
  { titleFragment: "After Dark",        imageUrl: "/events/winnipeg-after-dark.jpg" },
  { titleFragment: "Sea Bears",         imageUrl: "/events/sea-bears-courtside.jpg" },
  { titleFragment: "Mansion",           imageUrl: "/events/mansion-party.jpg" },
];

const snap = await db.collection("events").get();
for (const docSnap of snap.docs) {
  const { title } = docSnap.data();
  const match = IMAGE_MAP.find(m => title?.includes(m.titleFragment));
  if (match) {
    await docSnap.ref.update({ imageUrl: match.imageUrl });
    console.log(`✓ ${title} → ${match.imageUrl}`);
  } else {
    console.log(`  skipped: ${title}`);
  }
}
console.log("Done.");
