import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";

async function isAdmin(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  try {
    const token = await adminAuth().verifyIdToken(authHeader.slice(7));
    return token.role === "admin";
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!await isAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderId } = await req.json().catch(() => ({}));
  if (!orderId?.trim()) {
    return NextResponse.json({ valid: false, reason: "invalid_input", error: "Missing Order ID." }, { status: 400 });
  }

  const db = adminDb();
  const orderRef = db.collection("ticketOrders").doc(orderId.trim());
  const orderSnap = await orderRef.get();

  if (!orderSnap.exists) {
    return NextResponse.json({ valid: false, reason: "not_found", error: "Ticket not found." });
  }

  const order = orderSnap.data()!;

  if (order.paymentStatus !== "paid") {
    return NextResponse.json({ valid: false, reason: "not_paid", error: "Payment not confirmed for this ticket." });
  }

  if (order.checkedIn) {
    return NextResponse.json({
      valid: false,
      reason: "already_used",
      error: "This ticket has already been scanned.",
      checkedInAt: order.checkedInAt ?? null,
      order: {
        eventTitle: order.eventTitle ?? "",
        userEmail: order.userEmail ?? "",
        quantity: order.quantity ?? 1,
        ticketTierName: order.ticketTierName ?? "",
        orderId,
      },
    });
  }

  await orderRef.update({
    checkedIn: true,
    checkedInAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  console.log(`[verify-ticket] checked in orderId=${orderId} event=${order.eventId}`);

  return NextResponse.json({
    valid: true,
    order: {
      eventTitle: order.eventTitle ?? "",
      userEmail: order.userEmail ?? "",
      quantity: order.quantity ?? 1,
      ticketTierName: order.ticketTierName ?? "",
      orderId,
    },
  });
}
