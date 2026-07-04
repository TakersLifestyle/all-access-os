// POST /api/admin/series/create-event
// Creates a new event in an event series. Admin only.

import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  // Verify admin
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const decoded = await adminAuth().verifyIdToken(authHeader.slice(7));
    if (decoded.role !== "admin") {
      return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  const body = await req.json();
  const {
    seriesId,
    seriesVolume,
    seriesVolumeLabel,
    subtitle,
    tagline,
    description,
    date,
    time,
    location,
    locationTBA,
    capacity,
    ageRestriction,
    ticketTiers,
    schedule,
    whatsIncluded,
    addOns,
    faqs,
    dressCode,
    slug,
  } = body;

  if (!seriesId || !seriesVolume || !slug || !date) {
    return NextResponse.json({ error: "Missing required fields: seriesId, seriesVolume, slug, date" }, { status: 400 });
  }

  const db = adminDb();

  // Check slug uniqueness within series
  const existing = await db
    .collection("events")
    .where("seriesId", "==", seriesId)
    .where("slug", "==", slug)
    .limit(1)
    .get();

  if (!existing.empty) {
    return NextResponse.json({ error: `Slug "${slug}" already exists in this series.` }, { status: 409 });
  }

  const now = new Date().toISOString();
  const docId = `${seriesId}-${slug}`;
  const title = `ALL ACCESS Presents — ${seriesVolumeLabel ?? `Vol. ${String(seriesVolume).padStart(2, "0")}`}: ${subtitle ?? ""}`.trim();

  const ref = db.collection("events").doc(docId);
  await ref.set({
    seriesId,
    seriesVolume: Number(seriesVolume),
    seriesVolumeLabel: seriesVolumeLabel ?? `Vol. ${String(seriesVolume).padStart(2, "0")}`,
    title,
    subtitle: subtitle ?? "",
    tagline: tagline ?? "",
    description: description ?? "",
    date,
    time: time ?? "",
    location: location ?? "Winnipeg, MB (TBA)",
    locationTBA: locationTBA ?? true,
    capacity: Number(capacity) || 25,
    ticketsRemaining: Number(capacity) || 25,
    ageRestriction: ageRestriction ?? "18+",
    status: "coming_soon",
    checkoutEnabled: false,
    ticketTiers: ticketTiers ?? {
      public: { name: "General Admission", price: 85 },
      community: { name: "Community Access", price: 70 },
      supporter: { name: "Supporting Members", price: 60 },
    },
    schedule: schedule ?? [],
    whatsIncluded: whatsIncluded ?? [],
    addOns: addOns ?? [],
    faqs: faqs ?? [],
    dressCode: dressCode ?? null,
    heroImageUrl: "",
    galleryImages: [],
    grantsCommunityAccess: true,
    memoryAlbumId: null,
    slug,
    isMembersOnly: false,
    type: "series_event",
    createdAt: now,
    updatedAt: now,
  });

  console.log(`[admin/series/create-event] Created events/${docId}`);
  return NextResponse.json({ success: true, eventId: docId });
}
