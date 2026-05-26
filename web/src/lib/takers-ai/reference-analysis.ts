// Takers AI — Reference Image Analysis
//
// Uses Claude Vision to analyze a reference design/image and extract
// precise, actionable creative direction for the Creative Image Agent.
//
// Extracts:
//   - Exact color palette with hex approximations
//   - Typography direction (weight, family style, hierarchy)
//   - Layout and composition (grid, alignment, spacing)
//   - Visual hierarchy (what the eye reads first)
//   - Overall aesthetic and mood
//   - What to replicate / improve / avoid
//   - Style guide summary for prompt injection
//
// Used in the generate-image workflow when user uploads a reference.

import Anthropic from "@anthropic-ai/sdk";
import type { AttachmentMeta } from "./attachments";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReferenceAnalysis {
  // Color
  dominantColors: string[];         // ["#1a1a2e Deep Navy", "#dc2626 Red", ...]
  colorMood: string;                // "Dark, dramatic, high contrast"
  backgroundType: string;           // "Full-bleed dark gradient", "White minimal", etc.

  // Typography
  headlineStyle: string;            // "Ultra-bold condensed sans-serif, uppercase"
  bodyStyle: string;                // "Clean regular weight, high legibility"
  typographyHierarchy: string;      // "Massive headline, small subhead, minimal body"
  fontPersonality: string;          // "Aggressive modern", "Warm humanist", etc.

  // Layout
  compositionType: string;          // "Centered", "Split vertical", "Rule of thirds", etc.
  layoutNotes: string;              // Detailed layout description
  spacingNotes: string;             // "Tight, content-dense" / "Generous white space"
  visualBalance: string;            // "Symmetrical", "Asymmetric tension", etc.

  // Visual style
  photographyStyle: string;         // "Cinematic dark", "Warm lifestyle", "Abstract graphic"
  overallAesthetic: string;         // "Premium nightlife poster", "Nike campaign energy"
  brandEnergy: string;              // "Bold aggressive", "Warm inviting", etc.

  // Creative direction
  whatToReplicate: string[];        // Things that work well
  whatToImprove: string[];          // Things that could be better
  whatToAvoid: string[];            // Problems or elements to skip

  // Prompt-ready summaries (injected directly into generation prompts)
  styleGuide: string;               // 2-3 sentence summary for system context
  canvaDirectionNote: string;       // How to guide Canva AI based on this reference
  imageGenDirectionNote: string;    // How to guide DALL-E/Flux based on this reference

  // Meta
  confidence: number;               // 0-100
  analysisWarnings: string[];
}

// ── System prompt ─────────────────────────────────────────────────────────────

const ANALYSIS_SYSTEM = `You are a professional visual design analyst for a creative agency.
Your job is to analyze design references and extract precise, actionable creative direction.
Be specific. Use professional design vocabulary. Name actual colors, font styles, layout patterns.
Your analysis will be used to generate new matching or improved designs.

Respond ONLY with valid JSON matching the schema below. No markdown wrapper. No explanation.

SCHEMA:
{
  "dominantColors": ["#hexcode ColorName", ...],
  "colorMood": "e.g. Dark dramatic high-contrast / Warm pastel soft",
  "backgroundType": "e.g. Full-bleed dark gradient / Clean white / Textured dark",
  "headlineStyle": "e.g. Ultra-bold condensed uppercase sans-serif",
  "bodyStyle": "e.g. Light weight clean regular sans-serif",
  "typographyHierarchy": "e.g. Massive headline dominates, minimal supporting text",
  "fontPersonality": "e.g. Aggressive modern / Warm humanist / Elegant editorial",
  "compositionType": "e.g. Centered / Rule of thirds / Split vertical / Full-bleed",
  "layoutNotes": "Specific layout description",
  "spacingNotes": "e.g. Generous breathing room / Tight content-dense",
  "visualBalance": "e.g. Symmetrical / Asymmetric tension / Radial",
  "photographyStyle": "e.g. Cinematic dark dramatic / Warm candid lifestyle",
  "overallAesthetic": "e.g. Premium nightclub poster / Nike athlete campaign",
  "brandEnergy": "e.g. Bold aggressive / Warm welcoming / Cool minimal",
  "whatToReplicate": ["specific element 1", "specific element 2"],
  "whatToImprove": ["specific improvement 1", "specific improvement 2"],
  "whatToAvoid": ["problem 1", "problem 2"],
  "styleGuide": "2-3 sentence summary of the visual style for prompt injection",
  "canvaDirectionNote": "Specific Canva AI direction based on this reference",
  "imageGenDirectionNote": "Specific DALL-E/Midjourney/Flux direction based on this reference",
  "confidence": 0-100,
  "analysisWarnings": []
}`;

// ── Core analyzer ─────────────────────────────────────────────────────────────

