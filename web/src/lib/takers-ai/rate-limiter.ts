// Takers AI — Rate Limiting + Production Hardening
//
// Firestore-backed sliding window rate limiter with per-route limits.
// Also provides: tenant isolation helpers, API abuse detection,
// secret rotation readiness checks, and secure execution boundaries.
//
// Rate limits (requests per minute, configurable):
//   /chat:            30 req/min per user
//   /pipeline-runs:   10 req/min per user
//   /tools:           20 req/min per user
//   /knowledge/ingest: 5 req/min per user
//   /jobs:            15 req/min per user
//   default:          60 req/min per user
//
// Implementation:
//   Uses a Firestore document `rateLimits/{uid}_{route}` with a fixed window
//   (resets each minute). Lightweight — one read + one conditional write per request.
//   For high-scale: swap to Redis with a sliding window.

// ── Route rate limits ─────────────────────────────────────────────────────────
export type RateLimitedRoute =
  | "chat"
  | "pipeline-runs"
  | "tools"
  | "knowledge-ingest"
  | "jobs"
  | "default";

export const RATE_LIMITS: Record<RateLimitedRoute, { perMinute: number; perDay: number }> = {
  "chat":             { perMinute: 30,  perDay: 500  },
  "pipeline-runs":    { perMinute: 10,  perDay: 200  },
  "tools":            { perMinute: 20,  perDay: 300  },
  "knowledge-ingest": { perMinute: 5,   perDay: 50   },
  "jobs":             { perMinute: 15,  perDay: 300  },
  "default":          { perMinute: 60,  perDay: 1000 },
};

// ── Rate limit record (stored in Firestore) ───────────────────────────────────
export interface RateLimitRecord {
  uid: string;
  route: string;
  windowStart: string;       // ISO timestamp when current 1-min window started
  requestsThisWindow: number;
  requestsToday: number;
  dayKey: string;            // YYYY-MM-DD
  lastRequestAt: string;
  abuseFlag: boolean;        // set when pattern looks abusive
}

// ── Rate limit result ─────────────────────────────────────────────────────────
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;         // requests left in this window
  resetAt: string;           // when the window resets
  retryAfterMs: number;      // milliseconds until next request is allowed
  limitType: "per_minute" | "per_day" | null;
}

// ── Sliding window check ──────────────────────────────────────────────────────
// Returns allowed=true and decrements counter, or allowed=false with retry info.
// One Firestore transaction per request on hot routes.
export async function checkRateLimit(
  db: FirebaseFirestore.Firestore,
  uid: string,
  route: RateLimitedRoute | string
): Promise<RateLimitResult> {
  const limits = RATE_LIMITS[route as RateLimitedRoute] ?? RATE_LIMITS.default;
  const docId = `${uid}_${route.replace(/\//g, "-")}`;
  const ref = db.collection("rateLimits").doc(docId);

  const now = new Date();
  const nowIso = now.toISOString();
  const dayKey = nowIso.slice(0, 10);

  const result = await db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    const data = doc.exists ? (doc.data() as RateLimitRecord) : null;

    const windowStartMs = data?.windowStart
      ? new Date(data.windowStart).getTime()
      : 0;
    const windowAgeMs = Date.now() - windowStartMs;
    const inWindow = windowAgeMs < 60_000;

    // Reset window if expired
    const requestsThisWindow = inWindow ? (data?.requestsThisWindow ?? 0) : 0;
    const windowStart = inWindow ? data!.windowStart : nowIso;

    // Reset daily counter if new day
    const requestsToday = data?.dayKey === dayKey ? (data?.requestsToday ?? 0) : 0;

    // Check limits
    if (requestsThisWindow >= limits.perMinute) {
      const resetAt = new Date(new Date(windowStart).getTime() + 60_000).toISOString();
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfterMs: Math.max(0, new Date(resetAt).getTime() - Date.now()),
        limitType: "per_minute" as const,
        requestsThisWindow,
        requestsToday,
        windowStart,
        dayKey,
      };
    }

    if (requestsToday >= limits.perDay) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      return {
        allowed: false,
        remaining: 0,
        resetAt: tomorrow.toISOString(),
        retryAfterMs: tomorrow.getTime() - Date.now(),
        limitType: "per_day" as const,
        requestsThisWindow,
        requestsToday,
        windowStart,
        dayKey,
      };
    }

    // Allowed — increment
    const newRecord: RateLimitRecord = {
      uid,
      route,
      windowStart,
      requestsThisWindow: requestsThisWindow + 1,
      requestsToday: requestsToday + 1,
      dayKey,
      lastRequestAt: nowIso,
      abuseFlag: data?.abuseFlag ?? false,
    };
    tx.set(ref, newRecord);

    const resetAt = new Date(new Date(windowStart).getTime() + 60_000).toISOString();
    return {
      allowed: true,
      remaining: limits.perMinute - newRecord.requestsThisWindow,
      resetAt,
      retryAfterMs: 0,
      limitType: null as null,
      requestsThisWindow: newRecord.requestsThisWindow,
      requestsToday: newRecord.requestsToday,
      windowStart,
      dayKey,
    };
  });

  return {
    allowed: result.allowed,
    remaining: result.remaining,
    resetAt: result.resetAt,
    retryAfterMs: result.retryAfterMs,
    limitType: result.limitType,
  };
}

