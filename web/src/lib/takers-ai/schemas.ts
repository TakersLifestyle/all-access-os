// Takers AI — Structured Output Schemas
// Defines JSON contracts for every agent output type.
// The AI is instructed to respond in the schema's format via promptSuffix.
// validateOutput() runs before any output is saved or triggers an action.
//
// Pattern:
//   1. Call getSchemaForRole(agentRole) to find the matching schema
//   2. Append schema.promptSuffix to the system prompt
//   3. After generation, call parseStructuredOutput(text) to extract JSON
//   4. Call validateOutput(schema, parsed) to confirm shape before saving

import type { AgentRole } from "./types";

// ── Field types ───────────────────────────────────────────────────────────────
export type FieldType =
  | "string"
  | "number"
  | "boolean"
  | "string[]"
  | "object"
  | "object[]";

export interface SchemaField {
  key: string;
  type: FieldType;
  required: boolean;
  description: string;
  maxLength?: number;
  minLength?: number;
  min?: number;
  max?: number;
  enum?: string[];
  fields?: SchemaField[];  // for nested objects
}

export interface OutputSchema {
  type: SchemaType;
  version: string;
  label: string;
  description: string;
  agentRoles: AgentRole[];
  fields: SchemaField[];
  // Appended to agent system prompt to request structured output.
  // Should end with the JSON schema outline.
  promptSuffix: string;
}

export type SchemaType =
  | "content_output"
  | "event_launch"
  | "support_reply"
  | "marketing_campaign"
  | "strategy_brief"
  | "weekly_plan";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ── Schema definitions ────────────────────────────────────────────────────────

const CONTENT_OUTPUT_SCHEMA: OutputSchema = {
  type: "content_output",
  version: "1.0",
  label: "Content Output",
  description: "Structured output for content creation: captions, scripts, copy",
  agentRoles: ["content"],
  fields: [
    { key: "headline", type: "string", required: true, description: "Primary headline or hook", maxLength: 150 },
    { key: "body", type: "string", required: true, description: "Main content body", maxLength: 4000 },
    { key: "variants", type: "string[]", required: false, description: "2-3 alternative versions" },
    { key: "hashtags", type: "string[]", required: false, description: "Recommended hashtags (no #)" },
    { key: "cta", type: "string", required: false, description: "Call to action text", maxLength: 100 },
    { key: "platform", type: "string", required: true, description: "Target platform", enum: ["instagram", "tiktok", "youtube", "email", "website", "other"] },
    { key: "tone", type: "string", required: true, description: "Tone used", enum: ["community", "hype", "educational", "emotional", "urgent", "professional"] },
    { key: "wordCount", type: "number", required: false, description: "Approximate word count" },
  ],
  promptSuffix: `\n\nRespond with valid JSON matching this schema (no markdown code fences):
{
  "headline": "string",
  "body": "string",
  "variants": ["string", "string"],
  "hashtags": ["string"],
  "cta": "string",
  "platform": "instagram|tiktok|youtube|email|website|other",
  "tone": "community|hype|educational|emotional|urgent|professional",
  "wordCount": number
}`,
};

const EVENT_LAUNCH_SCHEMA: OutputSchema = {
  type: "event_launch",
  version: "1.0",
  label: "Event Launch",
  description: "Structured output for event planning, logistics, and copy",
  agentRoles: ["events"],
  fields: [
    { key: "eventName", type: "string", required: true, description: "Event name", maxLength: 100 },
    { key: "tagline", type: "string", required: true, description: "Event tagline/subheading", maxLength: 120 },
    { key: "description", type: "string", required: true, description: "Full event description", maxLength: 1000 },
    { key: "keyAttractions", type: "string[]", required: true, description: "3-5 key selling points" },
    {
      key: "logistics",
      type: "object",
      required: true,
      description: "Logistics object",
      fields: [
        { key: "venue", type: "string", required: true, description: "Venue name/address" },
        { key: "date", type: "string", required: true, description: "Event date ISO or formatted" },
        { key: "doors", type: "string", required: false, description: "Doors open time" },
        { key: "capacity", type: "number", required: false, description: "Max capacity" },
        { key: "memberPrice", type: "number", required: true, description: "Member ticket price (CAD)" },
        { key: "generalPrice", type: "number", required: true, description: "General ticket price (CAD)" },
      ],
    },
    { key: "checklist", type: "string[]", required: false, description: "Pre-event checklist items" },
    { key: "safetyNotes", type: "string[]", required: false, description: "Safety and inclusivity notes" },
    { key: "promoCopy", type: "string", required: false, description: "Short social promo copy (max 280 chars)", maxLength: 280 },
  ],
  promptSuffix: `\n\nRespond with valid JSON matching this schema:
{
  "eventName": "string",
  "tagline": "string",
  "description": "string",
  "keyAttractions": ["string"],
  "logistics": { "venue": "string", "date": "string", "doors": "string", "capacity": number, "memberPrice": number, "generalPrice": number },
  "checklist": ["string"],
  "safetyNotes": ["string"],
  "promoCopy": "string"
}`,
};

