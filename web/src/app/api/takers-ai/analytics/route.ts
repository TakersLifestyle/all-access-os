// Takers AI — Agent Performance Analytics
// GET /api/takers-ai/analytics
//
// Aggregates data from: agentLogs, workflowRuns, feedbackLogs, approvalQueue, pipelineRuns
// Returns per-agent stats + system-wide metrics + 7-day activity time series.
//
// Intentionally computed at query time — no materialized views needed until >10k logs.

import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
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

export interface AgentStats {
  agentId: string;
  agentRole: AgentRole;
  agentName: string;
  // Generation metrics
  totalGenerations: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  avgDurationMs: number;
  // Routing metrics (operator only)
  totalRoutings: number;
  fallbackCount: number;
  fallbackRate: number;
  avgConfidence: number;
  // Quality metrics
  feedbackPositive: number;
  feedbackNegative: number;
  feedbackTotal: number;
  approvalRate: number;       // approved / (approved + rejected)
  rejectionRate: number;
  // Error metrics
  errorCount: number;
  errorRate: number;
}

export interface SystemAnalytics {
  // Overview
  totalAgentLogs: number;
  totalWorkflowRuns: number;
  totalPipelineRuns: number;
  totalTokensUsed: number;
  avgRoutingConfidence: number;
  systemFallbackRate: number;
  // Quality
  overallApprovalRate: number;
  overallFeedbackScore: number;  // positive / total * 100
  // Errors
  totalErrors: number;
  errorRate: number;
  // Pipeline
  pipelineCompletionRate: number;
  // Per-agent breakdown
  agentStats: AgentStats[];
  // Time series: last 7 days
  dailyActivity: Array<{
    date: string;           // YYYY-MM-DD
    routings: number;
    generations: number;
    errors: number;
    tokens: number;
  }>;
  // Top routes (most routed agents)
  topRoutedRoles: Array<{ role: AgentRole; count: number; pct: number }>;
  // Knowledge base
  knowledgeDocCount: number;
  knowledgeChunkCount: number;
  computedAt: string;
}

