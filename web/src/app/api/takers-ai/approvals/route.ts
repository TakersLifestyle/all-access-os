// Takers AI — Approval Queue
// GET    /api/takers-ai/approvals              → list items (filter by status/type)
// POST   /api/takers-ai/approvals              → create new approval item
// PUT    /api/takers-ai/approvals              → approve or reject an item
// DELETE /api/takers-ai/approvals?id=<id>      → delete item

import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import type { ApprovalType, ApprovalPriority, ApprovalStatus } from "@/lib/takers-ai/types";

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
  const status = searchParams.get("status");         // pending | approved | rejected
  const type = searchParams.get("type");
  const limit = parseInt(searchParams.get("limit") ?? "50");

  const db = adminDb();
  let query: FirebaseFirestore.Query = db
    .collection("approvalQueue")
    .orderBy("createdAt", "desc")
    .limit(Math.min(limit, 200));

  if (status) query = query.where("status", "==", status);
  if (type) query = query.where("type", "==", type);

  const snap = await query.get();
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Counts by status
  const allSnap = await db.collection("approvalQueue").get();
  const counts = { pending: 0, approved: 0, rejected: 0 };
  for (const d of allSnap.docs) {
    const s = d.data().status as ApprovalStatus;
    if (s in counts) counts[s]++;
  }

  return NextResponse.json({ items, counts });
}

export async function POST(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    type,
    title,
    description,
    content,
    context = {},
    agentId,
    agentRole,
    agentName,
    workflowRunId,
    conversationId,
    priority = "medium",
    expiresAt,
  } = body as {
    type: ApprovalType;
    title: string;
    description: string;
    content: string;
    context?: Record<string, unknown>;
    agentId?: string;
    agentRole?: string;
    agentName?: string;
    workflowRunId?: string;
    conversationId?: string;
    priority?: ApprovalPriority;
    expiresAt?: string;
  };

  if (!type || !title || !content) {
    return NextResponse.json({ error: "type, title, content required." }, { status: 400 });
  }

  const db = adminDb();
  const ref = db.collection("approvalQueue").doc();
  const now = new Date().toISOString();

  const item = {
    type,
    title,
    description: description ?? "",
    content: content.slice(0, 2000),
    context,
    requestedBy: `admin:${decoded.uid}`,
    agentId: agentId ?? null,
    agentRole: agentRole ?? null,
    agentName: agentName ?? null,
    workflowRunId: workflowRunId ?? null,
    conversationId: conversationId ?? null,
    status: "pending" as ApprovalStatus,
    priority,
    reviewedBy: null,
    reviewedAt: null,
    reviewNote: null,
    createdAt: now,
    expiresAt: expiresAt ?? null,
  };

  await ref.set(item);
  return NextResponse.json({ id: ref.id, ...item }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, status, reviewNote } = body as {
    id: string;
    status: ApprovalStatus;
    reviewNote?: string;
  };

  if (!id || !status) {
    return NextResponse.json({ error: "id and status required." }, { status: 400 });
  }
  if (!["approved", "rejected"].includes(status)) {
    return NextResponse.json({ error: "status must be approved or rejected." }, { status: 400 });
  }

  const db = adminDb();
  await db.collection("approvalQueue").doc(id).update({
    status,
    reviewedBy: decoded.uid,
    reviewedAt: new Date().toISOString(),
    reviewNote: reviewNote ?? null,
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
  await db.collection("approvalQueue").doc(id).delete();
  return NextResponse.json({ success: true });
}
