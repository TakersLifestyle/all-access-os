// Takers AI Command Center — shared TypeScript interfaces
// Phase 3: Memory priorities, confidence routing, approval queue, observability

export type AgentRole =
  | "operator"
  | "content"
  | "marketing"
  | "events"
  | "support"
  | "strategy"
  | "developer"
  | "operations";

export type AgentModel =
  | "claude-opus-4-5"
  | "claude-sonnet-4-5"
  | "claude-haiku-4-5";

// ── The 4 pillars of every agent ─────────────────────────────────────────────
// Role         → what the agent IS (AgentRole)
// Instructions → how it should behave (agentInstructions collection, admin-editable)
// Tools        → what capabilities it has (AgentTool[])
// Memory       → brand memory (shared, priority-ordered) + conversation history

export type AgentTool =
  | "save_output"        // save response to savedOutputs
  | "create_task"        // create an aiTask from response
  | "log_feedback"       // record thumbs on responses
  | "route_to_agent"     // operator only — route to specialist
  | "search_memory"      // query brandMemory by keyword
  | "request_approval"   // create an approvalQueue item before acting
  | "execute_workflow";  // trigger a workflow definition run

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  description: string;
  systemPrompt: string;       // base role prompt (not admin-editable in prod)
  icon: string;
  color: string;              // tailwind bg class e.g. "bg-red-600"
  model: AgentModel;
  maxTokens: number;
  tools: AgentTool[];
  isActive: boolean;
  isDefault: boolean;         // only Takers Operator is true
  createdAt: string;
  updatedAt: string;
}

// Admin-editable instructions, stored separately so they can be updated
// without touching the base systemPrompt on the agent document.
export interface AgentInstructions {
  id: string;             // same as agentId
  agentId: string;
  agentName: string;
  instructions: string;   // the editable block appended after systemPrompt
  tools: AgentTool[];     // can override agent.tools
  updatedAt: string;
  updatedBy: string;      // admin uid
}

// ── Memory System ─────────────────────────────────────────────────────────────
// 8 structured categories. Higher priority blocks inject first into system prompt.

export type MemoryCategory =
  | "brandVoice"
  | "eventStandards"
  | "communityRules"
  | "pricingStrategy"
  | "contentFrameworks"
  | "audienceProfiles"
  | "operationalSOPs"
  | "bannedPhrases";

export interface BrandMemory {
  id: string;
  key: string;
  category: MemoryCategory;
  title: string;
  content: string;
  priority: number;       // 1-10. Higher = injected earlier in system prompt.
  version: number;        // increments on each edit
  isActive: boolean;      // false = excluded from AI injection
  updatedAt: string;
  updatedBy?: string;     // admin uid who last edited
}

// Stored in subcollection: brandMemory/{memoryId}/versions/{versionId}
export interface MemoryVersion {
  id: string;
  version: number;
  content: string;
  title: string;
  category: MemoryCategory;
  priority: number;
  updatedAt: string;
  updatedBy: string;
  changeNote?: string;
}

// ── Routing System ────────────────────────────────────────────────────────────
// Confidence 0-100. Below threshold → fallback to Operator.
export interface RoutingDecision {
  role: AgentRole;
  reason: string;
  confidence: number;           // 0-100
  alternativeRoles?: AgentRole[];
  fallback: boolean;            // true if low confidence forced fallback
}

// ── Prompt Templates ──────────────────────────────────────────────────────────
export interface PromptTemplate {
  id: string;
  agentId: string;   // "any" for global
  name: string;
  description: string;
  prompt: string;    // with {{variable}} placeholders
  variables: string[];
  category: string;
  usageCount: number;
  createdAt: string;
}

// ── Saved Outputs ─────────────────────────────────────────────────────────────
export type OutputType =
  | "caption"
  | "email"
  | "strategy"
  | "copy"
  | "task"
  | "prompt"
  | "plan"
  | "other";

export interface SavedOutput {
  id: string;
  agentId: string;
  agentRole: AgentRole;
  conversationId?: string;
  workflowRunId?: string;
  title: string;
  content: string;
  type: OutputType;
  tags: string[];
  createdAt: string;
}

// ── Conversations ─────────────────────────────────────────────────────────────
export interface Conversation {
  id: string;
  agentId: string;
  agentRole: AgentRole;
  title: string;
  messageCount: number;
  lastMessage: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  agentId?: string;
  agentRole?: AgentRole;
  workflowRunId?: string;
  createdAt: string;
}

