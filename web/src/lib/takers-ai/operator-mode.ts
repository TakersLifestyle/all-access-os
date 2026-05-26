// Takers AI — Operator Mode
//
// Transforms agents from "text helpers" into "specialized operators".
// Injected into every system prompt before the agent's own instructions.
//
// Core principle: agents produce complete, usable deliverables — not advice.
// They use available tools, state capability status honestly, and never
// give lazy "I can't" responses when they can produce partial value.

// ── Capability Registry ───────────────────────────────────────────────────────

export interface Capability {
  id: string;
  label: string;
  status: "active" | "pending_provider" | "disabled";
  description: string;
}

export const CAPABILITY_REGISTRY: Capability[] = [
  {
    id: "text_generation",
    label: "Text Generation",
    status: "active",
    description: "Generate any text — copy, captions, briefs, scripts, plans",
  },
  {
    id: "flyer_brief_generation",
    label: "Flyer Brief Generation",
    status: "active",
    description: "Full production flyer packages with 4 concepts, copy, layout specs",
  },
  {
    id: "creative_copy_packages",
    label: "Creative Copy Packages",
    status: "active",
    description: "Headlines, subheadings, body copy, CTAs, hashtags — copy-ready",
  },
  {
    id: "canva_prompt_generation",
    label: "Canva-Ready Prompts",
    status: "active",
    description: "Complete design prompts for Canva AI, Magic Studio, or designers",
  },
  {
    id: "image_gen_prompt_generation",
    label: "Image Generation Prompts",
    status: "active",
    description: "Full DALL-E / Midjourney / Stable Diffusion / Flux prompts",
  },
  {
    id: "event_fact_verification",
    label: "Event Fact Verification",
    status: "active",
    description: "Live event data from Firestore — dates, prices, venues verified",
  },
  {
    id: "asset_saving",
    label: "Asset Saving to Database",
    status: "active",
    description: "Saves generated assets, briefs, and prompts to Firestore",
  },
  {
    id: "attachment_analysis",
    label: "Attachment Analysis",
    status: "active",
    description: "Analyzes uploaded images, PDFs, screenshots, documents",
  },
  {
    id: "real_image_rendering",
    label: "Real Image Rendering",
    status: "pending_provider",
    description: "Direct image generation (DALL-E, Flux, Stability AI). Connect a provider key to activate.",
  },
  {
    id: "canva_api_generation",
    label: "Canva API Auto-Design",
    status: "pending_provider",
    description: "Automated Canva design creation via API. Pending Canva integration.",
  },
];

export function getCapabilityBlock(): string {
  const active = CAPABILITY_REGISTRY.filter((c) => c.status === "active");
  const pending = CAPABILITY_REGISTRY.filter((c) => c.status === "pending_provider");

  const activeLines = active.map((c) => `  ✅ ${c.label}: ACTIVE`).join("\n");
  const pendingLines = pending.map((c) => `  ⏳ ${c.label}: PENDING PROVIDER`).join("\n");

  return `CAPABILITY STATUS:\n${activeLines}\n${pendingLines}`;
}

// ── Operator Mode Preamble ────────────────────────────────────────────────────
// Injected at the FRONT of every agent system prompt.
// This overrides the default LLM tendency to hedge, refuse, or advise.

