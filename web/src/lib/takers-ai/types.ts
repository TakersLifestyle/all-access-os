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

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  description: string;
  systemPrompt: string;
  icon: string;
  color: string; // tailwind bg class e.g. "bg-red-600"
  model: AgentModel;
  maxTokens: number;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
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
  agentId: string; // "any" for global
  name: string;
  description: string;
  prompt: string; // with {{variable}} placeholders
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
  conversationId?: string;
  title: string;
  content: string;
  type: OutputType;
  tags: string[];
  createdAt: string;
}

export interface Conversation {
  id: string;
  agentId: string;
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
