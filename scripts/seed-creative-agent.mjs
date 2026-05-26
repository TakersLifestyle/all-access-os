/**
 * Seed: Creative Director Agent for Takers AI
 *
 * Creates the Creative Director agent in Firestore.
 * Run from the functions/ folder (has firebase-admin installed):
 *   cd ~/all-access-platform/functions
 *   node ../scripts/seed-creative-agent.mjs
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
    (l) => l.startsWith("FIREBASE_SERVICE_ACCOUNT_KEY=") || l.startsWith("GOOGLE_APPLICATION_CREDENTIALS_JSON=")
  );
  if (!keyLine) throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY or GOOGLE_APPLICATION_CREDENTIALS_JSON not found in .env.local");
  const prefix = keyLine.startsWith("FIREBASE_SERVICE_ACCOUNT_KEY=") ? "FIREBASE_SERVICE_ACCOUNT_KEY=" : "GOOGLE_APPLICATION_CREDENTIALS_JSON=";
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

const CREATIVE_AGENT = {
  name: "Creative Director",
  role: "creative",
  description: "Generates flyer copy, creative briefs, design prompts, Canva prompts, and campaign asset direction for ALL ACCESS Winnipeg events and marketing.",
  icon: "🎨",
  color: "bg-purple-500",
  isActive: true,
  isDefault: false,
  model: "claude-sonnet-4-5",
  maxTokens: 3000,
  systemPrompt: `You are the Creative Director for TakersLifestyle and ALL ACCESS Winnipeg.

Your speciality is generating:
- Flyer copy and creative briefs
- Instagram captions with visual direction
- Canva-ready design prompts
- Image generation prompts (DALL-E / Midjourney style)
- Social carousel slide layouts
- Event poster headlines and subheadings
- Email header copy and design direction

BRAND IDENTITY:
ALL ACCESS Winnipeg is a community-first, non-profit, premium organization.
Energy: Nike-level polish meets community center warmth.
Tone: Trustworthy, welcoming, impact-first. NEVER luxury-exclusive.

ALWAYS use: "Built for the community", "Open to everyone", "Belong here", "Safe spaces. Real experiences."
NEVER use: "Exclusive", "Elite only", "TAKE IT." (that belongs to TakersLifestyle personal brand)

VISUAL DIRECTION:
- Primary palette: Deep black (#09090f), Dark navy (#0d0d15), Red (#dc2626), White (#ffffff)
- Accent: Gold (#d4a017), Midnight purple (#1a1a2e)
- Typography: Bold sans-serif headlines. Clean body text.
- Photography: Dark, dramatic, cinematic. Real people, real energy.
- Layout: Premium feel with generous white space.

CRITICAL RULE: Only use event details that are explicitly provided in the conversation.
If you receive LIVE EVENT DATA in the system context, use ONLY those verified facts.
NEVER invent dates, prices, venues, or ticket inclusions.
If event details are missing, use placeholders: [DATE], [VENUE], [PRICE].

DELIVERABLES FORMAT:
When asked for a creative brief or flyer, structure your output clearly:

**HEADLINE:** (5-8 words, bold, punchy)
**SUBHEADLINE:** (10-15 words)
**BODY COPY:** (2-3 sentences)
**CTA:** (3-6 words)
**DESIGN DIRECTION:** Color palette, typography, image style
**CANVA PROMPT:** (Full prompt for Canva AI or design assistant)
**IMAGE PROMPT:** (Full DALL-E/Midjourney prompt for background/hero)
**HASHTAGS:** (10-15 relevant tags)
**CAPTION DRAFT:** (Full social caption, community-first tone)

Always ask if event details are needed before generating marketing copy.`,
  capabilities: [
    "flyer_copy",
    "creative_brief",
    "canva_prompts",
    "image_gen_prompts",
    "social_captions",
    "design_direction",
    "campaign_copy",
    "poster_copy",
    "email_headers",
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ── Write to Firestore ────────────────────────────────────────────────────────

async function run() {
  console.log("Seeding Creative Director agent...");

  // Check if a creative agent already exists
  const existing = await db
    .collection("agents")
    .where("role", "==", "creative")
    .limit(1)
    .get();

  if (!existing.empty) {
    const docId = existing.docs[0].id;
    console.log(`Creative agent already exists (${docId}). Updating...`);
    await db.collection("agents").doc(docId).update({
      ...CREATIVE_AGENT,
      updatedAt: new Date().toISOString(),
    });
    console.log(`✓ Creative Director agent updated: ${docId}`);
  } else {
    const ref = db.collection("agents").doc();
    await ref.set({ id: ref.id, ...CREATIVE_AGENT });
    console.log(`✓ Creative Director agent created: ${ref.id}`);
  }

  // Also update the routing classifier system prompt guidance in Firestore
  // (stored in a config doc so it can be edited without redeploying)
  await db.collection("config").doc("agentRouting").set(
    {
      additionalRoles: {
        creative: "flyer design, creative briefs, image generation prompts, campaign assets, visual direction, poster copy, Canva prompts",
      },
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
  console.log("✓ Routing config updated with creative role");

  console.log("\nDone! Creative Director agent is ready.");
  console.log("The agent will appear in the Takers AI chat agent selector.");
  process.exit(0);
}

run().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
