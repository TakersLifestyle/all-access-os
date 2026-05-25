// Seed script: Takers AI Command Center
// Run from functions/ folder: node ../scripts/seed-takers-ai.mjs
// Or from project root: cd functions && node ../scripts/seed-takers-ai.mjs

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import * as dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load env from web/.env.local
dotenv.config({ path: resolve(__dirname, "../web/.env.local") });

const serviceAccountRaw =
  process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ??
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (!serviceAccountRaw) {
  console.error("❌ GOOGLE_APPLICATION_CREDENTIALS_JSON (or FIREBASE_SERVICE_ACCOUNT_KEY) not found in web/.env.local");
  process.exit(1);
}

const serviceAccount = JSON.parse(serviceAccountRaw);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ── 1. Takers Operator — default agent ───────────────────────────────────────
const TAKERS_OPERATOR_PROMPT = `You are the Takers Operator — the executive AI for TakersLifestyle and ALL ACCESS Winnipeg.

You are the central intelligence. You understand both brands at a deep level and you help the founder run every aspect of the business: content, events, marketing, operations, strategy, and development.

## Your capabilities
- Brand copywriting: Instagram captions, emails, event descriptions, CTAs, member communications
- Event planning: logistics, pricing, guest experience, safety, checklists, run-of-show
- Content strategy: YouTube Shorts, TikTok, IG Reels, hooks, thumbnails, captions, video scripts
- Business strategy: revenue planning, partnerships, grants, sponsorships, competitor analysis
- Development prompts: Firebase rules, Next.js features, API design, deployment checklists
- Operational planning: SOPs, weekly priorities, delegation, moderation, reporting

## Output standards
- Be direct. Lead with action. No unnecessary preamble.
- When writing copy, give 2-3 versions minimum.
- When planning, use numbered steps with clear owners and outcomes.
- When giving strategy, put immediate actions FIRST, then long-term thinking.
- Use headers and formatting to make output scannable and ready to use.
- Never write generic advice. Everything must be specific to TakersLifestyle / ALL ACCESS Winnipeg.

## Brand rules you never break
- NEVER use "exclusive," "elite," or luxury-gatekeeping language for ALL ACCESS Winnipeg
- NEVER use "TAKE IT." in ALL ACCESS Winnipeg copy — that belongs only to TakersLifestyle
- ALL ACCESS membership CTA is always: "Become a Supporter — $25/mo"
- Events are OPEN TO EVERYONE — membership is how people go deeper and fund more
- Keep the two brands clearly separated in voice and tone at all times`;

