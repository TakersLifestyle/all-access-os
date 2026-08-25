/**
 * activate-dj-lankz.mjs
 * Activates DJ LANKZ with full member access — custom claims + Firestore sync.
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const envContent = readFileSync("C:\\Users\\TakersLifestyle\\all-access-platform\\web\\.env.local", "utf8");
const saLine = envContent.split("\n").find(l => l.startsWith("GOOGLE_APPLICATION_CREDENTIALS_JSON="));
const serviceAccount = JSON.parse(saLine.replace("GOOGLE_APPLICATION_CREDENTIALS_JSON=", "").trim());

initializeApp({ credential: cert(serviceAccount) });
const auth = getAuth();
const db = getFirestore();

const EMAIL = "iconicdJlankz@gmail.com";

// Look up user by email
const user = await auth.getUserByEmail(EMAIL);
console.log(`\n👤 Found user: ${user.displayName || user.email} (${user.uid})`);
console.log(`   Current claims: ${JSON.stringify(user.customClaims || {})}`);

// Set full member claims
await auth.setCustomUserClaims(user.uid, {
  role: "member",
  status: "active",
});
console.log(`\n✅ Custom claims set: { role: "member", status: "active" }`);

// Sync Firestore user doc
await db.collection("users").doc(user.uid).set({
  email: user.email,
  displayName: user.displayName || "DJ LANKZ",
  role: "member",
  status: "active",
  activatedAt: FieldValue.serverTimestamp(),
  updatedAt: FieldValue.serverTimestamp(),
}, { merge: true });

console.log(`✅ Firestore user doc updated`);
console.log(`\n🎉 DJ LANKZ is now an active member with full access.`);
process.exit(0);
