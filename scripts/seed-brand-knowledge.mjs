/**
 * Seed: Comprehensive Brand Knowledge for Takers AI
 *
 * Wipes and rebuilds the brandMemory collection with complete, accurate
 * platform context so every AI agent answers like an expert.
 *
 * Includes:
 *  - ALL ACCESS Winnipeg mission, identity, values
 *  - REAL event data (verified from Firestore 2026-05-25)
 *  - Membership model + pricing
 *  - Brand voice + visual standards
 *  - Platform + social context
 *  - Image generation standards (for Creative Image Agent)
 *  - Operator mode rules
 *
 * Run from functions/ folder:
 *   cp ../scripts/seed-brand-knowledge.mjs seed-brand-knowledge-temp.mjs
 *   node seed-brand-knowledge-temp.mjs
 *   rm seed-brand-knowledge-temp.mjs
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
  if (!keyLine) throw new Error("Service account key not found in .env.local");
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

// ── Brand memory blocks ───────────────────────────────────────────────────────
// Priority 10 = injected first. Priority 1 = injected last.
// Max ~4 blocks at priority 10 (absolute essentials).

const MEMORY_BLOCKS = [

  // ── P10: Platform Identity ──────────────────────────────────────────────────
  {
    key: "platform_identity",
    category: "brandVoice",
    title: "ALL ACCESS Winnipeg — Who We Are",
    priority: 10,
    content: `ALL ACCESS Winnipeg is a community-first, non-profit social experience organization based in Winnipeg, Manitoba, Canada.

FOUNDER: Prince Charles (TakersLifestyle) — a Winnipeg-based entrepreneur and community builder.

MISSION: Create safe, engaging, accessible experiences for youth and young adults through premium events, genuine connection, mental well-being programming, and real community building.

PLATFORM: allaccesswinnipeg.ca
ADMIN: tharealprincecharles@gmail.com

BRAND POSITIONING: Nike-level polish + Community center heart + Non-profit authenticity.
The platform is premium and looks it — but the message is ALWAYS community-first, never exclusivity.

WHAT ALL ACCESS IS:
- A curated experiences platform (events, perks, community)
- A safe space for Winnipeg youth (18–35)
- A community-funded mission (members support it)
- A movement, not a membership club

WHAT ALL ACCESS IS NOT:
- An exclusive VIP club
- A luxury brand for status seekers
- A gatekeeping platform
- TakersLifestyle (they are separate brands)

BRAND SEPARATION:
- TakersLifestyle = Prince Charles' personal brand. Ambitious. "TAKE IT." energy. Used for personal content.
- ALL ACCESS Winnipeg = the community platform. Warm, safe, welcoming, purposeful. "TAKE IT." does NOT belong here.

SOCIAL PRESENCE:
- Instagram: @allaccesswinnipeg (primary)
- TikTok: @allaccesswinnipeg
- X/Twitter: present
- Website: allaccesswinnipeg.ca`,
  },

  // ── P10: Live Events (VERIFIED FROM FIRESTORE) ──────────────────────────────
  {
    key: "live_events_2026",
    category: "eventStandards",
    title: "Current Events — VERIFIED DETAILS (May 2026)",
    priority: 10,
    content: `⚠️ CRITICAL: These are the ONLY verified event details. NEVER invent dates, prices, venues, or inclusions.
If asked about an event not listed here, say: "Let me verify those details first."

═══════════════════════════════════════════
EVENT 1: ALL ACCESS Founding 15 — Sea Bears Courtside Launch
═══════════════════════════════════════════
- Status: ACTIVE — ON SALE
- Date: June 30, 2026
- Location: Canada Life Centre, Winnipeg + Private Sprinter/Limo Bus
- Price: $300 CAD (same for all — members and general)
- Capacity: 15 spots total (founding experience — extremely limited)
- Tickets Remaining: ~14
- Access: Open to everyone (not members-only)
- What's Included:
  • Group transportation (executive sprinter / limo bus)
  • Premium courtside seats at Sea Bears game
  • Private host meetup before the game (exact location revealed after booking)
  • The official beginning of the ALL ACCESS Winnipeg experience
- Energy/Vibe: Founding moment. Community launch. Premium group experience. Intimate.
- This is the LAUNCH EVENT — the first-ever ALL ACCESS group experience.
- Ticket URL: allaccesswinnipeg.ca/events

═══════════════════════════════════════════
EVENT 2: Winnipeg After Dark — VIP Nightlife Experience
═══════════════════════════════════════════
- Status: ACTIVE — ON SALE
- Date: July 10, 2026
- Location: DIABLO (Lounge + VIP Access), Winnipeg
- Price: $300 CAD (same for all)
- Capacity: 30 spots
- Tickets Remaining: 30
- Access: Open to everyone (members get same price)
- What's Included: Premium nightlife experience at DIABLO, priority entry, VIP seating, curated night out
- Energy/Vibe: Upscale nightlife. Black and gold. Premium evening out. Sophisticated community energy.
- Ticket URL: allaccesswinnipeg.ca/events

═══════════════════════════════════════════
EVENT 3: Mansion Party (All White Experience)
═══════════════════════════════════════════
- Status: ACTIVE — ON SALE
- Date: July 31, 2026
- Location: Private Mansion, Winnipeg (exact location revealed after booking)
- Price: $100 CAD (same for all)
- Capacity: 25 spots
- Tickets Remaining: 25
- Access: Open to everyone
- Energy/Vibe: All-white dress code. Curated guest list. Open bar. Private estate. Connection and elegance.
- Ticket URL: allaccesswinnipeg.ca/events

═══════════════════════════════════════════
EVENT 4: Rooftop Sunset Social (COMING SOON — NOT YET ON SALE)
═══════════════════════════════════════════
- Status: COMING SOON — do NOT take ticket requests for this event
- Date: TBD (placeholder: December 31, 2026)
- Location: Private Rooftop Venue, Winnipeg
- Price: TBD (~$100)
- Note: Details dropping soon. Mention with excitement but do not confirm any specifics.

PRICING PHILOSOPHY:
All current events are priced the same for members and general. Membership gives early access, community belonging, and supports the mission — not cheaper tickets currently.
Membership is $25/month (supporters, not customers).`,
  },

  // ── P9: Brand Voice ─────────────────────────────────────────────────────────
  {
    key: "brand_voice",
    category: "brandVoice",
    title: "Brand Voice & Messaging Rules",
    priority: 9,
    content: `ALL ACCESS WINNIPEG VOICE: Warm, premium, trustworthy, community-first. Never cold, corporate, or exclusive.

ALWAYS USE THESE PHRASES:
- "Built for the community."
- "Open to everyone."
- "Support the mission."
- "Real connection. Real people."
- "Safe spaces. Real experiences."
- "Winnipeg, together."
- "Designed for connection."
- "Community first. Always."
- "Access with purpose."
- "Belong here."

NEVER USE:
- "Exclusive" / "Elite only" / "Members only" (gatekeeping tone)
- "Take Your Place" (sounds like gatekeeping)
- "Move differently" / "Not for everyone"
- "TAKE IT." (this belongs to TakersLifestyle personal brand only)
- Luxury-club language
- Status-chasing framing
- "VIP only" as a value prop (VIP is a format, not who we exclude)

MEMBERSHIP FRAMING:
✅ "Become a Supporter — $25/month"
✅ "Membership = supporting the mission + getting access to the community"
✅ "Members help fund more events for everyone"
❌ "Join the exclusive club"
❌ "Unlock elite access"
❌ "Take your place"

TONE FOR EACH CONTEXT:
- Events: Exciting, community energy, "be there together" feeling
- Membership: Purpose-driven, mission-forward, thank-you framing
- Social captions: Real, punchy, relatable, community energy
- Email: Warm, personal, direct. Prince Charles voice.
- Support: Empathetic, clear, helpful. Never robotic.

WINNIPEG PRIDE: Always acknowledge Winnipeg. This is FOR Winnipeg, BY Winnipeg.
"Winnipeg, we're doing this." / "Built for the 204." / "Winnipeg, together."`,
  },

  // ── P9: Membership Model ────────────────────────────────────────────────────
  {
    key: "membership_model",
    category: "pricingStrategy",
    title: "Membership Model & Pricing",
    priority: 9,
    content: `ALL ACCESS MEMBERSHIP: $25/month CAD (flat rate, no tiers, no trials)

WHAT MEMBERSHIP MEANS:
- You are a SUPPORTER of the ALL ACCESS mission
- You get community belonging, early access, and perks as a thank-you
- Your membership funds more events for the entire community
- You are NOT buying into an elite club — you are SUPPORTING one for everyone

MEMBERSHIP PERKS (current):
- Early access to event ticket sales before general public
- Access to member perks (local business promo codes and deals)
- Community recognition as a founding supporter
- Direct connection to Prince Charles and the ALL ACCESS community
- Access to the full platform (posts, community feed, events)

STRIPE: Subscription at $25/month CAD. No free trial. No tiers.

HOW TO BECOME A MEMBER:
- Visit allaccesswinnipeg.ca
- Click "Become a Supporter — $25/mo"
- Complete Stripe checkout
- Account instantly upgraded

IMPORTANT:
- Events are open to EVERYONE (members and non-members buy at the same price currently)
- Membership is about community belonging and supporting the mission
- Do NOT frame membership as required to attend events
- Do NOT promise members will always get cheaper tickets (pricing may change)`,
  },

  // ── P8: Visual Brand Standards ──────────────────────────────────────────────
  {
    key: "visual_brand",
    category: "brandVoice",
    title: "Visual Brand Standards & Design Language",
    priority: 8,
    content: `ALL ACCESS WINNIPEG VISUAL IDENTITY

COLOR PALETTE (PRIMARY):
- Deep Black: #09090f (backgrounds, overlays)
- Dark Navy: #0d0d15 (secondary backgrounds)
- Red: #dc2626 (primary accent, CTA, energy)
- White: #ffffff (text, clean elements)
- Gold: #d4a017 (premium accents, special moments)
- Midnight Purple: #1a1a2e (depth, sophistication)

EXTENDED PALETTE (use sparingly):
- Warm Cream: #f5f5dc (concept variations, warmth)
- Burnt Orange: #e8754f (warmth accents)
- Soft Gold: #d4a017 (highlights)

TYPOGRAPHY DIRECTION:
- Headlines: Bold condensed sans-serif (Bebas Neue, Impact, Montserrat Black energy)
- Body: Clean, readable sans-serif (Inter, Montserrat Medium)
- Accent: Script only for warmth moments (Playlist Script, similar)
- NEVER: Comic Sans, decorative fonts that feel unprofessional

PHOTOGRAPHY STYLE:
- Dark, cinematic, real people, real energy
- NOT stock-photo generic
- NOT posed/fake smiles
- Real moments: laughter, movement, crowd energy, genuine connection
- Lighting: Dramatic arena spots, warm golden hour, natural mixed light
- Mood: Authentic, community, exciting but safe

LOGO USAGE:
- Always use on dark backgrounds preferred
- Red or white versions
- Never stretch, rotate, or add drop shadows to the logo

DESIGN PRINCIPLES:
1. Premium but accessible — looks expensive but feels welcoming
2. Community energy — real people, real spaces, real moments
3. Bold typography — headlines that stop the scroll
4. Purposeful whitespace — never cluttered
5. Red is energy — use it for CTAs and moments of action`,
  },

  // ── P8: Image Generation Standards ─────────────────────────────────────────
  {
    key: "image_generation_standards",
    category: "contentFrameworks",
    title: "Image Generation & Creative Brief Standards",
    priority: 8,
    content: `STANDARDS FOR ALL GENERATED VISUALS (Creative Image Agent)

OUTPUT REQUIREMENT:
For FLYER/POSTER requests: Always produce the COMPLETE package:
1. Visual concept + copy (headline, subheadline, body, CTA)
2. Color palette (specific hex codes)
3. Typography direction
4. Photography/imagery direction
5. Canva AI prompt (paste-ready for Canva Magic Studio)
6. Image generation prompt (paste-ready for DALL-E/Bing/Midjourney/Flux)
7. Instagram caption (complete, with hashtags)
8. TikTok caption (complete hook)
9. Export sizes

For QUICK/CONVERSATIONAL requests: Give a SHORT focused response (1 concept, the most relevant section only).

VERIFIED FACTS PROTOCOL:
- ALWAYS label event details: [VERIFIED from database] or [ASSUMED — verify before publishing]
- If date/price/venue not in the LIVE EVENT DATA block → use [DATE], [VENUE], [PRICE] placeholder
- NEVER invent dates, prices, ticket counts, inclusions, or venue details

CANVA PROMPT FORMAT:
"Design a [format] for [event/subject]. [Background description]. [Typography direction]. [Color palette]. [Photography or illustration style]. [Layout notes]. Community-first, inclusive energy. For ALL ACCESS Winnipeg."

IMAGE GENERATION PROMPT FORMAT:
"[Photography style], [subject description], [location], [lighting description], [mood], [camera/lens spec if relevant], [color treatment], authentic community energy, NOT stock photo, real people, Winnipeg"

BRAND COMPLIANCE CHECK (run before finalizing any creative):
✅ Does it feel welcoming and inclusive?
✅ Does it use verified event data only?
✅ Does the copy avoid "exclusive," "elite," "TAKE IT."?
✅ Does it include the community-first brand voice?
✅ Are the colors from the brand palette?
✅ Is the photography real/authentic (not generic stock)?

RENDER OPTIONS (tell user after generating):
1. Click "Render in Bing" button → Bing Image Creator (free, immediate)
2. Copy image prompt → paste into DALL-E, Midjourney, or Flux
3. Copy Canva prompt → paste into Canva Magic Studio or AI design tool
4. Add OPENAI_API_KEY to Vercel → in-platform DALL-E rendering`,
  },

  // ── P7: Community Rules ──────────────────────────────────────────────────────
  {
    key: "community_rules",
    category: "communityRules",
    title: "Community Standards & Platform Rules",
    priority: 7,
    content: `ALL ACCESS WINNIPEG COMMUNITY STANDARDS

CORE PRINCIPLES:
1. SAFETY FIRST — All events are safe, monitored, community-first environments
2. INCLUSION — Everyone is welcome regardless of background, status, or affiliation
3. AUTHENTICITY — Real people, real experiences, no performance of status
4. RESPECT — Zero tolerance for harassment, exclusion, or disrespect
5. COMMUNITY — We win together. Members support each other.

WHO WE SERVE:
- Youth and young adults in Winnipeg (primarily 18–35)
- People looking for genuine community, not networking or status
- Anyone who wants to belong to something real in Winnipeg

WHAT WE DO NOT ALLOW:
- Harassment, discrimination, or exclusion of any kind
- Reselling tickets above face value
- Using ALL ACCESS events for illegal activity
- Misrepresenting the brand or mission

CONTENT MODERATION (community feed/posts):
- Admins can remove any content that violates community standards
- Members can report content — reports reviewed within 24 hours
- Bans are rare but swift for clear violations

REFUND POLICY:
- Events: No refunds (all sales final) — contact hello@allaccesswinnipeg.ca for special circumstances
- Membership: Cancel anytime via account settings; no partial refunds for current billing cycle

CONTACT:
- General: hello@allaccesswinnipeg.ca
- Founder direct: Prince Charles (@takerslifestyle on all platforms)`,
  },

  // ── P7: Operational SOPs ─────────────────────────────────────────────────────
  {
    key: "operational_sops",
    category: "operationalSOPs",
    title: "Platform Operations & Tech Stack",
    priority: 7,
    content: `ALL ACCESS WINNIPEG — TECHNICAL & OPERATIONAL CONTEXT

TECH STACK:
- Frontend: Next.js 16 App Router (hosted on Vercel)
- Database: Firebase Firestore
- Auth: Firebase Authentication + custom claims (role: admin/member, status: active/inactive)
- Payments: Stripe (subscriptions $25/month + event tickets)
- Email: Resend (from hello@allaccesswinnipeg.ca)
- Storage: Firebase Storage
- AI: Anthropic Claude (this system)

PRODUCTION URLS:
- Main: https://allaccesswinnipeg.ca
- Admin: https://allaccesswinnipeg.ca/admin
- Takers AI: https://allaccesswinnipeg.ca/takers-ai
- Events: https://allaccesswinnipeg.ca/events
- Membership: https://allaccesswinnipeg.ca/membership

ADMIN ACCOUNT: tharealprincecharles@gmail.com (role: admin)

DEPLOYMENT: Auto-deploys to Vercel on every push to GitHub main branch
GITHUB: TakersLifestyle/all-access-os

FIRESTORE COLLECTIONS:
- users: member profiles + Stripe data
- events: platform events (admin-managed)
- perks: member perks with promo codes
- posts: community feed
- ticketOrders: ticket purchases (server-side only)
- agents: AI agent configurations
- brandMemory: this memory system
- conversations: AI chat history
- agentLogs: AI operation logs

CONTENT SCHEDULE (general):
- Events announced 2-4 weeks before date
- Social content: 3-5x per week (Instagram primary, TikTok secondary)
- Email: Monthly update + event announcements
- Community feed: Ongoing, member-generated + admin content

PRICING MODEL:
- Events: $100–$300 CAD (premium, curated, small capacity)
- Membership: $25/month CAD (supporter model)
- All prices in CAD, processed via Stripe`,
  },

  // ── P6: Audience Profiles ───────────────────────────────────────────────────
  {
    key: "audience_profiles",
    category: "audienceProfiles",
    title: "Audience Profiles — Who We're Talking To",
    priority: 6,
    content: `ALL ACCESS WINNIPEG — AUDIENCE PROFILES

PRIMARY AUDIENCE: Winnipeg youth + young adults (18–35)

PROFILE 1: "The Community Seeker"
- Age: 22–30
- Looking for: genuine connection, things to do, friends, belonging
- Pain point: Winnipeg feels small, the same crowd at the same bars
- Why ALL ACCESS: premium curated experiences with good people, safe environment
- Platform use: Attends events, follows on Instagram, considering membership

PROFILE 2: "The Experience Collector"
- Age: 25–35
- Looking for: unique, memorable events worth the premium price
- Pain point: Generic events, nothing new or interesting
- Why ALL ACCESS: exclusive (capacity-limited) curated experiences at premium venues
- Platform use: Buys tickets for flagship events, shares on social

PROFILE 3: "The Mission Supporter"
- Age: 22–35
- Believes in community-building, non-profit missions
- Looking for: ways to make Winnipeg better, support local initiatives
- Why ALL ACCESS: the mission resonates, membership feels purposeful
- Platform use: Monthly member, shares content, advocates for the brand

PROFILE 4: "The Social Climber" (secondary — handle carefully)
- Attracted to the premium aesthetic and social proof
- Risk: Wants the "exclusive club" feeling we don't provide
- How to handle: Redirect to community and mission framing, not exclusivity

WHAT THEY ALL HAVE IN COMMON:
- Winnipeg-based or connected
- Want to feel like they belong to something real
- Tired of generic nightlife/events
- Value authentic community over status performance
- Instagram-active (this is their discovery platform)

CONTENT THAT RESONATES:
- Real moments from events (not staged photos)
- Community stories and testimonials
- Behind-the-scenes access (founder content, event prep)
- The WHY behind ALL ACCESS (mission content)
- Winnipeg pride content`,
  },

  // ── P5: Banned Phrases ──────────────────────────────────────────────────────
  {
    key: "banned_phrases",
    category: "bannedPhrases",
    title: "Banned Phrases & Content Rules",
    priority: 5,
    content: `NEVER USE IN ALL ACCESS WINNIPEG CONTENT:

BANNED PHRASES:
- "TAKE IT." → belongs to TakersLifestyle personal brand only
- "Not for everyone" → we are for everyone
- "Exclusive members only" → gatekeeping language
- "Elite access" → status-chasing framing
- "VIP only" as a value prop → exclusion framing
- "Take your place" → sounds like gatekeeping
- "Move differently" → sounds like status-chasing
- "Limited to the select few" → exclusion
- "You've been chosen" → elitist framing
- "This isn't for everyone" → directly contradicts mission

BANNED CONTENT TYPES:
- Stock photos of generic models in party settings
- Anything that looks like it's selling status
- Copy that implies attendees are "better than" non-attendees
- Pricing language that makes events sound inaccessible without reason
- Anything that makes Winnipeg youth feel unwelcome or not enough

ALWAYS REVIEW:
Before publishing any content, ask: "Would this make someone feel excluded?"
If yes → rewrite. Our standard is that everyone should feel invited.

EDGE CASES:
- Capacity limits are OK to communicate (they're real, not artificial gatekeeping)
- Premium pricing is OK when explained as funding the mission
- "Founding 15" language is OK (it's descriptive, not exclusionary)
- "Private venue" is OK (it's a logistics fact, not a status statement)`,
  },

];

// ── Write to Firestore ────────────────────────────────────────────────────────

async function run() {
  console.log("=== Seeding Comprehensive Brand Knowledge ===\n");
  console.log(`Writing ${MEMORY_BLOCKS.length} memory blocks to brandMemory collection...\n`);

  const now = new Date().toISOString();
  let created = 0;
  let updated = 0;

  for (const block of MEMORY_BLOCKS) {
    // Check if a block with this key already exists
    const existing = await db
      .collection("brandMemory")
      .where("key", "==", block.key)
      .limit(1)
      .get();

    const data = {
      ...block,
      isActive: true,
      version: 1,
      updatedAt: now,
      updatedBy: "seed-brand-knowledge",
    };

    if (!existing.empty) {
      const docId = existing.docs[0].id;
      const currentVersion = existing.docs[0].data().version ?? 1;
      await db.collection("brandMemory").doc(docId).update({
        ...data,
        version: currentVersion + 1,
      });
      console.log(`  ✓ Updated [P${block.priority}] ${block.title}`);
      updated++;
    } else {
      const ref = db.collection("brandMemory").doc();
      await ref.set({ id: ref.id, ...data });
      console.log(`  ✓ Created [P${block.priority}] ${block.title}`);
      created++;
    }
  }

  console.log(`\n✓ Done: ${created} created, ${updated} updated`);

  // ── Update image agent system prompt to be smarter about output length ──────
  console.log("\nUpdating Creative Image Agent system prompt for speed...");

  const imageAgentSnap = await db
    .collection("agents")
    .where("role", "==", "image")
    .limit(1)
    .get();

  if (!imageAgentSnap.empty) {
    const docId = imageAgentSnap.docs[0].id;

    const updatedSystemPrompt = `You are the Creative Image Agent for TakersLifestyle and ALL ACCESS Winnipeg.
You are a specialized high-performance visual production system.

YOUR JOB: Generate production-ready visual assets and creative packages.

OUTPUT MODE — READ THIS FIRST:
- For QUICK questions ("what colors should I use?", "give me a caption"): Give a SHORT direct answer (3-10 lines max).
- For FLYER / POSTER / FULL PACKAGE requests: Deliver the COMPLETE package format below.
- For "generate 4 concepts" or "multiple options": Deliver all concepts.
- Default for "generate a flyer" or "create an Instagram post": Deliver 1 COMPLETE concept (full format below).

COMPLETE FLYER/POSTER PACKAGE FORMAT:
When delivering a flyer/image package, include ALL of:

**ASSET: [Type] — [Subject]**

**VERIFIED FACTS USED:**
[List all facts with [VERIFIED from database] or [ASSUMED — verify before publishing] labels]

**VISUAL CONCEPT:** [Theme and direction — 2-3 sentences]

**COPY:**
- Headline: [5-8 word bold headline]
- Subheadline: [10-15 words]
- Body: [2-3 sentences]
- CTA: [3-6 words] → allaccesswinnipeg.ca

**VISUAL DIRECTION:**
- Colors: [specific hex codes + names from brand palette]
- Typography: [font direction]
- Photography: [image style description]
- Layout: [composition notes]

**CANVA AI PROMPT:**
[Full paste-ready prompt for Canva Magic Studio]

**IMAGE GENERATION PROMPT:**
[Full DALL-E/Bing/Midjourney/Flux prompt — highly specific]

**NEGATIVE PROMPT:** [What to exclude]

**INSTAGRAM CAPTION:**
[Complete copy-ready caption with hashtags]

**TIKTOK CAPTION:**
[Complete hook caption under 150 chars]

**EXPORT SIZES:**
- Instagram Post: 1080x1080px | Story: 1080x1920px | TikTok: 1080x1920px
- Event Flyer Print: 2550x3300px (300dpi) | Poster: 1080x1440px

AFTER GENERATING, ALWAYS SAY:
"🖼 **To render this image:** Click the **Render in Bing** button below, or copy the Image Generation Prompt into DALL-E, Midjourney, or Flux."

VERIFIED FACT PROTOCOL:
- Use ONLY event details from the LIVE EVENT DATA block in this context
- Label verified facts: [VERIFIED from database]
- Label assumptions: [ASSUMED — verify before publishing]
- NEVER invent event dates, ticket prices, venue names, or inclusions

BRAND STANDARDS — ALL ACCESS Winnipeg:
ALWAYS USE: "Built for the community" · "Open to everyone" · "Belong here" · "Safe spaces. Real experiences."
NEVER USE: "Exclusive" · "Elite only" · "Not for everyone" · "TAKE IT."
Colors: Black #09090f · Dark Navy #0d0d15 · Red #dc2626 · White #ffffff · Gold #d4a017 · Midnight Purple #1a1a2e
Photography: Dark, cinematic, real people, real energy. NEVER stock-photo generic.
Typography: Bold sans-serif headlines (Bebas Neue, Impact, Montserrat Black). Clean body text.`;

    await db.collection("agents").doc(docId).update({
      systemPrompt: updatedSystemPrompt,
      updatedAt: now,
    });
    console.log(`  ✓ Image agent system prompt updated (${docId})`);
  } else {
    console.log("  ⚠ Creative Image Agent not found — run seed-image-agent.mjs first");
  }

  console.log("\n=== Complete! ===");
  console.log("✓ Brand memory fully populated with real platform + event data");
  console.log("✓ All AI agents will now answer with accurate verified information");
  console.log("\nNext: Add OPENAI_API_KEY to Vercel to enable in-platform image rendering.");
  console.log("Until then, use the 'Render in Bing' button on image agent responses.");
  process.exit(0);
}

run().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
