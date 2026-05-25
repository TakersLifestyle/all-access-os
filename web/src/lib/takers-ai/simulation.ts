// Takers AI — Simulation & Dry-Run Engine
//
// Estimates cost, token usage, and runtime for pipeline execution
// WITHOUT making any Claude API calls or writing any data.
//
// Use before executing a pipeline to:
//   - Preview what would happen at each step
//   - Estimate total token usage and cost
//   - Detect risky or irreversible actions (external calls, data mutations)
//   - Identify potential bottlenecks
//   - Check budget constraints
//   - Get a go/no-go recommendation
//
// All estimates are deterministic heuristics — fast, free, no side effects.

import type { AgentRole } from "./types";
import type { WorkflowDefinition, WorkflowStepDefinition } from "./types";
import { MODEL_PRICING, roundCost } from "./cost";
import { RATE_LIMITS } from "./rate-limiter";

// ── Types ─────────────────────────────────────────────────────────────────────

export type RiskFlagType =
  | "irreversible_action"   // tool call that can't be undone
  | "high_cost"             // step will be expensive
  | "external_api_call"     // calls an external service
  | "data_mutation"         // modifies data in a system
  | "rate_limit_risk"       // might hit rate limits
  | "budget_exceeded"       // exceeds configured budget
  | "long_running"          // estimated duration is high
  | "unapproved_high_risk"  // high-risk step without approval gate
  | "missing_dependency"    // references an output key that isn't produced
  | "circular_dependency";  // steps depend on each other circularly

export type RiskSeverity = "info" | "low" | "medium" | "high" | "critical";

export interface RiskFlag {
  type: RiskFlagType;
  severity: RiskSeverity;
  stepIndex: number | null;  // null = pipeline-level
  stepName: string | null;
  description: string;
  recommendation: string;
}

export interface SimulatedToolCall {
  tool: string;
  stepIndex: number;
  stepName: string;
  inputs: Record<string, string>;  // template-substituted preview
  requiresApproval: boolean;
  isIrreversible: boolean;
  estimatedLatencyMs: number;
}

export interface SimulationStep {
  stepIndex: number;
  stepId: string;
  stepName: string;
  agentRole: AgentRole;
  model: string;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedTotalTokens: number;
  estimatedCostUsd: number;
  estimatedDurationMs: number;
  requiresApproval: boolean;
  toolInvocations: SimulatedToolCall[];
  riskFlags: RiskFlag[];
  promptPreview: string;         // first 300 chars of interpolated prompt
  canRunInParallel: boolean;     // true if no dependencies on prior steps
}

export interface SimulationResult {
  simulationId: string;
  definitionId: string | null;
  definitionName: string | null;
  objective: string | null;
  variables: Record<string, string>;
  steps: SimulationStep[];
  // Totals
  totalEstimatedInputTokens: number;
  totalEstimatedOutputTokens: number;
  totalEstimatedTokens: number;
  totalEstimatedCostUsd: number;
  totalEstimatedDurationMs: number;     // critical path (parallel-aware)
  totalEstimatedWallTimeMs: number;     // sequential worst-case
  totalToolInvocations: number;
  approvalGatesCount: number;
  // Risk
  riskFlags: RiskFlag[];
  overallRiskLevel: "safe" | "caution" | "risky" | "blocked";
  // Budget
  budgetStatus: "within_budget" | "near_limit" | "over_budget" | null;
  budgetLimitUsd: number | null;
  // Recommendation
  recommendation: "proceed" | "review_required" | "blocked";
  blockedReasons: string[];
  cautionReasons: string[];
  // Meta
  simulatedAt: string;
}

// ── Model selection heuristic ─────────────────────────────────────────────────
// Maps agent roles to their typical model usage
const ROLE_MODEL_MAP: Record<string, string> = {
  content:    "claude-sonnet-4-5",
  marketing:  "claude-sonnet-4-5",
  events:     "claude-sonnet-4-5",
  support:    "claude-haiku-4-5",
  strategy:   "claude-opus-4-5",
  developer:  "claude-sonnet-4-5",
  operations: "claude-haiku-4-5",
  operator:   "claude-haiku-4-5",
};

// ── Token estimation heuristics ───────────────────────────────────────────────
// Based on empirical averages across agent types and typical workloads
const ROLE_INPUT_ESTIMATE: Record<string, number> = {
  content:    2200,   // system + instructions + memory blocks + user prompt
  marketing:  2400,
  events:     2100,
  support:    1500,
  strategy:   3000,   // strategy gets heavy context
  developer:  2800,
  operations: 1800,
  operator:   1400,
};

