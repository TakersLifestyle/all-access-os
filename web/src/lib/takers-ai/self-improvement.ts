// Takers AI — Self-Improvement Signal System
//
// Tracks outcomes across the AI system and uses them to improve:
//   - Agent routing accuracy
//   - Prompt assembly quality
//   - Workflow recommendations
//   - Execution planning
//
// Signal types cover the full lifecycle: workflow outcomes, reflection passes/fails,
// routing corrections, plan acceptance/rejection, recurring failure patterns,
// and high-performing prompt structures.
//
// Signals are aggregated into:
//   - Prompt improvement suggestions per agent role
//   - Routing correction patterns for the classifier
//   - Workflow recommendation rankings
//   - System-level learning report

import type { AgentRole } from "./types";

// ── Signal types ──────────────────────────────────────────────────────────────

export type ImprovementSignalType =
  | "workflow_success"
  | "workflow_failure"
  | "routing_correction"
  | "output_revision_needed"
  | "output_revision_accepted"
  | "plan_accepted"
  | "plan_rejected"
  | "reflection_pass"
  | "reflection_fail"
  | "high_cost_run"
  | "efficient_run"
  | "timeout"
  | "approval_accepted"
  | "approval_rejected_with_edit"
  | "recurring_failure"
  | "prompt_structure_success";

export interface ImprovementSignal {
  id: string;
  type: ImprovementSignalType;
  // Context
  agentRole: AgentRole | null;
  workflowDefinitionId: string | null;
  pipelineRunId: string | null;
  stepIndex: number | null;
  // Quality data
  qualityScore: number | null;       // 0-10 from reflection
  correctionApplied: string | null;  // what was changed / what correction was made
  failureCode: string | null;
  // Prompt data (for prompt structure learning)
  promptStructureHash: string | null;  // hash of prompt template (sanitized)
  promptStructureSnippet: string | null; // first 200 chars of effective prompt
  // Performance data
  costUsd: number | null;
  durationMs: number | null;
  tokenCount: number | null;
  // Signal strength
  weight: number;   // 0-1. Higher = more signal
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ImprovementSignalCreate {
  type: ImprovementSignalType;
  agentRole?: AgentRole;
  workflowDefinitionId?: string;
  pipelineRunId?: string;
  stepIndex?: number;
  qualityScore?: number;
  correctionApplied?: string;
  failureCode?: string;
  promptStructureHash?: string;
  promptStructureSnippet?: string;
  costUsd?: number;
  durationMs?: number;
  tokenCount?: number;
  metadata?: Record<string, unknown>;
}

// ── Signal weights ────────────────────────────────────────────────────────────
const SIGNAL_WEIGHTS: Record<ImprovementSignalType, number> = {
  workflow_success:             0.7,
  workflow_failure:             0.9,   // failures teach more
  routing_correction:           1.0,   // most valuable routing signal
  output_revision_needed:       0.8,
  output_revision_accepted:     0.6,
  plan_accepted:                0.6,
  plan_rejected:                0.8,
  reflection_pass:              0.4,
  reflection_fail:              0.7,
  high_cost_run:                0.5,
  efficient_run:                0.5,
  timeout:                      0.9,
  approval_accepted:            0.5,
  approval_rejected_with_edit:  0.8,
  recurring_failure:            1.0,
  prompt_structure_success:     0.7,
};

// ── Factory ───────────────────────────────────────────────────────────────────
export function createImprovementSignal(data: ImprovementSignalCreate): Omit<ImprovementSignal, "id"> {
  return {
    type: data.type,
    agentRole: data.agentRole ?? null,
    workflowDefinitionId: data.workflowDefinitionId ?? null,
    pipelineRunId: data.pipelineRunId ?? null,
    stepIndex: data.stepIndex ?? null,
    qualityScore: data.qualityScore ?? null,
    correctionApplied: data.correctionApplied ?? null,
    failureCode: data.failureCode ?? null,
    promptStructureHash: data.promptStructureHash ?? null,
    promptStructureSnippet: data.promptStructureSnippet ?? null,
    costUsd: data.costUsd ?? null,
    durationMs: data.durationMs ?? null,
    tokenCount: data.tokenCount ?? null,
    weight: SIGNAL_WEIGHTS[data.type] ?? 0.5,
    metadata: data.metadata ?? {},
    createdAt: new Date().toISOString(),
  };
}

// ── Fire-and-forget writer ────────────────────────────────────────────────────
export function writeImprovementSignal(
  db: FirebaseFirestore.Firestore,
  data: ImprovementSignalCreate
): void {
  db.collection("improvementSignals")
    .doc()
    .set(createImprovementSignal(data))
    .catch((err) => console.error("[self-improvement] write failed:", err));
}

// ── Prompt structure hash (sanitized) ─────────────────────────────────────────
// Strips variable values from prompt templates to produce a stable structure hash.
// {{variableName}} → {{VAR}}, then hash the result.
export function hashPromptStructure(promptTemplate: string): string {
  const normalized = promptTemplate
    .replace(/\{\{[^}]+\}\}/g, "{{VAR}}")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .slice(0, 500);
  // djb2 hash
  let hash = 5381;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) + hash) ^ normalized.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

