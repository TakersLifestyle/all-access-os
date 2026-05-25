// Takers AI — Single agent ops
// GET /api/takers-ai/agents/[agentId]
// PUT /api/takers-ai/agents/[agentId]
// DELETE /api/takers-ai/agents/[agentId]

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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  if (!await verifyAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { agentId } = await params;
  const db = adminDb();
  const doc = await db.collection("agents").doc(agentId).get();
  if (!doc.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ agent: { id: doc.id, ...doc.data() } });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  if (!await verifyAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { agentId } = await params;
  const body = await req.json();
  const allowed = ["name", "role", "description", "systemPrompt", "icon", "color", "model", "maxTokens", "isActive", "isDefault"];
  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }
  const db = adminDb();
  await db.collection("agents").doc(agentId).update(updates);
  return NextResponse.json({ success: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  if (!await verifyAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { agentId } = await params;
  const db = adminDb();
  // Prevent deleting the default operator
  const doc = await db.collection("agents").doc(agentId).get();
  if (doc.data()?.isDefault) {
    return NextResponse.json({ error: "Cannot delete the default agent." }, { status: 400 });
  }
  await db.collection("agents").doc(agentId).delete();
  return NextResponse.json({ success: true });
}
