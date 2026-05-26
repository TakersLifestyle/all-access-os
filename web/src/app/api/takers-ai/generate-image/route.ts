// Takers AI — Image Generation Workflow
// POST /api/takers-ai/generate-image
// Auth: Bearer token (admin only)
//
// Full workflow:
//   1. Auth + parse
//   2. Fetch verified event facts from Firestore (if eventId provided)
//   3. Analyze reference image attachments (Claude Vision)
//   4. Generate creative brief with Sonnet (4 full concepts)
//   5. Render image via connected provider (DALL-E 3 / Flux / Stability / Mock)
//   6. Save rendered image to Firebase Storage (if rendered)
//   7. Save asset record to Firestore generatedAssets
//   8. Return complete package via SSE
//
// SSE event types:
//   stage   — progress update with message
//   brief   — full CreativeBrief object
//   render  — render result (url, status)
//   done    — final asset ID + status
//   error   — non-fatal warning
//   fatal   — stream-terminating error

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { adminDb, adminAuth, adminStorage } from "@/lib/firebase-admin";
import { sanitizeForFirestore } from "@/lib/sanitize-firestore";
import { generateCreativeBrief } from "@/lib/takers-ai/creative-brief";
import { getImageProvider } from "@/lib/takers-ai/image-provider";
import {
  analyzeReferenceImages,
  buildReferenceContextBlock,
} from "@/lib/takers-ai/reference-analysis";
import { fetchLiveEvents } from "@/lib/takers-ai/event-knowledge";
import type { AttachmentMeta } from "@/lib/takers-ai/attachments";
import type { AssetFormat } from "@/lib/takers-ai/creative-brief";

const IS_DEV = process.env.NODE_ENV === "development";

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

// ── Storage helpers ───────────────────────────────────────────────────────────

/**
 * Download a URL (provider temp URL or data URL) and upload to Firebase Storage.
 * Returns public download URL, or null on failure.
 */
