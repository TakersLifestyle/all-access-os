// Concert ticket checkout — tiered pricing read from Firestore ticketTiers
// Student $40 | Regular $50 | VIP $70 — server-side pricing only

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb } from "@/lib/firebase-admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const APP_URL = (process.env.APP_URL ?? "https://allaccesswinnipeg.ca").replace(/\/$/, "");

const VALID_TICKET_TYPES = ["student", "regular", "vip"] as const;
type TicketType = (typeof VALID_TICKET_TYPES)[number];

const MIN_QUANTITY = 1;
const MAX_QUANTITY = 10;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { eventId, ticketType, quantity, uid, userEmail } = body as {
      eventId: string;
      ticketType: string;
      quantity: number;
      uid?: string;
      userEmail?: string;
    };

    // 1. Validate inputs
    if (!eventId?.trim()) {
      return NextResponse.json({ error: "Missing eventId." }, { status: 400 });
    }
    if (!VALID_TICKET_TYPES.includes(ticketType as TicketType)) {
      return NextResponse.json({ error: "Invalid ticket type." }, { status: 400 });
    }
    const qty = Math.floor(Number(quantity));
    if (isNaN(qty) || qty < MIN_QUANTITY || qty > MAX_QUANTITY) {
      return NextResponse.json(
        { error: `Quantity must be between ${MIN_QUANTITY} and ${MAX_QUANTITY}.` },
        { status: 400 }
      );
    }

    // 2. Load event from Firestore
    const db = adminDb();
    const eventDoc = await db.collection("events").doc(eventId.trim()).get();
    if (!eventDoc.exists) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }
    const event = eventDoc.data()!;

    // 3. Validate event state
    if (event.status !== "active") {
      return NextResponse.json(
        { error: "This event is no longer available for purchase." },
        { status: 400 }
      );
    }
    if (event.checkoutEnabled === false) {
      return NextResponse.json({ error: "Ticket sales are not yet open." }, { status: 400 });
    }

    // 4. Read server-side pricing from ticketTiers — never trust frontend price
    const tiers = event.ticketTiers as
      | Record<string, { name: string; price: number; description?: string }>
      | undefined;
    if (!tiers?.[ticketType]) {
      return NextResponse.json({ error: "Ticket tier not found." }, { status: 400 });
    }
    const tier = tiers[ticketType];
    const unitPriceDollars = Number(tier.price);
    if (!unitPriceDollars || unitPriceDollars <= 0) {
      return NextResponse.json({ error: "Invalid ticket price." }, { status: 400 });
    }
    const unitPriceCents = Math.round(unitPriceDollars * 100);

    // 5. Create pending ticketOrder doc
    const orderRef = db.collection("ticketOrders").doc();
    await orderRef.set({
      orderId: orderRef.id,
      userId: uid ?? null,
      userEmail: userEmail ?? null,
      eventId,
      eventTitle: event.title,
      ticketType,
      ticketTierName: tier.name,
      quantity: qty,
      unitPrice: unitPriceDollars,
      unitPriceCents,
      totalPrice: unitPriceDollars * qty,
      isMemberPrice: false,
      memberDiscountPct: 0,
      savingsTotal: 0,
      paymentStatus: "pending",
      stripeCheckoutSessionId: null,
      stripePaymentIntentId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 6. Build Stripe line item description
    const eventDateStr = event.date
      ? new Date(event.date + "T12:00:00").toLocaleDateString("en-CA", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : null;

    const descParts = [
      tier.name,
      eventDateStr,
      event.location ?? null,
      tier.description ?? null,
    ].filter(Boolean);

    const imageUrl =
      typeof event.imageUrl === "string" && event.imageUrl.startsWith("http")
        ? event.imageUrl
        : null;

    // 7. Create Stripe Checkout Session
    const successUrl = `${APP_URL}/events/rocafiesta-konfam?order=success&orderId=${orderRef.id}`;
    const cancelUrl = `${APP_URL}/events/rocafiesta-konfam?order=cancel`;

    console.log(
      `[concert-checkout] Creating session | event="${event.title}" tier=${ticketType} qty=${qty} ` +
        `unitPriceCents=${unitPriceCents}`
    );

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "cad",
            unit_amount: unitPriceCents,
            product_data: {
              name: `${event.title} — ${tier.name}`,
              description: descParts.join(" · ") || undefined,
              ...(imageUrl ? { images: [imageUrl] } : {}),
            },
          },
          quantity: qty,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      ...(uid ? { client_reference_id: uid } : {}),
      ...(userEmail ? { customer_email: userEmail } : {}),
      metadata: {
        orderId: orderRef.id,
        eventId,
        ticketType,
        quantity: String(qty),
        userId: uid ?? "",
        type: "event_ticket",
        isMemberPrice: "false",
        discountPct: "0",
      },
      payment_intent_data: {
        metadata: {
          orderId: orderRef.id,
          eventId,
          ticketType,
          quantity: String(qty),
          userId: uid ?? "",
          type: "event_ticket",
        },
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Payment session created but no redirect URL returned." },
        { status: 500 }
      );
    }

    await orderRef.update({
      stripeCheckoutSessionId: session.id,
      updatedAt: new Date().toISOString(),
    });

    console.log(
      `[concert-checkout] Session created | sessionId=${session.id} orderId=${orderRef.id} ` +
        `tier=${ticketType} qty=${qty} price=${unitPriceDollars}`
    );

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const maybeStripe = err as Record<string, unknown>;
    const isStripeError =
      typeof maybeStripe?.type === "string" &&
      (maybeStripe.type.toLowerCase().includes("stripe") ||
        typeof maybeStripe?.statusCode === "number");

    if (isStripeError) {
      const msg =
        typeof maybeStripe.message === "string"
          ? maybeStripe.message
          : "Payment provider error. Please try again.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const message = err instanceof Error ? err.message : String(err);
    console.error("[concert-checkout] Unexpected error:", message);
    return NextResponse.json({ error: `Checkout failed: ${message}` }, { status: 500 });
  }
}
