// Takers AI — Cost Intelligence
//
// Tracks and analyzes AI operational costs across:
//   - Generation (Claude API — per model, per agent, per workflow)
//   - Embeddings (Voyage AI — per document, per chunk, per ingest job)
//   - Retrieval (semantic search queries — estimated)
//
// Pricing (USD per 1M tokens, as of 2025):
//   claude-opus-4-5:   input $15, output $75
//   claude-sonnet-4-5: input $3,  output $15
//   claude-haiku-4-5:  input $0.25, output $1.25
//   voyage-3-lite:     $0.02 per 1M tokens (both input types)
//
// Cost ledger:
//   Each agentLog.tokenUsage contributes a computed cost to `costLedger`.
//   costLedger/{docId} = daily rollup per agent + per workflow.
//   Separate `costEvents` for per-request tracking at full granularity.

import type { AgentRole } from "./types";

// ── Pricing model ─────────────────────────────────────────────────────────────
export interface ModelPricing {
  inputPer1M: number;   // USD
  outputPer1M: number;  // USD
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  "claude-opus-4-5":   { inputPer1M: 15.00,  outputPer1M: 75.00  },
  "claude-sonnet-4-5": { inputPer1M: 3.00,   outputPer1M: 15.00  },
  "claude-haiku-4-5":  { inputPer1M: 0.25,   outputPer1M: 1.25   },
  // Haiku used for routing classifier
  "claude-haiku-4-5-routing": { inputPer1M: 0.25, outputPer1M: 1.25 },
};

export const VOYAGE_PRICING_PER_1M = 0.02; // USD

// ── Cost calculator ───────────────────────────────────────────────────────────
export function computeGenerationCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  routingInputTokens = 0,
  routingOutputTokens = 0
): number {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING["claude-sonnet-4-5"];
  const generationCost =
    (inputTokens / 1_000_000) * pricing.inputPer1M +
    (outputTokens / 1_000_000) * pricing.outputPer1M;

  const routingPricing = MODEL_PRICING["claude-haiku-4-5"];
  const routingCost =
    (routingInputTokens / 1_000_000) * routingPricing.inputPer1M +
    (routingOutputTokens / 1_000_000) * routingPricing.outputPer1M;

  return generationCost + routingCost;
}

export function computeEmbeddingCost(tokenCount: number): number {
  return (tokenCount / 1_000_000) * VOYAGE_PRICING_PER_1M;
}

// Total cost in USD, rounded to 6 decimal places
export function roundCost(usd: number): number {
  return Math.round(usd * 1_000_000) / 1_000_000;
}

// Human-readable cost string
export function formatCost(usd: number): string {
  if (usd < 0.001) return `$${(usd * 1000).toFixed(4)}m`; // millidollars
  if (usd < 1) return `$${(usd * 100).toFixed(3)}¢`;      // cents
  return `$${usd.toFixed(4)}`;
}

// ── Cost event model ──────────────────────────────────────────────────────────
// Written per-request for full granularity.

export type CostEventSource =
  | "chat_generation"
  | "chat_routing"
  | "pipeline_step"
  | "knowledge_embedding"
  | "knowledge_retrieval";   // estimated: $0 for now (compute only)

export interface CostEvent {
  id: string;
  source: CostEventSource;
  agentId: string;
  agentRole: AgentRole | null;
  model: string;
  // Tokens
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  // Costs (USD)
  inputCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;
  // Context
  workflowRunId: string | null;
  pipelineRunId: string | null;
  definitionId: string | null;
  stepId: string | null;
  conversationId: string | null;
  ingestJobId: string | null;
  // Date dimension for aggregation
  dateKey: string;       // YYYY-MM-DD
  monthKey: string;      // YYYY-MM
  weekKey: string;       // YYYY-W## (ISO week)
  createdAt: string;
}

