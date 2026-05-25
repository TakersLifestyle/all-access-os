// Takers AI — Knowledge Base CRUD + Semantic Search
//
// Collections:
//   knowledgeBase/{docId}     — source documents with metadata
//   knowledgeChunks/{chunkId} — embedded chunks (written on create/update)
//
// GET    /api/takers-ai/knowledge              → list documents
// GET    /api/takers-ai/knowledge?search=query → semantic/keyword search
// GET    /api/takers-ai/knowledge?id=docId     → single document
// POST   /api/takers-ai/knowledge              → create + embed
// PUT    /api/takers-ai/knowledge              → update + re-embed
// DELETE /api/takers-ai/knowledge?id=docId     → delete doc + all chunks

import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import {
  chunkText,
  embedDocument,
  semanticSearch,
  formatRetrievedContext,
  EMBEDDING_MODEL,
  type KnowledgeCategory,
} from "@/lib/takers-ai/knowledge";

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
  const search = searchParams.get("search");
  const id = searchParams.get("id");
  const category = searchParams.get("category") as KnowledgeCategory | null;
  const format = searchParams.get("format"); // "context" = formatted for prompt injection
  const db = adminDb();

  // Single document
  if (id) {
    const doc = await db.collection("knowledgeBase").doc(id).get();
    if (!doc.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ document: { id: doc.id, ...doc.data() } });
  }

  // Semantic / keyword search
  if (search) {
    const chunks = await semanticSearch(db, search, {
      k: 8,
      categories: category ? [category] : undefined,
    });

    if (format === "context") {
      return NextResponse.json({
        context: formatRetrievedContext(chunks),
        chunks: chunks.map((c) => ({ chunkId: c.chunkId, documentTitle: c.documentTitle, score: c.score })),
        retrievalMethod: chunks[0]?.retrievalMethod ?? "keyword",
        embeddingModel: process.env.VOYAGE_API_KEY ? EMBEDDING_MODEL : null,
      });
    }

    return NextResponse.json({ chunks, total: chunks.length });
  }

  // List all documents
  let query: FirebaseFirestore.Query = db
    .collection("knowledgeBase")
    .orderBy("createdAt", "desc");

  if (category) query = query.where("category", "==", category);

  const snap = await query.limit(100).get();
  const documents = snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    // Don't return full content in list view
    content: undefined,
    contentPreview: ((d.data().content as string) ?? "").slice(0, 200),
  }));

  return NextResponse.json({ documents, total: snap.size });
}

export async function POST(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title, content, category, source = "manual", tags = [] } = body as {
    title: string;
    content: string;
    category: KnowledgeCategory;
    source?: string;
    tags?: string[];
  };

  if (!title || !content || !category) {
    return NextResponse.json({ error: "title, content, category required." }, { status: 400 });
  }

  const db = adminDb();
  const now = new Date().toISOString();
  const docRef = db.collection("knowledgeBase").doc();

  // Count chunks before embedding
  const chunks = chunkText(content);

  // Write document first
  await docRef.set({
    title,
    content,
    category,
    source,
    tags,
    chunkCount: chunks.length,
    embeddingModel: process.env.VOYAGE_API_KEY ? EMBEDDING_MODEL : null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    updatedBy: decoded.uid,
  });

  // Generate and store embeddings (async, after response for large docs)
  const chunkRecords = await embedDocument(docRef.id, title, content, category);

  if (chunkRecords.length > 0) {
    const batch = db.batch();
    for (const chunk of chunkRecords) {
      batch.set(db.collection("knowledgeChunks").doc(), chunk);
    }
    await batch.commit();
  }

  return NextResponse.json({
    id: docRef.id,
    title,
    category,
    chunkCount: chunkRecords.length,
    embeddingModel: process.env.VOYAGE_API_KEY ? EMBEDDING_MODEL : null,
    embedded: chunkRecords.some((c) => c.embedding.length > 0),
  }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, title, content, category, tags, isActive } = body as {
    id: string;
    title?: string;
    content?: string;
    category?: KnowledgeCategory;
    tags?: string[];
    isActive?: boolean;
  };

  if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });

  const db = adminDb();
  const docRef = db.collection("knowledgeBase").doc(id);
  const existing = await docRef.get();

  if (!existing.exists) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const updates: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
    updatedBy: decoded.uid,
  };
  if (title !== undefined) updates.title = title;
  if (content !== undefined) updates.content = content;
  if (category !== undefined) updates.category = category;
  if (tags !== undefined) updates.tags = tags;
  if (isActive !== undefined) updates.isActive = isActive;

  await docRef.update(updates);

  // Re-embed if content or title changed
  if (content !== undefined || title !== undefined) {
    const currentData = existing.data()!;
    const newContent = (content ?? currentData.content) as string;
    const newTitle = (title ?? currentData.title) as string;
    const newCategory = (category ?? currentData.category) as KnowledgeCategory;

    // Delete existing chunks
    const oldChunks = await db
      .collection("knowledgeChunks")
      .where("documentId", "==", id)
      .get();

    if (!oldChunks.empty) {
      const batch = db.batch();
      for (const c of oldChunks.docs) batch.delete(c.ref);
      await batch.commit();
    }

    // Re-embed
    const newChunks = await embedDocument(id, newTitle, newContent, newCategory);
    if (newChunks.length > 0) {
      const batch = db.batch();
      for (const chunk of newChunks) {
        batch.set(db.collection("knowledgeChunks").doc(), chunk);
      }
      await batch.commit();
    }

    await docRef.update({
      chunkCount: newChunks.length,
      embeddingModel: process.env.VOYAGE_API_KEY ? EMBEDDING_MODEL : null,
    });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });

  const db = adminDb();

  // Delete all chunks
  const chunksSnap = await db
    .collection("knowledgeChunks")
    .where("documentId", "==", id)
    .get();

  if (!chunksSnap.empty) {
    const batch = db.batch();
    for (const c of chunksSnap.docs) batch.delete(c.ref);
    await batch.commit();
  }

  await db.collection("knowledgeBase").doc(id).delete();
  return NextResponse.json({ success: true, chunksDeleted: chunksSnap.size });
}
