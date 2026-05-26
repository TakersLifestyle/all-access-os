// Takers AI — Creative Brief Generator
// Generates structured creative briefs for flyers, images, and campaign assets.
// Uses Claude Haiku for fast structured output.
// Saves to Firestore `creativeBriefs` collection.
//
// Output supports:
//   - Instagram Post (1080x1080)
//   - Instagram Story (1080x1920)
//   - TikTok/Reels Cover (1080x1920)
//   - Event Flyer (various)
//   - Email Header (600x300)
//
// Phase 2: When an image generation provider is connected, the imageGenPrompt
// field will be routed to that provider automatically.

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

export interface CreativeBrief {
  id?: string;
  subject: string;
  formats: AssetFormat[];

  // Copy
  headline: string;
  subheadline: string;
  bodyText: string;
  cta: string;

  // Design direction
  colorPalette: string[];         // hex codes + names
  typographyDirection: string;    // font style guidance
  imageStyle: string;             // photo style or illustration direction
  layoutNotes: string;            // layout guidance per format

  // AI-ready prompts
  canvaPrompt: string;            // prompt for Canva Magic Media / design AI
  imageGenPrompt: string;         // full DALL-E / Midjourney / Stable Diffusion prompt

  // Social
  hashtags: string[];
  captionDraft: string;

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
  confidence: number;           // 0-100
  warnings: string[];           // any hallucination risks or missing details
  createdAt?: string;
  agentId?: string;
  conversationId?: string;
}

export interface CreativeBriefRequest {
  subject: string;
  context?: string;              // extra context from the user
  formats?: AssetFormat[];       // defaults to instagram_post + event_flyer
  eventFacts?: CreativeBrief["eventFacts"];  // verified event data to inject
  tone?: string;                 // e.g. "energetic", "premium", "warm"
  agentId?: string;
  conversationId?: string;
}

// ── System prompt ─────────────────────────────────────────────────────────────

const CREATIVE_SYSTEM = `You are the Creative Director for TakersLifestyle and ALL ACCESS Winnipeg.
Your job is to generate complete, production-ready creative briefs for marketing assets.

BRAND IDENTITY:
- ALL ACCESS Winnipeg: Community-first, premium, safe, inclusive, non-profit
- Energy: Nike-level polish + Community center heart
- Tone: Warm, trustworthy, welcoming, impact-first — NEVER luxury-exclusive
- ALWAYS use: "Built for the community", "Open to everyone", "Belong here"
- NEVER use: "Exclusive", "Elite only", "TAKE IT.", "Not for everyone"

CRITICAL RULE: Only use event details that are explicitly provided in the request.
If event details are missing, use placeholders like [EVENT DATE] or [VENUE TBD].
NEVER invent dates, prices, or venues.

OUTPUT: Respond ONLY with valid JSON matching the schema. No markdown. No explanation.

SCHEMA:
{
  "headline": "Primary bold headline (5-8 words)",
  "subheadline": "Secondary copy (10-15 words)",
  "bodyText": "Body paragraph (2-3 sentences, community-first tone)",
  "cta": "Call to action (3-6 words, e.g. Get Your Tickets)",
  "colorPalette": ["#hex name", ...], // 3-5 colors from brand palette
  "typographyDirection": "Font style guidance",
  "imageStyle": "Photography or illustration style description",
  "layoutNotes": "Format-specific layout guidance",
  "canvaPrompt": "Full Canva AI design prompt (2-3 sentences)",
  "imageGenPrompt": "Full DALL-E/Midjourney prompt for background/hero image",
  "hashtags": ["#hashtag", ...], // 10-15 relevant hashtags
  "captionDraft": "Full social media caption (150-250 words)",
  "confidence": 0-100,
  "warnings": ["any missing details or risks"]
}

BRAND COLORS: Black (#09090f), Deep Navy (#0d0d15), Red (#dc2626),
White (#ffffff), Gold (#d4a017), Midnight Purple (#1a1a2e)`;

