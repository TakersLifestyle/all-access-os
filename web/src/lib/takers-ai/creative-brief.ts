// Takers AI — Creative Brief Generator (v2 — Operator Grade)
//
// Generates complete, production-ready creative packages for ALL ACCESS Winnipeg.
// Uses claude-sonnet-4-5 — premium model required for quality creative output.
//
// v2 changes:
//   - Upgraded from Haiku → Sonnet for quality
//   - Generates 4 full flyer concepts per request (per operator mode spec)
//   - Each concept: unique theme + full copy + Canva prompt + image prompt + captions
//   - maxTokens raised to 4000 to support full 4-concept packages

import Anthropic from "@anthropic-ai/sdk";
import type { Firestore } from "firebase-admin/firestore";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Types ─────────────────────────────────────────────────────────────────────

export type AssetFormat =
  | "instagram_post"    // 1080x1080
  | "instagram_story"  // 1080x1920
  | "tiktok_cover"     // 1080x1920
  | "event_flyer"      // 2550x3300 (letter, 300dpi)
  | "email_header"     // 600x300
  | "poster";          // 1080x1440

export const FORMAT_DIMENSIONS: Record<AssetFormat, string> = {
  instagram_post:  "1080x1080px (square)",
  instagram_story: "1080x1920px (9:16 vertical)",
  tiktok_cover:    "1080x1920px (9:16 vertical)",
  event_flyer:     "2550x3300px (US letter, 300dpi)",
  email_header:    "600x300px (2:1 landscape)",
  poster:          "1080x1440px (3:4 portrait)",
};

/**
 * One of the 4 full flyer concepts generated per creative brief request.
 * Each concept has a unique visual direction and complete copy set.
 */
export interface FlierConcept {
  conceptNumber: 1 | 2 | 3 | 4;
  theme: string;             // Concept theme (e.g. "Energy & Movement")
  headline: string;          // Bold 5-8 word headline
  subheadline: string;       // 10-15 word supporting headline
  bodyText: string;          // 2-3 sentence body copy
  cta: string;               // 3-6 word CTA
  colorPalette: string[];    // hex codes + names (3-5)
  typographyDirection: string;
  imageStyle: string;        // Photography or illustration style
  layoutNotes: string;       // Format-specific layout guidance
  canvaPrompt: string;       // Full Canva AI / Magic Studio prompt
  imageGenPrompt: string;    // Full DALL-E / Midjourney / Flux prompt
  instagramCaption: string;  // Copy-ready Instagram caption
  tiktokCaption: string;     // Copy-ready TikTok caption
}

export interface CreativeBrief {
  id?: string;
  subject: string;
  formats: AssetFormat[];

  // Primary concept fields (concept 1, for backward compatibility)
  headline: string;
  subheadline: string;
  bodyText: string;
  cta: string;
  colorPalette: string[];
  typographyDirection: string;
  imageStyle: string;
  layoutNotes: string;
  canvaPrompt: string;
  imageGenPrompt: string;
  hashtags: string[];
  captionDraft: string;

  // 4-concept package (v2)
  concepts?: FlierConcept[];

  // Export sizes
  exportSizes?: Partial<Record<AssetFormat, string>>;

  // Render status
  renderStatus?: "ready_to_render" | "rendered";
  renderNote?: string;

  // Event facts (verified if from Firestore)
  eventFacts?: {
    name?: string;
    date?: string;
    venue?: string;
    city?: string;
    generalPrice?: string;
    memberPrice?: string;
    access?: string;
  };

  // Meta
  confidence: number;
  warnings: string[];
  createdAt?: string;
  agentId?: string;
  conversationId?: string;
}

export interface CreativeBriefRequest {
  subject: string;
  context?: string;
  formats?: AssetFormat[];
  eventFacts?: CreativeBrief["eventFacts"];
  tone?: string;
  agentId?: string;
  conversationId?: string;
}

// ── System prompt ─────────────────────────────────────────────────────────────

