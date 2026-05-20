// Admin-only: backfill eventPurchases from all existing paid ticketOrders
// Fixes buyers who purchased before the eventPurchases collection existed,
// and links any orders where userId was null at checkout time.
// POST /api/admin/backfill-purchases
// Header: Authorization: Bearer <firebase-id-token>

import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  // ── Verify admin token ──────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "").trim();

  if (!token) {
    return NextResponse.json({ error: "Unauthorized — no token" }, { status: 401 });
  }

  let callerRole: string | undefined;
  try {
    const decoded = await adminAuth().verifyIdToken(token);
    callerRole = decoded.role as string | undefined;
  } catch {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  if (callerRole !== "admin") {
    return NextResponse.json({ error: "Forbidden — admin role required" }, { status: 403 });
  }

  // ── Backfill logic ──────────────────────────────────────────────────────
  const db = adminDb();
  const auth = adminAuth();

  // Fetch all paid ticketOrders
  const ordersSnap = await db
    .collection("ticketOrders")
    .where("paymentStatus", "==", "paid")
    .get();

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const orderDoc of ordersSnap.docs) {
    const order = orderDoc.data();
    const orderId = orderDoc.id;

    try {
      // Check if eventPurchases doc already exists
      const existingRef = db.collection("eventPurchases").doc(orderId);
      const existing = await existingRef.get();

      // Resolve userId from multiple sources
      let userId = order.userId ?? null;

      // If userId missing, try lookup by email in Firebase Auth
      if (!userId && order.userEmail) {
        try {
          const userRecord = await auth.getUserByEmail(order.userEmail);
          userId = userRecord.uid;
          console.log(`[backfill] resolved userId=${userId} from email=${order.userEmail}`);
        } catch {
          // No matching account — purchase may have been guest
        }
      }

      // Fetch event data for enrichment
      let eventData: Record<string, unknown> = {};
      if (order.eventId) {
        const eventDoc = await db.collection("events").doc(order.eventId).get();
        if (eventDoc.exists) eventData = eventDoc.data()!;
      }

      const purchasePayload = {
        orderId,
        userId,
        userEmail: order.userEmail ?? null,
        eventId: order.eventId ?? "",
        eventTitle: order.eventTitle ?? (eventData.title as string) ?? "Event",
        eventDate: (eventData.date as string) ?? "",
        eventLocation: (eventData.location as string) ?? "",
        isFoundingMember: eventData.isLaunchEvent === true,
        quantity: order.quantity ?? 1,
        totalPrice: (order.totalPrice as number) ?? 0,
        totalPriceCents: Math.round(((order.totalPrice as number) ?? 0) * 100),
        status: "confirmed",
        purchasedAt: order.paidAt ?? order.updatedAt ?? new Date().toISOString(),
        stripeSessionId: order.stripeCheckoutSessionId ?? "",
        stripePaymentIntentId: order.stripePaymentIntentId ?? null,
      };

      if (!existing.exists) {
        await existingRef.set(purchasePayload);
        created++;
        console.log(`[backfill] created eventPurchases/${orderId} userId=${userId ?? "null"}`);
      } else {
        // Update userId if it was null and we now resolved it
        const currentUserId = existing.data()?.userId;
        if (!currentUserId && userId) {
          await existingRef.update({ userId, updatedAt: new Date().toISOString() });
          updated++;
          console.log(`[backfill] updated userId on eventPurchases/${orderId}`);
        } else {
          skipped++;
        }
      }

      // Backfill userId on the ticketOrder itself if it was null
      if (!order.userId && userId) {
        await db.collection("ticketOrders").doc(orderId).update({
          userId,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`orderId=${orderId}: ${msg}`);
      console.error(`[backfill] error on orderId=${orderId}:`, err);
    }
  }

  return NextResponse.json({
    success: true,
    summary: `Created ${created}, updated ${updated}, skipped ${skipped} (already existed and complete).`,
    created,
    updated,
    skipped,
    total: ordersSnap.docs.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
