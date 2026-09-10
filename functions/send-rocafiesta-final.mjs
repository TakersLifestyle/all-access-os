/**
 * ROCAFIESTA — Final corrected ticket email send to all 10 buyers.
 *
 * Fixes vs original broken send:
 *   ✓ Date: Saturday, September 5, 2026 (no timezone bug)
 *   ✓ QR code: hosted URL via api.qrserver.com — renders in Gmail, Outlook, all clients
 *   ✓ Prices: unitPriceCents for per-ticket display, actual Stripe charge for Total Paid
 *   ✓ Konfam hype message
 *   ✓ Neema's typo order → corrected to neema.muthumwa@gmail.com (fixed in Firestore)
 *
 * Run: cd functions && node send-rocafiesta-final.mjs
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const env = readFileSync("../web/.env.local", "utf8").split("\n");
const getEnv = k => env.find(l => l.startsWith(k + "="))?.slice(k.length + 1).trim();

initializeApp({ credential: cert(JSON.parse(getEnv("GOOGLE_APPLICATION_CREDENTIALS_JSON"))) });
const db = getFirestore();
const RESEND_API_KEY = getEnv("RESEND_API_KEY");

const ROCAFIESTA_ID = "MCzwl8mGF8P1rL5goEab";
const ACCENT = "#ec4899";

// Actual Stripe charges per order (from verified Stripe PaymentIntent reads)
// These are what hit each buyer's card, including processing fees.
const STRIPE_AMOUNTS_CENTS = {
  "MreZZgnSen7L1vaTXGfI": 5103,  // chisesachimwemwe — 2× Tier 2
  "QWxWMoleK2YhJq1rLsXe": 6175,  // bforsonfoidart — Group of 3
  "R6qDKTEHPNTW7qndKmgr": 2603,  // savross28 — Tier 2
  "SFkIkqwIgJrOQQ724h1f": 2088,  // ben.duk — Tier 1
  "WMiKjOmG6b7BNMHwM5Ji": 2603,  // neema.muthumwa — Tier 2
  "Wogk4KRYD6hAaHY7y4E5": 2603,  // hauwaomowumi — Tier 2
  "YSiMGwgAMPI7NmbuhIOr": 2088,  // neema.muthumwa — Tier 1
  "ZCstbWOXQJLDvtpac3Nc": 63,    // tharealprincecharles — Early Bird (promo)
  "k7cXh0nX7fY0Y9UOS1WC": 2088,  // nancysoka — Tier 1
  "xqyu3CcvgQvZ4PWOnJp2": 2088,  // ebubeokeke0 — General Admission
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmt(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

function qrUrl(orderId) {
  // Hosted QR image — renders in Gmail, Outlook, iOS Mail, Android Mail.
  // api.qrserver.com is a well-known public QR generation service.
  const encoded = encodeURIComponent(orderId);
  return `https://api.qrserver.com/v1/create-qr-code/?data=${encoded}&size=300x300&margin=10&bgcolor=ffffff&color=000000&ecc=M`;
}

function extractFirstName(displayName, email) {
  if (displayName) {
    const f = displayName.trim().split(/\s+/)[0];
    if (f) return f.charAt(0).toUpperCase() + f.slice(1);
  }
  if (email) {
    const local = email.split("@")[0];
    const clean = local.replace(/^[^a-zA-Z]+/, "").split(/[._\-+]/)[0];
    if (clean) return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
  }
  return "there";
}

function buildHtml({ orderId, firstName, eventTitle, quantity, tierName, unitPriceCents, totalPaidCents, eventLocation }) {
  const a = ACCENT;
  const qr = qrUrl(orderId);
  const ticketLine = quantity > 1
    ? `${quantity} × ${esc(tierName)} — ${fmt(unitPriceCents)} each`
    : `1 × ${esc(tierName)} — ${fmt(unitPriceCents)}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Your Ticket — ROCAFIESTA</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#fff;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

  <!-- Brand -->
  <tr><td style="padding:0 0 24px;text-align:center;">
    <span style="font-size:12px;font-weight:800;letter-spacing:.22em;color:${a};text-transform:uppercase;">ALL ACCESS</span>
    <span style="color:#ffffff20;margin:0 8px;">&bull;</span>
    <span style="font-size:11px;font-weight:500;letter-spacing:.08em;color:#ffffff30;text-transform:uppercase;">Winnipeg</span>
  </td></tr>

  <!-- Card -->
  <tr><td style="background:#111;border:1px solid rgba(236,72,153,0.25);border-radius:20px;overflow:hidden;">

    <!-- Confirmed bar -->
    <div style="background:${a};padding:15px 36px;text-align:center;">
      <p style="margin:0;font-size:11px;font-weight:800;letter-spacing:.22em;color:#000;text-transform:uppercase;">&#10003;&nbsp;&nbsp;Ticket Confirmed</p>
    </div>

    <!-- Details -->
    <div style="padding:32px 36px 28px;">
      <h1 style="margin:0 0 4px;font-size:26px;font-weight:800;letter-spacing:-.01em;color:#fff;">${esc(eventTitle)}</h1>
      <p style="margin:0 0 24px;font-size:13px;color:#ffffff40;">${quantity === 1 ? "1 ticket" : `${quantity} tickets`} &bull; ${fmt(totalPaidCents)} paid</p>

      <div style="border-top:1px dashed #ffffff12;margin-bottom:20px;"></div>

      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:9px 0;"><span style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#ffffff28;">Date</span></td>
          <td style="padding:9px 0;text-align:right;"><span style="font-size:13px;font-weight:600;color:#ffffffcc;">Saturday, September 5, 2026</span></td>
        </tr>
        <tr>
          <td style="padding:9px 0;"><span style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#ffffff28;">Location</span></td>
          <td style="padding:9px 0;text-align:right;"><span style="font-size:13px;font-weight:600;color:#ffffffcc;">${esc(eventLocation)}</span></td>
        </tr>
        <tr>
          <td style="padding:9px 0;"><span style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#ffffff28;">Ticket</span></td>
          <td style="padding:9px 0;text-align:right;"><span style="font-size:13px;font-weight:600;color:#ffffffcc;">${ticketLine}</span></td>
        </tr>
        <tr>
          <td style="padding:9px 0;"><span style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#ffffff28;">Total Paid</span></td>
          <td style="padding:9px 0;text-align:right;"><span style="font-size:16px;font-weight:800;color:${a};">${fmt(totalPaidCents)}</span></td>
        </tr>
      </table>

      <div style="border-top:1px dashed #ffffff12;margin:20px 0 24px;"></div>

      <!-- Konfam hype block -->
      <div style="background:linear-gradient(135deg,rgba(236,72,153,0.1) 0%,rgba(139,92,246,0.07) 100%);border:1px solid rgba(236,72,153,0.22);border-radius:14px;padding:22px 22px;text-align:center;">
        <p style="margin:0 0 4px;font-size:22px;">🎉</p>
        <p style="margin:0 0 10px;font-size:15px;font-weight:800;color:${a};line-height:1.3;">KONFAM is excited to see all your beautiful faces!</p>
        <p style="margin:0;font-size:13px;color:#ffffffbb;line-height:1.7;">
          Red carpet ready &mdash; I&rsquo;m sure everyone is going to look their very best.<br>
          <strong style="color:#fff;">Say hi to ALL ACCESS Winnipeg on the camera!</strong><br>
          Your QR code is below &mdash; scan it at the door and you&rsquo;re in. See you TOMORROW night! 🖤
        </p>
      </div>
    </div>

    <!-- QR Code — hosted URL renders in Gmail, Outlook, all email clients -->
    <div style="background:#fff;padding:28px 36px;text-align:center;border-top:1px solid #e0e0e0;border-bottom:1px solid #e0e0e0;">
      <p style="margin:0 0 16px;font-size:10px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#000;">&#128241;&nbsp; Scan at the Door</p>
      <img
        src="${qr}"
        alt="Your ticket QR code — scan at the door"
        width="200"
        height="200"
        style="display:block;margin:0 auto;width:200px;height:200px;border:none;"
      />
      <p style="margin:12px 0 0;font-size:10px;color:#aaa;font-family:monospace;letter-spacing:.04em;word-break:break-all;">${esc(orderId)}</p>
    </div>

    <!-- CTA -->
    <div style="background:rgba(236,72,153,0.08);border-top:1px solid rgba(236,72,153,0.15);padding:18px 36px;text-align:center;">
      <p style="margin:0;font-size:13px;font-weight:700;color:${a};letter-spacing:.02em;">Show this email at the door &mdash; that&rsquo;s your ticket.</p>
      <p style="margin:6px 0 0;font-size:12px;color:#ffffff30;">Staff will scan your QR code to check you in.</p>
    </div>

  </td></tr>

  <tr><td style="height:28px;"></td></tr>

  <!-- Footer -->
  <tr><td style="text-align:center;padding:0 16px;">
    <p style="margin:0 0 6px;font-size:11px;font-weight:800;letter-spacing:.18em;color:${a};text-transform:uppercase;">ALL ACCESS</p>
    <p style="margin:0;font-size:11px;color:#ffffff20;line-height:1.6;">
      Questions? <a href="mailto:hello@allaccesswinnipeg.ca" style="color:#ffffff30;text-decoration:none;">hello@allaccesswinnipeg.ca</a><br>
      Winnipeg, MB &nbsp;&bull;&nbsp; Community first. Always.
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
const eventTitle    = ev?.title    ?? "ROCAFIESTA — A Spiritual Experience with Konfam";
const eventLocation = ev?.location ?? "Pyramid Cabaret · 176 Fort St, Winnipeg, MB";

console.log(`\nEvent: ${eventTitle}`);
console.log(`Venue: ${eventLocation}\n`);

const orders = await db.collection("ticketOrders")
  .where("eventId", "==", ROCAFIESTA_ID)
  .where("paymentStatus", "==", "paid")
  .get();

console.log(`Found ${orders.size} paid orders\n`);

let sent = 0;
let failed = 0;

for (const doc of orders.docs) {
  const o = doc.data();
  const orderId = doc.id;

  const toEmail = o.userEmail ?? null;
  if (!toEmail) {
    console.log(`⚠  ${orderId} — no email in Firestore, skipping`);
    failed++;
    continue;
  }

  const quantity       = o.quantity ?? 1;
  const unitPriceCents = o.unitPriceCents ?? Math.round((o.unitPrice ?? 0) * 100);
  const totalPaidCents = STRIPE_AMOUNTS_CENTS[orderId] ?? (unitPriceCents * quantity);
  const tierName       = o.ticketTierName ?? o.tierName ?? "General Admission";
  const displayName    = o.userName ?? o.displayName ?? null;
  const firstName      = extractFirstName(displayName, toEmail);

  const html = buildHtml({
    orderId,
    firstName,
    eventTitle,
    eventLocation,
    quantity,
    tierName,
    unitPriceCents,
    totalPaidCents,
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
      subject: "🎟 See You TOMORROW — Your ROCAFIESTA Ticket + QR Code Inside",
      html,
    }),
  });

  const result = await resp.json();

  if (!resp.ok) {
    console.error(`✗ ${orderId} → ${toEmail}: ${JSON.stringify(result)}`);
    failed++;
  } else {
    console.log(`✓ ${orderId} → ${toEmail}`);
    console.log(`  ${quantity}× ${tierName} | ${fmt(unitPriceCents)}/ticket | Total: ${fmt(totalPaidCents)} | Resend: ${result.id}`);
    sent++;
  }

  // 350ms between sends — stays well under Resend rate limits
  await new Promise(r => setTimeout(r, 350));
}

console.log(`\n✅ Done — ${sent} sent, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