async function saveImageToStorage(
  imageUrl: string,
  storagePath: string
): Promise<string | null> {
  try {
    let buffer: Buffer;

    if (imageUrl.startsWith("data:")) {
      // Data URL (Stability AI returns base64)
      const base64 = imageUrl.split(",")[1];
      if (!base64) return null;
      buffer = Buffer.from(base64, "base64");
    } else {
      // Regular URL (DALL-E 3, Flux)
      const res = await fetch(imageUrl, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) return null;
      buffer = Buffer.from(await res.arrayBuffer());
    }

    const bucket = adminStorage();
    const file = bucket.file(storagePath);
    await file.save(buffer, {
      metadata: { contentType: "image/png", cacheControl: "public, max-age=31536000" },
    });
    // Make publicly accessible
    await file.makePublic();
    return `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
  } catch (err) {
    console.warn("[generate-image] Storage save failed:", String(err));
    return null;
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) {
    return new Response(
      `data: ${JSON.stringify({ type: "fatal", error: "Unauthorized" })}\n\n`,
      { status: 401, headers: { "Content-Type": "text/event-stream" } }
    );
  }

  let body: {
    subject: string;
    formats?: AssetFormat[];
    eventId?: string;
    attachments?: AttachmentMeta[];
    tone?: string;
    conversationId?: string;
    conceptIndex?: number;  // 0-3 — which concept to render (default: 0)
    agentId?: string;
  };

  try {
    body = await req.json();
  } catch {
    return new Response(
      `data: ${JSON.stringify({ type: "fatal", error: "Invalid JSON body" })}\n\n`,
      { status: 400, headers: { "Content-Type": "text/event-stream" } }
    );
  }

  const {
    subject,
    formats = ["instagram_post", "event_flyer"],
    eventId,
    tone,
    conversationId,
    conceptIndex = 0,
    agentId,
  } = body;
  const attachments: AttachmentMeta[] = Array.isArray(body.attachments) ? body.attachments : [];

  if (!subject?.trim()) {
    return new Response(
      `data: ${JSON.stringify({ type: "fatal", error: "subject is required" })}\n\n`,
      { status: 400, headers: { "Content-Type": "text/event-stream" } }
    );
  }

  const readable = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();

      function send(data: Record<string, unknown>) {
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch { /* controller already closed */ }
      }

      function stage(name: string, message: string) {
        send({ type: "stage", stage: name, message });
        if (IS_DEV) console.log(`[generate-image/${name}]`, message);
      }

      try {
        const db = adminDb();

        // ── Stage 1: Event facts ──────────────────────────────────────────────
        stage("event-facts", "Fetching verified event facts…");
        let eventFacts: {
          name?: string; date?: string; venue?: string; city?: string;
          generalPrice?: string; memberPrice?: string; access?: string;
        } | undefined;

        if (eventId) {
          try {
            const eventDoc = await db.collection("events").doc(eventId).get();
            if (eventDoc.exists) {
              const d = eventDoc.data()!;
              eventFacts = {
                name: d.title ?? d.name ?? undefined,
                date: d.date ?? d.eventDate ?? undefined,
                venue: d.venue ?? d.location ?? undefined,
                city: d.city ?? "Winnipeg",
                generalPrice: d.generalPrice !== undefined ? `$${d.generalPrice} CAD` : undefined,
                memberPrice: d.memberPrice !== undefined ? `$${d.memberPrice} CAD` : undefined,
                access: d.isMembersOnly ? "Members only" : "Open to everyone — members receive preferred pricing",
              };
            }
          } catch (err) {
            send({ type: "error", error: `Could not fetch event facts: ${String(err)}` });
          }
        } else {
          // Inject all live events as context if no specific event requested
          try {
            const events = await fetchLiveEvents(db);
            const matched = events.find((e) =>
              subject.toLowerCase().includes(e.title.toLowerCase()) ||
              e.title.toLowerCase().includes(subject.toLowerCase().split(" ")[0])
            );
            if (matched) {
              eventFacts = {
                name: matched.title,
                date: matched.date,
                venue: matched.venue,
                city: matched.city,
                generalPrice: matched.generalPrice !== undefined ? `$${matched.generalPrice} CAD` : undefined,
                memberPrice: matched.memberPrice !== undefined ? `$${matched.memberPrice} CAD` : undefined,
                access: matched.isMembersOnly ? "Members only" : "Open to everyone — members receive preferred pricing",
              };
            }
          } catch { /* fail silently */ }
        }

        send({ type: "stage", stage: "event-facts", message: eventFacts ? `Event facts loaded: ${eventFacts.name ?? subject}` : "No specific event facts — using creative assumptions." });

        // ── Stage 2: Reference image analysis ────────────────────────────────
        const imageAttachments = attachments.filter((a) => a.type === "image");
        let referenceContextBlock = "";

        if (imageAttachments.length > 0) {
          stage("reference-analysis", `Analyzing ${imageAttachments.length} reference image(s) via Claude Vision…`);
          try {
            const { primary, imageCount } = await analyzeReferenceImages(imageAttachments);
            if (primary && primary.confidence > 20) {
              referenceContextBlock = buildReferenceContextBlock(primary);
              send({
                type: "stage",
                stage: "reference-analysis",
                message: `Reference analyzed: ${primary.overallAesthetic} — ${primary.colorMood}`,
                referenceAnalysis: {
                  aesthetic: primary.overallAesthetic,
                  colorMood: primary.colorMood,
                  confidence: primary.confidence,
                  imageCount,
                },
              });
            } else {
              send({ type: "error", error: "Reference image analysis had low confidence — using brand defaults." });
            }
          } catch (err) {
            send({ type: "error", error: `Reference analysis failed: ${String(err)}` });
          }
        }

        // ── Stage 3: Creative brief generation ───────────────────────────────
        stage("brief", "Generating 4 full creative concepts with Sonnet…");

        const brief = await generateCreativeBrief({
          subject,
          formats,
          eventFacts,
          tone,
          agentId,
          conversationId,
          context: referenceContextBlock || undefined,
        });

        send({ type: "brief", brief });
        stage("brief", `Brief complete. ${brief.concepts?.length ?? 1} concept(s) generated.`);

        // Pick the concept to render
        const targetConcept = brief.concepts?.[Math.min(conceptIndex, (brief.concepts?.length ?? 1) - 1)];
        const renderPrompt = targetConcept?.imageGenPrompt ?? brief.imageGenPrompt;
        const primaryFormat = formats[0] ?? "instagram_post";

        // ── Stage 4: Image rendering ──────────────────────────────────────────
        const provider = getImageProvider();
        stage("rendering", `Rendering with ${provider.isConnected ? provider.type : "mock provider"}…`);

        let renderResult = await provider.generate({
          prompt: renderPrompt,
          format: primaryFormat,
          agentId,
          conversationId,
        });

        // ── Stage 5: Save to Firebase Storage (if rendered) ───────────────────
        let storedUrl: string | null = null;
        const assetId = `asset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        if (renderResult.status === "rendered" && renderResult.url) {
          stage("saving", "Saving rendered image to Firebase Storage…");
          const storagePath = `takers-ai/generated-assets/${decoded.uid}/${assetId}/image.png`;
          storedUrl = await saveImageToStorage(renderResult.url, storagePath);
          if (storedUrl) {
            renderResult = { ...renderResult, storedUrl };
            stage("saving", "Image saved to Storage.");
          } else {
            send({ type: "error", error: "Storage save failed — using temporary provider URL." });
          }
        }

        // ── Stage 6: Save asset record to Firestore ───────────────────────────
        stage("firestore", "Saving asset record to Firestore…");
        try {
          const assetRecord = sanitizeForFirestore({
            id: assetId,
            assetType: "creative_brief",
            title: `${subject} — ${primaryFormat} ${new Date().toLocaleDateString("en-CA")}`,
            content: JSON.stringify(brief, null, 2),
            subject,
            format: primaryFormat,
            formats,
            conceptIndex,
            renderStatus: renderResult.status,
            providerType: renderResult.providerType,
            providerMessage: renderResult.providerMessage,
            imageUrl: storedUrl ?? renderResult.url ?? null,
            imagePrompt: renderPrompt,
            canvaPrompt: targetConcept?.canvaPrompt ?? brief.canvaPrompt,
            eventFacts: eventFacts ?? null,
            hasReferenceImage: imageAttachments.length > 0,
            agentId: agentId ?? null,
            conversationId: conversationId ?? null,
            userId: decoded.uid,
            tags: ["creative", "image", primaryFormat],
            createdAt: new Date().toISOString(),
          }) as Record<string, unknown>;

          await db.collection("generatedAssets").doc(assetId).set(assetRecord);

          // Also save to imagePrompts collection for reuse
          await db.collection("imagePrompts").doc().set(sanitizeForFirestore({
            prompt: renderPrompt,
            canvaPrompt: targetConcept?.canvaPrompt ?? brief.canvaPrompt,
            subject,
            format: primaryFormat,
            providerType: renderResult.providerType,
            renderStatus: renderResult.status,
            assetId,
            conversationId: conversationId ?? null,
            userId: decoded.uid,
            createdAt: new Date().toISOString(),
          }) as Record<string, unknown>);
        } catch (err) {
          send({ type: "error", error: `Firestore save failed: ${String(err)}` });
        }

        // ── Stage 7: Send render result ───────────────────────────────────────
        send({
          type: "render",
          assetId,
          renderStatus: renderResult.status,
          url: storedUrl ?? renderResult.url ?? null,
          providerType: renderResult.providerType,
          providerMessage: renderResult.providerMessage,
          readyToRenderNote: renderResult.readyToRenderNote ?? null,
          imagePrompt: renderPrompt,
          canvaPrompt: targetConcept?.canvaPrompt ?? brief.canvaPrompt,
          durationMs: renderResult.durationMs ?? null,
        });

        // ── Done ──────────────────────────────────────────────────────────────
        send({
          type: "done",
          assetId,
          renderStatus: renderResult.status,
          subject,
          conceptsGenerated: brief.concepts?.length ?? 1,
          imageUrl: storedUrl ?? renderResult.url ?? null,
          providerConnected: provider.isConnected,
          providerType: renderResult.providerType,
        });

        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[generate-image] fatal:", msg);
        try {
          controller.enqueue(
            enc.encode(`data: ${JSON.stringify({ type: "fatal", error: msg })}\n\n`)
          );
        } catch { /* already closed */ }
        try { controller.close(); } catch { /* ignore */ }
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
