import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../web/.env.local");
const envContent = readFileSync(envPath, "utf-8");
const match = envContent.match(/GOOGLE_APPLICATION_CREDENTIALS_JSON=(.+)/);
if (!match) throw new Error("No GOOGLE_APPLICATION_CREDENTIALS_JSON in .env.local");
const serviceAccount = JSON.parse(match[1]);

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const event = {
  title: "ROCAFIESTA — A Spiritual Experience with Konfam",
  slug: "rocafiesta-konfam",
  type: "concert",
  featured: true,
  published: true,
  host: "Konfam",
  date: "2026-09-05",
  location: "Winnipeg, MB — Venue TBA",
  description: `For years, Konfam has shared stages with some of the biggest artists to perform in Winnipeg.\n\nNow...\n\nThe time has finally arrived.\n\nThis is more than another performance.\n\nThis is Konfam's very first official headline show.\n\nROCAFIESTA is a celebration of faith, music, culture and purpose.\n\nExpect powerful performances, live music, high energy, special guests, community, and a night you'll remember long after the lights go down.\n\nWe're proud to bring this experience to the ALL ACCESS Winnipeg community.\n\nDon't miss history.`,
  imageUrl: "/events/rocafiesta-poster.jpg",
  videoUrl: "/events/rocafiesta-promo.mov",
  status: "active",
  category: "concert",
  registrationOpen: true,
  checkoutEnabled: true,
  isMembersOnly: false,
  noMemberDiscount: true,
  generalPrice: 50,
  memberPrice: 50,
  capacity: 0,
  ticketsRemaining: 9999,
  soldOut: false,
  ticketTiers: {
    student: { name: "Student", price: 40, description: "Valid student ID required at door" },
    regular: { name: "Regular Admission", price: 50, description: "General admission — doors open at 7PM" },
    vip: { name: "VIP", price: 70, description: "Priority entry, premium viewing area, VIP experience" },
  },
  tags: ["concert", "live music", "konfam", "faith", "community", "featured"],
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
};

console.log("Adding ROCAFIESTA event...");
const eventRef = await db.collection("events").add(event);
console.log("Event created:", eventRef.id);

const album = {
  title: "ROCAFIESTA — A Spiritual Experience with Konfam",
  description: "Konfam's first official headline show. September 5, 2026.",
  eventDate: "2026-09-05",
  location: "Winnipeg, MB",
  category: "concert",
  eventId: eventRef.id,
  eventSlug: "rocafiesta-konfam",
  coverImageUrl: "/events/rocafiesta-poster.jpg",
  status: "draft",
  isFeatured: false,
  photoCount: 0,
  videoCount: 0,
  creatorCount: 0,
  attendeeCount: 0,
  createdAt: Timestamp.now(),
};

console.log("Adding ROCAFIESTA memories album...");
const albumRef = await db.collection("memoryAlbums").add(album);
console.log("Album created:", albumRef.id);

// Link album ID back to event
await db.collection("events").doc(eventRef.id).update({ memoryAlbumId: albumRef.id });
console.log("Event updated with memoryAlbumId:", albumRef.id);

console.log("\nDone. Event ID:", eventRef.id, "| Album ID:", albumRef.id);
process.exit(0);
