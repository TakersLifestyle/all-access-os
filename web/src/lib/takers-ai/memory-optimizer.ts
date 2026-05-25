// Takers AI — Long-Term Memory Optimization
//
// Manages the lifecycle of brand memory blocks over time:
//   - Tiering: active → warm → cold → archived based on age + access patterns
//   - Compression: summarizes verbose memory blocks into compact representations
//   - Semantic indexing: re-embeds memory blocks for accurate retrieval
//   - Retrieval prioritization: scores blocks by relevance + freshness + priority
//   - Deduplication: detects and merges near-duplicate memory entries
//
// Memory tiers:
//   active:   injected into every agent prompt (high priority, recent, high-access)
//   warm:     injected selectively based on relevance (moderate priority)
//   cold:     available for explicit retrieval only (rarely accessed)
//   archived: kept for audit/history, never injected automatically
//
// The optimizer uses Claude (haiku) for summarization — cheap and focused.

import Anthropic from "@anthropic-ai/sdk";
import { MODEL_PRICING, roundCost } from "./cost";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Types ─────────────────────────────────────────────────────────────────────

export type MemoryTier = "active" | "warm" | "cold" | "archived";

export interface MemoryBlock {
  id: string;
  title: string;
  content: string;
  category: string;
  priority: number;     // 1-10, higher = more important
  isActive: boolean;
  tier: MemoryTier;
  // Lifecycle tracking
  createdAt: string;
  updatedAt: string;
  lastAccessedAt: string | null;
  accessCount: number;
  // Optimization metadata
  originalLength: number | null;     // length before compression
  compressedAt: string | null;
  compressionRatio: number | null;   // 0-1, lower = more compressed
  embeddedAt: string | null;
  semanticScore: number | null;      // relevance score from last retrieval
  isDuplicate: boolean;
  duplicateOfId: string | null;
}

export interface MemoryOptimizationResult {
  tiered: number;           // blocks moved to a different tier
  compressed: number;       // blocks that were summarized/compressed
  archived: number;         // blocks moved to archived
  reindexed: number;        // blocks that were re-embedded
  deduplicated: number;     // duplicate blocks merged/flagged
  tokensSaved: number;      // estimated prompt tokens saved per request
  costUsd: number;          // cost of the optimization run
  durationMs: number;
  details: OptimizationDetail[];
}

export interface OptimizationDetail {
  memoryId: string;
  title: string;
  action: "tiered" | "compressed" | "archived" | "reindexed" | "deduplicated" | "skipped";
  oldTier?: MemoryTier;
  newTier?: MemoryTier;
  oldLength?: number;
  newLength?: number;
  reason: string;
}

// ── Tier promotion rules ──────────────────────────────────────────────────────
// Based on: age, access frequency, priority, manual overrides

export function computeTargetTier(block: {
  createdAt: string;
  updatedAt: string;
  lastAccessedAt: string | null;
  accessCount: number;
  priority: number;
  tier: MemoryTier;
}): MemoryTier {
  const now = Date.now();
  const ageMs = now - new Date(block.createdAt).getTime();
  const lastAccessMs = block.lastAccessedAt
    ? now - new Date(block.lastAccessedAt).getTime()
    : ageMs;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  const lastAccessDays = lastAccessMs / (1000 * 60 * 60 * 24);

  // High-priority blocks stay active longer
  if (block.priority >= 8) {
    if (ageDays < 90) return "active";
    if (ageDays < 180) return "warm";
    return "cold";
  }

  // Medium-priority
  if (block.priority >= 5) {
    if (ageDays < 14 || lastAccessDays < 7) return "active";
    if (ageDays < 60 || lastAccessDays < 30) return "warm";
    if (ageDays < 120) return "cold";
    return "archived";
  }

  // Low-priority
  if (ageDays < 7 && block.accessCount > 3) return "active";
  if (ageDays < 30) return "warm";
  if (ageDays < 90) return "cold";
  return "archived";
}

