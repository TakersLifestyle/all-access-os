// Takers AI — Pipeline Run Execution with State Machine
//
// GET    /api/takers-ai/pipeline-runs            → list runs
// GET    /api/takers-ai/pipeline-runs?id=<id>    → single run
// POST   /api/takers-ai/pipeline-runs            → create + start pipeline
// PATCH  /api/takers-ai/pipeline-runs            → transition state / advance step
// DELETE /api/takers-ai/pipeline-runs?id=<id>    → delete run
//
// Execution flow:
//   1. POST with { definitionId, variables } → creates run in "pending" state
//   2. Auto-transitions: pending → queued → processing (first step)
//   3. Each step: load agent, build prompt with interpolated variables + previous outputs
//   4. Stream via Claude, save output to stepOutputs
//   5. If step.requiresApproval: state → awaiting_approval, create approvalQueue item
//   6. When admin approves: PATCH with { id, action: "advance" } → executing → next step
//   7. Last step completes: state → completed

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import {
  canTransition,
  transitionPipeline,
  createPipelineRun,
  interpolateTemplate,
  getMissingVariables,
  type PipelineState,
} from "@/lib/takers-ai/workflow-engine";
import type { WorkflowDefinition, WorkflowStepDefinition } from "@/lib/takers-ai/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
  const id = searchParams.get("id");
  const state = searchParams.get("state") as PipelineState | null;
  const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 200);
  const db = adminDb();

  if (id) {
    const doc = await db.collection("pipelineRuns").doc(id).get();
    if (!doc.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ run: { id: doc.id, ...doc.data() } });
  }

  let query: FirebaseFirestore.Query = db
    .collection("pipelineRuns")
    .orderBy("startedAt", "desc")
    .limit(limit);

  if (state) query = query.where("state", "==", state);

  const snap = await query.get();
  const runs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return NextResponse.json({ runs });
}

// ── POST: Create + auto-start ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { definitionId, variables = {} } = body as {
    definitionId: string;
    variables: Record<string, string>;
  };

  if (!definitionId) {
    return NextResponse.json({ error: "definitionId required." }, { status: 400 });
  }

  const db = adminDb();
  const defDoc = await db.collection("workflowDefinitions").doc(definitionId).get();
  if (!defDoc.exists) {
    return NextResponse.json({ error: "Workflow definition not found." }, { status: 404 });
  }

  const definition = { id: defDoc.id, ...defDoc.data() } as WorkflowDefinition;

  if (!definition.isActive) {
    return NextResponse.json({ error: "Workflow definition is not active." }, { status: 400 });
  }

  const sortedSteps = [...definition.steps].sort((a, b) => a.order - b.order);

  // Check for missing required variables (from first step only — others use step outputs)
  const firstStep = sortedSteps[0];
  if (firstStep) {
    const missing = getMissingVariables(firstStep.promptTemplate, variables, {});
    if (missing.length > 0) {
      return NextResponse.json({
        error: `Missing required variables for first step: ${missing.join(", ")}`,
        missingVariables: missing,
      }, { status: 400 });
    }
  }

  // Create pipeline run
  const runData = createPipelineRun(
    definitionId,
    definition.name,
    sortedSteps.length,
    sortedSteps.map((s) => ({
      id: s.id,
      name: s.name,
      agentRole: s.agentRole,
      outputKey: s.outputKey,
    })),
    variables,
    decoded.uid
  );

  const runRef = db.collection("pipelineRuns").doc();
  await runRef.set(runData);

  // Auto-advance: pending → queued → processing (execute first step)
  await runRef.update({ state: "queued" as PipelineState });

  // Execute first step synchronously (non-streaming, returns full response)
  const result = await executeStep(db, runRef.id, 0, sortedSteps, variables, {});

  if (!result.success) {
    await runRef.update({ state: "failed" as PipelineState, errorMessage: result.error });
    return NextResponse.json({ id: runRef.id, state: "failed", error: result.error }, { status: 500 });
  }

  const finalDoc = await runRef.get();
  return NextResponse.json({ id: runRef.id, ...finalDoc.data() }, { status: 201 });
}

