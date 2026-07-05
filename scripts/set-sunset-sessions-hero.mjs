/**
 * Run this after copying the paint & sip photo to:
 * web/public/events/sunset-sessions-vol01.jpg
 *
 * From the project root:
 *   node scripts/set-sunset-sessions-hero.mjs
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { resolve, join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// Load service account
const saPath = join(root, "functions", "service-account.json");
let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(saPath, "utf8"));
} catch {
  // Try parsing from env
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    console.error("❌ No service account found at functions/service-account.json and FIREBASE_SERVICE_ACCOUNT_KEY not set.");
    process.exit(1);
  }
  serviceAccount = JSON.parse(raw);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const EVENT_DOC = "events/sunset-sessions-vol-01";
const HERO_URL = "/events/sunset-sessions-vol01.jpg";

const snap = await db.collection("events")
  .where("seriesId", "==", "sunset-sessions")
  .where("slug", "==", "vol-01")
  .limit(1)
  .get();

if (snap.empty) {
  console.error("❌ Event not found — check seriesId/slug");
  process.exit(1);
}

const docRef = snap.docs[0].ref;
await docRef.update({ heroImageUrl: HERO_URL, updatedAt: new Date().toISOString() });

console.log(`✅ Updated ${docRef.id} — heroImageUrl: ${HERO_URL}`);
console.log("   The image will appear on the series event page and homepage immediately.");
