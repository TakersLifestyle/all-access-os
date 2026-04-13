// Event ticket checkout — server-side only
// Validates event, pricing, membership, and quantity before creating Stripe session
// Never trusts frontend pricing — all prices read from Firestore server-side

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

    // ── 1. Validate inputs ──────────────────────────────────────────────────
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

    // ── 2. Load event from Firestore (server-side — never trust frontend price) ──
    const db = adminDb();
    const eventDoc = await db.collection("events").doc(eventId).get();

    if (!eventDoc.exists) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const event = eventDoc.data()!;

    if (event.status !== "active") {
      return NextResponse.json({ error: "Event is not available" }, { status: 400 });
    }

    // ── 3. Check capacity / prevent overselling ─────────────────────────────
    const remaining = typeof event.ticketsRemaining === "number"
      ? event.ticketsRemaining
      : event.capacity ?? 0;

    if (remaining < qty) {
      return NextResponse.json(
        { error: `Only ${remaining} ticket${remaining === 1 ? "" : "s"} remaining` },
        { status: 400 }
      );
    }

    // ── 4. Validate membership for members-only events ──────────────────────
    let membershipStatus: "active" | "inactive" | "admin" = "inactive";
    let resolvedUid = uid ?? null;

    if (uid) {
      try {
        const auth = adminAuth();
        const userRecord = await auth.getUser(uid);
        const claims = userRecord.customClaims as { role?: string; status?: string } | undefined;
        if (claims?.role === "admin") membershipStatus = "admin";
        else if (claims?.status === "active") membershipStatus = "active";
      } catch {
        // Token lookup failed — treat as inactive
      }
    }

    if (event.isMembersOnly && membershipStatus === "inactive") {
      return NextResponse.json(
        { error: "This event is for active members only. Subscribe to access." },
        { status: 403 }
      );
    }

    // ── 5. Determine correct unit price (server-side) ───────────────────────
    const isMember = membershipStatus === "active" || membershipStatus === "admin";
    const unitPriceDollars: number = isMember
      ? (event.memberPrice ?? event.generalPrice ?? 0)
      : (event.generalPrice ?? 0);

    if (!unitPriceDollars || unitPriceDollars <= 0) {
      return NextResponse.json(
        { error: "Event pricing is not available" },
        { status: 400 }
      );
    }

    const unitPriceCents = Math.round(unitPriceDollars * 100);

    // ── 6. Create pending order in Firestore ────────────────────────────────
    const orderRef = db.collection("ticketOrders").doc();
    await orderRef.set({
      orderId: orderRef.id,
      userId: resolvedUid ?? null,
      userEmail: userEmail ?? null,
      eventId,
      eventTitle: event.title,
      quantity: qty,
      unitPrice: unitPriceDollars,
      totalPrice: unitPriceDollars * qty,
      paymentStatus: "pending",
      stripeCheckoutSessionId: null,
      stripePaymentIntentId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // ── 7. Create Stripe Checkout Session ───────────────────────────────────
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "cad",
            unit_amount: unitPriceCents,
            product_data: {
              name: event.title,
              description: [
                event.date
                  ? new Date(event.date + "T12:00:00").toLocaleDateString("en-CA", {
                      weekday: "long", year: "numeric", month: "long", day: "numeric",
                    })
                  : null,
                event.location ?? null,
              ]
                .filter(Boolean)
                .join(" · "),
            },
          },
          quantity: qty,
        },
      ],
      success_url: `${APP_URL}/events?order=success&orderId=${orderRef.id}`,
      cancel_url: `${APP_URL}/events?order=cancel&eventId=${eventId}`,
      ...(resolvedUid ? { client_reference_id: resolvedUid } : {}),
      ...(userEmail ? { customer_email: userEmail } : {}),
      metadata: {
        orderId: orderRef.id,
        eventId,
        quantity: String(qty),
        userId: resolvedUid ?? "",
        type: "event_ticket",
      },
      payment_intent_data: {
        metadata: {
          orderId: orderRef.id,
          eventId,
          quantity: String(qty),
          userId: resolvedUid ?? "",
          type: "event_ticket",
        },
      },
    });

    // ── 8. Store session ID on pending order ────────────────────────────────
    await orderRef.update({
      stripeCheckoutSessionId: session.id,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[event-checkout] error:", message);
    return NextResponse.json(
      { error: "Checkout failed. Please try again.", details: message },
      { status: 500 }
    );
  }
}
