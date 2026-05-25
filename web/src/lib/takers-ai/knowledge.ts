// Takers AI — Knowledge Retrieval System
//
// Architecture:
//   1. Documents are chunked into ~400-token overlapping pieces
//   2. Each chunk is embedded via Voyage AI (voyage-3-lite, 512-dim)
//   3. Embeddings stored in Firestore (knowledgeChunks collection)
//   4. At query time: embed the query, compute cosine similarity against all chunks
//   5. Return top-K relevant chunks as a formatted context string
//
// Upgrade path:
//   Once chunk count > 500, move to Firestore native vector search:
//   db.collection("knowledgeChunks").findNearest("embedding", queryVector, { limit: k, distanceMeasure: "COSINE" })
//   (requires: firebase deploy --only firestore:indexes with VectorConfig)
//
// Environment:
//   VOYAGE_API_KEY — required for embeddings. If absent, falls back to keyword (BM25-lite) search.

export const EMBEDDING_MODEL = "voyage-3-lite";
export const EMBEDDING_DIMENSIONS = 512;
export const CHUNK_MAX_TOKENS = 400;
export const CHUNK_OVERLAP_TOKENS = 80;
export const DEFAULT_RETRIEVAL_K = 5;
export const MIN_SIMILARITY_THRESHOLD = 0.72;  // Below this score, chunks are excluded

export type KnowledgeCategory =
  | "campaign_history"
  | "event_learnings"
  | "member_interactions"
  | "content_library"
  | "operational_knowledge"
  | "brand_guidelines";

export const KNOWLEDGE_CATEGORY_LABELS: Record<KnowledgeCategory, string> = {
  campaign_history:       "Campaign History",
  event_learnings:        "Event Learnings",
  member_interactions:    "Member Interactions",
  content_library:        "Content Library",
  operational_knowledge:  "Operational Knowledge",
  brand_guidelines:       "Brand Guidelines",
};

// ── Text chunking ─────────────────────────────────────────────────────────────
// Splits text into overlapping chunks by sentence boundaries.
// Approximate tokenization: 1 token ≈ 4 chars (English prose).
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface TextChunk {
  content: string;
  chunkIndex: number;
  tokenCount: number;
  startChar: number;
  endChar: number;
}

export function chunkText(
  text: string,
  maxTokens: number = CHUNK_MAX_TOKENS,
  overlapTokens: number = CHUNK_OVERLAP_TOKENS
): TextChunk[] {
  if (!text.trim()) return [];

  const maxChars = maxTokens * 4;
  const overlapChars = overlapTokens * 4;

  // Split by sentence boundaries
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.trim().length > 0);

  const chunks: TextChunk[] = [];
  let currentChunk = "";
  let startChar = 0;
  let charPos = 0;

  for (const sentence of sentences) {
    if (estimateTokens(currentChunk + sentence) > maxTokens && currentChunk.length > 0) {
      // Emit current chunk
      const content = currentChunk.trim();
      chunks.push({
        content,
        chunkIndex: chunks.length,
        tokenCount: estimateTokens(content),
        startChar,
        endChar: charPos,
      });

      // Start overlap — keep last overlapChars worth of content
      const overlapStart = Math.max(0, currentChunk.length - overlapChars);
      currentChunk = currentChunk.slice(overlapStart) + " " + sentence;
      startChar = charPos - overlapChars;
    } else {
      currentChunk += (currentChunk ? " " : "") + sentence;
    }
    charPos += sentence.length + 1;
  }

  // Emit remaining
  if (currentChunk.trim()) {
    const content = currentChunk.trim();
    chunks.push({
      content,
      chunkIndex: chunks.length,
      tokenCount: estimateTokens(content),
      startChar,
      endChar: charPos,
    });
  }

  // If text is short enough to be a single chunk
  if (chunks.length === 0 && text.trim()) {
    chunks.push({
      content: text.trim(),
      chunkIndex: 0,
      tokenCount: estimateTokens(text),
      startChar: 0,
      endChar: text.length,
    });
  }

  return chunks;
}

// ── Cosine similarity ─────────────────────────────────────────────────────────
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ── Voyage AI embedding ───────────────────────────────────────────────────────
export interface EmbeddingResult {
  embedding: number[];
  model: string;
  tokenCount: number;
}

export async function generateEmbedding(
  text: string,
  inputType: "document" | "query" = "document"
): Promise<EmbeddingResult | null> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    // Graceful fallback: return null so callers can use keyword search
    return null;
  }

  try {
    const response = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: [text.slice(0, 16000)], // Voyage-3-lite token limit
        input_type: inputType,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.warn("[knowledge] Embedding API error:", err);
      return null;
    }

    const data = await response.json() as {
      data: Array<{ embedding: number[] }>;
      usage: { total_tokens: number };
    };

    return {
      embedding: data.data[0].embedding,
      model: EMBEDDING_MODEL,
      tokenCount: data.usage.total_tokens,
    };
  } catch (err) {
    console.warn("[knowledge] generateEmbedding failed:", err);
    return null;
  }
}

