/**
 * add-founding-members.mjs
 *
 * One-time script: registers Francisca Kesse and Sarah Kanor as Founding 15 members
 * for the Sea Bears Courtside Launch event (cash payment, $255 CAD each).
 *
 * What this does per user:
 *   1. Gets or creates Firebase Auth account
 *   2. Sets custom claims { role: "member", status: "active" }
 *   3. Creates / updates users/{uid} Firestore doc
 *   4. Ensures event has isLaunchEvent: true
 *   5. Checks for duplicate eventPurchases (idempotent — safe to re-run)
 *   6. Creates ticketOrders/{orderId} and eventPurchases/{orderId}
 *   7. Writes adminAuditLog entry
 *   ✗ Does NOT touch ticketsRemaining (intentional)
 *
 * Run from functions/ directory (has firebase-admin installed):
 *   cd ~/all-access-platform/functions
 *   FIREBASE_SERVICE_ACCOUNT_KEY='<json>' node ../scripts/add-founding-members.mjs
 *
 * OR with web/.env.local present:
 *   cd ~/all-access-platform/functions
 *   node ../scripts/add-founding-members.mjs
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { randomBytes } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Credentials ───────────────────────────────────────────────────────────────

function loadServiceAccount() {
  // 1. Env var (Vercel / CI / manual export)
  const raw =
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY ??
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

  if (raw && raw.trim().startsWith("{")) {
    const cleaned = raw.trim().replace(/^['"]|['"]$/g, "");
    const parsed = JSON.parse(cleaned);
    if (typeof parsed.private_key === "string")
      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    return parsed;
  }

  // 2. web/.env.local
  const envPath = resolve(__dirname, "../web/.env.local");
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, "utf-8");
    const match = content.match(
      /(?:FIREBASE_SERVICE_ACCOUNT_KEY|GOOGLE_APPLICATION_CREDENTIALS_JSON)=(.+)/
    );
    if (match) {
      const val = match[1].trim().replace(/^['"]|['"]$/g, "");
      const parsed = JSON.parse(val);
      if (typeof parsed.private_key === "string")
        parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
      return parsed;
    }
  }

  throw new Error(
    "No Firebase credentials found.\n" +
    "Set FIREBASE_SERVICE_ACCOUNT_KEY env var or create web/.env.local with that key."
  );
}

if (!getApps().length) {
  initializeApp({ credential: cert(loadServiceAccount()) });
}
const db = getFirestore();
const auth = getAuth();

// ── Constants ─────────────────────────────────────────────────────────────────

const EVENT_ID    = "2PsGI8PCNoIdCudbR8Sh";
const EVENT_DATE  = "2026-06-30";
const AMOUNT_PAID = 255;
const QUANTITY    = 1;
const SOURCE      = "offline";
const PAY_METHOD  = "cash";

const USERS = [
  { email: "franciscakesse758@gmail.com", displayName: "Francisca Kesse" },
  { email: "thekaboujie@gmail.com",       displayName: "Sarah Kanor" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function orderId() {
  return `offline_${Date.now()}_${randomBytes(4).toString("hex")}`;
}

// ── Per-user processor ────────────────────────────────────────────────────────

async function processUser({ email, displayName }) {
  const line = "─".repeat(50);
  console.log(`\n${line}`);
  console.log(`  ${email}`);
  console.log(line);

  const now = new Date().toISOString();

  // ── Step 1: Auth user ──────────────────────────────────────────────────────
  let uid;
  let isNew = false;
  try {
    const u = await auth.getUserByEmail(email);
    uid = u.uid;
    console.log(`[auth]     found existing user  uid=${uid}`);
  } catch (err) {
    if (err.code !== "auth/user-not-found") throw err;
    const u = await auth.createUser({ email, displayName, emailVerified: false });
    uid = u.uid;
    isNew = true;
    console.log(`[auth]     created new user     uid=${uid}`);
  }

  // ── Step 2: Custom claims ─────────────────────────────────────────────────
  await auth.setCustomUserClaims(uid, { role: "member", status: "active" });
  console.log(`[claims]   set { role:"member", status:"active" }`);

  // ── Step 3: Firestore users/{uid} ─────────────────────────────────────────
  await db.collection("users").doc(uid).set(
    {
      email,
      displayName: displayName ?? null,
      role: "member",
      status: "active",
      ...(isNew ? { createdAt: now } : {}),
      updatedAt: now,
    },
    { merge: true }
  );
  console.log(`[users]    users/${uid} updated`);

  // ── Step 4: Ensure event has isLaunchEvent: true ──────────────────────────
  const eventSnap = await db.collection("events").doc(EVENT_ID).get();
  if (!eventSnap.exists) throw new Error(`Event ${EVENT_ID} not found in Firestore`);
  const eventData = eventSnap.data();
  console.log(`[event]    loaded: "${eventData.title}"`);

  if (!eventData.isLaunchEvent) {
    await db.collection("events").doc(EVENT_ID).update({
      isLaunchEvent: true,
      updatedAt: now,
    });
    console.log(`[event]    isLaunchEvent: true  — set on event document`);
  } else {
    console.log(`[event]    isLaunchEvent: true  — already set`);
  }

  // ── Step 5: Duplicate guard ───────────────────────────────────────────────
  // Check by userId first, then by email
  const byUid = await db
    .collection("eventPurchases")
    .where("userId", "==", uid)
    .where("eventId", "==", EVENT_ID)
    .where("status", "==", "confirmed")
    .limit(1)
    .get();

  if (!byUid.empty) {
    const docId = byUid.docs[0].id;
    console.log(`[skip]     eventPurchases already exists (by uid)  docId=${docId}`);
    return { uid, orderId: docId, skipped: true };
  }

  const byEmail = await db
    .collection("eventPurchases")
    .where("userEmail", "==", email)
    .where("eventId", "==", EVENT_ID)
    .where("status", "==", "confirmed")
    .limit(1)
    .get();

  if (!byEmail.empty) {
    const existing = byEmail.docs[0];
    console.log(`[skip]     eventPurchases already exists (by email) docId=${existing.id}`);
    // Backfill userId if it was missing
    if (!existing.data().userId) {
      await db.collection("eventPurchases").doc(existing.id).update({ userId: uid, updatedAt: now });
      console.log(`[fix]      backfilled userId on existing record`);
    }
    return { uid, orderId: existing.id, skipped: true };
  }

  // ── Step 6: Generate orderId ──────────────────────────────────────────────
  const oid = orderId();
  console.log(`[order]    generated orderId: ${oid}`);

  // NOTE: ticketsRemaining is intentionally NOT decremented here.
  // Inventory is managed separately by the admin for offline cash payments.

  // ── Step 7: ticketOrders/{orderId} ────────────────────────────────────────
  await db.collection("ticketOrders").doc(oid).set({
    orderId: oid,
    userId: uid,
    userEmail: email,
    eventId: EVENT_ID,
    eventTitle: eventData.title,
    quantity: QUANTITY,
    unitPrice: AMOUNT_PAID,
    unitPriceCents: AMOUNT_PAID * 100,
    totalPrice: AMOUNT_PAID,
    totalPriceCents: AMOUNT_PAID * 100,
    isMemberPrice: false,
    memberDiscountPct: 0,
    savingsTotal: 0,
    paymentStatus: "paid",
    paymentMethod: PAY_METHOD,
    source: SOURCE,
    stripeCheckoutSessionId: null,
    stripePaymentIntentId: null,
    paidAt: now,
    createdAt: now,
    updatedAt: now,
  });
  console.log(`[orders]   ticketOrders/${oid} created`);

  // ── Step 8: eventPurchases/{orderId} ──────────────────────────────────────
  await db.collection("eventPurchases").doc(oid).set({
    orderId: oid,
    userId: uid,
    userEmail: email,
    eventId: EVENT_ID,
    eventTitle: eventData.title ?? "ALL ACCESS Founding 15 — Sea Bears Courtside Launch",
    eventDate: EVENT_DATE,
    eventLocation: eventData.location ?? "",
    isFoundingMember: true,
    quantity: QUANTITY,
    totalPrice: AMOUNT_PAID,
    totalPriceCents: AMOUNT_PAID * 100,
    status: "confirmed",
    purchasedAt: now,
    stripeSessionId: null,
    stripePaymentIntentId: null,
    paymentMethod: PAY_METHOD,
    source: SOURCE,
  });
  console.log(`[purchases] eventPurchases/${oid} created`);

  // ── Step 9: adminAuditLog ─────────────────────────────────────────────────
  await db.collection("adminAuditLog").add({
    action: "add_offline_attendee",
    eventId: EVENT_ID,
    eventTitle: eventData.title,
    userId: uid,
    userEmail: email,
    displayName: displayName ?? null,
    orderId: oid,
    quantity: QUANTITY,
    amountPaid: AMOUNT_PAID,
    paymentMethod: PAY_METHOD,
    source: SOURCE,
    addedBy: "admin_script:add-founding-members",
    addedAt: now,
  });
  console.log(`[audit]    adminAuditLog entry written`);

  return { uid, orderId: oid, skipped: false };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("ALL ACCESS — Founding 15 Member Registration");
  console.log("=============================================");
  console.log(`Event ID:  ${EVENT_ID}`);
  console.log(`Users:     ${USERS.map((u) => u.email).join(", ")}`);
  console.log(`Amount:    $${AMOUNT_PAID} CAD cash each`);
  console.log(`Tickets:   ${QUANTITY} each\n`);

  const results = [];

  for (const user of USERS) {
    try {
      const r = await processUser(user);
      results.push({ ...user, ...r, success: true });
    } catch (err) {
      console.error(`\n[ERROR] ${user.email}:`, err.message);
      results.push({ ...user, success: false, error: err.message });
    }
  }

  console.log("\n\n═══════════════════ SUMMARY ═══════════════════");
  for (const r of results) {
    if (r.success) {
      const tag = r.skipped ? "already existed — no changes" : "✓ created";
      console.log(`  ${r.email}`);
      console.log(`    uid:     ${r.uid}`);
      console.log(`    orderId: ${r.orderId}  [${tag}]`);
    } else {
      console.log(`  ✗ ${r.email} — ${r.error}`);
    }
  }
  console.log("═══════════════════════════════════════════════\n");

  const failed = results.filter((r) => !r.success);
  if (failed.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error("\nFatal:", err);
  process.exit(1);
});