// ── Generator ─────────────────────────────────────────────────────────────────

export async function generateCreativeBrief(
  request: CreativeBriefRequest
): Promise<CreativeBrief> {
  const formats = request.formats ?? ["instagram_post", "event_flyer"];

  // Build the user prompt
  const userLines: string[] = [`CREATIVE REQUEST: ${request.subject}`];

  if (request.context) {
    userLines.push(`\nCONTEXT:\n${request.context}`);
  }

  if (request.tone) {
    userLines.push(`\nTONE: ${request.tone}`);
  }

  userLines.push(`\nTARGET FORMATS: ${formats.map((f) => `${f} (${FORMAT_DIMENSIONS[f]})`).join(", ")}`);

  if (request.eventFacts) {
    const ef = request.eventFacts;
    userLines.push("\nVERIFIED EVENT DETAILS (use these exactly — do not modify):");
    if (ef.name)         userLines.push(`- Event: ${ef.name}`);
    if (ef.date)         userLines.push(`- Date: ${ef.date}`);
    if (ef.venue)        userLines.push(`- Venue: ${ef.venue}`);
    if (ef.city)         userLines.push(`- City: ${ef.city}`);
    if (ef.generalPrice) userLines.push(`- General Price: ${ef.generalPrice}`);
    if (ef.memberPrice)  userLines.push(`- Member Price: ${ef.memberPrice}`);
    if (ef.access)       userLines.push(`- Access: ${ef.access}`);
  } else {
    userLines.push("\nNOTE: No verified event details provided. Use placeholders like [DATE], [VENUE], [PRICE] where needed.");
  }

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 2000,
    system: CREATIVE_SYSTEM,
    messages: [{ role: "user", content: userLines.join("\n") }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  // Parse JSON — be lenient
  let parsed: Partial<CreativeBrief> = {};
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]);
  } catch {
    // Return a minimal fallback brief
    parsed = {
      headline: request.subject,
      subheadline: "Community-first. Premium. Open to everyone.",
      bodyText: "Join us for an unforgettable experience — built for the community of Winnipeg.",
      cta: "Get Your Tickets",
      colorPalette: ["#dc2626 Red", "#09090f Black", "#ffffff White"],
      typographyDirection: "Bold sans-serif headline, clean body text",
      imageStyle: "Cinematic, dark, energetic photography",
      layoutNotes: "Headline prominent, clean white space, strong CTA at bottom",
      canvaPrompt: `Design a premium ${formats[0]} flyer for ${request.subject}. Dark background, bold red accents, modern typography.`,
      imageGenPrompt: `Premium event photography, dark dramatic lighting, urban Winnipeg setting, community gathering, cinematic wide shot`,
      hashtags: ["#AllAccessWinnipeg", "#Winnipeg", "#WinnipegEvents"],
      captionDraft: `Join us for ${request.subject}. Community-first. Open to everyone. Belong here. #AllAccessWinnipeg`,
      confidence: 40,
      warnings: ["Brief generated with fallback — event details not fully verified"],
    };
  }

  return {
    subject: request.subject,
    formats,
    headline: parsed.headline ?? request.subject,
    subheadline: parsed.subheadline ?? "",
    bodyText: parsed.bodyText ?? "",
    cta: parsed.cta ?? "Get Your Tickets",
    colorPalette: parsed.colorPalette ?? ["#dc2626 Red", "#09090f Black"],
    typographyDirection: parsed.typographyDirection ?? "Bold sans-serif",
    imageStyle: parsed.imageStyle ?? "Cinematic photography",
    layoutNotes: parsed.layoutNotes ?? "",
    canvaPrompt: parsed.canvaPrompt ?? "",
    imageGenPrompt: parsed.imageGenPrompt ?? "",
    hashtags: parsed.hashtags ?? ["#AllAccessWinnipeg"],
    captionDraft: parsed.captionDraft ?? "",
    eventFacts: request.eventFacts,
    confidence: parsed.confidence ?? 70,
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
