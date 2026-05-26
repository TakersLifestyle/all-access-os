// Takers AI — Conversations list
// GET    /api/takers-ai/conversations            — list recent conversations
// DELETE /api/takers-ai/conversations?id=xxx     — delete a conversation
// PATCH  /api/takers-ai/conversations?id=xxx     — rename/update a conversation

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";

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

export async function GET(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get("agentId");
  const search = searchParams.get("q")?.toLowerCase().trim();
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);

  const db = adminDb();

  // Filter by the authenticated user's UID for cross-device continuity
  let q = db
    .collection("conversations")
    .where("userId", "==", decoded.uid)
    .orderBy("updatedAt", "desc")
    .limit(limit);

  let snap;
  try {
    snap = await q.get();
  } catch {
    // Composite index may not exist yet — fallback to unfiltered
    snap = await db.collection("conversations").orderBy("updatedAt", "desc").limit(limit).get();
  }

  let convs = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Array<Record<string, unknown>>;

  // Client-side filters (avoids extra Firestore indexes)
  if (agentId) {
    convs = convs.filter((c) => c.agentId === agentId);
  }

  if (search) {
    convs = convs.filter(
      (c) =>
        (typeof c.title === "string" && c.title.toLowerCase().includes(search)) ||
        (typeof c.lastMessage === "string" && c.lastMessage.toLowerCase().includes(search))
    );
  }

  return NextResponse.json({ conversations: convs });
}

export async function DELETE(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });

  const db = adminDb();

  // Verify ownership before deletion
  const doc = await db.collection("conversations").doc(id).get();
  if (!doc.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (doc.data()?.userId && doc.data()?.userId !== decoded.uid) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Delete messages subcollection first
  const messages = await db.collection("conversations").doc(id).collection("messages").get();
  const batch = db.batch();
  for (const msg of messages.docs) batch.delete(msg.ref);
  batch.delete(db.collection("conversations").doc(id));
  await batch.commit();

  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });

  let body: { title?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const db = adminDb();
  const doc = await db.collection("conversations").doc(id).get();
  if (!doc.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (doc.data()?.userId && doc.data()?.userId !== decoded.uid) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (body.title?.trim()) updates.title = body.title.trim().slice(0, 100);

  await db.collection("conversations").doc(id).update(updates);
  return NextResponse.json({ success: true });
}
