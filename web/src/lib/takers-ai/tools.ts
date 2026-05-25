// Takers AI — Controlled Tool Invocation Layer
//
// Agents can REQUEST tools but cannot EXECUTE them without admin approval.
// Flow:
//   1. Agent outputs a tool request in its structured output (or chat response)
//   2. API route calls createToolCall() → writes to `toolCalls` collection
//   3. createToolCall() also creates an approvalQueue item (type: "workflow_step")
//   4. Admin reviews in /takers-ai/approvals → approves or rejects
//   5. PATCH /api/takers-ai/tools executes the approved call via executeToolCall()
//   6. Result is saved back to the toolCall doc
//
// Tools available:
//   gmail_draft        — Compose a Gmail draft (does NOT send)
//   calendar_suggest   — Suggest meeting times or event blocks
//   stripe_lookup      — Read customer/subscription data from Stripe
//   drive_retrieve     — Search Google Drive for a document
//   discord_draft      — Compose a Discord announcement (does NOT post)
//
// All tools are read/compose only — no writes without a second approval.
// External API calls only happen inside executeToolCall() after approval.

import type { AgentRole } from "./types";

// ── Tool types ────────────────────────────────────────────────────────────────
export type ToolName =
  | "gmail_draft"
  | "calendar_suggest"
  | "stripe_lookup"
  | "drive_retrieve"
  | "discord_draft";

export type ToolCallStatus =
  | "pending_approval"  // created, awaiting admin review
  | "approved"          // admin approved, ready to execute
  | "executing"         // currently running
  | "completed"         // executed successfully
  | "rejected"          // admin rejected
  | "failed";           // execution error

export interface ToolParameter {
  key: string;
  type: "string" | "number" | "boolean" | "string[]";
  required: boolean;
  description: string;
  example?: string;
}

export interface ToolDefinition {
  name: ToolName;
  label: string;
  description: string;
  category: "email" | "calendar" | "payments" | "storage" | "communication";
  parameters: ToolParameter[];
  requiresApproval: true;        // always true — no tool auto-executes
  returnType: "draft" | "data" | "suggestions";
  approvalNote: string;          // shown to admin in approval UI
}

export interface ToolCall {
  id: string;
  tool: ToolName;
  label: string;
  inputs: Record<string, unknown>;
  status: ToolCallStatus;
  // Relations
  agentId: string;
  agentRole: AgentRole;
  agentName: string;
  conversationId: string | null;
  workflowRunId: string | null;
  pipelineRunId: string | null;
  approvalItemId: string | null;
  // Result (populated after execution)
  output: Record<string, unknown> | null;
  outputSummary: string | null;   // 1-line human-readable summary of result
  errorMessage: string | null;
  // Metadata
  requestedAt: string;
  approvedAt: string | null;
  executedAt: string | null;
  approvedBy: string | null;
}

// ── Tool registry ─────────────────────────────────────────────────────────────
export const TOOL_REGISTRY: Record<ToolName, ToolDefinition> = {
  gmail_draft: {
    name: "gmail_draft",
    label: "Gmail — Compose Draft",
    description: "Compose an email draft in Gmail. Does not send — creates a draft only.",
    category: "email",
    parameters: [
      { key: "to",      type: "string",   required: true,  description: "Recipient email address" },
      { key: "subject", type: "string",   required: true,  description: "Email subject line" },
      { key: "body",    type: "string",   required: true,  description: "Email body (plain text or HTML)" },
      { key: "cc",      type: "string",   required: false, description: "CC address(es)" },
      { key: "replyTo", type: "string",   required: false, description: "Reply-to address override" },
    ],
    requiresApproval: true,
    returnType: "draft",
    approvalNote: "Review the draft before it is saved to Gmail. It will NOT be sent automatically.",
  },

  calendar_suggest: {
    name: "calendar_suggest",
    label: "Calendar — Suggest Times",
    description: "Generate scheduling suggestions for meetings or event blocks.",
    category: "calendar",
    parameters: [
      { key: "title",         type: "string",   required: true,  description: "Meeting or event title" },
      { key: "durationMins",  type: "number",   required: true,  description: "Duration in minutes" },
      { key: "participants",  type: "string[]", required: false, description: "Participant names/emails" },
      { key: "preferredDays", type: "string[]", required: false, description: "Preferred days (e.g. ['Monday','Wednesday'])" },
      { key: "notes",         type: "string",   required: false, description: "Additional context or constraints" },
    ],
    requiresApproval: true,
    returnType: "suggestions",
    approvalNote: "Review suggested times before adding to the calendar.",
  },

  stripe_lookup: {
    name: "stripe_lookup",
    label: "Stripe — Customer Lookup",
    description: "Read-only lookup of customer or subscription data from Stripe.",
    category: "payments",
    parameters: [
      { key: "query",    type: "string",  required: true,  description: "Email, customer ID, or subscription ID to look up" },
      { key: "lookupType", type: "string", required: true, description: "One of: customer, subscription, payment_intent",
        example: "customer" },
    ],
    requiresApproval: true,
    returnType: "data",
    approvalNote: "Read-only Stripe lookup. No charges or changes will be made.",
  },

  drive_retrieve: {
    name: "drive_retrieve",
    label: "Google Drive — Retrieve Document",
    description: "Search Google Drive for a document by name or keywords and return its content.",
    category: "storage",
    parameters: [
      { key: "query",   type: "string",  required: true,  description: "Search query or document name" },
      { key: "maxResults", type: "number", required: false, description: "Max documents to return (default: 3)" },
      { key: "mimeType",   type: "string", required: false, description: "Optional MIME type filter (e.g. 'application/vnd.google-apps.document')" },
    ],
    requiresApproval: true,
    returnType: "data",
    approvalNote: "Read-only Drive search. No documents will be modified.",
  },

  discord_draft: {
    name: "discord_draft",
    label: "Discord — Draft Announcement",
    description: "Compose a Discord announcement message. Does NOT post — review required first.",
    category: "communication",
    parameters: [
      { key: "channel",   type: "string",  required: true,  description: "Target channel name (e.g. #announcements)" },
      { key: "message",   type: "string",  required: true,  description: "Full message body (supports Discord markdown)" },
      { key: "pingRole",  type: "string",  required: false, description: "Role to ping (e.g. '@everyone' or '@members')" },
      { key: "embedTitle",   type: "string", required: false, description: "Optional embed card title" },
      { key: "embedColor",   type: "string", required: false, description: "Embed accent color hex (e.g. #FF0000)" },
    ],
    requiresApproval: true,
    returnType: "draft",
    approvalNote: "Review before posting to Discord. This message will NOT be posted automatically.",
  },
};

