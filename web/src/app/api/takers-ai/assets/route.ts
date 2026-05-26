// Takers AI — Generated Assets API
// GET  /api/takers-ai/assets   — list recent generated assets
// POST /api/takers-ai/assets   — save a new generated asset

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";

async function verifyAdmin(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const decoded = await adminAuth().verifyIdToken(authHeader.slice(7));
    if (decoded.role !== "admin") return null;
    return decoded;
  } catch {
    return null;
  }
}

// ── GET — list recent generated assets ───────────────────────────────────────

export async function GET(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 50);
  const assetType = searchParams.get("type"); // "creative_brief" | "image_prompt" | "canva_prompt"
  const conversationId = searchParams.get("conversationId");

  try {
    const db = adminDb();
    let query: FirebaseFirestore.Query = db
      .collection("generatedAssets")
      .orderBy("createdAt", "desc")
      .limit(limit);

    if (assetType) {
      query = query.where("assetType", "==", assetType);
    }
    if (conversationId) {
      query = query.where("conversationId", "==", conversationId);
    }

    const snap = await query.get();
    const assets = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    return NextResponse.json({ assets, count: assets.length });
  } catch (err) {
    console.error("[assets/GET]", err);
    return NextResponse.json(
      { error: "Failed to fetch assets", detail: String(err) },
      { status: 500 }
    );
  }
}

// ── POST — save a generated asset ────────────────────────────────────────────

export interface GeneratedAsset {
  id?: string;
  assetType: "creative_brief" | "image_prompt" | "canva_prompt" | "caption" | "campaign_copy" | "other";
  title: string;
  content: string;              // The actual asset content (prompt, copy, etc.)
  subject?: string;             // What the asset is for
  format?: string;              // Target format (instagram_post, event_flyer, etc.)
  renderStatus?: "ready_to_render" | "rendered" | "pending";
  renderedUrl?: string;         // URL if rendered image exists
  agentId?: string;
  conversationId?: string;
  briefId?: string;             // Link to parent creative brief if applicable
  tags?: string[];
  createdAt?: string;
}

export async function POST(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Partial<GeneratedAsset>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.assetType || !body.title || !body.content) {
    return NextResponse.json(
      { error: "assetType, title, and content are required" },
      { status: 400 }
    );
  }

  try {
    const db = adminDb();
    const docRef = db.collection("generatedAssets").doc();
    const asset: GeneratedAsset = {
      assetType: body.assetType!,
      title: body.title!,
      content: body.content!,
      ...body,
      id: docRef.id,
      renderStatus: body.renderStatus ?? "ready_to_render",
      createdAt: new Date().toISOString(),
    };

    await docRef.set(asset);

    return NextResponse.json({ id: docRef.id, asset }, { status: 201 });
  } catch (err) {
    console.error("[assets/POST]", err);
    return NextResponse.json(
      { error: "Failed to save asset", detail: String(err) },
      { status: 500 }
    );
  }
}