const ROLE_OUTPUT_ESTIMATE: Record<string, number> = {
  content:    900,
  marketing:  800,
  events:     700,
  support:    500,
  strategy:  1400,
  developer: 1200,
  operations: 600,
  operator:   400,
};

const BASE_LATENCY_MS = 600;
const TOKENS_PER_SECOND = 55;

// ── Irreversible tool detection ───────────────────────────────────────────────
const IRREVERSIBLE_TOOLS = new Set([
  "gmail_draft",     // creates draft (can still be deleted, but external action)
  "discord_draft",   // posts to discord
]);

const EXTERNAL_TOOLS = new Set([
  "gmail_draft", "calendar_suggest", "discord_draft", "stripe_lookup",
]);

const DATA_MUTATION_TOOLS = new Set([
  "gmail_draft", "calendar_suggest", "discord_draft",
]);

const TOOL_LATENCY_MS: Record<string, number> = {
  gmail_draft: 1500,
  calendar_suggest: 800,
  stripe_lookup: 600,
  drive_retrieve: 700,
  discord_draft: 1200,
};

// ── Tool request detector ─────────────────────────────────────────────────────
// Scans prompt templates for __tool__ JSON blocks to preview tool calls
function detectToolRequestsInPrompt(
  promptTemplate: string,
  variables: Record<string, string>,
  stepIndex: number,
  stepName: string
): SimulatedToolCall[] {
  const toolPattern = /\{\s*"__tool__"\s*:\s*"([^"]+)"[^}]*\}/g;
  const results: SimulatedToolCall[] = [];
  let match;

  while ((match = toolPattern.exec(promptTemplate)) !== null) {
    const toolName = match[1];
    try {
      const parsed = JSON.parse(match[0]);
      const inputs: Record<string, string> = {};
      if (parsed.inputs) {
        for (const [k, v] of Object.entries(parsed.inputs)) {
          const val = String(v).replace(/\{\{([^}]+)\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`);
          inputs[k] = val.slice(0, 100);
        }
      }
      results.push({
        tool: toolName,
        stepIndex,
        stepName,
        inputs,
        requiresApproval: true, // all tool calls require approval
        isIrreversible: IRREVERSIBLE_TOOLS.has(toolName),
        estimatedLatencyMs: TOOL_LATENCY_MS[toolName] ?? 1000,
      });
    } catch {
      results.push({
        tool: toolName,
        stepIndex,
        stepName,
        inputs: {},
        requiresApproval: true,
        isIrreversible: IRREVERSIBLE_TOOLS.has(toolName),
        estimatedLatencyMs: TOOL_LATENCY_MS[toolName] ?? 1000,
      });
    }
  }

  return results;
}

// ── Interpolation preview ─────────────────────────────────────────────────────
// Fills in known variables, leaves unresolved ones with {{key}} visible
function interpolatePreview(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    return variables[key] ?? `{{${key}}}`;
  });
}

// ── Dependency graph validation ───────────────────────────────────────────────
function validateDependencies(
  steps: WorkflowStepDefinition[]
): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const producedKeys = new Set<string>();
  const stepOrder = [...steps].sort((a, b) => a.order - b.order);

  for (const step of stepOrder) {
    // Each step produces its outputKey
    producedKeys.add(step.outputKey);
  }

  // Check for missing dependencies (template references outputKeys not in any step)
  for (const step of stepOrder) {
    const refs = (step.promptTemplate.match(/\{\{([^}]+)\}\}/g) ?? [])
      .map((m) => m.replace(/[{}]/g, ""));

    for (const ref of refs) {
      // Skip known variable placeholders (non-step outputs)
      if (!producedKeys.has(ref) && !ref.startsWith("input") && ref !== "userMessage") {
        // Could be a user-provided variable — flag as info only
        flags.push({
          type: "missing_dependency",
          severity: "info",
          stepIndex: step.order,
          stepName: step.name,
          description: `Template references "{{${ref}}}" which is not produced by any step — ensure it's in variables`,
          recommendation: `Provide {{${ref}}} as a pipeline variable, or ensure a prior step produces it`,
        });
      }
    }
  }

  // Circular dependency detection (simple: outputKey === dependsOn ref in same step)
  for (const step of stepOrder) {
    if (step.promptTemplate.includes(`{{${step.outputKey}}}`)) {
      flags.push({
        type: "circular_dependency",
        severity: "high",
        stepIndex: step.order,
        stepName: step.name,
        description: `Step "${step.name}" references its own output key "{{${step.outputKey}}}" in its prompt`,
        recommendation: "Remove the self-reference from this step's prompt template",
      });
    }
  }

  return flags;
}

