// Takers AI — Reflection & Self-Critique API
//
// POST /api/takers-ai/reflection               → critique an output
// POST /api/takers-ai/reflection?batch=true    → critique multiple outputs
// GET  /api/takers-ai/reflection               → list reflection logs
// GET  /api/takers-ai/reflection?stats=true    → aggregated quality stats
// GET  /api/takers-ai/reflection?runId=<id>    → reflections for a pipeline run

import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import {
  reflectOnOutput,
  reflectBatch,
  aggregateReflectionScore,
  writeReflectionLog,
} from "@/lib/takers-ai/reflection";
import type { ReflectionOptions } from "@/lib/takers-ai/reflection";
import { getSchemaForRole } from "@/lib/takers-ai/schemas";
import { writeCostEvent, createCostEvent } from "@/lib/takers-ai/cost";
import { writeImprovementSignal } from "@/lib/takers-ai/self-improvement";
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
  const runId = searchParams.get("runId");
  const agentRole = searchParams.get("agentRole");
  const showStats = searchParams.get("stats") === "true";
  const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 200);
  const db = adminDb();

  if (showStats) {
    const snap = await db
      .collection("reflectionLogs")
      .orderBy("createdAt", "desc")
      .limit(200)
      .get();
    const logs = snap.docs.map((d) => d.data());
    const results = logs.map((l) => ({
      approved: l.approved as boolean,
      confidence: l.confidence as number,
      qualityScore: l.qualityScore as number,
      issues: l.issues as [],
      hallucinationRisk: l.hallucinationRisk as "none" | "low" | "medium" | "high",
      schemaCompliant: l.schemaCompliant as boolean | null,
      revisedOutput: l.revisedOutput as string | null,
      reasoning: l.reasoning as string,
      durationMs: l.durationMs as number,
      inputTokens: l.inputTokens as number,
      outputTokens: l.outputTokens as number,
      costUsd: l.costUsd as number,
      suggestions: l.suggestions as string[],
    }));
    const aggregate = aggregateReflectionScore(results);
    const byRole: Record<string, { count: number; avgQuality: number; passRate: number }> = {};
    logs.forEach((l) => {
      const role = l.agentRole as string ?? "unknown";
      if (!byRole[role]) byRole[role] = { count: 0, avgQuality: 0, passRate: 0 };
      byRole[role].count++;
      byRole[role].avgQuality += (l.qualityScore as number) ?? 0;
      byRole[role].passRate += l.approved ? 1 : 0;
    });
    for (const role of Object.keys(byRole)) {
      const r = byRole[role];
      r.avgQuality = Math.round((r.avgQuality / r.count) * 10) / 10;
      r.passRate = Math.round((r.passRate / r.count) * 100) / 100;
    }
    return NextResponse.json({ aggregate, byRole, totalLogs: snap.size });
  }

  let query: FirebaseFirestore.Query = db
    .collection("reflectionLogs")
    .orderBy("createdAt", "desc")
    .limit(limit);

  if (runId) query = db.collection("reflectionLogs").where("pipelineRunId", "==", runId).orderBy("createdAt", "asc").limit(limit);
  if (agentRole) query = db.collection("reflectionLogs").where("agentRole", "==", agentRole).orderBy("createdAt", "desc").limit(limit);

  const snap = await query.get();
  const logs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return NextResponse.json({ logs, total: snap.size });
}

// ── POST: Critique an output ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const isBatch = searchParams.get("batch") === "true";
  const db = adminDb();

  if (isBatch) {
    const body = await req.json();
    const { outputs } = body as {
      outputs: Array<{
        output: string;
        stepName: string;
        agentRole?: AgentRole;
        originalPrompt?: string;
        pipelineRunId?: string;
        stepIndex?: number;
      }>;
    };

    if (!Array.isArray(outputs) || outputs.length === 0) {
      return NextResponse.json({ error: "outputs array required." }, { status: 400 });
    }
    if (outputs.length > 10) {
      return NextResponse.json({ error: "Max 10 outputs per batch." }, { status: 400 });
    }

    const batchInputs = outputs.map((o) => ({
      output: o.output,
      stepName: o.stepName,
      options: {
        agentRole: o.agentRole,
        originalPrompt: o.originalPrompt,
        schema: o.agentRole ? getSchemaForRole(o.agentRole) ?? undefined : undefined,
        performRevision: false,
      } as ReflectionOptions,
    }));

    const results = await reflectBatch(batchInputs);
    const aggregate = aggregateReflectionScore(results);

    // Log all results
    for (let i = 0; i < results.length; i++) {
      const o = outputs[i];
      writeReflectionLog(db, {
        result: results[i],
        agentId: o.agentRole ?? "unknown",
        agentRole: (o.agentRole ?? "operator") as AgentRole,
        pipelineRunId: o.pipelineRunId,
        stepIndex: o.stepIndex,
        outputSnippet: o.output.slice(0, 300),
      });
    }

    return NextResponse.json({ results, aggregate });
  }

  // Single reflection
  const body = await req.json();
  const {
    output,
    agentId,
    agentRole,
    originalPrompt,
    pipelineRunId,
    stepIndex,
    performRevision = false,
    strictMode = false,
    minQualityScore,
  } = body as {
    output: string;
    agentId?: string;
    agentRole?: AgentRole;
    originalPrompt?: string;
    pipelineRunId?: string;
    stepIndex?: number;
    performRevision?: boolean;
    strictMode?: boolean;
    minQualityScore?: number;
  };

  if (!output?.trim()) {
    return NextResponse.json({ error: "output required." }, { status: 400 });
  }

  const schema = agentRole ? getSchemaForRole(agentRole) ?? undefined : undefined;

  const options: ReflectionOptions = {
    agentRole,
    originalPrompt,
    schema,
    performRevision,
    strictMode,
    minQualityScore,
  };

  const result = await reflectOnOutput(output, options);

  // Track cost
  if (result.inputTokens > 0) {
    const costData = createCostEvent(
      "chat_generation",
      agentId ?? "reflection",
      (agentRole ?? "operator") as AgentRole,
      "claude-haiku-4-5",
      result.inputTokens,
      result.outputTokens,
      { pipelineRunId }
    );
    writeCostEvent(db, costData);
  }

  // Log result
  writeReflectionLog(db, {
    result,
    agentId: agentId ?? agentRole ?? "unknown",
    agentRole: (agentRole ?? "operator") as AgentRole,
    pipelineRunId,
    stepIndex,
    outputSnippet: output.slice(0, 300),
  });

  // Improvement signal
  writeImprovementSignal(db, {
    type: result.approved ? "reflection_pass" : "reflection_fail",
    agentRole: agentRole as AgentRole,
    pipelineRunId,
    stepIndex,
    qualityScore: result.qualityScore,
    metadata: {
      confidence: result.confidence,
      hallucinationRisk: result.hallucinationRisk,
      issueCount: result.issues.length,
      revisedOutput: !!result.revisedOutput,
    },
  });

  return NextResponse.json(result, { status: 200 });
}
