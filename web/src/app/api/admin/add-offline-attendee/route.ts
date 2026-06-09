// POST /api/admin/add-offline-attendee
// Admin-only: registers a cash/e-transfer attendee without going through Stripe.
//
// Body: {
//   eventId:                 string
//   userEmail:               string
//   displayName?:            string
//   quantity?:               number   (default 1)
//   amountPaid:              number   (CAD, e.g. 255)
//   paymentMethod:           "cash" | "etransfer" | "other"
//   notes?:                  string
//   decrementInventory?:     boolean  (default false — admin controls inventory manually)
// }
//
// What this does:
//   1. Verifies admin token
//   2. Gets or creates Firebase Auth account for the buyer
//   3. Sets custom claims { role:"member", status:"active" }
//   4. Creates/updates users/{uid} Firestore doc
//   5. Duplicate-guards — safe to call twice for same user+event
//   6. Creates ticketOrders/{orderId} (paymentStatus:"paid", source:"offline")
//   7. Creates eventPurchases/{orderId} (isFoundingMember derived from isLaunchEvent)
//   8. Decrements ticketsRemaining ONLY if decrementInventory:true
//   9. Writes adminAuditLog entry
//
// Returns: { success: true, uid, orderId, isNew, skipped }

import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { randomBytes } from "crypto";

function generateOrderId(): string {
  return `offline_${Date.now()}_${randomBytes(4).toString("hex")}`;
}

