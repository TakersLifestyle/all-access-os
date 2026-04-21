// Event ticket checkout — open to ALL users (public + members)
// Members automatically receive discounted pricing server-side
// Pricing always read from Firestore — never trusted from frontend

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb, adminAuth } from "@/lib/firebase-admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const APP_URL = process.env.APP_URL ?? "https://allaccesswinnipeg.ca";
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
    if (!eventId || typeof eventId !== "string") {
      return NextResponse.json({ error: "Missing eventId" }, { status: 400 });
    }
    const qty = Math.floor(Number(quantity));
    if (!qty || qty < 1 || qty > MAX_QUANTITY) {
      return NextResponse.json(
        { error: `Quantity must be between 1 and ${MAX_QUANTITY}` },
        { status: 400 }
      );
    }

    // ── 2. Load event from Firestore ────────────────────────
    const db = adminDb();
    const eventDoc = await db.collection("events").doc(eventId).get();

    if (!eventDoc.exists) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const event = eventDoc.data()!;

    if (event.status !== "active") {
      return NextResponse.json({ error: "Event is not currently available" }, { status: 400 });
    }

    // ── 3. Check capacity ───────────────────────────────────
    const remaining = typeof event.ticketsRemaining === "number"
      ? event.ticketsRemaining
      : (event.capacity ?? 0);

    if (remaining < qty) {
      return NextResponse.json(
        { error: `Only ${remaining} ticket${remaining === 1 ? "" : "s"} remaining` },
        { status: 400 }
      );
    }

    // ── 4. Resolve membership status ────────────────────────
    // Members get discounted pricing — non-members pay general price
    // No hard gate: everyone can purchase tickets
    let isMember = false;
    if (uid) {
      try {
        const auth = adminAuth();
        const userRecord = await auth.getUser(uid);
        const claims = userRecord.customClaims as { role?: string; status?: string } | undefined;
        isMember = claims?.role === "admin" || claims?.status === "active";
      } catch {
        isMember = false;
      }
    }

    // ── 5. Server-side pricing (never trust frontend) ───────
    const memberPrice = Number(event.memberPrice) || 0;
    const generalPrice = Number(event.generalPrice) || 0;

    const unitPriceDollars: number = isMember && memberPrice > 0
      ? memberPrice
      : generalPrice > 0
        ? generalPrice
        : memberPrice; // fallback for members-only events

    if (!unitPriceDollars || unitPriceDollars <= 0) {
      return NextResponse.json(
        { error: "This event is for members only. Become a member to purchase tickets." },
        { status: 403 }
      );
    }

    const unitPriceCents = Math.round(unitPriceDollars * 100);
    const savingsPerTicket = isMember && memberPrice > 0 && generalPrice > 0
      ? generalPrice - memberPrice
      : 0;

    // ── 6. Create pending ticketOrder in Firestore ──────────
    const orderRef = db.collection("ticketOrders").doc();
    await orderRef.set({
      orderId: orderRef.id,
      userId: uid ?? null,
      userEmail: userEmail ?? null,
      eventId,
      eventTitle: event.title,
      quantity: qty,
      unitPrice: unitPriceDollars,
      totalPrice: unitPriceDollars * qty,
      isMemberPrice: isMember && memberPrice > 0,
      savingsTotal: savingsPerTicket * qty,
      paymentStatus: "pending",
      stripeCheckoutSessionId: null,
      stripePaymentIntentId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // ── 7. Build Stripe line item description ───────────────
    const eventDateStr = event.date
      ? new Date(event.date + "T12:00:00").toLocaleDateString("en-CA", {
          weekday: "long", year: "numeric", month: "long", day: "numeric",
        })
      : null;

    const descParts = [
      eventDateStr,
      event.location ?? null,
      isMember && savingsPerTicket > 0 ? `Member rate — save $${savingsPerTicket}/ticket` : null,
    ].filter(Boolean);

    // ── 8. Create Stripe Checkout Session ───────────────────
    // Cast to any: automatic_payment_methods is valid at runtime but missing
    // from Stripe SDK v22 SessionCreateParams type for mode:"payment"
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sessionParams: any = {
      mode: "payment",
      automatic_payment_methods: { enabled: true },
      line_items: [
        {
          price_data: {
            currency: "cad",
            unit_amount: unitPriceCents,
            product_data: {
              name: event.title,
              description: descParts.join(" · ") || undefined,
            },
          },
          quantity: qty,
        },
      ],
      success_url: `${APP_URL}/events?order=success&orderId=${orderRef.id}`,
      cancel_url: `${APP_URL}/events?order=cancel&eventId=${eventId}`,
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

    // ── 9. Store session ID on pending order ────────────────
    await orderRef.update({
      stripeCheckoutSessionId: session.id,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[event-checkout] error:", message);
    return NextResponse.json({ error: "Checkout failed. Please try again." }, { status: 500 });
  }
}
