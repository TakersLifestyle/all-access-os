// Takers AI — Agents CRUD
// GET /api/takers-ai/agents — list all agents
// POST /api/takers-ai/agents — create agent

import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import type { Agent } from "@/lib/takers-ai/types";

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
  if (!await verifyAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = adminDb();
  // NOTE: Do NOT use orderBy("createdAt") — Firestore silently excludes documents
  // that don't have the field, which hides agents that were seeded without it.
  // Sort in JS after fetching all documents instead.
  const snap = await db.collection("agents").get();
  const agents = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      // Normalise missing display fields so the UI always has something to render
      icon: data.icon ?? "🤖",
      color: data.color ?? "bg-red-600",
      description: data.description ?? "",
      tools: Array.isArray(data.tools) ? data.tools : [],
      createdAt: data.createdAt ?? data.updatedAt ?? new Date().toISOString(),
      updatedAt: data.updatedAt ?? new Date().toISOString(),
      ...data,
    };
  }) as Agent[];

  // Sort: default operator first, then by createdAt ascending
  agents.sort((a, b) => {
    if (a.isDefault) return -1;
    if (b.isDefault) return 1;
    return (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
  });

  return NextResponse.json({ agents });
}

export async function POST(req: NextRequest) {
  if (!await verifyAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const { name, role, description, systemPrompt, icon, color, model, maxTokens } = body;

  if (!name || !role || !systemPrompt) {
    return NextResponse.json({ error: "name, role, and systemPrompt are required." }, { status: 400 });
  }

  const db = adminDb();
  const ref = db.collection("agents").doc();
  const now = new Date().toISOString();
  const agent = {
    name,
    role,
    description: description ?? "",
    systemPrompt,
    icon: icon ?? "🤖",
    color: color ?? "bg-red-600",
    model: model ?? "claude-sonnet-4-5",
    maxTokens: maxTokens ?? 2048,
    isActive: true,
    isDefault: false,
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(agent);
  return NextResponse.json({ agent: { id: ref.id, ...agent } }, { status: 201 });
}