// ── Agent performance summary ─────────────────────────────────────────────────
export interface AgentPerformanceSummary {
  agentRole: AgentRole;
  totalRuns: number;
  successRate: number;       // 0-1
  avgQualityScore: number;   // 0-10
  reflectionPassRate: number; // 0-1
  revisionRate: number;       // how often outputs needed revision
  routingAccuracy: number;    // 1 - (corrections / total_routed)
  avgCostUsd: number;
  avgDurationMs: number;
  commonFailures: string[];
  topPromptPatterns: string[];
  improvementPriority: "high" | "medium" | "low";
}

export async function getAgentPerformance(
  db: FirebaseFirestore.Firestore,
  agentRole: AgentRole,
  since?: string
): Promise<AgentPerformanceSummary> {
  const cutoff = since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const snap = await db
    .collection("improvementSignals")
    .where("agentRole", "==", agentRole)
    .where("createdAt", ">=", cutoff)
    .orderBy("createdAt", "desc")
    .limit(500)
    .get();

  const signals = snap.docs.map((d) => d.data() as ImprovementSignal);

  const successes = signals.filter((s) => s.type === "workflow_success").length;
  const failures = signals.filter((s) => s.type === "workflow_failure").length;
  const total = successes + failures;

  const reflectionPasses = signals.filter((s) => s.type === "reflection_pass").length;
  const reflectionFails = signals.filter((s) => s.type === "reflection_fail").length;
  const reflectionTotal = reflectionPasses + reflectionFails;

  const revisions = signals.filter((s) => s.type === "output_revision_needed").length;
  const corrections = signals.filter((s) => s.type === "routing_correction").length;
  const totalRouted = signals.filter((s) =>
    ["workflow_success", "workflow_failure", "routing_correction"].includes(s.type)
  ).length;

  const qualityScores = signals
    .filter((s) => s.qualityScore !== null)
    .map((s) => s.qualityScore as number);
  const avgQuality = qualityScores.length > 0
    ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length : 7;

  const costs = signals.filter((s) => s.costUsd !== null).map((s) => s.costUsd as number);
  const avgCost = costs.length > 0 ? costs.reduce((a, b) => a + b, 0) / costs.length : 0;

  const durations = signals.filter((s) => s.durationMs !== null).map((s) => s.durationMs as number);
  const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

  // Common failure codes
  const failureCounts: Record<string, number> = {};
  signals
    .filter((s) => s.failureCode)
    .forEach((s) => { failureCounts[s.failureCode!] = (failureCounts[s.failureCode!] ?? 0) + 1; });
  const commonFailures = Object.entries(failureCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([code, count]) => `${code} (×${count})`);

  // Top performing prompt structures
  const promptCounts: Record<string, number> = {};
  signals
    .filter((s) => s.type === "prompt_structure_success" && s.promptStructureHash)
    .forEach((s) => { promptCounts[s.promptStructureSnippet ?? s.promptStructureHash!] = (promptCounts[s.promptStructureSnippet ?? s.promptStructureHash!] ?? 0) + 1; });
  const topPromptPatterns = Object.entries(promptCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([snippet]) => snippet);

  // Priority: improve agents with high failure rate or low quality
  const successRate = total > 0 ? successes / total : 1;
  const improvementPriority =
    successRate < 0.6 || avgQuality < 6 ? "high"
    : successRate < 0.8 || avgQuality < 7.5 ? "medium"
    : "low";

  return {
    agentRole,
    totalRuns: total,
    successRate: Math.round(successRate * 100) / 100,
    avgQualityScore: Math.round(avgQuality * 10) / 10,
    reflectionPassRate: reflectionTotal > 0
      ? Math.round((reflectionPasses / reflectionTotal) * 100) / 100 : 1,
    revisionRate: total > 0 ? Math.round((revisions / total) * 100) / 100 : 0,
    routingAccuracy: totalRouted > 0
      ? Math.round(((totalRouted - corrections) / totalRouted) * 100) / 100 : 1,
    avgCostUsd: Math.round(avgCost * 1_000_000) / 1_000_000,
    avgDurationMs: Math.round(avgDuration),
    commonFailures,
    topPromptPatterns,
    improvementPriority,
  };
}