// ── PATCH: State transition / advance to next step ────────────────────────────
export async function PATCH(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, action, newState, metadata } = body as {
    id: string;
    action?: "advance" | "retry" | "archive";
    newState?: PipelineState;
    metadata?: Record<string, unknown>;
  };

  if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });

  const db = adminDb();
  const runDoc = await db.collection("pipelineRuns").doc(id).get();
  if (!runDoc.exists) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const run = runDoc.data()!;
  const currentState = run.state as PipelineState;

  // Handle explicit state override (for admin override scenarios)
  if (newState && !action) {
    const result = await transitionPipeline(db, id, newState, metadata);
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ success: true });
  }

  // Handle action-based transitions
  if (action === "retry") {
    if (currentState !== "failed") {
      return NextResponse.json({ error: "Can only retry failed runs." }, { status: 400 });
    }
    await db.collection("pipelineRuns").doc(id).update({
      state: "queued" as PipelineState,
      errorMessage: null,
      retryCount: (run.retryCount ?? 0) + 1,
    });
    return NextResponse.json({ success: true, state: "queued" });
  }

  if (action === "archive") {
    if (!canTransition(currentState, "archived")) {
      return NextResponse.json({ error: `Cannot archive from state "${currentState}"` }, { status: 400 });
    }
    await transitionPipeline(db, id, "archived");
    return NextResponse.json({ success: true, state: "archived" });
  }

  if (action === "advance") {
    // Continue pipeline after approval
    if (currentState !== "awaiting_approval" && currentState !== "approved") {
      return NextResponse.json({ error: `Cannot advance from state "${currentState}"` }, { status: 400 });
    }

    await transitionPipeline(db, id, "approved");

    const defDoc = await db.collection("workflowDefinitions").doc(run.definitionId as string).get();
    if (!defDoc.exists) {
      return NextResponse.json({ error: "Workflow definition not found." }, { status: 404 });
    }
    const definition = { id: defDoc.id, ...defDoc.data() } as WorkflowDefinition;
    const sortedSteps = [...definition.steps].sort((a, b) => a.order - b.order);

    const nextStepIndex = (run.currentStepIndex as number) + 1;
    if (nextStepIndex >= sortedSteps.length) {
      await transitionPipeline(db, id, "completed");
      return NextResponse.json({ success: true, state: "completed" });
    }

    const result = await executeStep(
      db, id, nextStepIndex, sortedSteps,
      run.variables as Record<string, string>,
      run.stepOutputs as Record<string, string>
    );

    if (!result.success) {
      await transitionPipeline(db, id, "failed", { errorMessage: result.error });
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    const finalDoc = await db.collection("pipelineRuns").doc(id).get();
    return NextResponse.json({ success: true, ...finalDoc.data() });
  }

  return NextResponse.json({ error: "Unknown action. Use: advance | retry | archive" }, { status: 400 });
}

// ── DELETE ────────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });

  await adminDb().collection("pipelineRuns").doc(id).delete();
  return NextResponse.json({ success: true });
}

