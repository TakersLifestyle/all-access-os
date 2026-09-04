/**
 * Audit and repair Firebase Auth custom claims for all active members.
 * Run from: cd functions && node fix-member-claims.mjs
 *
 * Finds every Firestore user with status=active and sets:
 *   { role: "member", status: "active" }
 * on their Firebase Auth token if not already correct.
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

async function main() {
  // Get all Firestore user docs with active status
  const snap = await db.collection("users")
    .where("status", "==", "active")
    .get();

  console.log(`Found ${snap.size} users with status=active in Firestore.\n`);

  let fixed = 0, alreadyOk = 0, notFound = 0, errors = 0;

  for (const doc of snap.docs) {
    const uid = doc.id;
    const data = doc.data();
    const email = data.email ?? "(no email)";

    let authUser;
    try {
      authUser = await auth.getUser(uid);
    } catch {
      console.log(`  ✗ Auth user not found: ${uid} (${email})`);
      notFound++;
      continue;
    }

    const claims = authUser.customClaims ?? {};
    const currentRole = claims.role;
    const currentStatus = claims.status;

    // Never overwrite admin role
    if (currentRole === "admin") {
      // Ensure status is active but keep admin role
      if (currentStatus === "active") { alreadyOk++; continue; }
      await auth.setCustomUserClaims(uid, { ...claims, status: "active" });
      console.log(`  ✓ Admin status fixed (role preserved): ${email}`);
      fixed++;
      continue;
    }

    // If claims already correct, skip
    if (currentRole === "member" && currentStatus === "active") {
      alreadyOk++;
      continue;
    }

    // Fix the claims
    try {
      await auth.setCustomUserClaims(uid, {
        ...claims,
        role: "member",
        status: "active",
      });
      console.log(`  ✓ Fixed: ${email} (uid: ${uid})`);
      console.log(`    Before: role=${currentRole ?? "none"} status=${currentStatus ?? "none"}`);
      console.log(`    After:  role=member status=active`);
      fixed++;
    } catch (err) {
      console.error(`  ✗ Error setting claims for ${email}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n── Summary ──────────────────────`);
  console.log(`  Already correct: ${alreadyOk}`);
  console.log(`  Fixed:           ${fixed}`);
  console.log(`  Auth not found:  ${notFound}`);
  console.log(`  Errors:          ${errors}`);
  console.log(`  Total:           ${snap.size}`);

  // Also check the specific user mentioned
  console.log(`\n── Checking chrisbryant433@gmail.com specifically ──`);
  try {
    const targetUser = await auth.getUserByEmail("chrisbryant433@gmail.com");
    const c = targetUser.customClaims ?? {};
    console.log(`  UID: ${targetUser.uid}`);
    console.log(`  Claims: role=${c.role ?? "none"} status=${c.status ?? "none"}`);
    if (c.role !== "member" || c.status !== "active") {
      await auth.setCustomUserClaims(targetUser.uid, { ...c, role: "member", status: "active" });
      // Also update Firestore
      await db.collection("users").doc(targetUser.uid).set(
        { role: "member", status: "active" },
        { merge: true }
      );
      console.log(`  ✓ Claims fixed for chrisbryant433@gmail.com`);
    } else {
      console.log(`  ✓ Claims already correct.`);
    }
  } catch (err) {
    console.log(`  ✗ Could not find chrisbryant433@gmail.com: ${err.message}`);
  }

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
