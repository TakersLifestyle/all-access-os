/**
 * Seed: Operator Mode Brand Memory + Agent Model Upgrades
 *
 * 1. Adds "operator mode" rule to brandMemory in Firestore
 * 2. Ensures creative/content/events/marketing agents use claude-sonnet-4-5
 *
 * Run from the functions/ folder:
 *   cp ../scripts/seed-operator-memory.mjs seed-operator-memory-temp.mjs
 *   node seed-operator-memory-temp.mjs
 *   rm seed-operator-memory-temp.mjs
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
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY or GOOGLE_APPLICATION_CREDENTIALS_JSON not found in .env.local"
    );
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

// ── Operator Mode Memory Block ────────────────────────────────────────────────

const OPERATOR_MODE_MEMORY = {
  title: "Operator Mode — Agent Performance Standards",
  category: "system",
  priority: 10,  // Highest priority — this must always be active
  isActive: true,
  content: `## OPERATOR MODE: ALWAYS ACTIVE

All Takers AI agents operate in Operator Mode. This is non-negotiable.

### Core Behavior Rules

**ALWAYS produce complete deliverables:**
- If asked for a flyer → deliver a full production package (4 concepts, copy, prompts)
- If asked for captions → deliver copy-ready captions, not a description of how to write them
- If asked for a strategy → deliver a working strategy brief, not a list of things to consider

**NEVER give weak refusals:**
- NEVER say "I cannot create image files"
- NEVER say "I can only provide text"
- NEVER say "You should use Canva to design this"
- NEVER say "As an AI, I am unable to..."
- INSTEAD: deliver everything possible, note what requires a connected provider, save it as ready_to_render

**Image rendering not yet connected:**
When asked to render/generate images and no provider is active:
"Image rendering provider is not yet connected. I've generated the full production-ready package below and saved it as ready_to_render. Connect an image provider in Settings to render directly."

**Fact labeling:**
- [VERIFIED] = confirmed from Firestore event database
- [ASSUMED] = professional creative assumption (safe to use, verify before publishing)

**Language standards:**
- Replace "You could consider..." with a concrete recommendation
- Replace "One option would be..." with the best option
- Cut: "Feel free to", "I hope this helps", "As an AI language model"
- Cut: Excessive apologies or disclaimers

**Output format:**
Every output must be ready to use immediately. Use clear headers. Separate sections. Exact copy in quotes or code blocks.

**Brand accuracy for ALL ACCESS Winnipeg:**
- Community-first, non-profit, inclusive, premium
- ALWAYS: "Open to everyone", "Community-first", "Belong here", "Safe spaces. Real experiences."
- NEVER: "Exclusive", "Elite only", "Take it", "Not for everyone"
- Members support the mission — they are not buying access to an elite club`,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ── Premium-role model requirements ──────────────────────────────────────────
// These roles MUST use claude-sonnet-4-5 — Haiku produces insufficient quality for production.

const SONNET_REQUIRED_ROLES = ["creative", "content", "events", "marketing", "strategy", "operator"];

// ── Run ───────────────────────────────────────────────────────────────────────

async function run() {
  console.log("=== Operator Mode Seed ===\n");

  // 1. Upsert operator mode memory block
  console.log("1. Upserting operator mode brand memory...");
  const existingMemory = await db
    .collection("brandMemory")
    .where("title", "==", OPERATOR_MODE_MEMORY.title)
    .limit(1)
    .get();

  if (!existingMemory.empty) {
    const docId = existingMemory.docs[0].id;
    await db.collection("brandMemory").doc(docId).update({
      ...OPERATOR_MODE_MEMORY,
      updatedAt: new Date().toISOString(),
    });
    console.log(`   ✓ Operator memory updated: ${docId}`);
  } else {
    const ref = db.collection("brandMemory").doc();
    await ref.set({ id: ref.id, ...OPERATOR_MODE_MEMORY });
    console.log(`   ✓ Operator memory created: ${ref.id}`);
  }

  // 2. Upgrade agent models for premium roles
  console.log("\n2. Upgrading agent models for premium roles...");
  for (const role of SONNET_REQUIRED_ROLES) {
    const snap = await db
      .collection("agents")
      .where("role", "==", role)
      .get();

    if (snap.empty) {
      console.log(`   ⚠  No agent found for role: ${role}`);
      continue;
    }

    for (const doc of snap.docs) {
      const data = doc.data();
      const currentModel = data.model ?? "(none)";
      if (currentModel === "claude-sonnet-4-5") {
        console.log(`   ✓ ${role} (${doc.id}) — already claude-sonnet-4-5`);
        continue;
      }
      await db.collection("agents").doc(doc.id).update({
        model: "claude-sonnet-4-5",
        updatedAt: new Date().toISOString(),
      });
      console.log(`   ✓ ${role} (${doc.id}) — upgraded ${currentModel} → claude-sonnet-4-5`);
    }
  }

  // 3. Update operator agent maxTokens (needs more room for full packages)
  console.log("\n3. Updating maxTokens for creative-grade agents...");
  const creativeSnap = await db
    .collection("agents")
    .where("role", "==", "creative")
    .get();

  for (const doc of creativeSnap.docs) {
    await db.collection("agents").doc(doc.id).update({
      maxTokens: 4000,
      updatedAt: new Date().toISOString(),
    });
    console.log(`   ✓ Creative agent maxTokens → 4000: ${doc.id}`);
  }

  // 4. Update routing config with enhanced creative keywords
  console.log("\n4. Updating routing config...");
  await db.collection("config").doc("agentRouting").set(
    {
      additionalRoles: {
        creative:
          "flyer, poster, banner, carousel, creative brief, image generation, image prompt, Canva, design, visual, artwork, graphic, campaign assets, marketing materials, event poster, social media graphics, Instagram design, story design, branding",
        content:
          "caption, copy, script, content, write, hashtags, Instagram post, TikTok, YouTube, email copy, newsletter",
        marketing:
          "marketing strategy, campaign, growth, ad copy, targeting, funnel, launch, promotion",
      },
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
  console.log("   ✓ Routing config updated with expanded creative + content keywords");

  console.log("\n=== Done! ===");
  console.log("✓ Operator mode memory is active");
  console.log("✓ All premium-role agents now use claude-sonnet-4-5");
  console.log("✓ Creative agent maxTokens set to 4000");
  console.log("✓ Routing config expanded for better creative detection");
  process.exit(0);
}

run().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