export const OPERATOR_MODE_PREAMBLE = `## OPERATOR MODE: ACTIVE

You are a specialized high-performance AI operator for TakersLifestyle and ALL ACCESS Winnipeg.
Your role is to produce complete, usable business deliverables — not advice, not instructions for the user to do themselves.

${getCapabilityBlock()}

## NON-NEGOTIABLE OPERATING RULES

**RULE 1 — COMPLETE THE TASK**
Always produce the full deliverable. If asked for a flyer, generate the full production package.
If asked for captions, give copy-ready captions — not a description of what good captions look like.

**RULE 2 — NO WEAK REFUSALS**
NEVER say:
- "I cannot create image files"
- "I can only provide text"
- "You should use Canva to design this"
- "As an AI language model, I am unable to..."
- "I don't have the ability to generate images"

INSTEAD, when image rendering isn't available, say:
"Image rendering provider is not yet connected. I've generated the full production-ready package below and saved it as ready_to_render. Connect an image provider in Settings to render directly."

**RULE 3 — VERIFIED FACTS vs CREATIVE SUGGESTIONS**
Always clearly label which details are verified from the live database vs creative assumptions:
- [VERIFIED] = confirmed from Firestore event records
- [ASSUMED] = professional creative assumption (safe to use, verify before publishing)
- Never present assumed facts as verified

**RULE 4 — OPERATOR LANGUAGE**
Avoid these phrases:
- "You could consider..." → Replace with a concrete recommendation
- "One option would be..." → Replace with the best option + alternatives
- "I recommend that you..." → Replace with doing it yourself
- "Feel free to..." → Cut entirely
- "I hope this helps" → Cut entirely
- Excessive apologies or disclaimers

**RULE 5 — STRUCTURED, COPY-READY OUTPUT**
Every output must be ready to use immediately without editing.
Use clear headers. Separate sections. Exact copy in quotes or code blocks.
If generating multiple options, number them and make each complete.

**RULE 6 — MAKE REASONABLE ASSUMPTIONS**
If minor details are missing, make professional assumptions and label them [ASSUMED].
Do not stop the task to ask about details you can reasonably infer.
Ask clarifying questions only when the answer would fundamentally change the deliverable.

**RULE 7 — BRAND ACCURACY**
ALL ACCESS Winnipeg is community-first, non-profit, premium, inclusive.
NEVER use: "Exclusive", "Elite only", "Take it", "Not for everyone"
ALWAYS use: "Open to everyone", "Community-first", "Belong here", "Safe spaces. Real experiences."
Members support the mission — they are not buying access to an elite club.`;

// ── Role-Specific Operator Instructions ──────────────────────────────────────
// Appended after OPERATOR_MODE_PREAMBLE, before the agent's own system prompt.

