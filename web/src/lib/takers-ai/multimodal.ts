// Takers AI — Multimodal Intelligence Layer
//
// This module is the intelligence layer on top of raw file uploads.
// It does NOT call Claude directly — all Claude API calls for content
// extraction happen in attachments.ts (via ContentBlockParam[] passed
// to the main stream). This module provides:
//
//   1. WORKFLOW INFERENCE    — deterministic hints from file names + MIME types
//   2. SYSTEM PROMPT CONTEXT — injected before every multimodal request so
//                              agents know exactly what files are attached and
//                              how to analyze them
//   3. ROUTING AUGMENTATION  — adds attachment metadata to the routing classifier
//                              message so routing is attachment-aware
//   4. PLANNER CONTEXT       — tells the planner what workflows the attachments imply
//   5. REFLECTION ADDENDUM   — extra criteria for the critic when images/docs attached
//   6. COST ESTIMATION       — attachment processing cost for simulation engine
//   7. ANALYTICS LOGGING     — per-request multimodal usage tracking
//
// Future-ready stubs:
//   - Video/audio upload pipeline
//   - Screen recording analysis
//   - Canva asset import
//   - Design version diff
//   - Visual workflow analysis

import type { AttachmentMeta, AttachmentFileType } from "./attachments";
import { formatFileSize } from "./attachments";

// ── Workflow hint system ───────────────────────────────────────────────────────

export type AttachmentWorkflowHint =
  // Visual workflows
  | "visual_debug"          // screenshot of a bug, error, or broken UI state
  | "dashboard_analysis"    // screenshot of metrics, charts, analytics
  | "design_review"         // screenshot of a design, mockup, wireframe
  | "photo_reference"       // product/venue/event photo for context
  // Document workflows
  | "document_summary"      // PDF or long doc — needs summarization
  | "contract_review"       // legal/contract documents
  | "data_analysis"         // CSV/spreadsheet — needs data interpretation
  | "code_review"           // code file, markdown, technical config
  | "content_review"        // text content for editing/feedback
  // Mixed / general
  | "multi_file_workflow"   // 3+ files suggesting a batch operation
  | "comparison_workflow"   // 2 similar files suggesting a diff/compare task
  | "general_visual"        // image without specific hint
  | "general_document";     // document without specific hint

// Descriptions for use in system prompts and planner context
const HINT_DESCRIPTIONS: Record<AttachmentWorkflowHint, string> = {
  visual_debug:
    "Screenshot suggests a debugging or troubleshooting workflow — look for error messages, broken states, console output, or unexpected UI behavior",
  dashboard_analysis:
    "Screenshot of a dashboard or analytics — identify metrics, trends, anomalies, and actionable insights",
  design_review:
    "Design file or screenshot — evaluate layout, visual hierarchy, typography, color usage, and user experience",
  photo_reference:
    "Photo reference — use for context about a venue, product, event, or visual concept",
  document_summary:
    "Document attached — extract key points, summarize, and answer questions about the content",
  contract_review:
    "Legal or contractual document — identify key clauses, obligations, dates, and terms",
  data_analysis:
    "Data file (CSV/spreadsheet) — analyze patterns, summarize columns, identify outliers and trends",
  code_review:
    "Code or technical file — review structure, identify issues, suggest improvements",
  content_review:
    "Text content for review — edit, improve, give feedback on the writing",
  multi_file_workflow:
    "Multiple files suggest a batch processing, compilation, or multi-source analysis workflow",
  comparison_workflow:
    "Two similar files suggest a comparison, diff, or before/after analysis",
  general_visual:
    "Image attached — describe visually and analyze what's relevant to the user's request",
  general_document:
    "Document attached — read and reference the content in the response",
};

// Per-file processing instructions for the system prompt
const FILE_PROCESSING_INSTRUCTIONS: Record<AttachmentFileType, string> = {
  image: [
    "Analyze this image carefully.",
    "Describe what you see with specificity — elements, text, colors, layout, states.",
    "If it's a screenshot, identify any errors, warnings, broken states, or unexpected behavior.",
    "If it's a design, evaluate the visual composition and UX.",
    "Reference specific visual details in your response.",
    "Do NOT say 'I cannot see the image' — you have direct vision access.",
  ].join(" "),

  pdf: [
    "This PDF document has been provided for your review.",
    "Read the content and extract the most relevant information.",
    "Summarize key points and reference specific sections when appropriate.",
    "Answer questions about it accurately based on what's actually written.",
  ].join(" "),

  text: [
    "This text file has been provided as context.",
    "Read the full content and reference relevant parts in your response.",
    "For CSV/data files: analyze the data, identify patterns and key values.",
    "For markdown/docs: treat as reference material.",
  ].join(" "),

  document: [
    "A document has been attached.",
    "Acknowledge it and explain you can help analyze it.",
    "Ask the user what specific aspects they want help with.",
  ].join(" "),
};

