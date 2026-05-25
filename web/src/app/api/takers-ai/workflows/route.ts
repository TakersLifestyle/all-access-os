// Takers AI — Workflow Runs (read-only from client; written by chat route)
// GET /api/takers-ai/workflows          — list recent runs
// GET /api/takers-ai/workflows?id=xxx   — single run

import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";

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
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 100);
  const db = adminDb();

  if (id) {
    const doc = await db.collection("workflowRuns").doc(id).get();
    if (!doc.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ run: { id: doc.id, ...doc.data() } });
  }

  const snap = await db.collection("workflowRuns").orderBy("startedAt", "desc").limit(limit).get();
  const runs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return NextResponse.json({ runs });
}

export async function DELETE(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });

  await adminDb().collection("workflowRuns").doc(id).delete();
  return NextResponse.json({ success: true });
}
