/**
 * update-dj-lankz-earlybird.mjs
 * Enables Early Bird $25 checkout for DJ LANKZ & FRIENDS event.
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const envContent = readFileSync("C:\\Users\\TakersLifestyle\\all-access-platform\\web\\.env.local", "utf8");
const saLine = envContent.split("\n").find(l => l.startsWith("GOOGLE_APPLICATION_CREDENTIALS_JSON="));
const serviceAccount = JSON.parse(saLine.replace("GOOGLE_APPLICATION_CREDENTIALS_JSON=", "").trim());

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// Find the event by slug
const snap = await db.collection("events").where("slug", "==", "dj-lankz-and-friends-skales-winnipeg").get();
if (snap.empty) { console.error("❌ Event not found"); process.exit(1); }

const docId = snap.docs[0].id;

await db.collection("events").doc(docId).update({
  generalPrice: 25,
  memberPrice: 25,        // same price — no member discount on Early Bird
  noMemberDiscount: true, // flat $25 for everyone
  checkoutEnabled: true,
  status: "active",
  ticketTiers: {
    earlybird: {
      name: "Early Bird",
      price: 25,
      description: "Limited quantity — lock in the lowest price.",
      soldOut: false,
    },
  },
  updatedAt: FieldValue.serverTimestamp(),
});

console.log(`✅ DJ LANKZ event updated:`);
console.log(`   generalPrice: $25`);
console.log(`   Early Bird tier: $25 (limited qty)`);
console.log(`   checkoutEnabled: true`);
console.log(`   Doc ID: ${docId}`);
process.exit(0);
