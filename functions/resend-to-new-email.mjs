import { initializeApp, cert } from "firebase-admin/app";

const serviceAccount = JSON.parse(
  process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ||
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY || "{}"
);
initializeApp({ credential: cert(serviceAccount) });

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const NEW_EMAIL = "savross28@gmail.com";
const QTY = 2;

const ticketLines = Array.from({ length: QTY }, (_, i) =>
  `<li style="margin-bottom:6px">🎟 Ticket #${i + 1} — General Admission · Oct 9, 2026</li>`
).join("\n");

const res = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    from: "ALL ACCESS <hello@allaccesswinnipeg.ca>",
    to: NEW_EMAIL,
    subject: "Your Tickets — DJ LANKZ & FRIENDS ft. SKALES",
    html: `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#000;color:#fff;padding:32px;border-radius:12px">
  <h1 style="color:#84cc16;font-size:26px;margin-bottom:4px">You're in. 🎟</h1>
  <p style="color:#aaa;margin-top:0">Ticket confirmation for <strong style="color:#fff">DJ LANKZ &amp; FRIENDS ft. SKALES</strong></p>
  <div style="background:#111;border:1px solid #222;border-radius:8px;padding:20px;margin:24px 0">
    <p style="margin:0 0 8px"><strong>Event:</strong> DJ LANKZ &amp; FRIENDS ft. SKALES LIVE IN WINNIPEG</p>
    <p style="margin:0 0 8px"><strong>Date:</strong> Friday, October 9, 2026</p>
    <p style="margin:0 0 8px"><strong>Doors:</strong> 10:00 PM</p>
    <p style="margin:0 0 8px"><strong>Venue:</strong> Savana · 625 Portage Ave, Winnipeg MB</p>
    <p style="margin:0 0 8px"><strong>Tickets (${QTY}):</strong></p>
    <ul style="color:#84cc16;margin:8px 0 0 0;padding-left:18px">${ticketLines}</ul>
  </div>
  <p style="color:#888;font-size:13px">Show this email at the door. Doors open 10 PM.</p>
  <p style="color:#888;font-size:13px">Questions? <a href="mailto:hello@allaccesswinnipeg.ca" style="color:#84cc16">hello@allaccesswinnipeg.ca</a></p>
  <hr style="border:none;border-top:1px solid #222;margin:24px 0">
  <p style="color:#444;font-size:12px;text-align:center">ALL ACCESS Winnipeg · allaccesswinnipeg.ca</p>
</div>`,
  }),
});

const result = await res.json();
if (!res.ok) { console.error("❌ Resend error:", result); process.exit(1); }
console.log("✅ Sent to", NEW_EMAIL, "— Resend ID:", result.id);
process.exit(0);
