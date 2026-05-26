// Takers AI — Strategic Planning Engine
//
// Decomposes high-level objectives into structured multi-step execution plans.
// Produces up to 3 plan variants (fast / balanced / thorough) with:
//   - Agent role mapping per step
//   - Dependency graph (outputKey references)
//   - Token, cost, and runtime estimates
//   - Risk classification per step
//   - Confidence + efficiency scoring
//   - Ranked final recommendation
//
// The planner calls Claude (sonnet) to generate the plan structure,
// then applies deterministic cost/time estimation on top.

import Anthropic from "@anthropic-ai/sdk";
import type { AgentRole } from "./types";
import { MODEL_PRICING, roundCost } from "./cost";
import type { AttachmentMeta } from "./attachments";
import { buildPlannerAttachmentContext } from "./multimodal";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Types ─────────────────────────────────────────────────────────────────────

export type PlanStrategy = "fast" | "balanced" | "thorough";
export type StepRiskLevel = "low" | "medium" | "high";

export interface PlanStep {
  id: string;
  order: number;
  name: string;
  description: string;
  agentRole: AgentRole;
  promptTemplate: string;       // interpolatable prompt for this step
  outputKey: string;            // key used in subsequent step templates
  dependsOn: string[];          // outputKeys from prior steps this step uses
  requiresApproval: boolean;
  riskLevel: StepRiskLevel;
  rationale: string;
  // Estimates (computed deterministically after parsing)
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostUsd: number;
  estimatedDurationMs: number;
}

export interface ExecutionPlan {
  id: string;
  objective: string;
  strategy: PlanStrategy;
  steps: PlanStep[];
  // Totals
  totalEstimatedCostUsd: number;
  totalEstimatedTokens: number;
  totalEstimatedDurationMs: number;
  // Quality signals
  confidence: number;       // 0-100: how well this plan fits the objective
  efficiencyScore: number;  // 0-100: cost/quality tradeoff
  rationale: string;
  alternativesNoted: string[];
  warnings: string[];
  // Meta
  plannerModel: string;
  plannerInputTokens: number;
  plannerOutputTokens: number;
  createdAt: string;
}

export interface PlanRequest {
  objective: string;
  context?: string;           // additional context about the project / situation
  existingOutputs?: Record<string, string>;  // already available outputs that can be used
  attachments?: AttachmentMeta[];  // files attached to this planning request
  constraints?: {
    maxCostUsd?: number;
    maxDurationMs?: number;
    preferredAgents?: AgentRole[];
    forbiddenAgents?: AgentRole[];
    maxSteps?: number;
    mustIncludeApproval?: boolean;
  };
  strategies?: PlanStrategy[];  // which variants to generate, default: all three
}

export interface PlanResponse {
  plans: ExecutionPlan[];
  recommended: string;          // id of recommended plan
  summary: string;
  plannerCostUsd: number;       // cost of the planning call itself
  createdAt: string;
}

// ── Token + duration heuristics per agent role ────────────────────────────────
// Estimates typical output token count by agent role.
// Based on empirical averages across agent types.

const ROLE_OUTPUT_ESTIMATES: Record<string, number> = {
  content:    900,
  marketing:  800,
  events:     700,
  support:    500,
  strategy:  1400,
  developer: 1200,
  operations: 600,
  operator:   400,
};

const ROLE_SYSTEM_PROMPT_ESTIMATE = 1200; // avg system prompt tokens per role
const BASE_LATENCY_MS = 800;              // network + cold start
const TOKENS_PER_SECOND = 60;            // approx Claude streaming speed

function estimateStepTokens(step: { agentRole: AgentRole; promptTemplate: string }): {
  inputTokens: number;
  outputTokens: number;
} {
  const inputTokens = ROLE_SYSTEM_PROMPT_ESTIMATE + Math.ceil(step.promptTemplate.length / 4);
  const outputTokens = ROLE_OUTPUT_ESTIMATES[step.agentRole] ?? 600;
  return { inputTokens, outputTokens };
}