// Factory
export function createCostEvent(
  source: CostEventSource,
  agentId: string,
  agentRole: AgentRole | null,
  model: string,
  inputTokens: number,
  outputTokens: number,
  context: {
    workflowRunId?: string;
    pipelineRunId?: string;
    definitionId?: string;
    stepId?: string;
    conversationId?: string;
    ingestJobId?: string;
  } = {}
): Omit<CostEvent, "id"> {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING["claude-sonnet-4-5"];
  const inputCostUsd = roundCost((inputTokens / 1_000_000) * pricing.inputPer1M);
  const outputCostUsd = roundCost((outputTokens / 1_000_000) * pricing.outputPer1M);

  const now = new Date();
  const dateKey = now.toISOString().slice(0, 10);
  const monthKey = now.toISOString().slice(0, 7);
  const weekKey = `${now.getFullYear()}-W${getISOWeek(now).toString().padStart(2, "0")}`;

  return {
    source,
    agentId,
    agentRole,
    model,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    inputCostUsd,
    outputCostUsd,
    totalCostUsd: roundCost(inputCostUsd + outputCostUsd),
    workflowRunId: context.workflowRunId ?? null,
    pipelineRunId: context.pipelineRunId ?? null,
    definitionId: context.definitionId ?? null,
    stepId: context.stepId ?? null,
    conversationId: context.conversationId ?? null,
    ingestJobId: context.ingestJobId ?? null,
    dateKey,
    monthKey,
    weekKey,
    createdAt: now.toISOString(),
  };
}

// ISO week number
function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Fire-and-forget cost event writer
export function writeCostEvent(
  db: FirebaseFirestore.Firestore,
  data: Omit<CostEvent, "id">
): void {
  db.collection("costEvents")
    .doc()
    .set(data)
    .catch((err) => console.error("[cost] write failed:", err));
}

// ── Cost report ───────────────────────────────────────────────────────────────
export interface CostReport {
  // Totals
  totalCostUsd: number;
  totalTokens: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  // Breakdowns
  bySource: Record<CostEventSource, { costUsd: number; tokens: number; requests: number }>;
  byModel: Record<string, { costUsd: number; tokens: number; requests: number }>;
  byAgent: Array<{
    agentId: string;
    agentRole: AgentRole | null;
    costUsd: number;
    tokens: number;
    requests: number;
    avgCostPerRequest: number;
  }>;
  // Top workflows
  topWorkflows: Array<{
    definitionId: string;
    costUsd: number;
    runs: number;
    avgCostPerRun: number;
  }>;
  // Time series
  daily: Array<{
    dateKey: string;
    costUsd: number;
    tokens: number;
    requests: number;
  }>;
  // Projections
  projectedMonthlyUsd: number;   // extrapolated from daily average
  // Budget
  budgetLimitUsd: number | null;
  budgetRemainingUsd: number | null;
  budgetPct: number | null;
  computedAt: string;
}

