import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { readFileSync } from "fs";

const env = readFileSync("../web/.env.local", "utf8").split("\n");
const line = env.find(l => l.startsWith("GOOGLE_APPLICATION_CREDENTIALS_JSON="));
const raw = line.slice("GOOGLE_APPLICATION_CREDENTIALS_JSON=".length).trim();
initializeApp({ credential: cert(JSON.parse(raw)) });
const auth = getAuth();
const db = getFirestore();

// Restore admin account — was overwritten to role:member by the audit script
const adminEmail = "tharealprincecharles@gmail.com";
const adminUser = await auth.getUserByEmail(adminEmail);

await auth.setCustomUserClaims(adminUser.uid, { role: "admin", status: "active" });
await db.collection("users").doc(adminUser.uid).set(
  { role: "admin", status: "active" },
  { merge: true }
);

const verify = await auth.getUser(adminUser.uid);
console.log(`✓ Admin restored: ${adminEmail}`);
console.log(`  Claims: role=${verify.customClaims?.role} status=${verify.customClaims?.status}`);
process.exit(0);
