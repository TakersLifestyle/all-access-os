/**
 * Create "COUNTRY RISING FESTIVAL" Community Moments album
 * Social House Entertainment — Blue Cross Park, Winnipeg
 * Headlined by BigXthaPlug. ALL ACCESS covered on media pass — August 21, 2026.
 *
 * Run from functions/ folder:
 *   node --env-file=.env.local ../functions/create-country-festival-album.mjs
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const serviceAccount = JSON.parse(
  process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ||
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
  "{}"
);

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const album = {
  title: "COUNTRY RISING FESTIVAL",
  eventDate: "2026-08-21",
  location: "Blue Cross Park · Winnipeg, MB",
  category: "Community Spotlight",
  description:
    "ALL ACCESS was on the ground at Country Rising Festival — Social House Entertainment's one-day outdoor experience at Blue Cross Park. Headlined by BigXthaPlug with Dylan Monroe and Redferrin on the bill. We covered the whole day-to-night run on a media pass. Winnipeg showed out.",
  coverImageUrl: "",
  status: "draft",
  photoCount: 0,
  videoCount: 0,
  creatorCount: 0,
  attendeeCount: 0,
  isFeatured: false,
  createdAt: FieldValue.serverTimestamp(),
};

const ref = await db.collection("memoryAlbums").add(album);
console.log(`✅ Album created: ${ref.id}`);
console.log(`   Title: ${album.title}`);
console.log(`   Date:  ${album.eventDate}`);
console.log(`   Venue: ${album.location}`);
console.log(`   Status: draft — upload photos from Downloads/SOCIAL HOUSE ENT, then publish`);
console.log(`   Admin URL: https://allaccesswinnipeg.ca/admin/memories`);
process.exit(0);
