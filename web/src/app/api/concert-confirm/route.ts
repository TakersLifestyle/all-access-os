// Called immediately from the success page after Stripe redirects back.
// Verifies payment, marks order paid, and sends confirmation email — no webhook wait.

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb } from "@/lib/firebase-admin";
import { sendTicketConfirmation } from "@/lib/email";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { orderId, sessionId } = await req.json() as { orderId: string; sessionId: string };

    if (!orderId?.trim() || !sessionId?.trim()) {
      return NextResponse.json({ error: "Missing orderId or sessionId." }, { status: 400 });
    }

    // 1. Verify with Stripe that the session is actually paid
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      return NextResponse.json({ error: "Payment not confirmed." }, { status: 402 });
    }

    // 2. Load order from Firestore
    const db = adminDb();
    const orderRef = db.collection("ticketOrders").doc(orderId.trim());
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }
    const order = orderSnap.data()!;

    // 3. Mark paid if not already (webhook may not have fired yet)
    if (order.paymentStatus !== "paid") {
      await orderRef.update({
        paymentStatus: "paid",
        stripePaymentIntentId: session.payment_intent as string ?? null,
        updatedAt: new Date().toISOString(),
      });
    }

    // 4. Resolve email address
    const toEmail: string | null =
      (order.userEmail as string | null) ??
      session.customer_details?.email ??
      null;

    // 5. Send confirmation email (idempotent — skips if already sent)
    if (toEmail) {
      await sendTicketConfirmation({
        orderId,
        toEmail,
        displayName: null,
        eventTitle: order.eventTitle as string,
        eventDate: "2026-08-05",
        eventLocation: "Pyramid Cabaret · 176 Fort St, Winnipeg, MB",
        quantity: order.quantity as number,
        unitPriceCents: order.unitPriceCents as number,
        totalPaidCents: Math.round((order.totalPrice as number) * 100),
        stripePaymentIntentId: (session.payment_intent as string) ?? "",
        paidAt: new Date().toISOString(),
      }).catch((err) => console.error("[concert-confirm] email error:", err));
    }

    // 6. Return order data for the success screen
    return NextResponse.json({
      ok: true,
      email: toEmail,
      eventTitle: order.eventTitle,
      ticketTierName: order.ticketTierName,
      quantity: order.quantity,
      totalPrice: order.totalPrice,
      orderId,
    });
  } catch (err) {
    console.error("[concert-confirm] error:", err);
    return NextResponse.json({ error: "Confirmation failed." }, { status: 500 });
  }
}
