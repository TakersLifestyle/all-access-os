// Takers AI — Streaming chat route with agent routing engine
// POST /api/takers-ai/chat
// Auth: Bearer token (admin only)
// Body: { agentId, messages, conversationId?, saveConversation? }
// Returns: text/event-stream SSE
//
// Routing flow (when agentId is the Operator):
//   1. Fast classification call (Haiku) → determines which specialist handles it
//   2. Load specialist agent + their agentInstructions + brand memory
//   3. Stream the specialist's response
//   4. Log the WorkflowRun to Firestore

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import type { AgentRole } from "@/lib/takers-ai/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Auth ────────────────────────────────────────────────────────────────────
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

// ── Routing classifier ───────────────────────────────────────────────────────
// Fast, cheap Haiku call to determine which specialist should handle the request.
// Returns the AgentRole or "operator" if no specialist fits.
const ROUTING_SYSTEM_PROMPT = `You are a routing classifier for a multi-agent AI system for TakersLifestyle and ALL ACCESS Winnipeg.
Given a user message, determine which specialist agent should handle it.

Agents:
- content: Instagram captions, TikTok hooks, YouTube scripts, email copy, video descriptions, hashtags, creative copy
- marketing: campaigns, ad copy, launch strategies, growth plans, audience targeting, conversions, funnel design
- events: event planning, logistics, checklists, run-of-show, guest experience, pricing, capacity, safety, venue
- support: member FAQs, refund policy, onboarding messages, complaints, community guidelines, ticket support
- strategy: business strategy, SWOT, revenue planning, partnerships, grants, sponsorships, competitive analysis, pricing
- developer: Next.js, Firebase, Firestore rules, TypeScript, API design, implementation prompts, bug analysis, deployment
- operations: SOPs, weekly planning, task delegation, moderation workflows, reporting, team coordination
- operator: general questions, multi-topic, unclear request, meta questions about the system

Respond ONLY with valid JSON: {"role":"<role>","reason":"<one sentence why>"}`;

async function classifyIntent(
  userMessage: string,
  db: FirebaseFirestore.Firestore
): Promise<{ role: AgentRole; reason: string }> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 100,
      system: ROUTING_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage.slice(0, 500) }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    // Extract JSON even if there's surrounding text
    const match = text.match(/\{[^}]+\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        role: (parsed.role as AgentRole) ?? "operator",
        reason: (parsed.reason as string) ?? "General request",
      };
    }
  } catch (err) {
    console.warn("[chat/route] Routing classification failed:", err);
  }
  return { role: "operator", reason: "Classification unavailable — using Operator" };
}

// ── System prompt builder ────────────────────────────────────────────────────
// Composes: base systemPrompt + agentInstructions + brand memory
async function buildSystemPrompt(
  db: FirebaseFirestore.Firestore,
  agentId: string,
  basePrompt: string
): Promise<string> {
  const [memorySnap, instructionsDoc] = await Promise.all([
    db.collection("brandMemory").orderBy("category").get(),
    db.collection("agentInstructions").doc(agentId).get(),
  ]);

  let prompt = basePrompt;

  // Append admin-editable instructions block
  if (instructionsDoc.exists) {
    const instr = instructionsDoc.data()!.instructions as string;
    if (instr?.trim()) {
      prompt += `\n\n---\n\n## CUSTOM INSTRUCTIONS\n${instr}`;
    }
  }

  // Append brand memory
  if (!memorySnap.empty) {
    const memoryBlocks = memorySnap.docs.map((d) => {
      const data = d.data();
      return `### ${data.title}\n${data.content}`;
    });
    prompt += `\n\n---\n\n## BRAND MEMORY CONTEXT\nThe following is your live brand knowledge base. Use it to inform every response.\n\n${memoryBlocks.join("\n\n")}`;
  }

  return prompt;
}

