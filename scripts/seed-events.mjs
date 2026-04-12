import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load service account from .env.local
const envPath = resolve(__dirname, "../web/.env.local");
const envContent = readFileSync(envPath, "utf-8");
const match = envContent.match(/GOOGLE_APPLICATION_CREDENTIALS_JSON=(.+)/);
if (!match) throw new Error("No GOOGLE_APPLICATION_CREDENTIALS_JSON in .env.local");
const serviceAccount = JSON.parse(match[1]);

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const events = [
  {
    title: "VIP Launch Night — Rooftop Sunset Social",
    date: "2026-06-05",
    location: "Private Rooftop Venue (Location revealed after ticket purchase)",
    capacity: 50,
    ticketsRemaining: 50,
    generalPrice: 100,
    memberPrice: 100,
    isMembersOnly: false,
    status: "active",
    imageUrl: "",
    description:
      "Private launch event for ALL ACCESS members. Rooftop sunset experience with music, dinner, drinks, and a curated guest list. This is the first official members-only experience.",
    tags: ["launch", "rooftop", "vip"],
    createdAt: Timestamp.now(),
  },
  {
    title: "Winnipeg After Dark — VIP Nightlife Experience",
    date: "2026-07-10",
    location: "DIABLO (Lounge + VIP Access)",
    capacity: 30,
    ticketsRemaining: 30,
    generalPrice: 0,
    memberPrice: 300,
    isMembersOnly: true,
    status: "active",
    imageUrl: "",
    description:
      "VIP nightlife experience including limo pre-game, priority entry, exclusive VIP seating, and complimentary drinks. Designed for a high-end, no-wait nightlife experience.",
    tags: ["vip", "nightlife", "premium"],
    createdAt: Timestamp.now(),
  },
  {
    title: "Members Only Mansion Party (All White)",
    date: "2026-07-31",
    location: "Private Mansion (Location revealed after booking)",
    capacity: 25,
    ticketsRemaining: 25,
    generalPrice: 0,
    memberPrice: 100,
    isMembersOnly: true,
    status: "active",
    imageUrl: "",
    description:
      "Private all-white summer party hosted at a luxury mansion. Music, drinks, curated crowd, and a premium invite-only atmosphere.",
    tags: ["mansion", "exclusive", "invite-only", "all-white"],
    createdAt: Timestamp.now(),
  },
  {
    title: "Sea Bears Courtside Experience — Game Day + Limo",
    date: "2026-07-25",
    location: "Canada Life Centre — Private Transport Included",
    capacity: 20,
    ticketsRemaining: 20,
    generalPrice: 0,
    memberPrice: 300,
    isMembersOnly: true,
    status: "active",
    imageUrl: "",
    description:
      "Premium courtside game-day experience with private transportation, group atmosphere, and curated entertainment. Designed for high-energy, social, and content-driven moments.",
    tags: ["sports", "courtside", "limo", "premium"],
    createdAt: Timestamp.now(),
  },
];

async function seed() {
  console.log("🔥 Seeding events into Firestore...\n");

  // Clear existing events first
  const snap = await db.collection("events").get();
  const deletes = snap.docs.map((d) => d.ref.delete());
  await Promise.all(deletes);
  console.log(`🗑️  Cleared ${snap.docs.length} existing event(s)\n`);

  for (const event of events) {
    const ref = await db.collection("events").add(event);
    console.log(`✅ Added: ${event.title}`);
    console.log(`   ID: ${ref.id}`);
    console.log(`   Date: ${event.date} | Members Only: ${event.isMembersOnly}`);
    console.log(`   Capacity: ${event.capacity} | Member Price: $${event.memberPrice}\n`);
  }

  console.log("🎉 All 4 events seeded successfully!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