// ── Workflow Definitions ──────────────────────────────────────────────────────
// Reusable multi-step pipelines. Each step is handled by a specialist agent.
// Steps with requiresApproval=true create an ApprovalItem before proceeding.

export interface WorkflowStepDefinition {
  id: string;               // step slug e.g. "draft_copy"
  name: string;
  description: string;
  agentRole: AgentRole;
  promptTemplate: string;   // with {{variable}} placeholders
  requiresApproval: boolean;
  approvalType?: ApprovalType;
  outputKey: string;        // key in run context where output is stored
  order: number;            // 0-indexed execution order
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: "content" | "events" | "support" | "marketing" | "operations";
  steps: WorkflowStepDefinition[];
  estimatedMinutes: number;
  approvalCount: number;    // cached: steps with requiresApproval count
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Workflow Runs ─────────────────────────────────────────────────────────────
// Every Operator routing decision creates a WorkflowRun.
// Pipeline runs reference a WorkflowDefinition and track step outputs.

export type WorkflowStatus = "routing" | "processing" | "complete" | "failed";

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  routingInputTokens?: number;    // tokens used by the Haiku classifier
  routingOutputTokens?: number;
  totalTokens: number;
}

export interface WorkflowRun {
  id: string;
  conversationId: string;
  userMessage: string;           // truncated to 200 chars
  originAgentId: string;         // always the Operator
  routedToAgentId: string;
  routedToRole: AgentRole;
  routingReason: string;
  routingConfidence?: number;    // 0-100
  alternativeRoles?: AgentRole[];
  status: WorkflowStatus;
  outputSaved: boolean;
  tokenUsage?: TokenUsage;
  workflowDefinitionId?: string; // set if triggered from a definition
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
}

// ── Approval Queue ────────────────────────────────────────────────────────────
// Actions that require admin review before execution.
// Created by agents or workflow steps; reviewed in /takers-ai/approvals.

export type ApprovalType =
  | "email_send"
  | "stripe_action"
  | "public_publish"
  | "announcement"
  | "content_publish"
  | "workflow_step"
  | "other";

export type ApprovalStatus = "pending" | "approved" | "rejected";
export type ApprovalPriority = "low" | "medium" | "high" | "critical";

export interface ApprovalItem {
  id: string;
  type: ApprovalType;
  title: string;
  description: string;          // short human-readable summary
  content: string;              // the payload being approved (truncated to 2000 chars)
  context: Record<string, unknown>;
  requestedBy: string;          // "agent:<agentId>" or "admin:<uid>"
  agentId?: string;
  agentRole?: AgentRole;
  agentName?: string;
  workflowRunId?: string;
  conversationId?: string;
  status: ApprovalStatus;
  priority: ApprovalPriority;
  reviewedBy?: string;          // admin uid
  reviewedAt?: string;
  reviewNote?: string;
  createdAt: string;
  expiresAt?: string;           // ISO — auto-expired after this date
}

// ── Observability / Agent Logs ────────────────────────────────────────────────
// Granular logs for every routing decision, generation, and tool call.
// Written by API routes; readable from /takers-ai/logs.

export type AgentLogType =
  | "routing"
  | "generation"
  | "tool_call"
  | "error"
  | "approval_created"
  | "approval_resolved"
  | "workflow_step"
  | "fallback";

