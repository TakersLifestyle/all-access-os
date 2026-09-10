import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const env = readFileSync("../web/.env.local", "utf8").split("\n");
const getEnv = k => env.find(l => l.startsWith(k + "="))?.slice(k.length + 1).trim();
initializeApp({ credential: cert(JSON.parse(getEnv("GOOGLE_APPLICATION_CREDENTIALS_JSON"))) });
const db = getFirestore();

// Position image so Skales' face + sunglasses are centered in the card
await db.collection("events").doc("EQIimnVZ5jPhVKPLyAJ2").update({
  imageObjectPosition: "center 35%",
});
console.log("✓ DJ LANKZ event imageObjectPosition → center 35%");
process.exit(0);