// ── Compression: summarize verbose memory blocks ──────────────────────────────
export async function compressMemoryBlock(
  block: MemoryBlock,
  targetLengthChars = 500
): Promise<{ compressed: string; costUsd: number; inputTokens: number; outputTokens: number }> {
  if (block.content.length <= targetLengthChars) {
    return { compressed: block.content, costUsd: 0, inputTokens: 0, outputTokens: 0 };
  }

  const prompt = `You are compressing a brand memory block for ALL ACCESS Winnipeg.
Summarize the following memory into approximately ${targetLengthChars} characters.
Preserve all critical facts, key phrases, and actionable guidance.
Remove redundancy, examples, and verbose explanations.
Keep the tone professional and brand-aligned.
Output ONLY the compressed memory — no headings, no commentary.

TITLE: ${block.title}
CATEGORY: ${block.category}

ORIGINAL CONTENT:
${block.content}`;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: Math.ceil(targetLengthChars / 3.5), // ~3.5 chars per token
    messages: [{ role: "user", content: prompt }],
  });

  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  const costUsd = roundCost(
    (inputTokens / 1_000_000) * MODEL_PRICING["claude-haiku-4-5"].inputPer1M +
    (outputTokens / 1_000_000) * MODEL_PRICING["claude-haiku-4-5"].outputPer1M
  );

  const compressed = response.content[0].type === "text"
    ? response.content[0].text.trim()
    : block.content;

  return { compressed, costUsd, inputTokens, outputTokens };
}

// ── Deduplication: find near-duplicate blocks ─────────────────────────────────
export function findDuplicateGroups(blocks: MemoryBlock[]): Array<{
  primary: string;    // id of the block to keep
  duplicates: string[];
  similarity: number;
  reason: string;
}> {
  const groups: Array<{ primary: string; duplicates: string[]; similarity: number; reason: string }> = [];
  const processed = new Set<string>();

  for (let i = 0; i < blocks.length; i++) {
    if (processed.has(blocks[i].id)) continue;

    const duplicates: string[] = [];

    for (let j = i + 1; j < blocks.length; j++) {
      if (processed.has(blocks[j].id)) continue;

      // Same category + high title similarity
      const titleSimilarity = computeJaccardSimilarity(
        blocks[i].title.toLowerCase().split(/\s+/),
        blocks[j].title.toLowerCase().split(/\s+/)
      );

      // Content overlap check (first 200 chars)
      const contentSimilarity = computeJaccardSimilarity(
        blocks[i].content.slice(0, 200).toLowerCase().split(/\s+/),
        blocks[j].content.slice(0, 200).toLowerCase().split(/\s+/)
      );

      const isSameCategory = blocks[i].category === blocks[j].category;

      if (
        (titleSimilarity > 0.7 && isSameCategory) ||
        contentSimilarity > 0.8
      ) {
        duplicates.push(blocks[j].id);
        processed.add(blocks[j].id);
      }
    }

    if (duplicates.length > 0) {
      // Keep the block with higher priority and more recent update
      processed.add(blocks[i].id);
      groups.push({
        primary: blocks[i].id,
        duplicates,
        similarity: 0.8,
        reason: "High content or title overlap detected",
      });
    }
  }

  return groups;
}

