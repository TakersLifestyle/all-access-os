// Takers AI — Reliability Layer
//
// Failure classification, dead-letter queue, timeout detection,
// recovery checkpoints, and workflow cancellation.
//
// Components:
//   1. FailureClassifier — categorizes errors for smart retry decisions
//   2. Dead-Letter Queue — final resting place for exhausted retries
//   3. Timeout Detector — finds stale running jobs/pipelines
//   4. CancellationToken — cooperative cancellation for long jobs
//   5. Circuit Breaker — per-service failure rate tracking
//   6. Recovery helpers — resume from checkpoint, partial completion

// ── Failure classification ────────────────────────────────────────────────────
export type FailureCode =
  | "transient"             // network blip, safe to retry immediately
  | "rate_limited"          // API rate limit, retry after backoff
  | "quota_exceeded"        // API quota exhausted, needs human intervention
  | "validation_error"      // schema validation failed, needs human review
  | "authentication_error"  // API key/token issue, critical
  | "not_found"             // missing resource (agent, definition, doc)
  | "configuration_error"   // misconfigured step/workflow
  | "timeout"               // execution exceeded time limit
  | "cancelled"             // manually cancelled
  | "dependency_failed"     // upstream step/job failed
  | "budget_exceeded"       // cost limit hit
  | "unknown";              // unclassified, needs human review

export interface ClassifiedFailure {
  code: FailureCode;
  message: string;
  originalError: string;
  retryable: boolean;
  immediateRetryOk: boolean;   // true = retry right away, false = use backoff
  requiresHuman: boolean;      // true = DLQ + alert
  suggestedAction: string;
}

// Classify an error message into a structured failure
export function classifyFailure(error: string): ClassifiedFailure {
  const lower = error.toLowerCase();

  // Rate limiting
  if (
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    lower.includes("429") ||
    lower.includes("overloaded")
  ) {
    return {
      code: "rate_limited",
      message: "API rate limit hit",
      originalError: error,
      retryable: true,
      immediateRetryOk: false,
      requiresHuman: false,
      suggestedAction: "Wait for backoff period, then retry automatically.",
    };
  }

  // Authentication
  if (
    lower.includes("api key") ||
    lower.includes("unauthorized") ||
    lower.includes("401") ||
    lower.includes("invalid key") ||
    lower.includes("authentication")
  ) {
    return {
      code: "authentication_error",
      message: "API key or authentication failure",
      originalError: error,
      retryable: false,
      immediateRetryOk: false,
      requiresHuman: true,
      suggestedAction: "Check ANTHROPIC_API_KEY and VOYAGE_API_KEY environment variables.",
    };
  }

  // Quota
  if (
    lower.includes("quota") ||
    lower.includes("billing") ||
    lower.includes("insufficient_quota") ||
    lower.includes("credit")
  ) {
    return {
      code: "quota_exceeded",
      message: "API quota or billing limit exceeded",
      originalError: error,
      retryable: false,
      immediateRetryOk: false,
      requiresHuman: true,
      suggestedAction: "Check API dashboard for quota/billing status.",
    };
  }

  // Not found
  if (
    lower.includes("not found") ||
    lower.includes("does not exist") ||
    lower.includes("404") ||
    lower.includes("no active agent found")
  ) {
    return {
      code: "not_found",
      message: "Required resource not found",
      originalError: error,
      retryable: false,
      immediateRetryOk: false,
      requiresHuman: true,
      suggestedAction: "Check agent configurations and workflow definitions.",
    };
  }

  // Validation
  if (
    lower.includes("validation") ||
    lower.includes("invalid") ||
    lower.includes("required field") ||
    lower.includes("schema")
  ) {
    return {
      code: "validation_error",
      message: "Output validation failed",
      originalError: error,
      retryable: true,
      immediateRetryOk: true,
      requiresHuman: false,
      suggestedAction: "Retry — AI may produce valid structured output on next attempt.",
    };
  }

  // Timeout
  if (
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("deadline") ||
    lower.includes("connection reset")
  ) {
    return {
      code: "timeout",
      message: "Execution timed out",
      originalError: error,
      retryable: true,
      immediateRetryOk: false,
      requiresHuman: false,
      suggestedAction: "Retry with exponential backoff. Check network stability.",
    };
  }

  // Network/transient
  if (
    lower.includes("econnreset") ||
    lower.includes("enotfound") ||
    lower.includes("network") ||
    lower.includes("socket") ||
    lower.includes("fetch failed") ||
    lower.includes("503") ||
    lower.includes("502")
  ) {
    return {
      code: "transient",
      message: "Transient network error",
      originalError: error,
      retryable: true,
      immediateRetryOk: true,
      requiresHuman: false,
      suggestedAction: "Retry immediately — transient network issue.",
    };
  }

  // Default: unknown
  return {
    code: "unknown",
    message: "Unclassified error",
    originalError: error,
    retryable: true,
    immediateRetryOk: false,
    requiresHuman: false,
    suggestedAction: "Review error details and retry with backoff.",
  };
}