const CREATIVE_SYSTEM = `You are the Creative Director for TakersLifestyle and ALL ACCESS Winnipeg.
Your job is to generate complete, production-ready creative packages — not outlines or suggestions.

BRAND IDENTITY:
- ALL ACCESS Winnipeg: Community-first, premium, safe, inclusive, non-profit
- Energy: Nike-level polish + Community center heart
- Tone: Warm, trustworthy, welcoming, impact-first — NEVER luxury-exclusive
- ALWAYS use: "Built for the community", "Open to everyone", "Belong here", "Safe spaces. Real experiences."
- NEVER use: "Exclusive", "Elite only", "TAKE IT.", "Not for everyone"
- Members support the mission — they are not buying into an elite club

BRAND COLORS: Black (#09090f), Deep Navy (#0d0d15), Red (#dc2626), White (#ffffff), Gold (#d4a017), Midnight Purple (#1a1a2e)

CRITICAL FACT RULE:
- Only use event details explicitly provided in the request
- If details are missing, use placeholders: [DATE], [VENUE], [PRICE]
- NEVER invent dates, prices, venues, or ticket inclusions

OUTPUT FORMAT: Respond ONLY with valid JSON. No markdown wrapper. No explanation outside the JSON.

Generate EXACTLY 4 flyer concepts with unique visual directions. Each concept must be complete and production-ready.

SCHEMA:
{
  "concepts": [
    {
      "conceptNumber": 1,
      "theme": "Concept theme name (e.g. Energy & Movement, Community Warmth, Bold Graphic, Cinematic Dark)",
      "headline": "Bold 5-8 word primary headline",
      "subheadline": "Supporting 10-15 word headline",
      "bodyText": "2-3 sentence body copy in community-first tone",
      "cta": "3-6 word call to action",
      "colorPalette": ["#hex ColorName", "#hex ColorName"],
      "typographyDirection": "Specific font style guidance",
      "imageStyle": "Photography or illustration direction for this concept",
      "layoutNotes": "Format-specific layout instructions",
      "canvaPrompt": "Full Canva AI / Magic Studio design prompt (3-4 sentences)",
      "imageGenPrompt": "Full DALL-E/Midjourney/Flux prompt for background or hero image",
      "instagramCaption": "Complete copy-ready Instagram caption with hashtags (150-200 chars)",
      "tiktokCaption": "Complete copy-ready TikTok caption with hook (under 150 chars)"
    }
  ],
  "hashtags": ["#tag1", "#tag2"],
  "exportSizes": {
    "instagram_post": "1080x1080px",
    "instagram_story": "1080x1920px",
    "event_flyer": "2550x3300px (300dpi)"
  },
  "confidence": 0-100,
  "warnings": ["any risks or missing details"]
}

Make each of the 4 concepts VISUALLY AND TONALLY DISTINCT. Use different sections of the brand palette, different image styles, different headline approaches.`;

// ── Generator ─────────────────────────────────────────────────────────────────

