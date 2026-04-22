// Event ticket checkout — open to ALL signed-in users (members get 15% off)
// Pricing always read from Firestore — never trusted from frontend
// Member discount: MEMBER_DISCOUNT (15%) off generalPrice, calculated server-side

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb, adminAuth } from "@/lib/firebase-admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// APP_URL must be an absolute URL — Stripe rejects relative URLs
const APP_URL = (process.env.APP_URL ?? "https://allaccesswinnipeg.ca").replace(/\/$/, "");

const MIN_QUANTITY = 1;
const MAX_QUANTITY = 5;

// ── Member discount constant ────────────────────────────────────────────────
// Active members receive exactly 15% off generalPrice, calculated server-side.
// Frontend displays the same calculation — these must stay in sync.
const MEMBER_DISCOUNT = 0.15;

function applyMemberDiscount(price: number): number {
  return Math.round(price * (1 - MEMBER_DISCOUNT) * 100) / 100;
}

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
    // All signed-in users can purchase — active members get 15% discount
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

    // ── 6. Server-side pricing ──────────────────────────────
    // generalPrice is the single source of truth from Firestore.
    // Members receive MEMBER_DISCOUNT (15%) off — calculated here, never from frontend.
    const generalPrice = Number(event.generalPrice) || 0;

    if (!generalPrice || isNaN(generalPrice) || generalPrice <= 0) {
      console.error(
        `[event-checkout] Event ${eventId} has no valid generalPrice. ` +
        `generalPrice=${generalPrice}`
      );
      return NextResponse.json(
        { error: "Ticket pricing is not available for this event." },
        { status: 400 }
      );
    }

    // Apply 15% member discount server-side
    const unitPriceDollars: number = isMember
      ? applyMemberDiscount(generalPrice)
      : generalPrice;

    // unit_amount must be an integer number of cents
    const unitPriceCents = Math.round(unitPriceDollars * 100);

    const savingsPerTicket = isMember
      ? Math.round(generalPrice * MEMBER_DISCOUNT * 100) / 100
      : 0;

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
      isMemberPrice: isMember,
      memberDiscountPct: isMember ? MEMBER_DISCOUNT * 100 : 0,
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
      isMember
        ? `Member rate — 15% off (saving $${savingsPerTicket.toFixed(2)}/ticket)`
        : null,
    ].filter(Boolean);

    // ── 9. Create Stripe Checkout Session ───────────────────
    const successUrl = `${APP_URL}/events?order=success&orderId=${orderRef.id}`;
    const cancelUrl = `${APP_URL}/events?order=cancel&eventId=${eventId}`;

    // Only pass images to Stripe if the URL is absolute (Stripe rejects relative paths)
    const imageUrl = typeof event.imageUrl === "string" && event.imageUrl.startsWith("http")
      ? event.imageUrl
      : null;

    console.log(
      `[event-checkout] Creating session | event="${event.title}" qty=${qty} ` +
      `generalPrice=${generalPrice} unitPriceCents=${unitPriceCents} ` +
      `isMember=${isMember} discount=${isMember ? "15%" : "none"} imageUrl=${imageUrl ?? "none"}`
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sessionParams: any = {
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "cad",
            unit_amount: unitPriceCents, // integer cents — e.g. $85 member price on $100 event → 8500
            product_data: {
              name: event.title,
              description: descParts.join(" · ") || undefined,
              ...(imageUrl ? { images: [imageUrl] } : {}),
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
        isMemberPrice: String(isMember),
        discountPct: isMember ? "15" : "0",
      },
      payment_intent_data: {
        metadata: {
          orderId: orderRef.id,
          eventId,
          quantity: String(qty),
          userId: uid ?? "",
          type: "event_ticket",
          isMemberPrice: String(isMember),
          discountPct: isMember ? "15" : "0",
        },
      },
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    if (!session.url) {
      console.error(`[event-checkout] Stripe returned no URL | sessionId=${session.id}`);
      return NextResponse.json({ error: "Payment session created but no redirect URL returned." }, { status: 500 });
    }

    // ── 10. Store session ID on pending order ───────────────
    await orderRef.update({
      stripeCheckoutSessionId: session.id,
      updatedAt: new Date().toISOString(),
    });

    console.log(
      `[event-checkout] Session created | sessionId=${session.id} orderId=${orderRef.id} ` +
      `unitPriceDollars=${unitPriceDollars} isMember=${isMember}`
    );

    return NextResponse.json({ url: session.url });

  } catch (err: unknown) {
    // Duck-type Stripe errors — instanceof can fail under Turbopack module bundling
    const maybeStripe = err as Record<string, unknown>;
    const isStripeError =
      typeof maybeStripe?.type === "string" &&
      (maybeStripe.type.toLowerCase().includes("stripe") ||
        typeof maybeStripe?.statusCode === "number");

    if (isStripeError) {
      const stripeMsg = typeof maybeStripe.message === "string"
        ? maybeStripe.message
        : "Payment provider error. Please try again.";
      console.error(
        `[event-checkout] Stripe error | type=${maybeStripe.type} ` +
        `code=${maybeStripe.code ?? "n/a"} message="${stripeMsg}"`
      );
      return NextResponse.json({ error: stripeMsg }, { status: 400 });
    }

    const message = err instanceof Error ? err.message : String(err);
    console.error("[event-checkout] Unexpected error:", message);
    return NextResponse.json(
      { error: `Checkout failed: ${message}` },
      { status: 500 }
    );
  }
}