// ── Routing improvement suggestions ──────────────────────────────────────────
export interface RoutingImprovementSuggestion {
  pattern: string;        // message pattern that was mis-routed
  currentRoute: AgentRole;
  suggestedRoute: AgentRole;
  occurrences: number;
  confidence: number;     // 0-100
  exampleCorrection: string;
}

export async function getRoutingImprovements(
  db: FirebaseFirestore.Firestore,
  limit = 10
): Promise<RoutingImprovementSuggestion[]> {
  const snap = await db
    .collection("improvementSignals")
    .where("type", "==", "routing_correction")
    .orderBy("createdAt", "desc")
    .limit(200)
    .get();

  const signals = snap.docs.map((d) => d.data() as ImprovementSignal);

  // Group by correction pattern
  const corrections: Record<string, {
    current: AgentRole;
    suggested: AgentRole;
    count: number;
    examples: string[];
  }> = {};

  for (const signal of signals) {
    const key = signal.correctionApplied ?? "";
    const current = signal.agentRole ?? "operator";
    const suggested = (signal.metadata.correctedTo as AgentRole) ?? "operator";
    const k = `${current}→${suggested}`;

    if (!corrections[k]) {
      corrections[k] = { current, suggested, count: 0, examples: [] };
    }
    corrections[k].count++;
    if (corrections[k].examples.length < 3 && key) {
      corrections[k].examples.push(key);
    }
  }

  return Object.entries(corrections)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, limit)
    .map(([, v]) => ({
      pattern: v.examples[0] ?? "No example available",
      currentRoute: v.current,
      suggestedRoute: v.suggested,
      occurrences: v.count,
      confidence: Math.min(95, 50 + v.count * 5),
      exampleCorrection: v.examples.join(" | "),
    }));
}

// ── Prompt improvement suggestions ───────────────────────────────────────────
export interface PromptImprovementSuggestion {
  agentRole: AgentRole;
  currentPattern: string;
  suggestedAddition: string;
  expectedImpact: "quality" | "consistency" | "formatting" | "cost_reduction";
  supportingEvidence: string;
  priority: number;   // 1-10
}

export async function getPromptImprovements(
  db: FirebaseFirestore.Firestore,
  agentRole: AgentRole
): Promise<PromptImprovementSuggestion[]> {
  // Gather revision signals — what was changed and what issue it fixed
  const snap = await db
    .collection("improvementSignals")
    .where("agentRole", "==", agentRole)
    .where("type", "==", "output_revision_accepted")
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();

  const signals = snap.docs.map((d) => d.data() as ImprovementSignal);

  // Group by correction type
  const corrections: Record<string, { count: number; examples: string[] }> = {};
  for (const signal of signals) {
    const correction = signal.correctionApplied ?? "unspecified";
    if (!corrections[correction]) corrections[correction] = { count: 0, examples: [] };
    corrections[correction].count++;
    if (corrections[correction].examples.length < 2 && signal.promptStructureSnippet) {
      corrections[correction].examples.push(signal.promptStructureSnippet);
    }
  }

  return Object.entries(corrections)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([correction, data]) => ({
      agentRole,
      currentPattern: data.examples[0] ?? "No pattern captured",
      suggestedAddition: `Address: ${correction}`,
      expectedImpact: inferImpactType(correction),
      supportingEvidence: `Occurred ${data.count} time(s) in approved revisions`,
      priority: Math.min(10, data.count * 2),
    }));
}