function estimateStepCost(agentRole: AgentRole, inputTokens: number, outputTokens: number): number {
  const model = "claude-sonnet-4-5";
  const pricing = MODEL_PRICING[model];
  return roundCost(
    (inputTokens / 1_000_000) * pricing.inputPer1M +
    (outputTokens / 1_000_000) * pricing.outputPer1M
  );
}

function estimateStepDurationMs(outputTokens: number): number {
  return BASE_LATENCY_MS + Math.ceil((outputTokens / TOKENS_PER_SECOND) * 1000);
}

function scoreEfficiency(plan: Omit<ExecutionPlan, "efficiencyScore">): number {
  // Efficiency = quality per dollar. More steps = more coverage but higher cost.
  // Fast plans score high on efficiency; thorough plans score lower but cover more.
  const costPenalty = Math.min(50, plan.totalEstimatedCostUsd * 1000);   // $0.05 → 50pt penalty
  const stepBonus = Math.min(30, plan.steps.length * 5);                  // more steps = better coverage
  const base = plan.strategy === "fast" ? 80 : plan.strategy === "balanced" ? 70 : 55;
  return Math.max(10, Math.min(100, Math.round(base + stepBonus - costPenalty)));
}

// ── Planning prompt ───────────────────────────────────────────────────────────
const PLANNER_SYSTEM = `You are a strategic planning AI for TakersLifestyle and ALL ACCESS Winnipeg.

Your job is to decompose a high-level objective into a structured multi-step execution plan.

AVAILABLE AGENT ROLES:
- content: Instagram captions, TikTok hooks, YouTube scripts, email copy, creative writing
- marketing: ad campaigns, growth strategies, audience targeting, funnel design, launch plans
- events: event planning, checklists, run-of-show, logistics, pricing, capacity
- support: member FAQs, onboarding, community guidelines, complaint handling
- strategy: business strategy, SWOT, revenue planning, partnerships, competitive analysis
- developer: Next.js, Firebase, TypeScript, API design, code architecture
- operations: SOPs, weekly planning, task delegation, team coordination, reporting
- operator: general coordination, multi-topic synthesis, routing decisions

PLAN STRATEGIES:
- fast: 2-3 steps, prioritize speed, fewer agents, acceptable quality
- balanced: 4-6 steps, best tradeoff between quality and cost
- thorough: 7-10 steps, comprehensive coverage, multiple review passes

OUTPUT FORMAT (strict JSON, no markdown):
{
  "plans": [
    {
      "strategy": "fast|balanced|thorough",
      "confidence": 0-100,
      "rationale": "why this plan fits the objective",
      "alternativesNoted": ["alternative approach 1", "..."],
      "warnings": ["potential risk or limitation"],
      "steps": [
        {
          "id": "step_1",
          "order": 1,
          "name": "Short step name",
          "description": "What this step produces and why it's needed",
          "agentRole": "content|marketing|events|support|strategy|developer|operations|operator",
          "promptTemplate": "The actual prompt to send this agent. Use {{variableName}} for inputs and {{outputKey}} to reference prior outputs.",
          "outputKey": "camelCase key for this output, e.g. contentDraft, eventPlan",
          "dependsOn": ["priorOutputKey1"],
          "requiresApproval": true|false,
          "riskLevel": "low|medium|high",
          "rationale": "why this agent + this step at this position"
        }
      ]
    }
  ],
  "recommended": "fast|balanced|thorough",
  "summary": "One sentence summary of what all plans accomplish"
}

RULES:
- Each step's promptTemplate must be actionable and specific to the objective
- outputKey must be camelCase, unique within the plan, and referenced by subsequent steps via {{outputKey}}
- dependsOn must reference outputKeys from earlier steps only
- requiresApproval: true for steps that produce external-facing or irreversible outputs
- riskLevel: high for external communications, financial decisions, or data mutations
- Plans must be feasible given the available agents
- Generate all three strategies unless constraints prevent it`;