export async function computeCostReport(
  db: FirebaseFirestore.Firestore,
  options: {
    since?: string;          // ISO date — default: 30 days ago
    budgetLimitUsd?: number;
  } = {}
): Promise<CostReport> {
  const since = options.since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const snap = await db
    .collection("costEvents")
    .where("createdAt", ">=", since)
    .orderBy("createdAt", "desc")
    .limit(5000)
    .get();

  const events = snap.docs.map((d) => d.data() as CostEvent);

  let totalCostUsd = 0;
  let totalTokens = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  const bySource: Record<string, { costUsd: number; tokens: number; requests: number }> = {};
  const byModel: Record<string, { costUsd: number; tokens: number; requests: number }> = {};
  const byAgent: Record<string, { agentId: string; agentRole: AgentRole | null; costUsd: number; tokens: number; requests: number }> = {};
  const byWorkflow: Record<string, { costUsd: number; runs: Set<string> }> = {};
  const byDay: Record<string, { costUsd: number; tokens: number; requests: number }> = {};

  for (const e of events) {
    totalCostUsd += e.totalCostUsd;
    totalTokens += e.totalTokens;
    totalInputTokens += e.inputTokens;
    totalOutputTokens += e.outputTokens;

    // By source
    if (!bySource[e.source]) bySource[e.source] = { costUsd: 0, tokens: 0, requests: 0 };
    bySource[e.source].costUsd += e.totalCostUsd;
    bySource[e.source].tokens += e.totalTokens;
    bySource[e.source].requests++;

    // By model
    if (!byModel[e.model]) byModel[e.model] = { costUsd: 0, tokens: 0, requests: 0 };
    byModel[e.model].costUsd += e.totalCostUsd;
    byModel[e.model].tokens += e.totalTokens;
    byModel[e.model].requests++;

    // By agent
    if (e.agentId) {
      if (!byAgent[e.agentId]) {
        byAgent[e.agentId] = { agentId: e.agentId, agentRole: e.agentRole, costUsd: 0, tokens: 0, requests: 0 };
      }
      byAgent[e.agentId].costUsd += e.totalCostUsd;
      byAgent[e.agentId].tokens += e.totalTokens;
      byAgent[e.agentId].requests++;
    }

    // By workflow
    if (e.definitionId) {
      if (!byWorkflow[e.definitionId]) byWorkflow[e.definitionId] = { costUsd: 0, runs: new Set() };
      byWorkflow[e.definitionId].costUsd += e.totalCostUsd;
      if (e.pipelineRunId) byWorkflow[e.definitionId].runs.add(e.pipelineRunId);
    }

    // By day
    if (!byDay[e.dateKey]) byDay[e.dateKey] = { costUsd: 0, tokens: 0, requests: 0 };
    byDay[e.dateKey].costUsd += e.totalCostUsd;
    byDay[e.dateKey].tokens += e.totalTokens;
    byDay[e.dateKey].requests++;
  }

  // Round all costs
  for (const k of Object.keys(bySource)) bySource[k].costUsd = roundCost(bySource[k].costUsd);
  for (const k of Object.keys(byModel)) byModel[k].costUsd = roundCost(byModel[k].costUsd);
  for (const k of Object.keys(byDay)) byDay[k].costUsd = roundCost(byDay[k].costUsd);

  // Top 10 most expensive agents
  const topAgents = Object.values(byAgent)
    .sort((a, b) => b.costUsd - a.costUsd)
    .slice(0, 10)
    .map((a) => ({
      ...a,
      costUsd: roundCost(a.costUsd),
      avgCostPerRequest: a.requests > 0 ? roundCost(a.costUsd / a.requests) : 0,
    }));

  // Top 10 workflows by cost
  const topWorkflows = Object.entries(byWorkflow)
    .map(([definitionId, { costUsd, runs }]) => ({
      definitionId,
      costUsd: roundCost(costUsd),
      runs: runs.size,
      avgCostPerRun: runs.size > 0 ? roundCost(costUsd / runs.size) : 0,
    }))
    .sort((a, b) => b.costUsd - a.costUsd)
    .slice(0, 10);

  // Build daily time series (last 30 days)
  const daily = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const dateKey = d.toISOString().slice(0, 10);
    daily.push({ dateKey, ...(byDay[dateKey] ?? { costUsd: 0, tokens: 0, requests: 0 }) });
  }

  // 30-day projection from last 7 days average
  const last7DaysCost = daily.slice(-7).reduce((s, d) => s + d.costUsd, 0);
  const dailyAvg = last7DaysCost / 7;
  const projectedMonthlyUsd = roundCost(dailyAvg * 30);

  const budgetLimitUsd = options.budgetLimitUsd ?? null;
  const budgetRemainingUsd = budgetLimitUsd !== null
    ? roundCost(Math.max(0, budgetLimitUsd - totalCostUsd))
    : null;
  const budgetPct = budgetLimitUsd
    ? Math.round((totalCostUsd / budgetLimitUsd) * 100)
    : null;

  return {
    totalCostUsd: roundCost(totalCostUsd),
    totalTokens,
    totalInputTokens,
    totalOutputTokens,
    bySource: bySource as Record<CostEventSource, { costUsd: number; tokens: number; requests: number }>,
    byModel,
    byAgent: topAgents,
    topWorkflows,
    daily,
    projectedMonthlyUsd,
    budgetLimitUsd,
    budgetRemainingUsd,
    budgetPct,
    computedAt: new Date().toISOString(),
  };
}

// ── Budget enforcement ────────────────────────────────────────────────────────
// Returns true if current period spend is within budget.
export async function checkBudget(
  db: FirebaseFirestore.Firestore,
  limitUsd: number
): Promise<{ withinBudget: boolean; spentUsd: number; remainingUsd: number }> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const snap = await db
    .collection("costEvents")
    .where("createdAt", ">=", monthStart.toISOString())
    .get();

  const spentUsd = roundCost(
    snap.docs.reduce((sum, d) => sum + ((d.data().totalCostUsd as number) ?? 0), 0)
  );
  const remainingUsd = roundCost(Math.max(0, limitUsd - spentUsd));

  return {
    withinBudget: spentUsd < limitUsd,
    spentUsd,
    remainingUsd,
  };
}
