/**
 * Simulate exactly what the webhook now sends on a new ROCAFIESTA ticket purchase.
 * Sends a test email to tharealprincecharles@gmail.com so you can verify:
 *   ✓ Subject: "See You TONIGHT"
 *   ✓ QR code loads (qrserver.com hosted URL — works in Gmail)
 *   ✓ Konfam hype block present
 *   ✓ Date: Saturday, September 5, 2026
 *   ✓ Prices correct
 */
import { readFileSync } from "fs";

const env = readFileSync("../web/.env.local", "utf8").split("\n");
const getEnv = k => env.find(l => l.startsWith(k + "="))?.slice(k.length + 1).trim();
const RESEND_API_KEY = getEnv("RESEND_API_KEY");

const ACCENT = "#ec4899";
const TEST_ORDER_ID = "TEST-NEW-PURCHASE-001";

// ── Exactly mirror what email.ts + ticket-confirmation.ts now do ──────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// QR code — hosted URL, renders in Gmail
const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(TEST_ORDER_ID)}&size=300x300&margin=10&bgcolor=ffffff&color=000000&ecc=M`;

// Date parse — T12:00:00 fix (no timezone shift)
const eventDateRaw = "2026-09-05";
const formattedEventDate = new Date(eventDateRaw + "T12:00:00").toLocaleDateString("en-CA", {
  weekday: "long", year: "numeric", month: "long", day: "numeric"
});

// Smart subject — event is today (Sep 5) when they purchase at the door / online today
const todayStart = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
const eventDay = new Date("2026-09-05T12:00:00");
const diffDays = Math.floor((eventDay.getTime() - todayStart.getTime()) / 86400000);
const subjectPrefix = diffDays === 0 ? "See You TONIGHT" : diffDays === 1 ? "See You TOMORROW" : null;
const subject = subjectPrefix
  ? `🎟 ${subjectPrefix} — Your ROCAFIESTA Ticket + QR Code Inside`
  : `🎟 Your Ticket is Confirmed — ROCAFIESTA`;

// Konfam hype (ROCAFIESTA only)
const hypeMessage = "Red carpet ready — I'm sure everyone is going to look their very best. Say hi to ALL ACCESS Winnipeg on the camera! Your QR code is below — scan it at the door and you're in. See you TONIGHT! 🖤";

const accent = ACCENT;
const accentBorder = accent + "35";
const accentBg = accent + "12";
const accentDim = accent + "22";

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Your Ticket &mdash; ROCAFIESTA</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#ffffff;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:40px 0;">
<tr><td align="center">
<table width="540" cellpadding="0" cellspacing="0" style="max-width:540px;width:100%;">

  <tr><td style="padding:0 0 28px;text-align:center;">
    <span style="font-size:13px;font-weight:700;letter-spacing:0.18em;color:${accent};text-transform:uppercase;">ALL ACCESS</span>
    <span style="font-size:13px;color:#ffffff20;margin:0 8px;">&bull;</span>
    <span style="font-size:12px;font-weight:500;letter-spacing:0.06em;color:#ffffff35;text-transform:uppercase;">Winnipeg</span>
  </td></tr>

  <tr><td style="background:#111111;border:1px solid ${accentBorder};border-radius:20px;overflow:hidden;">

    <div style="background:${accent};padding:18px 36px;text-align:center;">
      <p style="margin:0;font-size:11px;font-weight:800;letter-spacing:0.22em;color:#000000;text-transform:uppercase;">&#10003;&nbsp; Ticket Confirmed</p>
    </div>

    <div style="padding:36px 36px 32px;">
      <h1 style="margin:0 0 6px;font-size:26px;font-weight:800;line-height:1.2;letter-spacing:-0.01em;color:#ffffff;">ROCAFIESTA — A Spiritual Experience with Konfam</h1>
      <p style="margin:0 0 28px;font-size:14px;color:#ffffff50;">1 ticket &bull; $26.03 paid</p>

      <div style="border-top:1px dashed #ffffff15;margin-bottom:24px;"></div>

      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:9px 0;"><span style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#ffffff30;">Date</span></td>
          <td style="padding:9px 0;text-align:right;"><span style="font-size:13px;font-weight:600;color:#ffffff90;">${escHtml(formattedEventDate)}</span></td>
        </tr>
        <tr>
          <td style="padding:9px 0;"><span style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#ffffff30;">Location</span></td>
          <td style="padding:9px 0;text-align:right;"><span style="font-size:13px;font-weight:600;color:#ffffff90;">Pyramid Cabaret &middot; 176 Fort St, Winnipeg, MB</span></td>
        </tr>
        <tr>
          <td style="padding:9px 0;"><span style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#ffffff30;">Tickets</span></td>
          <td style="padding:9px 0;text-align:right;"><span style="font-size:13px;font-weight:600;color:#ffffff90;">1 &times; $25.00</span></td>
        </tr>
        <tr>
          <td style="padding:9px 0;"><span style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#ffffff30;">Total Paid</span></td>
          <td style="padding:9px 0;text-align:right;"><span style="font-size:16px;font-weight:800;color:${accent};">$26.03</span></td>
        </tr>
      </table>

      <div style="border-top:1px dashed #ffffff15;margin:24px 0;"></div>

      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#ffffff25;">Order Confirmation</p>
      <p style="margin:0;font-size:14px;font-family:monospace;font-weight:600;letter-spacing:0.06em;color:#ffffff60;word-break:break-all;">${escHtml(TEST_ORDER_ID)}</p>
    </div>

    <!-- Konfam hype block -->
    <div style="margin:0 36px 0;padding:20px 22px;background:linear-gradient(135deg,rgba(236,72,153,0.1) 0%,rgba(139,92,246,0.07) 100%);border:1px solid rgba(236,72,153,0.22);border-radius:14px;text-align:center;">
      <p style="margin:0 0 4px;font-size:20px;">🎉</p>
      <p style="margin:0 0 10px;font-size:14px;font-weight:800;color:${accent};line-height:1.3;">KONFAM is excited to see all your beautiful faces!</p>
      <p style="margin:0;font-size:13px;color:#ffffffbb;line-height:1.7;">${escHtml(hypeMessage)}</p>
    </div>
    <div style="height:24px;"></div>

    <!-- QR Code — hosted URL, renders in Gmail -->
    <div style="background:#ffffff;padding:28px 36px;text-align:center;border-top:1px solid #e5e5e5;">
      <p style="margin:0 0 14px;font-size:11px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;color:#000000;">&#128241;&nbsp; Scan at the Door</p>
      <img src="${qrCodeUrl}" alt="Ticket QR Code" width="200" height="200"
        style="display:block;margin:0 auto;border:none;width:200px;height:200px;" />
      <p style="margin:12px 0 0;font-size:10px;color:#999999;font-family:monospace;letter-spacing:0.04em;">${escHtml(TEST_ORDER_ID)}</p>
    </div>

    <div style="background:${accentBg};border-top:1px solid ${accentDim};padding:18px 36px;text-align:center;">
      <p style="margin:0;font-size:13px;font-weight:700;color:${accent};letter-spacing:0.03em;">Show this email at the door &mdash; that&rsquo;s your ticket.</p>
      <p style="margin:6px 0 0;font-size:12px;color:#ffffff30;">Staff will scan your QR code to check you in.</p>
    </div>

  </td></tr>
  <tr><td style="height:28px;"></td></tr>
  <tr><td style="text-align:center;padding:0 16px;">
    <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:0.15em;color:${accent};text-transform:uppercase;">ALL ACCESS</p>
    <p style="margin:0;font-size:11px;color:#ffffff18;line-height:1.6;">
      Questions? <a href="mailto:hello@allaccesswinnipeg.ca" style="color:#ffffff25;text-decoration:none;">hello@allaccesswinnipeg.ca</a><br/>
      Winnipeg, MB, Canada
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

console.log(`\nSubject: ${subject}`);
console.log(`Date:    ${formattedEventDate}`);
console.log(`QR URL:  ${qrCodeUrl}`);
console.log(`Days until event: ${diffDays}\n`);

const resp = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${RESEND_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    from:    "ALL ACCESS <hello@allaccesswinnipeg.ca>",
    to:      ["tharealprincecharles@gmail.com"],
    subject,
    html,
  }),
});

const result = await resp.json();
if (!resp.ok) { console.error("Resend error:", result); process.exit(1); }
console.log(`✓ Test email sent → tharealprincecharles@gmail.com`);
console.log(`  Resend ID: ${result.id}`);
process.exit(0);