export function getTool(name: ToolName): ToolDefinition | null {
  return TOOL_REGISTRY[name] ?? null;
}

export function getAllTools(): ToolDefinition[] {
  return Object.values(TOOL_REGISTRY);
}

// ── Tool call factory ─────────────────────────────────────────────────────────
export function createToolCallRecord(
  tool: ToolName,
  inputs: Record<string, unknown>,
  agentId: string,
  agentRole: AgentRole,
  agentName: string,
  context: {
    conversationId?: string;
    workflowRunId?: string;
    pipelineRunId?: string;
  } = {}
): Omit<ToolCall, "id"> {
  const def = TOOL_REGISTRY[tool];
  return {
    tool,
    label: def?.label ?? tool,
    inputs,
    status: "pending_approval",
    agentId,
    agentRole,
    agentName,
    conversationId: context.conversationId ?? null,
    workflowRunId: context.workflowRunId ?? null,
    pipelineRunId: context.pipelineRunId ?? null,
    approvalItemId: null,
    output: null,
    outputSummary: null,
    errorMessage: null,
    requestedAt: new Date().toISOString(),
    approvedAt: null,
    executedAt: null,
    approvedBy: null,
  };
}

// ── Input validator ───────────────────────────────────────────────────────────
export function validateToolInputs(
  tool: ToolName,
  inputs: Record<string, unknown>
): { valid: boolean; errors: string[] } {
  const def = TOOL_REGISTRY[tool];
  if (!def) return { valid: false, errors: [`Unknown tool: ${tool}`] };

  const errors: string[] = [];
  for (const param of def.parameters) {
    if (param.required && (inputs[param.key] === undefined || inputs[param.key] === null)) {
      errors.push(`Missing required parameter: ${param.key}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ── Approval content builder ──────────────────────────────────────────────────
// Formats tool call details into a human-readable string for the approval queue.
export function formatToolCallForApproval(
  tool: ToolName,
  inputs: Record<string, unknown>
): string {
  const def = TOOL_REGISTRY[tool];
  if (!def) return JSON.stringify(inputs, null, 2);

  const lines: string[] = [`**Tool:** ${def.label}`, `**Category:** ${def.category}`, ""];
  lines.push("**Inputs:**");
  for (const param of def.parameters) {
    const val = inputs[param.key];
    if (val !== undefined && val !== null) {
      const valStr = Array.isArray(val)
        ? (val as string[]).join(", ")
        : String(val).slice(0, 300);
      lines.push(`• ${param.key}: ${valStr}`);
    }
  }
  lines.push("", `**Note:** ${def.approvalNote}`);
  return lines.join("\n");
}

// ── Mock executors ────────────────────────────────────────────────────────────
// These are the actual execution functions called AFTER approval.
// Currently return structured drafts/data ready for the real API.
// Wire up OAuth tokens / API keys to replace the mock responses.

export async function executeToolCall(
  tool: ToolName,
  inputs: Record<string, unknown>
): Promise<{ success: boolean; output: Record<string, unknown>; summary: string }> {
  switch (tool) {
    case "gmail_draft": {
      // TODO: wire up Google OAuth + Gmail API
      // const gmail = google.gmail({ version: "v1", auth: oauthClient });
      // const draft = await gmail.users.drafts.create({ userId: "me", requestBody: { message: { raw: encodedMessage } } });
      return {
        success: true,
        output: {
          status: "draft_ready",
          to: inputs.to,
          subject: inputs.subject,
          bodyPreview: String(inputs.body ?? "").slice(0, 200),
          note: "Connect Google OAuth to auto-create the draft. Review and send manually.",
        },
        summary: `Draft ready for: ${inputs.to} — "${inputs.subject}"`,
      };
    }

    case "calendar_suggest": {
      // TODO: wire up Google Calendar API for real availability
      const suggestions = [
        { slot: "Tomorrow 10:00 AM", available: true },
        { slot: "Tomorrow 2:00 PM", available: true },
        { slot: "Thursday 11:00 AM", available: true },
      ];
      return {
        success: true,
        output: {
          title: inputs.title,
          durationMins: inputs.durationMins,
          suggestions,
          note: "Connect Google Calendar to check real availability.",
        },
        summary: `3 time suggestions generated for "${inputs.title}"`,
      };
    }

    case "stripe_lookup": {
      // TODO: call Stripe API with STRIPE_SECRET_KEY
      // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
      // const customers = await stripe.customers.search({ query: `email:"${inputs.query}"` });
      return {
        success: true,
        output: {
          query: inputs.query,
          lookupType: inputs.lookupType,
          note: "Stripe lookup: STRIPE_SECRET_KEY is available. Connect the execution handler to call Stripe directly.",
          instructions: `Call GET /api/admin/users or query Stripe directly for ${inputs.query}`,
        },
        summary: `Stripe lookup prepared for: ${inputs.query}`,
      };
    }

    case "drive_retrieve": {
      // TODO: wire up Google Drive API
      return {
        success: true,
        output: {
          query: inputs.query,
          results: [],
          note: "Connect Google Drive OAuth to retrieve documents. Searched for: " + inputs.query,
        },
        summary: `Drive search queued for: "${inputs.query}"`,
      };
    }

    case "discord_draft": {
      // TODO: wire up Discord bot token
      // const webhook = await fetch(process.env.DISCORD_WEBHOOK_URL, { method: "POST", body: JSON.stringify({ content: inputs.message }) });
      return {
        success: true,
        output: {
          status: "draft_ready",
          channel: inputs.channel,
          message: inputs.message,
          pingRole: inputs.pingRole ?? null,
          embedTitle: inputs.embedTitle ?? null,
          note: "Add DISCORD_WEBHOOK_URL env var to auto-post. Copy message above to post manually.",
        },
        summary: `Discord draft ready for ${inputs.channel}`,
      };
    }

    default:
      return {
        success: false,
        output: { error: `Unknown tool: ${tool}` },
        summary: "Tool execution failed",
      };
  }
}

// ── Prompt injection ──────────────────────────────────────────────────────────
// Appended to agent system prompts to tell them what tools they can request.
export function buildToolAwarenessPrompt(availableTools: ToolName[]): string {
  if (availableTools.length === 0) return "";

  const toolDescriptions = availableTools
    .map((t) => {
      const def = TOOL_REGISTRY[t];
      if (!def) return null;
      const params = def.parameters
        .filter((p) => p.required)
        .map((p) => `${p.key} (${p.type})`)
        .join(", ");
      return `• **${def.label}** (\`${t}\`): ${def.description} Params: ${params || "none"}`;
    })
    .filter(Boolean)
    .join("\n");

  return `\n\n---\n\n## AVAILABLE TOOLS\nYou may request the following tools by outputting a JSON block starting with \`{"__tool__":\`. These requests are queued for admin approval — you do NOT execute them directly.\n\n${toolDescriptions}\n\nTo request a tool, include in your response:\n\`\`\`json\n{"__tool__": "<tool_name>", "inputs": { ... }}\n\`\`\`\nExplain WHY you are requesting the tool and what you expect it to return.`;
}

// ── Tool request parser ───────────────────────────────────────────────────────
// Scans an agent's text output for embedded tool request blocks.
export interface ParsedToolRequest {
  tool: ToolName;
  inputs: Record<string, unknown>;
  rawBlock: string;
}

export function parseToolRequests(text: string): ParsedToolRequest[] {
  const requests: ParsedToolRequest[] = [];
  const toolBlockRegex = /```(?:json)?\s*(\{[\s\S]*?"__tool__"[\s\S]*?\})\s*```/g;
  let match;

  while ((match = toolBlockRegex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.__tool__ && TOOL_REGISTRY[parsed.__tool__ as ToolName]) {
        requests.push({
          tool: parsed.__tool__ as ToolName,
          inputs: parsed.inputs ?? {},
          rawBlock: match[0],
        });
      }
    } catch {
      // Skip malformed blocks
    }
  }

  // Also check for inline (non-fenced) tool requests
  const inlineRegex = /\{"__tool__"\s*:\s*"([^"]+)"\s*,\s*"inputs"\s*:\s*(\{[^}]+\})\}/g;
  while ((match = inlineRegex.exec(text)) !== null) {
    try {
      const tool = match[1] as ToolName;
      const inputs = JSON.parse(match[2]);
      if (TOOL_REGISTRY[tool]) {
        requests.push({ tool, inputs, rawBlock: match[0] });
      }
    } catch {
      // Skip
    }
  }

  return requests;
}