// ── Budget check ──────────────────────────────────────────────────────────────
function checkBudget(
  totalCost: number,
  budgetLimitUsd?: number
): { status: SimulationResult["budgetStatus"]; flag: RiskFlag | null } {
  if (!budgetLimitUsd) return { status: null, flag: null };

  if (totalCost > budgetLimitUsd) {
    return {
      status: "over_budget",
      flag: {
        type: "budget_exceeded",
        severity: "critical",
        stepIndex: null,
        stepName: null,
        description: `Estimated cost $${totalCost.toFixed(4)} exceeds budget $${budgetLimitUsd.toFixed(4)}`,
        recommendation: "Reduce pipeline steps or switch to a cheaper model for non-critical steps",
      },
    };
  }

  if (totalCost > budgetLimitUsd * 0.8) {
    return {
      status: "near_limit",
      flag: {
        type: "budget_exceeded",
        severity: "medium",
        stepIndex: null,
        stepName: null,
        description: `Estimated cost $${totalCost.toFixed(4)} is within 20% of budget $${budgetLimitUsd.toFixed(4)}`,
        recommendation: "Monitor closely — consider reducing steps if costs are higher than estimated",
      },
    };
  }

  return { status: "within_budget", flag: null };
}

// ── Rate limit estimation ─────────────────────────────────────────────────────
function checkRateLimitRisk(stepCount: number): RiskFlag | null {
  const limit = RATE_LIMITS["pipeline-runs"].perMinute;
  if (stepCount > limit) {
    return {
      type: "rate_limit_risk",
      severity: "medium",
      stepIndex: null,
      stepName: null,
      description: `Pipeline has ${stepCount} steps but pipeline-run limit is ${limit}/min`,
      recommendation: "Consider breaking this into multiple smaller pipelines or increasing rate limits",
    };
  }
  return null;
}

// ── Critical path calculator ──────────────────────────────────────────────────
function computeCriticalPath(
  steps: SimulationStep[]
): number {
  const completionTimes: Record<string, number> = {};
  let wallTime = 0;

  for (const step of steps) {
    const step_def = step;
    // Approximate dependency: steps that can run in parallel have no unresolved deps
    const depTime = step_def.canRunInParallel ? 0 : (completionTimes[Object.keys(completionTimes).pop() ?? ""] ?? 0);
    const totalStepTime = step_def.estimatedDurationMs +
      step_def.toolInvocations.reduce((s, t) => s + t.estimatedLatencyMs, 0);
    const endTime = depTime + totalStepTime;
    completionTimes[`step_${step_def.stepIndex}`] = endTime;
    wallTime = Math.max(wallTime, endTime);
  }

  return wallTime;
}

// ── Main simulation function ──────────────────────────────────────────────────
export async function simulatePipeline(
  db: FirebaseFirestore.Firestore,
  definitionId: string,
  variables: Record<string, string> = {},
  options: {
    budgetLimitUsd?: number;
    checkCurrentBudget?: boolean;
  } = {}
): Promise<SimulationResult> {
  const defDoc = await db.collection("workflowDefinitions").doc(definitionId).get();
  if (!defDoc.exists) throw new Error(`Workflow definition not found: ${definitionId}`);

  const definition = { id: defDoc.id, ...defDoc.data() } as WorkflowDefinition;
  const sortedSteps = [...definition.steps].sort((a, b) => a.order - b.order);

  return simulateSteps(sortedSteps, variables, {
    definitionId,
    definitionName: definition.name,
    ...options,
  });
}