// ── 2. Brand Memory ───────────────────────────────────────────────────────────
const BRAND_MEMORY = [
  {
    key: "takers_lifestyle_brand",
    category: "brand_voice",
    title: "TakersLifestyle Brand Voice",
    content: `TakersLifestyle is the personal brand of the founder.
Energy: Ambition, drive, relentless execution.
Tone: Bold, confident, aspirational, motivational.
"TAKE IT." is the TakersLifestyle motto — ownership, action, results.
Copy here can be aggressive and challenging. Status-driven language is appropriate.
Audience: Motivated young adults, entrepreneurs, athletes, grinders.
Visual: Panda mascot, black/white/red, high-contrast premium aesthetic.`,
  },
  {
    key: "all_access_winnipeg_brand",
    category: "brand_voice",
    title: "ALL ACCESS Winnipeg Brand Voice",
    content: `ALL ACCESS Winnipeg is a non-profit community platform.
Mission: Safe, inclusive, accessible experiences for youth and young adults.
Tone: Warm, premium, trustworthy, welcoming. Never intimidating or exclusive.
The brand balance: Nike-level polish + community center heart + non-profit authenticity.

ALWAYS use: "Built for the community." / "Open to everyone." / "Support the mission."
"Safe spaces. Real experiences." / "Winnipeg, together." / "Belong here."

NEVER use: "Exclusive" / "Elite only" / "Members only" culture / "TAKE IT." / luxury-club language.

Membership CTA: "Become a Supporter — $25/mo" — never "Join the Elite."
Events are OPEN TO EVERYONE. Membership = supporting the mission + thank-you perks.
Production URL: allaccesswinnipeg.ca`,
  },
  {
    key: "brand_separation",
    category: "brand_voice",
    title: "Brand Separation Rule (Critical)",
    content: `CRITICAL: Two brands, two completely different voices.

TakersLifestyle → Founder personal brand → "TAKE IT." → Bold, status, ambition.
ALL ACCESS Winnipeg → Community non-profit → "Belong here." → Warm, safe, inclusive.

Never mix these. Never use TakersLifestyle energy in ALL ACCESS copy.
Never use ALL ACCESS softness in TakersLifestyle content.
Always ask: which brand is this for? Then match the voice precisely.`,
  },
  {
    key: "target_audience",
    category: "audience",
    title: "Target Audience",
    content: `ALL ACCESS Winnipeg primary audience:
- Age: 19-35, Winnipeg-based
- Identity: Youth and young adults seeking community, connection, and safe social experiences
- Pain points: Social isolation, expensive/unsafe events, lack of community infrastructure
- Values: Authenticity, safety, belonging, fun, real connection
- Income: Working class to middle class — not luxury market
- Cultural: Diverse, inclusive, Manitoba roots

TakersLifestyle audience:
- Age: 18-35, online (global reach via TikTok/YouTube/IG)
- Identity: Motivated individuals, student athletes, young entrepreneurs, side hustlers
- Values: Execution, self-improvement, ambition, ownership mindset
- Platform: Short-form video (YouTube Shorts, TikTok, IG Reels)`,
  },
  {
    key: "current_events_2026",
    category: "events",
    title: "Active Events (2026)",
    content: `Current ALL ACCESS Winnipeg events:
1. VIP Launch Night — Members only, $45 member price, June 14 2026
2. Winnipeg After Dark DIABLO — $35 member / $50 general, July 19 2026
3. Mansion Party — $60 member / $80 general, Aug 9 2026
4. Sea Bears Courtside — $55 member / $75 general, Aug 23 2026

Founding 15 concept: $300 flat, Sea Bears courtside access, dinner, transport.
Ticket flow: Stripe Checkout → confirmation email via Resend → confirmed attendee state on platform.
Max 5 tickets per purchase. All payments in CAD.`,
  },
  {
    key: "membership_model",
    category: "platform_rules",
    title: "Membership Model",
    content: `ALL ACCESS membership: $25/month CAD flat rate.
Members receive:
- 15% off general ticket prices (server-side enforced)
- Access to exclusive member perks (promo codes, partner discounts)
- Community feed access (posts, comments, discussions)
- Early access to events

Non-members: Can purchase tickets at general price. Can view public events.
Custom claims: { role: "admin"|"member", status: "active"|"inactive"|"past_due"|"cancelled" }`,
  },
  {
    key: "content_pillars",
    category: "content",
    title: "Content Pillars",
    content: `TakersLifestyle content pillars:
1. Execution mindset — discipline, consistency, "How I built X"
2. Brand building — personal brand, creator economy, operator life
3. Winnipeg story — local pride, representing your city globally
4. Behind-the-scenes — event setup, real life, authentic moments
5. Motivation — short punchy affirmations, "TAKE IT." energy

ALL ACCESS content pillars:
1. Event highlights — hype reels, recap content, attendee moments
2. Community stories — member spotlights, impact moments
3. Safety & inclusion — what makes ALL ACCESS different
4. Winnipeg culture — local pride, city identity
5. Behind the scenes — event prep, team, non-profit mission`,
  },
  {
    key: "tech_stack",
    category: "business",
    title: "Tech Stack & Infrastructure",
    content: `Stack: Next.js 16 App Router, TypeScript, Tailwind CSS, Firebase (Auth + Firestore), Stripe, Resend, Vercel, Anthropic Claude API.
Monorepo: web/ (Next.js), functions/ (Cloud Functions), firestore.rules.

Key Firestore collections: users, events, perks, posts, comments, replies, ticketOrders, eventPurchases, socialFeed, leads, config.
Takers AI collections: agents, brandMemory, promptTemplates, conversations, savedOutputs, aiTasks.

Admin SDK for all sensitive writes. Client SDK for public/authenticated reads.
Firestore rules use custom claims — zero get() calls in rules.

GitHub: TakersLifestyle/all-access-os
Vercel: auto-deploy on push to main. Firebase project: studio-4850154113-14e56.
Production: allaccesswinnipeg.ca`,
  },
  {
    key: "revenue_model",
    category: "business",
    title: "Revenue & Business Model",
    content: `Revenue streams:
1. Memberships — $25/mo recurring (Stripe subscriptions)
2. Event tickets — general price ($50-$80 depending on event)
3. Founding 15 launch — $300 flat per person (capacity 15, one-time)
4. Future: sponsorships, grants, venue partnerships, merchandise

Non-profit structure — revenue reinvested into community (safer events, better venues, more programming).
Grant opportunities: Manitoba arts/culture grants, youth community development funds.
Partnership targets: Winnipeg businesses, Sea Bears, local venues, youth orgs.`,
  },
];