function inferImpactType(correction: string): PromptImprovementSuggestion["expectedImpact"] {
  const lower = correction.toLowerCase();
  if (lower.includes("format") || lower.includes("json") || lower.includes("structure")) return "formatting";
  if (lower.includes("cost") || lower.includes("token") || lower.includes("brief")) return "cost_reduction";
  if (lower.includes("consistent") || lower.includes("tone")) return "consistency";
  return "quality";
}

// ── Workflow recommendation ranking ──────────────────────────────────────────
export interface WorkflowRecommendation {
  definitionId: string;
  definitionName: string;
  successRate: number;
  avgQualityScore: number;
  avgCostUsd: number;
  avgDurationMs: number;
  totalRuns: number;
  score: number;           // composite recommendation score 0-100
  trend: "improving" | "stable" | "degrading";
}

export async function getWorkflowRecommendations(
  db: FirebaseFirestore.Firestore,
  limit = 10
): Promise<WorkflowRecommendation[]> {
  const snap = await db
    .collection("improvementSignals")
    .where("workflowDefinitionId", "!=", null)
    .orderBy("workflowDefinitionId")
    .orderBy("createdAt", "desc")
    .limit(500)
    .get();

  const signals = snap.docs.map((d) => d.data() as ImprovementSignal);

  // Group by workflow
  const byWorkflow: Record<string, ImprovementSignal[]> = {};
  for (const signal of signals) {
    const id = signal.workflowDefinitionId!;
    if (!byWorkflow[id]) byWorkflow[id] = [];
    byWorkflow[id].push(signal);
  }

  const recommendations: WorkflowRecommendation[] = [];

  for (const [definitionId, wfSignals] of Object.entries(byWorkflow)) {
    const successes = wfSignals.filter((s) => s.type === "workflow_success").length;
    const failures = wfSignals.filter((s) => s.type === "workflow_failure").length;
    const total = successes + failures;
    if (total === 0) continue;

    const successRate = successes / total;
    const qualityScores = wfSignals.filter((s) => s.qualityScore !== null).map((s) => s.qualityScore!);
    const avgQuality = qualityScores.length > 0
      ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length : 7;
    const costs = wfSignals.filter((s) => s.costUsd !== null).map((s) => s.costUsd!);
    const avgCost = costs.length > 0 ? costs.reduce((a, b) => a + b, 0) / costs.length : 0;
    const durations = wfSignals.filter((s) => s.durationMs !== null).map((s) => s.durationMs!);
    const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

    // Trend: compare last 5 runs vs previous 5
    const recentSuccessRate = computeRecentTrend(wfSignals);

    const score = Math.round(
      successRate * 40 +
      (avgQuality / 10) * 35 +
      Math.max(0, 25 - avgCost * 100) // lower cost = higher score, up to 25pts
    );

    recommendations.push({
      definitionId,
      definitionName: (wfSignals[0]?.metadata?.definitionName as string) ?? definitionId,
      successRate: Math.round(successRate * 100) / 100,
      avgQualityScore: Math.round(avgQuality * 10) / 10,
      avgCostUsd: Math.round(avgCost * 1_000_000) / 1_000_000,
      avgDurationMs: Math.round(avgDuration),
      totalRuns: total,
      score,
      trend: recentSuccessRate,
    });
  }

  return recommendations
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function computeRecentTrend(
  signals: ImprovementSignal[]
): WorkflowRecommendation["trend"] {
  const recent = signals.slice(0, 5);
  const older = signals.slice(5, 10);
  if (recent.length === 0 || older.length === 0) return "stable";

  const recentRate = recent.filter((s) => s.type === "workflow_success").length / recent.length;
  const olderRate = older.filter((s) => s.type === "workflow_success").length / older.length;

  if (recentRate > olderRate + 0.1) return "improving";
  if (recentRate < olderRate - 0.1) return "degrading";
  return "stable";
}

// ── Full improvement report ───────────────────────────────────────────────────
export interface ImprovementReport {
  generatedAt: string;
  periodDays: number;
  totalSignals: number;
  agentPerformance: AgentPerformanceSummary[];
  routingImprovements: RoutingImprovementSuggestion[];
  workflowRecommendations: WorkflowRecommendation[];
  systemHealth: {
    overallSuccessRate: number;
    avgQualityScore: number;
    totalWorkflowRuns: number;
    costTrend: "increasing" | "stable" | "decreasing";
  };
  topActions: string[];   // prioritized list of system improvements to make
}

export async function computeImprovementReport(
  db: FirebaseFirestore.Firestore,
  periodDays = 30
): Promise<ImprovementReport> {
  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();

  const [allSnap, routingImprovements, workflowRecs] = await Promise.all([
    db.collection("improvementSignals")
      .where("createdAt", ">=", since)
      .orderBy("createdAt", "desc")
      .limit(1000)
      .get(),
    getRoutingImprovements(db),
    getWorkflowRecommendations(db),
  ]);

  const allSignals = allSnap.docs.map((d) => d.data() as ImprovementSignal);

  // Per-agent summaries
  const roles: AgentRole[] = ["content", "marketing", "events", "support", "strategy", "developer", "operations", "operator"];
  const agentPerformance = await Promise.all(
    roles.map((role) => getAgentPerformance(db, role, since))
  );

  const successSignals = allSignals.filter((s) => s.type === "workflow_success").length;
  const failureSignals = allSignals.filter((s) => s.type === "workflow_failure").length;
  const totalRuns = successSignals + failureSignals;
  const overallSuccessRate = totalRuns > 0 ? successSignals / totalRuns : 1;

  const qualityScores = allSignals.filter((s) => s.qualityScore !== null).map((s) => s.qualityScore!);
  const avgQuality = qualityScores.length > 0
    ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length : 7;

  // Cost trend: compare first half vs second half of period
  const midpoint = new Date(Date.now() - (periodDays / 2) * 24 * 60 * 60 * 1000).toISOString();
  const recentCosts = allSignals
    .filter((s) => s.createdAt >= midpoint && s.costUsd !== null)
    .map((s) => s.costUsd!);
  const olderCosts = allSignals
    .filter((s) => s.createdAt < midpoint && s.costUsd !== null)
    .map((s) => s.costUsd!);
  const recentAvgCost = recentCosts.length > 0 ? recentCosts.reduce((a, b) => a + b, 0) / recentCosts.length : 0;
  const olderAvgCost = olderCosts.length > 0 ? olderCosts.reduce((a, b) => a + b, 0) / olderCosts.length : 0;
  const costTrend: ImprovementReport["systemHealth"]["costTrend"] =
    recentAvgCost > olderAvgCost * 1.1 ? "increasing"
    : recentAvgCost < olderAvgCost * 0.9 ? "decreasing"
    : "stable";

  // Top action items
  const topActions: string[] = [];
  const highPriorityAgents = agentPerformance.filter((a) => a.improvementPriority === "high");
  if (highPriorityAgents.length > 0) {
    topActions.push(`Improve prompt templates for: ${highPriorityAgents.map((a) => a.agentRole).join(", ")}`);
  }
  if (routingImprovements.length > 0) {
    topActions.push(`Fix ${routingImprovements.length} routing pattern(s), especially ${routingImprovements[0].currentRoute}→${routingImprovements[0].suggestedRoute}`);
  }
  const degradingWorkflows = workflowRecs.filter((w) => w.trend === "degrading");
  if (degradingWorkflows.length > 0) {
    topActions.push(`Review degrading workflows: ${degradingWorkflows.map((w) => w.definitionName).join(", ")}`);
  }
  if (costTrend === "increasing") {
    topActions.push("Investigate rising AI costs — consider model downgrade for lower-stakes steps");
  }
  if (overallSuccessRate < 0.7) {
    topActions.push("System success rate below 70% — audit DLQ and failure patterns urgently");
  }

  return {
    generatedAt: new Date().toISOString(),
    periodDays,
    totalSignals: allSignals.length,
    agentPerformance,
    routingImprovements,
    workflowRecommendations: workflowRecs,
    systemHealth: {
      overallSuccessRate: Math.round(overallSuccessRate * 100) / 100,
      avgQualityScore: Math.round(avgQuality * 10) / 10,
      totalWorkflowRuns: totalRuns,
      costTrend,
    },
    topActions,
  };
}
