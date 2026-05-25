// Takers AI — Workflow State Machine + Pipeline Executor
//
// PipelineRun vs WorkflowRun:
//   WorkflowRun  → single routing decision (created by chat route, logs stay as-is)
//   PipelineRun  → multi-step WorkflowDefinition execution (created here, 9-state machine)
//
// State machine:
//   pending → queued → processing → awaiting_approval → approved → executing → completed
//                                 ↓                     ↓
//                               failed               archived
//   Any terminal state can be archived.
//   failed → queued (retry allowed)

import type { Firestore } from "firebase-admin/firestore";
import type { AgentRole } from "./types";

// ── State definitions ─────────────────────────────────────────────────────────
export type PipelineState =
  | "pending"           // Created but not yet queued
  | "queued"            // Waiting to start; user confirmed variables
  | "processing"        // Currently executing a step
  | "awaiting_approval" // Blocked at an approval gate
  | "approved"          // Approval granted; ready to continue
  | "executing"         // Running post-approval action
  | "completed"         // All steps done successfully
  | "failed"            // Unrecoverable error
  | "archived";         // Terminal, stored for history

// Valid transitions: from state → allowed next states
export const PIPELINE_TRANSITIONS: Record<PipelineState, PipelineState[]> = {
  pending:           ["queued", "archived"],
  queued:            ["processing", "failed", "archived"],
  processing:        ["awaiting_approval", "executing", "completed", "failed"],
  awaiting_approval: ["approved", "failed", "archived"],
  approved:          ["executing", "failed"],
  executing:         ["completed", "failed"],
  completed:         ["archived"],
  failed:            ["queued", "archived"],   // retry: failed → queued
  archived:          [],                       // terminal
};

export const TERMINAL_STATES: PipelineState[] = ["completed", "failed", "archived"];
export const ACTIVE_STATES: PipelineState[] = ["queued", "processing", "awaiting_approval", "approved", "executing"];

// ── State display helpers ─────────────────────────────────────────────────────
export const PIPELINE_STATE_COLORS: Record<PipelineState, string> = {
  pending:           "bg-white/5 border-white/10 text-white/30",
  queued:            "bg-white/5 border-white/15 text-white/50",
  processing:        "bg-blue-600/15 border-blue-600/25 text-blue-300",
  awaiting_approval: "bg-amber-600/15 border-amber-600/25 text-amber-300",
  approved:          "bg-emerald-600/15 border-emerald-600/25 text-emerald-300",
  executing:         "bg-purple-600/15 border-purple-600/25 text-purple-300",
  completed:         "bg-emerald-600/15 border-emerald-600/25 text-emerald-300",
  failed:            "bg-red-600/15 border-red-600/25 text-red-300",
  archived:          "bg-white/[0.03] border-white/[0.06] text-white/20",
};

export const PIPELINE_STATE_DOTS: Record<PipelineState, string> = {
  pending:           "bg-white/20",
  queued:            "bg-white/40",
  processing:        "bg-blue-400 animate-pulse",
  awaiting_approval: "bg-amber-400 animate-pulse",
  approved:          "bg-emerald-400 animate-pulse",
  executing:         "bg-purple-400 animate-pulse",
  completed:         "bg-emerald-400",
  failed:            "bg-red-400",
  archived:          "bg-white/10",
};

// ── PipelineRun data model ────────────────────────────────────────────────────
export interface PipelineStepRecord {
  stepId: string;
  stepName: string;
  agentRole: AgentRole;
  state: "pending" | "skipped" | "processing" | "completed" | "failed" | "awaiting_approval";
  outputKey: string;
  output?: string;            // Truncated to 2000 chars for storage
  approvalItemId?: string;    // If this step created an approval item
  tokenUsage?: { input: number; output: number };
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
}

export interface PipelineRun {
  id: string;
  definitionId: string;
  definitionName: string;
  state: PipelineState;
  currentStepIndex: number;   // 0-indexed; -1 = not started
  totalSteps: number;
  variables: Record<string, string>;     // User-provided variable values
  stepOutputs: Record<string, string>;   // outputKey → truncated AI response
  steps: PipelineStepRecord[];
  approvalItemIds: string[];
  totalInputTokens: number;
  totalOutputTokens: number;
  adminUid: string;
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
  retryCount: number;
}

// ── Transition guard ──────────────────────────────────────────────────────────
export function canTransition(from: PipelineState, to: PipelineState): boolean {
  return PIPELINE_TRANSITIONS[from]?.includes(to) ?? false;
}