// Emoji icons for file types in system context
const FILE_TYPE_EMOJI: Record<AttachmentFileType, string> = {
  image:    "🖼️",
  pdf:      "📄",
  text:     "📋",
  document: "📝",
};

// ── 1. WORKFLOW INFERENCE ─────────────────────────────────────────────────────

/**
 * Deterministically infers workflow hints from attachment metadata.
 * Uses filename patterns, MIME types, and file counts.
 * No API calls — pure heuristic.
 */
export function inferWorkflowHints(attachments: AttachmentMeta[]): AttachmentWorkflowHint[] {
  if (attachments.length === 0) return [];

  const hints = new Set<AttachmentWorkflowHint>();

  // Count-based hints
  if (attachments.length >= 3) hints.add("multi_file_workflow");
  if (attachments.length === 2) {
    const sameType = attachments[0].type === attachments[1].type;
    if (sameType) hints.add("comparison_workflow");
  }

  for (const att of attachments) {
    const name = att.name.toLowerCase();
    const mime = att.mimeType.toLowerCase();

    // ── Image classification ───────────────────────────────────────────────
    if (att.type === "image") {
      const isScreenshot =
        name.includes("screenshot") ||
        name.includes("screen") ||
        name.includes("capture") ||
        name.includes("snap") ||
        name.startsWith("screen-") ||
        /^screenshot[\s_-]?\d/.test(name);

      const isError =
        name.includes("error") ||
        name.includes("bug") ||
        name.includes("issue") ||
        name.includes("broken") ||
        name.includes("failed") ||
        name.includes("problem");

      const isDashboard =
        name.includes("dashboard") ||
        name.includes("metric") ||
        name.includes("analytics") ||
        name.includes("chart") ||
        name.includes("graph") ||
        name.includes("report") ||
        name.includes("stats");

      const isDesign =
        name.includes("design") ||
        name.includes("mockup") ||
        name.includes("wireframe") ||
        name.includes("figma") ||
        name.includes("ui") ||
        name.includes("ux") ||
        name.includes("prototype") ||
        name.includes("layout");

      const isPhoto =
        name.startsWith("img_") ||
        name.startsWith("dsc") ||
        name.startsWith("photo") ||
        mime === "image/jpeg";

      if (isScreenshot || isError) {
        hints.add("visual_debug");
      } else if (isDashboard) {
        hints.add("dashboard_analysis");
      } else if (isDesign) {
        hints.add("design_review");
      } else if (isPhoto) {
        hints.add("photo_reference");
      } else {
        hints.add("general_visual");
      }
    }

    // ── Document classification ────────────────────────────────────────────
    if (att.type === "pdf") {
      const isContract =
        name.includes("contract") ||
        name.includes("agreement") ||
        name.includes("terms") ||
        name.includes("legal") ||
        name.includes("nda") ||
        name.includes("msa");
      hints.add(isContract ? "contract_review" : "document_summary");
    }

    if (att.type === "text") {
      const isCsv = mime === "text/csv" || name.endsWith(".csv");
      const isCode =
        name.endsWith(".md") ||
        name.endsWith(".json") ||
        name.endsWith(".yaml") ||
        name.endsWith(".yml") ||
        name.endsWith(".ts") ||
        name.endsWith(".js") ||
        name.endsWith(".py");
      const isContent =
        name.endsWith(".txt") &&
        !isCsv &&
        !isCode;

      if (isCsv) {
        hints.add("data_analysis");
      } else if (isCode) {
        hints.add("code_review");
      } else if (isContent) {
        hints.add("content_review");
      } else {
        hints.add("general_document");
      }
    }

    if (att.type === "document") {
      const isCode =
        name.endsWith(".docx") &&
        (name.includes("code") || name.includes("spec") || name.includes("tech"));
      hints.add(isCode ? "code_review" : "document_summary");
    }
  }

  // Remove redundant "general" hints when specific ones exist
  if (hints.has("visual_debug") || hints.has("dashboard_analysis") || hints.has("design_review") || hints.has("photo_reference")) {
    hints.delete("general_visual");
  }
  if (hints.has("document_summary") || hints.has("contract_review") || hints.has("data_analysis") || hints.has("code_review") || hints.has("content_review")) {
    hints.delete("general_document");
  }

  return Array.from(hints);
}