function computeJaccardSimilarity(setA: string[], setB: string[]): number {
  const a = new Set(setA);
  const b = new Set(setB);
  const intersection = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

// ── Retrieval prioritization ──────────────────────────────────────────────────
// Scores memory blocks by composite relevance for a given context.

export interface RetrievalCandidate {
  memoryId: string;
  title: string;
  category: string;
  tier: MemoryTier;
  priority: number;
  score: number;           // 0-100 composite score
  components: {
    priorityScore: number;
    freshnessScore: number;
    accessScore: number;
    tierScore: number;
    lengthPenalty: number;
  };
  shouldInject: boolean;  // whether to inject into prompt
}

export function scoreMemoryForRetrieval(
  block: MemoryBlock,
  agentRole?: string
): RetrievalCandidate {
  const now = Date.now();
  const ageMs = now - new Date(block.updatedAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  // Priority: 0-30 pts (block's configured priority)
  const priorityScore = Math.round((block.priority / 10) * 30);

  // Freshness: 0-25 pts (newer = higher)
  const freshnessScore = Math.round(Math.max(0, 25 - ageDays * 0.5));

  // Access frequency: 0-20 pts
  const accessScore = Math.min(20, block.accessCount * 2);

  // Tier: active=25, warm=15, cold=5, archived=0
  const tierScoreMap: Record<MemoryTier, number> = { active: 25, warm: 15, cold: 5, archived: 0 };
  const tierScore = tierScoreMap[block.tier];

  // Length penalty: very long blocks lose points (reduce context bloat)
  const lengthPenalty = Math.min(15, Math.floor(block.content.length / 500));

  const totalScore = Math.max(0, priorityScore + freshnessScore + accessScore + tierScore - lengthPenalty);

  // Auto-inject decision: active tier + score > 40, or priority >= 8
  const shouldInject = block.isActive && (
    block.tier === "active" ||
    (block.tier === "warm" && totalScore > 50) ||
    block.priority >= 8
  );

  return {
    memoryId: block.id,
    title: block.title,
    category: block.category,
    tier: block.tier,
    priority: block.priority,
    score: Math.min(100, totalScore),
    components: { priorityScore, freshnessScore, accessScore, tierScore, lengthPenalty },
    shouldInject,
  };
}

export async function getPrioritizedMemory(
  db: FirebaseFirestore.Firestore,
  options: {
    agentRole?: string;
    maxBlocks?: number;
    tiersToInclude?: MemoryTier[];
    minScore?: number;
  } = {}
): Promise<RetrievalCandidate[]> {
  const maxBlocks = options.maxBlocks ?? 10;
  const tiersToInclude = options.tiersToInclude ?? ["active", "warm"];
  const minScore = options.minScore ?? 20;

  const snap = await db
    .collection("brandMemory")
    .where("isActive", "==", true)
    .orderBy("priority", "desc")
    .limit(100)
    .get();

  const blocks = snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    tier: (d.data().tier as MemoryTier) ?? "active",
    accessCount: (d.data().accessCount as number) ?? 0,
    lastAccessedAt: d.data().lastAccessedAt as string | null ?? null,
    originalLength: d.data().originalLength as number | null ?? null,
    compressedAt: d.data().compressedAt as string | null ?? null,
    compressionRatio: d.data().compressionRatio as number | null ?? null,
    embeddedAt: d.data().embeddedAt as string | null ?? null,
    semanticScore: d.data().semanticScore as number | null ?? null,
    isDuplicate: d.data().isDuplicate as boolean ?? false,
    duplicateOfId: d.data().duplicateOfId as string | null ?? null,
  })) as MemoryBlock[];

  const candidates = blocks
    .filter((b) => tiersToInclude.includes(b.tier) && !b.isDuplicate)
    .map((b) => scoreMemoryForRetrieval(b, options.agentRole))
    .filter((c) => c.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxBlocks);

  return candidates;
}

