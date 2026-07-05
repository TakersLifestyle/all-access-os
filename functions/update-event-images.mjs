import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../web/.env.local") });

const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const IMAGE_MAP = [
  { fragment: "VIP Launch",    imageUrl: "/events/vip-launch-rooftop.jpg" },
  { fragment: "After Dark",    imageUrl: "/events/winnipeg-after-dark.jpg" },
  { fragment: "Sea Bears",     imageUrl: "/events/sea-bears-courtside.jpg" },
  { fragment: "Mansion",       imageUrl: "/events/mansion-party.jpg" },
];

const snap = await db.collection("events").get();
for (const d of snap.docs) {
  const title = d.data().title ?? "";
  const match = IMAGE_MAP.find(m => title.includes(m.fragment));
  if (match) {
    await d.ref.update({ imageUrl: match.imageUrl });
    console.log(`✓  ${title}  →  ${match.imageUrl}`);
  }
}
console.log("Done.");