// ── 3. Prompt Templates ───────────────────────────────────────────────────────
const TEMPLATES = [
  // Content
  {
    agentId: "any",
    name: "Event Caption — 3 IG Versions",
    description: "3 Instagram captions for an event",
    category: "content",
    variables: ["event_name", "event_date", "location", "price", "vibe"],
    prompt: `Write 3 Instagram captions for the ALL ACCESS Winnipeg event "{{event_name}}" happening on {{event_date}} at {{location}}.
Ticket price: {{price}}. Vibe: {{vibe}}.

Requirements:
- Caption 1: Hype/announcement style (short, punchy, with emojis)
- Caption 2: Community-first storytelling style
- Caption 3: FOMO-driven urgency style (without fake exclusivity)

For each: include 3-5 relevant hashtags. Keep tone warm, premium, and Winnipeg-local.
Include a CTA to get tickets at allaccesswinnipeg.ca`,
  },
  {
    agentId: "any",
    name: "TikTok Hook — 5 Options",
    description: "5 scroll-stopping TikTok/Reels hooks",
    category: "content",
    variables: ["topic", "brand"],
    prompt: `Write 5 scroll-stopping TikTok/Instagram Reels hooks for a video about "{{topic}}" for {{brand}}.

Format each hook as the exact opening line (spoken or text overlay), under 10 words.
Make them curiosity-driven, specific to Winnipeg/Canada where relevant.
Mix hook types: question, bold statement, story setup, challenge, relatable moment.

After the 5 hooks, recommend which one to use first and why.`,
  },
  {
    agentId: "any",
    name: "Member Welcome Email",
    description: "Email to new ALL ACCESS members",
    category: "content",
    variables: ["member_name"],
    prompt: `Write a welcome email for {{member_name}}, a new ALL ACCESS Winnipeg supporter.

Tone: Warm, premium, community-first. NOT exclusive or elite.
Include:
- Warm welcome that feels personal
- What they now have access to (events discount, community feed, perks, early access)
- How to get started (visit allaccesswinnipeg.ca)
- The mission they're now supporting
- A note from the founder / brand voice moment

Subject line: Write 3 options. Keep it under 50 characters.
Email length: Medium — genuine, not corporate, not spammy.`,
  },
  {
    agentId: "any",
    name: "YouTube Shorts Script",
    description: "60-second YouTube Shorts script",
    category: "content",
    variables: ["topic", "hook", "brand"],
    prompt: `Write a 60-second YouTube Shorts script for {{brand}} on the topic: "{{topic}}".

Hook (first 3 seconds): {{hook}}

Structure:
- Hook (3s): Grab attention immediately
- Problem/Setup (10s): Establish what we're solving or showing
- Body (35s): 3-4 punchy points, one per sentence
- CTA (12s): Clear call to action

Format: Write as spoken dialogue. Label each section with timecode.
Tone: High energy, direct, no filler words. Optimized for watch-through rate.`,
  },
  // Events
  {
    agentId: "any",
    name: "Event Planning Checklist",
    description: "Full logistics checklist for an event",
    category: "events",
    variables: ["event_name", "event_date", "venue", "capacity", "ticket_price"],
    prompt: `Create a complete event planning checklist for "{{event_name}}" at {{venue}} on {{event_date}}.
Capacity: {{capacity}} people. Ticket price: {{ticket_price}}.

Organize by timeline:
- 30 days before
- 14 days before
- 7 days before
- 48 hours before
- Day of event
- Day after

Include: venue setup, safety protocols, tech (ticketing, Stripe QR), marketing, staffing, guest experience, contingency items.
Flag any ALL ACCESS-specific items (member check-in, perk redemption, photography).`,
  },
  {
    agentId: "any",
    name: "Event Description — Full Page",
    description: "Complete event page copy",
    category: "events",
    variables: ["event_name", "event_date", "venue", "general_price", "member_price", "description"],
    prompt: `Write full event page copy for "{{event_name}}" on {{event_date}} at {{venue}}.
General ticket price: {{general_price}} | Member price: {{member_price}}
Event description: {{description}}

Write:
1. Hero headline (8 words max, bold and punchy)
2. Subheadline (20 words, community/experience focused)
3. What to expect section (3-4 bullet points, specific and exciting)
4. The ALL ACCESS experience paragraph (safety, community, premium feel)
5. Pricing section copy (general + member pricing, explain why membership is worth it)
6. CTA button text (2 options)

Tone: Premium but welcoming. Safe and inclusive. Winnipeg-specific.`,
  },
  // Marketing
  {
    agentId: "any",
    name: "Launch Campaign Strategy",
    description: "Full launch strategy for an event or product",
    category: "marketing",
    variables: ["product", "launch_date", "target_audience", "goal"],
    prompt: `Create a launch campaign strategy for {{product}} launching on {{launch_date}}.
Target audience: {{target_audience}}. Goal: {{goal}}.

Deliver:
1. Campaign name and tagline
2. Timeline (weeks before launch with specific actions)
3. Platform strategy (TikTok, IG, email — what goes where and when)
4. Content pillars for the campaign (3-4 themes)
5. Key messages (what we're saying at each stage: awareness → interest → action)
6. Metrics to track
7. Budget allocation recommendations (if running ads)

Make it specific and actionable. No generic marketing fluff.`,
  },
  {
    agentId: "any",
    name: "Membership Growth Plan",
    description: "Strategy to grow ALL ACCESS memberships",
    category: "marketing",
    variables: ["current_members", "target_members", "timeframe"],
    prompt: `Create a membership growth plan for ALL ACCESS Winnipeg.
Current members: {{current_members}}. Target: {{target_members}} by {{timeframe}}.

Deliver:
1. Gap analysis — what's needed to hit the target
2. Top 5 growth channels (ranked by highest ROI for Winnipeg market)
3. Content strategy to drive membership signups
4. Referral or community-building tactics
5. Retention strategy (keep current members from churning)
6. 30-day sprint plan with specific daily/weekly actions
7. Metrics to track weekly

Remember: This is a non-profit community platform. Growth messaging must be community-first, never exclusive.`,
  },
  // Strategy
  {
    agentId: "any",
    name: "SWOT Analysis",
    description: "SWOT for TakersLifestyle or ALL ACCESS",
    category: "strategy",
    variables: ["brand", "context"],
    prompt: `Run a comprehensive SWOT analysis for {{brand}}.
Context: {{context}}

Format:
**Strengths** — 5-7 specific, honest internal advantages
**Weaknesses** — 5-7 specific, honest internal gaps (be brutally honest)
**Opportunities** — 5-7 real external opportunities (market, timing, competition, trends)
**Threats** — 5-7 real external risks

After the SWOT:
- Top 3 priorities based on the analysis
- The single biggest opportunity to pursue NOW
- The single biggest threat to address NOW`,
  },
  {
    agentId: "any",
    name: "Revenue Ideas Brainstorm",
    description: "New revenue stream ideas",
    category: "strategy",
    variables: ["brand", "current_revenue", "resources"],
    prompt: `Brainstorm 10 new revenue stream ideas for {{brand}}.
Current revenue: {{current_revenue}}. Available resources: {{resources}}.

For each idea:
- Name and one-line description
- Revenue potential (Low/Medium/High)
- Time to implement (Weeks/Months)
- Resources needed
- Alignment with non-profit mission (for ALL ACCESS ideas)

After the 10 ideas, rank the top 3 by impact + feasibility and give a 30-day action plan to start the #1 pick.`,
  },
  // Developer
  {
    agentId: "any",
    name: "Feature Implementation Prompt",
    description: "Turn a feature idea into a dev prompt",
    category: "developer",
    variables: ["feature_description", "tech_context"],
    prompt: `Turn this feature idea into a clear, structured implementation prompt for Claude or a developer:

Feature: {{feature_description}}
Tech context: {{tech_context}} (Next.js 16 App Router, TypeScript, Firebase Firestore, Tailwind CSS, Firebase Auth with custom claims)

Deliver a prompt that includes:
1. Objective (what this feature accomplishes and why)
2. Files to create or modify (with exact paths)
3. Data model changes (Firestore collections/fields if needed)
4. API routes needed (if any)
5. Security considerations (Firestore rules, auth checks)
6. UI requirements (component structure, states to handle)
7. Edge cases to handle
8. Success criteria

Make it precise enough that a developer can implement without asking questions.`,
  },
  {
    agentId: "any",
    name: "Firestore Rules Review",
    description: "Review and improve Firestore security rules",
    category: "developer",
    variables: ["rules_or_description"],
    prompt: `Review and improve these Firestore security rules (or this description of what the rules should do):

{{rules_or_description}}

Platform context: Next.js 16, Firebase Auth with custom claims { role: "admin"|"member", status: "active"|"inactive" }. Claims set by Stripe webhook — no get() calls in rules.

Analyze:
1. Security gaps or vulnerabilities
2. Missing access controls
3. Performance issues (get() calls to avoid)
4. Rules that are too permissive or too restrictive
5. Edge cases not covered

Then provide the corrected rules with comments explaining each decision.`,
  },
  // Operations
  {
    agentId: "any",
    name: "Weekly Priorities",
    description: "Structured weekly planning session",
    category: "operations",
    variables: ["week_context", "goals"],
    prompt: `Run a weekly planning session for TakersLifestyle / ALL ACCESS Winnipeg.

Context: {{week_context}}
This week's goals: {{goals}}

Deliver:
1. Top 5 priorities for the week (numbered, most important first)
2. Content to create this week (with platform and format)
3. Business tasks (admin, emails, follow-ups, decisions needed)
4. Event-related actions (if applicable)
5. One thing to say NO to this week to protect focus
6. Daily time blocks recommendation (not hour-by-hour, just key focus areas)

Keep it tight and actionable. No fluff.`,
  },
  {
    agentId: "any",
    name: "SOP — Create Standard Procedure",
    description: "Build an SOP for any recurring task",
    category: "operations",
    variables: ["task_name", "task_description", "frequency"],
    prompt: `Create a Standard Operating Procedure (SOP) for: {{task_name}}
Description: {{task_description}}
Frequency: {{frequency}}

SOP format:
1. **Purpose** — Why this task exists
2. **Owner** — Who is responsible
3. **Trigger** — What starts this process
4. **Steps** — Numbered, specific, action-oriented (no vague verbs)
5. **Tools used** — Software, platforms, accounts needed
6. **Completion criteria** — How you know it's done correctly
7. **Common mistakes** — What to watch out for
8. **Escalation** — What to do if something goes wrong

Make it specific enough that someone new could follow it without asking questions.`,
  },
];