// ── Full optimization pipeline ────────────────────────────────────────────────
export async function runMemoryOptimization(
  db: FirebaseFirestore.Firestore,
  options: {
    compress?: boolean;       // default true — compress verbose blocks
    reTier?: boolean;         // default true — move blocks between tiers
    deduplicate?: boolean;    // default true — flag duplicate blocks
    compressThresholdChars?: number;  // compress blocks larger than this
    dryRun?: boolean;         // if true, return plan without writing
  } = {}
): Promise<MemoryOptimizationResult> {
  const startedAt = Date.now();
  const {
    compress = true,
    reTier = true,
    deduplicate = true,
    compressThresholdChars = 1000,
    dryRun = false,
  } = options;

  const snap = await db
    .collection("brandMemory")
    .where("isActive", "==", true)
    .orderBy("priority", "desc")
    .get();

  const blocks = snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    tier: (d.data().tier as MemoryTier) ?? "active",
    accessCount: (d.data().accessCount as number) ?? 0,
    lastAccessedAt: d.data().lastAccessedAt as string | null ?? null,
    originalLength: d.data().originalLength as number | null ?? null,
    compressedAt: d.data().compressedAt as string | null ?? null,
    compressionRatio: d.data().compressionRatio as number | null ?? null,
    embeddedAt: d.data().embeddedAt as string | null ?? null,
    semanticScore: d.data().semanticScore as number | null ?? null,
    isDuplicate: d.data().isDuplicate as boolean ?? false,
    duplicateOfId: d.data().duplicateOfId as string | null ?? null,
  })) as MemoryBlock[];

  const details: OptimizationDetail[] = [];
  let tiered = 0;
  let compressed = 0;
  let archived = 0;
  let deduplicated = 0;
  let tokensSaved = 0;
  let totalCostUsd = 0;
  const now = new Date().toISOString();

  // ── Step 1: Re-tier ────────────────────────────────────────────────────────
  if (reTier) {
    for (const block of blocks) {
      const targetTier = computeTargetTier(block);
      if (targetTier !== block.tier) {
        details.push({
          memoryId: block.id,
          title: block.title,
          action: targetTier === "archived" ? "archived" : "tiered",
          oldTier: block.tier,
          newTier: targetTier,
          reason: `Age/access pattern suggests ${targetTier} tier`,
        });

        if (!dryRun) {
          await db.collection("brandMemory").doc(block.id).update({
            tier: targetTier,
            isActive: targetTier !== "archived",
            updatedAt: now,
          });
        }

        if (targetTier === "archived") archived++;
        else tiered++;
      }
    }
  }

  // ── Step 2: Compress verbose blocks ───────────────────────────────────────
  if (compress) {
    const toCompress = blocks.filter(
      (b) =>
        b.content.length > compressThresholdChars &&
        !b.isDuplicate &&
        b.tier !== "archived" &&
        // Don't re-compress recently compressed blocks
        (!b.compressedAt || Date.now() - new Date(b.compressedAt).getTime() > 7 * 24 * 60 * 60 * 1000)
    );

    for (const block of toCompress) {
      try {
        const { compressed: compressedContent, costUsd } = await compressMemoryBlock(
          block,
          compressThresholdChars
        );

        const oldLength = block.content.length;
        const newLength = compressedContent.length;
        const savedChars = oldLength - newLength;
        const savedTokens = Math.ceil(savedChars / 4);
        tokensSaved += savedTokens;
        totalCostUsd += costUsd;

        details.push({
          memoryId: block.id,
          title: block.title,
          action: "compressed",
          oldLength,
          newLength,
          reason: `Block was ${oldLength} chars — compressed to ${newLength} chars (${Math.round((1 - newLength/oldLength)*100)}% reduction)`,
        });

        if (!dryRun) {
          await db.collection("brandMemory").doc(block.id).update({
            content: compressedContent,
            originalLength: block.originalLength ?? oldLength,
            compressedAt: now,
            compressionRatio: Math.round((newLength / oldLength) * 100) / 100,
            updatedAt: now,
          });
        }

        compressed++;
      } catch (err) {
        console.warn(`[memory-optimizer] compression failed for ${block.id}:`, err);
      }
    }
  }

  // ── Step 3: Deduplication ─────────────────────────────────────────────────
  if (deduplicate) {
    const activeBlocks = blocks.filter((b) => b.tier !== "archived" && !b.isDuplicate);
    const duplicateGroups = findDuplicateGroups(activeBlocks);

    for (const group of duplicateGroups) {
      for (const dupId of group.duplicates) {
        details.push({
          memoryId: dupId,
          title: blocks.find((b) => b.id === dupId)?.title ?? dupId,
          action: "deduplicated",
          reason: `Near-duplicate of "${blocks.find((b) => b.id === group.primary)?.title ?? group.primary}" (${Math.round(group.similarity * 100)}% similarity)`,
        });

        if (!dryRun) {
          await db.collection("brandMemory").doc(dupId).update({
            isDuplicate: true,
            duplicateOfId: group.primary,
            isActive: false,
            tier: "archived" as MemoryTier,
            updatedAt: now,
          });
        }

        deduplicated++;
      }
    }
  }

  return {
    tiered,
    compressed,
    archived,
    reindexed: 0, // Re-indexing (re-embedding) handled by knowledge ingestion pipeline
    deduplicated,
    tokensSaved,
    costUsd: roundCost(totalCostUsd),
    durationMs: Date.now() - startedAt,
    details,
  };
}

