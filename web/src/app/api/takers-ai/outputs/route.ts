// Takers AI — Saved Outputs CRUD
// GET /api/takers-ai/outputs
// POST /api/takers-ai/outputs

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
  const type = searchParams.get("type");
  const db = adminDb();
  let q = db.collection("savedOutputs").orderBy("createdAt", "desc").limit(100);
  // Note: type filter applied client-side to avoid composite index requirement
  const snap = await q.get();
  let outputs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (type) outputs = outputs.filter((o: Record<string, unknown>) => o.type === type);
  return NextResponse.json({ outputs });
}

export async function POST(req: NextRequest) {
  if (!await verifyAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { agentId, conversationId, title, content, type, tags } = await req.json();
  if (!agentId || !title || !content) {
    return NextResponse.json({ error: "agentId, title, content required." }, { status: 400 });
  }
  const db = adminDb();
  const ref = db.collection("savedOutputs").doc();
  const now = new Date().toISOString();
  const output = {
    agentId,
    conversationId: conversationId ?? null,
    title,
    content,
    type: type ?? "other",
    tags: tags ?? [],
    createdAt: now,
  };
  await ref.set(output);
  return NextResponse.json({ output: { id: ref.id, ...output } }, { status: 201 });
}