export function simulateSteps(
  steps: WorkflowStepDefinition[],
  variables: Record<string, string> = {},
  options: {
    definitionId?: string;
    definitionName?: string;
    objective?: string;
    budgetLimitUsd?: number;
  } = {}
): SimulationResult {
  const simulatedAt = new Date().toISOString();
  const allRiskFlags: RiskFlag[] = [];

  // Validate dependency graph first
  const depFlags = validateDependencies(steps);
  allRiskFlags.push(...depFlags);

  // Simulate each step
  const simulatedSteps: SimulationStep[] = steps.map((step, i) => {
    const model = ROLE_MODEL_MAP[step.agentRole] ?? "claude-sonnet-4-5";
    const pricing = MODEL_PRICING[model] ?? MODEL_PRICING["claude-sonnet-4-5"];

    const baseInput = ROLE_INPUT_ESTIMATE[step.agentRole] ?? 2000;
    const promptLength = step.promptTemplate.length;
    const estimatedInputTokens = baseInput + Math.ceil(promptLength / 4);
    const estimatedOutputTokens = ROLE_OUTPUT_ESTIMATE[step.agentRole] ?? 600;
    const estimatedCostUsd = roundCost(
      (estimatedInputTokens / 1_000_000) * pricing.inputPer1M +
      (estimatedOutputTokens / 1_000_000) * pricing.outputPer1M
    );
    const estimatedDurationMs = BASE_LATENCY_MS +
      Math.ceil((estimatedOutputTokens / TOKENS_PER_SECOND) * 1000);

    // Check for tool invocations in the prompt
    const toolInvocations = detectToolRequestsInPrompt(
      step.promptTemplate, variables, i, step.name
    );

    const stepRiskFlags: RiskFlag[] = [];

    // Flag high-cost steps (> $0.05)
    if (estimatedCostUsd > 0.05) {
      stepRiskFlags.push({
        type: "high_cost",
        severity: "medium",
        stepIndex: i,
        stepName: step.name,
        description: `Step estimated at $${estimatedCostUsd.toFixed(4)}`,
        recommendation: "Consider using claude-haiku for this step if quality allows",
      });
    }

    // Flag irreversible tool calls
    for (const tool of toolInvocations) {
      if (tool.isIrreversible && !step.requiresApproval) {
        stepRiskFlags.push({
          type: "irreversible_action",
          severity: "high",
          stepIndex: i,
          stepName: step.name,
          description: `Tool "${tool.tool}" is irreversible but step has no approval gate`,
          recommendation: `Set requiresApproval: true on step "${step.name}"`,
        });
      }
      if (EXTERNAL_TOOLS.has(tool.tool)) {
        stepRiskFlags.push({
          type: "external_api_call",
          severity: "low",
          stepIndex: i,
          stepName: step.name,
          description: `Step will call external tool: ${tool.tool}`,
          recommendation: "Ensure credentials are configured and review output before approval",
        });
      }
      if (DATA_MUTATION_TOOLS.has(tool.tool)) {
        stepRiskFlags.push({
          type: "data_mutation",
          severity: "medium",
          stepIndex: i,
          stepName: step.name,
          description: `Tool "${tool.tool}" will create or modify external data`,
          recommendation: "Verify this action is intentional and the approval gate is in place",
        });
      }
    }

    // Flag long-running steps (> 60s estimated)
    if (estimatedDurationMs > 60_000) {
      stepRiskFlags.push({
        type: "long_running",
        severity: "low",
        stepIndex: i,
        stepName: step.name,
        description: `Step estimated to take ${Math.round(estimatedDurationMs / 1000)}s`,
        recommendation: "Consider reducing max_tokens or splitting this step",
      });
    }

    allRiskFlags.push(...stepRiskFlags);

    // Detect if step can run in parallel (no deps on immediately prior step)
    const priorOutputKeys = steps.slice(0, i).map((s) => s.outputKey);
    const referencedKeys = (step.promptTemplate.match(/\{\{([^}]+)\}\}/g) ?? [])
      .map((m) => m.replace(/[{}]/g, ""))
      .filter((k) => priorOutputKeys.includes(k));
    const canRunInParallel = referencedKeys.length === 0 && i > 0;

    const promptPreview = interpolatePreview(step.promptTemplate, variables).slice(0, 300);

    return {
      stepIndex: i,
      stepId: step.id,
      stepName: step.name,
      agentRole: step.agentRole as AgentRole,
      model,
      estimatedInputTokens,
      estimatedOutputTokens,
      estimatedTotalTokens: estimatedInputTokens + estimatedOutputTokens,
      estimatedCostUsd,
      estimatedDurationMs,
      requiresApproval: step.requiresApproval,
      toolInvocations,
      riskFlags: stepRiskFlags,
      promptPreview,
      canRunInParallel,
    };
  });

  // Pipeline totals
  const totalInput = simulatedSteps.reduce((s, p) => s + p.estimatedInputTokens, 0);
  const totalOutput = simulatedSteps.reduce((s, p) => s + p.estimatedOutputTokens, 0);
  const totalCost = roundCost(simulatedSteps.reduce((s, p) => s + p.estimatedCostUsd, 0));
  const totalWallTime = simulatedSteps.reduce(
    (s, p) => s + p.estimatedDurationMs + p.toolInvocations.reduce((a, t) => a + t.estimatedLatencyMs, 0), 0
  );
  const criticalPathTime = computeCriticalPath(simulatedSteps);
  const totalToolInvocations = simulatedSteps.reduce((s, p) => s + p.toolInvocations.length, 0);
  const approvalGatesCount = simulatedSteps.filter((s) => s.requiresApproval).length;

  // Rate limit check
  const rateLimitFlag = checkRateLimitRisk(steps.length);
  if (rateLimitFlag) allRiskFlags.push(rateLimitFlag);

  // Budget check
  const { status: budgetStatus, flag: budgetFlag } = checkBudget(totalCost, options.budgetLimitUsd);
  if (budgetFlag) allRiskFlags.push(budgetFlag);

  // Overall risk level
  const criticalFlags = allRiskFlags.filter((f) => f.severity === "critical");
  const highFlags = allRiskFlags.filter((f) => f.severity === "high");
  const mediumFlags = allRiskFlags.filter((f) => f.severity === "medium");

  const overallRiskLevel: SimulationResult["overallRiskLevel"] =
    criticalFlags.length > 0 ? "blocked"
    : highFlags.length > 0 ? "risky"
    : mediumFlags.length > 0 ? "caution"
    : "safe";

  const recommendation: SimulationResult["recommendation"] =
    overallRiskLevel === "blocked" ? "blocked"
    : overallRiskLevel === "risky" ? "review_required"
    : "proceed";

  const blockedReasons = criticalFlags.map((f) => f.description);
  const cautionReasons = [...highFlags, ...mediumFlags].slice(0, 3).map((f) => f.description);

  return {
    simulationId: `sim_${Date.now()}`,
    definitionId: options.definitionId ?? null,
    definitionName: options.definitionName ?? null,
    objective: options.objective ?? null,
    variables,
    steps: simulatedSteps,
    totalEstimatedInputTokens: totalInput,
    totalEstimatedOutputTokens: totalOutput,
    totalEstimatedTokens: totalInput + totalOutput,
    totalEstimatedCostUsd: totalCost,
    totalEstimatedDurationMs: criticalPathTime,
    totalEstimatedWallTimeMs: totalWallTime,
    totalToolInvocations,
    approvalGatesCount,
    riskFlags: allRiskFlags,
    overallRiskLevel,
    budgetStatus,
    budgetLimitUsd: options.budgetLimitUsd ?? null,
    recommendation,
    blockedReasons,
    cautionReasons,
    simulatedAt,
  };
}

