// Takers AI — Brand Memory CRUD with version history
// GET    /api/takers-ai/memory              → list all blocks (ordered by priority desc)
// POST   /api/takers-ai/memory              → create new block
// PUT    /api/takers-ai/memory              → update block (snapshots previous version)
// DELETE /api/takers-ai/memory?id=<id>      → delete block
// GET    /api/takers-ai/memory?versions=<id> → list version history for a block

import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import type { MemoryCategory } from "@/lib/takers-ai/types";

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
  const versionsId = searchParams.get("versions");
  const db = adminDb();

  // Version history for a specific block
  if (versionsId) {
    const snap = await db
      .collection("brandMemory")
      .doc(versionsId)
      .collection("versions")
      .orderBy("version", "desc")
      .limit(20)
      .get();
    const versions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ versions });
  }

  // All blocks — ordered by priority desc, then category
  const snap = await db
    .collection("brandMemory")
    .orderBy("priority", "desc")
    .get();

  const memory = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return NextResponse.json({ memory });
}

export async function POST(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { key, category, title, content, priority = 5 } = body as {
    key: string;
    category: MemoryCategory;
    title: string;
    content: string;
    priority?: number;
  };

  if (!key || !category || !title || !content) {
    return NextResponse.json({ error: "key, category, title, content required." }, { status: 400 });
  }

  const db = adminDb();
  const ref = db.collection("brandMemory").doc();
  const now = new Date().toISOString();

  const doc = {
    key,
    category,
    title,
    content,
    priority: Math.min(10, Math.max(1, priority)),
    version: 1,
    isActive: true,
    updatedAt: now,
    updatedBy: decoded.uid,
  };

  await ref.set(doc);
  return NextResponse.json({ id: ref.id, ...doc }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, title, content, category, priority, isActive, changeNote } = body as {
    id: string;
    title?: string;
    content?: string;
    category?: MemoryCategory;
    priority?: number;
    isActive?: boolean;
    changeNote?: string;
  };

  if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });

  const db = adminDb();
  const docRef = db.collection("brandMemory").doc(id);
  const existing = await docRef.get();

  if (!existing.exists) {
    return NextResponse.json({ error: "Memory block not found." }, { status: 404 });
  }

  const currentData = existing.data()!;
  const now = new Date().toISOString();
  const newVersion = (currentData.version ?? 1) + 1;

  // Snapshot the current state as a version before overwriting
  const versionRef = docRef.collection("versions").doc();
  await versionRef.set({
    version: currentData.version ?? 1,
    content: currentData.content,
    title: currentData.title,
    category: currentData.category,
    priority: currentData.priority ?? 5,
    updatedAt: currentData.updatedAt,
    updatedBy: currentData.updatedBy ?? "unknown",
    changeNote: changeNote ?? null,
  });

  const updates: Record<string, unknown> = {
    version: newVersion,
    updatedAt: now,
    updatedBy: decoded.uid,
  };
  if (title !== undefined) updates.title = title;
  if (content !== undefined) updates.content = content;
  if (category !== undefined) updates.category = category;
  if (priority !== undefined) updates.priority = Math.min(10, Math.max(1, priority));
  if (isActive !== undefined) updates.isActive = isActive;

  await docRef.update(updates);
  return NextResponse.json({ success: true, version: newVersion });
}

export async function DELETE(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });

  const db = adminDb();
  await db.collection("brandMemory").doc(id).delete();
  return NextResponse.json({ success: true });
}
