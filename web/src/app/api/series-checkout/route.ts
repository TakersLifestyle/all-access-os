// Generic checkout for any ALL ACCESS event series
// Reads pricing from Firestore ticketTiers — never trusts frontend price
// Validates tier eligibility from Bearer token claims

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb, adminAuth } from "@/lib/firebase-admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const APP_URL = (process.env.APP_URL ?? "https://allaccesswinnipeg.ca").replace(/\/$/, "");

const VALID_TICKET_TYPES = ["public", "community", "supporter"] as const;
type TicketType = (typeof VALID_TICKET_TYPES)[number];

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

    if (!eventId?.trim()) {
      return NextResponse.json({ error: "Missing eventId." }, { status: 400 });
    }
    if (!VALID_TICKET_TYPES.includes(ticketType as TicketType)) {
      return NextResponse.json({ error: "Invalid ticket type." }, { status: 400 });
    }
    const qty = Math.floor(Number(quantity));
    if (isNaN(qty) || qty < 1 || qty > 6) {
      return NextResponse.json({ error: "Quantity must be between 1 and 6." }, { status: 400 });
    }

    // Validate tier eligibility
    const claims = await getClaimsFromHeader(req.headers.get("Authorization"));
    if (ticketType === "community") {
      const ok =
        claims?.hasCommunityAccess === true ||
        claims?.role === "admin" ||
        claims?.status === "active";
      if (!ok) {
        return NextResponse.json(
          { error: "Community Access tier requires a community account." },
          { status: 403 }
        );
      }
    }
    if (ticketType === "supporter") {
      const ok =
        claims?.role === "admin" ||
        claims?.status === "active";
      if (!ok) {
        return NextResponse.json(
          { error: "Supporting Member tier requires an active ALL ACCESS membership." },
          { status: 403 }
        );
      }
    }

    // Load event
    const db = adminDb();
    const eventDoc = await db.collection("events").doc(eventId.trim()).get();
    if (!eventDoc.exists) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }
    const event = eventDoc.data()!;

    if (event.status !== "active") {
      return NextResponse.json({ error: "This event is no longer available." }, { status: 400 });
    }
    if (event.checkoutEnabled === false) {
      return NextResponse.json({ error: "Ticket sales are not yet open." }, { status: 400 });
    }
    if (typeof event.ticketsRemaining === "number" && event.ticketsRemaining < qty) {
      return NextResponse.json(
        { error: `Only ${event.ticketsRemaining} spot(s) remaining.` },
        { status: 400 }
      );
    }

    // Read server-side pricing
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
    const publicPrice = tiers["public"]?.price ?? unitPriceDollars;
    const isMemberPrice = ticketType !== "public";
    const savingsTotal = isMemberPrice ? (publicPrice - unitPriceDollars) * qty : 0;
    // Processing fee: 2.9% of unit price + $0.30 CAD flat (covers Stripe cost)
    const processingFeeCents = Math.round(unitPriceCents * 0.029 + 30);
    const totalPriceCents = unitPriceCents * qty + processingFeeCents;

    // Derive email metadata from event
    const seriesIdForEmail = (event.seriesId as string | null) ?? null;
    const emailSubject = seriesIdForEmail === "sunset-sessions"
      ? `🎨 You're In — ${event.title} | ALL ACCESS Sip & Paint Experience`
      : `🎟 Your Ticket — ${event.title} | ALL ACCESS`;
    const emailAccentColor = seriesIdForEmail === "sunset-sessions" ? "#D4AF37" : undefined;

    // Create ticketOrder doc
    const orderRef = db.collection("ticketOrders").doc();
    await orderRef.set({
      orderId: orderRef.id,
      userId: uid ?? null,
      userEmail: userEmail ?? null,
      eventId,
      eventTitle: event.title,
      seriesId: event.seriesId ?? null,
      seriesVolume: event.seriesVolume ?? null,
      ticketType,
      ticketTierName: tier.name,
      quantity: qty,
      unitPrice: unitPriceDollars,
      unitPriceCents,
      processingFeeCents,
      totalPrice: totalPriceCents / 100,
      totalPriceCents,
      isMemberPrice,
      savingsTotal,
      emailSubject,
      ...(emailAccentColor ? { emailAccentColor } : {}),
      paymentStatus: "pending",
      stripeCheckoutSessionId: null,
      stripePaymentIntentId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Build success/cancel URLs from event data
    const seriesId = event.seriesId ?? null;
    const slug = event.slug ?? null;
    const baseEventPath =
      seriesId && slug
        ? `/series/${seriesId}/${slug}`
        : `/events/${eventId}`;

    const eventDateStr = event.date
      ? new Date(event.date + "T17:00:00").toLocaleDateString("en-CA", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : null;

    const descParts = [tier.name, eventDateStr, event.location ?? null, tier.description ?? null].filter(
      Boolean
    );
    const imageUrl =
      typeof event.heroImageUrl === "string" && event.heroImageUrl.startsWith("http")
        ? event.heroImageUrl
        : null;

    console.log(
      `[series-checkout] event="${event.title}" tier=${ticketType} qty=${qty} price=${unitPriceDollars}`
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
        {
          price_data: {
            currency: "cad",
            unit_amount: processingFeeCents,
            product_data: {
              name: "Processing Fees",
              description: "Covers payment processing costs",
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${APP_URL}${baseEventPath}?order=success&orderId=${orderRef.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}${baseEventPath}?order=cancel`,
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
      return NextResponse.json({ error: "No redirect URL from payment provider." }, { status: 500 });
    }

    await orderRef.update({ stripeCheckoutSessionId: session.id, updatedAt: new Date().toISOString() });

    console.log(`[series-checkout] sessionId=${session.id} orderId=${orderRef.id}`);
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
    console.error("[series-checkout] Unexpected error:", message);
    return NextResponse.json({ error: `Checkout failed: ${message}` }, { status: 500 });
  }
}