const SUPPORT_REPLY_SCHEMA: OutputSchema = {
  type: "support_reply",
  version: "1.0",
  label: "Support Reply",
  description: "Structured member support response",
  agentRoles: ["support"],
  fields: [
    { key: "issueCategory", type: "string", required: true, description: "Issue type", enum: ["billing", "ticket", "access", "community", "technical", "refund", "other"] },
    { key: "priority", type: "string", required: true, description: "Response priority", enum: ["low", "medium", "high", "critical"] },
    { key: "greeting", type: "string", required: true, description: "Personalized greeting line", maxLength: 100 },
    { key: "body", type: "string", required: true, description: "Main response body", maxLength: 1500 },
    { key: "resolution", type: "string", required: true, description: "Specific resolution or next steps", maxLength: 500 },
    { key: "closing", type: "string", required: true, description: "Warm closing line", maxLength: 100 },
    { key: "escalate", type: "boolean", required: true, description: "Whether to escalate to human review" },
    { key: "escalateReason", type: "string", required: false, description: "Why escalation is needed", maxLength: 200 },
    { key: "internalNote", type: "string", required: false, description: "Admin-only internal note (not sent to member)", maxLength: 500 },
  ],
  promptSuffix: `\n\nRespond with valid JSON matching this schema:
{
  "issueCategory": "billing|ticket|access|community|technical|refund|other",
  "priority": "low|medium|high|critical",
  "greeting": "string",
  "body": "string",
  "resolution": "string",
  "closing": "string",
  "escalate": boolean,
  "escalateReason": "string or null",
  "internalNote": "string or null"
}`,
};

const MARKETING_CAMPAIGN_SCHEMA: OutputSchema = {
  type: "marketing_campaign",
  version: "1.0",
  label: "Marketing Campaign",
  description: "Structured marketing campaign strategy and assets",
  agentRoles: ["marketing"],
  fields: [
    { key: "campaignName", type: "string", required: true, description: "Campaign name", maxLength: 80 },
    { key: "goal", type: "string", required: true, description: "Primary campaign goal", maxLength: 200 },
    { key: "targetAudience", type: "string", required: true, description: "Target audience description", maxLength: 300 },
    { key: "duration", type: "string", required: true, description: "Campaign duration (e.g. '2 weeks')", maxLength: 50 },
    {
      key: "phases",
      type: "object[]",
      required: true,
      description: "Campaign phases",
      fields: [
        { key: "name", type: "string", required: true, description: "Phase name (e.g. Awareness, Launch, Sustain)" },
        { key: "duration", type: "string", required: true, description: "Phase duration" },
        { key: "channels", type: "string[]", required: true, description: "Channels active in this phase" },
        { key: "actions", type: "string[]", required: true, description: "Key actions in this phase" },
      ],
    },
    { key: "keyMessages", type: "string[]", required: true, description: "3-5 core messages" },
    { key: "contentPillars", type: "string[]", required: true, description: "Content themes" },
    { key: "kpis", type: "string[]", required: true, description: "Key performance indicators to track" },
    { key: "budgetNotes", type: "string", required: false, description: "Budget or resource notes", maxLength: 300 },
    { key: "riskFlags", type: "string[]", required: false, description: "Potential risks or things to watch" },
  ],
  promptSuffix: `\n\nRespond with valid JSON matching this schema:
{
  "campaignName": "string",
  "goal": "string",
  "targetAudience": "string",
  "duration": "string",
  "phases": [{ "name": "string", "duration": "string", "channels": ["string"], "actions": ["string"] }],
  "keyMessages": ["string"],
  "contentPillars": ["string"],
  "kpis": ["string"],
  "budgetNotes": "string or null",
  "riskFlags": ["string"]
}`,
};

