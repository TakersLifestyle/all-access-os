// Takers AI — Strategic Planning API
//
// POST /api/takers-ai/planner              → generate execution plan(s) for an objective
// GET  /api/takers-ai/planner              → list saved plans
// GET  /api/takers-ai/planner?id=<id>      → single plan
// PATCH /api/takers-ai/planner             → promote plan to workflow definition
// DELETE /api/takers-ai/planner?id=<id>    → delete a saved plan

import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import {
  generatePlan,
  savePlan,
  promotePlanToWorkflow,
} from "@/lib/takers-ai/planner";
import type { PlanRequest, PlanStrategy } from "@/lib/takers-ai/planner";
import type { AgentRole } from "@/lib/takers-ai/types";
import { checkRateLimit } from "@/lib/takers-ai/rate-limiter";
import { writeCostEvent, createCostEvent } from "@/lib/takers-ai/cost";
import { writeAuditEvent } from "@/lib/takers-ai/audit";
import { writeImprovementSignal } from "@/lib/takers-ai/self-improvement";

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
    const doc = await db.collection("executionPlans").doc(id).get();
    if (!doc.exists) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    return NextResponse.json({ plan: { id: doc.id, ...doc.data() } });
  }

  const snap = await db
    .collection("executionPlans")
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  const plans = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return NextResponse.json({ plans, total: snap.size });
}

// ── POST: Generate plan(s) ────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = adminDb();

  // Rate limit on default route (planning is moderate cost)
  const rateResult = await checkRateLimit(db, decoded.uid, "default");
  if (!rateResult.allowed) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Retry after ${Math.ceil(rateResult.retryAfterMs / 1000)}s.` },
      { status: 429 }
    );
  }

  const body = await req.json();
  const {
    objective,
    context,
    existingOutputs,
    constraints,
    strategies,
    save = true,
  } = body as PlanRequest & { save?: boolean };

  if (!objective?.trim()) {
    return NextResponse.json({ error: "objective required." }, { status: 400 });
  }

  const startedAt = Date.now();

  try {
    const request: PlanRequest = {
      objective: objective.trim(),
      context: context?.trim(),
      existingOutputs,
      constraints,
      strategies: strategies as PlanStrategy[] | undefined,
    };

    const response = await generatePlan(request);

    // Track cost (planning call)
    const costData = createCostEvent(
      "chat_generation",
      "planner",
      "strategy" as AgentRole,
      "claude-sonnet-4-5",
      response.plans[0]?.plannerInputTokens ?? 0,
      response.plans[0]?.plannerOutputTokens ?? 0,
    );
    writeCostEvent(db, costData);

    // Save plans to Firestore if requested
    if (save) {
      for (const plan of response.plans) {
        savePlan(db, plan, decoded.uid);
      }
    }

    // Audit event
    writeAuditEvent(db, "pipeline_created", "workflow_definition", "planner",
      { uid: decoded.uid, role: "admin" },
      {
        payload: {
          objective: objective.slice(0, 200),
          plansGenerated: response.plans.length,
          plannerCostUsd: response.plannerCostUsd,
          durationMs: Date.now() - startedAt,
        },
      }
    );

    // Improvement signal
    writeImprovementSignal(db, {
      type: "plan_accepted",
      metadata: {
        objective: objective.slice(0, 200),
        strategies: response.plans.map((p) => p.strategy),
        recommended: response.recommended,
      },
    });

    return NextResponse.json(response, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── PATCH: Promote plan to workflow definition ────────────────────────────────
export async function PATCH(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { planId, action } = body as { planId?: string; action?: string };

  if (!planId) return NextResponse.json({ error: "planId required." }, { status: 400 });
  if (action !== "promote") return NextResponse.json({ error: "action must be 'promote'." }, { status: 400 });

  const db = adminDb();
  const doc = await db.collection("executionPlans").doc(planId).get();
  if (!doc.exists) return NextResponse.json({ error: "Plan not found." }, { status: 404 });

  const plan = { id: doc.id, ...doc.data() } as Parameters<typeof promotePlanToWorkflow>[1];
  const definitionId = await promotePlanToWorkflow(db, plan, decoded.uid);

  writeAuditEvent(db, "pipeline_created", "workflow_definition", definitionId,
    { uid: decoded.uid, role: "admin" },
    { payload: { promotedFromPlanId: planId, planStrategy: plan.strategy } }
  );

  return NextResponse.json({ success: true, definitionId, planId });
}

// ── DELETE ────────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });

  await adminDb().collection("executionPlans").doc(id).delete();
  return NextResponse.json({ success: true });
}