// ── Step execution engine ─────────────────────────────────────────────────────
// Loads the agent, builds the prompt, calls Claude, saves output.
// Non-streaming — full response is awaited before returning.
async function executeStep(
  db: FirebaseFirestore.Firestore,
  runId: string,
  stepIndex: number,
  steps: WorkflowStepDefinition[],
  variables: Record<string, string>,
  stepOutputs: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  const step = steps[stepIndex];
  if (!step) return { success: false, error: `Step ${stepIndex} not found` };

  const runRef = db.collection("pipelineRuns").doc(runId);

  // Mark step as processing
  await runRef.update({
    state: "processing" as PipelineState,
    currentStepIndex: stepIndex,
    [`steps.${stepIndex}.state`]: "processing",
    [`steps.${stepIndex}.startedAt`]: new Date().toISOString(),
  });

  try {
    // Load agent by role
    const agentsSnap = await db
      .collection("agents")
      .where("role", "==", step.agentRole)
      .where("isActive", "==", true)
      .limit(1)
      .get();

    if (agentsSnap.empty) {
      throw new Error(`No active agent found for role: ${step.agentRole}`);
    }

    const agent = agentsSnap.docs[0].data();
    const agentId = agentsSnap.docs[0].id;

    // Build prompt: interpolate variables + previous step outputs
    const interpolatedPrompt = interpolateTemplate(step.promptTemplate, variables, stepOutputs);

    // Load agent instructions
    const instrDoc = await db.collection("agentInstructions").doc(agentId).get();
    let systemPrompt = agent.systemPrompt as string;
    if (instrDoc.exists) {
      const instr = instrDoc.data()!.instructions as string;
      if (instr?.trim()) systemPrompt += `\n\n## CUSTOM INSTRUCTIONS\n${instr}`;
    }

    // Load brand memory (active only, priority ordered)
    const memSnap = await db
      .collection("brandMemory")
      .where("isActive", "==", true)
      .orderBy("priority", "desc")
      .limit(5)   // Pipeline steps inject fewer blocks to keep context focused
      .get();

    if (!memSnap.empty) {
      const blocks = memSnap.docs.map((d) => `### ${d.data().title}\n${d.data().content}`);
      systemPrompt += `\n\n## BRAND CONTEXT\n${blocks.join("\n\n")}`;
    }

    const startedAt = Date.now();

    // Call Claude (non-streaming)
    const response = await anthropic.messages.create({
      model: (agent.model as string) || "claude-sonnet-4-5",
      max_tokens: (agent.maxTokens as number) || 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: interpolatedPrompt }],
    });

    const output = response.content[0].type === "text" ? response.content[0].text : "";
    const durationMs = Date.now() - startedAt;
    const tokenUsage = { input: response.usage.input_tokens, output: response.usage.output_tokens };

    // Truncate for storage (full output may be large)
    const truncatedOutput = output.slice(0, 3000);

    // Update step outputs
    const newStepOutputs = { ...stepOutputs, [step.outputKey]: truncatedOutput };

    const now = new Date().toISOString();

    // Check if this step requires approval
    if (step.requiresApproval) {
      // Create approval queue item
      const approvalRef = db.collection("approvalQueue").doc();
      await approvalRef.set({
        type: step.approvalType ?? "workflow_step",
        title: `${step.name} — Review Required`,
        description: `Step ${stepIndex + 1} of ${steps.length} in pipeline run. Review before proceeding.`,
        content: truncatedOutput,
        context: { runId, stepId: step.id, stepIndex, definitionName: "pipeline" },
        requestedBy: `agent:${agentId}`,
        agentId,
        agentRole: step.agentRole,
        agentName: agent.name,
        workflowRunId: runId,
        status: "pending",
        priority: "medium",
        reviewedBy: null,
        reviewedAt: null,
        reviewNote: null,
        createdAt: now,
        expiresAt: null,
      });

      await runRef.update({
        state: "awaiting_approval" as PipelineState,
        stepOutputs: newStepOutputs,
        [`steps.${stepIndex}.state`]: "awaiting_approval",
        [`steps.${stepIndex}.output`]: truncatedOutput,
        [`steps.${stepIndex}.approvalItemId`]: approvalRef.id,
        [`steps.${stepIndex}.tokenUsage`]: tokenUsage,
        [`steps.${stepIndex}.completedAt`]: now,
        approvalItemIds: [...((await runRef.get()).data()?.approvalItemIds as string[] ?? []), approvalRef.id],
        totalInputTokens: (((await runRef.get()).data()?.totalInputTokens as number) ?? 0) + tokenUsage.input,
        totalOutputTokens: (((await runRef.get()).data()?.totalOutputTokens as number) ?? 0) + tokenUsage.output,
      });

      return { success: true };
    }

    // No approval needed — mark complete and advance
    await runRef.update({
      stepOutputs: newStepOutputs,
      [`steps.${stepIndex}.state`]: "completed",
      [`steps.${stepIndex}.output`]: truncatedOutput,
      [`steps.${stepIndex}.tokenUsage`]: tokenUsage,
      [`steps.${stepIndex}.completedAt`]: now,
      [`steps.${stepIndex}.errorMessage`]: null,
      totalInputTokens: (((await runRef.get()).data()?.totalInputTokens as number) ?? 0) + tokenUsage.input,
      totalOutputTokens: (((await runRef.get()).data()?.totalOutputTokens as number) ?? 0) + tokenUsage.output,
    });

    // Advance to next step or complete
    const nextStepIndex = stepIndex + 1;
    if (nextStepIndex >= steps.length) {
      await transitionPipeline(db, runId, "completed");
      return { success: true };
    }

    // Execute next step recursively
    return executeStep(db, runId, nextStepIndex, steps, variables, newStepOutputs);

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await runRef.update({
      [`steps.${stepIndex}.state`]: "failed",
      [`steps.${stepIndex}.errorMessage`]: errorMessage,
      [`steps.${stepIndex}.completedAt`]: new Date().toISOString(),
    });
    return { success: false, error: errorMessage };
  }
}
