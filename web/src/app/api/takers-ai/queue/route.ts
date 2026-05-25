// Takers AI — Queue Management API
//
// GET  /api/takers-ai/queue                    → queue overview (all statuses)
// GET  /api/takers-ai/queue?status=<s>         → filter by status
// GET  /api/takers-ai/queue?priority=<p>       → filter by priority
// GET  /api/takers-ai/queue?type=<t>           → filter by job type
// GET  /api/takers-ai/queue?stats=true         → queue stats + health
// GET  /api/takers-ai/queue?due=true           → jobs ready to run now
// GET  /api/takers-ai/queue?scheduled=true     → all cron/scheduled jobs
// GET  /api/takers-ai/queue?id=<jobId>         → single job detail
// POST /api/takers-ai/queue                    → enqueue a new job
// PATCH /api/takers-ai/queue?action=<a>        → run|cancel|reset|reprioritize|drain
// DELETE /api/takers-ai/queue?id=<jobId>       → remove a queued job

import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import {
  createJobRecord,
  makePipelineRunJob,
  makeKnowledgeIngestJob,
  makeBulkEmbedJob,
  makeToolExecuteJob,
  getDueJobs,
  markJobRunning,
  markJobCompleted,
  markJobFailed,
  getJobStats,
  BUILT_IN_SCHEDULED_JOBS,
} from "@/lib/takers-ai/orchestrator";
import {
  canStartJob,
  getQueueHealth,
  MAX_CONCURRENT_JOBS,
} from "@/lib/takers-ai/rate-limiter";
import { classifyFailure } from "@/lib/takers-ai/reliability";
import type { JobType, JobPriority } from "@/lib/takers-ai/orchestrator";

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
  const jobId       = searchParams.get("id");
  const status      = searchParams.get("status");
  const priority    = searchParams.get("priority");
  const type        = searchParams.get("type");
  const showStats   = searchParams.get("stats") === "true";
  const showDue     = searchParams.get("due") === "true";
  const showScheduled = searchParams.get("scheduled") === "true";
  const limit       = Math.min(Number(searchParams.get("limit") ?? "100"), 500);
  const db          = adminDb();

  // Single job
  if (jobId) {
    const doc = await db.collection("orchestrationJobs").doc(jobId).get();
    if (!doc.exists) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    return NextResponse.json({ job: { id: doc.id, ...doc.data() } });
  }

  // Stats + health
  if (showStats) {
    const [stats, health] = await Promise.all([
      getJobStats(db),
      getQueueHealth(db),
    ]);
    return NextResponse.json({
      stats,
      health,
      concurrency: {
        maxConcurrentJobs: MAX_CONCURRENT_JOBS,
        runningJobs: health.runningJobs,
        utilizationPct: health.concurrencyPct,
      },
      builtInSchedules: BUILT_IN_SCHEDULED_JOBS.map((j) => ({
        id: j.id,
        label: j.label,
        jobType: j.jobType,
        cronExpression: j.cronExpression,
        cronLabel: j.cronLabel,
        priority: j.priority,
        enabled: j.enabled,
      })),
    });
  }

  // Jobs due now (ready to execute)
  if (showDue) {
    const jobs = await getDueJobs(db, limit);
    const canStart = await canStartJob(db);
    return NextResponse.json({ jobs, canStartJob: canStart, total: jobs.length });
  }

  // Scheduled / cron jobs
  if (showScheduled) {
    const snap = await db
      .collection("orchestrationJobs")
      .where("cronExpression", "!=", null)
      .orderBy("cronExpression")
      .limit(limit)
      .get();
    const jobs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ jobs, total: snap.size });
  }

  // Filtered list
  let query: FirebaseFirestore.Query = db.collection("orchestrationJobs");

  if (status)   query = query.where("status", "==", status);
  if (priority) query = query.where("priority", "==", priority);
  if (type)     query = query.where("type", "==", type);

  const snap = await query.orderBy("createdAt", "desc").limit(limit).get();
  const jobs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return NextResponse.json({ jobs, total: snap.size });
}

