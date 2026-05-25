// Takers AI — Streaming chat route with intelligent agent routing
// POST /api/takers-ai/chat
// Auth: Bearer token (admin only)
// Body: { agentId, messages, conversationId?, saveConversation?, useKnowledge? }
// Returns: text/event-stream SSE
//
// Routing flow (when agentId is the Operator):
//   1. Fast classification call (Haiku) → role + reason + confidence (0-100)
//   2. If confidence < THRESHOLD (60), fallback to Operator
//   3. Load specialist agent + agentInstructions + brand memory (priority-ordered)
//   4. If useKnowledge=true: semantic search knowledge base, inject top-K relevant chunks
//   5. Stream the specialist's response, capture token usage
//   6. Log WorkflowRun + AgentLog to Firestore (fire-and-forget)
//
// SSE event types: routing | text | done | error

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import type { AgentRole, TokenUsage } from "@/lib/takers-ai/types";
import { ROUTING_CONFIDENCE_THRESHOLD } from "@/lib/takers-ai/types";
import { semanticSearch, formatRetrievedContext } from "@/lib/takers-ai/knowledge";
import {
  getRoutingHints,
  getFormatPreferences,
  buildRoutingFeedbackSuffix,
  buildFormatPreferenceSuffix,
} from "@/lib/takers-ai/feedback-engine";
import { parseToolRequests, formatToolCallForApproval } from "@/lib/takers-ai/tools";
import type { ToolName } from "@/lib/takers-ai/tools";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Auth ─────────────────────────────────────────────────────────────────────
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

// ── Routing classifier ────────────────────────────────────────────────────────
// Returns role, reason, confidence (0-100), and up to 2 alternative roles.
// Confidence < ROUTING_CONFIDENCE_THRESHOLD → caller should fallback to Operator.
const ROUTING_SYSTEM_PROMPT = `You are a routing classifier for a multi-agent AI system for TakersLifestyle and ALL ACCESS Winnipeg.
Given a user message, determine which specialist agent should handle it.

Agents:
- content: Instagram captions, TikTok hooks, YouTube scripts, email copy, video descriptions, hashtags, creative copy
- marketing: campaigns, ad copy, launch strategies, growth plans, audience targeting, conversions, funnel design
- events: event planning, logistics, checklists, run-of-show, guest experience, pricing, capacity, safety, venue
- support: member FAQs, refund policy, onboarding messages, complaints, community guidelines, ticket support
- strategy: business strategy, SWOT, revenue planning, partnerships, grants, sponsorships, competitive analysis
- developer: Next.js, Firebase, Firestore rules, TypeScript, API design, implementation prompts, bug analysis
- operations: SOPs, weekly planning, task delegation, moderation workflows, reporting, team coordination
- operator: general questions, multi-topic, unclear request, meta questions about the system

Confidence scoring:
- 90-100: exact match (e.g. "write an Instagram caption" → content)
- 70-89: strong match with minor ambiguity
- 50-69: probable match but could apply to multiple agents
- 0-49: unclear — should fallback to Operator

Respond ONLY with valid JSON:
{"role":"<role>","reason":"<one sentence why>","confidence":<0-100>,"alternatives":["<role2>","<role3>"]}
alternatives array should contain 0-2 other plausible roles (omit if none).`;

interface ClassificationResult {
  role: AgentRole;
  reason: string;
  confidence: number;
  alternativeRoles: AgentRole[];
  fallback: boolean;
}

