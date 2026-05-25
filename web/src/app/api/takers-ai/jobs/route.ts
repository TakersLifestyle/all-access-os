// Takers AI — Orchestration Job Queue API
//
// GET    /api/takers-ai/jobs              → list jobs (with optional filters)
// GET    /api/takers-ai/jobs?id=<id>      → single job
// GET    /api/takers-ai/jobs?stats=true   → job queue stats
// GET    /api/takers-ai/jobs?due=true     → jobs due for execution now
// POST   /api/takers-ai/jobs             → create a job
// PATCH  /api/takers-ai/jobs             → update status / run a job
//   actions: run | cancel | reset
// DELETE /api/takers-ai/jobs?id=<id>     → delete a job record
//
// Execution:
//   PATCH with { id, action: "run" } will dispatch the job synchronously.
//   For production scale, call with action: "run" from a Vercel Cron function:
//     Schedule: GET /api/takers-ai/jobs?due=true, then PATCH each with action: "run"
//
//   Cron function example (vercel.json):
//   { "crons": [{ "path": "/api/takers-ai/jobs/worker", "schedule": "*/5 * * * *" }] }
//   (Wire up /api/takers-ai/jobs/worker to call getDueJobs + dispatch)

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
} from "@/lib/takers-ai/orchestrator";
import { runIngestJob } from "@/lib/takers-ai/ingestion";
import { executeToolCall } from "@/lib/takers-ai/tools";
import type { ToolName } from "@/lib/takers-ai/tools";
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
  const id = searchParams.get("id");
  const showStats = searchParams.get("stats") === "true";
  const showDue = searchParams.get("due") === "true";
  const status = searchParams.get("status");
  const type = searchParams.get("type");
  const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 200);
  const db = adminDb();

  if (id) {
    const doc = await db.collection("orchestrationJobs").doc(id).get();
    if (!doc.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ job: { id: doc.id, ...doc.data() } });
  }

  if (showStats) {
    const stats = await getJobStats(db);
    return NextResponse.json(stats);
  }

  if (showDue) {
    const dueJobs = await getDueJobs(db, 20);
    return NextResponse.json({ jobs: dueJobs, total: dueJobs.length });
  }

  // List jobs with optional filters
  let query: FirebaseFirestore.Query = db
    .collection("orchestrationJobs")
    .orderBy("createdAt", "desc")
    .limit(limit);

  if (status) query = query.where("status", "==", status);
  if (type) query = query.where("type", "==", type);

  const snap = await query.get();
  const jobs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return NextResponse.json({ jobs, total: snap.size });
}

// ── POST: Create a job ────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    type,
    label,
    payload = {},
    priority,
    scheduledAt,
    cronExpression,
    cronLabel,
    dependsOn,
    // Convenience shortcuts
    definitionId,          // for pipeline_run
    variables,             // for pipeline_run
    documentId,            // for knowledge_ingest
    toolCallId,            // for tool_execute
  } = body as {
    type: JobType;
    label?: string;
    payload?: Record<string, unknown>;
    priority?: JobPriority;
    scheduledAt?: string;
    cronExpression?: string;
    cronLabel?: string;
    dependsOn?: string[];
    definitionId?: string;
    variables?: Record<string, string>;
    documentId?: string;
    toolCallId?: string;
  };

  if (!type) return NextResponse.json({ error: "type required." }, { status: 400 });

  const db = adminDb();
  let jobData: Omit<import("@/lib/takers-ai/orchestrator").OrchestrationJob, "id">;

  // Use convenience builders for common types
  if (type === "pipeline_run" && definitionId) {
    jobData = makePipelineRunJob(definitionId, variables ?? {}, decoded.uid, {
      priority: priority ?? "normal",
      scheduledAt,
    });
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
      priority,
      scheduledAt,
      cronExpression,
      cronLabel,
      dependsOn,
      createdBy: decoded.uid,
    });
  }

  const ref = db.collection("orchestrationJobs").doc();
  await ref.set(jobData);

  return NextResponse.json({ id: ref.id, ...jobData }, { status: 201 });
}

