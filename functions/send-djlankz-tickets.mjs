/**
 * Resend DJ LANKZ & FRIENDS ticket emails with fixed QR codes (qrserver.com).
 * All 8 paid orders received broken data-URI QR emails originally.
 * Skip order 78q0iWdSeWvNW7ib5BCX (marynalieonova@yahoo.com — refunded).
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const env = readFileSync("../web/.env.local", "utf8").split("\n");
const getEnv = k => env.find(l => l.startsWith(k + "="))?.slice(k.length + 1).trim();
initializeApp({ credential: cert(JSON.parse(getEnv("GOOGLE_APPLICATION_CREDENTIALS_JSON"))) });
const db = getFirestore();
const RESEND_API_KEY = getEnv("RESEND_API_KEY");

const EVENT_ID = "EQIimnVZ5jPhVKPLyAJ2";
const SKIP_ORDER = "78q0iWdSeWvNW7ib5BCX"; // marynalieonova@yahoo.com — refunded
const ACCENT = "#8b5cf6"; // DJ LANKZ purple

function esc(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function fmt(cents) { return `$${(cents/100).toFixed(2)}`; }
function qrUrl(orderId) { return `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(orderId)}&size=300x300&margin=10&bgcolor=ffffff&color=000000&ecc=M`; }
function extractFirstName(name, email) {
  if (name) { const f = name.trim().split(/\s+/)[0]; if (f) return f; }
  if (email) { const c = email.split("@")[0].replace(/^[^a-zA-Z]+/,"").split(/[._\-+]/)[0]; if (c) return c.charAt(0).toUpperCase()+c.slice(1).toLowerCase(); }
  return "there";
}
function fmtDate(raw) {
  try {
    const d = raw instanceof Timestamp ? raw.toDate() : new Date(typeof raw === "string" && raw.length === 10 ? raw+"T12:00:00" : raw);
    return d.toLocaleDateString("en-CA", { weekday:"long", year:"numeric", month:"long", day:"numeric" });
  } catch { return String(raw); }
}

// Smart subject based on days until event
function buildSubject(eventDateRaw, eventTitle) {
  try {
    const d = eventDateRaw instanceof Timestamp ? eventDateRaw.toDate() : new Date(typeof eventDateRaw === "string" && eventDateRaw.length === 10 ? eventDateRaw+"T12:00:00" : eventDateRaw);
    const today = new Date(); today.setHours(0,0,0,0);
    const diff = Math.floor((d.getTime() - today.getTime()) / 86400000);
    if (diff === 0) return `🎟 See You TONIGHT — Your ${eventTitle} Ticket + QR Code Inside`;
    if (diff === 1) return `🎟 See You TOMORROW — Your ${eventTitle} Ticket + QR Code Inside`;
  } catch {}
  return `🎟 Your Ticket is Confirmed — ${eventTitle}`;
}

const eventDoc = await db.collection("events").doc(EVENT_ID).get();
const ev = eventDoc.data();
const eventTitle    = ev.title    ?? "DJ LANKZ & FRIENDS";
const eventLocation = ev.location ?? "";
const eventDate     = ev.date;
const accentColor   = ev.emailAccentColor ?? ACCENT;
const a = accentColor;

console.log(`Event: ${eventTitle}`);
console.log(`Date:  ${fmtDate(eventDate)}`);
console.log(`Venue: ${eventLocation}\n`);

const orders = await db.collection("ticketOrders")
  .where("eventId", "==", EVENT_ID)
  .where("paymentStatus", "==", "paid")
  .get();

let sent = 0; let skipped = 0;

for (const doc of orders.docs) {
  const o = doc.data();
  if (doc.id === SKIP_ORDER) { console.log(`⊘  ${doc.id} — refunded, skipping`); skipped++; continue; }

  const toEmail = o.userEmail ?? null;
  if (!toEmail) { console.log(`⚠  ${doc.id} — no email, skipping`); skipped++; continue; }

  const qty = o.quantity ?? 1;
  const unitPriceCents = o.unitPriceCents ?? Math.round((o.unitPrice ?? 25) * 100);
  const totalPaidCents = unitPriceCents * qty;
  const firstName = extractFirstName(o.userName ?? o.displayName ?? null, toEmail);
  const formattedDate = fmtDate(eventDate);
  const subject = buildSubject(eventDate, eventTitle);
  const qr = qrUrl(doc.id);
  const ticketWord = qty === 1 ? "ticket" : "tickets";

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Your Ticket &mdash; ${esc(eventTitle)}</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#fff;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 0;">
<tr><td align="center">
<table width="540" cellpadding="0" cellspacing="0" style="max-width:540px;width:100%;">
  <tr><td style="padding:0 0 28px;text-align:center;">
    <span style="font-size:12px;font-weight:800;letter-spacing:.22em;color:${a};text-transform:uppercase;">ALL ACCESS</span>
    <span style="color:#ffffff20;margin:0 8px;">&bull;</span>
    <span style="font-size:11px;font-weight:500;letter-spacing:.08em;color:#ffffff30;text-transform:uppercase;">Winnipeg</span>
  </td></tr>
  <tr><td style="background:#111;border:1px solid ${a}35;border-radius:20px;overflow:hidden;">
    <div style="background:${a};padding:15px 36px;text-align:center;">
      <p style="margin:0;font-size:11px;font-weight:800;letter-spacing:.22em;color:#000;text-transform:uppercase;">&#10003;&nbsp;&nbsp;Ticket Confirmed</p>
    </div>
    <div style="padding:32px 36px 28px;">
      <h1 style="margin:0 0 4px;font-size:24px;font-weight:800;letter-spacing:-.01em;color:#fff;">${esc(eventTitle)}</h1>
      <p style="margin:0 0 24px;font-size:13px;color:#ffffff40;">${qty} ${ticketWord} &bull; ${fmt(totalPaidCents)} paid</p>
      <div style="border-top:1px dashed #ffffff12;margin-bottom:20px;"></div>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:9px 0;"><span style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#ffffff28;">Date</span></td>
          <td style="padding:9px 0;text-align:right;"><span style="font-size:13px;font-weight:600;color:#ffffffcc;">${esc(formattedDate)}</span></td>
        </tr>
        <tr>
          <td style="padding:9px 0;"><span style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#ffffff28;">Location</span></td>
          <td style="padding:9px 0;text-align:right;"><span style="font-size:13px;font-weight:600;color:#ffffffcc;">${esc(eventLocation)}</span></td>
        </tr>
        <tr>
          <td style="padding:9px 0;"><span style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#ffffff28;">Tickets</span></td>
          <td style="padding:9px 0;text-align:right;"><span style="font-size:13px;font-weight:600;color:#ffffffcc;">${qty} &times; ${fmt(unitPriceCents)}</span></td>
        </tr>
        <tr>
          <td style="padding:9px 0;"><span style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#ffffff28;">Total Paid</span></td>
          <td style="padding:9px 0;text-align:right;"><span style="font-size:16px;font-weight:800;color:${a};">${fmt(totalPaidCents)}</span></td>
        </tr>
      </table>
      <div style="border-top:1px dashed #ffffff12;margin:20px 0;"></div>
      <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#ffffff25;">Order</p>
      <p style="margin:0;font-size:12px;font-family:monospace;color:#ffffff50;word-break:break-all;">${esc(doc.id)}</p>
    </div>
    <div style="background:#fff;padding:24px 36px;text-align:center;border-top:1px solid #e0e0e0;border-bottom:1px solid #e0e0e0;">
      <p style="margin:0 0 14px;font-size:10px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#000;">&#128241;&nbsp; Scan at the Door</p>
      <img src="${qr}" alt="Ticket QR Code" width="200" height="200" style="display:block;margin:0 auto;border:none;width:200px;height:200px;"/>
      <p style="margin:10px 0 0;font-size:9px;color:#aaa;font-family:monospace;word-break:break-all;">${esc(doc.id)}</p>
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
    body: JSON.stringify({ from: "ALL ACCESS <hello@allaccesswinnipeg.ca>", to: [toEmail], subject, html }),
  });
  const result = await resp.json();
  if (!resp.ok) { console.error(`✗ ${doc.id} → ${toEmail}: ${JSON.stringify(result)}`); }
  else { console.log(`✓ ${doc.id} → ${toEmail} (${qty}×) — ${result.id}`); sent++; }
  await new Promise(r => setTimeout(r, 350));
}

console.log(`\n✅ Done — ${sent} sent, ${skipped} skipped`);
process.exit(0);
