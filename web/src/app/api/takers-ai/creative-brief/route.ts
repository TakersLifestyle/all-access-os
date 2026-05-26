// Takers AI — Creative Brief API
// POST /api/takers-ai/creative-brief — generate + save a creative brief
// GET  /api/takers-ai/creative-brief — list recent creative briefs

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import {
  generateCreativeBrief,
  saveCreativeBrief,
  type CreativeBriefRequest,
  type AssetFormat,
} from "@/lib/takers-ai/creative-brief";
import { fetchLiveEvents } from "@/lib/takers-ai/event-knowledge";

async function verifyAdmin(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const decoded = await adminAuth().verifyIdToken(authHeader.slice(7));
    return decoded.role === "admin" ? decoded : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    subject: string;
    context?: string;
    formats?: AssetFormat[];
    eventId?: string;       // optional — auto-inject verified event facts
    tone?: string;
    conversationId?: string;
    agentId?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.subject?.trim()) {
    return NextResponse.json({ error: "subject is required" }, { status: 400 });
  }

  const db = adminDb();

  // Auto-inject verified event facts if eventId provided
  let eventFacts: CreativeBriefRequest["eventFacts"] | undefined;
  if (body.eventId) {
    try {
      const events = await fetchLiveEvents(db);
      const event = events.find((e) => e.id === body.eventId);
      if (event) {
        eventFacts = {
          name: event.title,
          date: event.date,
          venue: event.venue,
          city: event.city,
          generalPrice: event.generalPrice !== undefined ? `$${event.generalPrice} CAD` : undefined,
          memberPrice: event.memberPrice !== undefined ? `$${event.memberPrice} CAD` : undefined,
          access: event.isMembersOnly ? "Members only" : "Open to everyone (members get preferred pricing)",
        };
      }
    } catch {
      // fail-open — proceed without event facts
    }
  }

  try {
    const brief = await generateCreativeBrief({
      subject: body.subject.trim(),
      context: body.context,
      formats: body.formats,
      tone: body.tone,
      eventFacts,
      agentId: body.agentId,
      conversationId: body.conversationId,
    });

    // Save to Firestore
    const id = await saveCreativeBrief(db, brief);

    return NextResponse.json({ brief: { ...brief, id } });
  } catch (err) {
    console.error("[creative-brief] generation failed:", err);
    return NextResponse.json(
      { error: "Failed to generate creative brief", detail: String(err) },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = adminDb();
  const snap = await db
    .collection("creativeBriefs")
    .orderBy("createdAt", "desc")
    .limit(20)
    .get();

  const briefs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return NextResponse.json({ briefs });
}
