// Takers AI — Safe-Mode Chat Route
// POST /api/takers-ai/chat/safe
//
// Minimal, zero-dependency Claude completion.
// No planner. No reflection. No knowledge retrieval.
// No Firestore reads beyond agent fetch + auth.
//
// Use this to:
//   1. Verify Anthropic API key + streaming work in isolation
//   2. Bypass any orchestration layer failure
//   3. Test chat UI without backend complexity
//
// Returns the same SSE event shape as /api/takers-ai/chat
// so the client doesn't need changes.
//
// SSE events: text | done | error

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { adminAuth } from "@/lib/firebase-admin";

const DEFAULT_SYSTEM = `You are Takers AI — the intelligent operating system for ALL ACCESS Winnipeg.
You are helpful, direct, and community-first.
ALL ACCESS Winnipeg is a non-profit community organization in Winnipeg, Manitoba.
Answer questions clearly and concisely.`;

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

export async function POST(req: NextRequest) {
  // Auth
  const decoded = await verifyAdmin(req);
  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Validate API key before anything else
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured on this server." },
      { status: 503 }
    );
  }

  // Parse body
  let body: {
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    model?: string;
    systemPrompt?: string;
    maxTokens?: number;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { messages, model = "claude-haiku-4-5", systemPrompt, maxTokens = 1024 } = body;

  if (!messages?.length) {
    return NextResponse.json({ error: "messages array is required." }, { status: 400 });
  }

  const lastMsg = messages[messages.length - 1];
  if (!lastMsg?.content?.trim()) {
    return NextResponse.json({ error: "Last message content is empty." }, { status: 400 });
  }

  const system = systemPrompt?.trim() || DEFAULT_SYSTEM;
  const clampedMaxTokens = Math.min(Math.max(maxTokens, 256), 4096);

  console.log(`[chat/safe] start model=${model} messages=${messages.length} uid=${decoded.uid}`);

  const anthropic = new Anthropic({ apiKey });

  const readable = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (data: Record<string, unknown>) => {
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          /* ignore — controller may already be closed */
        }
      };

      const startedAt = Date.now();
      let fullResponse = "";

      try {
        const stream = anthropic.messages.stream({
          model,
          max_tokens: clampedMaxTokens,
          system,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        });

        for await (const chunk of stream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            const text = chunk.delta.text;
            fullResponse += text;
            send({ type: "text", text });
          }
        }

        const finalMsg = await stream.finalMessage();
        const durationMs = Date.now() - startedAt;

        console.log(
          `[chat/safe] done inputTokens=${finalMsg.usage.input_tokens} outputTokens=${finalMsg.usage.output_tokens} durationMs=${durationMs}`
        );

        send({
          type: "done",
          conversationId: null,
          workflowRunId: null,
          tokenUsage: {
            inputTokens: finalMsg.usage.input_tokens,
            outputTokens: finalMsg.usage.output_tokens,
            totalTokens: finalMsg.usage.input_tokens + finalMsg.usage.output_tokens,
          },
          durationMs,
          safeMode: true,
        });

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[chat/safe] error: ${msg}`);
        send({ type: "error", error: msg, stage: "claude-stream", safeMode: true });
      }

      try { controller.close(); } catch { /* ignore */ }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
      "X-Safe-Mode": "true",
    },
  });
}

// ── Health check ──────────────────────────────────────────────────────────────
// GET /api/takers-ai/chat/safe — returns env/config status for debugging
export async function GET(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const checks = {
    anthropicApiKey: !!process.env.ANTHROPIC_API_KEY
      ? `set (${process.env.ANTHROPIC_API_KEY.slice(0, 7)}…)`
      : "NOT SET — streaming will fail",
    firebaseCredentials: !!(
      process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
    ) ? "set" : "NOT SET",
    voyageApiKey: !!process.env.VOYAGE_API_KEY
      ? "set (knowledge retrieval enabled)"
      : "not set (knowledge retrieval will use keyword fallback)",
    nodeEnv: process.env.NODE_ENV ?? "unknown",
    runtime: "nodejs",
    timestamp: new Date().toISOString(),
  };

  const critical = !process.env.ANTHROPIC_API_KEY;

  return NextResponse.json({
    status: critical ? "degraded" : "ok",
    safeMode: true,
    checks,
    endpoints: {
      safeChat: "POST /api/takers-ai/chat/safe",
      fullChat: "POST /api/takers-ai/chat",
    },
  });
}
