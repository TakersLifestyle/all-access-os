// Takers AI — Feedback Learning Insights
//
// GET  /api/takers-ai/feedback-insights              → full learning insights
// GET  /api/takers-ai/feedback-insights?role=<role>  → per-role quality score + preferences
// GET  /api/takers-ai/feedback-insights?routing=true → routing hints for classifier
// POST /api/takers-ai/feedback-insights              → record a feedback signal
// DELETE /api/takers-ai/feedback-insights?id=<id>   → delete a signal

import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import {
  createSignal,
  computeLearningInsights,
  getRoleQualityScore,
  getFormatPreferences,
  getRoutingHints,
  computeEditDistance,
} from "@/lib/takers-ai/feedback-engine";
import type { FeedbackSignalType } from "@/lib/takers-ai/feedback-engine";
import type { AgentRole } from "@/lib/takers-ai/types";

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

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const role = searchParams.get("role") as AgentRole | null;
  const routing = searchParams.get("routing") === "true";
  const db = adminDb();

  // Routing hints for classifier
  if (routing) {
    const hints = await getRoutingHints(db, 10);
    return NextResponse.json({ hints, total: hints.length });
  }

  // Per-role insights
  if (role) {
    const [qualityScore, formatPref] = await Promise.all([
      getRoleQualityScore(db, role),
      getFormatPreferences(db, role),
    ]);
    return NextResponse.json({ role, qualityScore, formatPref });
  }

  // Full system insights
  const insights = await computeLearningInsights(db);
  return NextResponse.json(insights);
}

// ── POST: Record a feedback signal ───────────────────────────────────────────
export async function POST(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    type,
    agentRole,
    agentId,
    // Routing signals
    originalRole,
    correctedRole,
    userMessagePreview,
    routingConfidence,
    // Output signals
    originalOutput,
    editedOutput,
    rejectionReason,
    // Format signals
    formatPattern,
    // Workflow signals
    workflowDefinitionId,
    pipelineRunId,
    stepsCompleted,
    totalSteps,
    // Context
    conversationId,
    workflowRunId,
  } = body as {
    type: FeedbackSignalType;
    agentRole: AgentRole;
    agentId: string;
    originalRole?: AgentRole;
    correctedRole?: AgentRole;
    userMessagePreview?: string;
    routingConfidence?: number;
    originalOutput?: string;
    editedOutput?: string;
    rejectionReason?: string;
    formatPattern?: string;
    workflowDefinitionId?: string;
    pipelineRunId?: string;
    stepsCompleted?: number;
    totalSteps?: number;
    conversationId?: string;
    workflowRunId?: string;
  };

  if (!type || !agentRole || !agentId) {
    return NextResponse.json({ error: "type, agentRole, agentId required." }, { status: 400 });
  }

  // Auto-compute edit distance if both outputs provided
  let editDistance: number | undefined;
  if (originalOutput && editedOutput) {
    editDistance = computeEditDistance(originalOutput, editedOutput);
  }

  const signalData = createSignal(type, agentRole, agentId, decoded.uid, {
    originalRole,
    correctedRole,
    userMessagePreview: userMessagePreview?.slice(0, 200),
    routingConfidence,
    originalOutput: originalOutput?.slice(0, 500),
    editedOutput: editedOutput?.slice(0, 500),
    editDistance,
    rejectionReason: rejectionReason?.slice(0, 300),
    formatPattern,
    workflowDefinitionId,
    pipelineRunId,
    stepsCompleted,
    totalSteps,
    conversationId,
    workflowRunId,
  });

  const db = adminDb();
  const ref = db.collection("feedbackSignals").doc();
  await ref.set(signalData);

  return NextResponse.json({ id: ref.id, success: true }, { status: 201 });
}

// ── DELETE ────────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });

  await adminDb().collection("feedbackSignals").doc(id).delete();
  return NextResponse.json({ success: true });
}
