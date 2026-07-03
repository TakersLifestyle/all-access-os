/**
 * One-time migration — assigns accountType to all existing users based on their
 * current subscription status and event purchase history.
 *
 * Run from the functions/ directory:
 *   cd ~/all-access-platform/functions
 *   node ../scripts/migrate-account-types.mjs
 *
 * Result:
 *   - Active subscribers (status == "active") → accountType = "supporter"
 *   - Event purchasers (eventPurchases confirmed) → accountType = "community" (if not supporter)
 *   - All above also get hasCommunityAccess = true
 *   - Founding Members (isLaunchEvent == true purchases) already covered by event purchaser path
 *
 * Safe to re-run — all operations are idempotent.
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { resolve } from "path";

// ── Init ──────────────────────────────────────────────────────────────────────
const serviceAccountPath = resolve("../web/.env.local");
let serviceAccount;
try {
  const envContent = readFileSync(serviceAccountPath, "utf8");
  const match = envContent.match(/FIREBASE_SERVICE_ACCOUNT_KEY=(.+)/);
  if (!match) throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY not found in .env.local");
  serviceAccount = JSON.parse(match[1]);
} catch (err) {
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

// ── Helpers ───────────────────────────────────────────────────────────────────
async function grantAccess(uid, accountType, reason) {
  try {
    const userRecord = await auth.getUser(uid);
    const existing = (userRecord.customClaims ?? {});
    // Never downgrade: supporter stays supporter
    const finalType = existing.accountType === "supporter" ? "supporter" : accountType;

    await auth.setCustomUserClaims(uid, {
      ...existing,
      hasCommunityAccess: true,
      accountType: finalType,
    });
    await db.collection("users").doc(uid).set(
      { hasCommunityAccess: true, accountType: finalType, updatedAt: new Date().toISOString() },
      { merge: true }
    );
    return { uid, email: userRecord.email, finalType, reason };
  } catch (err) {
    return { uid, error: err.code === "auth/user-not-found" ? "user-not-found" : err.message };
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const results = { supporter: 0, community: 0, skipped: 0, failed: 0 };

  console.log("=== Phase 1: Active subscribers → Supporting Member ===\n");

  const usersSnap = await db
    .collection("users")
    .where("status", "==", "active")
    .get();

  console.log(`Found ${usersSnap.size} users with status=active`);
  for (const d of usersSnap.docs) {
    const r = await grantAccess(d.id, "supporter", "active-subscription");
    if (r.error) {
      console.log(`  [error] ${d.id} — ${r.error}`);
      results.failed++;
    } else {
      console.log(`  [supporter] ${r.email ?? d.id} (${r.reason})`);
      results.supporter++;
    }
  }

  console.log(`\n=== Phase 2: Event purchasers → Community Member ===\n`);

  const purchasesSnap = await db.collection("eventPurchases").get();
  console.log(`Found ${purchasesSnap.size} eventPurchase records`);

  const uidSet = new Set();
  const emailsNoUid = [];
  for (const d of purchasesSnap.docs) {
    const data = d.data();
    if (data.status !== "confirmed") continue;
    if (data.userId) uidSet.add(data.userId);
    else if (data.userEmail) emailsNoUid.push(data.userEmail);
  }

  console.log(`Unique userIds: ${uidSet.size}`);
  for (const uid of uidSet) {
    // Check if already handled as supporter in Phase 1
    try {
      const rec = await auth.getUser(uid);
      if ((rec.customClaims)?.accountType === "supporter") {
        console.log(`  [skip] ${uid} — already supporter`);
        results.skipped++;
        continue;
      }
    } catch { /* proceed */ }

    const r = await grantAccess(uid, "community", "event-purchase");
    if (r.error) {
      console.log(`  [error] ${uid} — ${r.error}`);
      results.failed++;
    } else {
      console.log(`  [community] ${r.email ?? uid} (${r.reason})`);
      results.community++;
    }
  }

  if (emailsNoUid.length > 0) {
    console.log(`\n⚠  ${emailsNoUid.length} purchase(s) have no userId — resolve manually:`);
    emailsNoUid.forEach(e => console.log(`   - ${e}`));
  }

  console.log("\n=== Migration Complete ===");
  console.log(`  → Supporting Member: ${results.supporter}`);
  console.log(`  → Community Member:  ${results.community}`);
  console.log(`  → Skipped:           ${results.skipped}`);
  console.log(`  → Failed:            ${results.failed}`);
  process.exit(results.failed > 0 ? 1 : 0);
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
