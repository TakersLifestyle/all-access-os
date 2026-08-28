/**
 * Resend ticket confirmation email for a customer who didn't receive it.
 * Usage: node --env-file=.env.local ../functions/resend-ticket-confirmation.mjs
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const serviceAccount = JSON.parse(
  process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ||
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY || "{}"
);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const CUSTOMER_EMAIL = "savannah.rosss12@gmail.com";
const RESEND_API_KEY = process.env.RESEND_API_KEY;

// 1. Find the ticket order
const snap = await db.collection("ticketOrders")
  .where("userEmail", "==", CUSTOMER_EMAIL)
  .get();

if (snap.empty) {
  console.log("❌ No ticket orders found for", CUSTOMER_EMAIL);
  process.exit(1);
}

snap.forEach(doc => {
  const d = doc.data();
  console.log(`\n📋 Order: ${doc.id}`);
  console.log(`   Event:    ${d.eventId}`);
  console.log(`   Qty:      ${d.quantity}`);
  console.log(`   Status:   ${d.paymentStatus}`);
  console.log(`   Email:    ${d.userEmail}`);
  console.log(`   EmailSent: ${d.confirmationEmailSentAt ? "YES — " + d.confirmationEmailSentAt.toDate() : "NO"}`);
  console.log(`   Tickets:  ${JSON.stringify(d.ticketCodes ?? d.tickets ?? [])}`);
});

// 2. Take the most recent paid order
const orderDoc = snap.docs.find(d => d.data().paymentStatus === "paid");
if (!orderDoc) {
  console.log("\n❌ No paid order found — payment may not have settled in Firestore yet.");
  process.exit(1);
}

const order = orderDoc.data();
const orderId = orderDoc.id;

if (order.confirmationEmailSentAt) {
  console.log("\n⚠️  Email already sent at", order.confirmationEmailSentAt.toDate());
  console.log("   Resending anyway (customer request)...");
}

// 3. Look up the event name
const eventDoc = await db.collection("events").doc(order.eventId).get();
const eventName = eventDoc.exists ? eventDoc.data().title : "DJ LANKZ & FRIENDS";
const eventDate = eventDoc.exists ? eventDoc.data().date : "Friday, October 9, 2026";
const eventVenue = eventDoc.exists ? eventDoc.data().venue : "Savana · 625 Portage Ave, Winnipeg MB";

// 4. Build ticket list
const qty = order.quantity ?? 1;
const ticketLines = Array.from({ length: qty }, (_, i) => `<li>Ticket #${i + 1} — General Admission</li>`).join("\n");

// 5. Send via Resend
const emailBody = {
  from: "ALL ACCESS <hello@allaccesswinnipeg.ca>",
  to: CUSTOMER_EMAIL,
  subject: `Your Tickets — ${eventName}`,
  html: `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#000;color:#fff;padding:32px;border-radius:12px">
      <h1 style="color:#84cc16;font-size:28px;margin-bottom:4px">You're in. 🎟</h1>
      <p style="color:#aaa;margin-top:0">Ticket confirmation for <strong style="color:#fff">${eventName}</strong></p>

      <div style="background:#111;border:1px solid #222;border-radius:8px;padding:20px;margin:24px 0">
        <p style="margin:0 0 8px"><strong>Event:</strong> ${eventName}</p>
        <p style="margin:0 0 8px"><strong>Date:</strong> ${eventDate}</p>
        <p style="margin:0 0 8px"><strong>Venue:</strong> ${eventVenue}</p>
        <p style="margin:0 0 8px"><strong>Tickets (${qty}):</strong></p>
        <ul style="color:#84cc16;margin:8px 0 0 16px;padding:0">
          ${ticketLines}
        </ul>
      </div>

      <p style="color:#888;font-size:13px">Show this email at the door. Doors open 10 PM.</p>
      <p style="color:#888;font-size:13px">Questions? <a href="mailto:hello@allaccesswinnipeg.ca" style="color:#84cc16">hello@allaccesswinnipeg.ca</a></p>

      <hr style="border:none;border-top:1px solid #222;margin:24px 0">
      <p style="color:#444;font-size:12px;text-align:center">ALL ACCESS Winnipeg · allaccesswinnipeg.ca</p>
    </div>
  `,
};

const res = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify(emailBody),
});

const result = await res.json();
if (!res.ok) {
  console.error("\n❌ Resend error:", result);
  process.exit(1);
}

console.log("\n✅ Email sent! Resend ID:", result.id);

// 6. Mark as sent in Firestore (update sentinel)
await db.collection("ticketOrders").doc(orderId).update({
  confirmationEmailSentAt: new Date(),
  confirmationEmailResent: true,
});
console.log("   Firestore updated — confirmationEmailSentAt set.");
process.exit(0);
