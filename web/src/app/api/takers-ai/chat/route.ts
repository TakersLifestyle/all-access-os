// Takers AI — Streaming chat route (hardened)
// POST /api/takers-ai/chat
// Auth: Bearer token (admin only)
// Body: { agentId, messages, conversationId?, saveConversation?, useKnowledge?, attachments? }
// Returns: text/event-stream SSE
//
// SSE event types: routing | text | done | error | stage (debug)
//
// Stage execution order (each wrapped in try/catch — failures degrade gracefully):
//   STAGE 1  — request parse + auth
//   STAGE 2  — rate limit check (Firestore)
//   STAGE 3  — agent document fetch
//   STAGE 4  — routing classification (haiku) [Operator only]
//   STAGE 5  — specialist lookup [Operator only]
//   STAGE 6  — memory + instructions fetch (Firestore) [with fallback]
//   STAGE 7  — knowledge retrieval (Voyage) [with fallback]
//   STAGE 8  — format preference fetch [with fallback]
//   STAGE 9  — conversation create (Firestore) [fire-and-forget]
//   STAGE 10 — Claude stream
//   STAGE 11 — post-stream writes (cost, audit, agentLog) [fire-and-forget]

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
import { checkRateLimit } from "@/lib/takers-ai/rate-limiter";
import { createCostEvent, writeCostEvent } from "@/lib/takers-ai/cost";
import { writeAuditEvent } from "@/lib/takers-ai/audit";
import {
  buildMessagesWithAttachments,
  type AttachmentMeta,
  MAX_FILES_PER_MESSAGE,
  MAX_FILE_SIZE_BYTES,
} from "@/lib/takers-ai/attachments";
import {
  inferWorkflowHints,
  buildAttachmentContextNote,
  buildMultimodalSystemContext,
  writeMultimodalAnalytics,
} from "@/lib/takers-ai/multimodal";
import {
  buildEventKnowledgeContext,
  agentNeedsEventKnowledge,
} from "@/lib/takers-ai/event-knowledge";
import {
  buildOperatorPrefix,
  enforceModelQuality,
  analyzeForWeakRefusals,
} from "@/lib/takers-ai/operator-mode";
import { sanitizeForFirestore } from "@/lib/sanitize-firestore";

const IS_DEV = process.env.NODE_ENV === "development";

// ── Structured logger ─────────────────────────────────────────────────────────
function log(
  stage: string,
  status: "start" | "ok" | "warn" | "error",
  detail?: Record<string, unknown>
) {
  const line = `[chat/${stage}] ${status}${detail ? " " + JSON.stringify(detail) : ""}`;
  if (status === "error") console.error(line);
  else if (status === "warn") console.warn(line);
  else console.log(line);
}

// ── Env validation ────────────────────────────────────────────────────────────
function checkEnv(): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!process.env.ANTHROPIC_API_KEY) issues.push("ANTHROPIC_API_KEY not set");
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY && !process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
    issues.push("FIREBASE_SERVICE_ACCOUNT_KEY not set");
  return { ok: issues.length === 0, issues };
}

// ── Anthropic client (lazy, validates key exists) ────────────────────────────
let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (_anthropic) return _anthropic;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY environment variable is not set.");
  _anthropic = new Anthropic({ apiKey: key });
  return _anthropic;
}

// ── Auth ─────────────────────────────────────────────────────────────────────
async function verifyAdmin(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const decoded = await adminAuth().verifyIdToken(authHeader.slice(7));
    if (decoded.role !== "admin") return null;
    return decoded;
  } catch (err) {
    log("auth", "warn", { err: String(err) });
    return null;
  }
}

// ── Routing classifier ────────────────────────────────────────────────────────
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
- image: generate flyer, make image, create poster, render image, use reference image, make it like this, create Instagram post design, create story, create TikTok cover, carousel slides, promo graphic, event poster, brand visual, DALL-E, Midjourney, Flux, Canva design, design this, visual asset, image prompt
- creative: creative briefs, copy packages, campaign copy, content direction, brand voice, taglines
- operator: general questions, multi-topic, unclear request, meta questions about the system

Confidence scoring:
- 90-100: exact match (e.g. "write an Instagram caption" → content)
- 70-89: strong match with minor ambiguity
- 50-69: probable match but could apply to multiple agents
- 0-49: unclear — should fallback to Operator

