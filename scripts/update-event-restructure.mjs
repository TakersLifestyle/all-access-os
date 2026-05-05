// Run from: functions/ folder
// node ../scripts/update-event-restructure.mjs

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const keyPath = resolve(__dirname, "../../Downloads/studio-4850154113-14e56-firebase-adminsdk-fbsvc-cb96543206.json");
const creds = JSON.parse(readFileSync(keyPath, "utf8"));

initializeApp({ credential: cert(creds) });
const db = getFirestore();

// ── Sea Bears: Official first launch event ─────────────────
await db.collection("events").doc("2PsGI8PCNoIdCudbR8Sh").update({
  title: "Sea Bears Courtside Experience — ALL ACCESS Launch Event",
  date: "2026-06-30",
  capacity: 15,
  ticketsRemaining: 15,
  generalPrice: 300,
  memberPrice: 300,
  description:
    "ALL ACCESS officially launches June 30 with our first-ever community experience: Sea Bears Courtside.\n\n" +
    "This is not mass entry.\n" +
    "Only 15 tickets available.\n\n" +
    "Founding energy. Real connection. Premium experience.",
  status: "active",
  isLaunchEvent: true,
  updatedAt: new Date().toISOString(),
});
console.log("✓ Sea Bears updated — June 30, 15 tickets, launch event");

// ── VIP Rooftop: Move to Coming Soon ──────────────────────
await db.collection("events").doc("BpBS9iIVcQJ9KImU9a2g").update({
  title: "Rooftop Sunset Social — Coming Soon",
  status: "coming_soon",
  date: "2026-12-31", // far future so it sorts last
  description:
    "An exclusive rooftop experience is coming later in the season.\n" +
    "Details dropping soon — stay tuned.",
  updatedAt: new Date().toISOString(),
});
console.log("✓ VIP Rooftop → coming_soon");

console.log("\nDone. Firestore updated.");
process.exit(0);
