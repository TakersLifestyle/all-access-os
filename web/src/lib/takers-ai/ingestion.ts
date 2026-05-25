// Takers AI — Knowledge Ingestion Pipeline
//
// Handles the full lifecycle from raw document → searchable knowledge chunks:
//   1. Content hashing for freshness detection (SHA-256 hex, first 16 chars)
//   2. Metadata extraction (auto-detect category, source, tags from content)
//   3. Chunking + embedding via knowledge.ts
//   4. IngestJob tracking with status, progress, error capture
//   5. Re-index detection: any doc with needsReindex=true or stale embeddings
//   6. Batch ingestion with rate limiting (Voyage free tier: 3 req/s)
//
// Usage:
//   const job = await createIngestJob(db, { documentId, triggeredBy })
//   await runIngestJob(db, job.id)   ← called by API route or background worker
//
// Freshness:
//   knowledgeBase docs gain two fields: contentHash + embeddedAt.
//   On any PUT that changes content, the route sets needsReindex=true.
//   A daily scheduled job can call getStaleDocuments() + re-embed.

import { chunkText, generateEmbedding } from "./knowledge";
import type { KnowledgeCategory } from "./knowledge";

// ── Job model ─────────────────────────────────────────────────────────────────
export type IngestJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type IngestJobTrigger =
  | "manual"         // admin triggered from UI
  | "on_create"      // fired when a new document is created
  | "on_update"      // fired when content changes
  | "scheduled"      // nightly freshness sweep
  | "reindex_all";   // full rebuild

export interface IngestJob {
  id: string;
  documentId: string | null;      // null = full reindex
  documentTitle: string | null;
  trigger: IngestJobTrigger;
  status: IngestJobStatus;
  chunksProcessed: number;
  chunksEmbedded: number;
  chunksSkipped: number;
  errorMessage: string | null;
  triggeredBy: string;            // admin uid or "system"
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

// Factory — call this to enqueue; do NOT write directly to Firestore from this lib
export function createIngestJobRecord(
  documentId: string | null,
  documentTitle: string | null,
  trigger: IngestJobTrigger,
  triggeredBy: string
): Omit<IngestJob, "id"> {
  return {
    documentId,
    documentTitle,
    trigger,
    status: "queued",
    chunksProcessed: 0,
    chunksEmbedded: 0,
    chunksSkipped: 0,
    errorMessage: null,
    triggeredBy,
    startedAt: null,
    completedAt: null,
    createdAt: new Date().toISOString(),
  };
}

// ── Content hash (freshness detection) ───────────────────────────────────────
// Simple djb2 hash — no crypto dependency needed for freshness checks.
// 16-char hex string, deterministic for the same input.
export function hashContent(content: string): string {
  let hash = 5381;
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) + hash) ^ content.charCodeAt(i);
    hash = hash >>> 0; // keep as unsigned 32-bit
  }
  return hash.toString(16).padStart(8, "0") +
    (content.length).toString(16).padStart(8, "0");
}

// ── Auto metadata extraction ──────────────────────────────────────────────────
// Infers category, tags, and source hints from document title + content.
// Used when a document is ingested without explicit metadata.

const CATEGORY_KEYWORDS: Record<KnowledgeCategory, string[]> = {
  campaign_history:      ["campaign", "launch", "promotion", "email blast", "ad run", "results"],
  event_learnings:       ["event", "venue", "attendance", "run of show", "logistics", "post-event"],
  member_interactions:   ["member", "subscriber", "complaint", "support", "feedback", "refund", "onboarding"],
  content_library:       ["caption", "copy", "script", "hook", "hashtag", "video", "post"],
  operational_knowledge: ["SOP", "process", "workflow", "checklist", "moderation", "team"],
  brand_guidelines:      ["brand", "voice", "tone", "logo", "colors", "guidelines", "identity"],
};

export function inferCategory(title: string, content: string): KnowledgeCategory {
  const text = `${title} ${content}`.toLowerCase();
  let best: KnowledgeCategory = "operational_knowledge";
  let bestScore = 0;

  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      const count = (text.match(new RegExp(kw.toLowerCase(), "g")) ?? []).length;
      score += count;
    }
    if (score > bestScore) {
      bestScore = score;
      best = cat as KnowledgeCategory;
    }
  }

  return best;
}

export function extractTags(title: string, content: string): string[] {
  const text = `${title} ${content}`.toLowerCase();
  const tagCandidates = [
    "instagram", "tiktok", "youtube", "email", "discord",
    "event", "ticket", "refund", "member", "sponsor", "grant",
    "winnipeg", "community", "brand", "campaign", "content",
    "stripe", "firebase", "analytics", "sop", "checklist",
  ];
  return tagCandidates.filter((t) => text.includes(t)).slice(0, 8);
}

// ── Stale document detection ──────────────────────────────────────────────────
// Returns documents where:
//   - needsReindex === true, OR
//   - embeddedAt is missing, OR
//   - embeddedAt is older than maxAgeHours
export interface StaleDocument {
  id: string;
  title: string;
  category: KnowledgeCategory;
  needsReindex: boolean;
  embeddedAt: string | null;
  contentHash: string | null;
}