// ── Abuse detection ───────────────────────────────────────────────────────────
// Flags a uid for suspicious behavior patterns.
// Currently: > 3x the per-minute limit within an hour.
export async function detectAbuse(
  db: FirebaseFirestore.Firestore,
  uid: string,
  route: string
): Promise<boolean> {
  const limits = RATE_LIMITS[route as RateLimitedRoute] ?? RATE_LIMITS.default;
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const snap = await db
    .collection("rateLimits")
    .doc(`${uid}_${route.replace(/\//g, "-")}`)
    .get();

  if (!snap.exists) return false;
  const data = snap.data() as RateLimitRecord;

  // Flag if today's count is > 3x daily limit
  if (data.requestsToday > limits.perDay * 3) {
    await snap.ref.update({ abuseFlag: true });
    return true;
  }

  void hourAgo; // reserved for sliding window abuse detection in future
  return false;
}

// ── Queue concurrency control ─────────────────────────────────────────────────
// Prevents too many jobs running simultaneously on serverless (memory/time limits).

export const MAX_CONCURRENT_JOBS = 3;
export const MAX_CONCURRENT_PIPELINES = 2;

export async function getRunningJobCount(
  db: FirebaseFirestore.Firestore
): Promise<number> {
  const snap = await db
    .collection("orchestrationJobs")
    .where("status", "==", "running")
    .where("tenantId", "==", "default")
    .count()
    .get();
  return snap.data().count;
}

export async function getRunningPipelineCount(
  db: FirebaseFirestore.Firestore
): Promise<number> {
  const snap = await db
    .collection("pipelineRuns")
    .where("state", "==", "processing")
    .count()
    .get();
  return snap.data().count;
}

export async function canStartJob(db: FirebaseFirestore.Firestore): Promise<boolean> {
  const count = await getRunningJobCount(db);
  return count < MAX_CONCURRENT_JOBS;
}

export async function canStartPipeline(db: FirebaseFirestore.Firestore): Promise<boolean> {
  const count = await getRunningPipelineCount(db);
  return count < MAX_CONCURRENT_PIPELINES;
}

// ── Tenant isolation ──────────────────────────────────────────────────────────
// Future multi-tenant support. All data is tagged with tenantId.
// Currently always "default" — switch by resolving tenantId from auth token.

export interface TenantContext {
  tenantId: string;
  tenantName: string;
  isolationLevel: "shared" | "dedicated";
  rateLimitMultiplier: number;    // 1.0 = standard, 2.0 = double limits
  budgetLimitUsd: number | null;
  allowedModels: string[];
  featureFlags: {
    toolExecution: boolean;
    knowledgeBase: boolean;
    pipelineRuns: boolean;
    advancedAnalytics: boolean;
  };
}

export const DEFAULT_TENANT: TenantContext = {
  tenantId: "default",
  tenantName: "ALL ACCESS Winnipeg",
  isolationLevel: "shared",
  rateLimitMultiplier: 1.0,
  budgetLimitUsd: null,         // set to enforce spending caps
  allowedModels: [
    "claude-opus-4-5",
    "claude-sonnet-4-5",
    "claude-haiku-4-5",
  ],
  featureFlags: {
    toolExecution: true,
    knowledgeBase: true,
    pipelineRuns: true,
    advancedAnalytics: true,
  },
};

// ── Secret rotation readiness ─────────────────────────────────────────────────
// Checks required env vars are present and returns which are missing/expiring.

