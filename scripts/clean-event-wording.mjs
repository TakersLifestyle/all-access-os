// Run from: cd functions && node ../scripts/clean-event-wording.mjs
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

let creds;
try {
  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
    ?? process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (raw) {
    creds = JSON.parse(raw.trim().replace(/^['"]|['"]$/g, ""));
  } else {
    // Try reading from local file
    const keyPath = resolve(__dirname, "../functions/serviceAccountKey.json");
    creds = JSON.parse(readFileSync(keyPath, "utf8"));
  }
} catch (e) {
  console.error("Could not load credentials:", e.message);
  process.exit(1);
}

initializeApp({ credential: cert(creds) });
const db = getFirestore();

const updates = [
  {
    // Find by title pattern — Mansion Party
    titleContains: "Mansion",
    changes: {
      title: "Mansion Party (All White Experience)",
      description: "An exclusive all-white dress code event at a private Winnipeg estate. " +
        "Curated guest list, open bar, and a night designed for connection. " +
        "Ticket access available for registered users.",
    },
  },
  {
    // Winnipeg After Dark — remove members-only language
    titleContains: "After Dark",
    changes: {
      description: "Winnipeg's premier nightlife experience. " +
        "Live DJs, premium drinks, and an electric atmosphere — " +
        "brought to you by ALL ACCESS. Sign in to unlock ticket access and pricing.",
    },
  },
  {
    // VIP Launch Night — remove members-only language
    titleContains: "VIP Launch",
    changes: {
      description: "The official ALL ACCESS launch event. " +
        "Rooftop sunset experience with music, dinner, drinks, and a curated guest list. " +
        "Sign in to unlock ticket access.",
    },
  },
];

const snap = await db.collection("events").get();

for (const doc of snap.docs) {
  const data = doc.data();
  for (const update of updates) {
    if (data.title && data.title.includes(update.titleContains)) {
      await doc.ref.update(update.changes);
      console.log(`✓ Updated "${data.title}" → applied wording changes`);
    }
  }
}

console.log("Done.");
process.exit(0);