// ── Dead-letter queue ─────────────────────────────────────────────────────────
// Items land here when retries are exhausted or when requiresHuman=true.
// Human operators resolve or resubmit from here.

export type DLQStatus =
  | "pending"      // needs human attention
  | "resolved"     // manually resolved
  | "resubmitted"  // sent back to queue
  | "discarded";   // deliberately dropped

export interface DLQItem {
  id: string;
  entityType: "orchestration_job" | "pipeline_run" | "tool_call" | "ingest_job";
  entityId: string;
  entityLabel: string;
  failureCode: FailureCode;
  failureMessage: string;
  originalError: string;
  retryCount: number;
  lastAttemptAt: string;
  status: DLQStatus;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolution: string | null;     // human's note on how it was resolved
  resubmittedJobId: string | null;
  payload: Record<string, unknown>; // full context for resubmission
  createdAt: string;
}

export function createDLQItem(
  entityType: DLQItem["entityType"],
  entityId: string,
  entityLabel: string,
  failure: ClassifiedFailure,
  retryCount: number,
  payload: Record<string, unknown>
): Omit<DLQItem, "id"> {
  return {
    entityType,
    entityId,
    entityLabel,
    failureCode: failure.code,
    failureMessage: failure.message,
    originalError: failure.originalError,
    retryCount,
    lastAttemptAt: new Date().toISOString(),
    status: "pending",
    resolvedBy: null,
    resolvedAt: null,
    resolution: null,
    resubmittedJobId: null,
    payload,
    createdAt: new Date().toISOString(),
  };
}

// ── Timeout detection ─────────────────────────────────────────────────────────
// Returns orchestration jobs or pipeline runs stuck in "running" state
// longer than the specified timeout.

export interface TimedOutEntity {
  id: string;
  type: "orchestration_job" | "pipeline_run";
  label: string;
  startedAt: string;
  runningForMs: number;
  currentState: string;
}

export async function detectTimedOutEntities(
  db: FirebaseFirestore.Firestore,
  jobTimeoutMs = 10 * 60 * 1000,       // 10 minutes for jobs
  pipelineTimeoutMs = 30 * 60 * 1000   // 30 minutes for pipeline runs
): Promise<TimedOutEntity[]> {
  const now = Date.now();
  const stale: TimedOutEntity[] = [];

  // Check orchestration jobs
  const jobsSnap = await db
    .collection("orchestrationJobs")
    .where("status", "==", "running")
    .get();

  for (const doc of jobsSnap.docs) {
    const job = doc.data();
    if (!job.startedAt) continue;
    const runningForMs = now - new Date(job.startedAt as string).getTime();
    if (runningForMs > jobTimeoutMs) {
      stale.push({
        id: doc.id,
        type: "orchestration_job",
        label: job.label as string,
        startedAt: job.startedAt as string,
        runningForMs,
        currentState: "running",
      });
    }
  }

  // Check pipeline runs
  const runsSnap = await db
    .collection("pipelineRuns")
    .where("state", "==", "processing")
    .get();

  for (const doc of runsSnap.docs) {
    const run = doc.data();
    if (!run.startedAt) continue;
    const runningForMs = now - new Date(run.startedAt as string).getTime();
    if (runningForMs > pipelineTimeoutMs) {
      stale.push({
        id: doc.id,
        type: "pipeline_run",
        label: run.definitionName as string,
        startedAt: run.startedAt as string,
        runningForMs,
        currentState: run.state as string,
      });
    }
  }

  return stale;
}