// ── 2. ROUTING AUGMENTATION ───────────────────────────────────────────────────

/**
 * Returns a short text note to append to the routing classifier's user message.
 * Helps the classifier route attachment-heavy requests to the right agent.
 *
 * Example output:
 *   "\n\n[Attachments: screenshot.png (Image, 850 KB), report.pdf (PDF, 2.1 MB)]"
 */
export function buildAttachmentContextNote(attachments: AttachmentMeta[]): string {
  if (attachments.length === 0) return "";

  const items = attachments.map(
    (a) => `${a.name} (${capitalizeFirst(a.type)}, ${formatFileSize(a.size)})`
  );

  return `\n\n[Attachments: ${items.join(", ")}]`;
}

// ── 3. SYSTEM PROMPT CONTEXT ──────────────────────────────────────────────────

/**
 * Builds the MULTIMODAL CONTEXT block injected into the system prompt.
 * Tells the agent exactly what files are attached, what to do with each,
 * and what workflow context was inferred.
 *
 * This ensures agents:
 *   - Never say "I can't see the image" when vision blocks are present
 *   - Know the intended analysis depth for each file type
 *   - Understand the user's workflow intent from file naming patterns
 */
export function buildMultimodalSystemContext(
  attachments: AttachmentMeta[],
  hints?: AttachmentWorkflowHint[]
): string {
  if (attachments.length === 0) return "";

  const resolvedHints = hints ?? inferWorkflowHints(attachments);
  const lines: string[] = [];

  lines.push("---");
  lines.push("");
  lines.push("## ATTACHED FILES");
  lines.push(
    `The user has attached ${attachments.length} file${attachments.length > 1 ? "s" : ""} ` +
    `to this message. You have direct access to all of them.`
  );
  lines.push("");

  for (const att of attachments) {
    const icon = FILE_TYPE_EMOJI[att.type];
    lines.push(`${icon} **${att.name}** — ${capitalizeFirst(att.type)}, ${formatFileSize(att.size)}`);
    lines.push(`   ${FILE_PROCESSING_INSTRUCTIONS[att.type]}`);
    lines.push("");
  }

  // Workflow hints section
  const actionableHints = resolvedHints.filter(
    (h) => h !== "general_visual" && h !== "general_document" && h !== "multi_file_workflow"
  );
  if (actionableHints.length > 0) {
    lines.push("**Inferred workflow context:**");
    for (const hint of actionableHints) {
      lines.push(`- ${HINT_DESCRIPTIONS[hint]}`);
    }
    lines.push("");
  }

  lines.push(
    "**Critical instruction:** You have direct vision and document access to all attached files. " +
    "Never say you cannot see or read them. Always analyze them and reference specific details " +
    "(elements, values, text, errors) in your response."
  );

  return "\n\n" + lines.join("\n");
}

// ── 4. PLANNER CONTEXT ────────────────────────────────────────────────────────

/**
 * Returns extra context for the planning engine describing what files are
 * attached and what multi-step workflows they imply.
 *
 * The planner uses this to:
 *   - Add appropriate analysis/extraction steps
 *   - Select the right agent roles
 *   - Flag visual or document-heavy workflows
 */