// ── Core planning function ────────────────────────────────────────────────────
export async function generatePlan(request: PlanRequest): Promise<PlanResponse> {
  const strategies = request.strategies ?? ["fast", "balanced", "thorough"];

  const userPrompt = buildPlannerPrompt(request, strategies);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4096,
    system: PLANNER_SYSTEM,
    messages: [{ role: "user", content: userPrompt }],
  });

  const plannerInputTokens = response.usage.input_tokens;
  const plannerOutputTokens = response.usage.output_tokens;
  const plannerCostUsd = roundCost(
    (plannerInputTokens / 1_000_000) * MODEL_PRICING["claude-sonnet-4-5"].inputPer1M +
    (plannerOutputTokens / 1_000_000) * MODEL_PRICING["claude-sonnet-4-5"].outputPer1M
  );

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const parsed = parsePlannerResponse(text, request.objective);

  // Apply deterministic cost + time estimates to each step
  const now = new Date().toISOString();
  const plans: ExecutionPlan[] = parsed.plans.map((rawPlan) => {
    const steps: PlanStep[] = rawPlan.steps.map((s) => {
      const { inputTokens, outputTokens } = estimateStepTokens({
        agentRole: s.agentRole as AgentRole,
        promptTemplate: s.promptTemplate,
      });
      const costUsd = estimateStepCost(s.agentRole as AgentRole, inputTokens, outputTokens);
      const durationMs = estimateStepDurationMs(outputTokens);
      return {
        ...s,
        agentRole: s.agentRole as AgentRole,
        riskLevel: (s.riskLevel as StepRiskLevel) ?? "low",
        estimatedInputTokens: inputTokens,
        estimatedOutputTokens: outputTokens,
        estimatedCostUsd: costUsd,
        estimatedDurationMs: durationMs,
      };
    });

    const totalCost = roundCost(steps.reduce((s, p) => s + p.estimatedCostUsd, 0));
    const totalTokens = steps.reduce((s, p) => s + p.estimatedInputTokens + p.estimatedOutputTokens, 0);
    // Parallel steps (no dependencies) can run concurrently — critical path time
    const totalDurationMs = computeCriticalPath(steps);

    const plan: ExecutionPlan = {
      id: `plan_${rawPlan.strategy}_${Date.now()}`,
      objective: request.objective,
      strategy: rawPlan.strategy as PlanStrategy,
      steps,
      totalEstimatedCostUsd: totalCost,
      totalEstimatedTokens: totalTokens,
      totalEstimatedDurationMs: totalDurationMs,
      confidence: rawPlan.confidence ?? 70,
      efficiencyScore: 0, // computed below
      rationale: rawPlan.rationale ?? "",
      alternativesNoted: rawPlan.alternativesNoted ?? [],
      warnings: buildPlanWarnings(steps, request.constraints),
      plannerModel: "claude-sonnet-4-5",
      plannerInputTokens,
      plannerOutputTokens,
      createdAt: now,
    };
    plan.efficiencyScore = scoreEfficiency(plan);

    // Apply constraint violation warnings
    if (request.constraints?.maxCostUsd && totalCost > request.constraints.maxCostUsd) {
      plan.warnings.push(`Estimated cost $${totalCost.toFixed(4)} exceeds budget $${request.constraints.maxCostUsd}`);
    }
    if (request.constraints?.maxDurationMs && totalDurationMs > request.constraints.maxDurationMs) {
      plan.warnings.push(`Estimated duration ${Math.round(totalDurationMs / 1000)}s exceeds limit`);
    }

    return plan;
  });

  // Rank: recommended = highest (confidence × 0.6 + efficiencyScore × 0.4)
  const ranked = [...plans].sort((a, b) => {
    const scoreA = a.confidence * 0.6 + a.efficiencyScore * 0.4;
    const scoreB = b.confidence * 0.6 + b.efficiencyScore * 0.4;
    return scoreB - scoreA;
  });

  return {
    plans,
    recommended: ranked[0]?.id ?? plans[0]?.id ?? "",
    summary: parsed.summary ?? `Execution plan for: ${request.objective}`,
    plannerCostUsd,
    createdAt: now,
  };
}

