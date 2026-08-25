/**
 * create-dj-lankz-skales-event.mjs
 * Creates the DJ LANKZ & FRIENDS — SKALES LIVE IN WINNIPEG event in Firestore.
 * Uses type: "live_concert" (unique — does NOT conflict with ROCAFIESTA's "concert" type).
 * Slug: dj-lankz-and-friends-skales-winnipeg
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const envContent = readFileSync("C:\\Users\\TakersLifestyle\\all-access-platform\\web\\.env.local", "utf8");
const saLine = envContent.split("\n").find(l => l.startsWith("GOOGLE_APPLICATION_CREDENTIALS_JSON="));
const serviceAccount = JSON.parse(saLine.replace("GOOGLE_APPLICATION_CREDENTIALS_JSON=", "").trim());

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const SLUG = "dj-lankz-and-friends-skales-winnipeg";

// Check it doesn't already exist
const existing = await db.collection("events").where("slug", "==", SLUG).get();
if (!existing.empty) {
  console.log(`⚠️  Event with slug "${SLUG}" already exists — aborting to prevent duplicate.`);
  console.log(`   Doc ID: ${existing.docs[0].id}`);
  process.exit(0);
}

const eventData = {
  // Identity
  slug: SLUG,
  type: "live_concert",       // UNIQUE type — does not conflict with ROCAFIESTA ("concert")
  title: "DJ LANKZ & FRIENDS",
  subtitle: "SKALES LIVE IN WINNIPEG",
  headlineArtist: "SKALES",
  specialGuest: "DANAGOG",
  host: "DJ LANKZ",
  presentedBy: "ALL ACCESS Winnipeg",

  // Date & Location
  date: "2026-10-09",
  doorsOpen: "10:00 PM",
  location: "265 Portage Ave, Winnipeg, MB",
  venue: "TBA",
  ageRestriction: "18+",

  // Description
  description: "DJ LANKZ brings the biggest Afrobeats night to Winnipeg. SKALES LIVE IN WINNIPEG — an unforgettable evening of Afrobeats, culture, and connection. With special guest DANAGOG.",

  // Imagery
  imageUrl: "/events/skales-hero.jpg",
  heroImageUrl: "/events/skales-hero.jpg",

  // Ticket config — prices TBD, checkout disabled until set
  generalPrice: 0,
  memberPrice: 0,
  noMemberDiscount: false,
  checkoutEnabled: false,
  ticketsRemaining: 200,
  capacity: 200,
  soldOut: false,
  isMembersOnly: false,

  // Display flags
  status: "active",
  featured: true,
  isLaunchEvent: false,

  // Meta
  createdAt: FieldValue.serverTimestamp(),
  updatedAt: FieldValue.serverTimestamp(),
};

const ref = await db.collection("events").add(eventData);

console.log(`\n✅ DJ LANKZ & FRIENDS event created!`);
console.log(`   Firestore ID: ${ref.id}`);
console.log(`   Slug: ${SLUG}`);
console.log(`   Date: October 9, 2026`);
console.log(`   Type: live_concert (unique — ROCAFIESTA untouched)`);
console.log(`   Event page: /events/${SLUG}`);
console.log(`\n⚠️  Tickets: checkoutEnabled=false until prices are set.`);
process.exit(0);