export function buildPlannerAttachmentContext(
  attachments: AttachmentMeta[],
  hints?: AttachmentWorkflowHint[]
): string {
  if (attachments.length === 0) return "";

  const resolvedHints = hints ?? inferWorkflowHints(attachments);

  const typeCounts = attachments.reduce<Record<string, number>>((acc, a) => {
    acc[a.type] = (acc[a.type] ?? 0) + 1;
    return acc;
  }, {});

  const typeDesc = Object.entries(typeCounts)
    .map(([t, n]) => `${n} ${t}${n > 1 ? "s" : ""}`)
    .join(", ");

  const lines: string[] = [
    "",
    `ATTACHED FILES: ${typeDesc} (${formatFileSize(attachments.reduce((s, a) => s + a.size, 0))} total)`,
  ];

  if (resolvedHints.length > 0) {
    lines.push(`WORKFLOW HINTS: ${resolvedHints.join(", ")}`);
  }

  // Specific planner instructions per hint
  const plannerNotes: string[] = [];

  if (resolvedHints.includes("visual_debug")) {
    plannerNotes.push(
      "Screenshot(s) attached — plan should include steps for visual analysis, " +
      "error identification, and actionable fix recommendations."
    );
  }
  if (resolvedHints.includes("document_summary") || resolvedHints.includes("contract_review")) {
    plannerNotes.push(
      "Document(s) attached — plan should include a summarization or extraction step."
    );
  }
  if (resolvedHints.includes("data_analysis")) {
    plannerNotes.push(
      "Data file(s) attached — plan should include data analysis, pattern detection, " +
      "and insight generation steps."
    );
  }
  if (resolvedHints.includes("design_review")) {
    plannerNotes.push(
      "Design file(s) attached — plan should include visual critique, UX analysis, " +
      "and improvement recommendations."
    );
  }
  if (resolvedHints.includes("comparison_workflow")) {
    plannerNotes.push(
      "Two similar files attached — consider adding a comparison or diff step."
    );
  }

  if (plannerNotes.length > 0) {
    lines.push("PLANNER NOTES:");
    for (const note of plannerNotes) {
      lines.push(`  - ${note}`);
    }
  }

  return lines.join("\n");
}

// ── 5. REFLECTION ADDENDUM ────────────────────────────────────────────────────

/**
 * Extra evaluation criteria for the reflection critic when attachments are present.
 * Appended to the critic prompt to improve multimodal output quality scoring.
 */
export function buildMultimodalReflectionAddendum(
  attachments: AttachmentMeta[]
): string {
  if (attachments.length === 0) return "";

  const criteria: string[] = [];

  const hasImages = attachments.some((a) => a.type === "image");
  const hasPdfs = attachments.some((a) => a.type === "pdf");
  const hasText = attachments.some((a) => a.type === "text");
  const hasData = attachments.some(
    (a) => a.type === "text" && (a.mimeType === "text/csv" || a.name.endsWith(".csv"))
  );

  if (hasImages) {
    criteria.push(
      "MULTIMODAL CHECK: Does the response reference specific visual elements from the attached image(s)? " +
      "Generic responses that don't mention what's actually visible should score lower on quality."
    );
    criteria.push(
      "HALLUCINATION CHECK: Does the response describe elements that could plausibly be in the attached image, " +
      "or does it invent details? Flag any invented visual descriptions."
    );
  }

  if (hasPdfs) {
    criteria.push(
      "DOCUMENT CHECK: Does the response reference specific content from the attached PDF(s)? " +
      "Responses should cite or paraphrase actual document sections."
    );
  }

  if (hasText || hasData) {
    criteria.push(
      "TEXT CONTENT CHECK: Does the response accurately reflect the content from the attached text/data file(s)? " +
      "For CSV/data files, check that any numbers or statistics cited actually exist in the data."
    );
  }

  if (criteria.length === 0) return "";

  return "\n\nMULTIMODAL EVALUATION CRITERIA:\n" + criteria.map((c) => `- ${c}`).join("\n");
}

// ── 6. COST ESTIMATION ────────────────────────────────────────────────────────

export interface AttachmentCostEstimate {
  attachmentCount: number;
  totalSizeBytes: number;
  estimatedInputTokens: number;
  estimatedCostUsd: number;
  breakdown: Array<{
    name: string;
    type: AttachmentFileType;
    sizeBytes: number;
    estimatedTokens: number;
    processingMethod: "vision_block" | "document_block" | "text_injection" | "description_note";
  }>;
  // Future fields for extended processing
  ocrEstimatedTokens: number;       // 0 until OCR implemented
  analysisEstimatedTokens: number;  // pre-analysis pass cost (0 = not used)
}

// Token estimation constants (empirical)
const IMAGE_TOKENS_PER_MB      = 1_200;  // base64 vision overhead
const PDF_TOKENS_PER_2KB       = 500;    // ~1 page = 2KB = 500 tokens
const TEXT_TOKENS_PER_1KB      = 250;
const DESCRIPTION_NOTE_TOKENS  = 60;
const MAX_TOKENS_PER_ATTACHMENT = 30_000;

// Haiku pricing per 1M tokens
const HAIKU_INPUT_PER_1M = 0.80;