async function classifyIntent(
  userMessage: string,
  feedbackSuffix = ""
): Promise<ClassificationResult> {
  const startedAt = Date.now();
  let routingTokens = { input: 0, output: 0 };

  try {
    const systemPrompt = feedbackSuffix
      ? ROUTING_SYSTEM_PROMPT + feedbackSuffix
      : ROUTING_SYSTEM_PROMPT;

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 150,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage.slice(0, 500) }],
    });

    routingTokens = {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
    };

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const match = text.match(/\{[\s\S]*?\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      const role = (parsed.role as AgentRole) ?? "operator";
      const confidence = typeof parsed.confidence === "number"
        ? Math.min(100, Math.max(0, parsed.confidence))
        : 50;
      const alternatives = Array.isArray(parsed.alternatives)
        ? (parsed.alternatives as AgentRole[]).slice(0, 2)
        : [];
      const fallback = confidence < ROUTING_CONFIDENCE_THRESHOLD;

      return {
        role: fallback ? "operator" : role,
        reason: fallback
          ? `Low confidence (${confidence}%) — routing to Operator for clarification`
          : (parsed.reason as string) ?? "Specialist match",
        confidence,
        alternativeRoles: alternatives,
        fallback,
        // @ts-expect-error — attaching to result for logging
        _routingTokens: routingTokens,
        _durationMs: Date.now() - startedAt,
      };
    }
  } catch (err) {
    console.warn("[chat/route] Routing classification failed:", err);
  }

  return {
    role: "operator",
    reason: "Classification unavailable — using Operator",
    confidence: 0,
    alternativeRoles: [],
    fallback: true,
    // @ts-expect-error — attaching to result for logging
    _routingTokens: routingTokens,
    _durationMs: Date.now() - startedAt,
  };
}