export async function POST(req: NextRequest) {
  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const token = req.headers.get("authorization")?.replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let callerUid: string;
  try {
    const decoded = await adminAuth().verifyIdToken(token);
    if (decoded.role !== "admin") {
      return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
    }
    callerUid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // ── 2. Parse body ─────────────────────────────────────────────────────────
  let body: {
    eventId: string;
    userEmail: string;
    displayName?: string;
    quantity?: number;
    amountPaid: number;
    paymentMethod: "cash" | "etransfer" | "other";
    notes?: string;
    decrementInventory?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    eventId,
    userEmail,
    displayName,
    quantity = 1,
    amountPaid,
    paymentMethod,
    notes,
    decrementInventory = false,
  } = body;

  if (!eventId || !userEmail || amountPaid === undefined || !paymentMethod) {
    return NextResponse.json(
      { error: "Missing required fields: eventId, userEmail, amountPaid, paymentMethod" },
      { status: 400 }
    );
  }

  const qty = Math.max(1, Math.floor(Number(quantity) || 1));
  const amount = Number(amountPaid);
  if (isNaN(amount) || amount < 0) {
    return NextResponse.json({ error: "Invalid amountPaid" }, { status: 400 });
  }

  const db = adminDb();
  const auth = adminAuth();
  const now = new Date().toISOString();

  // ── 3. Load event ─────────────────────────────────────────────────────────
  const eventSnap = await db.collection("events").doc(eventId).get();
  if (!eventSnap.exists) {
    return NextResponse.json({ error: `Event ${eventId} not found` }, { status: 404 });
  }
  const eventData = eventSnap.data()!;

  // ── 4. Get or create Firebase Auth user ───────────────────────────────────
  let uid: string;
  let isNew = false;
  try {
    const existing = await auth.getUserByEmail(userEmail);
    uid = existing.uid;
  } catch (err: unknown) {
    const fbErr = err as { code?: string };
    if (fbErr?.code !== "auth/user-not-found") {
      console.error("[add-offline-attendee] auth.getUserByEmail failed:", err);
      return NextResponse.json({ error: "Failed to look up user" }, { status: 500 });
    }
    try {
      const created = await auth.createUser({
        email: userEmail,
        displayName: displayName ?? undefined,
        emailVerified: false,
      });
      uid = created.uid;
      isNew = true;
    } catch (createErr) {
      console.error("[add-offline-attendee] auth.createUser failed:", createErr);
      return NextResponse.json({ error: "Failed to create user account" }, { status: 500 });
    }
  }

  // ── 5. Set custom claims ──────────────────────────────────────────────────
  try {
    // Preserve admin role if already set
    const currentUser = await auth.getUser(uid);
    const currentClaims = (currentUser.customClaims ?? {}) as { role?: string };
    const role = currentClaims.role === "admin" ? "admin" : "member";
    await auth.setCustomUserClaims(uid, { role, status: "active" });
  } catch (err) {
    console.error("[add-offline-attendee] setCustomUserClaims failed:", err);
    return NextResponse.json({ error: "Failed to set user claims" }, { status: 500 });
  }

  // ── 6. Update users/{uid} Firestore doc ───────────────────────────────────
  await db
    .collection("users")
    .doc(uid)
    .set(
      {
        email: userEmail,
        displayName: displayName ?? null,
        role: "member",
        status: "active",
        ...(isNew ? { createdAt: now } : {}),
        updatedAt: now,
      },
      { merge: true }
    );

  // ── 7. Duplicate guard ────────────────────────────────────────────────────
  const existingByUid = await db
    .collection("eventPurchases")
    .where("userId", "==", uid)
    .where("eventId", "==", eventId)
    .where("status", "==", "confirmed")
    .limit(1)
    .get();

  if (!existingByUid.empty) {
    const docId = existingByUid.docs[0].id;
    console.log(`[add-offline-attendee] duplicate detected by uid — skipping orderId=${docId}`);
    return NextResponse.json({
      success: true,
      uid,
      orderId: docId,
      isNew: false,
      skipped: true,
      message: "Purchase record already exists for this user and event.",
    });
  }

  const existingByEmail = await db
    .collection("eventPurchases")
    .where("userEmail", "==", userEmail)
    .where("eventId", "==", eventId)
    .where("status", "==", "confirmed")
    .limit(1)
    .get();

  if (!existingByEmail.empty) {
    const existing = existingByEmail.docs[0];
    // Backfill userId if missing
    if (!existing.data().userId) {
      await db
        .collection("eventPurchases")
        .doc(existing.id)
        .update({ userId: uid, updatedAt: now });
    }
    return NextResponse.json({
      success: true,
      uid,
      orderId: existing.id,
      isNew: false,
      skipped: true,
      message: "Purchase record already exists for this email and event.",
    });
  }

  // ── 8. Generate orderId ───────────────────────────────────────────────────
  const oid = generateOrderId();

  // ── 9. Create records (with optional inventory decrement) ────────────────
  const isFoundingMember = eventData.isLaunchEvent === true;

  try {
    if (decrementInventory) {
      // Atomic transaction: create docs AND decrement ticketsRemaining
      await db.runTransaction(async (tx) => {
        const eventRef = db.collection("events").doc(eventId);
        const freshSnap = await tx.get(eventRef);
        if (!freshSnap.exists) throw new Error("Event disappeared");

        const fresh = freshSnap.data()!;
        const currentRemaining =
          typeof fresh.ticketsRemaining === "number"
            ? fresh.ticketsRemaining
            : (fresh.capacity ?? 0);

        if (fresh.capacity > 0 && currentRemaining < qty) {
          throw new Error(
            `Only ${currentRemaining} ticket${currentRemaining === 1 ? "" : "s"} remaining.`
          );
        }

        const newRemaining = Math.max(0, currentRemaining - qty);

        tx.set(db.collection("ticketOrders").doc(oid), buildOrder());
        tx.set(db.collection("eventPurchases").doc(oid), buildPurchase());
        tx.update(eventRef, {
          ticketsRemaining: newRemaining,
          ...(newRemaining === 0 ? { status: "sold_out" } : {}),
          updatedAt: now,
        });
      });
    } else {
      // No inventory change — admin controls ticketsRemaining manually
      await db.collection("ticketOrders").doc(oid).set(buildOrder());
      await db.collection("eventPurchases").doc(oid).set(buildPurchase());
    }
  } catch (txErr) {
    const msg = txErr instanceof Error ? txErr.message : String(txErr);
    console.error("[add-offline-attendee] write failed:", msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  function buildOrder() {
    return {
      orderId: oid,
      userId: uid,
      userEmail,
      eventId,
      eventTitle: eventData.title,
      quantity: qty,
      unitPrice: amount / qty,
      unitPriceCents: Math.round((amount / qty) * 100),
      totalPrice: amount,
      totalPriceCents: Math.round(amount * 100),
      isMemberPrice: false,
      memberDiscountPct: 0,
      savingsTotal: 0,
      paymentStatus: "paid",
      paymentMethod,
      source: "offline",
      notes: notes ?? null,
      stripeCheckoutSessionId: null,
      stripePaymentIntentId: null,
      paidAt: now,
      createdAt: now,
      updatedAt: now,
    };
  }

  function buildPurchase() {
    return {
      orderId: oid,
      userId: uid,
      userEmail,
      eventId,
      eventTitle: eventData.title ?? "",
      eventDate: (eventData.date as string) ?? "",
      eventLocation: (eventData.location as string) ?? "",
      isFoundingMember,
      quantity: qty,
      totalPrice: amount,
      totalPriceCents: Math.round(amount * 100),
      status: "confirmed",
      purchasedAt: now,
      stripeSessionId: null,
      stripePaymentIntentId: null,
      paymentMethod,
      source: "offline",
      notes: notes ?? null,
    };
  }

  // ── 10. adminAuditLog ─────────────────────────────────────────────────────
  await db
    .collection("adminAuditLog")
    .add({
      action: "add_offline_attendee",
      eventId,
      eventTitle: eventData.title,
      userId: uid,
      userEmail,
      displayName: displayName ?? null,
      orderId: oid,
      quantity: qty,
      amountPaid: amount,
      paymentMethod,
      source: "offline",
      notes: notes ?? null,
      addedBy: callerUid,
      addedAt: now,
    })
    .catch((err) =>
      console.error("[add-offline-attendee] auditLog write failed:", err)
    );

  console.log(
    `[add-offline-attendee] success | uid=${uid} orderId=${oid} event=${eventId} ` +
    `email=${userEmail} amount=${amount} method=${paymentMethod} isNew=${isNew}`
  );

  return NextResponse.json({
    success: true,
    uid,
    orderId: oid,
    isNew,
    skipped: false,
    isFoundingMember,
  });
}