// ── Seed functions ────────────────────────────────────────────────────────────
async function seedAgents() {
  console.log("\n🤖 Seeding agents…");
  const agentsRef = db.collection("agents");
  const existing = await agentsRef.get();

  if (!existing.empty) {
    console.log(`   ⚠ ${existing.size} agent(s) already exist — skipping. Delete the 'agents' collection to reseed.`);
    return;
  }

  const now = new Date().toISOString();
  const ref = agentsRef.doc();
  await ref.set({
    name: "Takers Operator",
    role: "operator",
    description: "Executive AI for TakersLifestyle & ALL ACCESS Winnipeg. Strategy, content, events, ops, and development.",
    systemPrompt: TAKERS_OPERATOR_PROMPT,
    icon: "◎",
    color: "bg-red-600",
    model: "claude-sonnet-4-5",
    maxTokens: 4096,
    isActive: true,
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  });
  console.log(`   ✅ Takers Operator created (id: ${ref.id})`);
}

async function seedBrandMemory() {
  console.log("\n🧠 Seeding brand memory…");
  const memRef = db.collection("brandMemory");
  const existing = await memRef.get();

  if (!existing.empty) {
    console.log(`   ⚠ ${existing.size} memory block(s) already exist — skipping.`);
    return;
  }

  const now = new Date().toISOString();
  const batch = db.batch();
  for (const mem of BRAND_MEMORY) {
    const ref = memRef.doc();
    batch.set(ref, { ...mem, updatedAt: now });
  }
  await batch.commit();
  console.log(`   ✅ ${BRAND_MEMORY.length} brand memory blocks created`);
}

async function seedTemplates() {
  console.log("\n◧  Seeding prompt templates…");
  const templRef = db.collection("promptTemplates");
  const existing = await templRef.get();

  if (!existing.empty) {
    console.log(`   ⚠ ${existing.size} template(s) already exist — skipping.`);
    return;
  }

  const now = new Date().toISOString();
  const batch = db.batch();
  for (const t of TEMPLATES) {
    const ref = templRef.doc();
    batch.set(ref, { ...t, usageCount: 0, createdAt: now });
  }
  await batch.commit();
  console.log(`   ✅ ${TEMPLATES.length} prompt templates created`);
}

// ── Run ───────────────────────────────────────────────────────────────────────
console.log("🚀 Takers AI Command Center — Seed Script");
console.log("   Firebase project:", serviceAccount.project_id);

try {
  await seedAgents();
  await seedBrandMemory();
  await seedTemplates();

  console.log("\n✅ Seed complete! Open /takers-ai to access the Command Center.");
  console.log("   Make sure ANTHROPIC_API_KEY is set in web/.env.local and Vercel.\n");
} catch (err) {
  console.error("\n❌ Seed failed:", err);
  process.exit(1);
}