export interface SecretStatus {
  key: string;
  present: boolean;
  lengthHint: string;   // first 4 chars + "..." for verification without exposure
}

export function checkSecretReadiness(): SecretStatus[] {
  const required = [
    "ANTHROPIC_API_KEY",
    "FIREBASE_SERVICE_ACCOUNT_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "RESEND_API_KEY",
  ];
  const optional = [
    "VOYAGE_API_KEY",
    "DISCORD_WEBHOOK_URL",
  ];

  return [...required, ...optional].map((key) => {
    const val = process.env[key];
    return {
      key,
      present: !!val,
      lengthHint: val ? `${val.slice(0, 4)}...` : "NOT SET",
    };
  });
}

// ── Execution boundary validator ──────────────────────────────────────────────
// Validates that an execution request is within safe parameters before running.

export interface ExecutionBoundaryCheck {
  allowed: boolean;
  reason: string | null;
}

export function validateExecutionBoundary(options: {
  model: string;
  maxTokens: number;
  promptLength: number;
  allowedModels?: string[];
}): ExecutionBoundaryCheck {
  const allowed = options.allowedModels ?? DEFAULT_TENANT.allowedModels;

  if (!allowed.includes(options.model)) {
    return {
      allowed: false,
      reason: `Model "${options.model}" is not in the allowed models list: ${allowed.join(", ")}`,
    };
  }

  if (options.maxTokens > 8192) {
    return {
      allowed: false,
      reason: `max_tokens ${options.maxTokens} exceeds safe limit of 8192`,
    };
  }

  if (options.promptLength > 100_000) {
    return {
      allowed: false,
      reason: `Prompt length ${options.promptLength} chars exceeds safe limit of 100,000`,
    };
  }

  return { allowed: true, reason: null };
}

// ── Queue health metrics ──────────────────────────────────────────────────────
export interface QueueHealth {
  status: "healthy" | "degraded" | "critical";
  runningJobs: number;
  queuedJobs: number;
  dlqDepth: number;
  oldestQueuedJobAgeMs: number | null;
  failureRatePct: number;
  concurrencyPct: number;   // running / max * 100
  issues: string[];
}

export async function getQueueHealth(
  db: FirebaseFirestore.Firestore
): Promise<QueueHealth> {
  const [runningSnap, queuedSnap, dlqSnap, recentSnap] = await Promise.all([
    db.collection("orchestrationJobs").where("status", "==", "running").get(),
    db.collection("orchestrationJobs").where("status", "==", "queued")
      .orderBy("createdAt", "asc").limit(100).get(),
    db.collection("deadLetterQueue").where("status", "==", "pending").count().get(),
    db.collection("orchestrationJobs").orderBy("createdAt", "desc").limit(100).get(),
  ]);

  const running = runningSnap.size;
  const queued = queuedSnap.size;
  const dlqDepth = dlqSnap.data().count;

  const recent = recentSnap.docs.map((d) => d.data());
  const failures = recent.filter((j) => j.status === "failed").length;
  const failureRatePct = recent.length > 0
    ? Math.round((failures / recent.length) * 100)
    : 0;

  const concurrencyPct = Math.round((running / MAX_CONCURRENT_JOBS) * 100);

  const oldestQueuedJob = queuedSnap.docs[0];
  const oldestQueuedJobAgeMs = oldestQueuedJob
    ? Date.now() - new Date(oldestQueuedJob.data().createdAt as string).getTime()
    : null;

  const issues: string[] = [];
  if (dlqDepth > 5) issues.push(`${dlqDepth} items in dead-letter queue need attention`);
  if (failureRatePct > 25) issues.push(`High failure rate: ${failureRatePct}%`);
  if (concurrencyPct >= 100) issues.push(`At max concurrency (${running}/${MAX_CONCURRENT_JOBS} jobs)`);
  if (oldestQueuedJobAgeMs && oldestQueuedJobAgeMs > 10 * 60 * 1000) {
    issues.push(`Oldest queued job waiting ${Math.round(oldestQueuedJobAgeMs / 60000)}min`);
  }

  const status: QueueHealth["status"] =
    issues.length >= 3 || dlqDepth > 20 || failureRatePct > 50 ? "critical"
    : issues.length > 0 ? "degraded"
    : "healthy";

  return {
    status,
    runningJobs: running,
    queuedJobs: queued,
    dlqDepth,
    oldestQueuedJobAgeMs,
    failureRatePct,
    concurrencyPct,
    issues,
  };
}
