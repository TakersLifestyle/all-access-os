// Takers AI — Prompt Templates CRUD
// GET /api/takers-ai/templates
// POST /api/takers-ai/templates
// PUT /api/takers-ai/templates — update usageCount or edit template

import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

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
  const db = adminDb();
  const snap = await db.collection("promptTemplates").orderBy("category").get();
  const templates = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return NextResponse.json({ templates });
}

export async function POST(req: NextRequest) {
  if (!await verifyAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { agentId, name, description, prompt, variables, category } = await req.json();
  if (!name || !prompt) {
    return NextResponse.json({ error: "name and prompt required." }, { status: 400 });
  }
  const db = adminDb();
  const ref = db.collection("promptTemplates").doc();
  const now = new Date().toISOString();
  const template = {
    agentId: agentId ?? "any",
    name,
    description: description ?? "",
    prompt,
    variables: variables ?? [],
    category: category ?? "general",
    usageCount: 0,
    createdAt: now,
  };
  await ref.set(template);
  return NextResponse.json({ template: { id: ref.id, ...template } }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  if (!await verifyAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, incrementUsage, ...rest } = await req.json();
  if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });
  const db = adminDb();
  const allowed = ["name", "description", "prompt", "variables", "category", "agentId"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in rest) updates[key] = rest[key];
  }
  if (incrementUsage) updates.usageCount = FieldValue.increment(1);
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }
  await db.collection("promptTemplates").doc(id).update(updates);
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  if (!await verifyAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });
  const db = adminDb();
  await db.collection("promptTemplates").doc(id).delete();
  return NextResponse.json({ success: true });
}
