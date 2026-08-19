// /api/checkin — door staff check-in API for DJ LANKZ & FRIENDS — SKALES event
// PIN-protected: validated server-side via CHECKIN_PIN env var (default: 2026)
// GET  ?pin=XXXX  — list all paid ticket orders for the event
// POST { pin, orderId } — mark an order as checked in

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

const CHECKIN_PIN = process.env.CHECKIN_PIN ?? "2026";
const SKALES_EVENT_ID = "EQIimnVZ5jPhVKPLyAJ2";

export async function GET(req: NextRequest) {
  const pin = req.nextUrl.searchParams.get("pin");
  if (!pin || pin !== CHECKIN_PIN) {
    return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
  }

  const db = adminDb();
  const snap = await db
    .collection("ticketOrders")
    .where("eventId", "==", SKALES_EVENT_ID)
    .where("paymentStatus", "==", "paid")
    .orderBy("createdAt", "asc")
    .get();

  const orders = snap.docs.map((doc) => {
    const d = doc.data();
    let checkedInAt: string | null = null;
    if (d.checkedInAt) {
      checkedInAt =
        typeof d.checkedInAt.toDate === "function"
          ? d.checkedInAt.toDate().toISOString()
          : String(d.checkedInAt);
    }
    return {
      id: doc.id,
      userEmail: d.userEmail ?? null,
      quantity: d.quantity ?? 1,
      totalPrice: d.totalPrice ?? null,
      checkedIn: d.checkedIn ?? false,
      checkedInAt,
      createdAt: d.createdAt ?? null,
    };
  });

  const total = orders.reduce((s, o) => s + o.quantity, 0);
  const checkedInCount = orders.filter((o) => o.checkedIn).reduce((s, o) => s + o.quantity, 0);

  return NextResponse.json({ orders, total, checkedInCount });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { pin, orderId } = body as { pin?: string; orderId?: string };

  if (!pin || pin !== CHECKIN_PIN) {
    return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
  }
  if (!orderId || typeof orderId !== "string") {
    return NextResponse.json({ error: "orderId required" }, { status: 400 });
  }

  const db = adminDb();
  const ref = db.collection("ticketOrders").doc(orderId.trim());
  const snap = await ref.get();

  if (!snap.exists) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const data = snap.data()!;

  if (data.paymentStatus !== "paid") {
    return NextResponse.json({ error: "Ticket not paid — cannot check in" }, { status: 400 });
  }

  if (data.checkedIn === true) {
    const checkedInAt =
      typeof data.checkedInAt?.toDate === "function"
        ? data.checkedInAt.toDate().toISOString()
        : String(data.checkedInAt ?? "");
    return NextResponse.json({ already: true, checkedInAt });
  }

  await ref.update({
    checkedIn: true,
    checkedInAt: FieldValue.serverTimestamp(),
    updatedAt: new Date().toISOString(),
  });

  return NextResponse.json({ success: true });
}
