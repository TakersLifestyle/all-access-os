// Takers AI — Reflection & Self-Critique System
//
// Provides a quality assurance layer over agent outputs before they are
// finalized, saved, or shown to users. Each output is evaluated for:
//   - Overall quality score (0-10)
//   - Specific issues: weak reasoning, hallucination risk, formatting errors,
//     schema violations, off-topic content, missing fields
//   - Confidence score (0-100)
//   - Revision attempt (optional) if quality is below threshold
//
// The critic runs on claude-haiku (cheap + fast) to keep overhead minimal.
// A standard reflection adds ~500 input + ~400 output tokens (~$0.0001).

import Anthropic from "@anthropic-ai/sdk";
import type { AgentRole } from "./types";
import { MODEL_PRICING, roundCost } from "./cost";
import type { OutputSchema } from "./schemas";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Issue types ───────────────────────────────────────────────────────────────

export type ReflectionIssueType =
  | "weak_reasoning"
  | "hallucination_risk"
  | "formatting_error"
  | "schema_violation"
  | "factual_inconsistency"
  | "incomplete_response"
  | "off_topic"
  | "tone_mismatch"
  | "missing_required_field"
  | "overconfidence"
  | "contradiction"
  | "verbosity";

export type IssueSeverity = "low" | "medium" | "high" | "critical";

export interface ReflectionIssue {
  type: ReflectionIssueType;
  severity: IssueSeverity;
  description: string;
  location?: string;    // which section/sentence has the issue
  suggestion?: string;  // how to fix it
}

// ── Result types ──────────────────────────────────────────────────────────────

export interface ReflectionResult {
  approved: boolean;              // passes quality threshold
  confidence: number;             // 0-100: how confident the critic is in the output
  qualityScore: number;           // 0-10: overall output quality
  issues: ReflectionIssue[];
  suggestions: string[];          // top-level improvement suggestions
  hallucinationRisk: "none" | "low" | "medium" | "high";
  schemaCompliant: boolean | null;  // null = no schema provided
  revisedOutput: string | null;     // only if performRevision=true and revision was needed
  reasoning: string;               // critic's overall assessment
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface ReflectionOptions {
  schema?: OutputSchema;
  minQualityScore?: number;     // default 6 — below this, approved=false
  performRevision?: boolean;    // attempt to fix issues if quality is low
  agentRole?: AgentRole;
  originalPrompt?: string;
  brandContext?: string;        // brand guidelines for tone checking
  strictMode?: boolean;         // any medium+ issue = approved=false
}

// ── Critic prompt ─────────────────────────────────────────────────────────────

const CRITIC_SYSTEM = `You are a quality control critic for AI-generated content at ALL ACCESS Winnipeg.

Your job is to evaluate an AI agent's output for quality, accuracy, and completeness.
Be honest and specific. Do not be overly generous — catch real problems.

EVALUATION CRITERIA:
1. Reasoning quality: Is the logic sound? Are conclusions supported?
2. Factual grounding: Does anything sound invented or uncertain?
3. Formatting: Does the output match expected format (markdown, JSON, list, etc.)?
4. Completeness: Does it fully address the prompt?
5. Relevance: Is it focused on the actual request?
6. Tone: Is it appropriate for ALL ACCESS Winnipeg (community-first, inclusive, professional)?
7. Schema compliance: If a schema is provided, are all required fields present and correctly typed?

HALLUCINATION SIGNALS (increase risk score):
- Specific statistics without attribution ("87% of users...")
- Named individuals not mentioned in context
- Dates, prices, or quantities that seem invented
- Product features or capabilities not in the context
- Confident statements about things that can't be verified

OUTPUT FORMAT (strict JSON, no markdown):
{
  "qualityScore": 0-10,
  "confidence": 0-100,
  "hallucinationRisk": "none|low|medium|high",
  "reasoning": "one paragraph overall assessment",
  "issues": [
    {
      "type": "weak_reasoning|hallucination_risk|formatting_error|schema_violation|factual_inconsistency|incomplete_response|off_topic|tone_mismatch|missing_required_field|overconfidence|contradiction|verbosity",
      "severity": "low|medium|high|critical",
      "description": "what the problem is",
      "location": "optional: which sentence/section",
      "suggestion": "how to fix it"
    }
  ],
  "suggestions": ["top improvement suggestion 1", "..."]
}`;

// ── Main reflection function ──────────────────────────────────────────────────
export async function reflectOnOutput(
  output: string,
  options: ReflectionOptions = {}
): Promise<ReflectionResult> {
  const startedAt = Date.now();
  const minQuality = options.minQualityScore ?? 6;

  try {
    const userContent = buildCriticPrompt(output, options);

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 800,
      system: CRITIC_SYSTEM,
      messages: [{ role: "user", content: userContent }],
    });

    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const costUsd = roundCost(
      (inputTokens / 1_000_000) * MODEL_PRICING["claude-haiku-4-5"].inputPer1M +
      (outputTokens / 1_000_000) * MODEL_PRICING["claude-haiku-4-5"].outputPer1M
    );

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const parsed = parseCriticResponse(text);

