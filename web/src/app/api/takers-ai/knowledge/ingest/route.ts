// Takers AI — Knowledge Ingestion API
//
// GET  /api/takers-ai/knowledge/ingest              → list ingest jobs
// GET  /api/takers-ai/knowledge/ingest?id=<jobId>   → single job status
// GET  /api/takers-ai/knowledge/ingest?stale=true   → list stale documents
// POST /api/takers-ai/knowledge/ingest              → create + run ingest job
//   body: { documentId?, trigger?, reindexAll? }
// DELETE /api/takers-ai/knowledge/ingest?id=<jobId> → cancel a queued job

import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import {
  createIngestJobRecord,
  runIngestJob,
  getStaleDocuments,
} from "@/lib/takers-ai/ingestion";
import type { IngestJobTrigger } from "@/lib/takers-ai/ingestion";

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

export async function GET(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const stale = searchParams.get("stale") === "true";
  const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 200);
  const db = adminDb();

  // Single job
  if (id) {
    const doc = await db.collection("ingestJobs").doc(id).get();
    if (!doc.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ job: { id: doc.id, ...doc.data() } });
  }

  // Stale document list
  if (stale) {
    const staleDocs = await getStaleDocuments(db);
    return NextResponse.json({ staleDocs, total: staleDocs.length });
  }

  // List jobs
  const snap = await db
    .collection("ingestJobs")
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  const jobs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return NextResponse.json({ jobs, total: snap.size });
}

export async function POST(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    documentId = null,
    trigger = "manual",
    reindexAll = false,
    runAsync = false,
  } = body as {
    documentId?: string | null;
    trigger?: IngestJobTrigger;
    reindexAll?: boolean;
    runAsync?: boolean;
  };

  const db = adminDb();

  // Validate document exists if specified
  if (documentId) {
    const docSnap = await db.collection("knowledgeBase").doc(documentId).get();
    if (!docSnap.exists) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }
  }

  const resolvedTrigger: IngestJobTrigger = reindexAll ? "reindex_all" : (trigger ?? "manual");
  const resolvedDocId: string | null = reindexAll ? null : (documentId ?? null);

  // Get document title for job label
  let docTitle: string | null = null;
  if (resolvedDocId) {
    const docSnap = await db.collection("knowledgeBase").doc(resolvedDocId).get();
    docTitle = (docSnap.data()?.title as string) ?? null;
  }

  // Create job record
  const jobData = createIngestJobRecord(resolvedDocId, docTitle, resolvedTrigger, decoded.uid);
  const jobRef = db.collection("ingestJobs").doc();
  await jobRef.set(jobData);

  if (runAsync) {
    // Return immediately — job will be picked up by orchestration worker
    return NextResponse.json({
      id: jobRef.id,
      status: "queued",
      message: "Job queued. Poll GET ?id= for status.",
    }, { status: 202 });
  }

  // Run synchronously (blocks until done — suitable for small docs)
  const result = await runIngestJob(db, jobRef.id);

  const finalDoc = await jobRef.get();
  return NextResponse.json({
    id: jobRef.id,
    ...finalDoc.data(),
    success: result.success,
    ...(result.error ? { error: result.error } : {}),
  }, { status: result.success ? 201 : 500 });
}

export async function DELETE(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });

  const db = adminDb();
  const doc = await db.collection("ingestJobs").doc(id).get();
  if (!doc.exists) return NextResponse.json({ error: "Not found." }, { status: 404 });

  if (doc.data()?.status === "running") {
    return NextResponse.json({ error: "Cannot cancel a running job." }, { status: 400 });
  }

  await db.collection("ingestJobs").doc(id).update({
    status: "cancelled",
    completedAt: new Date().toISOString(),
  });

  return NextResponse.json({ success: true });
}