export async function analyzeReferenceImage(
  attachment: AttachmentMeta
): Promise<ReferenceAnalysis> {
  if (attachment.type !== "image") {
    return buildFallbackAnalysis("Attachment is not an image — analysis skipped.");
  }

  let base64: string;
  let mimeType: string;

  try {
    const res = await fetch(attachment.downloadUrl);
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const buffer = await res.arrayBuffer();
    base64 = Buffer.from(buffer).toString("base64");
    mimeType = (res.headers.get("content-type") ?? attachment.mimeType).split(";")[0].trim();

    // Validate MIME type for Claude Vision
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowed.includes(mimeType)) {
      mimeType = "image/jpeg"; // safe fallback
    }
  } catch (err) {
    return buildFallbackAnalysis(`Could not fetch reference image: ${String(err)}`);
  }

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5", // Fast + cheap for visual analysis
      max_tokens: 1500,
      system: ANALYSIS_SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                data: base64,
              },
            },
            {
              type: "text",
              text: "Analyze this reference design and extract precise creative direction. Return the full JSON analysis.",
            },
          ],
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    let parsed: Partial<ReferenceAnalysis> = {};
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    } catch {
      return buildFallbackAnalysis("Could not parse analysis JSON — using generic direction.");
    }

    return {
      dominantColors: parsed.dominantColors ?? [],
      colorMood: parsed.colorMood ?? "Not detected",
      backgroundType: parsed.backgroundType ?? "Not detected",
      headlineStyle: parsed.headlineStyle ?? "Not detected",
      bodyStyle: parsed.bodyStyle ?? "Not detected",
      typographyHierarchy: parsed.typographyHierarchy ?? "Not detected",
      fontPersonality: parsed.fontPersonality ?? "Not detected",
      compositionType: parsed.compositionType ?? "Not detected",
      layoutNotes: parsed.layoutNotes ?? "Not detected",
      spacingNotes: parsed.spacingNotes ?? "Not detected",
      visualBalance: parsed.visualBalance ?? "Not detected",
      photographyStyle: parsed.photographyStyle ?? "Not detected",
      overallAesthetic: parsed.overallAesthetic ?? "Not detected",
      brandEnergy: parsed.brandEnergy ?? "Not detected",
      whatToReplicate: parsed.whatToReplicate ?? [],
      whatToImprove: parsed.whatToImprove ?? [],
      whatToAvoid: parsed.whatToAvoid ?? [],
      styleGuide: parsed.styleGuide ?? "",
      canvaDirectionNote: parsed.canvaDirectionNote ?? "",
      imageGenDirectionNote: parsed.imageGenDirectionNote ?? "",
      confidence: parsed.confidence ?? 70,
      analysisWarnings: parsed.analysisWarnings ?? [],
    };
  } catch (err) {
    return buildFallbackAnalysis(`Claude Vision analysis failed: ${String(err)}`);
  }
}

/**
 * Analyze all image attachments in a list.
 * Returns the first successful analysis (primary reference).
 * All results are returned for multi-reference support.
 */
export async function analyzeReferenceImages(
  attachments: AttachmentMeta[]
): Promise<{
  primary: ReferenceAnalysis | null;
  all: ReferenceAnalysis[];
  imageCount: number;
}> {
  const imageAttachments = attachments.filter((a) => a.type === "image");
  if (imageAttachments.length === 0) {
    return { primary: null, all: [], imageCount: 0 };
  }

  const results = await Promise.all(
    imageAttachments.map((a) => analyzeReferenceImage(a))
  );

  return {
    primary: results[0] ?? null,
    all: results,
    imageCount: imageAttachments.length,
  };
}

/**
 * Build a formatted context block for injection into the Creative Image Agent's system prompt.
 * This block tells the agent exactly how to use the reference image.
 */
export function buildReferenceContextBlock(analysis: ReferenceAnalysis): string {
  if (!analysis || analysis.confidence < 20) return "";

  const lines: string[] = [
    "",
    "---",
    "",
    "## REFERENCE IMAGE ANALYSIS",
    `Overall Aesthetic: ${analysis.overallAesthetic}`,
    `Brand Energy: ${analysis.brandEnergy}`,
    `Color Mood: ${analysis.colorMood}`,
    `Colors: ${analysis.dominantColors.join(", ") || "Not detected"}`,
    `Background: ${analysis.backgroundType}`,
    `Headline Style: ${analysis.headlineStyle}`,
    `Typography Hierarchy: ${analysis.typographyHierarchy}`,
    `Composition: ${analysis.compositionType}`,
    `Layout: ${analysis.layoutNotes}`,
    `Spacing: ${analysis.spacingNotes}`,
    `Photography Style: ${analysis.photographyStyle}`,
    "",
    `REPLICATE from reference: ${analysis.whatToReplicate.join("; ") || "General style direction"}`,
    `IMPROVE on reference: ${analysis.whatToImprove.join("; ") || "Maintain quality"}`,
    `AVOID from reference: ${analysis.whatToAvoid.join("; ") || "None noted"}`,
    "",
    `Style Guide: ${analysis.styleGuide}`,
    "",
    "Use this reference analysis as creative direction. Match the overall aesthetic while",
    "applying ALL ACCESS Winnipeg brand identity (colors, tone, community-first messaging).",
  ];

  return lines.join("\n");
}

// ── Fallback ──────────────────────────────────────────────────────────────────

function buildFallbackAnalysis(warning: string): ReferenceAnalysis {
  return {
    dominantColors: [],
    colorMood: "Unknown — analysis unavailable",
    backgroundType: "Unknown",
    headlineStyle: "Unknown",
    bodyStyle: "Unknown",
    typographyHierarchy: "Unknown",
    fontPersonality: "Unknown",
    compositionType: "Unknown",
    layoutNotes: "Reference analysis unavailable — using brand defaults",
    spacingNotes: "Unknown",
    visualBalance: "Unknown",
    photographyStyle: "Unknown",
    overallAesthetic: "Unknown",
    brandEnergy: "Unknown",
    whatToReplicate: [],
    whatToImprove: [],
    whatToAvoid: [],
    styleGuide: "Apply ALL ACCESS Winnipeg brand defaults: dark, premium, community-first.",
    canvaDirectionNote: "Use ALL ACCESS brand colors and typography as default direction.",
    imageGenDirectionNote: "Dark dramatic background, bold red accents, cinematic lighting.",
    confidence: 0,
    analysisWarnings: [warning],
  };
}
