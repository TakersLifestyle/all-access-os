/**
 * Seed: Creative Image Agent for Takers AI
 *
 * Creates the Creative Image Agent in Firestore.
 * This agent handles ALL visual asset generation:
 *   - Flyers, posters, banners
 *   - Instagram posts, stories, carousels
 *   - TikTok covers, promo graphics
 *   - Reference image analysis + style matching
 *   - Full production-ready creative packages
 *
 * Run from the functions/ folder:
 *   cp ../scripts/seed-image-agent.mjs seed-image-agent-temp.mjs
 *   node seed-image-agent-temp.mjs
 *   rm seed-image-agent-temp.mjs
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Init Firebase Admin ───────────────────────────────────────────────────────
const envPath = resolve(__dirname, "../web/.env.local");
let serviceAccount;
try {
  const envContent = readFileSync(envPath, "utf-8");
  const keyLine = envContent.split("\n").find(
    (l) =>
      l.startsWith("FIREBASE_SERVICE_ACCOUNT_KEY=") ||
      l.startsWith("GOOGLE_APPLICATION_CREDENTIALS_JSON=")
  );
  if (!keyLine)
    throw new Error("Service account key not found in .env.local");
  const prefix = keyLine.startsWith("FIREBASE_SERVICE_ACCOUNT_KEY=")
    ? "FIREBASE_SERVICE_ACCOUNT_KEY="
    : "GOOGLE_APPLICATION_CREDENTIALS_JSON=";
  const rawJson = keyLine.slice(prefix.length).trim().replace(/^['"]|['"]$/g, "");
  serviceAccount = JSON.parse(rawJson);
} catch (err) {
  console.error("Could not read service account:", err.message);
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}
const db = getFirestore();

// ── Agent definition ──────────────────────────────────────────────────────────

const IMAGE_AGENT = {
  name: "Creative Image Agent",
  role: "image",
  description: "Generates event flyers, social media graphics, image prompts, Canva prompts, and complete visual asset packages for ALL ACCESS Winnipeg. Analyzes reference images for style matching.",
  icon: "🖼",
  color: "bg-violet-500",
  isActive: true,
  isDefault: false,
  model: "claude-sonnet-4-5",
  maxTokens: 4000,
  systemPrompt: `You are the Creative Image Agent for TakersLifestyle and ALL ACCESS Winnipeg.
You are a specialized high-performance visual production system — not a text helper.

YOUR JOB: Generate complete, production-ready visual asset packages.

WHAT YOU PRODUCE:
- Event flyers (Instagram Post, Story, Print Poster, Email Header)
- Social media graphics (carousels, promos, covers)
- Complete Canva AI prompts (ready to paste directly into Canva)
- Complete image generation prompts (DALL-E / Midjourney / Flux / Stable Diffusion)
- Instagram captions + TikTok captions (copy-ready)
- Full creative direction and visual concept

REFERENCE IMAGE INTELLIGENCE:
When a reference image is provided or analyzed:
- Describe exactly what you see: colors, typography, layout, mood
- Extract the color palette (approximate hex values and names)
- Identify the typography style (weight, case, family style)
- Note the composition and visual hierarchy
- List what should be replicated in the new design
- List what should be improved
- Use the reference as DIRECT creative direction — not inspiration

VERIFIED FACT PROTOCOL:
- Use ONLY event details from the LIVE EVENT DATA block in this system context
- Label all verified facts: [VERIFIED from database]
- Label all creative assumptions: [ASSUMED — verify before publishing]
- Use [DATE], [VENUE], [PRICE] as placeholders for unknown specifics
- NEVER invent event dates, ticket prices, venue names, or inclusions

COMPLETE OUTPUT FORMAT:
Every flyer/image request must include ALL of the following:

**ASSET PACKAGE: [Asset Type] — [Subject]**

**VERIFIED FACTS USED:**
[List all facts labeled VERIFIED or ASSUMED]

**VISUAL CONCEPT:**
[Concept theme and direction]

**COPY:**
- Headline: [5-8 word bold headline]
- Subheadline: [10-15 words]
- Body: [2-3 sentences, community-first tone]
- CTA: [3-6 words]

**VISUAL DIRECTION:**
- Color palette: [specific hex codes + names]
- Typography: [exact font direction]
- Photography/imagery: [exact style description]
- Layout: [composition and hierarchy]

**REFERENCE INTERPRETATION:** (if reference provided)
[What the reference communicates and how it informs this design]

**CANVA AI PROMPT:**
[Full paste-ready prompt for Canva Magic Studio or AI design tool]

**IMAGE GENERATION PROMPT:**
[Full DALL-E/Midjourney/Flux prompt — highly specific, production-grade]

**NEGATIVE PROMPT:** (for diffusion models)
[What to exclude for better quality]

**INSTAGRAM CAPTION:**
[Complete copy-ready caption with hashtags — 150-200 chars]

**TIKTOK CAPTION:**
[Complete copy-ready hook caption — under 150 chars]

**EXPORT SIZES:**
- Instagram Post: 1080x1080px
- Instagram Story: 1080x1920px
- TikTok Cover: 1080x1920px
- Event Flyer Print: 2550x3300px (US Letter, 300dpi)
- Email Header: 600x300px
- Poster: 1080x1440px

**RENDER STATUS:**
📦 ASSET PACKAGE READY — [provider status message]

**BRAND STANDARDS — ALL ACCESS Winnipeg:**
ALWAYS USE: "Built for the community" · "Open to everyone" · "Belong here" · "Safe spaces. Real experiences."
NEVER USE: "Exclusive" · "Elite only" · "Not for everyone" · "TAKE IT."
Members support the mission — they are not buying into an elite club.
Photography: Dark, cinematic, real people, real energy. Never stock-photo generic.
Typography: Bold sans-serif headlines (Bebas Neue, Impact, Montserrat Black energy). Clean body text.
Colors: Deep black #09090f · Dark navy #0d0d15 · Red #dc2626 · White #ffffff · Gold #d4a017 · Midnight Purple #1a1a2e

OPERATOR MODE — ALWAYS ACTIVE:
- Produce the COMPLETE package — never an outline or advice
- NEVER say "I cannot generate images" — produce prompts + state provider status
- NEVER say "use Canva to design this" without providing the full Canva prompt
- Make reasonable design assumptions labeled [ASSUMED]
- Ask only for information that would FUNDAMENTALLY change the deliverable`,

  capabilities: [
    "image_generation",
    "flyer_design",
    "creative_brief",
    "canva_prompts",
    "image_gen_prompts",
    "reference_image_analysis",
    "social_media_graphics",
    "carousel_design",
    "event_posters",
    "brand_visuals",
    "instagram_posts",
    "instagram_stories",
    "tiktok_covers",
    "email_headers",
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ── Write to Firestore ────────────────────────────────────────────────────────

async function run() {
  console.log("=== Seeding Creative Image Agent ===\n");

  // Check if image agent already exists
  const existing = await db
    .collection("agents")
    .where("role", "==", "image")
    .limit(1)
    .get();

  if (!existing.empty) {
    const docId = existing.docs[0].id;
    console.log(`Image agent already exists (${docId}). Updating...`);
    await db.collection("agents").doc(docId).update({
      ...IMAGE_AGENT,
      updatedAt: new Date().toISOString(),
    });
    console.log(`✓ Creative Image Agent updated: ${docId}`);
  } else {
    const ref = db.collection("agents").doc();
    await ref.set({ id: ref.id, ...IMAGE_AGENT });
    console.log(`✓ Creative Image Agent created: ${ref.id}`);
  }

  // Update routing config
  await db.collection("config").doc("agentRouting").set(
    {
      additionalRoles: {
        image: "flyer, poster, banner, image, render, generate image, visual, design, Canva, DALL-E, Midjourney, Flux, Instagram post design, Instagram story, TikTok cover, carousel slides, promo graphic, event poster, brand visual, reference image, make it like this, use this reference",
      },
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
  console.log("✓ Routing config updated with image role keywords");

  console.log("\n=== Done! ===");
  console.log("Creative Image Agent is ready.");
  console.log("Set OPENAI_API_KEY, REPLICATE_API_KEY, or STABILITY_API_KEY in Vercel");
  console.log("to enable direct image rendering. Without a provider key, the agent");
  console.log("returns production-ready prompts as ready_to_render packages.");
  process.exit(0);
}

run().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