// ── Simulate from ad-hoc steps (no saved definition) ─────────────────────────
export function simulateAdHocSteps(
  steps: Array<{
    name: string;
    agentRole: AgentRole;
    promptTemplate: string;
    outputKey: string;
    requiresApproval: boolean;
  }>,
  variables: Record<string, string> = {},
  options?: { objective?: string; budgetLimitUsd?: number }
): SimulationResult {
  const stepsWithOrder: WorkflowStepDefinition[] = steps.map((s, i) => ({
    id: `adhoc_${i}`,
    order: i,
    name: s.name,
    description: s.name,
    agentRole: s.agentRole as AgentRole,
    promptTemplate: s.promptTemplate,
    outputKey: s.outputKey,
    requiresApproval: s.requiresApproval,
    approvalType: "workflow_step" as const,
  }));

  return simulateSteps(stepsWithOrder, variables, options);
}

// ── Cost comparison helper ─────────────────────────────────────────────────────
// Given a simulation, shows how much cheaper each step could be with haiku
export function computeModelDowngradeOptions(result: SimulationResult): Array<{
  stepName: string;
  currentModel: string;
  currentCostUsd: number;
  haikuCostUsd: number;
  savingsUsd: number;
  savingsPct: number;
  qualityTradeoff: "minimal" | "moderate" | "significant";
}> {
  const haikuPricing = MODEL_PRICING["claude-haiku-4-5"];

  return result.steps
    .filter((s) => s.model !== "claude-haiku-4-5")
    .map((s) => {
      const haikuCost = roundCost(
        (s.estimatedInputTokens / 1_000_000) * haikuPricing.inputPer1M +
        (s.estimatedOutputTokens / 1_000_000) * haikuPricing.outputPer1M
      );
      const savings = roundCost(s.estimatedCostUsd - haikuCost);
      const savingsPct = Math.round((savings / s.estimatedCostUsd) * 100);
      const qualityTradeoff: "minimal" | "moderate" | "significant" =
        s.agentRole === "strategy" || s.agentRole === "developer" ? "significant"
        : s.agentRole === "content" || s.agentRole === "marketing" ? "moderate"
        : "minimal";
      return {
        stepName: s.stepName,
        currentModel: s.model,
        currentCostUsd: s.estimatedCostUsd,
        haikuCostUsd: haikuCost,
        savingsUsd: savings,
        savingsPct,
        qualityTradeoff,
      };
    })
    .sort((a, b) => b.savingsUsd - a.savingsUsd);
}
