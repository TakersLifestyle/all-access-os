/**
 * Find DJ LANKZ ticket order for savannah.rosss12@gmail.com and resend confirmation
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const serviceAccount = JSON.parse(
  process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ||
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY || "{}"
);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SKALES_EVENT_ID = "EQIimnVZ5jPhVKPLyAJ2";
const CUSTOMER_EMAIL = "savannah.rosss12@gmail.com";

// Dump all ticketOrders for the Skales event to find the order
const snap = await db.collection("ticketOrders")
  .where("eventId", "==", SKALES_EVENT_ID)
  .get();

console.log(`Found ${snap.size} orders for Skales event:\n`);
snap.forEach(doc => {
  const d = doc.data();
  console.log(`Order: ${doc.id}`);
  console.log(`  userEmail: ${d.userEmail}`);
  console.log(`  status:    ${d.paymentStatus}`);
  console.log(`  qty:       ${d.quantity}`);
  console.log(`  emailSent: ${d.confirmationEmailSentAt ? "YES" : "NO"}`);
  console.log();
});

// Find the matching order (case-insensitive)
const orderDoc = snap.docs.find(d => {
  const email = (d.data().userEmail ?? "").toLowerCase();
  return email === CUSTOMER_EMAIL.toLowerCase() ||
         email.includes("savannah") ||
         d.data().paymentStatus === "paid" && d.data().quantity === 2;
});

if (!orderDoc) {
  console.log("❌ Could not match an order. Check emails above manually.");
  process.exit(0);
}

const order = orderDoc.data();
const orderId = orderDoc.id;
const toEmail = order.userEmail ?? CUSTOMER_EMAIL;
const qty = order.quantity ?? 2;

console.log(`\n✅ Matched order: ${orderId}`);
console.log(`   Sending to: ${toEmail} (qty ${qty})`);

const ticketLines = Array.from({ length: qty }, (_, i) =>
  `<li style="margin-bottom:6px">🎟 Ticket #${i + 1} — General Admission · Oct 9, 2026</li>`
).join("\n");

const res = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${RESEND_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    from: "ALL ACCESS <hello@allaccesswinnipeg.ca>",
    to: toEmail,
    subject: "Your Tickets — DJ LANKZ & FRIENDS ft. SKALES",
    html: `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#000;color:#fff;padding:32px;border-radius:12px">
  <h1 style="color:#84cc16;font-size:26px;margin-bottom:4px">You're in. 🎟</h1>
  <p style="color:#aaa;margin-top:0">Ticket confirmation for <strong style="color:#fff">DJ LANKZ & FRIENDS ft. SKALES</strong></p>

  <div style="background:#111;border:1px solid #222;border-radius:8px;padding:20px;margin:24px 0">
    <p style="margin:0 0 8px"><strong>Event:</strong> DJ LANKZ & FRIENDS ft. SKALES LIVE IN WINNIPEG</p>
    <p style="margin:0 0 8px"><strong>Date:</strong> Friday, October 9, 2026</p>
    <p style="margin:0 0 8px"><strong>Doors:</strong> 10:00 PM</p>
    <p style="margin:0 0 8px"><strong>Venue:</strong> Savana · 625 Portage Ave, Winnipeg MB</p>
    <p style="margin:0 0 8px"><strong>Tickets (${qty}):</strong></p>
    <ul style="color:#84cc16;margin:8px 0 0 0;padding-left:18px">
      ${ticketLines}
    </ul>
  </div>

  <p style="color:#888;font-size:13px">Show this email (or your order confirmation) at the door. Doors open 10 PM.</p>
  <p style="color:#888;font-size:13px">Questions? <a href="mailto:hello@allaccesswinnipeg.ca" style="color:#84cc16">hello@allaccesswinnipeg.ca</a></p>

  <hr style="border:none;border-top:1px solid #222;margin:24px 0">
  <p style="color:#444;font-size:12px;text-align:center">ALL ACCESS Winnipeg · allaccesswinnipeg.ca</p>
</div>
    `,
  }),
});

const result = await res.json();
if (!res.ok) {
  console.error("❌ Resend error:", result);
  process.exit(1);
}

console.log("✅ Confirmation email sent! Resend ID:", result.id);

await db.collection("ticketOrders").doc(orderId).update({
  confirmationEmailSentAt: FieldValue.serverTimestamp(),
  confirmationEmailResent: true,
});
console.log("   Firestore updated.");
process.exit(0);
