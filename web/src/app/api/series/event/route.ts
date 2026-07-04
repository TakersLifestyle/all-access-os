import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const seriesId = req.nextUrl.searchParams.get("seriesId");
  const slug = req.nextUrl.searchParams.get("slug");

  if (!seriesId?.trim() || !slug?.trim()) {
    return NextResponse.json({ error: "Missing seriesId or slug" }, { status: 400 });
  }

  try {
    const db = adminDb();
    const snap = await db
      .collection("events")
      .where("seriesId", "==", seriesId.trim())
      .where("slug", "==", slug.trim())
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const doc = snap.docs[0];
    return NextResponse.json({ event: { id: doc.id, ...doc.data() } });
  } catch (err) {
    console.error("[api/series/event] Error:", err);
    return NextResponse.json({ error: "Failed to fetch event" }, { status: 500 });
  }
}