// ── Prompt builder ────────────────────────────────────────────────────────────
function buildPlannerPrompt(request: PlanRequest, strategies: PlanStrategy[]): string {
  let prompt = `OBJECTIVE: ${request.objective}\n`;

  if (request.context) {
    prompt += `\nCONTEXT:\n${request.context}\n`;
  }

  if (request.attachments && request.attachments.length > 0) {
    const attachmentCtx = buildPlannerAttachmentContext(request.attachments);
    if (attachmentCtx) {
      prompt += `\n${attachmentCtx}\n`;
    }
  }

  if (request.existingOutputs && Object.keys(request.existingOutputs).length > 0) {
    prompt += `\nALREADY AVAILABLE OUTPUTS (can reference in promptTemplates):\n`;
    for (const [key, value] of Object.entries(request.existingOutputs)) {
      prompt += `- {{${key}}}: ${value.slice(0, 200)}${value.length > 200 ? "..." : ""}\n`;
    }
  }

  if (request.constraints) {
    const c = request.constraints;
    prompt += `\nCONSTRAINTS:\n`;
    if (c.maxCostUsd) prompt += `- Max cost: $${c.maxCostUsd}\n`;
    if (c.maxDurationMs) prompt += `- Max duration: ${Math.round(c.maxDurationMs / 60000)} minutes\n`;
    if (c.preferredAgents?.length) prompt += `- Prefer agents: ${c.preferredAgents.join(", ")}\n`;
    if (c.forbiddenAgents?.length) prompt += `- Avoid agents: ${c.forbiddenAgents.join(", ")}\n`;
    if (c.maxSteps) prompt += `- Max steps per plan: ${c.maxSteps}\n`;
    if (c.mustIncludeApproval) prompt += `- At least one step must require human approval\n`;
  }

  prompt += `\nGenerate plans for strategies: ${strategies.join(", ")}.`;
  return prompt;
}

// ── Compute critical path duration ────────────────────────────────────────────
// Steps with no unresolved dependencies can run in parallel.
// Returns wall-clock time if all parallelism is exploited.
function computeCriticalPath(steps: PlanStep[]): number {
  // Build completion times per outputKey
  const completionTimes: Record<string, number> = {};
  let wallTime = 0;

  for (const step of steps) {
    // This step starts after all its dependencies complete
    const depTime = step.dependsOn.length > 0
      ? Math.max(...step.dependsOn.map((k) => completionTimes[k] ?? 0))
      : 0;
    const endTime = depTime + step.estimatedDurationMs;
    completionTimes[step.outputKey] = endTime;
    wallTime = Math.max(wallTime, endTime);
  }

  return wallTime;
}

// ── Warning generator ─────────────────────────────────────────────────────────
function buildPlanWarnings(
  steps: PlanStep[],
  constraints?: PlanRequest["constraints"]
): string[] {
  const warnings: string[] = [];

  const highRiskSteps = steps.filter((s) => s.riskLevel === "high");
  if (highRiskSteps.length > 0) {
    warnings.push(`${highRiskSteps.length} step(s) flagged high-risk: ${highRiskSteps.map((s) => s.name).join(", ")}`);
  }

  const unapprovedHighRisk = steps.filter((s) => s.riskLevel === "high" && !s.requiresApproval);
  if (unapprovedHighRisk.length > 0) {
    warnings.push(`High-risk steps without approval gates: ${unapprovedHighRisk.map((s) => s.name).join(", ")}`);
  }

  const forbiddenUsed = constraints?.forbiddenAgents
    ? steps.filter((s) => constraints.forbiddenAgents!.includes(s.agentRole))
    : [];
  if (forbiddenUsed.length > 0) {
    warnings.push(`Forbidden agents used: ${forbiddenUsed.map((s) => s.agentRole).join(", ")}`);
  }

  return warnings;
}

