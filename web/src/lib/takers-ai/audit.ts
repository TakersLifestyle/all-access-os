// Takers AI — Audit Trail + Execution Trace + Replay
//
// Every significant action writes an AuditEvent to `auditEvents` collection.
// This provides:
//   1. Immutable history of who did what and when
//   2. Full execution timeline per pipeline run (linked by entityId)
//   3. Step-by-step debug trace with inputs/outputs/timing
//   4. Replay: re-execute a failed run from last successful checkpoint
//   5. Rollback: restore a memory/definition to a previous state
//
// Design principles:
//   - Write-only: audit events are NEVER modified after creation
//   - Structured: every event has a consistent shape for querying
//   - Linked: events link to their parent entity (runId, jobId, etc.)
//   - Contextual: events carry enough data to reconstruct what happened

// ── Event types ───────────────────────────────────────────────────────────────
export type AuditEventType =
  // Pipeline events
  | "pipeline_created"
  | "pipeline_state_transition"
  | "pipeline_step_started"
  | "pipeline_step_completed"
  | "pipeline_step_failed"
  | "pipeline_step_skipped"
  | "pipeline_completed"
  | "pipeline_failed"
  | "pipeline_cancelled"
  | "pipeline_replayed"
  // Approval events
  | "approval_created"
  | "approval_approved"
  | "approval_rejected"
  | "approval_expired"
  // Tool events
  | "tool_requested"
  | "tool_approved"
  | "tool_executed"
  | "tool_failed"
  | "tool_rejected"
  // Memory events
  | "memory_created"
  | "memory_updated"
  | "memory_deleted"
  | "memory_deactivated"
  // Knowledge events
  | "knowledge_created"
  | "knowledge_updated"
  | "knowledge_ingested"
  | "knowledge_deleted"
  // Agent events
  | "agent_created"
  | "agent_updated"
  | "agent_instructions_updated"
  | "agent_generation"
  // Job events
  | "job_created"
  | "job_started"
  | "job_completed"
  | "job_failed"
  | "job_cancelled"
  | "job_dlq_moved"
  // Access events
  | "role_granted"
  | "role_revoked"
  | "permission_denied"
  // System events
  | "rate_limit_hit"
  | "system_error";

export type AuditEntityType =
  | "pipeline_run"
  | "workflow_definition"
  | "approval_item"
  | "tool_call"
  | "brand_memory"
  | "knowledge_doc"
  | "agent"
  | "orchestration_job"
  | "ai_role"
  | "system";

// ── Audit event model ─────────────────────────────────────────────────────────
export interface AuditEvent {
  id: string;
  type: AuditEventType;
  entityType: AuditEntityType;
  entityId: string;          // ID of the thing this event is about
  parentId: string | null;   // e.g. pipelineRunId for step events
  // Actor
  actorUid: string;          // "system" for automated events
  actorRole: string;         // ai role at time of action
  actorEmail: string | null;
  // State change
  previousState: string | null;    // state before this event
  newState: string | null;         // state after this event
  // Payload — event-specific details
  payload: Record<string, unknown>;
  // Error details (for failure events)
  errorCode: string | null;
  errorMessage: string | null;
  // Timing
  durationMs: number | null;
  createdAt: string;
}

// ── Factory ───────────────────────────────────────────────────────────────────
export function createAuditEvent(
  type: AuditEventType,
  entityType: AuditEntityType,
  entityId: string,
  actor: { uid: string; role?: string; email?: string },
  data: {
    parentId?: string;
    previousState?: string;
    newState?: string;
    payload?: Record<string, unknown>;
    errorCode?: string;
    errorMessage?: string;
    durationMs?: number;
  } = {}
): Omit<AuditEvent, "id"> {
  return {
    type,
    entityType,
    entityId,
    parentId: data.parentId ?? null,
    actorUid: actor.uid,
    actorRole: actor.role ?? "system",
    actorEmail: actor.email ?? null,
    previousState: data.previousState ?? null,
    newState: data.newState ?? null,
    payload: data.payload ?? {},
    errorCode: data.errorCode ?? null,
    errorMessage: data.errorMessage ?? null,
    durationMs: data.durationMs ?? null,
    createdAt: new Date().toISOString(),
  };
}

// ── Fire-and-forget writer ────────────────────────────────────────────────────
// Non-blocking — never awaited in hot paths. Audit failures don't break execution.
export function writeAuditEvent(
  db: FirebaseFirestore.Firestore,
  type: AuditEventType,
  entityType: AuditEntityType,
  entityId: string,
  actor: { uid: string; role?: string; email?: string },
  data: Parameters<typeof createAuditEvent>[4] = {}
): void {
  try {
    const event = createAuditEvent(type, entityType, entityId, actor, data);
    // Sanitize before write — the payload field can contain caller-supplied data
    // that may include undefined values, which Firestore rejects.
    const safe = JSON.parse(JSON.stringify(event, (_k, v) => v === undefined ? null : v));
    db.collection("auditEvents")
      .doc()
      .set(safe)
      .catch((err) => console.error("[audit] write failed:", err));
  } catch (err) {
    // Never let audit logging crash the calling code
    console.warn("[audit] writeAuditEvent failed:", String(err));
  }
}