// ── POST: Enqueue a job ───────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    type,
    label,
    priority = "normal",
    payload = {},
    dependsOn = [],
    scheduledAt,
    cronExpression,
    cronLabel,
    // Shortcut builders
    definitionId,
    variables = {},
    documentId,
    toolCallId,
  } = body as {
    type: JobType;
    label?: string;
    priority?: JobPriority;
    payload?: Record<string, unknown>;
    dependsOn?: string[];
    scheduledAt?: string;
    cronExpression?: string;
    cronLabel?: string;
    // shortcuts
    definitionId?: string;
    variables?: Record<string, string>;
    documentId?: string;
    toolCallId?: string;
  };

  if (!type) {
    return NextResponse.json({ error: "type required." }, { status: 400 });
  }

  const validTypes: JobType[] = [
    "pipeline_run", "knowledge_ingest", "bulk_embed", "tool_execute", "scheduled_chat",
  ];
  if (!validTypes.includes(type)) {
    return NextResponse.json({
      error: `Invalid type. Valid: ${validTypes.join(", ")}`,
    }, { status: 400 });
  }

  const db = adminDb();
  let jobData;

  // Use convenience builders when possible
  if (type === "pipeline_run" && definitionId) {
    jobData = makePipelineRunJob(definitionId, variables, decoded.uid, { priority: priority as JobPriority, scheduledAt });
  } else if (type === "knowledge_ingest") {
    jobData = makeKnowledgeIngestJob(documentId ?? null, "manual", decoded.uid);
  } else if (type === "bulk_embed") {
    jobData = makeBulkEmbedJob(decoded.uid);
  } else if (type === "tool_execute" && toolCallId) {
    jobData = makeToolExecuteJob(toolCallId, decoded.uid);
  } else {
    // Generic job
    if (!label) {
      return NextResponse.json({ error: "label required for custom job type." }, { status: 400 });
    }
    jobData = createJobRecord(type, label, payload, {
      priority: priority as JobPriority,
      dependsOn,
      scheduledAt,
      cronExpression,
      cronLabel,
      createdBy: decoded.uid,
    });
  }

  const ref = db.collection("orchestrationJobs").doc();
  await ref.set(jobData);

  return NextResponse.json({
    id: ref.id,
    type: jobData.type,
    priority: jobData.priority,
    status: jobData.status,
    scheduledAt: jobData.scheduledAt,
    success: true,
  }, { status: 201 });
}