// ── Response parser ───────────────────────────────────────────────────────────
interface RawPlanStep {
  id: string;
  order: number;
  name: string;
  description: string;
  agentRole: string;
  promptTemplate: string;
  outputKey: string;
  dependsOn: string[];
  requiresApproval: boolean;
  riskLevel: string;
  rationale: string;
}

interface RawPlan {
  strategy: string;
  confidence: number;
  rationale: string;
  alternativesNoted: string[];
  warnings: string[];
  steps: RawPlanStep[];
}

interface RawPlannerResponse {
  plans: RawPlan[];
  recommended: string;
  summary: string;
}

function parsePlannerResponse(text: string, objective: string): RawPlannerResponse {
  // Extract JSON block (may be wrapped in markdown)
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    return buildFallbackPlan(objective);
  }

  try {
    const parsed = JSON.parse(match[0]) as RawPlannerResponse;
    if (!Array.isArray(parsed.plans) || parsed.plans.length === 0) {
      return buildFallbackPlan(objective);
    }
    return parsed;
  } catch {
    return buildFallbackPlan(objective);
  }
}

function buildFallbackPlan(objective: string): RawPlannerResponse {
  return {
    plans: [
      {
        strategy: "balanced",
        confidence: 60,
        rationale: "Fallback plan generated — planning model output was unparseable",
        alternativesNoted: [],
        warnings: ["Planning model returned unparseable output. Review manually before executing."],
        steps: [
          {
            id: "step_1",
            order: 1,
            name: "Strategic Analysis",
            description: `Analyze and break down the objective: "${objective}"`,
            agentRole: "strategy",
            promptTemplate: `Analyze the following objective and produce an actionable strategy:\n\nObjective: ${objective}\n\nProvide: situation analysis, key actions, success criteria.`,
            outputKey: "strategyAnalysis",
            dependsOn: [],
            requiresApproval: true,
            riskLevel: "low",
            rationale: "Strategy agent best suited for objective decomposition",
          },
          {
            id: "step_2",
            order: 2,
            name: "Execution Brief",
            description: "Translate strategy into concrete next steps",
            agentRole: "operations",
            promptTemplate: `Based on this strategy:\n\n{{strategyAnalysis}}\n\nCreate a concrete execution checklist with owners and deadlines.`,
            outputKey: "executionBrief",
            dependsOn: ["strategyAnalysis"],
            requiresApproval: true,
            riskLevel: "low",
            rationale: "Operations agent converts strategy into executable tasks",
          },
        ],
      },
    ],
    recommended: "balanced",
    summary: `Fallback execution plan for: ${objective}`,
  };
}

// ── Save plan to Firestore ────────────────────────────────────────────────────
export function savePlan(
  db: FirebaseFirestore.Firestore,
  plan: ExecutionPlan,
  createdBy: string
): void {
  db.collection("executionPlans")
    .doc()
    .set({ ...plan, createdBy })
    .catch((err) => console.error("[planner] save failed:", err));
}

// ── Convert plan to workflow definition ──────────────────────────────────────
// Allows a selected plan to be promoted into a WorkflowDefinition for execution.
export async function promotePlanToWorkflow(
  db: FirebaseFirestore.Firestore,
  plan: ExecutionPlan,
  createdBy: string
): Promise<string> {
  const defRef = db.collection("workflowDefinitions").doc();
  await defRef.set({
    name: `[Planned] ${plan.objective.slice(0, 60)}`,
    description: plan.rationale,
    steps: plan.steps.map((s, i) => ({
      id: s.id,
      order: i,
      name: s.name,
      agentRole: s.agentRole,
      promptTemplate: s.promptTemplate,
      outputKey: s.outputKey,
      requiresApproval: s.requiresApproval,
      approvalType: "workflow_step",
    })),
    isActive: true,
    createdBy,
    planId: plan.id,
    planStrategy: plan.strategy,
    estimatedCostUsd: plan.totalEstimatedCostUsd,
    estimatedDurationMs: plan.totalEstimatedDurationMs,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return defRef.id;
}
