/**
 * Audit existing $25/mo subscribers and founding members before any membership changes.
 * Read-only — makes zero writes to Stripe or Firebase.
 *
 * Run: node --env-file="../web/.env.local" ../functions/audit-existing-subscribers.mjs
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import Stripe from "stripe";

const serviceAccount = JSON.parse(
  process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ||
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY || "{}"
);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
const auth = getAuth();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const isLive = (process.env.STRIPE_SECRET_KEY || "").startsWith("sk_live");
console.log(`Stripe key mode: ${isLive ? "LIVE ✅" : "TEST ⚠️"}\n`);

// ── 1. Firestore: users with active subscription status ─────────────────────
console.log("══════════════════════════════════════════════");
console.log("1. FIRESTORE — Active subscriber users");
console.log("══════════════════════════════════════════════");
const activeSnap = await db.collection("users")
  .where("status", "==", "active")
  .get();

console.log(`Total users with status=active: ${activeSnap.docs.length}\n`);
for (const doc of activeSnap.docs) {
  const d = doc.data();
  console.log(`  uid: ${doc.id}`);
  console.log(`    email:        ${d.email ?? "(none stored)"}`);
  console.log(`    accountType:  ${d.accountType ?? "(none)"}`);
  console.log(`    role:         ${d.role ?? "(none)"}`);
  console.log(`    stripeSubId:  ${d.stripeSubscriptionId ?? "(none)"}`);
  console.log(`    stripeCustomer: ${d.stripeCustomerId ?? "(none)"}`);
  console.log(`    hasCommunityAccess: ${d.hasCommunityAccess ?? false}`);
  console.log("");
}

// ── 2. Firestore: users flagged as Founding Members ────────────────────────
console.log("══════════════════════════════════════════════");
console.log("2. FIRESTORE — Founding Members");
console.log("══════════════════════════════════════════════");
const foundingSnap = await db.collection("users")
  .where("isFoundingMember", "==", true)
  .get();
console.log(`Users with isFoundingMember=true: ${foundingSnap.docs.length}`);
for (const doc of foundingSnap.docs) {
  const d = doc.data();
  console.log(`  uid: ${doc.id} | accountType: ${d.accountType ?? "(none)"} | status: ${d.status ?? "(none)"}`);
}

// Also check eventPurchases for founding member flag
const epFoundingSnap = await db.collection("eventPurchases")
  .where("isFoundingMember", "==", true)
  .get();
console.log(`\nEventPurchases with isFoundingMember=true: ${epFoundingSnap.docs.length}`);
for (const doc of epFoundingSnap.docs) {
  const d = doc.data();
  console.log(`  orderId: ${doc.id} | userId: ${d.userId ?? "(guest)"} | email: ${d.userEmail ?? "(none)"} | event: ${d.eventTitle ?? "(unknown)"}`);
}

// ── 3. Stripe: active subscriptions ────────────────────────────────────────
console.log("\n══════════════════════════════════════════════");
console.log("3. STRIPE — Active subscriptions");
console.log("══════════════════════════════════════════════");
const subs = await stripe.subscriptions.list({ status: "active", limit: 100 });
console.log(`Active Stripe subscriptions: ${subs.data.length}\n`);
for (const sub of subs.data) {
  const item = sub.items.data[0];
  const amount = item?.price?.unit_amount ?? 0;
  const interval = item?.price?.recurring?.interval ?? "?";
  console.log(`  sub: ${sub.id}`);
  console.log(`    customer:  ${sub.customer}`);
  console.log(`    amount:    $${(amount / 100).toFixed(2)} CAD/${interval}`);
  console.log(`    status:    ${sub.status}`);
  console.log(`    tier meta: ${sub.metadata?.tier ?? "(none)"}`);
  console.log(`    cancelAtPeriodEnd: ${sub.cancel_at_period_end}`);
  console.log("");
}

// ── 4. Stripe: past_due subscriptions ──────────────────────────────────────
const pastDueSubs = await stripe.subscriptions.list({ status: "past_due", limit: 100 });
console.log(`Past-due Stripe subscriptions: ${pastDueSubs.data.length}`);
for (const sub of pastDueSubs.data) {
  const item = sub.items.data[0];
  const amount = item?.price?.unit_amount ?? 0;
  console.log(`  sub: ${sub.id} | customer: ${sub.customer} | $${(amount / 100).toFixed(2)}/mo`);
}

// ── 5. Custom claims spot-check ─────────────────────────────────────────────
console.log("\n══════════════════════════════════════════════");
console.log("4. FIREBASE AUTH — Claims for active users");
console.log("══════════════════════════════════════════════");
for (const doc of activeSnap.docs) {
  try {
    const userRecord = await auth.getUser(doc.id);
    const claims = userRecord.customClaims ?? {};
    console.log(`  uid: ${doc.id}`);
    console.log(`    claims: ${JSON.stringify(claims)}`);
  } catch (e) {
    console.log(`  uid: ${doc.id} — auth lookup failed: ${e.message}`);
  }
}

console.log("\n══════════════════════════════════════════════");
console.log("AUDIT COMPLETE — zero writes made");
console.log("══════════════════════════════════════════════");
process.exit(0);
