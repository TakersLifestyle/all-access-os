/**
 * Resend ROCAFIESTA ticket for Yoyinsola Osanyinbi to correct email.
 * Order: AFps2pLJcIOTZzuE8Lp0 — correcting daghenghen@gmail.com → samsonyoyin@gmail.com
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const env = readFileSync("../web/.env.local", "utf8").split("\n");
const getEnv = k => env.find(l => l.startsWith(k + "="))?.slice(k.length + 1).trim();
initializeApp({ credential: cert(JSON.parse(getEnv("GOOGLE_APPLICATION_CREDENTIALS_JSON"))) });
const db = getFirestore();
const RESEND_API_KEY = getEnv("RESEND_API_KEY");

const ORDER_ID  = "AFps2pLJcIOTZzuE8Lp0";
const NEW_EMAIL = "samsonyoyin@gmail.com";
const ACCENT    = "#ec4899";

// Update Firestore with correct email
await db.collection("ticketOrders").doc(ORDER_ID).update({ userEmail: NEW_EMAIL });
console.log(`✓ Firestore updated → ${NEW_EMAIL}`);

const orderSnap = await db.collection("ticketOrders").doc(ORDER_ID).get();
const o = orderSnap.data();
const eventSnap = await db.collection("events").doc(o.eventId).get();
const ev = eventSnap.data();

const qty            = o.quantity ?? 1;
const unitPriceCents = o.unitPriceCents ?? 2500;
const totalPaidCents = 2603; // actual Stripe charge
const a = ACCENT;

function esc(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function fmt(c) { return `$${(c/100).toFixed(2)}`; }
const qr = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(ORDER_ID)}&size=300x300&margin=10&bgcolor=ffffff&color=000000&ecc=M`;

const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Your Ticket &mdash; ROCAFIESTA</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#fff;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 0;">
<tr><td align="center">
<table width="540" cellpadding="0" cellspacing="0" style="max-width:540px;width:100%;">
  <tr><td style="padding:0 0 24px;text-align:center;">
    <span style="font-size:12px;font-weight:800;letter-spacing:.22em;color:${a};text-transform:uppercase;">ALL ACCESS</span>
    <span style="color:#ffffff20;margin:0 8px;">&bull;</span>
    <span style="font-size:11px;font-weight:500;letter-spacing:.08em;color:#ffffff30;text-transform:uppercase;">Winnipeg</span>
  </td></tr>
  <tr><td style="background:#111;border:1px solid ${a}35;border-radius:20px;overflow:hidden;">
    <div style="background:${a};padding:15px 36px;text-align:center;">
      <p style="margin:0;font-size:11px;font-weight:800;letter-spacing:.22em;color:#000;text-transform:uppercase;">&#10003;&nbsp;&nbsp;Ticket Confirmed</p>
    </div>
    <div style="padding:32px 36px 28px;">
      <h1 style="margin:0 0 4px;font-size:24px;font-weight:800;letter-spacing:-.01em;color:#fff;">${esc(ev.title)}</h1>
      <p style="margin:0 0 24px;font-size:13px;color:#ffffff40;">1 ticket &bull; ${fmt(totalPaidCents)} paid</p>
      <div style="border-top:1px dashed #ffffff12;margin-bottom:20px;"></div>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:9px 0;"><span style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#ffffff28;">Date</span></td>
          <td style="padding:9px 0;text-align:right;"><span style="font-size:13px;font-weight:600;color:#ffffffcc;">Saturday, September 5, 2026</span></td>
        </tr>
        <tr>
          <td style="padding:9px 0;"><span style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#ffffff28;">Location</span></td>
          <td style="padding:9px 0;text-align:right;"><span style="font-size:13px;font-weight:600;color:#ffffffcc;">${esc(ev.location)}</span></td>
        </tr>
        <tr>
          <td style="padding:9px 0;"><span style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#ffffff28;">Ticket</span></td>
          <td style="padding:9px 0;text-align:right;"><span style="font-size:13px;font-weight:600;color:#ffffffcc;">1 &times; ${fmt(unitPriceCents)}</span></td>
        </tr>
        <tr>
          <td style="padding:9px 0;"><span style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#ffffff28;">Total Paid</span></td>
          <td style="padding:9px 0;text-align:right;"><span style="font-size:16px;font-weight:800;color:${a};">${fmt(totalPaidCents)}</span></td>
        </tr>
      </table>
      <div style="border-top:1px dashed #ffffff12;margin:20px 0 24px;"></div>
      <!-- Konfam hype -->
      <div style="background:linear-gradient(135deg,rgba(236,72,153,0.1) 0%,rgba(139,92,246,0.07) 100%);border:1px solid rgba(236,72,153,0.22);border-radius:14px;padding:20px 22px;text-align:center;">
        <p style="margin:0 0 4px;font-size:20px;">🎉</p>
        <p style="margin:0 0 10px;font-size:14px;font-weight:800;color:${a};line-height:1.3;">KONFAM is excited to see all your beautiful faces!</p>
        <p style="margin:0;font-size:13px;color:#ffffffbb;line-height:1.7;">Red carpet ready &mdash; everyone is going to look their very best.<br><strong style="color:#fff;">Say hi to ALL ACCESS Winnipeg on the camera!</strong><br>Your QR code is below &mdash; scan it at the door and you&rsquo;re in. See you TONIGHT! 🖤</p>
      </div>
      <div style="height:24px;"></div>
      <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#ffffff25;">Order</p>
      <p style="margin:0;font-size:12px;font-family:monospace;color:#ffffff50;word-break:break-all;">${esc(ORDER_ID)}</p>
    </div>
    <div style="background:#fff;padding:24px 36px;text-align:center;border-top:1px solid #e0e0e0;border-bottom:1px solid #e0e0e0;">
      <p style="margin:0 0 14px;font-size:10px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#000;">&#128241;&nbsp; Scan at the Door</p>
      <img src="${qr}" alt="Ticket QR Code" width="200" height="200" style="display:block;margin:0 auto;border:none;width:200px;height:200px;"/>
      <p style="margin:10px 0 0;font-size:9px;color:#aaa;font-family:monospace;word-break:break-all;">${esc(ORDER_ID)}</p>
    </div>
    <div style="background:${a}12;border-top:1px solid ${a}22;padding:16px 36px;text-align:center;">
      <p style="margin:0;font-size:13px;font-weight:700;color:${a};">Show this email at the door &mdash; that&rsquo;s your ticket.</p>
      <p style="margin:5px 0 0;font-size:11px;color:#ffffff30;">Staff will scan your QR code to check you in.</p>
    </div>
  </td></tr>
  <tr><td style="height:28px;"></td></tr>
  <tr><td style="text-align:center;">
    <p style="margin:0 0 4px;font-size:11px;font-weight:800;letter-spacing:.18em;color:${a};text-transform:uppercase;">ALL ACCESS</p>
    <p style="margin:0;font-size:11px;color:#ffffff18;">hello@allaccesswinnipeg.ca &nbsp;&bull;&nbsp; Winnipeg, MB</p>
  </td></tr>
</table></td></tr></table>
</body></html>`;

const resp = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    from:    "ALL ACCESS <hello@allaccesswinnipeg.ca>",
    to:      [NEW_EMAIL],
    subject: "🎟 See You TONIGHT — Your ROCAFIESTA Ticket + QR Code Inside",
    html,
  }),
});

const result = await resp.json();
if (!resp.ok) { console.error("Resend error:", result); process.exit(1); }
console.log(`✓ Ticket sent → ${NEW_EMAIL}`);
console.log(`  Resend ID: ${result.id}`);
process.exit(0);
