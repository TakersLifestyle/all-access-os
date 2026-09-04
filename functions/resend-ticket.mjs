/**
 * Resend ticket confirmation email to a specific customer.
 * Run from: cd functions && node resend-ticket.mjs
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
// Using native fetch (Node 18+) — no resend package needed
import { readFileSync } from "fs";

const env = readFileSync("../web/.env.local", "utf8").split("\n");
const getEnv = k => env.find(l => l.startsWith(k + "="))?.slice(k.length + 1).trim();

initializeApp({ credential: cert(JSON.parse(getEnv("GOOGLE_APPLICATION_CREDENTIALS_JSON"))) });
const db = getFirestore();
const RESEND_API_KEY = getEnv("RESEND_API_KEY");

// The Sep 3 ROCAFIESTA purchase — neema.muthumwa@gmail.com
const PI_ID = "pi_3UBhDnARL4KX4f6A1KBSmEs9";
const SEND_TO = "neema.muthumwa@gmail.com";

// Find the order
const orders = await db.collection("ticketOrders")
  .where("stripePaymentIntentId", "==", PI_ID)
  .limit(1)
  .get();

if (orders.empty) {
  console.error("No order found for PI:", PI_ID);
  process.exit(1);
}

const order = orders.docs[0];
const o = order.data();
console.log("Order found:", order.id);
console.log("Data:", JSON.stringify(o, null, 2));

// Get event details
const eventDoc = await db.collection("events").doc(o.eventId).get();
const ev = eventDoc.data();

const quantity = o.quantity ?? 1;
const unitPrice = o.unitPrice ?? o.price ?? 2088;   // cents
const totalPaid = o.totalPaid ?? o.amountTotal ?? (unitPrice * quantity);

const fmt = cents => `$${(cents / 100).toFixed(2)}`;

// Build email HTML inline (no TS imports needed)
const accent = "#ec4899"; // pink for ROCAFIESTA
const html = buildHtml({
  firstName:     (o.userName ?? o.userEmail ?? "").split(" ")[0] || "Guest",
  eventTitle:    ev?.title ?? "ROCAFIESTA — A Spiritual Experience with Konfam",
  eventDate:     ev?.date ?? "Saturday, September 5, 2026",
  eventLocation: ev?.location ?? "Pyramid Cabaret · 176 Fort St, Winnipeg, MB",
  quantity,
  unitPrice:     fmt(unitPrice),
  totalPaid:     fmt(totalPaid),
  orderId:       order.id,
  transactionId: PI_ID,
  paidAt:        "Sep 3, 2026",
  accentColor:   accent,
});

const resp = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${RESEND_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    from:    "ALL ACCESS <hello@allaccesswinnipeg.ca>",
    to:      [SEND_TO],
    subject: `Your Ticket — ROCAFIESTA (Sep 5, 2026)`,
    html,
  }),
});

const result = await resp.json();
if (!resp.ok) {
  console.error("Resend error:", result);
  process.exit(1);
}

console.log(`\n✓ Ticket confirmation sent to ${SEND_TO}`);
console.log(`  Resend ID: ${result.id}`);
process.exit(0);

function escHtml(str) {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function buildHtml({ firstName, eventTitle, eventDate, eventLocation, quantity, unitPrice, totalPaid, orderId, transactionId, paidAt, accentColor }) {
  const a = accentColor;
  const ticketWord = quantity === 1 ? "ticket" : "tickets";
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Your Ticket — ${escHtml(eventTitle)}</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#fff;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 0;"><tr><td align="center">
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
    <h1 style="margin:0 0 6px;font-size:26px;font-weight:800;line-height:1.2;color:#fff;">${escHtml(eventTitle)}</h1>
    <p style="margin:0 0 28px;font-size:14px;color:#fff5;">${quantity} ${ticketWord} &bull; ${escHtml(totalPaid)} paid</p>
    <div style="border-top:1px dashed #fff1;margin-bottom:24px;"></div>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="padding:9px 0;"><span style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#fff3;">Date</span></td>
          <td style="padding:9px 0;text-align:right;"><span style="font-size:13px;font-weight:600;color:#fff9;">${escHtml(eventDate)}</span></td></tr>
      <tr><td style="padding:9px 0;"><span style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#fff3;">Location</span></td>
          <td style="padding:9px 0;text-align:right;"><span style="font-size:13px;font-weight:600;color:#fff9;">${escHtml(eventLocation)}</span></td></tr>
      <tr><td style="padding:9px 0;"><span style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#fff3;">Tickets</span></td>
          <td style="padding:9px 0;text-align:right;"><span style="font-size:13px;font-weight:600;color:#fff9;">${quantity} &times; ${escHtml(unitPrice)}</span></td></tr>
      <tr><td style="padding:9px 0;"><span style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#fff3;">Total Paid</span></td>
          <td style="padding:9px 0;text-align:right;"><span style="font-size:16px;font-weight:800;color:${a};">${escHtml(totalPaid)}</span></td></tr>
    </table>
    <div style="border-top:1px dashed #fff1;margin:24px 0;"></div>
    <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#fff2;">Order Confirmation</p>
    <p style="margin:0;font-size:14px;font-family:monospace;font-weight:600;letter-spacing:.06em;color:#fff6;word-break:break-all;">${escHtml(orderId)}</p>
  </div>
  <div style="background:${a}12;border-top:1px solid ${a}22;padding:18px 36px;text-align:center;">
    <p style="margin:0;font-size:13px;font-weight:700;color:${a};letter-spacing:.03em;">Show this email at the door &mdash; that&rsquo;s your ticket.</p>
    <p style="margin:6px 0 0;font-size:12px;color:#fff3;">Staff will pull up your order by name or email.</p>
  </div>
</td></tr>
<tr><td style="height:24px;"></td></tr>
<tr><td style="background:#0f0f0f;border:1px solid #fff1;border-radius:14px;padding:18px 24px;">
  <p style="margin:0 0 12px;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#fff2;">Receipt</p>
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="padding:6px 0;"><span style="font-size:12px;color:#fff3;">Order ID</span></td>
        <td style="padding:6px 0;text-align:right;"><span style="font-size:11px;font-family:monospace;color:#fff4;">${escHtml(orderId)}</span></td></tr>
    <tr><td style="padding:6px 0;"><span style="font-size:12px;color:#fff3;">Transaction</span></td>
        <td style="padding:6px 0;text-align:right;"><span style="font-size:11px;font-family:monospace;color:#fff4;">${escHtml(transactionId)}</span></td></tr>
    <tr><td style="padding:6px 0;"><span style="font-size:12px;color:#fff3;">Date</span></td>
        <td style="padding:6px 0;text-align:right;"><span style="font-size:12px;color:#fff4;">${escHtml(paidAt)}</span></td></tr>
  </table>
</td></tr>
<tr><td style="height:28px;"></td></tr>
<tr><td style="text-align:center;padding:0 16px;">
  <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.15em;color:${a};text-transform:uppercase;">ALL ACCESS</p>
  <p style="margin:0 0 14px;font-size:12px;color:#fff3;line-height:1.6;">Questions? <a href="mailto:hello@allaccesswinnipeg.ca" style="color:#fff4;text-decoration:none;">hello@allaccesswinnipeg.ca</a></p>
  <p style="margin:0;font-size:11px;color:#fff2;line-height:1.6;">You&rsquo;re receiving this because you purchased a ticket through ALL ACCESS.<br/>Winnipeg, MB, Canada</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}