    const approved = computeApproval(parsed, minQuality, options.strictMode);

    // Schema compliance check (deterministic, no Claude call)
    const schemaCompliant = options.schema
      ? checkSchemaCompliance(output, options.schema)
      : null;

    if (!schemaCompliant && options.schema) {
      parsed.issues.push({
        type: "schema_violation",
        severity: "high",
        description: "Output does not match expected JSON schema",
        suggestion: "Re-run with explicit JSON output instructions",
      });
    }

    let revisedOutput: string | null = null;

    // Attempt revision if requested and quality is below threshold
    if (options.performRevision && !approved && parsed.issues.length > 0) {
      revisedOutput = await attemptRevision(output, parsed.issues, parsed.suggestions, options);
    }

    return {
      approved: revisedOutput ? true : approved, // if revision succeeded, treat as approved
      confidence: parsed.confidence,
      qualityScore: parsed.qualityScore,
      issues: parsed.issues,
      suggestions: parsed.suggestions,
      hallucinationRisk: parsed.hallucinationRisk,
      schemaCompliant,
      revisedOutput,
      reasoning: parsed.reasoning,
      durationMs: Date.now() - startedAt,
      inputTokens,
      outputTokens,
      costUsd,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[reflection] critique failed:", msg);
    // Fail open — don't block output if reflection itself fails
    return buildPassthroughResult(output, startedAt, msg);
  }
}

// ── Approval logic ────────────────────────────────────────────────────────────
function computeApproval(
  parsed: ParsedCriticResponse,
  minQuality: number,
  strictMode?: boolean
): boolean {
  if (parsed.qualityScore < minQuality) return false;
  if (parsed.hallucinationRisk === "high") return false;

  const criticalIssues = parsed.issues.filter((i) => i.severity === "critical");
  if (criticalIssues.length > 0) return false;

  if (strictMode) {
    const mediumPlusIssues = parsed.issues.filter(
      (i) => i.severity === "medium" || i.severity === "high"
    );
    if (mediumPlusIssues.length > 0) return false;
  }

  return true;
}

// ── Critic prompt builder ─────────────────────────────────────────────────────
function buildCriticPrompt(output: string, options: ReflectionOptions): string {
  let prompt = "";

  if (options.originalPrompt) {
    prompt += `ORIGINAL PROMPT:\n${options.originalPrompt.slice(0, 800)}\n\n`;
  }

  if (options.agentRole) {
    prompt += `AGENT ROLE: ${options.agentRole}\n\n`;
  }

  if (options.schema) {
    const requiredFields = options.schema.fields.filter((f) => f.required).map((f) => f.key);
    prompt += `EXPECTED SCHEMA (${options.schema.label}):\nRequired fields: ${requiredFields.join(", ")}\n\n`;
  }

  if (options.brandContext) {
    prompt += `BRAND GUIDELINES:\n${options.brandContext.slice(0, 400)}\n\n`;
  }

  prompt += `OUTPUT TO EVALUATE:\n${output.slice(0, 3000)}`;

  if (output.length > 3000) {
    prompt += `\n[...truncated at 3000 chars, full length: ${output.length} chars]`;
  }

  return prompt;
}

// ── Schema compliance (deterministic) ────────────────────────────────────────
function checkSchemaCompliance(output: string, schema: OutputSchema): boolean {
  try {
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return false;
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const requiredFields = schema.fields.filter((f) => f.required).map((f) => f.key);
    return requiredFields.every((field) => {
      const parts = field.split(".");
      let obj: unknown = parsed;
      for (const part of parts) {
        if (typeof obj !== "object" || obj === null || !(part in (obj as Record<string, unknown>))) return false;
        obj = (obj as Record<string, unknown>)[part];
      }
      return obj !== undefined && obj !== null && obj !== "";
    });
  } catch {
    return false;
  }
}

