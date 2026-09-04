/**
 * Syncs Firestore isFoundingMember + accountType into Firebase Auth custom claims.
 * Without this, server-side premium-memories gate rejects founding members
 * because it only reads JWT claims, not Firestore.
 *
 * Also sets accountType: "supporter" for any user with an active Stripe subscription.
 *
 * Run from: cd functions && node fix-founding-claims.mjs
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
  const snap = await db.collection("users").get();
  console.log(`Scanning ${snap.size} total user docs...\n`);

  let fixed = 0, skipped = 0, errors = 0;

  for (const docSnap of snap.docs) {
    const uid = docSnap.id;
    const data = docSnap.data();
    const email = data.email ?? "(no email)";

    // Only process active users
    if (data.status !== "active") continue;

    let authUser;
    try {
      authUser = await auth.getUser(uid);
    } catch {
      continue; // auth user doesn't exist, skip
    }

    const existingClaims = authUser.customClaims ?? {};

    // Never downgrade admin
    if (existingClaims.role === "admin") {
      skipped++;
      continue;
    }

    // Determine what the claims SHOULD be
    const isFoundingMember = !!data.isFoundingMember;
    // Supporter = has active Stripe subscription OR is explicitly marked as supporter
    const isSupporter =
      data.accountType === "supporter" ||
      data.membershipTier === "founding_member" ||
      (data.stripeSubscriptionId && data.stripeStatus === "active");

    const wantedAccountType = isSupporter ? "supporter" : (data.accountType ?? "community");

    const newClaims = {
      ...existingClaims,
      role: "member",
      status: "active",
      accountType: wantedAccountType,
      ...(isFoundingMember ? { isFoundingMember: true } : {}),
    };

    // Check if anything changed
    const changed =
      existingClaims.accountType !== newClaims.accountType ||
      existingClaims.isFoundingMember !== newClaims.isFoundingMember;

    if (!changed) {
      skipped++;
      continue;
    }

    try {
      await auth.setCustomUserClaims(uid, newClaims);
      console.log(`✓ ${email}`);
      console.log(`  accountType: ${existingClaims.accountType ?? "none"} → ${newClaims.accountType}`);
      if (isFoundingMember) console.log(`  isFoundingMember: true (added to claims)`);
      fixed++;
    } catch (err) {
      console.error(`✗ ${email}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n── Summary ─────────────────────────`);
  console.log(`  Fixed:   ${fixed}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Errors:  ${errors}`);

  // Verify Chris specifically
  console.log(`\n── chrisbryant433@gmail.com final state ──`);
  const chris = await auth.getUserByEmail("chrisbryant433@gmail.com");
  console.log(`  Claims: ${JSON.stringify(chris.customClaims)}`);

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
