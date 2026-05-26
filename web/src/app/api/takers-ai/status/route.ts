// Takers AI — System Status API
// GET /api/takers-ai/status
// Returns: provider connection status, active events, memory blocks, agent list
// Auth: admin only

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
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = adminDb();

  // Determine image provider
  const imageProvider = process.env.OPENAI_API_KEY
    ? "openai"
    : process.env.REPLICATE_API_KEY
    ? "replicate"
    : process.env.STABILITY_API_KEY
    ? "stability"
    : "mock";

  const [eventsSnap, memorySnap, agentsSnap] = await Promise.allSettled([
    db.collection("events").get(),
    db.collection("brandMemory").where("isActive", "==", true).orderBy("priority", "desc").get(),
    db.collection("agents").where("isActive", "==", true).get(),
  ]);

  const events = eventsSnap.status === "fulfilled"
    ? eventsSnap.value.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          title: data.title ?? data.name ?? "Unnamed",
          date: data.date ?? data.eventDate ?? "TBD",
          venue: data.venue ?? data.location ?? null,
          generalPrice: data.generalPrice ?? null,
          memberPrice: data.memberPrice ?? null,
          status: data.status ?? "active",
          capacity: data.capacity ?? null,
          ticketsRemaining: data.ticketsRemaining ?? null,
          isMembersOnly: data.isMembersOnly ?? false,
        };
      })
    : [];

  const memoryBlocks = memorySnap.status === "fulfilled"
    ? memorySnap.value.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          key: data.key,
          title: data.title,
          category: data.category,
          priority: data.priority,
          isActive: data.isActive,
          contentLength: (data.content as string)?.length ?? 0,
          updatedAt: data.updatedAt,
        };
      })
    : [];

  const agents = agentsSnap.status === "fulfilled"
    ? agentsSnap.value.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name,
          role: data.role,
          model: data.model,
          maxTokens: data.maxTokens,
          isDefault: data.isDefault ?? false,
          isActive: data.isActive ?? true,
        };
      })
    : [];

  const warnings: string[] = [];
  if (imageProvider === "mock") warnings.push("No image provider connected — add OPENAI_API_KEY to Vercel to enable real image generation.");
  const seaBears = events.find((e) => e.title?.toLowerCase().includes("sea bears"));
  if (seaBears && seaBears.date === "TBD") warnings.push("Sea Bears event date is TBD — verify in Firestore.");
  if (memoryBlocks.length < 5) warnings.push("Brand memory has fewer than 5 active blocks — run seed-brand-knowledge.mjs.");

  return NextResponse.json({
    providers: {
      image: imageProvider,
      imageConnected: imageProvider !== "mock",
      anthropicConnected: !!process.env.ANTHROPIC_API_KEY,
    },
    events,
    memoryBlocks,
    agents,
    warnings,
    timestamp: new Date().toISOString(),
  });
}