// Resolve timed-out entities: mark as failed + move to DLQ
export async function resolveTimedOutEntities(
  db: FirebaseFirestore.Firestore,
  entities: TimedOutEntity[]
): Promise<number> {
  let resolved = 0;

  for (const entity of entities) {
    try {
      const failure = classifyFailure("timeout: execution exceeded maximum allowed duration");
      const dlqData = createDLQItem(
        entity.type === "orchestration_job" ? "orchestration_job" : "pipeline_run",
        entity.id,
        entity.label,
        failure,
        0,
        { timedOutAfterMs: entity.runningForMs }
      );

      // Write DLQ entry
      await db.collection("deadLetterQueue").doc().set(dlqData);

      // Mark entity as failed
      if (entity.type === "orchestration_job") {
        await db.collection("orchestrationJobs").doc(entity.id).update({
          status: "failed",
          lastError: "Timeout: exceeded maximum execution duration",
          completedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } else {
        await db.collection("pipelineRuns").doc(entity.id).update({
          state: "failed",
          errorMessage: "Timeout: pipeline exceeded maximum execution duration",
          completedAt: new Date().toISOString(),
        });
      }

      resolved++;
    } catch (err) {
      console.error(`[reliability] Failed to resolve timeout for ${entity.id}:`, err);
    }
  }

  return resolved;
}

// ── Circuit breaker ───────────────────────────────────────────────────────────
// Tracks failure rates per external service. If failure rate > threshold,
// fast-fail new requests instead of hammering a degraded service.
// State stored in-memory (resets on cold start — acceptable for serverless).

interface CircuitBreakerState {
  failures: number;
  successes: number;
  lastFailureAt: number;
  state: "closed" | "open" | "half_open";
  openedAt: number | null;
}

const circuitBreakers = new Map<string, CircuitBreakerState>();

const FAILURE_THRESHOLD = 5;        // failures before opening
const SUCCESS_THRESHOLD = 2;        // successes in half-open to close
const OPEN_DURATION_MS = 60_000;    // 1 minute open before trying again

export function getCircuitBreaker(service: string): CircuitBreakerState {
  if (!circuitBreakers.has(service)) {
    circuitBreakers.set(service, {
      failures: 0,
      successes: 0,
      lastFailureAt: 0,
      state: "closed",
      openedAt: null,
    });
  }
  return circuitBreakers.get(service)!;
}

export function recordCircuitSuccess(service: string): void {
  const cb = getCircuitBreaker(service);
  cb.failures = Math.max(0, cb.failures - 1);
  cb.successes++;
  if (cb.state === "half_open" && cb.successes >= SUCCESS_THRESHOLD) {
    cb.state = "closed";
    cb.openedAt = null;
    cb.failures = 0;
    cb.successes = 0;
  }
}

export function recordCircuitFailure(service: string): boolean {
  const cb = getCircuitBreaker(service);
  cb.failures++;
  cb.lastFailureAt = Date.now();
  cb.successes = 0;

  if (cb.failures >= FAILURE_THRESHOLD && cb.state === "closed") {
    cb.state = "open";
    cb.openedAt = Date.now();
    console.warn(`[circuit-breaker] ${service} circuit OPENED after ${cb.failures} failures`);
    return true; // circuit opened
  }
  return false;
}

export function isCircuitOpen(service: string): boolean {
  const cb = getCircuitBreaker(service);
  if (cb.state === "closed") return false;
  if (cb.state === "open") {
    // Check if we should try half-open
    if (cb.openedAt && Date.now() - cb.openedAt > OPEN_DURATION_MS) {
      cb.state = "half_open";
      cb.successes = 0;
      return false;
    }
    return true;
  }
  return false; // half_open allows one attempt
}

// ── DLQ stats ─────────────────────────────────────────────────────────────────
export interface DLQStats {
  total: number;
  pending: number;
  resolved: number;
  resubmitted: number;
  discarded: number;
  byFailureCode: Record<FailureCode, number>;
  byEntityType: Record<string, number>;
  oldestPendingAt: string | null;
}

export async function getDLQStats(
  db: FirebaseFirestore.Firestore
): Promise<DLQStats> {
  const snap = await db
    .collection("deadLetterQueue")
    .orderBy("createdAt", "desc")
    .limit(500)
    .get();

  const items = snap.docs.map((d) => d.data() as DLQItem);
  const byCode: Record<string, number> = {};
  const byType: Record<string, number> = {};
  let pending = 0, resolved = 0, resubmitted = 0, discarded = 0;
  let oldestPendingAt: string | null = null;

  for (const item of items) {
    if (item.status === "pending") {
      pending++;
      if (!oldestPendingAt || item.createdAt < oldestPendingAt) {
        oldestPendingAt = item.createdAt;
      }
    } else if (item.status === "resolved") resolved++;
    else if (item.status === "resubmitted") resubmitted++;
    else if (item.status === "discarded") discarded++;

    byCode[item.failureCode] = (byCode[item.failureCode] ?? 0) + 1;
    byType[item.entityType] = (byType[item.entityType] ?? 0) + 1;
  }

  return {
    total: snap.size,
    pending,
    resolved,
    resubmitted,
    discarded,
    byFailureCode: byCode as Record<FailureCode, number>,
    byEntityType: byType,
    oldestPendingAt,
  };
}
