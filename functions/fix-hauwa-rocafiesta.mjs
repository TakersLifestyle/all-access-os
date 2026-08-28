/**
 * 1. Send ROCAFIESTA confirmation email to Hauwa Akinkunmi (Ticket #5)
 * 2. Audit ALL ticketOrders for DJ LANKZ + ROCAFIESTA — find any missing confirmation emails
 * 3. Send to any buyer who didn't receive one
 *
 * Run: node --env-file=.env.local --env-file=../web/.env.local ../functions/fix-hauwa-rocafiesta.mjs
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const serviceAccount = JSON.parse(
  process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ||
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY || "{}"
);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const RESEND_API_KEY   = process.env.RESEND_API_KEY;
const SKALES_EVENT_ID  = "EQIimnVZ5jPhVKPLyAJ2";

// ── find ROCAFIESTA event ID dynamically ───────────────────────────────────────
console.log("Looking up ROCAFIESTA event in Firestore…");
const eventsSnap = await db.collection("events")
  .where("slug", "==", "rocafiesta-konfam")
  .get();
let ROCA_EVENT_ID = null;
if (!eventsSnap.empty) {
  ROCA_EVENT_ID = eventsSnap.docs[0].id;
  console.log(`  ROCAFIESTA event ID: ${ROCA_EVENT_ID}`);
} else {
  // fallback: search by title keyword
  const all = await db.collection("events").get();
  for (const d of all.docs) {
    if ((d.data().title || "").toLowerCase().includes("rocafiesta")) {
      ROCA_EVENT_ID = d.id;
      console.log(`  ROCAFIESTA event ID (by title): ${ROCA_EVENT_ID}`);
      break;
    }
  }
}
if (!ROCA_EVENT_ID) {
  console.log("  ⚠️  Could not find ROCAFIESTA event — will still send Hauwa's email manually.");
}

// ── email builder ──────────────────────────────────────────────────────────────
async function sendEmail({ to, subject, html }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "ALL ACCESS <hello@allaccesswinnipeg.ca>", to, subject, html }),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(result));
  return result.id;
}

function buildRocaEmail(ticketNum, qty = 1) {
  const lines = Array.from({ length: qty }, (_, i) =>
    `<li style="margin-bottom:6px">🎟 Ticket #${ticketNum + i} — General Admission</li>`
  ).join("\n");
  return `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#050505;color:#fff;padding:32px;border-radius:12px;border:1px solid rgba(245,158,11,0.2)">
  <h1 style="color:#f59e0b;font-size:26px;margin-bottom:4px">You're in. 🎟</h1>
  <p style="color:#aaa;margin-top:0">Ticket confirmation for <strong style="color:#fff">ROCAFIESTA — A Spiritual Experience with Konfam</strong></p>
  <div style="background:#111;border:1px solid rgba(245,158,11,0.2);border-radius:8px;padding:20px;margin:24px 0">
    <p style="margin:0 0 8px"><strong>Event:</strong> ROCAFIESTA — A Spiritual Experience with Konfam</p>
    <p style="margin:0 0 8px"><strong>Date:</strong> Saturday, September 5, 2026</p>
    <p style="margin:0 0 8px"><strong>Doors:</strong> 5:00 PM</p>
    <p style="margin:0 0 8px"><strong>Venue:</strong> Pyramid Cabaret · 176 Fort St, Winnipeg MB</p>
    <p style="margin:0 0 8px"><strong>Tickets (${qty}):</strong></p>
    <ul style="color:#f59e0b;margin:8px 0 0 0;padding-left:18px">${lines}</ul>
  </div>
  <p style="color:#888;font-size:13px">Show this email at the door. Doors open at 5 PM.</p>
  <p style="color:#888;font-size:13px">Questions? <a href="mailto:hello@allaccesswinnipeg.ca" style="color:#f59e0b">hello@allaccesswinnipeg.ca</a></p>
  <hr style="border:none;border-top:1px solid rgba(245,158,11,0.15);margin:24px 0">
  <p style="color:#444;font-size:12px;text-align:center">ALL ACCESS Winnipeg · allaccesswinnipeg.ca</p>
</div>`;
}

function buildSkalesEmail(ticketNum, qty = 1) {
  const lines = Array.from({ length: qty }, (_, i) =>
    `<li style="margin-bottom:6px">🎟 Ticket #${ticketNum + i} — General Admission · Oct 9, 2026</li>`
  ).join("\n");
  return `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#000;color:#fff;padding:32px;border-radius:12px">
  <h1 style="color:#84cc16;font-size:26px;margin-bottom:4px">You're in. 🎟</h1>
  <p style="color:#aaa;margin-top:0">Ticket confirmation for <strong style="color:#fff">DJ LANKZ &amp; FRIENDS ft. SKALES</strong></p>
  <div style="background:#111;border:1px solid #222;border-radius:8px;padding:20px;margin:24px 0">
    <p style="margin:0 0 8px"><strong>Event:</strong> DJ LANKZ &amp; FRIENDS ft. SKALES LIVE IN WINNIPEG</p>
    <p style="margin:0 0 8px"><strong>Date:</strong> Friday, October 9, 2026</p>
    <p style="margin:0 0 8px"><strong>Doors:</strong> 10:00 PM</p>
    <p style="margin:0 0 8px"><strong>Venue:</strong> Savana · 625 Portage Ave, Winnipeg MB</p>
    <p style="margin:0 0 8px"><strong>Tickets (${qty}):</strong></p>
    <ul style="color:#84cc16;margin:8px 0 0 0;padding-left:18px">${lines}</ul>
  </div>
  <p style="color:#888;font-size:13px">Show this email at the door. Doors open 10 PM.</p>
  <p style="color:#888;font-size:13px">Questions? <a href="mailto:hello@allaccesswinnipeg.ca" style="color:#84cc16">hello@allaccesswinnipeg.ca</a></p>
  <hr style="border:none;border-top:1px solid #222;margin:24px 0">
  <p style="color:#444;font-size:12px;text-align:center">ALL ACCESS Winnipeg · allaccesswinnipeg.ca</p>
</div>`;
}

// ── Step 1: Send Hauwa's email directly (Ticket #5) ───────────────────────────
console.log("\n── ROCAFIESTA Ticket #5 — Hauwa Akinkunmi ──────────────────────────────────");
try {
  const id = await sendEmail({
    to: "hauwaomowumi@gmail.com",
    subject: "Your Ticket — ROCAFIESTA · Sept 5",
    html: buildRocaEmail(5, 1),
  });
  console.log(`  ✅ Sent → hauwaomowumi@gmail.com (Resend ID: ${id})`);
} catch (e) {
  console.error("  ❌ Failed:", e.message);
}

// ── Step 2: Audit all orders for both events ───────────────────────────────────
const eventIds = [
  { id: SKALES_EVENT_ID, label: "DJ LANKZ & FRIENDS", buildEmail: buildSkalesEmail, subject: "Your Tickets — DJ LANKZ & FRIENDS ft. SKALES" },
  ...(ROCA_EVENT_ID ? [{ id: ROCA_EVENT_ID, label: "ROCAFIESTA", buildEmail: buildRocaEmail, subject: "Your Ticket — ROCAFIESTA · Sept 5" }] : []),
];

// Track running ticket counters per event
const ticketCounters = {
  [SKALES_EVENT_ID]: 0,
  ...(ROCA_EVENT_ID ? { [ROCA_EVENT_ID]: 0 } : {}),
};

for (const event of eventIds) {
  console.log(`\n── ${event.label} — order audit ─────────────────────────────────────────────`);
  const snap = await db.collection("ticketOrders")
    .where("eventId", "==", event.id)
    .get();

  if (snap.empty) { console.log("  No orders found."); continue; }

  // Sort by creation time so ticket numbers are assigned chronologically
  const orders = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() ?? 0;
      const tb = b.createdAt?.toMillis?.() ?? 0;
      return ta - tb;
    });

  let runningTicket = 1;
  for (const order of orders) {
    const qty = order.quantity ?? 1;
    const ticketStart = runningTicket;
    const ticketEnd   = runningTicket + qty - 1;
    const ticketLabel = qty > 1 ? `#${ticketStart}–#${ticketEnd}` : `#${ticketStart}`;
    const email = order.userEmail ?? "(no email stored)";
    const emailSent = !!order.confirmationEmailSentAt;
    const paid = order.paymentStatus === "paid";

    console.log(`  Order ${order.id}`);
    console.log(`    email:   ${email}`);
    console.log(`    qty:     ${qty}  →  Ticket ${ticketLabel}`);
    console.log(`    paid:    ${paid}`);
    console.log(`    emailSent: ${emailSent ? "YES" : "NO ⚠️"}`);

    // Skip Hauwa — already handled above; skip unpaid; skip if email already sent
    if (email === "hauwaomowumi@gmail.com") {
      console.log(`    ↳ Already handled above — skipping`);
    } else if (!paid) {
      console.log(`    ↳ Not paid — skipping`);
    } else if (emailSent) {
      console.log(`    ↳ Email confirmed sent — no action needed`);
    } else if (!email || email === "(no email stored)") {
      console.log(`    ↳ ⚠️  No email address stored — cannot send automatically`);
    } else {
      // Send the missing confirmation
      try {
        const html = event.buildEmail(ticketStart, qty);
        const resendId = await sendEmail({ to: email, subject: event.subject, html });
        console.log(`    ↳ ✅ Sent to ${email} (Resend ID: ${resendId})`);

        // Mark as sent in Firestore
        await db.collection("ticketOrders").doc(order.id).update({
          confirmationEmailSentAt: FieldValue.serverTimestamp(),
          confirmationEmailResent: true,
        });
        console.log(`    ↳ Firestore updated`);
      } catch (e) {
        console.error(`    ↳ ❌ Failed:`, e.message);
      }
    }

    runningTicket += qty;
  }

  console.log(`\n  ${event.label} total tickets issued: ${runningTicket - 1}`);
}

console.log("\n✅ Done.");
process.exit(0);