const STRATEGY_BRIEF_SCHEMA: OutputSchema = {
  type: "strategy_brief",
  version: "1.0",
  label: "Strategy Brief",
  description: "Structured strategic analysis, plans, and recommendations",
  agentRoles: ["strategy"],
  fields: [
    { key: "title", type: "string", required: true, description: "Strategy title", maxLength: 100 },
    { key: "situation", type: "string", required: true, description: "Current situation summary", maxLength: 500 },
    { key: "objective", type: "string", required: true, description: "Primary objective", maxLength: 200 },
    { key: "opportunities", type: "string[]", required: true, description: "Top opportunities identified" },
    { key: "risks", type: "string[]", required: true, description: "Key risks and blockers" },
    {
      key: "recommendations",
      type: "object[]",
      required: true,
      description: "Prioritized recommendations",
      fields: [
        { key: "action", type: "string", required: true, description: "Specific action item" },
        { key: "priority", type: "string", required: true, description: "Priority level", enum: ["low", "medium", "high"] },
        { key: "timeline", type: "string", required: true, description: "When to execute" },
        { key: "expectedImpact", type: "string", required: true, description: "Expected outcome" },
      ],
    },
    { key: "successMetrics", type: "string[]", required: true, description: "How to measure success" },
    { key: "nextSteps", type: "string[]", required: true, description: "Immediate next 3 actions" },
  ],
  promptSuffix: `\n\nRespond with valid JSON matching this schema:
{
  "title": "string",
  "situation": "string",
  "objective": "string",
  "opportunities": ["string"],
  "risks": ["string"],
  "recommendations": [{ "action": "string", "priority": "low|medium|high", "timeline": "string", "expectedImpact": "string" }],
  "successMetrics": ["string"],
  "nextSteps": ["string"]
}`,
};

const WEEKLY_PLAN_SCHEMA: OutputSchema = {
  type: "weekly_plan",
  version: "1.0",
  label: "Weekly Plan",
  description: "Structured weekly operational plan",
  agentRoles: ["operations"],
  fields: [
    { key: "weekOf", type: "string", required: true, description: "Week start date (ISO or readable)", maxLength: 30 },
    { key: "theme", type: "string", required: true, description: "Weekly focus theme", maxLength: 100 },
    { key: "topPriorities", type: "string[]", required: true, description: "Top 5 priorities in order" },
    {
      key: "dailyFocus",
      type: "object[]",
      required: true,
      description: "Daily focus blocks",
      fields: [
        { key: "day", type: "string", required: true, description: "Day of week" },
        { key: "focus", type: "string", required: true, description: "Primary focus for this day" },
        { key: "tasks", type: "string[]", required: true, description: "3-5 tasks" },
      ],
    },
    { key: "contentToProduce", type: "string[]", required: false, description: "Content pieces to create this week" },
    { key: "meetingsOrEvents", type: "string[]", required: false, description: "Scheduled commitments" },
    { key: "sayNoTo", type: "string[]", required: false, description: "Things to decline or defer this week" },
    { key: "weeklyGoal", type: "string", required: true, description: "The single most important outcome for this week", maxLength: 200 },
  ],
  promptSuffix: `\n\nRespond with valid JSON matching this schema:
{
  "weekOf": "string",
  "theme": "string",
  "topPriorities": ["string"],
  "dailyFocus": [{ "day": "string", "focus": "string", "tasks": ["string"] }],
  "contentToProduce": ["string"],
  "meetingsOrEvents": ["string"],
  "sayNoTo": ["string"],
  "weeklyGoal": "string"
}`,
};

// ── Schema registry ───────────────────────────────────────────────────────────
const SCHEMA_REGISTRY: Record<SchemaType, OutputSchema> = {
  content_output:     CONTENT_OUTPUT_SCHEMA,
  event_launch:       EVENT_LAUNCH_SCHEMA,
  support_reply:      SUPPORT_REPLY_SCHEMA,
  marketing_campaign: MARKETING_CAMPAIGN_SCHEMA,
  strategy_brief:     STRATEGY_BRIEF_SCHEMA,
  weekly_plan:        WEEKLY_PLAN_SCHEMA,
};

export function getAllSchemas(): OutputSchema[] {
  return Object.values(SCHEMA_REGISTRY);
}

export function getSchema(type: SchemaType): OutputSchema | null {
  return SCHEMA_REGISTRY[type] ?? null;
}

export function getSchemaForRole(role: AgentRole): OutputSchema | null {
  return Object.values(SCHEMA_REGISTRY).find((s) => s.agentRoles.includes(role)) ?? null;
}

// ── JSON extractor ────────────────────────────────────────────────────────────
// Extracts the first JSON object from an AI response that may contain
// prose, code fences, or mixed content.
export function parseStructuredOutput(text: string): Record<string, unknown> | null {
  try {
    // Try direct parse first (AI responded with raw JSON)
    return JSON.parse(text.trim()) as Record<string, unknown>;
  } catch {
    // Strip code fences
    const stripped = text.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
    try {
      return JSON.parse(stripped) as Record<string, unknown>;
    } catch {
      // Find JSON object by braces
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start !== -1 && end > start) {
        try {
          return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
        } catch {
          return null;
        }
      }
      return null;
    }
  }
}

