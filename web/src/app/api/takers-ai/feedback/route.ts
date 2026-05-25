// Takers AI — Feedback Logs
// POST /api/takers-ai/feedback — save a rating on an agent response
// GET  /api/takers-ai/feedback — list recent feedback

import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import type { FeedbackRating, AgentRole } from "@/lib/takers-ai/types";

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
  const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 100);

  const db = adminDb();
  let snap = await db.collection("feedbackLogs").orderBy("createdAt", "desc").limit(limit).get();
  let logs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (agentId) logs = logs.filter((l: Record<string, unknown>) => l.agentId === agentId);

  return NextResponse.json({ logs });
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    agentId,
    agentRole,
    agentName,
    conversationId,
    outputId,
    workflowRunId,
    messageContent,
    rating,
    comment,
  } = await req.json() as {
    agentId: string;
    agentRole: AgentRole;
    agentName: string;
    conversationId?: string;
    outputId?: string;
    workflowRunId?: string;
    messageContent: string;
    rating: FeedbackRating;
    comment?: string;
  };

  if (!agentId || !rating || !messageContent) {
    return NextResponse.json({ error: "agentId, rating, messageContent required." }, { status: 400 });
  }

  const db = adminDb();
  const ref = db.collection("feedbackLogs").doc();
  const now = new Date().toISOString();

  await ref.set({
    agentId,
    agentRole: agentRole ?? "operator",
    agentName: agentName ?? "",
    conversationId: conversationId ?? null,
    outputId: outputId ?? null,
    workflowRunId: workflowRunId ?? null,
    messageContent: messageContent.slice(0, 500), // cap stored content
    rating,
    comment: comment ?? "",
    adminUid: admin.uid,
    createdAt: now,
  });

  return NextResponse.json({ id: ref.id, success: true }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });

  await adminDb().collection("feedbackLogs").doc(id).delete();
  return NextResponse.json({ success: true });
}