export async function getStaleDocuments(
  db: FirebaseFirestore.Firestore,
  maxAgeHours = 168  // 7 days default
): Promise<StaleDocument[]> {
  const snap = await db.collection("knowledgeBase").where("isActive", "==", true).get();
  const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000).toISOString();

  return snap.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        title: data.title as string,
        category: data.category as KnowledgeCategory,
        needsReindex: (data.needsReindex as boolean) ?? false,
        embeddedAt: (data.embeddedAt as string) ?? null,
        contentHash: (data.contentHash as string) ?? null,
      };
    })
    .filter((doc) =>
      doc.needsReindex ||
      !doc.embeddedAt ||
      doc.embeddedAt < cutoff
    );
}

// ── Core ingestion runner ─────────────────────────────────────────────────────
// Executes a queued IngestJob against Firestore.
// Can process a single document or all stale documents (reindex_all).
// Writes progress updates to the job doc as it runs.

export async function runIngestJob(
  db: FirebaseFirestore.Firestore,
  jobId: string
): Promise<{ success: boolean; error?: string }> {
  const jobRef = db.collection("ingestJobs").doc(jobId);
  const jobDoc = await jobRef.get();
  if (!jobDoc.exists) return { success: false, error: "Job not found" };

  const job = jobDoc.data() as IngestJob;
  if (job.status !== "queued") {
    return { success: false, error: `Job is ${job.status}, not queued` };
  }

  // Mark running
  await jobRef.update({ status: "running", startedAt: new Date().toISOString() });

  try {
    let docIds: string[] = [];

    if (job.documentId) {
      docIds = [job.documentId];
    } else {
      // Reindex all: get stale docs or all docs
      const snap = await db.collection("knowledgeBase").where("isActive", "==", true).get();
      docIds = snap.docs.map((d) => d.id);
    }

    let chunksProcessed = 0;
    let chunksEmbedded = 0;
    let chunksSkipped = 0;

    for (const docId of docIds) {
      const docRef = db.collection("knowledgeBase").doc(docId);
      const docSnap = await docRef.get();
      if (!docSnap.exists) { chunksSkipped++; continue; }

      const data = docSnap.data()!;
      const content = data.content as string;
      const title = data.title as string;
      const category = (data.category as KnowledgeCategory) ??
        inferCategory(title, content);

      const newHash = hashContent(content);

      // Skip if hash unchanged (content hasn't changed since last embed)
      if (
        data.contentHash === newHash &&
        data.embeddedAt &&
        !data.needsReindex
      ) {
        chunksSkipped++;
        continue;
      }

      // Delete old chunks
      const oldChunks = await db
        .collection("knowledgeChunks")
        .where("documentId", "==", docId)
        .get();

      if (!oldChunks.empty) {
        const batch = db.batch();
        for (const c of oldChunks.docs) batch.delete(c.ref);
        await batch.commit();
      }

      // Chunk + embed
      const chunks = chunkText(content);
      const now = new Date().toISOString();
      const newChunks: Array<Record<string, unknown>> = [];

      for (const chunk of chunks) {
        chunksProcessed++;
        const embResult = await generateEmbedding(chunk.content, "document");
        newChunks.push({
          documentId: docId,
          documentTitle: title,
          category,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          embedding: embResult?.embedding ?? [],
          tokenCount: chunk.tokenCount,
          createdAt: now,
        });
        if (embResult) chunksEmbedded++;
        // Rate limit: Voyage free tier 3 req/s
        if (embResult) await new Promise((r) => setTimeout(r, 350));
      }

      // Write new chunks in batch
      if (newChunks.length > 0) {
        const batch = db.batch();
        for (const c of newChunks) {
          batch.set(db.collection("knowledgeChunks").doc(), c);
        }
        await batch.commit();
      }

      // Update doc with hash + embeddedAt
      await docRef.update({
        contentHash: newHash,
        embeddedAt: now,
        needsReindex: false,
        chunkCount: newChunks.length,
        // Refresh auto-extracted tags if not manually set
        ...((!data.tags || (data.tags as string[]).length === 0)
          ? { tags: extractTags(title, content) }
          : {}),
      });

      // Update job progress
      await jobRef.update({ chunksProcessed, chunksEmbedded, chunksSkipped });
    }

    await jobRef.update({
      status: "completed",
      chunksProcessed,
      chunksEmbedded,
      chunksSkipped,
      completedAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await jobRef.update({
      status: "failed",
      errorMessage,
      completedAt: new Date().toISOString(),
    });
    return { success: false, error: errorMessage };
  }
}

// ── Freshness label ───────────────────────────────────────────────────────────
export function getFreshnessLabel(embeddedAt: string | null): string {
  if (!embeddedAt) return "never";
  const ageMs = Date.now() - new Date(embeddedAt).getTime();
  const hours = ageMs / (1000 * 60 * 60);
  if (hours < 1) return "< 1 hour";
  if (hours < 24) return `${Math.round(hours)}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
}