// ── Validator ─────────────────────────────────────────────────────────────────
function validateField(
  field: SchemaField,
  value: unknown,
  path: string,
  errors: string[],
  warnings: string[]
): void {
  if (value === undefined || value === null) {
    if (field.required) {
      errors.push(`${path}: required field is missing`);
    }
    return;
  }

  switch (field.type) {
    case "string": {
      if (typeof value !== "string") {
        errors.push(`${path}: expected string, got ${typeof value}`);
        return;
      }
      if (field.maxLength && value.length > field.maxLength) {
        warnings.push(`${path}: string length ${value.length} exceeds recommended max ${field.maxLength}`);
      }
      if (field.minLength && value.length < field.minLength) {
        errors.push(`${path}: string length ${value.length} is below minimum ${field.minLength}`);
      }
      if (field.enum && !field.enum.includes(value)) {
        errors.push(`${path}: "${value}" is not one of [${field.enum.join(", ")}]`);
      }
      break;
    }
    case "number": {
      if (typeof value !== "number") {
        errors.push(`${path}: expected number, got ${typeof value}`);
        return;
      }
      if (field.min !== undefined && value < field.min) {
        errors.push(`${path}: ${value} is below minimum ${field.min}`);
      }
      if (field.max !== undefined && value > field.max) {
        errors.push(`${path}: ${value} exceeds maximum ${field.max}`);
      }
      break;
    }
    case "boolean": {
      if (typeof value !== "boolean") {
        errors.push(`${path}: expected boolean, got ${typeof value}`);
      }
      break;
    }
    case "string[]": {
      if (!Array.isArray(value)) {
        errors.push(`${path}: expected array, got ${typeof value}`);
        return;
      }
      if (!value.every((v) => typeof v === "string")) {
        errors.push(`${path}: expected string[], found non-string elements`);
      }
      break;
    }
    case "object": {
      if (typeof value !== "object" || Array.isArray(value)) {
        errors.push(`${path}: expected object, got ${Array.isArray(value) ? "array" : typeof value}`);
        return;
      }
      if (field.fields) {
        for (const subField of field.fields) {
          validateField(
            subField,
            (value as Record<string, unknown>)[subField.key],
            `${path}.${subField.key}`,
            errors,
            warnings
          );
        }
      }
      break;
    }
    case "object[]": {
      if (!Array.isArray(value)) {
        errors.push(`${path}: expected array of objects, got ${typeof value}`);
        return;
      }
      if (field.fields) {
        value.forEach((item, i) => {
          if (typeof item !== "object" || item === null) {
            errors.push(`${path}[${i}]: expected object`);
            return;
          }
          for (const subField of field.fields!) {
            validateField(
              subField,
              (item as Record<string, unknown>)[subField.key],
              `${path}[${i}].${subField.key}`,
              errors,
              warnings
            );
          }
        });
      }
      break;
    }
  }
}

export function validateOutput(
  schema: OutputSchema,
  data: Record<string, unknown>
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const field of schema.fields) {
    validateField(field, data[field.key], field.key, errors, warnings);
  }

  // Check for extra keys (warning only)
  const knownKeys = new Set(schema.fields.map((f) => f.key));
  for (const key of Object.keys(data)) {
    if (!knownKeys.has(key)) {
      warnings.push(`Unknown key "${key}" not in schema`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── Schema summary for prompts ────────────────────────────────────────────────
// Returns a compact JSON template string showing the expected shape.
export function schemaToTemplate(schema: OutputSchema): string {
  function fieldToTemplate(field: SchemaField): unknown {
    switch (field.type) {
      case "string":   return field.enum ? field.enum.join("|") : "string";
      case "number":   return "number";
      case "boolean":  return "boolean";
      case "string[]": return ["string"];
      case "object":   return field.fields
        ? Object.fromEntries(field.fields.map((f) => [f.key, fieldToTemplate(f)]))
        : {};
      case "object[]": return field.fields
        ? [Object.fromEntries(field.fields.map((f) => [f.key, fieldToTemplate(f)]))]
        : [{}];
      default: return "unknown";
    }
  }
  const template = Object.fromEntries(
    schema.fields.map((f) => [f.key, fieldToTemplate(f)])
  );
  return JSON.stringify(template, null, 2);
}