export function estimateAttachmentCost(
  attachments: AttachmentMeta[],
  inputCostPer1M = HAIKU_INPUT_PER_1M
): AttachmentCostEstimate {
  const breakdown = attachments.map((att) => {
    let estimatedTokens: number;
    let processingMethod: AttachmentCostEstimate["breakdown"][number]["processingMethod"];

    if (att.type === "image") {
      const sizeMb = att.size / 1_048_576;
      estimatedTokens = Math.round(sizeMb * IMAGE_TOKENS_PER_MB);
      processingMethod = "vision_block";
    } else if (att.type === "pdf") {
      const estimatedPages = Math.max(1, Math.round(att.size / 2_048));
      estimatedTokens = estimatedPages * PDF_TOKENS_PER_2KB;
      processingMethod = "document_block";
    } else if (att.type === "text") {
      const sizeKb = att.size / 1_024;
      estimatedTokens = Math.round(sizeKb * TEXT_TOKENS_PER_1KB);
      processingMethod = "text_injection";
    } else {
      estimatedTokens = DESCRIPTION_NOTE_TOKENS;
      processingMethod = "description_note";
    }

    return {
      name: att.name,
      type: att.type,
      sizeBytes: att.size,
      estimatedTokens: Math.min(estimatedTokens, MAX_TOKENS_PER_ATTACHMENT),
      processingMethod,
    };
  });

  const estimatedInputTokens = breakdown.reduce((s, b) => s + b.estimatedTokens, 0);
  const estimatedCostUsd =
    Math.round((estimatedInputTokens / 1_000_000) * inputCostPer1M * 1_000_000) / 1_000_000;

  return {
    attachmentCount: attachments.length,
    totalSizeBytes: attachments.reduce((s, a) => s + a.size, 0),
    estimatedInputTokens,
    estimatedCostUsd,
    breakdown,
    ocrEstimatedTokens: 0,       // Phase 3: standalone OCR pass
    analysisEstimatedTokens: 0,  // Phase 3: pre-analysis via haiku
  };
}

// ── 7. ANALYTICS LOGGING ──────────────────────────────────────────────────────

export interface MultimodalAnalyticsPayload {
  attachmentCount: number;
  typeBreakdown: Partial<Record<AttachmentFileType, number>>;
  totalSizeBytes: number;
  workflowHints: AttachmentWorkflowHint[];
  processingMethods: string[];
  estimatedTokensAdded: number;
  agentId: string;
  agentRole: string;
  conversationId: string | null;
  workflowRunId: string | null;
  processingSucceeded: boolean;
  processingErrors: string[];
  processingMs: number;
}

export function writeMultimodalAnalytics(
  db: FirebaseFirestore.Firestore,
  payload: MultimodalAnalyticsPayload
): void {
  db.collection("agentLogs")
    .doc()
    .set({
      type: "multimodal_processing",
      ...payload,
      createdAt: new Date().toISOString(),
    })
    .catch((err) =>
      console.warn("[multimodal] analytics write failed:", String(err))
    );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Future capability stubs ────────────────────────────────────────────────────
// These document the planned extension points for Phase 3+

export const MULTIMODAL_CAPABILITIES = {
  // Phase 2 — current
  imageVisionBlocks: true,          // base64 image → Claude vision
  pdfDocumentBlocks: true,          // base64 PDF → Claude document block
  textFileInjection: true,          // plain text/CSV inlined into message
  clipboardPaste: true,             // paste image from clipboard
  dragAndDrop: true,                // drag-drop file upload

  // Phase 3 — planned
  preAnalysisExtraction: false,     // haiku pre-analysis pass for system prompt enrichment
  vectorizedAttachments: false,     // embed extracted text into knowledge base
  ocrExtraction: false,             // Tesseract/Google Vision OCR for image text
  pdfTextExtraction: false,         // pdf-parse for text extraction (beyond document blocks)

  // Future
  videoFrameExtraction: false,      // extract key frames from video uploads
  audioTranscription: false,        // Whisper transcription for audio
  screenRecordingAnalysis: false,   // analyze screen recording sequences
  canvaAssetImport: false,          // Canva MCP → attach design assets
  designVersionDiff: false,         // compare two design screenshots
  visualWorkflowAnalysis: false,    // analyze workflow diagrams / flowcharts
} as const;

export type MultimodalCapabilityKey = keyof typeof MULTIMODAL_CAPABILITIES;