// ── Execution trace ───────────────────────────────────────────────────────────
// A structured timeline of events for a single pipeline run.
// Each entry maps to an AuditEvent linked by parentId = runId.

export interface TraceEntry {
  eventId: string;
  type: AuditEventType;
  stepIndex: number | null;
  stepName: string | null;
  agentRole: string | null;
  previousState: string | null;
  newState: string | null;
  durationMs: number | null;
  timestamp: string;
  payload: Record<string, unknown>;
  errorMessage: string | null;
}

export interface ExecutionTrace {
  runId: string;
  definitionName: string;
  totalSteps: number;
  completedSteps: number;
  startedAt: string;
  completedAt: string | null;
  totalDurationMs: number | null;
  entries: TraceEntry[];
  checkpoints: CheckpointRecord[];
}

export async function getExecutionTrace(
  db: FirebaseFirestore.Firestore,
  runId: string
): Promise<ExecutionTrace | null> {
  const [runDoc, eventsSnap] = await Promise.all([
    db.collection("pipelineRuns").doc(runId).get(),
    db
      .collection("auditEvents")
      .where("parentId", "==", runId)
      .orderBy("createdAt", "asc")
      .get(),
  ]);

  if (!runDoc.exists) return null;

  const run = runDoc.data()!;
  const checkpointsSnap = await db
    .collection("executionCheckpoints")
    .where("runId", "==", runId)
    .orderBy("stepIndex", "asc")
    .get();

  const entries: TraceEntry[] = eventsSnap.docs.map((d) => {
    const e = d.data() as AuditEvent;
    return {
      eventId: d.id,
      type: e.type,
      stepIndex: (e.payload.stepIndex as number) ?? null,
      stepName: (e.payload.stepName as string) ?? null,
      agentRole: (e.payload.agentRole as string) ?? null,
      previousState: e.previousState,
      newState: e.newState,
      durationMs: e.durationMs,
      timestamp: e.createdAt,
      payload: e.payload,
      errorMessage: e.errorMessage,
    };
  });

  const checkpoints = checkpointsSnap.docs.map((d) => d.data() as CheckpointRecord);

  const startedAt = run.startedAt as string;
  const completedAt = (run.completedAt as string) ?? null;
  const totalDurationMs = completedAt
    ? new Date(completedAt).getTime() - new Date(startedAt).getTime()
    : null;

  return {
    runId,
    definitionName: run.definitionName as string,
    totalSteps: run.totalSteps as number,
    completedSteps: ((run.steps as Array<{ state: string }>) ?? []).filter(
      (s) => s.state === "completed"
    ).length,
    startedAt,
    completedAt,
    totalDurationMs,
    entries,
    checkpoints,
  };
}

// ── Checkpoints ───────────────────────────────────────────────────────────────
// Written after each completed step. Enables resumption from last good state.

export interface CheckpointRecord {
  id: string;
  runId: string;
  stepIndex: number;
  stepId: string;
  stepName: string;
  stepOutputKey: string;
  outputSnapshot: string;        // truncated output at this checkpoint
  structuredOutputSnapshot: Record<string, unknown> | null;
  stepOutputsSnapshot: Record<string, string>; // full stepOutputs at this point
  tokenUsage: { input: number; output: number };
  createdAt: string;
}

export async function writeCheckpoint(
  db: FirebaseFirestore.Firestore,
  data: Omit<CheckpointRecord, "id">
): Promise<string> {
  const ref = db.collection("executionCheckpoints").doc();
  await ref.set(data);
  return ref.id;
}

export async function getLatestCheckpoint(
  db: FirebaseFirestore.Firestore,
  runId: string
): Promise<CheckpointRecord | null> {
  const snap = await db
    .collection("executionCheckpoints")
    .where("runId", "==", runId)
    .orderBy("stepIndex", "desc")
    .limit(1)
    .get();

  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as CheckpointRecord;
}

// ── Replay support ────────────────────────────────────────────────────────────
// Replays a failed pipeline run from its last successful checkpoint.
// Creates a NEW run document with state seeded from the checkpoint.

export interface ReplayRequest {
  originalRunId: string;
  fromStepIndex: number;   // 0 = start over, N = resume from step N
  replayedBy: string;      // admin uid
  reason: string;
}

export interface ReplayResult {
  success: boolean;
  newRunId: string | null;
  error?: string;
}