export interface AgentLog {
  id: string;
  agentId: string;
  agentRole: AgentRole;
  agentName: string;
  conversationId?: string;
  workflowRunId?: string;
  type: AgentLogType;
  userMessage?: string;       // first 200 chars
  routingDecision?: {
    role: AgentRole;
    reason: string;
    confidence: number;
    fallback: boolean;
    alternativeRoles?: AgentRole[];
  };
  tokenUsage?: TokenUsage;
  durationMs?: number;
  error?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// ── Feedback ──────────────────────────────────────────────────────────────────
export type FeedbackRating = "positive" | "negative";

export interface FeedbackLog {
  id: string;
  agentId: string;
  agentRole: AgentRole;
  agentName: string;
  conversationId?: string;
  outputId?: string;
  workflowRunId?: string;
  messageContent: string;
  rating: FeedbackRating;
  comment: string;
  adminUid: string;
  createdAt: string;
}

// ── Tasks ─────────────────────────────────────────────────────────────────────
export type TaskStatus = "todo" | "in_progress" | "done" | "archived";
export type TaskPriority = "low" | "medium" | "high";

export interface AITask {
  id: string;
  title: string;
  description: string;
  agentId: string;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
}

// ── Label Maps ────────────────────────────────────────────────────────────────

export const MEMORY_CATEGORY_LABELS: Record<MemoryCategory, string> = {
  brandVoice:        "Brand Voice",
  eventStandards:    "Event Standards",
  communityRules:    "Community Rules",
  pricingStrategy:   "Pricing Strategy",
  contentFrameworks: "Content Frameworks",
  audienceProfiles:  "Audience Profiles",
  operationalSOPs:   "Operational SOPs",
  bannedPhrases:     "Banned Phrases",
};

export const MEMORY_CATEGORY_COLORS: Record<MemoryCategory, string> = {
  brandVoice:        "bg-red-600/15 border-red-600/25 text-red-300",
  eventStandards:    "bg-purple-600/15 border-purple-600/25 text-purple-300",
  communityRules:    "bg-amber-600/15 border-amber-600/25 text-amber-300",
  pricingStrategy:   "bg-emerald-600/15 border-emerald-600/25 text-emerald-300",
  contentFrameworks: "bg-pink-600/15 border-pink-600/25 text-pink-300",
  audienceProfiles:  "bg-blue-600/15 border-blue-600/25 text-blue-300",
  operationalSOPs:   "bg-cyan-600/15 border-cyan-600/25 text-cyan-300",
  bannedPhrases:     "bg-orange-600/15 border-orange-600/25 text-orange-300",
};

export const OUTPUT_TYPE_LABELS: Record<OutputType, string> = {
  caption:  "Caption",
  email:    "Email",
  strategy: "Strategy",
  copy:     "Copy",
  task:     "Task",
  prompt:   "Prompt",
  plan:     "Plan",
  other:    "Other",
};

export const AGENT_ROLE_LABELS: Record<AgentRole, string> = {
  operator:   "Executive Operator",
  content:    "Content Agent",
  marketing:  "Marketing Agent",
  events:     "Events Agent",
  support:    "Support Agent",
  strategy:   "Strategy Agent",
  developer:  "Developer Agent",
  operations: "Operations Agent",
};

export const AGENT_ROLE_COLORS: Record<AgentRole, string> = {
  operator:   "bg-red-600",
  content:    "bg-pink-600",
  marketing:  "bg-orange-500",
  events:     "bg-purple-600",
  support:    "bg-blue-600",
  strategy:   "bg-indigo-600",
  developer:  "bg-emerald-600",
  operations: "bg-amber-500",
};

export const AGENT_ROLE_ICONS: Record<AgentRole, string> = {
  operator:   "◎",
  content:    "✏️",
  marketing:  "📣",
  events:     "🎟",
  support:    "💬",
  strategy:   "🎯",
  developer:  "⚙️",
  operations: "📋",
};

export const APPROVAL_TYPE_LABELS: Record<ApprovalType, string> = {
  email_send:      "Email Send",
  stripe_action:   "Stripe Action",
  public_publish:  "Public Publish",
  announcement:    "Announcement",
  content_publish: "Content Publish",
  workflow_step:   "Workflow Step",
  other:           "Other",
};

export const APPROVAL_PRIORITY_COLORS: Record<ApprovalPriority, string> = {
  low:      "bg-white/5 border-white/10 text-white/40",
  medium:   "bg-amber-600/10 border-amber-600/20 text-amber-300",
  high:     "bg-orange-600/10 border-orange-600/20 text-orange-300",
  critical: "bg-red-600/10 border-red-600/20 text-red-300",
};

export const APPROVAL_STATUS_STYLES: Record<ApprovalStatus, string> = {
  pending:  "bg-amber-600/15 border-amber-600/25 text-amber-300",
  approved: "bg-emerald-600/15 border-emerald-600/25 text-emerald-300",
  rejected: "bg-red-600/15 border-red-600/25 text-red-300",
};

export const LOG_TYPE_COLORS: Record<AgentLogType, string> = {
  routing:            "text-amber-400",
  generation:         "text-emerald-400",
  tool_call:          "text-blue-400",
  error:              "text-red-400",
  approval_created:   "text-orange-400",
  approval_resolved:  "text-emerald-400",
  workflow_step:      "text-purple-400",
  fallback:           "text-orange-400",
};

// Confidence thresholds
export const ROUTING_CONFIDENCE_THRESHOLD = 60; // below this → fallback to Operator

// Legacy category mapping (for seed migration)
export const LEGACY_CATEGORY_MAP: Record<string, MemoryCategory> = {
  brand_voice:    "brandVoice",
  audience:       "audienceProfiles",
  events:         "eventStandards",
  platform_rules: "communityRules",
  content:        "contentFrameworks",
  business:       "pricingStrategy",
};