Respond ONLY with valid JSON:
{"role":"<role>","reason":"<one sentence why>","confidence":<0-100>,"alternatives":["<role2>","<role3>"]}`;

interface ClassificationResult {
  role: AgentRole;
  reason: string;
  confidence: number;
  alternativeRoles: AgentRole[];
  fallback: boolean;
  _routingTokens?: { input: number; output: number };
  _durationMs?: number;
}

async function classifyIntent(
  userMessage: string,
  feedbackSuffix = ""
): Promise<ClassificationResult> {
  const startedAt = Date.now();
  let routingTokens = { input: 0, output: 0 };

  try {
    log("routing", "start", { msgLen: userMessage.length });
    const anthropic = getAnthropic();
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
      const durationMs = Date.now() - startedAt;

      log("routing", "ok", { role, confidence, fallback, durationMs });
      return {
        role: fallback ? "operator" : role,
        reason: fallback
          ? `Low confidence (${confidence}%) — routing to Operator for clarification`
          : (parsed.reason as string) ?? "Specialist match",
        confidence,
        alternativeRoles: alternatives,
        fallback,
        _routingTokens: routingTokens,
        _durationMs: durationMs,
      };
    }
    log("routing", "warn", { msg: "Failed to parse routing JSON", text: text.slice(0, 200) });
  } catch (err) {
    log("routing", "error", { err: String(err) });
  }

  return {
    role: "operator",
    reason: "Classification unavailable — using Operator",
    confidence: 0,
    alternativeRoles: [],
    fallback: true,
    _routingTokens: routingTokens,
    _durationMs: Date.now() - startedAt,
  };
}

// ── System prompt builder ─────────────────────────────────────────────────────
// Every Firestore read is individually try/caught — partial failures return what's available.
async function buildSystemPrompt(
  db: FirebaseFirestore.Firestore,
  agentId: string,
  basePrompt: string,
  options: { userMessage?: string; useKnowledge?: boolean } = {}
): Promise<{
  prompt: string;
  memoryBlockCount: number;
  memoryTokenEstimate: number;
  knowledgeChunksInjected: number;
  stageErrors: string[];
}> {
  const stageErrors: string[] = [];
  let prompt = basePrompt;
  let memoryBlockCount = 0;
  let memoryTokenEstimate = 0;
  let knowledgeChunksInjected = 0;

  // STAGE 6a — agent instructions
  try {
    log("instructions", "start", { agentId });
    const instructionsDoc = await db.collection("agentInstructions").doc(agentId).get();
    if (instructionsDoc.exists) {
      const instr = instructionsDoc.data()!.instructions as string;
      if (instr?.trim()) {
        prompt += `\n\n---\n\n## CUSTOM INSTRUCTIONS\n${instr}`;
      }
    }
    log("instructions", "ok", { exists: instructionsDoc.exists });
  } catch (err) {
    const msg = `agentInstructions fetch failed: ${String(err)}`;
    stageErrors.push(msg);
    log("instructions", "warn", { err: String(err) });
    // Fallback: continue without custom instructions
  }

  // STAGE 6b — brand memory
  // NOTE: brandMemory query uses .where("isActive","==",true).orderBy("priority","desc")
  // which requires a composite index. Falls back to unordered query if that index is missing.
  try {
    log("memory", "start");
    let memorySnap: FirebaseFirestore.QuerySnapshot;
    try {
      memorySnap = await db
        .collection("brandMemory")
        .where("isActive", "==", true)
        .orderBy("priority", "desc")
        .get();
    } catch (indexErr) {
      // Likely missing composite index — fall back to unordered query
      log("memory", "warn", {
        msg: "Composite index missing, falling back to unordered memory fetch",
        err: String(indexErr),
      });
      memorySnap = await db
        .collection("brandMemory")
        .where("isActive", "==", true)
        .get();
    }

    if (!memorySnap.empty) {
      const memoryBlocks = memorySnap.docs.map((d) => {
        const data = d.data();
        const block = `### [P${data.priority ?? 5}] ${data.title} (${data.category})\n${data.content}`;
        memoryTokenEstimate += Math.round(block.length / 4);
        return block;
      });
      prompt += `\n\n---\n\n## BRAND MEMORY CONTEXT\nThe following is your live brand knowledge base, ordered by priority. Use it to inform every response.\n\n${memoryBlocks.join("\n\n")}`;
      memoryBlockCount = memorySnap.size;
    }
    log("memory", "ok", { blocks: memoryBlockCount, tokenEstimate: memoryTokenEstimate });
  } catch (err) {
    const msg = `brandMemory fetch failed: ${String(err)}`;
    stageErrors.push(msg);
    log("memory", "error", { err: String(err) });
    // Fallback: continue without memory
  }

  // STAGE 7 — knowledge retrieval (Voyage)
  if (options.useKnowledge && options.userMessage) {
    try {
      log("knowledge", "start", { query: options.userMessage.slice(0, 80) });
      const chunks = await semanticSearch(db, options.userMessage, { k: 5 });
      if (chunks.length > 0) {
        const context = formatRetrievedContext(chunks);
        prompt += context;
        knowledgeChunksInjected = chunks.length;
      }
      log("knowledge", "ok", { chunks: knowledgeChunksInjected });
    } catch (err) {
      const msg = `Knowledge retrieval failed: ${String(err)}`;
      stageErrors.push(msg);
      log("knowledge", "warn", { err: String(err) });
      // Fallback: continue without knowledge chunks
    }
  }

  return { prompt, memoryBlockCount, memoryTokenEstimate, knowledgeChunksInjected, stageErrors };
}

