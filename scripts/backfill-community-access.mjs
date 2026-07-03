/**
 * Backfill hasCommunityAccess = true for all existing event ticket purchasers.
 *
 * Run from the functions/ directory (has firebase-admin installed):
 *   cd ~/all-access-platform/functions
 *   node ../scripts/backfill-community-access.mjs
 *
 * Covers: Stripe purchases, admin-manual (cash/etransfer), all sources.
 * Safe to re-run — setCustomUserClaims is idempotent.
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { resolve } from "path";

// ── Init ──────────────────────────────────────────────────────────────────────
const serviceAccountPath = resolve("../web/.env.local");

// Parse FIREBASE_SERVICE_ACCOUNT_KEY from .env.local
let serviceAccount;
try {
  const envContent = readFileSync(serviceAccountPath, "utf8");
  const match = envContent.match(/FIREBASE_SERVICE_ACCOUNT_KEY=(.+)/);
  if (!match) throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY not found in .env.local");
  serviceAccount = JSON.parse(match[1]);
} catch (err) {
  // Fallback: try reading as JSON directly if passed via env var
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  } else {
    console.error("Could not load service account:", err.message);
    process.exit(1);
  }
}

initializeApp({ credential: cert(serviceAccount) });
const auth = getAuth();
const db = getFirestore();

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("Starting hasCommunityAccess backfill...\n");

  const snap = await db.collection("eventPurchases").get();
  console.log(`Found ${snap.size} eventPurchase records`);

  // Collect unique userIds (skip nulls)
  const userIdSet = new Set();
  const emailsWithNoUid = [];

  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.userId) {
      userIdSet.add(data.userId);
    } else if (data.userEmail) {
      emailsWithNoUid.push(data.userEmail);
    }
  }

  console.log(`Unique userIds to process: ${userIdSet.size}`);
  if (emailsWithNoUid.length > 0) {
    console.log(`\nPurchases with no userId (email only — manual claim needed):`);
    emailsWithNoUid.forEach(e => console.log(`  - ${e}`));
  }

  let granted = 0;
  let skipped = 0;
  let failed = 0;

  for (const uid of userIdSet) {
    try {
      const userRecord = await auth.getUser(uid);
      const existingClaims = (userRecord.customClaims ?? {});

      if (existingClaims.hasCommunityAccess === true) {
        console.log(`  [skip] ${uid} — already has hasCommunityAccess`);
        skipped++;
        continue;
      }

      const isAlreadySupporter =
        existingClaims.accountType === "supporter" || existingClaims.status === "active";
      const newAccountType = isAlreadySupporter ? "supporter" : "community";

      await auth.setCustomUserClaims(uid, {
        ...existingClaims,
        hasCommunityAccess: true,
        accountType: newAccountType,
      });

      await db.collection("users").doc(uid).set(
        { hasCommunityAccess: true, accountType: newAccountType, updatedAt: new Date().toISOString() },
        { merge: true }
      );

      console.log(`  [granted] ${uid} (${userRecord.email ?? "no email"}) → accountType=${newAccountType}`);
      granted++;
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        console.log(`  [missing] ${uid} — Firebase Auth user not found, skipping`);
        skipped++;
      } else {
        console.error(`  [error] ${uid} — ${err.message}`);
        failed++;
      }
    }
  }

  console.log(`\n── Backfill complete ──`);
  console.log(`  Granted: ${granted}`);
  console.log(`  Skipped (already had access or user not found): ${skipped}`);
  console.log(`  Failed: ${failed}`);

  if (emailsWithNoUid.length > 0) {
    console.log(`\n⚠  ${emailsWithNoUid.length} purchase(s) have no userId — look up these emails in Firebase Auth`);
    console.log(`   and run: auth.setCustomUserClaims(uid, { ...existing, hasCommunityAccess: true })`);
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