// ── Main handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
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

    const db = adminDb();

    // 1. Load the requested agent
    const agentDoc = await db.collection("agents").doc(agentId).get();
    if (!agentDoc.exists) {
      return NextResponse.json({ error: "Agent not found." }, { status: 404 });
    }
    const requestedAgent = agentDoc.data()!;
    if (!requestedAgent.isActive) {
      return NextResponse.json({ error: "Agent is not active." }, { status: 400 });
    }

    const userMessage = messages[messages.length - 1]?.content ?? "";

    // 2. Routing: if the Operator receives a message, classify and route to specialist
    let activeAgent = requestedAgent;
    let activeAgentId = agentId;
    let routingDecision: { role: AgentRole; reason: string } | null = null;
    let workflowRunRef: FirebaseFirestore.DocumentReference | null = null;

    if (requestedAgent.isDefault) {
      // Classify intent
      routingDecision = await classifyIntent(userMessage, db);

      // Find the specialist agent by role (skip routing if operator is the right choice)
      if (routingDecision.role !== "operator") {
        const agentsSnap = await db
          .collection("agents")
          .where("role", "==", routingDecision.role)
          .where("isActive", "==", true)
          .limit(1)
          .get();

        if (!agentsSnap.empty) {
          activeAgent = agentsSnap.docs[0].data();
          activeAgentId = agentsSnap.docs[0].id;
        } else {
          // Specialist not found — fall back to Operator
          routingDecision.reason += " (specialist not seeded — using Operator)";
          routingDecision.role = "operator";
        }
      }

      // Log workflow run (fire-and-forget)
      const now = new Date().toISOString();
      workflowRunRef = db.collection("workflowRuns").doc();
      workflowRunRef.set({
        conversationId: conversationId ?? null,
        userMessage: userMessage.slice(0, 200),
        originAgentId: agentId,
        routedToAgentId: activeAgentId,
        routedToRole: routingDecision.role,
        routingReason: routingDecision.reason,
        status: "processing",
        outputSaved: false,
        startedAt: now,
        completedAt: null,
        errorMessage: null,
      }).catch(console.error);
    }

    // 3. Build enriched system prompt
    const systemPrompt = await buildSystemPrompt(db, activeAgentId, activeAgent.systemPrompt as string);

    // 4. Save conversation if requested
    let convRef: FirebaseFirestore.DocumentReference | null = null;
    if (saveConversation) {
      if (conversationId) {
        convRef = db.collection("conversations").doc(conversationId);
      } else {
        convRef = db.collection("conversations").doc();
        const batch = db.batch();
        batch.set(convRef, {
          conversationId: convRef.id,
          agentId: activeAgentId,
          agentRole: activeAgent.role,
          title: userMessage.slice(0, 60) + (userMessage.length > 60 ? "…" : ""),
          messageCount: messages.length,
          lastMessage: userMessage.slice(0, 120),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        for (const msg of messages) {
          const msgRef = convRef.collection("messages").doc();
          batch.set(msgRef, {
            ...msg,
            agentId: msg.role === "assistant" ? activeAgentId : null,
            agentRole: msg.role === "assistant" ? activeAgent.role : null,
            createdAt: new Date().toISOString(),
          });
        }
        await batch.commit();
      }
    }

    // 5. Stream from Claude
    const model = (activeAgent.model as string) || "claude-sonnet-4-5";
    const maxTokens = (activeAgent.maxTokens as number) || 2048;
    let fullResponse = "";

    const readable = new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder();
        const send = (data: Record<string, unknown>) =>
          controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));

        try {
          // Emit routing metadata first so the client can show the indicator immediately
          if (routingDecision) {
            send({
              type: "routing",
              routedToRole: routingDecision.role,
              routedToAgentId: activeAgentId,
              routedToName: activeAgent.name,
              routingReason: routingDecision.reason,
              workflowRunId: workflowRunRef?.id ?? null,
            });
          }

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
              send({ type: "text", text });
            }
          }

          // Save assistant response to conversation
          if (convRef && fullResponse) {
            const msgRef = convRef.collection("messages").doc();
            await msgRef.set({
              role: "assistant",
              content: fullResponse,
              agentId: activeAgentId,
              agentRole: activeAgent.role,
              workflowRunId: workflowRunRef?.id ?? null,
              createdAt: new Date().toISOString(),
            });
            await convRef.update({
              messageCount: messages.length + 1,
              lastMessage: fullResponse.slice(0, 120),
              updatedAt: new Date().toISOString(),
            });
          }

          // Update workflow run to complete
          if (workflowRunRef) {
            workflowRunRef.update({
              status: "complete",
              completedAt: new Date().toISOString(),
            }).catch(console.error);
          }

          send({
            type: "done",
            conversationId: convRef?.id ?? null,
            workflowRunId: workflowRunRef?.id ?? null,
          });
          controller.close();
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Stream error";
          // Mark workflow as failed
          if (workflowRunRef) {
            workflowRunRef.update({ status: "failed", errorMessage: msg }).catch(console.error);
          }
          send({ type: "error", error: msg });
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