// ── State transition (writes to Firestore) ────────────────────────────────────
export async function transitionPipeline(
  db: Firestore,
  runId: string,
  newState: PipelineState,
  metadata?: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const ref = db.collection("pipelineRuns").doc(runId);
  const doc = await ref.get();

  if (!doc.exists) {
    return { success: false, error: "Pipeline run not found" };
  }

  const currentState = doc.data()!.state as PipelineState;

  if (!canTransition(currentState, newState)) {
    return {
      success: false,
      error: `Cannot transition from "${currentState}" to "${newState}"`,
    };
  }

  const updates: Record<string, unknown> = {
    state: newState,
    ...metadata,
  };

  if (TERMINAL_STATES.includes(newState)) {
    updates.completedAt = new Date().toISOString();
  }

  await ref.update(updates);
  return { success: true };
}

// ── Variable interpolation ────────────────────────────────────────────────────
// Replaces {{variableName}} with values from variables + stepOutputs context.
// stepOutputs from previous steps are available as {{outputKey}} variables.
export function interpolateTemplate(
  template: string,
  variables: Record<string, string>,
  stepOutputs: Record<string, string>
): string {
  const context: Record<string, string> = { ...variables, ...stepOutputs };
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (key in context) {
      const val = context[key];
      // Truncate injected outputs to keep prompt manageable
      return val.length > 800 ? val.slice(0, 800) + "…[truncated]" : val;
    }
    return match; // Leave unresolved placeholders as-is
  });
}

// ── Missing variables detector ────────────────────────────────────────────────
export function getMissingVariables(
  template: string,
  variables: Record<string, string>,
  stepOutputs: Record<string, string>
): string[] {
  const allKeys = new Set([...Object.keys(variables), ...Object.keys(stepOutputs)]);
  const placeholders = [...template.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
  return [...new Set(placeholders)].filter((p) => !allKeys.has(p));
}

// ── Pipeline run factory ──────────────────────────────────────────────────────
export function createPipelineRun(
  definitionId: string,
  definitionName: string,
  totalSteps: number,
  stepDefinitions: Array<{ id: string; name: string; agentRole: AgentRole; outputKey: string }>,
  variables: Record<string, string>,
  adminUid: string
): Omit<PipelineRun, "id"> {
  const now = new Date().toISOString();
  return {
    definitionId,
    definitionName,
    state: "pending",
    currentStepIndex: -1,
    totalSteps,
    variables,
    stepOutputs: {},
    steps: stepDefinitions.map((s) => ({
      stepId: s.id,
      stepName: s.name,
      agentRole: s.agentRole,
      state: "pending",
      outputKey: s.outputKey,
    })),
    approvalItemIds: [],
    totalInputTokens: 0,
    totalOutputTokens: 0,
    adminUid,
    startedAt: now,
    completedAt: undefined,
    errorMessage: undefined,
    retryCount: 0,
  };
}

// ── Progress calculator ───────────────────────────────────────────────────────
export interface PipelineProgress {
  completedSteps: number;
  totalSteps: number;
  percentComplete: number;
  currentStepName: string | null;
  isBlocked: boolean;
  blockReason: string | null;
}

export function getPipelineProgress(run: PipelineRun): PipelineProgress {
  const completedSteps = run.steps.filter((s) => s.state === "completed").length;
  const currentStep = run.currentStepIndex >= 0 ? run.steps[run.currentStepIndex] : null;
  const isBlocked = run.state === "awaiting_approval";

  return {
    completedSteps,
    totalSteps: run.totalSteps,
    percentComplete: run.totalSteps > 0 ? Math.round((completedSteps / run.totalSteps) * 100) : 0,
    currentStepName: currentStep?.stepName ?? null,
    isBlocked,
    blockReason: isBlocked ? `Waiting for approval at step: ${currentStep?.stepName}` : null,
  };
}

// ── Retry logic ───────────────────────────────────────────────────────────────
export const MAX_RETRIES = 3;

export async function retryPipelineRun(
  db: Firestore,
  runId: string
): Promise<{ success: boolean; error?: string }> {
  const ref = db.collection("pipelineRuns").doc(runId);
  const doc = await ref.get();

  if (!doc.exists) return { success: false, error: "Not found" };

  const data = doc.data() as PipelineRun;

  if (data.state !== "failed") {
    return { success: false, error: "Can only retry failed runs" };
  }

  if (data.retryCount >= MAX_RETRIES) {
    return { success: false, error: `Max retries (${MAX_RETRIES}) exceeded` };
  }

  await ref.update({
    state: "queued" as PipelineState,
    errorMessage: null,
    retryCount: (data.retryCount ?? 0) + 1,
  });

  return { success: true };
}