// ── BM25-lite keyword fallback ────────────────────────────────────────────────
// Used when VOYAGE_API_KEY is not set.
// Scores chunks by term frequency of query words.
function keywordScore(query: string, text: string): number {
  const queryWords = query.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
  const textLower = text.toLowerCase();
  let score = 0;
  for (const word of queryWords) {
    const occurrences = (textLower.match(new RegExp(`\\b${word}\\b`, "g")) ?? []).length;
    score += occurrences;
  }
  return score / (text.length / 100 + 1); // Normalize by text length
}

// ── Firestore knowledge retrieval ─────────────────────────────────────────────
export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  category: KnowledgeCategory;
  content: string;
  score: number;           // cosine similarity or keyword score
  retrievalMethod: "embedding" | "keyword";
}

export async function semanticSearch(
  db: FirebaseFirestore.Firestore,
  query: string,
  options: {
    k?: number;
    categories?: KnowledgeCategory[];
    minScore?: number;
  } = {}
): Promise<RetrievedChunk[]> {
  const k = options.k ?? DEFAULT_RETRIEVAL_K;
  const minScore = options.minScore ?? MIN_SIMILARITY_THRESHOLD;

  // Load chunks from Firestore
  let chunksQuery: FirebaseFirestore.Query = db.collection("knowledgeChunks");
  if (options.categories?.length) {
    chunksQuery = chunksQuery.where("category", "in", options.categories);
  }

  const chunksSnap = await chunksQuery.limit(1000).get();
  if (chunksSnap.empty) return [];

  // Try embedding-based search first
  const queryEmbedding = await generateEmbedding(query, "query");

  if (queryEmbedding) {
    // Vector similarity search
    const scored = chunksSnap.docs
      .filter((d) => Array.isArray(d.data().embedding) && d.data().embedding.length > 0)
      .map((d) => {
        const data = d.data();
        return {
          chunkId: d.id,
          documentId: data.documentId as string,
          documentTitle: data.documentTitle as string,
          category: data.category as KnowledgeCategory,
          content: data.content as string,
          score: cosineSimilarity(queryEmbedding.embedding, data.embedding as number[]),
          retrievalMethod: "embedding" as const,
        };
      })
      .filter((c) => c.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, k);

    return scored;
  }

  // Keyword fallback
  const scored = chunksSnap.docs
    .map((d) => {
      const data = d.data();
      return {
        chunkId: d.id,
        documentId: data.documentId as string,
        documentTitle: data.documentTitle as string,
        category: data.category as KnowledgeCategory,
        content: data.content as string,
        score: keywordScore(query, data.content as string),
        retrievalMethod: "keyword" as const,
      };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);

  return scored;
}

// ── Context injection ─────────────────────────────────────────────────────────
// Formats retrieved chunks into a system prompt section.
export function formatRetrievedContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "";

  const grouped = chunks.reduce<Record<string, RetrievedChunk[]>>((acc, c) => {
    const key = `${c.documentTitle} (${KNOWLEDGE_CATEGORY_LABELS[c.category]})`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(c);
    return acc;
  }, {});

  const sections = Object.entries(grouped).map(([title, groupChunks]) => {
    const content = groupChunks.map((c) => c.content).join(" […] ");
    const method = groupChunks[0].retrievalMethod;
    const scoreStr = method === "embedding"
      ? `(${Math.round(groupChunks[0].score * 100)}% relevant)`
      : "(keyword match)";
    return `#### ${title} ${scoreStr}\n${content}`;
  });

  return `\n\n---\n\n## RETRIEVED KNOWLEDGE ${process.env.VOYAGE_API_KEY ? "(semantic)" : "(keyword)"}\nRelevant context retrieved from your knowledge base:\n\n${sections.join("\n\n")}`;
}

// ── Document embedding pipeline ───────────────────────────────────────────────
// Chunks a document and generates embeddings for each chunk.
// Returns chunk records ready to write to Firestore.
export async function embedDocument(
  documentId: string,
  documentTitle: string,
  content: string,
  category: KnowledgeCategory
): Promise<Array<{
  documentId: string;
  documentTitle: string;
  category: KnowledgeCategory;
  chunkIndex: number;
  content: string;
  embedding: number[];
  tokenCount: number;
  createdAt: string;
}>> {
  const chunks = chunkText(content);
  const now = new Date().toISOString();
  const result = [];

  for (const chunk of chunks) {
    const embResult = await generateEmbedding(chunk.content, "document");
    result.push({
      documentId,
      documentTitle,
      category,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      embedding: embResult?.embedding ?? [],
      tokenCount: chunk.tokenCount,
      createdAt: now,
    });

    // Rate limit: Voyage free tier is 3 req/s
    if (embResult) {
      await new Promise((r) => setTimeout(r, 350));
    }
  }

  return result;
}
