// POST /api/admin/add-offline-attendee
// Admin-only route — adds a cash/offline attendee to an event without Stripe.
// Atomically decrements ticketsRemaining and writes to eventPurchases + adminAuditLog.
import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  // ── 1. Verify caller is admin ─────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let adminUid: string;
  let adminEmail: string;
  try {
    const decoded = await adminAuth().verifyIdToken(authHeader.slice(7));
    if (decoded.role !== "admin") {
      return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
    }
    adminUid = decoded.uid;
    adminEmail = decoded.email ?? "unknown";
  } catch {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  // ── 2. Parse + validate body ──────────────────────────────────────────────
  type PaymentMethod = "cash" | "etransfer" | "other";
  const body = await req.json() as {
    eventId: string;
    userId?: string;
    userEmail: string;
    displayName: string;
    quantity?: number;
    paymentMethod?: PaymentMethod;
    pricePerTicket: number;
    totalPaid: number;
    notes?: string;
    confirmDuplicate?: boolean;
  };

  const {
    eventId,
    userId,
    userEmail,
    displayName,
    quantity = 1,
    paymentMethod = "cash",
    pricePerTicket,
    totalPaid,
    notes,
    confirmDuplicate = false,
  } = body;

  if (!eventId || !userEmail?.trim() || !displayName?.trim()) {
    return NextResponse.json(
      { error: "Missing required fields: eventId, userEmail, displayName" },
      { status: 400 }
    );
  }
  if (quantity < 1 || quantity > 10) {
    return NextResponse.json({ error: "Quantity must be 1–10" }, { status: 400 });
  }

  const db = adminDb();
  const now = new Date().toISOString();
  const emailNorm = userEmail.trim().toLowerCase();

  // ── 3. Verify event exists + has capacity ──────────────────────────────────
  const eventRef = db.collection("events").doc(eventId);
  const eventSnap = await eventRef.get();
  if (!eventSnap.exists) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  const eventData = eventSnap.data()!;
  const remaining: number =
    typeof eventData.ticketsRemaining === "number"
      ? eventData.ticketsRemaining
      : (eventData.capacity ?? 0);

  if (remaining < quantity) {
    return NextResponse.json(
      { error: `Not enough capacity. Only ${remaining} spot(s) remaining.` },
      { status: 409 }
    );
  }

  // ── 4. Duplicate guard ──────────────────────────────────────────────────────
  if (!confirmDuplicate) {
    const dupSnap = await db
      .collection("eventPurchases")
      .where("eventId", "==", eventId)
      .where("userEmail", "==", emailNorm)
      .limit(1)
      .get();

    if (!dupSnap.empty) {
      const existing = dupSnap.docs[0].data();
      return NextResponse.json(
        {
          error: "duplicate",
          message: `${emailNorm} already has a record for this event. Pass confirmDuplicate: true to add additional quantity.`,
          existingOrdId: dupSnap.docs[0].id,
          existingQty: existing.quantity ?? 1,
        },
        { status: 409 }
      );
    }
  }

  // ── 5. Atomic write — decrement + create purchase ─────────────────────────
  const orderId = `manual_${eventId.slice(0, 6)}_${Date.now()}`;

  try {
    await db.runTransaction(async (tx) => {
      const freshSnap = await tx.get(eventRef);
      const freshRemaining: number =
        typeof freshSnap.data()?.ticketsRemaining === "number"
          ? freshSnap.data()!.ticketsRemaining
          : (freshSnap.data()?.capacity ?? 0);

      if (freshRemaining < quantity) {
        throw new Error(`Only ${freshRemaining} spot(s) left — capacity exceeded`);
      }

      const newRemaining = Math.max(0, freshRemaining - quantity);

      tx.set(db.collection("eventPurchases").doc(orderId), {
        orderId,
        userId: userId ?? null,
        userEmail: emailNorm,
        displayName: displayName.trim(),
        eventId,
        eventTitle: eventData.title ?? "",
        eventDate: eventData.date ?? "",
        eventLocation: eventData.location ?? "",
        quantity,
        pricePerTicket,
        totalPaid,
        totalPrice: totalPaid,
        paymentMethod,
        status: "confirmed",
        source: "admin_manual",
        notes: notes?.trim() ?? "",
        isFoundingMember: eventData.isLaunchEvent === true,
        purchasedAt: now,
        createdAt: now,
        createdBy: adminUid,
        createdByEmail: adminEmail,
      });

      tx.update(eventRef, {
        ticketsRemaining: newRemaining,
        ...(newRemaining === 0 ? { status: "sold_out" } : {}),
        updatedAt: now,
      });
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 409 });
  }

  // ── 6. Audit log — non-critical, outside transaction ──────────────────────
  await db.collection("adminAuditLog").add({
    action: "add_offline_attendee",
    adminUid,
    adminEmail,
    userEmail: emailNorm,
    userId: userId ?? null,
    displayName: displayName.trim(),
    eventId,
    eventTitle: eventData.title ?? "",
    paymentMethod,
    pricePerTicket,
    totalPaid,
    quantity,
    orderId,
    notes: notes?.trim() ?? "",
    createdAt: now,
  }).catch((err) => console.error("[add-offline-attendee] audit log write failed:", err));

  return NextResponse.json({ success: true, orderId });
}