export async function GET(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = adminDb();

  // ── Parallel data fetch ───────────────────────────────────────────────────
  const [
    agentLogsSnap,
    workflowRunsSnap,
    feedbackSnap,
    approvalSnap,
    pipelineSnap,
    agentsSnap,
    knowledgeDocSnap,
    knowledgeChunkSnap,
  ] = await Promise.all([
    db.collection("agentLogs").orderBy("createdAt", "desc").limit(500).get(),
    db.collection("workflowRuns").orderBy("startedAt", "desc").limit(500).get(),
    db.collection("feedbackLogs").orderBy("createdAt", "desc").limit(500).get(),
    db.collection("approvalQueue").orderBy("createdAt", "desc").limit(500).get(),
    db.collection("pipelineRuns").orderBy("startedAt", "desc").limit(200).get(),
    db.collection("agents").get(),
    db.collection("knowledgeBase").count().get(),
    db.collection("knowledgeChunks").count().get(),
  ]);

  const agents = Object.fromEntries(
    agentsSnap.docs.map((d) => [d.id, { role: d.data().role as AgentRole, name: d.data().name as string }])
  );

  // ── Per-agent stat accumulators ───────────────────────────────────────────
  const agentAccumulators: Record<string, {
    agentId: string; agentRole: AgentRole; agentName: string;
    generations: number; inputTokens: number; outputTokens: number;
    durationMs: number[]; routings: number; fallbacks: number;
    confidences: number[]; errors: number;
  }> = {};

  function getAccumulator(agentId: string, agentRole: AgentRole, agentName: string) {
    if (!agentAccumulators[agentId]) {
      agentAccumulators[agentId] = {
        agentId, agentRole, agentName,
        generations: 0, inputTokens: 0, outputTokens: 0,
        durationMs: [], routings: 0, fallbacks: 0,
        confidences: [], errors: 0,
      };
    }
    return agentAccumulators[agentId];
  }

  // ── Process agent logs ────────────────────────────────────────────────────
  const dailyBuckets: Record<string, { routings: number; generations: number; errors: number; tokens: number }> = {};
  let totalTokens = 0;

  for (const doc of agentLogsSnap.docs) {
    const d = doc.data();
    const agentId = d.agentId as string;
    const agentRole = d.agentRole as AgentRole;
    const agentName = d.agentName as string;
    const acc = getAccumulator(agentId, agentRole, agentName);

    const dateKey = (d.createdAt as string)?.slice(0, 10) ?? "unknown";
    if (!dailyBuckets[dateKey]) {
      dailyBuckets[dateKey] = { routings: 0, generations: 0, errors: 0, tokens: 0 };
    }

    if (d.type === "generation") {
      acc.generations++;
      const tokens = d.tokenUsage as { inputTokens?: number; outputTokens?: number; totalTokens?: number } | null;
      if (tokens) {
        acc.inputTokens += tokens.inputTokens ?? 0;
        acc.outputTokens += tokens.outputTokens ?? 0;
        totalTokens += tokens.totalTokens ?? 0;
        dailyBuckets[dateKey].tokens += tokens.totalTokens ?? 0;
      }
      if (typeof d.durationMs === "number") acc.durationMs.push(d.durationMs);
      dailyBuckets[dateKey].generations++;
    }

    if (d.type === "routing" || d.type === "fallback") {
      acc.routings++;
      if (d.type === "fallback") acc.fallbacks++;
      const routing = d.routingDecision as { confidence?: number } | null;
      if (typeof routing?.confidence === "number") acc.confidences.push(routing.confidence);
      dailyBuckets[dateKey].routings++;
    }

    if (d.type === "error") {
      acc.errors++;
      dailyBuckets[dateKey].errors++;
    }
  }

  // ── Process feedback ──────────────────────────────────────────────────────
  const feedbackByAgent: Record<string, { positive: number; negative: number }> = {};
  for (const doc of feedbackSnap.docs) {
    const d = doc.data();
    const agentId = d.agentId as string;
    if (!feedbackByAgent[agentId]) feedbackByAgent[agentId] = { positive: 0, negative: 0 };
    if (d.rating === "positive") feedbackByAgent[agentId].positive++;
    else feedbackByAgent[agentId].negative++;
  }

  // ── Process approvals ─────────────────────────────────────────────────────
  const approvalByAgent: Record<string, { approved: number; rejected: number }> = {};
  let totalApproved = 0;
  let totalRejected = 0;
  for (const doc of approvalSnap.docs) {
    const d = doc.data();
    if (d.status === "pending") continue;
    const agentId = d.agentId as string;
    if (agentId) {
      if (!approvalByAgent[agentId]) approvalByAgent[agentId] = { approved: 0, rejected: 0 };
      if (d.status === "approved") { approvalByAgent[agentId].approved++; totalApproved++; }
      else if (d.status === "rejected") { approvalByAgent[agentId].rejected++; totalRejected++; }
    } else {
      if (d.status === "approved") totalApproved++;
      else if (d.status === "rejected") totalRejected++;
    }
  }

  // ── Build per-agent stats ─────────────────────────────────────────────────
  const agentStats: AgentStats[] = Object.values(agentAccumulators).map((acc) => {
    const totalLogs = acc.generations + acc.routings + acc.errors;
    const fb = feedbackByAgent[acc.agentId] ?? { positive: 0, negative: 0 };
    const ap = approvalByAgent[acc.agentId] ?? { approved: 0, rejected: 0 };
    const totalApprovals = ap.approved + ap.rejected;

    return {
      agentId: acc.agentId,
      agentRole: acc.agentRole,
      agentName: acc.agentName,
      totalGenerations: acc.generations,
      totalInputTokens: acc.inputTokens,
      totalOutputTokens: acc.outputTokens,
      avgInputTokens: acc.generations > 0 ? Math.round(acc.inputTokens / acc.generations) : 0,
      avgOutputTokens: acc.generations > 0 ? Math.round(acc.outputTokens / acc.generations) : 0,
      avgDurationMs: acc.durationMs.length > 0
        ? Math.round(acc.durationMs.reduce((a, b) => a + b, 0) / acc.durationMs.length)
        : 0,
      totalRoutings: acc.routings,
      fallbackCount: acc.fallbacks,
      fallbackRate: acc.routings > 0 ? Math.round((acc.fallbacks / acc.routings) * 100) : 0,
      avgConfidence: acc.confidences.length > 0
        ? Math.round(acc.confidences.reduce((a, b) => a + b, 0) / acc.confidences.length)
        : 0,
      feedbackPositive: fb.positive,
      feedbackNegative: fb.negative,
      feedbackTotal: fb.positive + fb.negative,
      approvalRate: totalApprovals > 0 ? Math.round((ap.approved / totalApprovals) * 100) : 0,
      rejectionRate: totalApprovals > 0 ? Math.round((ap.rejected / totalApprovals) * 100) : 0,
      errorCount: acc.errors,
      errorRate: totalLogs > 0 ? Math.round((acc.errors / totalLogs) * 100) : 0,
    };
  }).sort((a, b) => b.totalGenerations - a.totalGenerations);

  // ── System-wide aggregates ────────────────────────────────────────────────
  const totalRoutings = agentStats.reduce((s, a) => s + a.totalRoutings, 0);
  const totalFallbacks = agentStats.reduce((s, a) => s + a.fallbackCount, 0);
  const totalErrors = agentStats.reduce((s, a) => s + a.errorCount, 0);
  const totalGenerations = agentStats.reduce((s, a) => s + a.totalGenerations, 0);

  const allConfidences = Object.values(agentAccumulators).flatMap((a) => a.confidences);
  const avgConfidence = allConfidences.length > 0
    ? Math.round(allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length)
    : 0;

  const totalFeedback = feedbackSnap.size;
  const positiveFeedback = feedbackSnap.docs.filter((d) => d.data().rating === "positive").length;
  const totalDecidedApprovals = totalApproved + totalRejected;

  // ── Pipeline stats ────────────────────────────────────────────────────────
  const completedPipelines = pipelineSnap.docs.filter((d) => d.data().state === "completed").length;

  // ── Top routed roles ──────────────────────────────────────────────────────
  const routedRoleCounts: Record<string, number> = {};
  for (const doc of workflowRunsSnap.docs) {
    const role = doc.data().routedToRole as string;
    if (role && role !== "operator") {
      routedRoleCounts[role] = (routedRoleCounts[role] ?? 0) + 1;
    }
  }
  const totalRouted = Object.values(routedRoleCounts).reduce((a, b) => a + b, 0);
  const topRoutedRoles = Object.entries(routedRoleCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([role, count]) => ({
      role: role as AgentRole,
      count,
      pct: totalRouted > 0 ? Math.round((count / totalRouted) * 100) : 0,
    }));

  // ── Daily activity (last 7 days) ──────────────────────────────────────────
  const dailyActivity = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateKey = d.toISOString().slice(0, 10);
    const bucket = dailyBuckets[dateKey] ?? { routings: 0, generations: 0, errors: 0, tokens: 0 };
    dailyActivity.push({ date: dateKey, ...bucket });
  }

  const analytics: SystemAnalytics = {
    totalAgentLogs: agentLogsSnap.size,
    totalWorkflowRuns: workflowRunsSnap.size,
    totalPipelineRuns: pipelineSnap.size,
    totalTokensUsed: totalTokens,
    avgRoutingConfidence: avgConfidence,
    systemFallbackRate: totalRoutings > 0 ? Math.round((totalFallbacks / totalRoutings) * 100) : 0,
    overallApprovalRate: totalDecidedApprovals > 0
      ? Math.round((totalApproved / totalDecidedApprovals) * 100)
      : 0,
    overallFeedbackScore: totalFeedback > 0
      ? Math.round((positiveFeedback / totalFeedback) * 100)
      : 0,
    totalErrors,
    errorRate: (totalGenerations + totalRoutings) > 0
      ? Math.round((totalErrors / (totalGenerations + totalRoutings)) * 100)
      : 0,
    pipelineCompletionRate: pipelineSnap.size > 0
      ? Math.round((completedPipelines / pipelineSnap.size) * 100)
      : 0,
    agentStats,
    dailyActivity,
    topRoutedRoles,
    knowledgeDocCount: knowledgeDocSnap.data().count,
    knowledgeChunkCount: knowledgeChunkSnap.data().count,
    computedAt: new Date().toISOString(),
  };

  return NextResponse.json(analytics);
}
