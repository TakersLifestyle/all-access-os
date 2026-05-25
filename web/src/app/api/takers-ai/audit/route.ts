// Takers AI — Audit Trail + Execution Trace + Replay API
//
// GET  /api/takers-ai/audit                          → list audit events
// GET  /api/takers-ai/audit?entityId=<id>            → events for entity
// GET  /api/takers-ai/audit?trace=<runId>            → full execution trace
// GET  /api/takers-ai/audit?timeline=<runId>         → timeline segments
// GET  /api/takers-ai/audit?checkpoint=<runId>       → latest checkpoint
// GET  /api/takers-ai/audit?dlq=true                 → dead-letter queue items
// GET  /api/takers-ai/audit?dlq=true&id=<id>         → single DLQ item
// POST /api/takers-ai/audit                          → write audit event (internal)
// POST /api/takers-ai/audit?action=replay            → replay a failed run
// PATCH /api/takers-ai/audit?action=resolve_dlq      → resolve a DLQ item
// PATCH /api/takers-ai/audit?action=resubmit_dlq     → resubmit DLQ item to queue

import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import {
  getExecutionTrace,
  buildTimeline,
  createReplayRun,
  getLatestCheckpoint,
  writeAuditEvent,
} from "@/lib/takers-ai/audit";
import { getDLQStats } from "@/lib/takers-ai/reliability";
import { isFirebaseAdmin } from "@/lib/takers-ai/rbac";

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
  const entityId = searchParams.get("entityId");
  const traceRunId = searchParams.get("trace");
  const timelineRunId = searchParams.get("timeline");
  const checkpointRunId = searchParams.get("checkpoint");
  const dlq = searchParams.get("dlq") === "true";
  const dlqId = searchParams.get("id");
  const dlqStats = searchParams.get("stats") === "true";
  const type = searchParams.get("type");
  const since = searchParams.get("since");
  const limit = Math.min(Number(searchParams.get("limit") ?? "100"), 500);
  const db = adminDb();

  // Execution trace
  if (traceRunId) {
    const trace = await getExecutionTrace(db, traceRunId);
    if (!trace) return NextResponse.json({ error: "Pipeline run not found" }, { status: 404 });
    return NextResponse.json({ trace });
  }

  // Timeline segments
  if (timelineRunId) {
    const trace = await getExecutionTrace(db, timelineRunId);
    if (!trace) return NextResponse.json({ error: "Pipeline run not found" }, { status: 404 });
    const timeline = buildTimeline(trace);
    return NextResponse.json({ timeline, runId: timelineRunId });
  }

  // Latest checkpoint
  if (checkpointRunId) {
    const checkpoint = await getLatestCheckpoint(db, checkpointRunId);
    return NextResponse.json({ checkpoint });
  }

  // DLQ items
  if (dlq) {
    if (dlqStats) {
      const stats = await getDLQStats(db);
      return NextResponse.json(stats);
    }

    if (dlqId) {
      const doc = await db.collection("deadLetterQueue").doc(dlqId).get();
      if (!doc.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ item: { id: doc.id, ...doc.data() } });
    }

    let query: FirebaseFirestore.Query = db
      .collection("deadLetterQueue")
      .orderBy("createdAt", "desc")
      .limit(limit);

    const status = searchParams.get("status");
    if (status) query = query.where("status", "==", status);

    const snap = await query.get();
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ items, total: snap.size });
  }

  // Events for a specific entity
  if (entityId) {
    let query: FirebaseFirestore.Query = db
      .collection("auditEvents")
      .where("entityId", "==", entityId)
      .orderBy("createdAt", "asc");

    if (type) query = query.where("type", "==", type);

    const snap = await query.limit(limit).get();
    const events = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ events, total: snap.size });
  }

  // List all events (admin audit feed)
  let query: FirebaseFirestore.Query = db
    .collection("auditEvents")
    .orderBy("createdAt", "desc")
    .limit(limit);

  if (type) query = query.where("type", "==", type);
  if (since) query = query.where("createdAt", ">=", since);

  const snap = await query.get();
  const events = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return NextResponse.json({ events, total: snap.size });
}

// ── POST: Write event or trigger replay ───────────────────────────────────────
export async function POST(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  const db = adminDb();

  if (action === "replay") {
    const body = await req.json();
    const { runId, fromStepIndex = 0, reason = "Manual replay" } = body as {
      runId: string;
      fromStepIndex?: number;
      reason?: string;
    };

    if (!runId) return NextResponse.json({ error: "runId required." }, { status: 400 });

    const result = await createReplayRun(db, {
      originalRunId: runId,
      fromStepIndex,
      replayedBy: decoded.uid,
      reason,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      newRunId: result.newRunId,
      message: `Replay created. New run ID: ${result.newRunId}`,
    }, { status: 201 });
  }

  // Write audit event directly (for internal routes calling this API)
  const body = await req.json();
  const { type, entityType, entityId, previousState, newState, payload, errorMessage } = body;

  if (!type || !entityType || !entityId) {
    return NextResponse.json({ error: "type, entityType, entityId required." }, { status: 400 });
  }

  writeAuditEvent(db, type, entityType, entityId, { uid: decoded.uid, role: "admin" }, {
    previousState,
    newState,
    payload,
    errorMessage,
  });

  return NextResponse.json({ success: true }, { status: 201 });
}

// ── PATCH: Resolve / resubmit DLQ items ──────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  const db = adminDb();

  const body = await req.json();

  if (action === "resolve_dlq") {
    const { id, resolution } = body as { id: string; resolution?: string };
    if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });

    const doc = await db.collection("deadLetterQueue").doc(id).get();
    if (!doc.exists) return NextResponse.json({ error: "Not found." }, { status: 404 });

    await doc.ref.update({
      status: "resolved",
      resolvedBy: decoded.uid,
      resolvedAt: new Date().toISOString(),
      resolution: resolution ?? "Manually resolved by admin",
    });

    return NextResponse.json({ success: true, status: "resolved" });
  }

  if (action === "resubmit_dlq") {
    const { id } = body as { id: string };
    if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });

    const doc = await db.collection("deadLetterQueue").doc(id).get();
    if (!doc.exists) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const item = doc.data()!;

    // Re-create the job from the DLQ payload
    const newJobRef = db.collection("orchestrationJobs").doc();
    await newJobRef.set({
      ...item.payload,
      status: "queued",
      retryCount: 0,
      lastError: null,
      scheduledAt: null,
      startedAt: null,
      completedAt: null,
      result: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: decoded.uid,
      tenantId: "default",
    });

    // Mark DLQ item as resubmitted
    await doc.ref.update({
      status: "resubmitted",
      resolvedBy: decoded.uid,
      resolvedAt: new Date().toISOString(),
      resubmittedJobId: newJobRef.id,
      resolution: `Resubmitted as new job: ${newJobRef.id}`,
    });

    return NextResponse.json({
      success: true,
      status: "resubmitted",
      newJobId: newJobRef.id,
    });
  }

  if (action === "discard_dlq") {
    const { id, reason } = body as { id: string; reason?: string };
    if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });

    await db.collection("deadLetterQueue").doc(id).update({
      status: "discarded",
      resolvedBy: decoded.uid,
      resolvedAt: new Date().toISOString(),
      resolution: reason ?? "Discarded by admin",
    });

    return NextResponse.json({ success: true, status: "discarded" });
  }

  return NextResponse.json({ error: "Unknown action. Use: resolve_dlq | resubmit_dlq | discard_dlq" }, { status: 400 });
}
