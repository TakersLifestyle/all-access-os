// Takers AI — Streaming chat route
// POST /api/takers-ai/chat
// Auth: Bearer token (admin only)
// Body: { agentId, messages, conversationId? }
// Returns: text/event-stream SSE

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { adminDb, adminAuth } from "@/lib/firebase-admin";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Auth helper ──────────────────────────────────────────────────────────────
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

// ── Build enriched system prompt ─────────────────────────────────────────────
async function buildSystemPrompt(db: FirebaseFirestore.Firestore, basePrompt: string): Promise<string> {
  // Load all active brand memory blocks
  const memorySnap = await db.collection("brandMemory").orderBy("category").get();
  if (memorySnap.empty) return basePrompt;

  const memoryBlocks = memorySnap.docs.map((d) => {
    const data = d.data();
    return `### ${data.title}\n${data.content}`;
  });

  return `${basePrompt}

---

## BRAND MEMORY CONTEXT
The following is your live brand knowledge base. Use it to inform every response.

${memoryBlocks.join("\n\n")}`;
}

export async function POST(req: NextRequest) {
  // 1. Auth
  const decoded = await verifyAdmin(req);
  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { agentId, messages, conversationId, saveConversation } = body as {
      agentId: string;
      messages: Array<{ role: "user" | "assistant"; content: string }>;
      conversationId?: string;
      saveConversation?: boolean;
    };

    if (!agentId || !messages?.length) {
      return NextResponse.json({ error: "agentId and messages are required." }, { status: 400 });
    }

    // 2. Load agent
    const db = adminDb();
    const agentDoc = await db.collection("agents").doc(agentId).get();
    if (!agentDoc.exists) {
      return NextResponse.json({ error: "Agent not found." }, { status: 404 });
    }
    const agent = agentDoc.data()!;

    if (!agent.isActive) {
      return NextResponse.json({ error: "Agent is not active." }, { status: 400 });
    }

    // 3. Build system prompt with brand memory
    const systemPrompt = await buildSystemPrompt(db, agent.systemPrompt);

    // 4. Save conversation start if requested
    let convRef: FirebaseFirestore.DocumentReference | null = null;
    if (saveConversation) {
      if (conversationId) {
        convRef = db.collection("conversations").doc(conversationId);
      } else {
        convRef = db.collection("conversations").doc();
        const userMsg = messages[messages.length - 1]?.content ?? "";
        await convRef.set({
          conversationId: convRef.id,
          agentId,
          title: userMsg.slice(0, 60) + (userMsg.length > 60 ? "…" : ""),
          messageCount: messages.length,
          lastMessage: userMsg.slice(0, 120),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        // Save existing messages to subcollection
        const batch = db.batch();
        for (const msg of messages) {
          const msgRef = convRef.collection("messages").doc();
          batch.set(msgRef, { ...msg, createdAt: new Date().toISOString() });
        }
        await batch.commit();
      }
    }

    // 5. Stream from Claude
    const model = (agent.model as string) || "claude-sonnet-4-5";
    const maxTokens = (agent.maxTokens as number) || 2048;

    let fullResponse = "";

    const readable = new ReadableStream({
      async start(controller) {
        try {
          const stream = anthropic.messages.stream({
            model,
            max_tokens: maxTokens,
            system: systemPrompt,
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
          });

          for await (const chunk of stream) {
            if (
              chunk.type === "content_block_delta" &&
              chunk.delta.type === "text_delta"
            ) {
              const text = chunk.delta.text;
              fullResponse += text;
              controller.enqueue(
                new TextEncoder().encode(
                  `data: ${JSON.stringify({ text })}\n\n`
                )
              );
            }
          }

          // Save assistant response to conversation
          if (convRef && fullResponse) {
            const msgRef = convRef.collection("messages").doc();
            await msgRef.set({
              role: "assistant",
              content: fullResponse,
              createdAt: new Date().toISOString(),
            });
            await convRef.update({
              messageCount: messages.length + 1,
              lastMessage: fullResponse.slice(0, 120),
              updatedAt: new Date().toISOString(),
            });
          }

          // Send conversation ID so client can reference it
          if (convRef) {
            controller.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({ conversationId: convRef.id })}\n\n`
              )
            );
          }

          controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Stream error";
          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify({ error: msg })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[takers-ai/chat]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
