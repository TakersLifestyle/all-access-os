// Takers AI — Cost Intelligence API
//
// GET  /api/takers-ai/cost              → full cost report (last 30 days)
// GET  /api/takers-ai/cost?since=<iso>  → report from date
// GET  /api/takers-ai/cost?budget=<n>   → report with budget check
// GET  /api/takers-ai/cost?event=<id>   → single cost event
// GET  /api/takers-ai/cost?events=true  → list recent cost events
// GET  /api/takers-ai/cost?secrets=true → secret readiness check
// GET  /api/takers-ai/cost?health=true  → queue health + concurrency status
// GET  /api/takers-ai/cost?pricing=true → model pricing table
// POST /api/takers-ai/cost              → manual cost event (for external tools)

import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import {
  computeCostReport,
  MODEL_PRICING,
  VOYAGE_PRICING_PER_1M,
  formatCost,
} from "@/lib/takers-ai/cost";
import {
  checkSecretReadiness,
  getQueueHealth,
} from "@/lib/takers-ai/rate-limiter";

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
  const since = searchParams.get("since") ?? undefined;
  const budget = searchParams.get("budget");
  const eventId = searchParams.get("event");
  const showEvents = searchParams.get("events") === "true";
  const showSecrets = searchParams.get("secrets") === "true";
  const showHealth = searchParams.get("health") === "true";
  const showPricing = searchParams.get("pricing") === "true";
  const limit = Math.min(Number(searchParams.get("limit") ?? "100"), 500);
  const db = adminDb();

  // Secret readiness (no DB needed)
  if (showSecrets) {
    const secrets = checkSecretReadiness();
    const allPresent = secrets.every((s) => s.present);
    const required = ["ANTHROPIC_API_KEY", "FIREBASE_SERVICE_ACCOUNT_KEY", "STRIPE_SECRET_KEY"];
    const missingRequired = secrets.filter((s) => required.includes(s.key) && !s.present);
    return NextResponse.json({
      secrets,
      allPresent,
      missingRequired: missingRequired.map((s) => s.key),
      readyForProduction: missingRequired.length === 0,
    });
  }

  // Model pricing table
  if (showPricing) {
    const pricing = Object.entries(MODEL_PRICING).map(([model, p]) => ({
      model,
      inputPer1M: p.inputPer1M,
      outputPer1M: p.outputPer1M,
      inputFormatted: formatCost(p.inputPer1M / 1000),    // per 1K tokens
      outputFormatted: formatCost(p.outputPer1M / 1000),
    }));
    return NextResponse.json({
      generation: pricing,
      embedding: {
        model: "voyage-3-lite",
        per1M: VOYAGE_PRICING_PER_1M,
        per1K: formatCost(VOYAGE_PRICING_PER_1M / 1000),
      },
    });
  }

  // Queue health
  if (showHealth) {
    const health = await getQueueHealth(db);
    return NextResponse.json(health);
  }

  // Single cost event
  if (eventId) {
    const doc = await db.collection("costEvents").doc(eventId).get();
    if (!doc.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ event: { id: doc.id, ...doc.data() } });
  }

  // List recent cost events
  if (showEvents) {
    const snap = await db
      .collection("costEvents")
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();
    const events = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ events, total: snap.size });
  }

  // Full cost report
  const budgetLimitUsd = budget ? parseFloat(budget) : undefined;
  const report = await computeCostReport(db, { since, budgetLimitUsd });

  return NextResponse.json(report);
}

// ── POST: Record a manual cost event ─────────────────────────────────────────
export async function POST(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    source,
    agentId = "manual",
    agentRole = null,
    model,
    inputTokens = 0,
    outputTokens = 0,
    workflowRunId,
    pipelineRunId,
    definitionId,
    conversationId,
  } = body;

  if (!source || !model) {
    return NextResponse.json({ error: "source, model required." }, { status: 400 });
  }

  const { createCostEvent, writeCostEvent } = await import("@/lib/takers-ai/cost");
  const db = adminDb();

  const costData = createCostEvent(source, agentId, agentRole, model, inputTokens, outputTokens, {
    workflowRunId,
    pipelineRunId,
    definitionId,
    conversationId,
  });

  writeCostEvent(db, costData);

  return NextResponse.json({
    totalCostUsd: costData.totalCostUsd,
    formatted: formatCost(costData.totalCostUsd),
    success: true,
  }, { status: 201 });
}
