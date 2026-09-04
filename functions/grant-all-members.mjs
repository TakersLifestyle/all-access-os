/**
 * Grants all active members full premium Memories access immediately.
 * Sets isFoundingMember: true + accountType: "supporter" in BOTH
 * Firestore (takes effect on next page load) AND custom claims
 * (takes effect on next token refresh).
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { readFileSync } from "fs";

const env = readFileSync("../web/.env.local", "utf8").split("\n");
const line = env.find(l => l.startsWith("GOOGLE_APPLICATION_CREDENTIALS_JSON="));
const raw = line.slice("GOOGLE_APPLICATION_CREDENTIALS_JSON=".length).trim();
initializeApp({ credential: cert(JSON.parse(raw)) });
const db = getFirestore();
const auth = getAuth();

const snap = await db.collection("users").where("status", "==", "active").get();
console.log(`Granting full access to ${snap.size} active members...\n`);

let done = 0;
for (const docSnap of snap.docs) {
  const uid = docSnap.id;
  const data = docSnap.data();
  const email = data.email ?? uid;

  // Skip admin — never downgrade
  if (data.role === "admin") { console.log(`  skip (admin): ${email}`); continue; }

  // 1. Firestore — takes effect on next page load immediately
  await db.collection("users").doc(uid).set({
    isFoundingMember: true,
    accountType: "supporter",
    membershipTier: "founding_member",
  }, { merge: true });

  // 2. Claims — takes effect on next token refresh
  try {
    const authUser = await auth.getUser(uid);
    const existing = authUser.customClaims ?? {};
    await auth.setCustomUserClaims(uid, {
      ...existing,
      role: "member",
      status: "active",
      accountType: "supporter",
      isFoundingMember: true,
    });
  } catch { /* auth user may not exist yet */ }

  console.log(`  ✓ ${email}`);
  done++;
}

console.log(`\n✓ ${done} members granted full access.`);
console.log(`  Firestore: effective immediately on next page load.`);
console.log(`  Claims:    effective on next sign-in / token refresh.`);
process.exit(0);
