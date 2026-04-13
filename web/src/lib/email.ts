// Email delivery module — ALL ACCESS by TakersLifestyle
// Provider: Resend (resend.com) — serverless-safe, Vercel-native
//
// SEND POINTS (both called from webhook/route.ts — never from the client):
//   sendMembershipWelcome()  → after syncUser() in checkout.session.completed (subscription)
//   sendTicketConfirmation() → after Firestore transaction in checkout.session.completed (event_ticket)
//
// IDEMPOTENCY:
//   Each function checks a sentinel field on the Firestore document before sending:
//     users/{uid}.welcomeEmailSentAt
//     ticketOrders/{orderId}.confirmationEmailSentAt
//   If the field exists the send is skipped — safe for Stripe webhook retries.

import { Resend } from "resend";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { membershipWelcomeHtml } from "@/lib/emails/membership-welcome";
import { ticketConfirmationHtml } from "@/lib/emails/ticket-confirmation";

// ── Client ────────────────────────────────────────────────────────────────────
const resend = new Resend(process.env.RESEND_API_KEY!);

const FROM_ADDRESS = "ALL ACCESS <hello@allaccesswinnipeg.ca>";
const APP_URL = process.env.APP_URL ?? "https://allaccesswinnipeg.ca";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extract a usable first name from displayName or email */
function extractFirstName(displayName?: string | null, email?: string | null): string {
  if (displayName) {
    const first = displayName.trim().split(/\s+/)[0];
    if (first) return first;
  }
  if (email) {
    const local = email.split("@")[0];
    const clean = local.replace(/^[^a-zA-Z]+/, "").split(/[._\-+]/)[0];
    if (clean) return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
  }
  return "there";
}

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(isoOrTimestamp: string | number): string {
  try {
    const d = typeof isoOrTimestamp === "number"
      ? new Date(isoOrTimestamp * 1000)
      : new Date(isoOrTimestamp);
    return d.toLocaleDateString("en-CA", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
  } catch {
    return String(isoOrTimestamp);
  }
}

// ── sendMembershipWelcome ─────────────────────────────────────────────────────
export async function sendMembershipWelcome({
  uid,
  toEmail,
  displayName,
  amountPaidCents,
  stripeSessionId,
  paidAt,
}: {
  uid: string;
  toEmail: string;
  displayName?: string | null;
  amountPaidCents: number;
  stripeSessionId: string;
  paidAt: number; // Unix timestamp from Stripe session.created
}): Promise<void> {
  const db = adminDb();
  const userRef = db.collection("users").doc(uid);

  // ── Idempotency check ──────────────────────────────────────────────────────
  const userSnap = await userRef.get();
  if (userSnap.exists && userSnap.data()?.welcomeEmailSentAt) {
    console.log(`[email] membership welcome already sent for uid=${uid} — skipping`);
    return;
  }

  // Resolve display name from Firebase Auth if not provided
  let resolvedName = displayName ?? null;
  if (!resolvedName) {
    try {
      const auth = adminAuth();
      const userRecord = await auth.getUser(uid);
      resolvedName = userRecord.displayName ?? null;
    } catch { /* no-op */ }
  }

  const firstName = extractFirstName(resolvedName, toEmail);
  const html = membershipWelcomeHtml({
    firstName,
    amountPaid: formatCurrency(amountPaidCents),
    date: formatDate(paidAt),
    transactionId: stripeSessionId,
    loginUrl: `${APP_URL}/login`,
  });

  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: toEmail,
    subject: `Welcome to ALL ACCESS, ${firstName} 🎉 You're officially in.`,
    html,
  });

  if (error) {
    console.error(`[email] failed to send membership welcome to ${toEmail}:`, error);
    throw new Error(`Email send failed: ${JSON.stringify(error)}`);
  }

  // Mark sent — prevents re-send on webhook retry
  await userRef.set({ welcomeEmailSentAt: new Date().toISOString() }, { merge: true });
  console.log(`[email] membership welcome sent to ${toEmail} (uid=${uid})`);
}

// ── sendTicketConfirmation ────────────────────────────────────────────────────
export async function sendTicketConfirmation({
  orderId,
  toEmail,
  displayName,
  eventTitle,
  eventDate,
  eventLocation,
  quantity,
  unitPriceCents,
  totalPaidCents,
  stripePaymentIntentId,
  paidAt,
}: {
  orderId: string;
  toEmail: string;
  displayName?: string | null;
  eventTitle: string;
  eventDate: string;       // YYYY-MM-DD from Firestore
  eventLocation: string;
  quantity: number;
  unitPriceCents: number;
  totalPaidCents: number;
  stripePaymentIntentId: string;
  paidAt: string;          // ISO string
}): Promise<void> {
  const db = adminDb();
  const orderRef = db.collection("ticketOrders").doc(orderId);

  // ── Idempotency check ──────────────────────────────────────────────────────
  const orderSnap = await orderRef.get();
  if (orderSnap.exists && orderSnap.data()?.confirmationEmailSentAt) {
    console.log(`[email] ticket confirmation already sent for orderId=${orderId} — skipping`);
    return;
  }

  const firstName = extractFirstName(displayName, toEmail);

  const formattedEventDate = (() => {
    try {
      return new Date(eventDate + "T12:00:00").toLocaleDateString("en-CA", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
      });
    } catch { return eventDate; }
  })();

  const html = ticketConfirmationHtml({
    firstName,
    eventTitle,
    eventDate: formattedEventDate,
    eventLocation,
    quantity,
    unitPrice: formatCurrency(unitPriceCents),
    totalPaid: formatCurrency(totalPaidCents),
    orderId,
    transactionId: stripePaymentIntentId,
    paidAt: formatDate(paidAt),
    eventsUrl: `${APP_URL}/events`,
  });

  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: toEmail,
    subject: `Your ticket is confirmed — ${eventTitle} ✅`,
    html,
  });

  if (error) {
    console.error(`[email] failed to send ticket confirmation to ${toEmail}:`, error);
    throw new Error(`Email send failed: ${JSON.stringify(error)}`);
  }

  // Mark sent — prevents re-send on webhook retry
  await orderRef.set({ confirmationEmailSentAt: new Date().toISOString() }, { merge: true });
  console.log(`[email] ticket confirmation sent to ${toEmail} (orderId=${orderId})`);
}
