// Takers AI Command Center — shared TypeScript interfaces

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

// ── The 4 pillars of every agent ────────────────────────────────────────────
// Role       → what the agent IS (AgentRole)
// Instructions → how it should behave (agentInstructions collection, admin-editable)
// Tools      → what capabilities it has (AgentTool[])
// Memory     → brand memory (shared) + conversation history (per-session)

export type AgentTool =
  | "save_output"      // save response to savedOutputs
  | "create_task"      // create an aiTask from response
  | "log_feedback"     // record thumbs on responses
  | "route_to_agent"   // operator only — route to specialist
  | "search_memory";   // query brandMemory by keyword

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
  tools: AgentTool[];         // enabled tools for this agent
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

export type MemoryCategory =
  | "brand_voice"
  | "audience"
  | "events"
  | "platform_rules"
  | "content"
  | "business";

export interface BrandMemory {
  id: string;
  key: string;
  category: MemoryCategory;
  title: string;
  content: string;
  updatedAt: string;
}

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
  agentId?: string;           // which agent produced this (for routed messages)
  agentRole?: AgentRole;
  workflowRunId?: string;
  createdAt: string;
}

// ── Workflow tracking ────────────────────────────────────────────────────────
// Every message routed through the Operator is tracked as a WorkflowRun.
export type WorkflowStatus = "routing" | "processing" | "complete" | "failed";

export interface WorkflowRun {
  id: string;
  conversationId: string;
  userMessage: string;        // truncated to 200 chars
  originAgentId: string;      // always the Operator
  routedToAgentId: string;    // which specialist handled it
  routedToRole: AgentRole;
  routingReason: string;      // why the Operator chose this specialist
  status: WorkflowStatus;
  outputSaved: boolean;
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
}

// ── Feedback system ──────────────────────────────────────────────────────────
export type FeedbackRating = "positive" | "negative";

export interface FeedbackLog {
  id: string;
  agentId: string;
  agentRole: AgentRole;
  agentName: string;
  conversationId?: string;
  outputId?: string;
  workflowRunId?: string;
  messageContent: string;     // the assistant message that got feedback
  rating: FeedbackRating;
  comment: string;
  adminUid: string;
  createdAt: string;
}

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

// ── Label maps ───────────────────────────────────────────────────────────────
export const MEMORY_CATEGORY_LABELS: Record<MemoryCategory, string> = {
  brand_voice: "Brand Voice",
  audience: "Target Audience",
  events: "Events",
  platform_rules: "Platform Rules",
  content: "Content Strategy",
  business: "Business",
};

export const OUTPUT_TYPE_LABELS: Record<OutputType, string> = {
  caption: "Caption",
  email: "Email",
  strategy: "Strategy",
  copy: "Copy",
  task: "Task",
  prompt: "Prompt",
  plan: "Plan",
  other: "Other",
};

export const AGENT_ROLE_LABELS: Record<AgentRole, string> = {
  operator: "Executive Operator",
  content: "Content Agent",
  marketing: "Marketing Agent",
  events: "Events Agent",
  support: "Support Agent",
  strategy: "Strategy Agent",
  developer: "Developer Agent",
  operations: "Operations Agent",
};

export const AGENT_ROLE_COLORS: Record<AgentRole, string> = {
  operator: "bg-red-600",
  content: "bg-pink-600",
  marketing: "bg-orange-500",
  events: "bg-purple-600",
  support: "bg-blue-600",
  strategy: "bg-indigo-600",
  developer: "bg-emerald-600",
  operations: "bg-amber-500",
};

export const AGENT_ROLE_ICONS: Record<AgentRole, string> = {
  operator: "◎",
  content: "✏️",
  marketing: "📣",
  events: "🎟",
  support: "💬",
  strategy: "🎯",
  developer: "⚙️",
  operations: "📋",
};
