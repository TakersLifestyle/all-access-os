// Takers AI — Memory Optimization API
//
// GET  /api/takers-ai/memory/optimize              → memory health stats
// GET  /api/takers-ai/memory/optimize?priority=true → retrieval-prioritized memory list
// GET  /api/takers-ai/memory/optimize?summary=true  → compressed memory summary
// POST /api/takers-ai/memory/optimize              → run optimization pipeline
// POST /api/takers-ai/memory/optimize?dry=true     → dry-run (preview only, no writes)
// POST /api/takers-ai/memory/optimize?compress=<id> → compress a single memory block
// PATCH /api/takers-ai/memory/optimize             → manually re-tier a block

import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import {
  runMemoryOptimization,
  getMemoryHealthStats,
  getPrioritizedMemory,
  buildMemorySummary,
  compressMemoryBlock,
  computeTargetTier,
  scoreMemoryForRetrieval,
} from "@/lib/takers-ai/memory-optimizer";
import type { MemoryTier, MemoryBlock } from "@/lib/takers-ai/memory-optimizer";
import { writeCostEvent, createCostEvent } from "@/lib/takers-ai/cost";
import type { AgentRole } from "@/lib/takers-ai/types";

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
  const showPriority = searchParams.get("priority") === "true";
  const showSummary = searchParams.get("summary") === "true";
  const agentRole = searchParams.get("agentRole") ?? undefined;
  const maxBlocks = Math.min(Number(searchParams.get("maxBlocks") ?? "15"), 50);
  const maxChars = Math.min(Number(searchParams.get("maxChars") ?? "2000"), 6000);
  const db = adminDb();

  if (showSummary) {
    const result = await buildMemorySummary(db, maxChars);
    if (result.costUsd > 0) {
      writeCostEvent(db, createCostEvent(
        "chat_generation",
        "memory-optimizer",
        "operator" as AgentRole,
        "claude-haiku-4-5",
        Math.ceil(result.summary.length / 4) + 500,
        Math.ceil(result.summary.length / 4),
      ));
    }
    return NextResponse.json(result);
  }

  if (showPriority) {
    const tiers = (searchParams.get("tiers") ?? "active,warm").split(",") as MemoryTier[];
    const minScore = Number(searchParams.get("minScore") ?? "20");
    const candidates = await getPrioritizedMemory(db, { agentRole, maxBlocks, tiersToInclude: tiers, minScore });
    return NextResponse.json({ candidates, total: candidates.length });
  }

  // Default: health stats
  const stats = await getMemoryHealthStats(db);
  return NextResponse.json(stats);
}

// ── POST: Run optimization or compress single block ───────────────────────────
export async function POST(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const isDryRun = searchParams.get("dry") === "true";
  const compressId = searchParams.get("compress");
  const db = adminDb();

  // ── Single block compression ──────────────────────────────────────────────
  if (compressId) {
    const doc = await db.collection("brandMemory").doc(compressId).get();
    if (!doc.exists) return NextResponse.json({ error: "Memory block not found" }, { status: 404 });

    const block = { id: doc.id, ...doc.data() } as MemoryBlock;
    const body = await req.json().catch(() => ({}));
    const targetLength = Number((body as { targetLength?: number }).targetLength ?? 500);

    if (block.content.length <= targetLength) {
      return NextResponse.json({
        message: "Block is already within target length. No compression needed.",
        currentLength: block.content.length,
        targetLength,
      });
    }

    const { compressed, costUsd, inputTokens, outputTokens } = await compressMemoryBlock(block, targetLength);

    if (!isDryRun) {
      await doc.ref.update({
        content: compressed,
        originalLength: block.originalLength ?? block.content.length,
        compressedAt: new Date().toISOString(),
        compressionRatio: Math.round((compressed.length / block.content.length) * 100) / 100,
        updatedAt: new Date().toISOString(),
      });

      if (costUsd > 0) {
        writeCostEvent(db, createCostEvent(
          "chat_generation",
          "memory-optimizer",
          "operator" as AgentRole,
          "claude-haiku-4-5",
          inputTokens,
          outputTokens,
        ));
      }
    }

    return NextResponse.json({
      memoryId: compressId,
      originalLength: block.content.length,
      compressedLength: compressed.length,
      compressionRatio: Math.round((compressed.length / block.content.length) * 100) / 100,
      tokensSaved: Math.ceil((block.content.length - compressed.length) / 4),
      costUsd,
      preview: compressed.slice(0, 200) + (compressed.length > 200 ? "..." : ""),
      dryRun: isDryRun,
    });
  }

  // ── Full optimization pipeline ────────────────────────────────────────────
  const body = await req.json().catch(() => ({}));
  const {
    compress = true,
    reTier = true,
    deduplicate = true,
    compressThresholdChars = 1000,
  } = body as {
    compress?: boolean;
    reTier?: boolean;
    deduplicate?: boolean;
    compressThresholdChars?: number;
  };

  const result = await runMemoryOptimization(db, {
    compress,
    reTier,
    deduplicate,
    compressThresholdChars,
    dryRun: isDryRun,
  });

  // Track compression cost
  if (result.costUsd > 0 && !isDryRun) {
    writeCostEvent(db, createCostEvent(
      "knowledge_embedding",
      "memory-optimizer",
      "operator" as AgentRole,
      "claude-haiku-4-5",
      result.compressed * 500,   // approx tokens per compression call
      result.compressed * 150,
    ));
  }

  return NextResponse.json({
    ...result,
    dryRun: isDryRun,
    message: isDryRun
      ? `Dry run complete. Would have optimized ${result.tiered + result.compressed + result.archived + result.deduplicated} blocks.`
      : `Optimization complete. Optimized ${result.tiered + result.compressed + result.archived + result.deduplicated} memory blocks.`,
  });
}

// ── PATCH: Manually re-tier a block ──────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, tier, priority, isActive } = body as {
    id?: string;
    tier?: MemoryTier;
    priority?: number;
    isActive?: boolean;
  };

  if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });

  const validTiers: MemoryTier[] = ["active", "warm", "cold", "archived"];
  if (tier && !validTiers.includes(tier)) {
    return NextResponse.json({ error: `Invalid tier. Valid: ${validTiers.join(", ")}` }, { status: 400 });
  }

  const db = adminDb();
  const doc = await db.collection("brandMemory").doc(id).get();
  if (!doc.exists) return NextResponse.json({ error: "Memory block not found." }, { status: 404 });

  const block = { id: doc.id, ...doc.data() } as MemoryBlock;
  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

  if (tier !== undefined) {
    updates.tier = tier;
    updates.isActive = tier !== "archived";
  }
  if (priority !== undefined) {
    if (priority < 1 || priority > 10) {
      return NextResponse.json({ error: "priority must be 1-10." }, { status: 400 });
    }
    updates.priority = priority;
  }
  if (isActive !== undefined) updates.isActive = isActive;

  await doc.ref.update(updates);

  // Compute new suggested tier based on updated block
  const updatedBlock = { ...block, ...updates };
  const suggestedTier = computeTargetTier({
    createdAt: block.createdAt,
    updatedAt: new Date().toISOString(),
    lastAccessedAt: block.lastAccessedAt,
    accessCount: block.accessCount ?? 0,
    priority: (priority ?? block.priority) as number,
    tier: (tier ?? block.tier) as MemoryTier,
  });

  const score = scoreMemoryForRetrieval({ ...block, ...updates } as MemoryBlock);

  return NextResponse.json({
    success: true,
    id,
    updates,
    suggestedTier,
    retrievalScore: score.score,
    shouldInject: score.shouldInject,
  });
}
