import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const seriesId = req.nextUrl.searchParams.get("seriesId");
  if (!seriesId?.trim()) {
    return NextResponse.json({ error: "Missing seriesId" }, { status: 400 });
  }

  try {
    const db = adminDb();
    const snap = await db
      .collection("events")
      .where("seriesId", "==", seriesId.trim())
      .get();

    const events = snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
        const av = typeof a.seriesVolume === "number" ? a.seriesVolume : 999;
        const bv = typeof b.seriesVolume === "number" ? b.seriesVolume : 999;
        return av - bv;
      });

    return NextResponse.json({ events });
  } catch (err) {
    console.error("[api/series/events] Error:", err);
    return NextResponse.json({ error: "Failed to fetch series events" }, { status: 500 });
  }
}
