// Takers AI — Orchestration Engine
//
// Firestore-backed job queue for async, retryable, schedulable AI work.
//
// Job types:
//   pipeline_run      — execute a WorkflowDefinition via pipeline-runs API
//   knowledge_ingest  — embed/re-index documents in the knowledge base
//   tool_execute      — run an approved tool call
//   scheduled_chat    — run a chat completion on a schedule
//   bulk_embed        — re-embed all stale knowledge documents
//
// Execution model:
//   1. Jobs are written to `orchestrationJobs` Firestore collection
//   2. Status transitions: queued → running → completed | failed
//   3. On failure: retryPolicy applies exponential backoff
//   4. Dependencies: a job can wait for another job's completion
//   5. Parallelism: parallel-flagged jobs without cross-deps run simultaneously
//   6. Scheduling: scheduledAt field; the scheduler polls queued jobs
//
// Multi-tenant ready:
//   Every job has a tenantId field (currently always "default").
//   Switching to multi-tenant: filter all queries by tenantId.
//
// Architecture note:
//   This module is the data layer — it creates/reads/updates job records.
//   Actual execution is triggered by POST /api/takers-ai/jobs?action=run
//   or by a Vercel Cron function that calls the same endpoint on a schedule.

// ── Job model ─────────────────────────────────────────────────────────────────
export type JobType =
  | "pipeline_run"
  | "knowledge_ingest"
  | "tool_execute"
  | "scheduled_chat"
  | "bulk_embed";

export type JobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "waiting";    // waiting for a dependency to complete

export type JobPriority = "low" | "normal" | "high" | "critical";

export interface RetryPolicy {
  maxRetries: number;            // 0 = no retries
  backoffMs: number;             // initial backoff in ms
  backoffMultiplier: number;     // multiplied on each retry (exponential)
  maxBackoffMs: number;          // cap for backoff
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  backoffMs: 5000,            // 5 seconds initial
  backoffMultiplier: 2,       // 5s → 10s → 20s → 40s (capped at maxBackoffMs)
  maxBackoffMs: 3600000,      // 1 hour max
};

export const NO_RETRY: RetryPolicy = {
  maxRetries: 0,
  backoffMs: 0,
  backoffMultiplier: 1,
  maxBackoffMs: 0,
};

export interface OrchestrationJob {
  id: string;
  type: JobType;
  label: string;               // human-readable description
  status: JobStatus;
  priority: JobPriority;
  tenantId: string;            // always "default" until multi-tenant

  // Payload — job-type-specific
  payload: Record<string, unknown>;

  // Dependencies — job won't start until all listed job IDs are "completed"
  dependsOn: string[];

  // Scheduling
  scheduledAt: string | null;   // null = run immediately when dequeued
  cronExpression: string | null; // if set, re-queue on this schedule after completion
  cronLabel: string | null;     // human-readable cron description

  // Retry state
  retryPolicy: RetryPolicy;
  retryCount: number;
  nextRetryAt: string | null;
  lastError: string | null;

  // Execution metadata
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  result: Record<string, unknown> | null;

  // Ownership
  createdBy: string;            // admin uid or "system"
  createdAt: string;
  updatedAt: string;
}

// ── Job factory ───────────────────────────────────────────────────────────────
export function createJobRecord(
  type: JobType,
  label: string,
  payload: Record<string, unknown>,
  options: {
    priority?: JobPriority;
    scheduledAt?: string;
    cronExpression?: string;
    cronLabel?: string;
    dependsOn?: string[];
    retryPolicy?: RetryPolicy;
    createdBy?: string;
  } = {}
): Omit<OrchestrationJob, "id"> {
  const now = new Date().toISOString();
  return {
    type,
    label,
    status: options.scheduledAt && options.scheduledAt > now ? "queued" : "queued",
    priority: options.priority ?? "normal",
    tenantId: "default",
    payload,
    dependsOn: options.dependsOn ?? [],
    scheduledAt: options.scheduledAt ?? null,
    cronExpression: options.cronExpression ?? null,
    cronLabel: options.cronLabel ?? null,
    retryPolicy: options.retryPolicy ?? DEFAULT_RETRY_POLICY,
    retryCount: 0,
    nextRetryAt: null,
    lastError: null,
    startedAt: null,
    completedAt: null,
    durationMs: null,
    result: null,
    createdBy: options.createdBy ?? "system",
    createdAt: now,
    updatedAt: now,
  };
}

// ── Pre-built job templates ───────────────────────────────────────────────────
// Common job types the system creates internally.

export function makePipelineRunJob(
  definitionId: string,
  variables: Record<string, string>,
  adminUid: string,
  options: { priority?: JobPriority; scheduledAt?: string } = {}
): Omit<OrchestrationJob, "id"> {
  return createJobRecord(
    "pipeline_run",
    `Pipeline: ${definitionId}`,
    { definitionId, variables },
    { ...options, createdBy: adminUid }
  );
}

