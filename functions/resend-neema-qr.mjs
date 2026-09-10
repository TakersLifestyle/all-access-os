/**
 * One-shot: resend Neema's ROCAFIESTA ticket with QR code to correct email.
 * Order: WMiKjOmG6b7BNMHwM5Ji — neema.muthumwa@gmail.com
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const QRCode = require("qrcode");

const env = readFileSync("../web/.env.local", "utf8").split("\n");
const getEnv = k => env.find(l => l.startsWith(k + "="))?.slice(k.length + 1).trim();

initializeApp({ credential: cert(JSON.parse(getEnv("GOOGLE_APPLICATION_CREDENTIALS_JSON"))) });
const db = getFirestore();
const RESEND_API_KEY = getEnv("RESEND_API_KEY");

const ORDER_ID = "WMiKjOmG6b7BNMHwM5Ji";
const SEND_TO  = "neema.muthumwa@gmail.com";
const ACCENT   = "#ec4899";

const orderSnap = await db.collection("ticketOrders").doc(ORDER_ID).get();
const o = orderSnap.data();
const eventSnap = await db.collection("events").doc(o.eventId).get();
const ev = eventSnap.data();

const quantity      = o.quantity ?? 1;
const unitPriceCents = o.unitPriceCents ?? Math.round((o.unitPrice ?? 25) * 100);
const totalPaidCents = o.totalPaidCents ?? unitPriceCents * quantity;

function fmt(cents) { return `$${(cents / 100).toFixed(2)}`; }
function escHtml(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function fmtDate(raw) {
  try {
    const d = raw instanceof Timestamp ? raw.toDate() : new Date(raw + "T12:00:00");
    return d.toLocaleDateString("en-CA", { weekday:"long", year:"numeric", month:"long", day:"numeric" });
  } catch { return String(raw); }
}

const qrDataUri = await QRCode.toDataURL(ORDER_ID, {
  width: 360, margin: 2, color: { dark: "#000000", light: "#ffffff" },
});

const a = ACCENT;
const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><title>Your Ticket — ROCAFIESTA</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#fff;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 0;">
<tr><td align="center">
<table width="540" cellpadding="0" cellspacing="0" style="max-width:540px;width:100%;">
  <tr><td style="padding:0 0 28px;text-align:center;">
    <span style="font-size:13px;font-weight:700;letter-spacing:.18em;color:${a};text-transform:uppercase;">ALL ACCESS</span>
    <span style="font-size:13px;color:#fff2;margin:0 8px;">&bull;</span>
    <span style="font-size:12px;font-weight:500;letter-spacing:.06em;color:#fff3;text-transform:uppercase;">Winnipeg</span>
  </td></tr>
  <tr><td style="background:#111;border:1px solid ${a}35;border-radius:20px;overflow:hidden;">
    <div style="background:${a};padding:18px 36px;text-align:center;">
      <p style="margin:0;font-size:11px;font-weight:800;letter-spacing:.22em;color:#000;text-transform:uppercase;">&#10003;&nbsp;Ticket Confirmed</p>
    </div>
    <div style="padding:36px 36px 32px;">
      <h1 style="margin:0 0 6px;font-size:26px;font-weight:800;line-height:1.2;color:#fff;">${escHtml(ev.title)}</h1>
      <p style="margin:0 0 28px;font-size:14px;color:#fff5;">${quantity} ticket &bull; ${fmt(totalPaidCents)} paid</p>
      <div style="border-top:1px dashed #fff1;margin-bottom:24px;"></div>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:9px 0;"><span style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#fff3;">Date</span></td>
          <td style="padding:9px 0;text-align:right;"><span style="font-size:13px;font-weight:600;color:#fff9;">${fmtDate(ev.date)}</span></td>
        </tr>
        <tr>
          <td style="padding:9px 0;"><span style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#fff3;">Location</span></td>
          <td style="padding:9px 0;text-align:right;"><span style="font-size:13px;font-weight:600;color:#fff9;">${escHtml(ev.location)}</span></td>
        </tr>
        <tr>
          <td style="padding:9px 0;"><span style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#fff3;">Tickets</span></td>
          <td style="padding:9px 0;text-align:right;"><span style="font-size:13px;font-weight:600;color:#fff9;">${quantity} &times; ${fmt(unitPriceCents)}</span></td>
        </tr>
        <tr>
          <td style="padding:9px 0;"><span style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#fff3;">Total Paid</span></td>
          <td style="padding:9px 0;text-align:right;"><span style="font-size:16px;font-weight:800;color:${a};">${fmt(totalPaidCents)}</span></td>
        </tr>
      </table>
      <div style="border-top:1px dashed #fff1;margin:24px 0;"></div>
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#fff2;">Order Confirmation</p>
      <p style="margin:0;font-size:14px;font-family:monospace;font-weight:600;letter-spacing:.06em;color:#fff6;word-break:break-all;">${escHtml(ORDER_ID)}</p>
    </div>
    <div style="background:#fff;padding:28px 36px;text-align:center;border-top:1px solid #e5e5e5;">
      <p style="margin:0 0 14px;font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#000;">Scan at the Door</p>
      <img src="${qrDataUri}" alt="Ticket QR Code" width="180" height="180"
        style="display:block;margin:0 auto;width:180px;height:180px;border:none;" />
      <p style="margin:12px 0 0;font-size:10px;color:#999;font-family:monospace;letter-spacing:.04em;">${escHtml(ORDER_ID)}</p>
    </div>
    <div style="background:${a}12;border-top:1px solid ${a}22;padding:18px 36px;text-align:center;">
      <p style="margin:0;font-size:13px;font-weight:700;color:${a};letter-spacing:.03em;">Show this email at the door &mdash; that&rsquo;s your ticket.</p>
      <p style="margin:6px 0 0;font-size:12px;color:#fff3;">Staff will scan your QR code to check you in.</p>
    </div>
  </td></tr>
  <tr><td style="height:28px;"></td></tr>
  <tr><td style="text-align:center;padding:0 16px;">
    <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.15em;color:${a};text-transform:uppercase;">ALL ACCESS</p>
    <p style="margin:0 0 14px;font-size:12px;color:#fff3;line-height:1.6;">Questions? <a href="mailto:hello@allaccesswinnipeg.ca" style="color:#fff4;text-decoration:none;">hello@allaccesswinnipeg.ca</a></p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;

const resp = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    from:    "ALL ACCESS <hello@allaccesswinnipeg.ca>",
    to:      [SEND_TO],
    subject: "🎟 Your Ticket — ROCAFIESTA (Sep 5, 2026) — Scan at Door",
    html,
  }),
});

const result = await resp.json();
if (!resp.ok) { console.error("Resend error:", result); process.exit(1); }
console.log(`✓ Sent to ${SEND_TO}`);
console.log(`  Resend ID: ${result.id}`);
process.exit(0);
