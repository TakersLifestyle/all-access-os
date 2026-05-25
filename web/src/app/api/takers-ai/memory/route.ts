// Takers AI — Brand Memory CRUD
// GET /api/takers-ai/memory
// POST /api/takers-ai/memory
// PUT /api/takers-ai/memory — update by key

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
  const db = adminDb();
  const snap = await db.collection("brandMemory").orderBy("category").get();
  const memory = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return NextResponse.json({ memory });
}

export async function POST(req: NextRequest) {
  if (!await verifyAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { key, category, title, content } = await req.json();
  if (!key || !category || !title || !content) {
    return NextResponse.json({ error: "key, category, title, content required." }, { status: 400 });
  }
  const db = adminDb();
  const ref = db.collection("brandMemory").doc();
  const now = new Date().toISOString();
  await ref.set({ key, category, title, content, updatedAt: now });
  return NextResponse.json({ id: ref.id, key, category, title, content, updatedAt: now }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  if (!await verifyAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, title, content, category } = await req.json();
  if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });
  const db = adminDb();
  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (title !== undefined) updates.title = title;
  if (content !== undefined) updates.content = content;
  if (category !== undefined) updates.category = category;
  await db.collection("brandMemory").doc(id).update(updates);
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
  await db.collection("brandMemory").doc(id).delete();
  return NextResponse.json({ success: true });
}