export function makeKnowledgeIngestJob(
  documentId: string | null,
  trigger: string,
  adminUid: string
): Omit<OrchestrationJob, "id"> {
  return createJobRecord(
    "knowledge_ingest",
    documentId ? `Re-index document: ${documentId}` : "Full knowledge re-index",
    { documentId, trigger },
    { priority: "low", createdBy: adminUid }
  );
}

export function makeBulkEmbedJob(createdBy = "system"): Omit<OrchestrationJob, "id"> {
  return createJobRecord(
    "bulk_embed",
    "Bulk embed: all stale knowledge documents",
    { maxAgeHours: 168 },
    {
      priority: "low",
      createdBy,
      retryPolicy: { maxRetries: 2, backoffMs: 30000, backoffMultiplier: 2, maxBackoffMs: 300000 },
    }
  );
}

export function makeToolExecuteJob(
  toolCallId: string,
  adminUid: string
): Omit<OrchestrationJob, "id"> {
  return createJobRecord(
    "tool_execute",
    `Execute tool call: ${toolCallId}`,
    { toolCallId },
    { priority: "normal", createdBy: adminUid, retryPolicy: NO_RETRY }
  );
}

// ── Queue management ──────────────────────────────────────────────────────────
// getDueJobs: returns jobs ready to run right now.
// Filters: status=queued, scheduledAt <= now, dependencies met.

export async function getDueJobs(
  db: FirebaseFirestore.Firestore,
  limit = 10
): Promise<OrchestrationJob[]> {
  const now = new Date().toISOString();

  const snap = await db
    .collection("orchestrationJobs")
    .where("status", "==", "queued")
    .where("tenantId", "==", "default")
    .orderBy("createdAt", "asc")
    .limit(limit * 3)   // fetch extra to filter by scheduledAt + deps
    .get();

  const jobs = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as OrchestrationJob);

  // Filter: scheduledAt must be in the past (or null)
  const schedulable = jobs.filter(
    (j) => j.scheduledAt === null || j.scheduledAt <= now
  );

  // Filter: all dependencies must be completed
  // (for performance, we skip dep-check if dependsOn is empty)
  const results: OrchestrationJob[] = [];
  for (const job of schedulable) {
    if (job.dependsOn.length === 0) {
      results.push(job);
    } else {
      const depDocs = await Promise.all(
        job.dependsOn.map((depId) =>
          db.collection("orchestrationJobs").doc(depId).get()
        )
      );
      const allComplete = depDocs.every(
        (d) => d.exists && d.data()?.status === "completed"
      );
      if (allComplete) {
        results.push(job);
      }
    }
    if (results.length >= limit) break;
  }

  // Sort by priority: critical > high > normal > low
  const priorityOrder: Record<JobPriority, number> = { critical: 0, high: 1, normal: 2, low: 3 };
  return results.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}