// ── PATCH: Queue control actions ──────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  const body = await req.json();
  const db = adminDb();

  // ── Run: attempt to start a queued job ─────────────────────────────────────
  if (action === "run") {
    const { id } = body as { id: string };
    if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });

    const canStart = await canStartJob(db);
    if (!canStart) {
      return NextResponse.json({
        error: `At max concurrency (${MAX_CONCURRENT_JOBS} jobs). Wait for a slot.`,
        canStartJob: false,
      }, { status: 429 });
    }

    const doc = await db.collection("orchestrationJobs").doc(id).get();
    if (!doc.exists) return NextResponse.json({ error: "Job not found." }, { status: 404 });

    const job = doc.data()!;
    if (job.status !== "queued") {
      return NextResponse.json({
        error: `Job is ${job.status}, not queued. Only queued jobs can be started.`,
      }, { status: 409 });
    }

    await markJobRunning(db, id);
    return NextResponse.json({ success: true, status: "running", id });
  }

  // ── Cancel: stop a queued or running job ────────────────────────────────────
  if (action === "cancel") {
    const { id, reason } = body as { id: string; reason?: string };
    if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });

    const doc = await db.collection("orchestrationJobs").doc(id).get();
    if (!doc.exists) return NextResponse.json({ error: "Job not found." }, { status: 404 });

    const job = doc.data()!;
    if (!["queued", "running"].includes(job.status)) {
      return NextResponse.json({
        error: `Job is ${job.status}. Only queued/running jobs can be cancelled.`,
      }, { status: 409 });
    }

    await doc.ref.update({
      status: "cancelled",
      cancelledAt: new Date().toISOString(),
      cancelledBy: decoded.uid,
      cancelReason: reason ?? "Manually cancelled by admin",
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, status: "cancelled", id });
  }

  // ── Reset: move a failed/cancelled job back to queued ──────────────────────
  if (action === "reset") {
    const { id } = body as { id: string };
    if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });

    const doc = await db.collection("orchestrationJobs").doc(id).get();
    if (!doc.exists) return NextResponse.json({ error: "Job not found." }, { status: 404 });

    const job = doc.data()!;
    if (!["failed", "cancelled"].includes(job.status)) {
      return NextResponse.json({
        error: `Job is ${job.status}. Only failed/cancelled jobs can be reset.`,
      }, { status: 409 });
    }

    await doc.ref.update({
      status: "queued",
      retryCount: 0,
      lastError: null,
      startedAt: null,
      completedAt: null,
      result: null,
      scheduledAt: null,
      cancelledAt: null,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, status: "queued", id });
  }

  // ── Reprioritize: change priority of a queued job ──────────────────────────
  if (action === "reprioritize") {
    const { id, priority } = body as { id: string; priority: JobPriority };
    if (!id || !priority) {
      return NextResponse.json({ error: "id and priority required." }, { status: 400 });
    }

    const validPriorities: JobPriority[] = ["critical", "high", "normal", "low"];
    if (!validPriorities.includes(priority)) {
      return NextResponse.json({
        error: `Invalid priority. Valid: ${validPriorities.join(", ")}`,
      }, { status: 400 });
    }

    const doc = await db.collection("orchestrationJobs").doc(id).get();
    if (!doc.exists) return NextResponse.json({ error: "Job not found." }, { status: 404 });

    const job = doc.data()!;
    if (job.status !== "queued") {
      return NextResponse.json({
        error: `Job is ${job.status}. Only queued jobs can be reprioritized.`,
      }, { status: 409 });
    }

    await doc.ref.update({ priority, updatedAt: new Date().toISOString() });
    return NextResponse.json({ success: true, priority, id });
  }

  // ── Drain: cancel all queued jobs (emergency stop) ─────────────────────────
  if (action === "drain") {
    const { reason, type: jobType } = body as { reason?: string; type?: string };

    let query: FirebaseFirestore.Query = db
      .collection("orchestrationJobs")
      .where("status", "==", "queued");

    if (jobType) query = query.where("type", "==", jobType);

    const snap = await query.limit(500).get();
    if (snap.empty) {
      return NextResponse.json({ success: true, drained: 0, message: "Queue already empty." });
    }

    const batch = db.batch();
    const now = new Date().toISOString();
    snap.docs.forEach((d) => {
      batch.update(d.ref, {
        status: "cancelled",
        cancelledAt: now,
        cancelledBy: decoded.uid,
        cancelReason: reason ?? "Queue drained by admin",
        updatedAt: now,
      });
    });
    await batch.commit();

    return NextResponse.json({
      success: true,
      drained: snap.size,
      message: `Drained ${snap.size} queued job(s).`,
    });
  }

  // ── Complete (manual finish for stuck running jobs) ─────────────────────────
  if (action === "complete") {
    const { id, result } = body as { id: string; result?: Record<string, unknown> };
    if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });

    await markJobCompleted(db, id, result ?? { manuallyCompleted: true, by: decoded.uid }, 0);
    return NextResponse.json({ success: true, status: "completed", id });
  }

  // ── Fail (manually fail a running job + classify error) ────────────────────
  if (action === "fail") {
    const { id, error: errorMsg } = body as { id: string; error?: string };
    if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });

    const doc = await db.collection("orchestrationJobs").doc(id).get();
    if (!doc.exists) return NextResponse.json({ error: "Job not found." }, { status: 404 });

    const classified = classifyFailure(errorMsg ?? "Manually failed by admin");
    await markJobFailed(db, id, errorMsg ?? "Manually failed by admin", 0);

    return NextResponse.json({
      success: true,
      status: "failed",
      id,
      failureCode: classified.code,
      retryable: classified.retryable,
    });
  }

  return NextResponse.json({
    error: "Unknown action. Use: run | cancel | reset | reprioritize | drain | complete | fail",
  }, { status: 400 });
}

// ── DELETE: Remove a queued job ───────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });

  const db = adminDb();
  const doc = await db.collection("orchestrationJobs").doc(id).get();
  if (!doc.exists) return NextResponse.json({ error: "Job not found." }, { status: 404 });

  const job = doc.data()!;
  if (job.status === "running") {
    return NextResponse.json({
      error: "Cannot delete a running job. Cancel it first.",
    }, { status: 409 });
  }

  await doc.ref.delete();
  return NextResponse.json({ success: true, deleted: id });
}