// ── Revision attempt ──────────────────────────────────────────────────────────
async function attemptRevision(
  originalOutput: string,
  issues: ReflectionIssue[],
  suggestions: string[],
  options: ReflectionOptions
): Promise<string | null> {
  const highPriorityIssues = issues
    .filter((i) => i.severity === "high" || i.severity === "critical")
    .slice(0, 5);

  if (highPriorityIssues.length === 0 && suggestions.length === 0) return null;

  const issueList = highPriorityIssues
    .map((i) => `- [${i.severity}] ${i.type}: ${i.description}${i.suggestion ? ` → Fix: ${i.suggestion}` : ""}`)
    .join("\n");

  const revisionPrompt = `You are revising an AI-generated output to fix quality issues.

ORIGINAL OUTPUT:
${originalOutput.slice(0, 2000)}

ISSUES TO FIX:
${issueList}

${suggestions.length > 0 ? `SUGGESTIONS:\n${suggestions.slice(0, 3).map((s) => `- ${s}`).join("\n")}` : ""}

${options.originalPrompt ? `ORIGINAL TASK:\n${options.originalPrompt.slice(0, 400)}` : ""}

Produce a corrected version of the output. Fix the identified issues. Preserve what was good.
Return only the revised output — no commentary, no explanations.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1500,
      messages: [{ role: "user", content: revisionPrompt }],
    });
    const revised = response.content[0].type === "text" ? response.content[0].text.trim() : null;
    return revised || null;
  } catch (err) {
    console.warn("[reflection] revision failed:", err);
    return null;
  }
}

// ── Response parser ───────────────────────────────────────────────────────────
interface ParsedCriticResponse {
  qualityScore: number;
  confidence: number;
  hallucinationRisk: ReflectionResult["hallucinationRisk"];
  reasoning: string;
  issues: ReflectionIssue[];
  suggestions: string[];
}

function parseCriticResponse(text: string): ParsedCriticResponse {
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]) as Record<string, unknown>;
      return {
        qualityScore: typeof parsed.qualityScore === "number"
          ? Math.min(10, Math.max(0, parsed.qualityScore)) : 7,
        confidence: typeof parsed.confidence === "number"
          ? Math.min(100, Math.max(0, parsed.confidence)) : 70,
        hallucinationRisk: (["none", "low", "medium", "high"].includes(parsed.hallucinationRisk as string)
          ? parsed.hallucinationRisk : "low") as ReflectionResult["hallucinationRisk"],
        reasoning: (parsed.reasoning as string) ?? "No reasoning provided",
        issues: Array.isArray(parsed.issues)
          ? (parsed.issues as ReflectionIssue[]).slice(0, 10)
          : [],
        suggestions: Array.isArray(parsed.suggestions)
          ? (parsed.suggestions as string[]).slice(0, 5)
          : [],
      };
    } catch {/* fall through */}
  }

  // Fallback: assume reasonable quality if parsing fails
  return {
    qualityScore: 7,
    confidence: 60,
    hallucinationRisk: "low",
    reasoning: "Critic response could not be parsed — assuming acceptable quality",
    issues: [],
    suggestions: [],
  };
}

// ── Pass-through result (when reflection itself fails) ───────────────────────
function buildPassthroughResult(
  _output: string,
  startedAt: number,
  errorMsg: string
): ReflectionResult {
  return {
    approved: true,   // fail open — don't block output if critic is down
    confidence: 50,
    qualityScore: 7,
    issues: [{
      type: "incomplete_response",
      severity: "low",
      description: `Reflection service failed: ${errorMsg}`,
    }],
    suggestions: [],
    hallucinationRisk: "low",
    schemaCompliant: null,
    revisedOutput: null,
    reasoning: "Reflection unavailable — output passed without critique",
    durationMs: Date.now() - startedAt,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
  };
}

// ── Batch reflection (for pipelines) ─────────────────────────────────────────
export async function reflectBatch(
  outputs: Array<{ output: string; stepName: string; options?: ReflectionOptions }>
): Promise<Array<ReflectionResult & { stepName: string }>> {
  const results = await Promise.allSettled(
    outputs.map(async ({ output, stepName, options }) => {
      const result = await reflectOnOutput(output, options);
      return { ...result, stepName };
    })
  );

  return results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    return {
      ...buildPassthroughResult("", Date.now(), "batch reflection item failed"),
      stepName: outputs[i].stepName,
    };
  });
}

// ── Aggregate reflection score across a pipeline ─────────────────────────────
export function aggregateReflectionScore(results: ReflectionResult[]): {
  overallQuality: number;
  overallConfidence: number;
  totalIssues: number;
  criticalIssues: number;
  allApproved: boolean;
  lowestScore: number;
} {
  if (results.length === 0) return {
    overallQuality: 10, overallConfidence: 100, totalIssues: 0,
    criticalIssues: 0, allApproved: true, lowestScore: 10,
  };

  const avgQuality = results.reduce((s, r) => s + r.qualityScore, 0) / results.length;
  const avgConfidence = results.reduce((s, r) => s + r.confidence, 0) / results.length;
  const totalIssues = results.reduce((s, r) => s + r.issues.length, 0);
  const criticalIssues = results.reduce(
    (s, r) => s + r.issues.filter((i) => i.severity === "critical").length, 0
  );

  return {
    overallQuality: Math.round(avgQuality * 10) / 10,
    overallConfidence: Math.round(avgConfidence),
    totalIssues,
    criticalIssues,
    allApproved: results.every((r) => r.approved),
    lowestScore: Math.min(...results.map((r) => r.qualityScore)),
  };
}

// ── Write reflection to Firestore ─────────────────────────────────────────────
export function writeReflectionLog(
  db: FirebaseFirestore.Firestore,
  data: {
    result: ReflectionResult;
    agentId: string;
    agentRole: AgentRole;
    pipelineRunId?: string;
    stepIndex?: number;
    outputSnippet?: string;
  }
): void {
  db.collection("reflectionLogs")
    .doc()
    .set({
      ...data.result,
      agentId: data.agentId,
      agentRole: data.agentRole,
      pipelineRunId: data.pipelineRunId ?? null,
      stepIndex: data.stepIndex ?? null,
      outputSnippet: data.outputSnippet?.slice(0, 500) ?? null,
      createdAt: new Date().toISOString(),
    })
    .catch((err) => console.error("[reflection] log write failed:", err));
}
