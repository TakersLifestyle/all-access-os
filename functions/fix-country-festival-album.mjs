/**
 * Fix TACOS & TEQUILA FESTIVAL album — correct title + date
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const serviceAccount = JSON.parse(
  process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ||
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
  "{}"
);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

await db.collection("memoryAlbums").doc("jjpYTmkzf1pz0ngILMS4").update({
  title: "TACOS & TEQUILA FESTIVAL",
  eventDate: "2026-08-22",
  description:
    "ALL ACCESS was on the ground at Tacos & Tequila Festival — a full day-to-night outdoor experience at Blue Cross Park hosted by Social House Entertainment. We covered the whole run on a media pass. Winnipeg showed out.",
});

console.log("✅ Album updated: TACOS & TEQUILA FESTIVAL · Aug 22 2026");
process.exit(0);
