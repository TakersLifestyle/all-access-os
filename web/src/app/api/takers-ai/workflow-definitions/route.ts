// Takers AI — Workflow Definitions (reusable multi-step pipelines)
// GET    /api/takers-ai/workflow-definitions         → list all definitions
// GET    /api/takers-ai/workflow-definitions?id=<id> → single definition
// POST   /api/takers-ai/workflow-definitions         → create definition
// PUT    /api/takers-ai/workflow-definitions         → update definition
// DELETE /api/takers-ai/workflow-definitions?id=<id> → delete definition

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
  const id = searchParams.get("id");
  const db = adminDb();

  if (id) {
    const doc = await db.collection("workflowDefinitions").doc(id).get();
    if (!doc.exists) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ definition: { id: doc.id, ...doc.data() } });
  }

  const snap = await db
    .collection("workflowDefinitions")
    .orderBy("category")
    .get();

  const definitions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return NextResponse.json({ definitions });
}

export async function POST(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.name || !body.steps) {
    return NextResponse.json({ error: "name and steps required." }, { status: 400 });
  }

  const db = adminDb();
  const ref = db.collection("workflowDefinitions").doc();
  const now = new Date().toISOString();

  const approvalCount = (body.steps ?? []).filter(
    (s: { requiresApproval?: boolean }) => s.requiresApproval
  ).length;

  const doc = {
    ...body,
    approvalCount,
    isActive: body.isActive ?? true,
    createdAt: now,
    updatedAt: now,
  };

  await ref.set(doc);
  return NextResponse.json({ id: ref.id, ...doc }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, ...updates } = body as { id: string; [key: string]: unknown };
  if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });

  const db = adminDb();

  if (updates.steps) {
    updates.approvalCount = (updates.steps as { requiresApproval?: boolean }[]).filter(
      (s) => s.requiresApproval
    ).length;
  }

  await db.collection("workflowDefinitions").doc(id).update({
    ...updates,
    updatedAt: new Date().toISOString(),
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });

  const db = adminDb();
  await db.collection("workflowDefinitions").doc(id).delete();
  return NextResponse.json({ success: true });
}
