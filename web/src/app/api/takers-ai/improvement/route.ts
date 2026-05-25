// Takers AI — Self-Improvement Signals API
//
// GET  /api/takers-ai/improvement                    → full improvement report
// GET  /api/takers-ai/improvement?agent=<role>       → per-agent performance
// GET  /api/takers-ai/improvement?routing=true       → routing improvement suggestions
// GET  /api/takers-ai/improvement?workflows=true     → workflow recommendations
// GET  /api/takers-ai/improvement?prompts=<role>     → prompt improvement suggestions
// GET  /api/takers-ai/improvement?signals=true       → raw signal feed
// POST /api/takers-ai/improvement                    → record a signal manually

import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import {
  computeImprovementReport,
  getAgentPerformance,
  getRoutingImprovements,
  getWorkflowRecommendations,
  getPromptImprovements,
  createImprovementSignal,
} from "@/lib/takers-ai/self-improvement";
import type { ImprovementSignalCreate, ImprovementSignalType } from "@/lib/takers-ai/self-improvement";
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
  const agentRole = searchParams.get("agent");
  const showRouting = searchParams.get("routing") === "true";
  const showWorkflows = searchParams.get("workflows") === "true";
  const showSignals = searchParams.get("signals") === "true";
  const promptRole = searchParams.get("prompts");
  const periodDays = Math.min(Number(searchParams.get("days") ?? "30"), 90);
  const since = searchParams.get("since") ?? undefined;
  const limit = Math.min(Number(searchParams.get("limit") ?? "100"), 500);
  const db = adminDb();

  // Full improvement report (most expensive query — cached recommended)
  if (!agentRole && !showRouting && !showWorkflows && !showSignals && !promptRole) {
    const report = await computeImprovementReport(db, periodDays);
    return NextResponse.json(report);
  }

  // Per-agent performance
  if (agentRole) {
    const performance = await getAgentPerformance(db, agentRole as AgentRole, since);
    const prompts = await getPromptImprovements(db, agentRole as AgentRole);
    return NextResponse.json({ performance, promptImprovements: prompts });
  }

  // Routing improvements
  if (showRouting) {
    const improvements = await getRoutingImprovements(db, 20);
    return NextResponse.json({ improvements, total: improvements.length });
  }

  // Workflow recommendations
  if (showWorkflows) {
    const recommendations = await getWorkflowRecommendations(db, 20);
    return NextResponse.json({ recommendations, total: recommendations.length });
  }

  // Prompt improvements for a role
  if (promptRole) {
    const improvements = await getPromptImprovements(db, promptRole as AgentRole);
    return NextResponse.json({ role: promptRole, improvements });
  }

  // Raw signal feed
  if (showSignals) {
    const type = searchParams.get("type");
    let query: FirebaseFirestore.Query = db
      .collection("improvementSignals")
      .orderBy("createdAt", "desc")
      .limit(limit);

    if (type) query = db.collection("improvementSignals").where("type", "==", type).orderBy("createdAt", "desc").limit(limit);
    if (since) query = db.collection("improvementSignals").where("createdAt", ">=", since).orderBy("createdAt", "desc").limit(limit);

    const snap = await query.get();
    const signals = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ signals, total: snap.size });
  }

  return NextResponse.json({ error: "Unknown query params." }, { status: 400 });
}

// ── POST: Record a signal ─────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    type,
    agentRole,
    workflowDefinitionId,
    pipelineRunId,
    stepIndex,
    qualityScore,
    correctionApplied,
    failureCode,
    promptStructureHash,
    promptStructureSnippet,
    costUsd,
    durationMs,
    tokenCount,
    metadata,
  } = body as ImprovementSignalCreate;

  if (!type) return NextResponse.json({ error: "type required." }, { status: 400 });

  const validTypes: ImprovementSignalType[] = [
    "workflow_success", "workflow_failure", "routing_correction",
    "output_revision_needed", "output_revision_accepted", "plan_accepted",
    "plan_rejected", "reflection_pass", "reflection_fail", "high_cost_run",
    "efficient_run", "timeout", "approval_accepted", "approval_rejected_with_edit",
    "recurring_failure", "prompt_structure_success",
  ];
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: `Invalid type. Valid: ${validTypes.join(", ")}` }, { status: 400 });
  }

  const db = adminDb();
  const signal = createImprovementSignal({
    type, agentRole, workflowDefinitionId, pipelineRunId, stepIndex,
    qualityScore, correctionApplied, failureCode, promptStructureHash,
    promptStructureSnippet, costUsd, durationMs, tokenCount, metadata,
  });

  const ref = db.collection("improvementSignals").doc();
  await ref.set(signal);

  return NextResponse.json({ id: ref.id, success: true }, { status: 201 });
}
