/**
 * Resend ROCAFIESTA ticket confirmations to ALL paid buyers — with QR codes.
 * Run from: cd functions && node resend-rocafiesta-qr.mjs
 *
 * This bypasses the idempotency sentinel (confirmationEmailSentAt) so everyone
 * gets a fresh email containing their scannable QR code for door check-in.
 * After sending, it writes confirmationEmailSentAt back so future webhook
 * retries don't re-send.
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { createRequire } from "module";

import Stripe from "stripe";

const require = createRequire(import.meta.url);
const QRCode = require("qrcode");

const env = readFileSync("../web/.env.local", "utf8").split("\n");
const getEnv = k => env.find(l => l.startsWith(k + "="))?.slice(k.length + 1).trim();

initializeApp({ credential: cert(JSON.parse(getEnv("GOOGLE_APPLICATION_CREDENTIALS_JSON"))) });
const db = getFirestore();
const RESEND_API_KEY = getEnv("RESEND_API_KEY");
const stripe = new Stripe(getEnv("STRIPE_SECRET_KEY"));

const ROCAFIESTA_ID = "MCzwl8mGF8P1rL5goEab";
const ACCENT = "#ec4899";

// ── Helpers ──────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmt(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

function fmtDate(raw) {
  try {
    const d = raw instanceof Timestamp ? raw.toDate() : new Date(raw);
    return d.toLocaleDateString("en-CA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  } catch { return String(raw); }
}

function fmtPaidAt(raw) {
  try {
    const d = raw instanceof Timestamp ? raw.toDate() : new Date(raw);
    return d.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
  } catch { return String(raw); }
}

function extractFirstName(displayName, email) {
  if (displayName) {
    const f = displayName.trim().split(/\s+/)[0];
    if (f) return f;
  }
  if (email) {
    const local = email.split("@")[0];
    const clean = local.replace(/^[^a-zA-Z]+/, "").split(/[._\-+]/)[0];
    if (clean) return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
  }
  return "there";
}

function buildEmail({ orderId, eventTitle, eventDate, eventLocation, quantity, unitPriceCents, totalPaidCents, displayName, userEmail, paidAt, qrDataUri }) {
  const a = ACCENT;
  const accentBorder = a + "35";
  const accentBg = a + "12";
  const accentDim = a + "22";
  const firstName = extractFirstName(displayName, userEmail);
  const ticketWord = quantity === 1 ? "ticket" : "tickets";
  const formattedDate = fmtDate(eventDate);
  const formattedPaidAt = fmtPaidAt(paidAt);
  const totalFmt = fmt(totalPaidCents);
  const unitFmt = fmt(unitPriceCents);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Ticket — ${escHtml(eventTitle)}</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:40px 0;">
    <tr><td align="center">
      <table width="540" cellpadding="0" cellspacing="0" style="max-width:540px;width:100%;">

        <!-- HEADER -->
        <tr><td style="padding:0 0 28px;text-align:center;">
          <span style="font-size:13px;font-weight:700;letter-spacing:.18em;color:${a};text-transform:uppercase;">ALL ACCESS</span>
          <span style="font-size:13px;color:#ffffff20;margin:0 8px;">&bull;</span>
          <span style="font-size:12px;font-weight:500;letter-spacing:.06em;color:#ffffff35;text-transform:uppercase;">Winnipeg</span>
        </td></tr>

        <!-- TICKET CARD -->
        <tr><td style="background:#111;border:1px solid ${accentBorder};border-radius:20px;overflow:hidden;">

          <!-- Confirmed strip -->
          <div style="background:${a};padding:18px 36px;text-align:center;">
            <p style="margin:0;font-size:11px;font-weight:800;letter-spacing:.22em;color:#000;text-transform:uppercase;">&#10003;&nbsp;Ticket Confirmed</p>
          </div>

          <!-- Content -->
          <div style="padding:36px 36px 32px;">
            <h1 style="margin:0 0 6px;font-size:26px;font-weight:800;line-height:1.2;letter-spacing:-.01em;color:#fff;">${escHtml(eventTitle)}</h1>
            <p style="margin:0 0 28px;font-size:14px;color:#ffffff50;">${quantity} ${ticketWord} &bull; ${escHtml(totalFmt)} paid</p>

            <div style="border-top:1px dashed #ffffff15;margin-bottom:24px;"></div>

            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:9px 0;"><span style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#ffffff30;">Date</span></td>
                <td style="padding:9px 0;text-align:right;"><span style="font-size:13px;font-weight:600;color:#ffffff90;">${escHtml(formattedDate)}</span></td>
              </tr>
              <tr>
                <td style="padding:9px 0;"><span style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#ffffff30;">Location</span></td>
                <td style="padding:9px 0;text-align:right;"><span style="font-size:13px;font-weight:600;color:#ffffff90;">${escHtml(eventLocation)}</span></td>
              </tr>
              <tr>
                <td style="padding:9px 0;"><span style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#ffffff30;">Tickets</span></td>
                <td style="padding:9px 0;text-align:right;"><span style="font-size:13px;font-weight:600;color:#ffffff90;">${quantity} &times; ${escHtml(unitFmt)}</span></td>
              </tr>
              <tr>
                <td style="padding:9px 0;"><span style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#ffffff30;">Total Paid</span></td>
                <td style="padding:9px 0;text-align:right;"><span style="font-size:16px;font-weight:800;color:${a};">${escHtml(totalFmt)}</span></td>
              </tr>
            </table>

            <div style="border-top:1px dashed #ffffff15;margin:24px 0;"></div>

            <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#ffffff25;">Order Confirmation</p>
            <p style="margin:0;font-size:14px;font-family:monospace;font-weight:600;letter-spacing:.06em;color:#ffffff60;word-break:break-all;">${escHtml(orderId)}</p>
          </div>

          <!-- QR CODE — white background so it scans cleanly -->
          <div style="background:#ffffff;padding:28px 36px;text-align:center;border-top:1px solid #e5e5e5;">
            <p style="margin:0 0 14px;font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#000;">Scan at the Door</p>
            <img src="${qrDataUri}" alt="Ticket QR Code" width="180" height="180"
              style="display:block;margin:0 auto;width:180px;height:180px;border:none;" />
            <p style="margin:12px 0 0;font-size:10px;color:#999;font-family:monospace;letter-spacing:.04em;">${escHtml(orderId)}</p>
          </div>

          <!-- CTA -->
          <div style="background:${accentBg};border-top:1px solid ${accentDim};padding:18px 36px;text-align:center;">
            <p style="margin:0;font-size:13px;font-weight:700;color:${a};letter-spacing:.03em;">Show this email at the door &mdash; that&rsquo;s your ticket.</p>
            <p style="margin:6px 0 0;font-size:12px;color:#ffffff30;">Staff will scan your QR code to check you in.</p>
          </div>

        </td></tr>

        <tr><td style="height:24px;"></td></tr>

        <!-- RECEIPT -->
        <tr><td style="background:#0f0f0f;border:1px solid #ffffff08;border-radius:14px;padding:18px 24px;">
          <p style="margin:0 0 12px;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#ffffff20;">Receipt</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:6px 0;"><span style="font-size:12px;color:#ffffff30;">Order ID</span></td>
              <td style="padding:6px 0;text-align:right;"><span style="font-size:11px;font-family:monospace;color:#ffffff40;">${escHtml(orderId)}</span></td>
            </tr>
            <tr>
              <td style="padding:6px 0;"><span style="font-size:12px;color:#ffffff30;">Date</span></td>
              <td style="padding:6px 0;text-align:right;"><span style="font-size:12px;color:#ffffff40;">${escHtml(formattedPaidAt)}</span></td>
            </tr>
          </table>
        </td></tr>

        <tr><td style="height:28px;"></td></tr>

        <!-- FOOTER -->
        <tr><td style="text-align:center;padding:0 16px;">
          <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.15em;color:${a};text-transform:uppercase;">ALL ACCESS</p>
          <p style="margin:0 0 14px;font-size:12px;color:#ffffff25;line-height:1.6;">
            Questions? <a href="mailto:hello@allaccesswinnipeg.ca" style="color:#ffffff35;text-decoration:none;">hello@allaccesswinnipeg.ca</a>
          </p>
          <p style="margin:0;font-size:11px;color:#ffffff18;line-height:1.6;">
            You&rsquo;re receiving this because you purchased a ticket through ALL ACCESS.<br/>Winnipeg, MB, Canada
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Main ─────────────────────────────────────────────────────────────────────

const eventDoc = await db.collection("events").doc(ROCAFIESTA_ID).get();
const ev = eventDoc.data();
console.log(`\nEvent: ${ev?.title}`);
console.log(`Date:  ${ev?.date}`);
console.log(`Venue: ${ev?.location}\n`);

const orders = await db.collection("ticketOrders")
  .where("eventId", "==", ROCAFIESTA_ID)
  .where("paymentStatus", "==", "paid")
  .get();

console.log(`Found ${orders.size} paid orders\n`);

let sent = 0;
let skipped = 0;

for (const doc of orders.docs) {
  const o = doc.data();
  const orderId = doc.id;

  // Prefer Firestore email; fall back to Stripe session for guest checkouts
  let toEmail = o.userEmail ?? o.guestEmail ?? null;
  let displayName = o.userName ?? o.displayName ?? null;

  if (!toEmail && o.stripeCheckoutSessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(o.stripeCheckoutSessionId);
      toEmail = session.customer_details?.email ?? null;
      if (!displayName) displayName = session.customer_details?.name ?? null;
      if (toEmail) console.log(`  → pulled email from Stripe: ${toEmail}`);
    } catch (stripeErr) {
      console.warn(`  → Stripe session fetch failed for ${orderId}: ${stripeErr.message}`);
    }
  }

  if (!toEmail) {
    console.log(`⚠  ${orderId} — no email address (Firestore + Stripe), skipping`);
    skipped++;
    continue;
  }

  const quantity  = o.quantity ?? 1;
  const unitPrice = o.unitPrice ?? o.price ?? 2500; // cents
  const totalPaid = o.totalPaid ?? o.amountTotal ?? (unitPrice * quantity);
  const paidAt    = o.createdAt ?? o.paidAt ?? new Date().toISOString();

  // Generate QR code from Order ID
  const qrDataUri = await QRCode.toDataURL(orderId, {
    width: 360,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });

  const html = buildEmail({
    orderId,
    eventTitle:    ev?.title    ?? "ROCAFIESTA — A Spiritual Experience with Konfam",
    eventDate:     ev?.date     ?? "2026-09-05",
    eventLocation: ev?.location ?? "Pyramid Cabaret · 176 Fort St, Winnipeg, MB",
    quantity,
    unitPriceCents: unitPrice,
    totalPaidCents: totalPaid,
    displayName:   displayName,
    userEmail:     toEmail,
    paidAt,
    qrDataUri,
  });

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from:    "ALL ACCESS <hello@allaccesswinnipeg.ca>",
      to:      [toEmail],
      subject: `🎟 Your Ticket — ROCAFIESTA (Sep 5, 2026) — Scan at Door`,
      html,
    }),
  });

  const result = await resp.json();
  if (!resp.ok) {
    console.error(`✗ ${orderId} → ${toEmail}: ${JSON.stringify(result)}`);
  } else {
    console.log(`✓ ${orderId} → ${toEmail} (${quantity}x) — Resend ID: ${result.id}`);
    // Update the sentinel so future webhook retries don't re-send
    await doc.ref.set({ confirmationEmailSentAt: new Date().toISOString() }, { merge: true });
    sent++;
  }

  // Small delay between sends to avoid rate limits
  await new Promise(r => setTimeout(r, 300));
}

console.log(`\n✅ Done — ${sent} sent, ${skipped} skipped (no email)`);
process.exit(0);
