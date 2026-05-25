// Initial brand memory seed — imported by seed script and API defaults

export const BRAND_MEMORY_SEED = [
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
Mission: Safe, inclusive, accessible experiences for youth and young adults through events, connection, mental well-being, and real community.
Tone: Warm, premium, trustworthy, welcoming. Never intimidating.
The brand balance: Nike-level polish + community center heart + non-profit authenticity.

ALWAYS use phrases like:
- "Built for the community."
- "Open to everyone."
- "Support the mission."
- "Safe spaces. Real experiences."
- "Winnipeg, together."
- "Community first. Always."
- "Belong here."

NEVER use: "Exclusive" / "Elite only" / "Members only" culture / luxury-club language / "TAKE IT." / status-chasing framing.

Membership CTA: "Become a Supporter — $25/mo" — NOT "Join the Elite."
Events are OPEN TO EVERYONE. Membership = supporting the mission + receiving thank-you perks.

Production URL: allaccesswinnipeg.ca`,
  },
  {
    key: "brand_separation",
    category: "brand_voice",
    title: "Brand Separation Rule",
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
    key: "current_events",
    category: "events",
    title: "Active Events (2026)",
    content: `Current ALL ACCESS Winnipeg events:
1. VIP Launch Night — Members only, $45 member price, June 14 2026
2. Winnipeg After Dark DIABLO — $35 member / $50 general, July 19 2026
3. Mansion Party — $60 member / $80 general, Aug 9 2026
4. Sea Bears Courtside — $55 member / $75 general, Aug 23 2026

Founding 15 (SOLD OUT CONCEPT): $300 flat, Sea Bears courtside access, dinner, transport.
Ticket flow: Stripe Checkout → confirmation email via Resend → confirmed attendee state on platform.
Max 5 tickets per purchase. Payments in CAD.`,
  },
  {
    key: "membership_model",
    category: "platform_rules",
    title: "Membership Model",
    content: `ALL ACCESS membership: $25/month CAD flat rate.
Members receive:
- 15% off general ticket prices (server-side enforced, cannot be bypassed)
- Access to exclusive member perks (promo codes, partner discounts)
- Community feed access (posts, comments, discussions)
- Early access to events

Non-members: Can purchase tickets at general price. Can view public events page.
Stripe subscription via /api/checkout. Claims set by webhook — no Firestore reads in rules.
Custom claims: { role: "admin"|"member", status: "active"|"inactive"|"past_due"|"cancelled" }`,
  },
  {
    key: "content_pillars",
    category: "content",
    title: "Content Pillars",
    content: `TakersLifestyle content pillars:
1. Execution mindset — "How I built X," discipline, consistency
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
    content: `Stack: Next.js 16 App Router, TypeScript, Tailwind CSS, Firebase (Auth + Firestore), Stripe, Resend, Vercel.
Monorepo: web/ (Next.js), functions/ (Cloud Functions), firestore.rules.

Key collections: users, events, perks, posts, comments, replies, ticketOrders, eventPurchases, socialFeed, leads, config.
Admin SDK used for all sensitive writes. Client SDK for public reads and authenticated user reads.
Firestore rules use custom claims — zero get() calls in rules.

GitHub: TakersLifestyle/all-access-os
Vercel: auto-deploy on push to main.
Firebase project: studio-4850154113-14e56.
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
4. Potential: sponsorships, grants, venue partnerships, merchandise

Non-profit structure — revenue goes back into the community (safer events, better venues, more programming).
Grant opportunities: Manitoba arts/culture grants, youth community development funds.
Partnership targets: Winnipeg businesses, Sea Bears, local venues, youth orgs.`,
  },
];