// ── PATCH: Run / cancel / reset a job ────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, action } = body as { id: string; action: "run" | "cancel" | "reset" };

  if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });

  const db = adminDb();
  const jobDoc = await db.collection("orchestrationJobs").doc(id).get();
  if (!jobDoc.exists) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const job = jobDoc.data()!;

  if (action === "cancel") {
    if (job.status === "running") {
      return NextResponse.json({ error: "Cannot cancel a running job." }, { status: 400 });
    }
    await db.collection("orchestrationJobs").doc(id).update({
      status: "cancelled",
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return NextResponse.json({ success: true, status: "cancelled" });
  }

  if (action === "reset") {
    // Reset failed/cancelled job back to queued
    await db.collection("orchestrationJobs").doc(id).update({
      status: "queued",
      retryCount: 0,
      lastError: null,
      nextRetryAt: null,
      scheduledAt: null,
      startedAt: null,
      completedAt: null,
      durationMs: null,
      result: null,
      updatedAt: new Date().toISOString(),
    });
    return NextResponse.json({ success: true, status: "queued" });
  }

  if (action === "run") {
    if (job.status !== "queued") {
      return NextResponse.json({
        error: `Job status is "${job.status}" — only "queued" jobs can be run.`,
      }, { status: 400 });
    }

    const startedAt = Date.now();
    await markJobRunning(db, id);

    try {
      let result: Record<string, unknown> = {};

      switch (job.type as JobType) {
        case "knowledge_ingest": {
          const ingestResult = await runIngestJob(db, job.payload.ingestJobId as string ?? id);
          result = { ...ingestResult };
          break;
        }

        case "bulk_embed": {
          // Create and run an ingest job for all docs
          const { createIngestJobRecord, runIngestJob: runJob } = await import("@/lib/takers-ai/ingestion");
          const ingestData = createIngestJobRecord(null, null, "reindex_all", "system");
          const ingestRef = db.collection("ingestJobs").doc();
          await ingestRef.set(ingestData);
          const bulkResult = await runJob(db, ingestRef.id);
          result = { ingestJobId: ingestRef.id, ...bulkResult };
          break;
        }

        case "tool_execute": {
          const toolCallId = job.payload.toolCallId as string;
          const toolDoc = await db.collection("toolCalls").doc(toolCallId).get();
          if (!toolDoc.exists) throw new Error("Tool call not found");
          const toolCall = toolDoc.data()!;
          if (toolCall.status !== "approved") throw new Error("Tool call not approved");

          const toolResult = await executeToolCall(
            toolCall.tool as ToolName,
            toolCall.inputs as Record<string, unknown>
          );
          await db.collection("toolCalls").doc(toolCallId).update({
            status: toolResult.success ? "completed" : "failed",
            output: toolResult.output,
            outputSummary: toolResult.summary,
            executedAt: new Date().toISOString(),
          });
          result = toolResult;
          break;
        }

        case "pipeline_run": {
          // Delegate to pipeline-runs API via direct Firestore (avoids HTTP round-trip)
          result = {
            note: "Pipeline runs are dispatched via POST /api/takers-ai/pipeline-runs",
            definitionId: job.payload.definitionId,
            variables: job.payload.variables,
          };
          break;
        }

        default: {
          result = { note: `Job type "${job.type}" executed. Implement handler as needed.` };
        }
      }

      const durationMs = Date.now() - startedAt;
      await markJobCompleted(db, id, result, durationMs);

      return NextResponse.json({
        success: true,
        id,
        status: "completed",
        durationMs,
        result,
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      const durationMs = Date.now() - startedAt;
      await markJobFailed(db, id, error, durationMs);

      const finalDoc = await db.collection("orchestrationJobs").doc(id).get();
      return NextResponse.json({
        success: false,
        id,
        status: finalDoc.data()?.status,
        error,
        durationMs,
      }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Unknown action. Use: run | cancel | reset" }, { status: 400 });
}

// ── DELETE ────────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });

  await adminDb().collection("orchestrationJobs").doc(id).delete();
  return NextResponse.json({ success: true });
}
