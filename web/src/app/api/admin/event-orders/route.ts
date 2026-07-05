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

export async function GET(req: NextRequest) {
  if (!await isAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get("eventId")?.trim();
  const search = searchParams.get("search")?.trim().toLowerCase() ?? "";

  if (!eventId) {
    return NextResponse.json({ error: "Missing eventId." }, { status: 400 });
  }

  const db = adminDb();
  const snap = await db
    .collection("ticketOrders")
    .where("eventId", "==", eventId)
    .where("paymentStatus", "==", "paid")
    .orderBy("createdAt", "desc")
    .limit(200)
    .get();

  const orders = snap.docs.map((doc) => {
    const d = doc.data();
    return {
      orderId: doc.id,
      userEmail: d.userEmail ?? "",
      eventTitle: d.eventTitle ?? "",
      ticketTierName: d.ticketTierName ?? "",
      quantity: d.quantity ?? 1,
      totalPrice: d.totalPrice ?? 0,
      checkedIn: d.checkedIn ?? false,
      checkedInAt: d.checkedInAt ?? null,
      createdAt: d.createdAt ?? "",
    };
  });

  const filtered = search
    ? orders.filter(
        (o) =>
          o.userEmail.toLowerCase().includes(search) ||
          o.orderId.toLowerCase().includes(search) ||
          o.ticketTierName.toLowerCase().includes(search)
      )
    : orders;

  const stats = {
    total: orders.length,
    checkedIn: orders.filter((o) => o.checkedIn).length,
    remaining: orders.filter((o) => !o.checkedIn).length,
    totalTickets: orders.reduce((sum, o) => sum + o.quantity, 0),
  };

  return NextResponse.json({ orders: filtered, stats });
}
