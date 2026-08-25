/**
 * Create "NIGHT OUT WITH RBN" Community Moments album
 * RBN opening for Jamaican dancehall artist Nhance — Romantic Monsta Canada Tour
 * Winnipeg stop, August 2026
 *
 * Run from functions/ folder:
 *   node ../functions/create-rbn-nhance-album.mjs
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
  process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ||
  "{}"
);

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const album = {
  title: "NIGHT OUT WITH RBN",
  eventDate: "2026-08-22",
  location: "Winnipeg, MB",
  category: "Nightlife",
  description:
    "A massive night as Winnipeg's own RBN took the stage opening for Jamaican dancehall artist Nhance on his Romantic Monsta Canada Tour. Real community energy in the building — Winnipeg showed out.",
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
console.log(`   Status: draft — upload cover + photos, then publish`);
console.log(`   Admin URL: https://allaccesswinnipeg.ca/admin/memories`);
console.log(`   Public URL: https://allaccesswinnipeg.ca/memories/${ref.id}`);
process.exit(0);
