// Takers AI — Agent Instructions CRUD
// agentInstructions/{agentId} — admin-editable instructions appended to systemPrompt
// GET  /api/takers-ai/instructions          — all instructions
// GET  /api/takers-ai/instructions?agentId= — single agent
// POST /api/takers-ai/instructions          — create/upsert
// PUT  /api/takers-ai/instructions          — update

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
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get("agentId");
  const db = adminDb();

  if (agentId) {
    const doc = await db.collection("agentInstructions").doc(agentId).get();
    if (!doc.exists) return NextResponse.json({ instructions: null });
    return NextResponse.json({ instructions: { id: doc.id, ...doc.data() } });
  }

  const snap = await db.collection("agentInstructions").get();
  const instructions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return NextResponse.json({ instructions });
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { agentId, agentName, instructions, tools } = await req.json();
  if (!agentId || instructions === undefined) {
    return NextResponse.json({ error: "agentId and instructions required." }, { status: 400 });
  }

  const db = adminDb();
  const now = new Date().toISOString();
  // Doc ID = agentId for easy lookup
  await db.collection("agentInstructions").doc(agentId).set({
    agentId,
    agentName: agentName ?? "",
    instructions,
    tools: tools ?? [],
    updatedAt: now,
    updatedBy: admin.uid,
  }, { merge: true });

  return NextResponse.json({ success: true });
}

export async function PUT(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { agentId, instructions, tools } = await req.json();
  if (!agentId) return NextResponse.json({ error: "agentId required." }, { status: 400 });

  const db = adminDb();
  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString(), updatedBy: admin.uid };
  if (instructions !== undefined) updates.instructions = instructions;
  if (tools !== undefined) updates.tools = tools;

  await db.collection("agentInstructions").doc(agentId).update(updates);
  return NextResponse.json({ success: true });
}