export async function generateCreativeBrief(
  request: CreativeBriefRequest
): Promise<CreativeBrief> {
  const formats = request.formats ?? ["instagram_post", "event_flyer"];

  const userLines: string[] = [`CREATIVE REQUEST: ${request.subject}`];

  if (request.context) {
    userLines.push(`\nCONTEXT:\n${request.context}`);
  }

  if (request.tone) {
    userLines.push(`\nTONE DIRECTION: ${request.tone}`);
  }

  userLines.push(`\nTARGET FORMATS: ${formats.map((f) => `${f} (${FORMAT_DIMENSIONS[f]})`).join(", ")}`);

  if (request.eventFacts) {
    const ef = request.eventFacts;
    userLines.push("\nVERIFIED EVENT DETAILS — use these exactly, do not modify or invent:");
    if (ef.name)         userLines.push(`- Event: ${ef.name}`);
    if (ef.date)         userLines.push(`- Date: ${ef.date}`);
    if (ef.venue)        userLines.push(`- Venue: ${ef.venue}`);
    if (ef.city)         userLines.push(`- City: ${ef.city}`);
    if (ef.generalPrice) userLines.push(`- General Price: ${ef.generalPrice}`);
    if (ef.memberPrice)  userLines.push(`- Member Price: ${ef.memberPrice}`);
    if (ef.access)       userLines.push(`- Access: ${ef.access}`);
  } else {
    userLines.push(
      "\nNOTE: No verified event details provided. Use placeholders [DATE], [VENUE], [PRICE] for any unknown specifics."
    );
  }

  userLines.push(
    "\nDELIVER: 4 complete, production-ready flyer concepts. Each must have unique visual direction. All copy must be usable immediately without editing."
  );

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",  // Operator-grade: Sonnet required for creative work
    max_tokens: 4000,
    system: CREATIVE_SYSTEM,
    messages: [{ role: "user", content: userLines.join("\n") }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  let parsed: {
    concepts?: Partial<FlierConcept>[];
    hashtags?: string[];
    exportSizes?: Partial<Record<AssetFormat, string>>;
    confidence?: number;
    warnings?: string[];
  } = {};

  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]);
  } catch {
    // Fall through to fallback
  }

  // Build 4 concepts — use parsed if available, otherwise generate fallback concepts
  const fallbackConcepts: FlierConcept[] = [
    {
      conceptNumber: 1,
      theme: "Community Energy",
      headline: `${request.subject.slice(0, 40)}`,
      subheadline: "Open to everyone. Built for the community of Winnipeg.",
      bodyText: "Join us for an experience designed for connection and belonging. Community-first, premium, safe.",
      cta: "Get Your Tickets",
      colorPalette: ["#dc2626 Red", "#09090f Black", "#ffffff White"],
      typographyDirection: "Bold condensed sans-serif headline, clean body text",
      imageStyle: "Cinematic event photography, dark dramatic lighting, crowd energy",
      layoutNotes: "Headline top-center, hero image full bleed, CTA bottom-right",
      canvaPrompt: `Design a premium community event flyer for ${request.subject}. Dark dramatic background, bold red headline, modern clean typography. Community energy.`,
      imageGenPrompt: `Premium event photography, dark dramatic lighting, urban Winnipeg setting, community gathering, cinematic wide shot, deep blacks, red accent lighting`,
      instagramCaption: `${request.subject} is coming. Community-first. Open to everyone. Belong here. 🔴 #AllAccessWinnipeg #Winnipeg`,
      tiktokCaption: `${request.subject} 🔴 Winnipeg, we're doing this. Community first. #AllAccess`,
    },
    {
      conceptNumber: 2,
      theme: "Bold & Graphic",
      headline: "Winnipeg, Together.",
      subheadline: "Real experiences. Real community. Built for everyone.",
      bodyText: "ALL ACCESS Winnipeg creates safe spaces for youth and young adults to connect, grow, and belong.",
      cta: "Secure Your Spot",
      colorPalette: ["#d4a017 Gold", "#09090f Black", "#ffffff White"],
      typographyDirection: "Ultra-bold display type, high contrast",
      imageStyle: "Bold graphic design, geometric shapes, minimal photography",
      layoutNotes: "Full-bleed dark background, gold accents, centered layout",
      canvaPrompt: `Bold graphic event design for ${request.subject}. Black background, gold geometric accents, ultra-bold white headline. Premium minimal.`,
      imageGenPrompt: `Bold graphic design poster, deep black background, gold geometric patterns, modern typography, premium minimal aesthetic, Winnipeg urban`,
      instagramCaption: `The community is the event. ${request.subject} — be there. 🏆 #AllAccessWinnipeg #WinnipegEvents`,
      tiktokCaption: `Community over everything. ${request.subject}. #Winnipeg #AllAccess 🏆`,
    },
    {
      conceptNumber: 3,
      theme: "Warm & Welcoming",
      headline: "Belong Here.",
      subheadline: "Safe spaces. Real experiences. Your community awaits.",
      bodyText: "ALL ACCESS creates moments where everyone belongs. Premium events designed to bring Winnipeg together.",
      cta: "Join Your Community",
      colorPalette: ["#1a1a2e Midnight Purple", "#dc2626 Red", "#ffffff White"],
      typographyDirection: "Rounded humanist sans-serif, warm and approachable",
      imageStyle: "Warm lifestyle photography, real people, genuine moments",
      layoutNotes: "Soft gradient overlay, headline lower third, warmth-first layout",
      canvaPrompt: `Warm community event design for ${request.subject}. Deep purple gradient, soft red accents, inclusive welcoming typography. Real people energy.`,
      imageGenPrompt: `Warm community gathering photography, diverse young adults, genuine laughter, purple-toned lighting, Winnipeg venue, soft bokeh, documentary style`,
      instagramCaption: `Safe spaces. Real experiences. ${request.subject} — you belong here. 💜 #AllAccessWinnipeg #SafeSpaces`,
      tiktokCaption: `You belong here. ${request.subject} 💜 #AllAccess #Winnipeg`,
    },
    {
      conceptNumber: 4,
      theme: "Premium Impact",
      headline: "Access With Purpose.",
      subheadline: "Powered by community. Built for impact. Open to all.",
      bodyText: "When you attend, you support the mission. Every ticket funds safe, accessible experiences for Winnipeg.",
      cta: "Support the Mission",
      colorPalette: ["#09090f Black", "#0d0d15 Deep Navy", "#dc2626 Red"],
      typographyDirection: "Refined editorial serif + bold sans-serif combination",
      imageStyle: "High-fashion editorial meets community documentary, dramatic lighting",
      layoutNotes: "Split layout — dramatic imagery left, bold copy right, premium white space",
      canvaPrompt: `Premium editorial event design for ${request.subject}. Split layout, dramatic image left panel, bold typography right panel. Dark, high-impact, purposeful.`,
      imageGenPrompt: `Editorial event photography, dramatic split lighting, deep navy and black tones, single subject with red accent, magazine quality, purposeful mood`,
      instagramCaption: `Your ticket funds the mission. ${request.subject} — access with purpose. ⚡ #AllAccessWinnipeg #CommunityFirst`,
      tiktokCaption: `Access with purpose. ${request.subject} ⚡ #AllAccess #Winnipeg`,
    },
  ];

  // Map parsed concepts (if available), filling gaps with fallback
  const concepts: FlierConcept[] = [1, 2, 3, 4].map((num) => {
    const p = parsed.concepts?.[num - 1];
    const fb = fallbackConcepts[num - 1];
    if (!p) return fb;
    return {
      conceptNumber: num as 1 | 2 | 3 | 4,
      theme: p.theme ?? fb.theme,
      headline: p.headline ?? fb.headline,
      subheadline: p.subheadline ?? fb.subheadline,
      bodyText: p.bodyText ?? fb.bodyText,
      cta: p.cta ?? fb.cta,
      colorPalette: (p.colorPalette && p.colorPalette.length > 0) ? p.colorPalette : fb.colorPalette,
      typographyDirection: p.typographyDirection ?? fb.typographyDirection,
      imageStyle: p.imageStyle ?? fb.imageStyle,
      layoutNotes: p.layoutNotes ?? fb.layoutNotes,
      canvaPrompt: p.canvaPrompt ?? fb.canvaPrompt,
      imageGenPrompt: p.imageGenPrompt ?? fb.imageGenPrompt,
      instagramCaption: p.instagramCaption ?? fb.instagramCaption,
      tiktokCaption: p.tiktokCaption ?? fb.tiktokCaption,
    };
  });

  // Primary concept values (concept 1, for backward compat)
  const primary = concepts[0];
  const hashtags = parsed.hashtags ?? [
    "#AllAccessWinnipeg",
    "#Winnipeg",
    "#WinnipegEvents",
    "#CommunityFirst",
    "#SafeSpaces",
    "#AllAccess",
    "#WinnipegNightlife",
    "#SupportTheMission",
    "#BelongHere",
    "#WinnipegYouth",
  ];

  const exportSizes = parsed.exportSizes ?? {
    instagram_post:  "1080x1080px (square)",
    instagram_story: "1080x1920px (9:16 vertical)",
    tiktok_cover:    "1080x1920px (9:16 vertical)",
    event_flyer:     "2550x3300px (US Letter, 300dpi)",
    poster:          "1080x1440px (3:4 portrait)",
  };

  return {
    subject: request.subject,
    formats,
    // Primary concept (backward compat)
    headline: primary.headline,
    subheadline: primary.subheadline,
    bodyText: primary.bodyText,
    cta: primary.cta,
    colorPalette: primary.colorPalette,
    typographyDirection: primary.typographyDirection,
    imageStyle: primary.imageStyle,
    layoutNotes: primary.layoutNotes,
    canvaPrompt: primary.canvaPrompt,
    imageGenPrompt: primary.imageGenPrompt,
    hashtags,
    captionDraft: primary.instagramCaption,
    // 4-concept package
    concepts,
    exportSizes,
    renderStatus: "ready_to_render",
    renderNote:
      "Image rendering provider is not yet connected. All prompts are production-ready. " +
      "Connect an image provider in Settings to render directly.",
    // Event facts
    eventFacts: request.eventFacts,
    // Meta
    confidence: parsed.confidence ?? 85,
    warnings: parsed.warnings ?? [],
    agentId: request.agentId,
    conversationId: request.conversationId,
    createdAt: new Date().toISOString(),
  };
}

// ── Firestore persistence ─────────────────────────────────────────────────────

export function saveCreativeBrief(
  db: Firestore,
  brief: CreativeBrief
): Promise<string> {
  const docRef = db.collection("creativeBriefs").doc();
  return docRef
    .set({ ...brief, id: docRef.id, createdAt: brief.createdAt ?? new Date().toISOString() })
    .then(() => docRef.id);
}
