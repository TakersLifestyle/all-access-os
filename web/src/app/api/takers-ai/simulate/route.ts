// Takers AI — Pipeline Simulation & Dry-Run API
//
// POST /api/takers-ai/simulate                       → simulate a pipeline (by definitionId)
// POST /api/takers-ai/simulate?adhoc=true            → simulate ad-hoc step list
// GET  /api/takers-ai/simulate?id=<simId>            → retrieve a saved simulation
// GET  /api/takers-ai/simulate                       → list recent simulations
// POST /api/takers-ai/simulate?compare=true          → compare model downgrade options

import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import {
  simulatePipeline,
  simulateAdHocSteps,
  computeModelDowngradeOptions,
} from "@/lib/takers-ai/simulation";
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
  const id = searchParams.get("id");
  const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 100);
  const db = adminDb();

  if (id) {
    const doc = await db.collection("simulationResults").doc(id).get();
    if (!doc.exists) return NextResponse.json({ error: "Simulation not found" }, { status: 404 });
    return NextResponse.json({ simulation: { id: doc.id, ...doc.data() } });
  }

  const snap = await db
    .collection("simulationResults")
    .orderBy("simulatedAt", "desc")
    .limit(limit)
    .get();
  const simulations = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return NextResponse.json({ simulations, total: snap.size });
}

// ── POST: Run simulation ──────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const isAdhoc = searchParams.get("adhoc") === "true";
  const isCompare = searchParams.get("compare") === "true";
  const db = adminDb();

  // ── Compare mode: show model downgrade savings ────────────────────────────
  if (isCompare) {
    const body = await req.json();
    const { simulationId, definitionId, variables = {}, budgetLimitUsd } = body as {
      simulationId?: string;
      definitionId?: string;
      variables?: Record<string, string>;
      budgetLimitUsd?: number;
    };

    let result;
    if (simulationId) {
      const doc = await db.collection("simulationResults").doc(simulationId).get();
      if (!doc.exists) return NextResponse.json({ error: "Simulation not found" }, { status: 404 });
      result = doc.data();
    } else if (definitionId) {
      result = await simulatePipeline(db, definitionId, variables, { budgetLimitUsd });
    } else {
      return NextResponse.json({ error: "simulationId or definitionId required." }, { status: 400 });
    }

    const downgradeOptions = computeModelDowngradeOptions(result as Parameters<typeof computeModelDowngradeOptions>[0]);
    const totalCurrentCost = (result as { totalEstimatedCostUsd: number }).totalEstimatedCostUsd;
    const totalDowngradedCost = downgradeOptions.reduce(
      (sum, o) => sum + o.haikuCostUsd, totalCurrentCost - downgradeOptions.reduce((s, o) => s + o.currentCostUsd, 0)
    );

    return NextResponse.json({
      currentTotalCostUsd: totalCurrentCost,
      downgradeScenarioTotalCostUsd: Math.round(totalDowngradedCost * 1_000_000) / 1_000_000,
      potentialSavingsUsd: Math.round((totalCurrentCost - totalDowngradedCost) * 1_000_000) / 1_000_000,
      steps: downgradeOptions,
    });
  }

  // ── Ad-hoc simulation ─────────────────────────────────────────────────────
  if (isAdhoc) {
    const body = await req.json();
    const {
      steps,
      variables = {},
      objective,
      budgetLimitUsd,
      save = false,
    } = body as {
      steps: Array<{
        name: string;
        agentRole: AgentRole;
        promptTemplate: string;
        outputKey: string;
        requiresApproval: boolean;
      }>;
      variables?: Record<string, string>;
      objective?: string;
      budgetLimitUsd?: number;
      save?: boolean;
    };

    if (!Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json({ error: "steps array required." }, { status: 400 });
    }
    if (steps.length > 20) {
      return NextResponse.json({ error: "Max 20 steps per simulation." }, { status: 400 });
    }

    const result = simulateAdHocSteps(steps, variables, { objective, budgetLimitUsd });

    if (save) {
      db.collection("simulationResults").doc().set({ ...result, createdBy: decoded.uid })
        .catch(console.error);
    }

    return NextResponse.json(result);
  }

  // ── Definition-based simulation ───────────────────────────────────────────
  const body = await req.json();
  const {
    definitionId,
    variables = {},
    budgetLimitUsd,
    checkCurrentBudget = false,
    save = true,
  } = body as {
    definitionId?: string;
    variables?: Record<string, string>;
    budgetLimitUsd?: number;
    checkCurrentBudget?: boolean;
    save?: boolean;
  };

  if (!definitionId) {
    return NextResponse.json({ error: "definitionId required (or use ?adhoc=true for ad-hoc steps)." }, { status: 400 });
  }

  const result = await simulatePipeline(db, definitionId, variables, {
    budgetLimitUsd,
    checkCurrentBudget,
  });

  if (save) {
    db.collection("simulationResults").doc().set({ ...result, createdBy: decoded.uid })
      .catch(console.error);
  }

  return NextResponse.json(result);
}
