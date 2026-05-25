// Takers AI — Tool Invocation API
//
// GET    /api/takers-ai/tools              → list available tool definitions
// GET    /api/takers-ai/tools?calls=true   → list recent tool calls
// GET    /api/takers-ai/tools?id=<callId>  → single call status + result
// POST   /api/takers-ai/tools             → create a tool call request (pending_approval)
// PATCH  /api/takers-ai/tools             → execute an approved tool call
// DELETE /api/takers-ai/tools?id=<callId> → cancel a pending call
//
// Execution flow:
//   1. POST creates toolCall + approvalQueue item (status: pending_approval)
//   2. Admin reviews in /takers-ai/approvals → approves
//   3. Approval PUT /api/takers-ai/approvals updates approval → "approved"
//   4. PATCH /api/takers-ai/tools { id, action: "execute" } runs the tool
//   5. Result saved to toolCall.output; toolCall.status = "completed"

import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import {
  TOOL_REGISTRY,
  createToolCallRecord,
  validateToolInputs,
  formatToolCallForApproval,
  executeToolCall,
  getAllTools,
} from "@/lib/takers-ai/tools";
import type { ToolName } from "@/lib/takers-ai/tools";
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
  const showCalls = searchParams.get("calls") === "true";
  const status = searchParams.get("status");
  const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 200);

  // Single call
  if (id) {
    const doc = await adminDb().collection("toolCalls").doc(id).get();
    if (!doc.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ call: { id: doc.id, ...doc.data() } });
  }

  // List calls
  if (showCalls) {
    const db = adminDb();
    let query: FirebaseFirestore.Query = db
      .collection("toolCalls")
      .orderBy("requestedAt", "desc")
      .limit(limit);
    if (status) query = query.where("status", "==", status);
    const snap = await query.get();
    const calls = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ calls, total: snap.size });
  }

  // List tool definitions
  return NextResponse.json({ tools: getAllTools() });
}

// ── POST: Create tool call request ────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    tool,
    inputs,
    agentId,
    agentRole = "operator",
    agentName = "Unknown Agent",
    conversationId,
    workflowRunId,
    pipelineRunId,
  } = body as {
    tool: ToolName;
    inputs: Record<string, unknown>;
    agentId: string;
    agentRole?: AgentRole;
    agentName?: string;
    conversationId?: string;
    workflowRunId?: string;
    pipelineRunId?: string;
  };

  if (!tool || !agentId || !inputs) {
    return NextResponse.json({ error: "tool, agentId, inputs required." }, { status: 400 });
  }

  const toolDef = TOOL_REGISTRY[tool];
  if (!toolDef) {
    return NextResponse.json({
      error: `Unknown tool: "${tool}". Valid tools: ${Object.keys(TOOL_REGISTRY).join(", ")}`,
    }, { status: 400 });
  }

  // Validate inputs
  const validation = validateToolInputs(tool, inputs);
  if (!validation.valid) {
    return NextResponse.json({ error: "Invalid inputs.", details: validation.errors }, { status: 400 });
  }

  const db = adminDb();
  const now = new Date().toISOString();

  // Create tool call record
  const callData = createToolCallRecord(tool, inputs, agentId, agentRole, agentName, {
    conversationId,
    workflowRunId,
    pipelineRunId,
  });
  const callRef = db.collection("toolCalls").doc();
  await callRef.set(callData);

  // Create approval queue item
  const approvalContent = formatToolCallForApproval(tool, inputs);
  const approvalRef = db.collection("approvalQueue").doc();
  await approvalRef.set({
    type: "workflow_step",
    title: `Tool Request: ${toolDef.label}`,
    description: toolDef.approvalNote,
    content: approvalContent,
    context: {
      toolCallId: callRef.id,
      tool,
      agentId,
      agentRole,
      conversationId: conversationId ?? null,
      workflowRunId: workflowRunId ?? null,
      pipelineRunId: pipelineRunId ?? null,
    },
    requestedBy: `agent:${agentId}`,
    agentId,
    agentRole,
    agentName,
    workflowRunId: workflowRunId ?? null,
    status: "pending",
    priority: tool === "stripe_lookup" ? "high" : "medium",
    reviewedBy: null,
    reviewedAt: null,
    reviewNote: null,
    createdAt: now,
    expiresAt: null,
  });

  // Link approval item back to call
  await callRef.update({ approvalItemId: approvalRef.id });

  return NextResponse.json({
    id: callRef.id,
    tool,
    status: "pending_approval",
    approvalItemId: approvalRef.id,
    message: `Tool call queued for approval. Review at /takers-ai/approvals.`,
  }, { status: 201 });
}

// ── PATCH: Execute approved tool call ─────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, action } = body as { id: string; action: "execute" | "cancel" };

  if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });

  const db = adminDb();
  const callDoc = await db.collection("toolCalls").doc(id).get();
  if (!callDoc.exists) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const call = callDoc.data()!;

  if (action === "cancel") {
    if (call.status !== "pending_approval") {
      return NextResponse.json({ error: "Can only cancel pending_approval calls." }, { status: 400 });
    }
    await db.collection("toolCalls").doc(id).update({
      status: "rejected",
      errorMessage: "Cancelled by admin",
    });
    return NextResponse.json({ success: true, status: "rejected" });
  }

  if (action === "execute") {
    if (call.status !== "approved") {
      return NextResponse.json({
        error: `Cannot execute — status is "${call.status}". Must be "approved" first.`,
      }, { status: 400 });
    }

    await db.collection("toolCalls").doc(id).update({
      status: "executing",
      executedAt: new Date().toISOString(),
    });

    const result = await executeToolCall(
      call.tool as ToolName,
      call.inputs as Record<string, unknown>
    );

    await db.collection("toolCalls").doc(id).update({
      status: result.success ? "completed" : "failed",
      output: result.output,
      outputSummary: result.summary,
      errorMessage: result.success ? null : result.summary,
    });

    return NextResponse.json({
      id,
      status: result.success ? "completed" : "failed",
      output: result.output,
      summary: result.summary,
    });
  }

  return NextResponse.json({ error: "Unknown action. Use: execute | cancel" }, { status: 400 });
}

// ── DELETE ────────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });

  await adminDb().collection("toolCalls").doc(id).delete();
  return NextResponse.json({ success: true });
}