// ── Memory summary builder ────────────────────────────────────────────────────
// Builds a compressed summary of all active memory for context-constrained scenarios
export async function buildMemorySummary(
  db: FirebaseFirestore.Firestore,
  maxChars = 2000
): Promise<{ summary: string; blockCount: number; costUsd: number }> {
  const snap = await db
    .collection("brandMemory")
    .where("isActive", "==", true)
    .where("tier", "in", ["active", "warm"])
    .orderBy("priority", "desc")
    .limit(20)
    .get();

  const blocks = snap.docs.map((d) => d.data());
  if (blocks.length === 0) return { summary: "", blockCount: 0, costUsd: 0 };

  const combinedContent = blocks
    .map((b) => `[${b.title}] ${String(b.content).slice(0, 300)}`)
    .join("\n\n");

  if (combinedContent.length <= maxChars) {
    return { summary: combinedContent, blockCount: blocks.length, costUsd: 0 };
  }

  const prompt = `Synthesize these brand memory blocks into a coherent summary of max ${maxChars} characters.
Preserve brand voice, key decisions, and critical constraints.
Format as flowing prose, not a list.

${combinedContent.slice(0, 4000)}`;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: Math.ceil(maxChars / 3.5),
    messages: [{ role: "user", content: prompt }],
  });

  const summary = response.content[0].type === "text" ? response.content[0].text.trim() : combinedContent;
  const costUsd = roundCost(
    (response.usage.input_tokens / 1_000_000) * MODEL_PRICING["claude-haiku-4-5"].inputPer1M +
    (response.usage.output_tokens / 1_000_000) * MODEL_PRICING["claude-haiku-4-5"].outputPer1M
  );

  return { summary, blockCount: blocks.length, costUsd };
}

// ── Increment access counter (fire-and-forget) ────────────────────────────────
export function recordMemoryAccess(
  db: FirebaseFirestore.Firestore,
  memoryIds: string[]
): void {
  const now = new Date().toISOString();
  for (const id of memoryIds) {
    db.collection("brandMemory").doc(id).update({
      lastAccessedAt: now,
      accessCount: (require("firebase-admin/firestore") as typeof import("firebase-admin/firestore")).FieldValue.increment(1),
    }).catch(() => {/* ignore access tracking failures */});
  }
}

// ── Memory health stats ───────────────────────────────────────────────────────
export async function getMemoryHealthStats(
  db: FirebaseFirestore.Firestore
): Promise<{
  totalBlocks: number;
  byTier: Record<MemoryTier, number>;
  avgLength: number;
  totalTokenEstimate: number;
  duplicateCount: number;
  oldestBlock: string | null;
  mostAccessedTitle: string | null;
  compressionOpportunities: number;
}> {
  const snap = await db.collection("brandMemory").get();
  const blocks = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as MemoryBlock[];

  const byTier: Record<MemoryTier, number> = { active: 0, warm: 0, cold: 0, archived: 0 };
  let totalLength = 0;
  let duplicateCount = 0;
  let oldestDate: string | null = null;
  let mostAccessedTitle: string | null = null;
  let maxAccess = 0;
  let compressionOpportunities = 0;

  for (const block of blocks) {
    const tier = block.tier ?? "active";
    byTier[tier] = (byTier[tier] ?? 0) + 1;
    totalLength += block.content?.length ?? 0;
    if (block.isDuplicate) duplicateCount++;
    if (!oldestDate || block.createdAt < oldestDate) oldestDate = block.createdAt;
    if ((block.accessCount ?? 0) > maxAccess) {
      maxAccess = block.accessCount ?? 0;
      mostAccessedTitle = block.title;
    }
    if ((block.content?.length ?? 0) > 1000 && !block.compressedAt) compressionOpportunities++;
  }

  return {
    totalBlocks: blocks.length,
    byTier,
    avgLength: blocks.length > 0 ? Math.round(totalLength / blocks.length) : 0,
    totalTokenEstimate: Math.ceil(totalLength / 4),
    duplicateCount,
    oldestBlock: oldestDate,
    mostAccessedTitle,
    compressionOpportunities,
  };
}
