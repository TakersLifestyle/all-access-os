// Paint & Sip ticket checkout — tiered pricing with membership validation
// Public $85 | Community Access $70 | Supporting Members $60 — server-side pricing only

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb, adminAuth } from "@/lib/firebase-admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const APP_URL = (process.env.APP_URL ?? "https://allaccesswinnipeg.ca").replace(/\/$/, "");

const VALID_TICKET_TYPES = ["public", "community", "supporter"] as const;
type TicketType = (typeof VALID_TICKET_TYPES)[number];

const MIN_QUANTITY = 1;
const MAX_QUANTITY = 6;

// Decode user claims from Bearer token (optional — used for tier eligibility check)
async function getClaimsFromHeader(authHeader: string | null) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    return await adminAuth().verifyIdToken(authHeader.slice(7));
  } catch {
    return null;
  }
}

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

    // 2. Validate tier eligibility via claims
    const claims = await getClaimsFromHeader(req.headers.get("Authorization"));
    if (ticketType === "community") {
      const hasCommunityAccess =
        claims?.hasCommunityAccess === true ||
        claims?.role === "admin" ||
        (claims?.status === "active");
      if (!hasCommunityAccess) {
        return NextResponse.json(
          { error: "Community Access tier requires a community account. Please select Public." },
          { status: 403 }
        );
      }
    }
    if (ticketType === "supporter") {
      const isSupporter =
        claims?.role === "admin" ||
        (claims?.status === "active" && claims?.accountType === "supporter");
      if (!isSupporter) {
        return NextResponse.json(
          { error: "Supporting Member tier requires an active membership." },
          { status: 403 }
        );
      }
    }

    // 3. Load event from Firestore
    const db = adminDb();
    const eventDoc = await db.collection("events").doc(eventId.trim()).get();
    if (!eventDoc.exists) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }
    const event = eventDoc.data()!;

    // 4. Validate event state
    if (event.status !== "active") {
      return NextResponse.json(
        { error: "This event is no longer available for purchase." },
        { status: 400 }
      );
    }
    if (event.checkoutEnabled === false) {
      return NextResponse.json({ error: "Ticket sales are not yet open." }, { status: 400 });
    }

    // 5. Capacity check
    if (typeof event.ticketsRemaining === "number" && event.ticketsRemaining < qty) {
      return NextResponse.json(
        { error: `Only ${event.ticketsRemaining} spot(s) remaining.` },
        { status: 400 }
      );
    }

    // 6. Read server-side pricing from ticketTiers
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

    const isMemberPrice = ticketType !== "public";
    const publicPrice = tiers["public"]?.price ?? unitPriceDollars;
    const savingsTotal = isMemberPrice ? (publicPrice - unitPriceDollars) * qty : 0;

    // 7. Create pending ticketOrder doc
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
      isMemberPrice,
      savingsTotal,
      paymentStatus: "pending",
      stripeCheckoutSessionId: null,
      stripePaymentIntentId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 8. Build Stripe line item
    const eventDateStr = event.date
      ? new Date(event.date + "T17:30:00").toLocaleDateString("en-CA", {
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

    // 9. Create Stripe Checkout Session
    const successUrl = `${APP_URL}/events/paint-sip-rooftop?order=success&orderId=${orderRef.id}`;
    const cancelUrl = `${APP_URL}/events/paint-sip-rooftop?order=cancel`;

    console.log(
      `[paint-sip-checkout] Creating session | event="${event.title}" tier=${ticketType} qty=${qty} ` +
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
        isMemberPrice: String(isMemberPrice),
        savingsTotal: String(savingsTotal),
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
      `[paint-sip-checkout] Session created | sessionId=${session.id} orderId=${orderRef.id} ` +
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
    console.error("[paint-sip-checkout] Unexpected error:", message);
    return NextResponse.json({ error: `Checkout failed: ${message}` }, { status: 500 });
  }
}