// ── Agent log writer ──────────────────────────────────────────────────────────
// Sanitizes payload before writing — never lets undefined values crash the stream.
function writeAgentLog(
  db: FirebaseFirestore.Firestore,
  data: Record<string, unknown>
): void {
  try {
    const payload = sanitizeForFirestore({
      ...data,
      createdAt: new Date().toISOString(),
    }) as Record<string, unknown>;
    db.collection("agentLogs")
      .doc()
      .set(payload)
      .catch((err) => log("agentLog", "error", { err: String(err) }));
  } catch (err) {
    // Sanitization itself failed — log and skip, never crash the stream
    log("agentLog", "warn", { err: `writeAgentLog sanitization failed: ${String(err)}` });
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const handlerStart = Date.now();

  // STAGE 1 — env + auth
  log("handler", "start");

  const envCheck = checkEnv();
  if (!envCheck.ok) {
    log("env", "error", { issues: envCheck.issues });
    return NextResponse.json(
      { error: "Server configuration error", issues: IS_DEV ? envCheck.issues : undefined },
      { status: 503 }
    );
  }

  const decoded = await verifyAdmin(req);
  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // STAGE 1 — parse body
  let body: {
    agentId: string;
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    conversationId?: string;
    saveConversation?: boolean;
    useKnowledge?: boolean;
    attachments?: AttachmentMeta[];
    responseMode?: "quick" | "standard" | "campaign";
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { agentId, messages, conversationId, saveConversation, useKnowledge, responseMode } = body;
  const rawAttachments = Array.isArray(body.attachments) ? body.attachments : [];

  if (!agentId || !messages?.length) {
    return NextResponse.json({ error: "agentId and messages are required." }, { status: 400 });
  }

  // Server-side attachment validation (belt-and-suspenders — client validates too)
  const attachments = rawAttachments.filter((a): a is AttachmentMeta => {
    if (!a?.id || !a.downloadUrl || !a.storagePath) return false;
    if (a.size > MAX_FILE_SIZE_BYTES) return false;
    return true;
  }).slice(0, MAX_FILES_PER_MESSAGE);

  log("parse", "ok", {
    agentId,
    messageCount: messages.length,
    saveConversation,
    useKnowledge,
    attachmentCount: attachments.length,
    conversationId: conversationId ?? null,
  });

  // STAGE 2 — rate limit
  let db: FirebaseFirestore.Firestore;
  try {
    db = adminDb();
    log("db-init", "ok");
  } catch (err) {
    log("db-init", "error", { err: String(err) });
    return NextResponse.json(
      { error: "Database initialization failed", detail: IS_DEV ? String(err) : undefined },
      { status: 503 }
    );
  }

  try {
    log("rate-limit", "start", { uid: decoded.uid });
    const rateResult = await checkRateLimit(db, decoded.uid, "chat");
    if (!rateResult.allowed) {
      log("rate-limit", "warn", { limitType: rateResult.limitType, retryAfterMs: rateResult.retryAfterMs });
      return NextResponse.json(
        {
          error: `Rate limit exceeded. Retry after ${Math.ceil(rateResult.retryAfterMs / 1000)}s.`,
          resetAt: rateResult.resetAt,
          limitType: rateResult.limitType,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(rateResult.retryAfterMs / 1000)),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": rateResult.resetAt,
          },
        }
      );
    }
    log("rate-limit", "ok", { remaining: rateResult.remaining });
  } catch (err) {
    // Rate limiter failure — fail open (don't block chat)
    log("rate-limit", "warn", { err: String(err), msg: "Rate limit check failed — continuing" });
  }

  // STAGE 3 — load agent
  let requestedAgent: FirebaseFirestore.DocumentData;
  try {
    log("agent-fetch", "start", { agentId });
    const agentDoc = await db.collection("agents").doc(agentId).get();
    if (!agentDoc.exists) {
      return NextResponse.json({ error: "Agent not found.", agentId }, { status: 404 });
    }
    requestedAgent = agentDoc.data()!;
    if (!requestedAgent.isActive) {
      return NextResponse.json({ error: "Agent is not active.", agentId }, { status: 400 });
    }
    log("agent-fetch", "ok", { role: requestedAgent.role, model: requestedAgent.model });
  } catch (err) {
    log("agent-fetch", "error", { err: String(err) });
    return NextResponse.json(
      { error: "Failed to load agent", detail: IS_DEV ? String(err) : undefined },
      { status: 500 }
    );
  }

  const userMessage = messages[messages.length - 1]?.content ?? "";
  const requestStartedAt = Date.now();

  // STAGES 4-11 — everything inside the stream so failures emit SSE error events
  // rather than returning a non-2xx HTTP response that kills the stream before it opens.
  const readable = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();

      function send(data: Record<string, unknown>) {
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Controller already closed — ignore
        }
      }

      function sendStage(stage: string, durationMs: number, detail?: Record<string, unknown>) {
        if (IS_DEV) {
          send({ type: "stage", stage, durationMs, ...(detail ?? {}) });
        }
      }

      function fatal(stage: string, err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        log(stage, "error", { err: msg });
        send({ type: "error", stage, error: msg, detail: IS_DEV ? msg : "An error occurred" });
        try { controller.close(); } catch { /* already closed */ }
      }

      try {
        // ── STAGE 4: Routing (Operator only) ──────────────────────────────────
        let activeAgent = requestedAgent;
        let activeAgentId = agentId;
        let classification: ClassificationResult | null = null;
        let workflowRunRef: FirebaseFirestore.DocumentReference | null = null;

        const stage4Start = Date.now();
        if (requestedAgent.isDefault) {
          try {
            // STAGE 4a — routing hints
            const routingHints = await getRoutingHints(db, 5).catch((err) => {
              log("routing-hints", "warn", { err: String(err) });
              return [];
            });
            const feedbackSuffix = buildRoutingFeedbackSuffix(routingHints);
            // Augment routing message with attachment context so classifier is attachment-aware
            const routingMessage = attachments.length > 0
              ? userMessage + buildAttachmentContextNote(attachments)
              : userMessage;
            classification = await classifyIntent(routingMessage, feedbackSuffix);

            // Emit routing event immediately so client shows indicator
            send({
              type: "routing",
              routedToRole: classification.role,
              routedToAgentId: activeAgentId,
              routedToName: activeAgent.name,
              routingReason: classification.reason,
              routingConfidence: classification.confidence,
              routingFallback: classification.fallback,
              alternativeRoles: classification.alternativeRoles,
              workflowRunId: null, // will be updated after run doc created
            });
          } catch (err) {
            log("routing", "warn", { err: String(err), msg: "Routing failed — staying with Operator" });
            classification = {
              role: "operator",
              reason: "Routing classification failed — using Operator",
              confidence: 0,
              alternativeRoles: [],
              fallback: true,
            };
          }

          // STAGE 5 — specialist lookup
          if (classification.role !== "operator") {
            try {
              log("specialist-lookup", "start", { role: classification.role });
              const agentsSnap = await db
                .collection("agents")
                .where("role", "==", classification.role)
                .where("isActive", "==", true)
                .limit(1)
                .get();

              if (!agentsSnap.empty) {
                activeAgent = agentsSnap.docs[0].data();
                activeAgentId = agentsSnap.docs[0].id;
                log("specialist-lookup", "ok", { agentId: activeAgentId, name: activeAgent.name });
                // Re-emit routing now that we have the real agentId
                send({
                  type: "routing",
                  routedToRole: classification.role,
                  routedToAgentId: activeAgentId,
                  routedToName: activeAgent.name,
                  routingReason: classification.reason,
                  routingConfidence: classification.confidence,
                  routingFallback: classification.fallback,
                  alternativeRoles: classification.alternativeRoles,
                  workflowRunId: null,
                });
              } else {
                log("specialist-lookup", "warn", { msg: "Specialist not found, using Operator", role: classification.role });
                classification.role = "operator";
                classification.reason += " (specialist agent not found — using Operator)";
                classification.fallback = true;
              }
            } catch (err) {
              log("specialist-lookup", "error", { err: String(err) });
              // Fallback to operator — don't kill the stream
              classification.role = "operator";
              classification.reason += " (specialist lookup failed — using Operator)";
              classification.fallback = true;
            }
          }

          // Create workflow run doc (fire-and-forget — don't block stream)
          const now = new Date().toISOString();
          try {
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
              .catch((err) => log("workflowRun-create", "warn", { err: String(err) }));
          } catch (err) {
            log("workflowRun-create", "warn", { err: String(err) });
          }

          // Log routing decision (fire-and-forget)
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
            tokenUsage: classification._routingTokens
              ? {
                  inputTokens: classification._routingTokens.input,
                  outputTokens: classification._routingTokens.output,
                  totalTokens: classification._routingTokens.input + classification._routingTokens.output,
                }
              : null,
            durationMs: classification._durationMs ?? null,
          });
        }

        sendStage("routing", Date.now() - stage4Start, { role: classification?.role ?? activeAgent.role });

        // ── STAGE 8: Format preference fetch ─────────────────────────────────
        const stage8Start = Date.now();
        let formatPrefSuffix = "";
        try {
          const formatPref = await getFormatPreferences(db, activeAgent.role as AgentRole);
          formatPrefSuffix = buildFormatPreferenceSuffix(formatPref);
          log("format-pref", "ok");
        } catch (err) {
          log("format-pref", "warn", { err: String(err) });
        }
        sendStage("format-pref", Date.now() - stage8Start);

        // ── STAGES 6+7: Build system prompt (memory + knowledge) ─────────────
        const stage6Start = Date.now();

        // Prepend operator mode prefix — enforces action-oriented, deliverable-first behavior
        // across all agents. Prevents weak refusals, ensures structured copy-ready output.
        const operatorPrefix = buildOperatorPrefix(activeAgent.role as string);
        const agentBasePrompt = operatorPrefix + "\n\n---\n\n" + (activeAgent.systemPrompt as string);

        const {
          prompt: systemPromptBase,
          memoryBlockCount,
          knowledgeChunksInjected,
          stageErrors: promptErrors,
        } = await buildSystemPrompt(db, activeAgentId, agentBasePrompt, {
          userMessage,
          useKnowledge,
        });

        if (promptErrors.length > 0) {
          log("system-prompt", "warn", { errors: promptErrors });
        }

        // Append format preferences and multimodal context (fail-open for both)
        let systemPrompt = formatPrefSuffix
          ? systemPromptBase + formatPrefSuffix
          : systemPromptBase;

        if (attachments.length > 0) {
          try {
            const workflowHints = inferWorkflowHints(attachments);
            const multimodalCtx = buildMultimodalSystemContext(attachments, workflowHints);
            systemPrompt = systemPrompt + multimodalCtx;
            log("multimodal-ctx", "ok", { hints: workflowHints, attachmentCount: attachments.length });
          } catch (mmErr) {
            log("multimodal-ctx", "warn", { err: String(mmErr) });
          }
        }

        // ── Response mode suffix ──────────────────────────────────────────────
        if (responseMode === "quick") {
          systemPrompt += "\n\n---\n\n**RESPONSE MODE: QUICK** — Be concise and direct. For creative requests: max 2 options. No long explanations. Lead with the deliverable. No preamble.";
        } else if (responseMode === "campaign") {
          systemPrompt += "\n\n---\n\n**RESPONSE MODE: FULL CAMPAIGN** — Produce the complete package. All formats, all concepts, full creative direction, all copy variations.";
        }
        // "standard" = no suffix, default behavior

        // ── Event knowledge injection (content/marketing/events/operator) ──────
        // Injects live event data from Firestore to prevent hallucinated event details.
        let eventKnowledgeCount = 0;
        if (agentNeedsEventKnowledge(activeAgent.role as string)) {
          try {
            log("event-knowledge", "start", { role: activeAgent.role });
            const { block, eventCount } = await buildEventKnowledgeContext(db);
            if (block) {
              systemPrompt = systemPrompt + block;
              eventKnowledgeCount = eventCount;
            }
            log("event-knowledge", "ok", { eventCount });
          } catch (evtErr) {
            log("event-knowledge", "warn", { err: String(evtErr) });
          }
        }

        sendStage("system-prompt", Date.now() - stage6Start, {
          memoryBlockCount,
          knowledgeChunksInjected,
          promptLen: systemPrompt.length,
          stageErrors: promptErrors.length,
        });
        log("system-prompt", "ok", {
          promptLen: systemPrompt.length,
          memoryBlocks: memoryBlockCount,
          knowledgeChunks: knowledgeChunksInjected,
        });

        // ── STAGE 9: Conversation create (fire-and-forget) ────────────────────
        let convRef: FirebaseFirestore.DocumentReference | null = null;
        if (saveConversation) {
          try {
            if (conversationId) {
              convRef = db.collection("conversations").doc(conversationId);
            } else {
              convRef = db.collection("conversations").doc();
              const batch = db.batch();
              batch.set(convRef, {
                conversationId: convRef.id,
                userId: decoded.uid,              // ← cross-device continuity
                agentId: activeAgentId,
                agentRole: activeAgent.role,
                agentName: activeAgent.name,
                title: userMessage.slice(0, 80) + (userMessage.length > 80 ? "…" : ""),
                messageCount: messages.length,
                lastMessage: userMessage.slice(0, 120),
                deviceSource: req.headers.get("user-agent")?.slice(0, 80) ?? null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
              for (let mi = 0; mi < messages.length; mi++) {
                const msg = messages[mi];
                const isLastMsg = mi === messages.length - 1;
                const msgRef = convRef.collection("messages").doc();
                batch.set(msgRef, {
                  ...msg,
                  agentId: msg.role === "assistant" ? activeAgentId : null,
                  agentRole: msg.role === "assistant" ? activeAgent.role : null,
                  // Attach metadata to the last user message only
                  attachments: (isLastMsg && msg.role === "user" && attachments.length > 0)
                    ? attachments
                    : [],
                  createdAt: new Date().toISOString(),
                });
              }
              // Fire-and-forget — don't block stream on Firestore write
              batch.commit().catch((err) => log("conv-create", "warn", { err: String(err) }));
            }
            log("conv-create", "ok", { convId: convRef.id });
          } catch (err) {
            log("conv-create", "warn", { err: String(err) });
            convRef = null; // don't block on failure
          }
        }

        // ── STAGE 10: Claude stream ────────────────────────────────────────────
        // Enforce model quality floor — Sonnet required for creative/strategy/events/marketing/content
        const rawModel = (activeAgent.model as string) || "claude-sonnet-4-5";
        const model = enforceModelQuality(activeAgent.role as string, rawModel);
        const maxTokens = Math.min((activeAgent.maxTokens as number) || 2048, 8192);
        let fullResponse = "";
        const generationStartedAt = Date.now();

        log("stream", "start", { model, maxTokens, systemPromptLen: systemPrompt.length });

        try {
          const anthropic = getAnthropic();

          // Build messages — last user message gets attachment content blocks injected
          const attachmentLogger = (msg: string, err?: string) =>
            log("attachment", "warn", { msg, err });

          // Claude rejects messages with empty content — filter before building the payload.
          // This can happen when conversation history contains image-render turns where
          // the user sent attachments only, or the assistant response was empty.
          const nonEmptyMessages = messages.filter(
            (m) => typeof m.content === "string" && m.content.trim().length > 0
          );
          if (nonEmptyMessages.length < messages.length) {
            log("message-filter", "warn", {
              removed: messages.length - nonEmptyMessages.length,
              total: messages.length,
              msg: "Dropped empty-content messages before sending to Claude",
            });
          }

          let claudeMessages: Anthropic.Messages.MessageParam[];
          if (attachments.length > 0) {
            log("attachment-build", "start", { count: attachments.length });
            try {
              claudeMessages = await buildMessagesWithAttachments(
                nonEmptyMessages,
                attachments,
                attachmentLogger
              );
              log("attachment-build", "ok", {
                blocks: Array.isArray(claudeMessages[claudeMessages.length - 1]?.content)
                  ? (claudeMessages[claudeMessages.length - 1].content as unknown[]).length
                  : 1,
              });
            } catch (attErr) {
              // Fail-open: if attachment processing errors, fall back to plain messages
              log("attachment-build", "error", { err: String(attErr) });
              claudeMessages = nonEmptyMessages.map((m) => ({ role: m.role, content: m.content }));
            }
          } else {
            claudeMessages = nonEmptyMessages.map((m) => ({ role: m.role, content: m.content }));
          }

          const stream = anthropic.messages.stream({
            model,
            max_tokens: maxTokens,
            system: systemPrompt,
            messages: claudeMessages,
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
          const generationDurationMs = Date.now() - generationStartedAt;
          log("stream", "ok", {
            inputTokens: finalMsg.usage.input_tokens,
            outputTokens: finalMsg.usage.output_tokens,
            durationMs: generationDurationMs,
            responseLen: fullResponse.length,
          });

          const tokenUsage: TokenUsage = {
            inputTokens: finalMsg.usage.input_tokens,
            outputTokens: finalMsg.usage.output_tokens,
            totalTokens: finalMsg.usage.input_tokens + finalMsg.usage.output_tokens,
          };

          if (classification?._routingTokens) {
            tokenUsage.routingInputTokens = classification._routingTokens.input;
            tokenUsage.routingOutputTokens = classification._routingTokens.output;
            tokenUsage.totalTokens += classification._routingTokens.input + classification._routingTokens.output;
          }

          // ── STAGE 11: Post-stream writes (all fire-and-forget) ────────────

          // Operator mode: analyze output for weak refusals
          const refusalAnalysis = analyzeForWeakRefusals(fullResponse);
          if (refusalAnalysis.hasWeakRefusal) {
            log("weak-refusal", "warn", {
              severity: refusalAnalysis.severity,
              count: refusalAnalysis.patterns.length,
              role: activeAgent.role,
              firstPattern: refusalAnalysis.patterns[0]?.slice(0, 80),
            });
          }

          // Tool requests
          const toolRequests = parseToolRequests(fullResponse);
          const toolCallIds: string[] = [];
          if (toolRequests.length > 0) {
            const now = new Date().toISOString();
            for (const toolReq of toolRequests) {
              try {
                const approvalContent = formatToolCallForApproval(toolReq.tool, toolReq.inputs);
                const approvalRef = db.collection("approvalQueue").doc();
                const callRef = db.collection("toolCalls").doc();
                await Promise.all([
                  callRef.set({
                    tool: toolReq.tool,
                    label: toolReq.tool,
                    inputs: toolReq.inputs,
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
                  }),
                  approvalRef.set({
                    type: "workflow_step",
                    title: `Tool Request: ${toolReq.tool}`,
                    description: `Agent requested tool: ${toolReq.tool}`,
                    content: approvalContent,
                    context: { toolCallId: callRef.id, tool: toolReq.tool },
                    requestedBy: `agent:${activeAgentId}`,
                    agentId: activeAgentId,
                    agentRole: activeAgent.role,
                    agentName: activeAgent.name,
                    workflowRunId: workflowRunRef?.id ?? null,
                    status: "pending",
                    priority: "medium",
                    reviewedBy: null, reviewedAt: null, reviewNote: null,
                    createdAt: now, expiresAt: null,
                  }),
                ]);
                toolCallIds.push(callRef.id);
              } catch (err) {
                log("tool-queue", "warn", { tool: toolReq.tool, err: String(err) });
              }
            }
          }

          // Cost tracking
          try {
            const costData = createCostEvent(
              "chat_generation",
              activeAgentId,
              activeAgent.role as AgentRole,
              model,
              finalMsg.usage.input_tokens,
              finalMsg.usage.output_tokens,
              { conversationId: convRef?.id ?? conversationId }
            );
            writeCostEvent(db, costData);
          } catch (err) {
            log("cost-event", "warn", { err: String(err) });
          }

          // Audit event
          try {
            writeAuditEvent(
              db,
              "agent_generation",
              "agent",
              activeAgentId,
              { uid: decoded.uid, role: "admin" },
              {
                payload: {
                  model,
                  inputTokens: tokenUsage.inputTokens,
                  outputTokens: tokenUsage.outputTokens,
                  knowledgeChunksInjected,
                  durationMs: generationDurationMs,
                  conversationId: convRef?.id ?? conversationId ?? null,
                  workflowRunId: workflowRunRef?.id ?? null,
                },
              }
            );
          } catch (err) {
            log("audit-event", "warn", { err: String(err) });
          }

          // Agent log
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
              eventKnowledgeCount,
              useKnowledge: useKnowledge ?? false,
              attachmentCount: attachments.length,
              totalDurationMs: Date.now() - requestStartedAt,
              operatorMode: true,
              weakRefusalDetected: refusalAnalysis.hasWeakRefusal,
              weakRefusalSeverity: refusalAnalysis.severity,
              weakRefusalPatterns: refusalAnalysis.patterns, // always string[], never undefined
            },
          });

          // Multimodal analytics (fire-and-forget — only when attachments present)
          if (attachments.length > 0) {
            try {
              const workflowHints = inferWorkflowHints(attachments);
              // Build type breakdown
              const typeBreakdown: Partial<Record<import("@/lib/takers-ai/attachments").AttachmentFileType, number>> = {};
              for (const att of attachments) {
                typeBreakdown[att.type] = (typeBreakdown[att.type] ?? 0) + 1;
              }
              const totalSizeBytes = attachments.reduce((sum, a) => sum + a.size, 0);
              // Infer processing methods used
              const processingMethods: string[] = [];
              if (attachments.some((a) => a.type === "image")) processingMethods.push("vision_block");
              if (attachments.some((a) => a.type === "pdf")) processingMethods.push("document_block");
              if (attachments.some((a) => a.type === "text")) processingMethods.push("text_inline");
              if (attachments.some((a) => a.type === "document")) processingMethods.push("description_note");
              writeMultimodalAnalytics(db, {
                attachmentCount: attachments.length,
                typeBreakdown,
                totalSizeBytes,
                workflowHints,
                processingMethods,
                estimatedTokensAdded: Math.round(totalSizeBytes / 3), // rough estimate
                agentId: activeAgentId,
                agentRole: activeAgent.role as string,
                conversationId: convRef?.id ?? conversationId ?? null,
                workflowRunId: workflowRunRef?.id ?? null,
                processingSucceeded: true,
                processingErrors: [],
                processingMs: generationDurationMs,
              });
            } catch (mmErr) {
              log("multimodal-analytics", "warn", { err: String(mmErr) });
            }
          }

          // Save assistant response to conversation
          if (convRef && fullResponse) {
            convRef.collection("messages").doc().set({
              role: "assistant",
              content: fullResponse,
              agentId: activeAgentId,
              agentRole: activeAgent.role,
              workflowRunId: workflowRunRef?.id ?? null,
              attachments: [],
              createdAt: new Date().toISOString(),
            }).catch((err) => log("conv-msg-save", "warn", { err: String(err) }));

            convRef.update({
              messageCount: messages.length + 1,
              lastMessage: fullResponse.slice(0, 120),
              updatedAt: new Date().toISOString(),
            }).catch((err) => log("conv-update", "warn", { err: String(err) }));
          }

          // Update workflow run
          if (workflowRunRef) {
            workflowRunRef.update({
              status: "complete",
              completedAt: new Date().toISOString(),
              tokenUsage,
            }).catch((err) => log("workflowRun-update", "warn", { err: String(err) }));
          }

          // Done event
          send({
            type: "done",
            conversationId: convRef?.id ?? null,
            workflowRunId: workflowRunRef?.id ?? null,
            tokenUsage,
            toolCallIds: toolCallIds.length > 0 ? toolCallIds : undefined,
            totalDurationMs: Date.now() - handlerStart,
            operatorMode: true,
            weakRefusalDetected: refusalAnalysis.hasWeakRefusal,
            weakRefusalSeverity: refusalAnalysis.hasWeakRefusal ? refusalAnalysis.severity : undefined,
          });

        } catch (streamErr) {
          // Claude API failure — report in stream
          fatal("claude-stream", streamErr);

          writeAgentLog(db, {
            agentId: activeAgentId,
            agentRole: activeAgent.role,
            agentName: activeAgent.name,
            conversationId: convRef?.id ?? conversationId ?? null,
            workflowRunId: workflowRunRef?.id ?? null,
            type: "error",
            userMessage: userMessage.slice(0, 200),
            error: streamErr instanceof Error ? streamErr.message : String(streamErr),
            durationMs: Date.now() - generationStartedAt,
          });

          if (workflowRunRef) {
            workflowRunRef
              .update({
                status: "failed",
                errorMessage: streamErr instanceof Error ? streamErr.message : String(streamErr),
              })
              .catch(() => {});
          }
          return; // controller already closed in fatal()
        }

        controller.close();

      } catch (outerErr) {
        // Catch-all for any unhandled error in stream orchestration
        fatal("orchestration", outerErr);
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