// ── State transitions ─────────────────────────────────────────────────────────
export async function markJobRunning(
  db: FirebaseFirestore.Firestore,
  jobId: string
): Promise<void> {
  await db.collection("orchestrationJobs").doc(jobId).update({
    status: "running",
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export async function markJobCompleted(
  db: FirebaseFirestore.Firestore,
  jobId: string,
  result: Record<string, unknown>,
  durationMs: number
): Promise<void> {
  const doc = await db.collection("orchestrationJobs").doc(jobId).get();
  const job = doc.data() as OrchestrationJob;
  const now = new Date().toISOString();

  const update: Record<string, unknown> = {
    status: "completed",
    completedAt: now,
    durationMs,
    result,
    updatedAt: now,
  };

  // If this is a cron job, re-queue it for next execution
  if (job?.cronExpression) {
    const nextRef = db.collection("orchestrationJobs").doc();
    await nextRef.set({
      ...createJobRecord(job.type, job.label, job.payload, {
        priority: job.priority,
        cronExpression: job.cronExpression ?? undefined,
        cronLabel: job.cronLabel ?? undefined,
        retryPolicy: job.retryPolicy,
        createdBy: "system",
      }),
    });
  }

  await db.collection("orchestrationJobs").doc(jobId).update(update);
}

export async function markJobFailed(
  db: FirebaseFirestore.Firestore,
  jobId: string,
  error: string,
  durationMs: number
): Promise<void> {
  const doc = await db.collection("orchestrationJobs").doc(jobId).get();
  if (!doc.exists) return;

  const job = doc.data() as OrchestrationJob;
  const now = new Date().toISOString();

  if (job.retryCount < job.retryPolicy.maxRetries) {
    // Schedule retry with exponential backoff
    const backoffMs = Math.min(
      job.retryPolicy.backoffMs * Math.pow(job.retryPolicy.backoffMultiplier, job.retryCount),
      job.retryPolicy.maxBackoffMs
    );
    const nextRetryAt = new Date(Date.now() + backoffMs).toISOString();

    await db.collection("orchestrationJobs").doc(jobId).update({
      status: "queued",
      retryCount: job.retryCount + 1,
      nextRetryAt,
      scheduledAt: nextRetryAt,
      lastError: error,
      updatedAt: now,
    });
  } else {
    await db.collection("orchestrationJobs").doc(jobId).update({
      status: "failed",
      completedAt: now,
      durationMs,
      lastError: error,
      updatedAt: now,
    });
  }
}

// ── Parallel execution planner ────────────────────────────────────────────────
// Given a list of pipeline steps, identify which can run in parallel.
// Steps without dependencies on each other's outputKeys can run simultaneously.
// Returns groups: [[step0, step1], [step2], [step3, step4]]
// where each group runs in parallel, groups run sequentially.

export interface StepDependencyGraph {
  stepId: string;
  dependsOnOutputKeys: string[];   // output keys this step reads via {{interpolation}}
}

export function planParallelExecution(
  steps: StepDependencyGraph[]
): StepDependencyGraph[][] {
  const groups: StepDependencyGraph[][] = [];
  const resolvedKeys = new Set<string>();

  const remaining = [...steps];

  while (remaining.length > 0) {
    // Collect all steps that can run now (deps resolved)
    const ready = remaining.filter((step) =>
      step.dependsOnOutputKeys.every((key) => resolvedKeys.has(key))
    );

    if (ready.length === 0) {
      // Circular dependency or misconfigured — add first remaining as solo
      groups.push([remaining[0]]);
      remaining.splice(0, 1);
    } else {
      groups.push(ready);
      for (const step of ready) {
        // After this group runs, its outputs are available
        resolvedKeys.add(step.stepId);
        remaining.splice(remaining.indexOf(step), 1);
      }
    }
  }

  return groups;
}

// ── Scheduled pipeline definitions ───────────────────────────────────────────
// Built-in recurring jobs for the ALL ACCESS platform.
// These are seeded once and re-queue themselves after each run.

export interface ScheduledPipelineConfig {
  id: string;
  label: string;
  cronExpression: string;
  cronLabel: string;
  jobType: JobType;
  payload: Record<string, unknown>;
  priority: JobPriority;
  enabled: boolean;
}

export const BUILT_IN_SCHEDULED_JOBS: ScheduledPipelineConfig[] = [
  {
    id: "weekly_bulk_embed",
    label: "Weekly Knowledge Re-index",
    cronExpression: "0 2 * * 0",   // Sunday 2 AM
    cronLabel: "Every Sunday at 2 AM",
    jobType: "bulk_embed",
    payload: { maxAgeHours: 168, trigger: "scheduled" },
    priority: "low",
    enabled: true,
  },
  {
    id: "daily_stale_check",
    label: "Daily Stale Document Check",
    cronExpression: "0 6 * * *",   // Every day 6 AM
    cronLabel: "Daily at 6 AM",
    jobType: "knowledge_ingest",
    payload: { documentId: null, trigger: "scheduled", maxAgeHours: 48 },
    priority: "low",
    enabled: true,
  },
];

// ── Job stats ─────────────────────────────────────────────────────────────────
export interface JobStats {
  total: number;
  byStatus: Record<JobStatus, number>;
  byType: Record<string, number>;
  avgDurationMs: number;
  failureRate: number;
  queueDepth: number;
}

export async function getJobStats(
  db: FirebaseFirestore.Firestore
): Promise<JobStats> {
  const snap = await db
    .collection("orchestrationJobs")
    .orderBy("createdAt", "desc")
    .limit(500)
    .get();

  const jobs = snap.docs.map((d) => d.data() as OrchestrationJob);

  const byStatus = {
    queued: 0, running: 0, completed: 0, failed: 0, cancelled: 0, waiting: 0,
  } as Record<JobStatus, number>;

  const byType: Record<string, number> = {};
  const durations: number[] = [];
  let failures = 0;

  for (const job of jobs) {
    byStatus[job.status] = (byStatus[job.status] ?? 0) + 1;
    byType[job.type] = (byType[job.type] ?? 0) + 1;
    if (job.durationMs) durations.push(job.durationMs);
    if (job.status === "failed") failures++;
  }

  const avgDurationMs = durations.length > 0
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;

  const completedAndFailed = (byStatus.completed ?? 0) + failures;
  const failureRate = completedAndFailed > 0
    ? Math.round((failures / completedAndFailed) * 100)
    : 0;

  return {
    total: snap.size,
    byStatus,
    byType,
    avgDurationMs,
    failureRate,
    queueDepth: byStatus.queued ?? 0,
  };
}
