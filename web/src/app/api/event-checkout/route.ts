// Event ticket checkout — open to ALL users (public + members)
// Members automatically receive discounted pricing server-side
// Pricing always read from Firestore — never trusted from frontend

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb, adminAuth } from "@/lib/firebase-admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// APP_URL must be an absolute URL — Stripe rejects relative URLs
const APP_URL = (process.env.APP_URL ?? "https://allaccesswinnipeg.ca").replace(/\/$/, "");

const MIN_QUANTITY = 1;
const MAX_QUANTITY = 5;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { eventId, quantity, uid, userEmail } = body as {
      eventId: string;
      quantity: number;
      uid?: string;
      userEmail?: string;
    };

    // ── 1. Validate inputs ──────────────────────────────────
    if (!eventId || typeof eventId !== "string" || !eventId.trim()) {
      return NextResponse.json({ error: "Missing or invalid eventId." }, { status: 400 });
    }

    const qty = Math.floor(Number(quantity));
    if (isNaN(qty) || qty < MIN_QUANTITY || qty > MAX_QUANTITY) {
      return NextResponse.json(
        { error: `Quantity must be between ${MIN_QUANTITY} and ${MAX_QUANTITY}.` },
        { status: 400 }
      );
    }

    // ── 2. Load event from Firestore ────────────────────────
    const db = adminDb();
    const eventDoc = await db.collection("events").doc(eventId.trim()).get();

    if (!eventDoc.exists) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    const event = eventDoc.data()!;

    // ── 3. Validate event payload ───────────────────────────
    if (!event.title || typeof event.title !== "string" || !event.title.trim()) {
      console.error(`[event-checkout] Event ${eventId} is missing a title.`);
      return NextResponse.json({ error: "Event is missing required data." }, { status: 400 });
    }

    if (event.status !== "active") {
      return NextResponse.json(
        { error: "This event is no longer available for purchase." },
        { status: 400 }
      );
    }

    if (!event.imageUrl) {
      console.warn(`[event-checkout] Event ${eventId} has no imageUrl — proceeding without image.`);
    }

    // ── 4. Check capacity ───────────────────────────────────
    const capacity = typeof event.capacity === "number" ? event.capacity : 0;
    const remaining =
      typeof event.ticketsRemaining === "number" ? event.ticketsRemaining : capacity;

    if (capacity > 0 && remaining < qty) {
      return NextResponse.json(
        { error: `Only ${remaining} ticket${remaining === 1 ? "" : "s"} remaining.` },
        { status: 400 }
      );
    }

    // ── 5. Resolve membership status ────────────────────────
    // All users can purchase tickets — members receive discounted pricing
    let isMember = false;
    if (uid) {
      try {
        const auth = adminAuth();
        const userRecord = await auth.getUser(uid);
        const claims = userRecord.customClaims as
          | { role?: string; status?: string }
          | undefined;
        isMember = claims?.role === "admin" || claims?.status === "active";
      } catch (claimsErr) {
        console.warn("[event-checkout] Could not resolve membership claims:", claimsErr);
        isMember = false;
      }
    }

    // ── 6. Server-side pricing (never trust frontend) ───────
    const memberPrice = Number(event.memberPrice) || 0;
    const generalPrice = Number(event.generalPrice) || 0;

    // Price resolution order:
    //   Member  → memberPrice if set, else generalPrice
    //   Public  → generalPrice if set, else memberPrice (open-access fallback)
    const unitPriceDollars: number =
      isMember && memberPrice > 0
        ? memberPrice
        : generalPrice > 0
        ? generalPrice
        : memberPrice;

    if (!unitPriceDollars || isNaN(unitPriceDollars) || unitPriceDollars <= 0) {
      console.error(
        `[event-checkout] Event ${eventId} has no valid price. ` +
        `memberPrice=${memberPrice}, generalPrice=${generalPrice}`
      );
      return NextResponse.json(
        { error: "Ticket pricing is not available for this event." },
        { status: 400 }
      );
    }

    // unit_amount must be an integer number of cents
    const unitPriceCents = Math.round(unitPriceDollars * 100);

    const savingsPerTicket =
      isMember && memberPrice > 0 && generalPrice > 0 ? generalPrice - memberPrice : 0;

    // ── 7. Create pending ticketOrder in Firestore ──────────
    const orderRef = db.collection("ticketOrders").doc();
    await orderRef.set({
      orderId: orderRef.id,
      userId: uid ?? null,
      userEmail: userEmail ?? null,
      eventId,
      eventTitle: event.title,
      quantity: qty,
      unitPrice: unitPriceDollars,
      unitPriceCents,
      totalPrice: unitPriceDollars * qty,
      isMemberPrice: isMember && memberPrice > 0,
      savingsTotal: savingsPerTicket * qty,
      paymentStatus: "pending",
      stripeCheckoutSessionId: null,
      stripePaymentIntentId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // ── 8. Build Stripe line item description ───────────────
    const eventDateStr = event.date
      ? new Date(event.date + "T12:00:00").toLocaleDateString("en-CA", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : null;

    const descParts = [
      eventDateStr,
      event.location ?? null,
      isMember && savingsPerTicket > 0
        ? `Member rate — you save $${savingsPerTicket}/ticket`
        : null,
    ].filter(Boolean);

    // ── 9. Create Stripe Checkout Session ───────────────────
    // success_url and cancel_url must be absolute URLs
    const successUrl = `${APP_URL}/events?order=success&orderId=${orderRef.id}`;
    const cancelUrl = `${APP_URL}/events?order=cancel&eventId=${eventId}`;

    console.log(
      `[event-checkout] Creating session | event="${event.title}" qty=${qty} ` +
      `unitPriceCents=${unitPriceCents} isMember=${isMember} ` +
      `successUrl=${successUrl}`
    );

    // Cast to any: automatic_payment_methods is valid at runtime in Stripe API
    // v22 (2026-01-28.clover) but is absent from the SDK's SessionCreateParams
    // TypeScript type. payment_method_types:["card"] was removed in v22.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sessionParams: any = {
      mode: "payment",
      automatic_payment_methods: { enabled: true },
      line_items: [
        {
          price_data: {
            currency: "cad",
            unit_amount: unitPriceCents,           // integer cents e.g. $45 → 4500
            product_data: {
              name: event.title,
              description: descParts.join(" · ") || undefined,
              ...(event.imageUrl ? { images: [event.imageUrl] } : {}),
            },
          },
          quantity: qty,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      ...(uid ? { client_reference_id: uid } : {}),
      ...(userEmail ? { customer_email: userEmail } : {}),
      metadata: {
        orderId: orderRef.id,
        eventId,
        quantity: String(qty),
        userId: uid ?? "",
        type: "event_ticket",
      },
      payment_intent_data: {
        metadata: {
          orderId: orderRef.id,
          eventId,
          quantity: String(qty),
          userId: uid ?? "",
          type: "event_ticket",
        },
      },
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    // ── 10. Store session ID on pending order ───────────────
    await orderRef.update({
      stripeCheckoutSessionId: session.id,
      updatedAt: new Date().toISOString(),
    });

    console.log(
      `[event-checkout] Session created | sessionId=${session.id} orderId=${orderRef.id}`
    );

    return NextResponse.json({ url: session.url });

  } catch (err: unknown) {
    // Detailed error logging — surface Stripe API errors clearly
    if (err instanceof Stripe.errors.StripeError) {
      console.error(
        `[event-checkout] Stripe error | type=${err.type} code=${err.code} ` +
        `message="${err.message}"`
      );
      // Return the Stripe message directly — it's user-safe for most error types
      return NextResponse.json(
        { error: err.message ?? "Payment provider error. Please try again." },
        { status: 400 }
      );
    }

    const message = err instanceof Error ? err.message : String(err);
    console.error("[event-checkout] Unexpected error:", message);
    return NextResponse.json(
      { error: "Checkout failed. Please try again or contact support." },
      { status: 500 }
    );
  }
}