export async function createReplayRun(
  db: FirebaseFirestore.Firestore,
  request: ReplayRequest
): Promise<ReplayResult> {
  const originalDoc = await db.collection("pipelineRuns").doc(request.originalRunId).get();
  if (!originalDoc.exists) {
    return { success: false, newRunId: null, error: "Original run not found" };
  }

  const original = originalDoc.data()!;

  if (!["failed", "cancelled"].includes(original.state as string)) {
    return {
      success: false,
      newRunId: null,
      error: `Cannot replay a run in "${original.state}" state. Only failed or cancelled runs can be replayed.`,
    };
  }

  // Get checkpoint to seed step outputs
  const checkpoint = request.fromStepIndex > 0
    ? await getLatestCheckpoint(db, request.originalRunId)
    : null;

  const now = new Date().toISOString();
  const newRunRef = db.collection("pipelineRuns").doc();

  // Clone original run, reset state for replay
  const steps = (original.steps as Array<Record<string, unknown>>).map((step, i) => ({
    ...step,
    state: i < request.fromStepIndex ? "completed" : "pending",
    // Preserve outputs for already-completed steps
    output: i < request.fromStepIndex ? step.output : undefined,
    errorMessage: null,
    startedAt: i < request.fromStepIndex ? step.startedAt : undefined,
    completedAt: i < request.fromStepIndex ? step.completedAt : undefined,
  }));

  await newRunRef.set({
    definitionId: original.definitionId,
    definitionName: original.definitionName,
    state: "queued",
    currentStepIndex: request.fromStepIndex - 1,
    totalSteps: original.totalSteps,
    variables: original.variables,
    stepOutputs: checkpoint?.stepOutputsSnapshot ?? {},
    steps,
    approvalItemIds: [],
    totalInputTokens: 0,
    totalOutputTokens: 0,
    adminUid: request.replayedBy,
    startedAt: now,
    completedAt: null,
    errorMessage: null,
    retryCount: 0,
    isReplay: true,
    originalRunId: request.originalRunId,
    replayFromStep: request.fromStepIndex,
    replayedAt: now,
    replayedBy: request.replayedBy,
    replayReason: request.reason,
  });

  // Write audit event on the original run
  writeAuditEvent(
    db,
    "pipeline_replayed",
    "pipeline_run",
    request.originalRunId,
    { uid: request.replayedBy, role: "admin" },
    {
      payload: {
        newRunId: newRunRef.id,
        fromStepIndex: request.fromStepIndex,
        reason: request.reason,
      },
    }
  );

  return { success: true, newRunId: newRunRef.id };
}

// ── Timeline builder ──────────────────────────────────────────────────────────
// Groups audit events into a human-readable timeline with duration gaps.

export interface TimelineSegment {
  label: string;
  startAt: string;
  endAt: string | null;
  durationMs: number | null;
  state: "completed" | "failed" | "running" | "pending";
  events: TraceEntry[];
  stepIndex: number | null;
}

export function buildTimeline(trace: ExecutionTrace): TimelineSegment[] {
  const segments: TimelineSegment[] = [];
  const stepGroups = new Map<number, TraceEntry[]>();
  const systemEvents: TraceEntry[] = [];

  // Group entries by step index
  for (const entry of trace.entries) {
    if (entry.stepIndex !== null) {
      const group = stepGroups.get(entry.stepIndex) ?? [];
      group.push(entry);
      stepGroups.set(entry.stepIndex, group);
    } else {
      systemEvents.push(entry);
    }
  }

  // System-level segment (start/end)
  if (systemEvents.length > 0) {
    segments.push({
      label: "Pipeline lifecycle",
      startAt: trace.startedAt,
      endAt: trace.completedAt,
      durationMs: trace.totalDurationMs,
      state: trace.completedAt
        ? (trace.entries.some((e) => e.type === "pipeline_failed") ? "failed" : "completed")
        : "running",
      events: systemEvents,
      stepIndex: null,
    });
  }

  // Per-step segments
  for (const [stepIndex, events] of [...stepGroups.entries()].sort((a, b) => a[0] - b[0])) {
    const startEvent = events.find((e) => e.type === "pipeline_step_started");
    const endEvent = events.find(
      (e) => e.type === "pipeline_step_completed" || e.type === "pipeline_step_failed"
    );
    const isFailed = events.some((e) => e.type === "pipeline_step_failed");

    segments.push({
      label: startEvent?.stepName ?? `Step ${stepIndex + 1}`,
      startAt: startEvent?.timestamp ?? trace.startedAt,
      endAt: endEvent?.timestamp ?? null,
      durationMs: startEvent && endEvent
        ? new Date(endEvent.timestamp).getTime() - new Date(startEvent.timestamp).getTime()
        : null,
      state: endEvent ? (isFailed ? "failed" : "completed") : "running",
      events,
      stepIndex,
    });
  }

  return segments.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
}
