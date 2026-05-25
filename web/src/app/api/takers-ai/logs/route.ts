// Takers AI — Observability: Agent Logs
// GET    /api/takers-ai/logs              → list logs (filter by type/agent/date)
// DELETE /api/takers-ai/logs?id=<id>      → delete a single log
// DELETE /api/takers-ai/logs?purge=true   → delete all logs older than 7 days

import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import type { AgentLogType } from "@/lib/takers-ai/types";

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
  const type = searchParams.get("type") as AgentLogType | null;
  const agentRole = searchParams.get("agentRole");
  const limit = parseInt(searchParams.get("limit") ?? "100");
  const since = searchParams.get("since"); // ISO date string

  const db = adminDb();
  let query: FirebaseFirestore.Query = db
    .collection("agentLogs")
    .orderBy("createdAt", "desc")
    .limit(Math.min(limit, 500));

  if (type) query = query.where("type", "==", type);
  if (agentRole) query = query.where("agentRole", "==", agentRole);
  if (since) query = query.where("createdAt", ">=", since);

  const snap = await query.get();
  const logs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Aggregate stats from recent logs (last 100 regardless of filter)
  const recentSnap = await db
    .collection("agentLogs")
    .orderBy("createdAt", "desc")
    .limit(100)
    .get();

  const stats = {
    totalLogs: 0,
    byType: {} as Record<string, number>,
    byRole: {} as Record<string, number>,
    totalTokens: 0,
    errorCount: 0,
    avgConfidence: 0,
    confidenceCount: 0,
  };

  for (const d of recentSnap.docs) {
    const data = d.data();
    stats.totalLogs++;
    stats.byType[data.type as string] = (stats.byType[data.type as string] ?? 0) + 1;
    stats.byRole[data.agentRole as string] = (stats.byRole[data.agentRole as string] ?? 0) + 1;
    if (data.tokenUsage?.totalTokens) stats.totalTokens += data.tokenUsage.totalTokens as number;
    if (data.type === "error") stats.errorCount++;
    if (data.routingDecision?.confidence != null) {
      stats.avgConfidence += data.routingDecision.confidence as number;
      stats.confidenceCount++;
    }
  }

  if (stats.confidenceCount > 0) {
    stats.avgConfidence = Math.round(stats.avgConfidence / stats.confidenceCount);
  }

  return NextResponse.json({ logs, stats });
}

export async function DELETE(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const purge = searchParams.get("purge");

  const db = adminDb();

  if (purge === "true") {
    // Delete logs older than 7 days
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const oldSnap = await db
      .collection("agentLogs")
      .where("createdAt", "<", cutoff)
      .limit(500)
      .get();

    if (oldSnap.empty) {
      return NextResponse.json({ deleted: 0 });
    }

    const batch = db.batch();
    for (const doc of oldSnap.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
    return NextResponse.json({ deleted: oldSnap.size });
  }

  if (!id) return NextResponse.json({ error: "id or purge required." }, { status: 400 });

  await db.collection("agentLogs").doc(id).delete();
  return NextResponse.json({ success: true });
}
