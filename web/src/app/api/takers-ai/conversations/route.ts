// Takers AI — Conversations
// GET /api/takers-ai/conversations
// DELETE /api/takers-ai/conversations?id=xxx

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
  if (!await verifyAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get("agentId");
  const db = adminDb();
  let q = db.collection("conversations").orderBy("updatedAt", "desc").limit(50);
  const snap = await q.get();
  let convs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (agentId) convs = convs.filter((c: Record<string, unknown>) => c.agentId === agentId);
  return NextResponse.json({ conversations: convs });
}

export async function DELETE(req: NextRequest) {
  if (!await verifyAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });
  const db = adminDb();
  // Delete messages subcollection first
  const messages = await db.collection("conversations").doc(id).collection("messages").get();
  const batch = db.batch();
  for (const doc of messages.docs) batch.delete(doc.ref);
  batch.delete(db.collection("conversations").doc(id));
  await batch.commit();
  return NextResponse.json({ success: true });
}