// ── System prompt builder ─────────────────────────────────────────────────────
// Composes: base systemPrompt + agentInstructions + brand memory (priority-ordered)
//           + optional knowledge retrieval context (semantic search)
// Only active memory blocks are injected. Higher priority blocks inject first.
async function buildSystemPrompt(
  db: FirebaseFirestore.Firestore,
  agentId: string,
  basePrompt: string,
  options: {
    userMessage?: string;
    useKnowledge?: boolean;
  } = {}
): Promise<{
  prompt: string;
  memoryBlockCount: number;
  memoryTokenEstimate: number;
  knowledgeChunksInjected: number;
}> {
  const [memorySnap, instructionsDoc] = await Promise.all([
    db
      .collection("brandMemory")
      .where("isActive", "==", true)
      .orderBy("priority", "desc")
      .get(),
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

  let memoryTokenEstimate = 0;

  // Append active brand memory blocks, priority-ordered
  if (!memorySnap.empty) {
    const memoryBlocks = memorySnap.docs.map((d) => {
      const data = d.data();
      const block = `### [P${data.priority ?? 5}] ${data.title} (${data.category})\n${data.content}`;
      memoryTokenEstimate += Math.round(block.length / 4);
      return block;
    });
    prompt += `\n\n---\n\n## BRAND MEMORY CONTEXT\nThe following is your live brand knowledge base, ordered by priority. Use it to inform every response.\n\n${memoryBlocks.join("\n\n")}`;
  }

  // Inject relevant knowledge base chunks via semantic search
  let knowledgeChunksInjected = 0;
  if (options.useKnowledge && options.userMessage) {
    try {
      const chunks = await semanticSearch(db, options.userMessage, { k: 5 });
      if (chunks.length > 0) {
        const context = formatRetrievedContext(chunks);
        prompt += context;
        knowledgeChunksInjected = chunks.length;
      }
    } catch (err) {
      console.warn("[chat/route] Knowledge retrieval failed:", err);
    }
  }

  return {
    prompt,
    memoryBlockCount: memorySnap.size,
    memoryTokenEstimate,
    knowledgeChunksInjected,
  };
}

// ── Observability: write agent log ────────────────────────────────────────────
function writeAgentLog(
  db: FirebaseFirestore.Firestore,
  data: Record<string, unknown>
): void {
  db.collection("agentLogs")
    .doc()
    .set({ ...data, createdAt: new Date().toISOString() })
    .catch((err) => console.error("[agentLog write]", err));
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const decoded = await verifyAdmin(req);
  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { agentId, messages, conversationId, saveConversation, useKnowledge } = body as {
      agentId: string;
      messages: Array<{ role: "user" | "assistant"; content: string }>;
      conversationId?: string;
      saveConversation?: boolean;
      useKnowledge?: boolean;
    };

    if (!agentId || !messages?.length) {
      return NextResponse.json({ error: "agentId and messages are required." }, { status: 400 });
    }

    const db = adminDb();
    const requestStartedAt = Date.now();

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
    let classification: ClassificationResult | null = null;
    let workflowRunRef: FirebaseFirestore.DocumentReference | null = null;

    if (requestedAgent.isDefault) {
      // Load routing feedback hints to improve classifier accuracy
      const routingHints = await getRoutingHints(db, 5).catch(() => []);
      const feedbackSuffix = buildRoutingFeedbackSuffix(routingHints);
      classification = await classifyIntent(userMessage, feedbackSuffix);

      // Find the specialist agent by role
      if (classification.role !== "operator") {
        const agentsSnap = await db
          .collection("agents")
          .where("role", "==", classification.role)
          .where("isActive", "==", true)
          .limit(1)
          .get();

        if (!agentsSnap.empty) {
          activeAgent = agentsSnap.docs[0].data();
          activeAgentId = agentsSnap.docs[0].id;
        } else {
          // Specialist not found — fallback
          classification.role = "operator";
          classification.reason += " (specialist not found — using Operator)";
          classification.fallback = true;
          activeAgent = requestedAgent;
          activeAgentId = agentId;
        }
      }

      // Log routing decision as an agent log
      const routingTokens = (classification as unknown as Record<string, unknown>)._routingTokens as { input: number; output: number } | undefined;
      const routingDuration = (classification as unknown as Record<string, unknown>)._durationMs as number | undefined;

      writeAgentLog(db, {
        agentId,
        agentRole: "operator",
        agentName: requestedAgent.name,
        conversationId: conversationId ?? null,
        type: classification.fallback ? "fallback" : "routing",
        userMessage: userMessage.slice(0, 200),
        routingDecision: {
          role: classification.role,
          reason: classification.reason,
          confidence: classification.confidence,
          fallback: classification.fallback,
          alternativeRoles: classification.alternativeRoles,
        },
        tokenUsage: routingTokens
          ? {
              inputTokens: routingTokens.input,
              outputTokens: routingTokens.output,
              totalTokens: routingTokens.input + routingTokens.output,
            }
          : null,
        durationMs: routingDuration ?? null,
      });

      // Create workflow run document
      const now = new Date().toISOString();
      workflowRunRef = db.collection("workflowRuns").doc();
      workflowRunRef
        .set({
          conversationId: conversationId ?? null,
          userMessage: userMessage.slice(0, 200),
          originAgentId: agentId,
          routedToAgentId: activeAgentId,
          routedToRole: classification.role,
          routingReason: classification.reason,
          routingConfidence: classification.confidence,
          alternativeRoles: classification.alternativeRoles,
          status: "processing",
          outputSaved: false,
          tokenUsage: null,
          workflowDefinitionId: null,
          startedAt: now,
          completedAt: null,
          errorMessage: null,
        })
        .catch(console.error);
    }

    // 3. Build enriched system prompt (priority-ordered memory + optional knowledge retrieval)
    // Also inject format preferences learned from feedback signals
    const formatPref = await getFormatPreferences(db, activeAgent.role as AgentRole).catch(() => null);
    const formatPrefSuffix = buildFormatPreferenceSuffix(formatPref);
    const { prompt: systemPromptBase, memoryBlockCount, knowledgeChunksInjected } = await buildSystemPrompt(
      db,
      activeAgentId,
      activeAgent.systemPrompt as string,
      { userMessage, useKnowledge }
    );
    const systemPrompt = formatPrefSuffix ? systemPromptBase + formatPrefSuffix : systemPromptBase;

    // 4. Save conversation metadata if requested
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

    // 5. Stream from Claude — capture full response + token usage
    const model = (activeAgent.model as string) || "claude-sonnet-4-5";
    const maxTokens = (activeAgent.maxTokens as number) || 2048;
    let fullResponse = "";
    const generationStartedAt = Date.now();

    const readable = new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder();
        const send = (data: Record<string, unknown>) =>
          controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));

        try {
          // Emit routing metadata first (client shows routing indicator immediately)
          if (classification) {
            send({
              type: "routing",
              routedToRole: classification.role,
              routedToAgentId: activeAgentId,
              routedToName: activeAgent.name,
              routingReason: classification.reason,
              routingConfidence: classification.confidence,
              routingFallback: classification.fallback,
              alternativeRoles: classification.alternativeRoles,
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

          // Capture token usage after stream completes
          const finalMsg = await stream.finalMessage();
          const tokenUsage: TokenUsage = {
            inputTokens: finalMsg.usage.input_tokens,
            outputTokens: finalMsg.usage.output_tokens,
            totalTokens: finalMsg.usage.input_tokens + finalMsg.usage.output_tokens,
          };

          // Add routing tokens if applicable
          const routingTokens = classification
            ? (classification as unknown as Record<string, unknown>)._routingTokens as { input: number; output: number } | undefined
            : undefined;
          if (routingTokens) {
            tokenUsage.routingInputTokens = routingTokens.input;
            tokenUsage.routingOutputTokens = routingTokens.output;
            tokenUsage.totalTokens += routingTokens.input + routingTokens.output;
          }

          // Scan response for embedded tool requests — queue them for approval
          const toolRequests = parseToolRequests(fullResponse);
          const toolCallIds: string[] = [];
          if (toolRequests.length > 0) {
            const now = new Date().toISOString();
            for (const req of toolRequests) {
              const approvalContent = formatToolCallForApproval(req.tool, req.inputs);
              const approvalRef = db.collection("approvalQueue").doc();
              const callRef = db.collection("toolCalls").doc();
              await callRef.set({
                tool: req.tool,
                label: req.tool,
                inputs: req.inputs,
                status: "pending_approval",
                agentId: activeAgentId,
                agentRole: activeAgent.role,
                agentName: activeAgent.name,
                conversationId: convRef?.id ?? conversationId ?? null,
                workflowRunId: workflowRunRef?.id ?? null,
                pipelineRunId: null,
                approvalItemId: approvalRef.id,
                output: null,
                outputSummary: null,
                errorMessage: null,
                requestedAt: now,
                approvedAt: null,
                executedAt: null,
                approvedBy: null,
              });
              await approvalRef.set({
                type: "workflow_step",
                title: `Tool Request: ${req.tool}`,
                description: `Agent requested tool: ${req.tool}`,
                content: approvalContent,
                context: { toolCallId: callRef.id, tool: req.tool },
                requestedBy: `agent:${activeAgentId}`,
                agentId: activeAgentId,
                agentRole: activeAgent.role,
                agentName: activeAgent.name,
                workflowRunId: workflowRunRef?.id ?? null,
                status: "pending",
                priority: "medium",
                reviewedBy: null, reviewedAt: null, reviewNote: null,
                createdAt: now, expiresAt: null,
              });
              toolCallIds.push(callRef.id);
            }
          }

          const generationDurationMs = Date.now() - generationStartedAt;
          const totalDurationMs = Date.now() - requestStartedAt;

          // Log generation
          writeAgentLog(db, {
            agentId: activeAgentId,
            agentRole: activeAgent.role,
            agentName: activeAgent.name,
            conversationId: convRef?.id ?? conversationId ?? null,
            workflowRunId: workflowRunRef?.id ?? null,
            type: "generation",
            userMessage: userMessage.slice(0, 200),
            tokenUsage,
            durationMs: generationDurationMs,
            metadata: {
              model,
              maxTokens,
              memoryBlockCount,
              knowledgeChunksInjected,
              useKnowledge: useKnowledge ?? false,
              totalDurationMs,
            },
          });

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

          // Update workflow run to complete with token usage
          if (workflowRunRef) {
            workflowRunRef.update({
              status: "complete",
              completedAt: new Date().toISOString(),
              tokenUsage,
            }).catch(console.error);
          }

          send({
            type: "done",
            conversationId: convRef?.id ?? null,
            workflowRunId: workflowRunRef?.id ?? null,
            tokenUsage,
            toolCallIds: toolCallIds.length > 0 ? toolCallIds : undefined,
          });
          controller.close();
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Stream error";

          // Log error
          writeAgentLog(db, {
            agentId: activeAgentId,
            agentRole: activeAgent.role,
            agentName: activeAgent.name,
            conversationId: convRef?.id ?? conversationId ?? null,
            workflowRunId: workflowRunRef?.id ?? null,
            type: "error",
            userMessage: userMessage.slice(0, 200),
            error: msg,
            durationMs: Date.now() - generationStartedAt,
          });

          if (workflowRunRef) {
            workflowRunRef
              .update({ status: "failed", errorMessage: msg })
              .catch(console.error);
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