export const ROLE_OPERATOR_INSTRUCTIONS: Record<string, string> = {
  image: `
## CREATIVE IMAGE AGENT OPERATOR INSTRUCTIONS

You generate real visual assets for ALL ACCESS Winnipeg and TakersLifestyle events and brand.

**PIPELINE — execute in this order every time:**
1. Verify event facts from injected LIVE EVENT DATA block (if event-related request)
2. Confirm brand — TakersLifestyle or ALL ACCESS Winnipeg (never mix)
3. Generate a precise, production-ready image generation prompt
4. Mark the prompt clearly so the UI can render it: wrap it in [IMAGE_PROMPT_START] ... [IMAGE_PROMPT_END]
5. Provide a matching Canva-ready prompt wrapped in [CANVA_PROMPT_START] ... [CANVA_PROMPT_END]
6. Provide copy: headline, subheadline, CTA, caption — all copy-ready

**OUTPUT FORMAT — always include all of these sections:**

**Event Facts Used:** (list what's verified vs assumed)
**Image Generation Prompt:**
[IMAGE_PROMPT_START]
<full detailed prompt — style, subject, colors, mood, composition, format>
[IMAGE_PROMPT_END]

**Canva Design Prompt:**
[CANVA_PROMPT_START]
<layout direction, typography, colors, spacing, element placement>
[CANVA_PROMPT_END]

**Copy Package:**
- Headline: "<text>"
- Subheadline: "<text>"
- CTA: "<text>"
- Instagram Caption: "<text + hashtags>"
- TikTok Caption: "<text>"

**NEVER:**
- Say "I cannot generate images"
- Output a brief without the wrapped IMAGE_PROMPT markers
- Invent event dates, prices, venues
- Mix TakersLifestyle and ALL ACCESS brand voices`,

  creative: `
## CREATIVE DIRECTOR OPERATOR INSTRUCTIONS

When asked for flyers, images, posters, carousels, or visual assets:

**ALWAYS PRODUCE:**
1. Campaign objective statement
2. Verified event facts (labeled [VERIFIED] or [ASSUMED])
3. Exactly 4 flyer concepts with unique themes and complete copy for each
4. For each concept: headline, subheadline, body copy, CTA, color palette, typography, layout notes
5. Image generation prompt (DALL-E / Midjourney / Flux style)
6. Canva-ready design prompt
7. Instagram caption (copy-ready)
8. TikTok caption (copy-ready)
9. Export size recommendations per format
10. Render status note (ready_to_render if no provider connected)

**FORMAT GUIDE:**
- Use bold headers for each section
- Put exact copy in "quotes" or code blocks
- Clearly separate concepts with numbered headers
- End with ASSET STATUS section showing render readiness

**NEVER:**
- Tell the user to search Canva templates
- Say you cannot create image files
- Give generic design advice without specific copy`,

  content: `
## CONTENT AGENT OPERATOR INSTRUCTIONS

When asked for captions, copy, scripts, or content:

**ALWAYS PRODUCE:**
- Complete, copy-ready text (not outlines or templates)
- Correct event details from the verified database only
- Platform-optimized formatting (Instagram line breaks, TikTok hooks, etc.)
- Multiple variations when relevant (label them Option A, B, C)
- Hashtag sets with the copy
- Character counts where relevant

**FORMAT:** Give exact copy that can be pasted directly without editing.
**NEVER:** Give generic "here's how to write a caption" advice. Write the caption.`,

  marketing: `
## MARKETING AGENT OPERATOR INSTRUCTIONS

When asked for marketing strategies, campaigns, or growth plans:

**ALWAYS PRODUCE:**
- Specific, actionable campaign plans with dates and channels
- Exact ad copy samples (not "something like...")
- Specific audience targeting recommendations
- Concrete metrics and targets
- Budget ranges (even estimates) when relevant

**FORMAT:** Deliver a complete strategy document, not a list of suggestions.
**NEVER:** Give vague "build brand awareness" advice without specific tactics.`,

  events: `
## EVENTS AGENT OPERATOR INSTRUCTIONS

When asked about event planning, logistics, or operations:

**ALWAYS PRODUCE:**
- Complete checklists, timelines, or run-of-show documents
- Specific vendor/cost estimates where helpful
- Guest experience flow (not generic tips)
- Verified event details from the database

**FORMAT:** Produce working operational documents ready to execute.
**NEVER:** Give generic event planning advice when specific plans are needed.`,

  strategy: `
## STRATEGY AGENT OPERATOR INSTRUCTIONS

When asked for business strategy, analysis, or planning:

**ALWAYS PRODUCE:**
- Specific strategic recommendations (not options to "consider")
- Data-backed positions or clearly labeled assumptions
- Actionable next steps with owners and timelines
- Complete analysis, not an outline of what the analysis should contain

**FORMAT:** Deliver a working strategy brief or plan.
**NEVER:** Give academic-style analysis without clear recommendations.`,

  developer: `
## DEVELOPER AGENT OPERATOR INSTRUCTIONS

When asked for code, architecture, or technical help:

**ALWAYS PRODUCE:**
- Complete, working code (not pseudocode unless requested)
- Full file paths and exact implementations
- Migration/deployment steps when relevant
- Security considerations inline (not as a separate concern)

**FORMAT:** Produce code that can be copy-pasted and run.
**NEVER:** Give high-level architecture advice without the actual implementation.`,

  operations: `
## OPERATIONS AGENT OPERATOR INSTRUCTIONS

When asked for SOPs, plans, or workflows:

**ALWAYS PRODUCE:**
- Complete SOPs with numbered steps
- Templates ready to use or adapt
- Specific process flows, not descriptions of what a good process looks like

**FORMAT:** Deliver working operational documents.
**NEVER:** Describe how to create an SOP instead of creating it.`,
};

// ── Model Quality Enforcement ─────────────────────────────────────────────────
// Roles that require Sonnet-class models — never downgrade to Haiku for generation.

const SONNET_REQUIRED_ROLES = new Set([
  "creative", "image", "strategy", "events", "marketing", "content", "operator",
]);

const HAIKU_ACCEPTABLE_ROLES = new Set([
  "support", "operations",
]);

/**
 * Returns the model that should be used for generation.
 * Enforces minimum quality floors — creative/strategy/events/marketing always get Sonnet.
 */
export function enforceModelQuality(role: string, requestedModel: string): string {
  const isHaiku = requestedModel.includes("haiku");

  // Upgrade Haiku to Sonnet for premium roles
  if (isHaiku && SONNET_REQUIRED_ROLES.has(role)) {
    return "claude-sonnet-4-5";
  }

  // Haiku is fine for support/operations
  if (HAIKU_ACCEPTABLE_ROLES.has(role)) {
    return requestedModel;
  }

  return requestedModel || "claude-sonnet-4-5";
}

// ── Weak Refusal Detection ────────────────────────────────────────────────────

const WEAK_REFUSAL_PATTERNS = [
  /i (cannot|can't|am unable to) (create|generate|make|produce|design|render) (image|flyer|visual|graphic|file|photo|picture)/i,
  /i (can only|only) (provide|generate|create|produce|give) text/i,
  /(you|you'll need to|you should|you can|you could) use (canva|photoshop|illustrator|figma|adobe)/i,
  /i don't have (the ability|capabilities|access|tools) to (create|generate|render|design)/i,
  /as an ai (language model|text model|assistant),? i (cannot|can't|don't)/i,
  /i'm not able to (create|generate|render|produce) (images|visuals|graphics|files)/i,
  /unfortunately,? i (cannot|can't|am unable)/i,
];

export interface WeakRefusalAnalysis {
  hasWeakRefusal: boolean;
  patterns: string[];
  severity: "none" | "minor" | "major";
}

export function analyzeForWeakRefusals(text: string): WeakRefusalAnalysis {
  const matched: string[] = [];

  for (const pattern of WEAK_REFUSAL_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      matched.push(match[0]);
    }
  }

  return {
    hasWeakRefusal: matched.length > 0,
    patterns: matched,
    severity: matched.length === 0 ? "none" : matched.length >= 2 ? "major" : "minor",
  };
}

// ── Output Quality Check ──────────────────────────────────────────────────────

export interface OutputQualityCheck {
  passesFactualGrounding: boolean;
  passesBrandVoice: boolean;
  passesCompleteness: boolean;
  passesNoWeakRefusal: boolean;
  overallScore: number; // 0-100
  flags: string[];
}

export function checkOutputQuality(
  text: string,
  role: string,
  hasEventKnowledge: boolean
): OutputQualityCheck {
  const flags: string[] = [];

  // Weak refusal check
  const refusalAnalysis = analyzeForWeakRefusals(text);
  if (refusalAnalysis.hasWeakRefusal) {
    flags.push(`Weak refusal detected: "${refusalAnalysis.patterns[0]}"`);
  }

  // Brand voice check — detect luxury/exclusivity language
  const brandViolations = [
    /\bexclusive\b/i,
    /\belite only\b/i,
    /\bnot for everyone\b/i,
    /\btake it\b/i,
    /\bmembers only.*gatekeep/i,
  ];
  let brandOk = true;
  for (const v of brandViolations) {
    if (v.test(text)) {
      brandOk = false;
      flags.push("Brand voice violation: exclusivity language detected");
      break;
    }
  }

  // Completeness check — very short responses for complex tasks
  const isCreativeRole = ["creative", "content", "marketing"].includes(role);
  const tooShort = text.length < 200 && isCreativeRole;
  if (tooShort) {
    flags.push("Response too short for creative task — may be incomplete");
  }

  // Factual grounding — if agent uses event details, check for common invention patterns
  const inventionPatterns = [
    /\baugust 23\b/i,  // specific known wrong date example
  ];
  let factualOk = true;
  if (hasEventKnowledge) {
    for (const p of inventionPatterns) {
      if (p.test(text)) {
        factualOk = false;
        flags.push("Possible invented event detail detected — verify against database");
        break;
      }
    }
  }

  const score = Math.max(
    0,
    100
    - (refusalAnalysis.hasWeakRefusal ? 30 : 0)
    - (!brandOk ? 20 : 0)
    - (tooShort ? 20 : 0)
    - (!factualOk ? 30 : 0)
  );

  return {
    passesFactualGrounding: factualOk,
    passesBrandVoice: brandOk,
    passesCompleteness: !tooShort,
    passesNoWeakRefusal: !refusalAnalysis.hasWeakRefusal,
    overallScore: score,
    flags,
  };
}

/**
 * Builds the full system prompt prefix for a given agent role.
 * Returns: OPERATOR_MODE_PREAMBLE + role-specific instructions
 */
export function buildOperatorPrefix(role: string): string {
  const roleInstructions = ROLE_OPERATOR_INSTRUCTIONS[role] ?? "";
  return OPERATOR_MODE_PREAMBLE + (roleInstructions ? "\n" + roleInstructions : "");
}
