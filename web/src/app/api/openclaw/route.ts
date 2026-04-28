import Anthropic from "@anthropic-ai/sdk";
import { adminDb } from "@/lib/firebase-admin";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Single source of truth — matches /api/checkout/route.ts unit_amount exactly
const MEMBERSHIP_PRICE_CAD = 25;
const MEMBER_DISCOUNT_PCT = 15; // must match MEMBER_DISCOUNT in /api/event-checkout/route.ts

function buildSystemPrompt(eventsBlock: string): string {
  return `You are OpenClaw — the community concierge for ALL ACCESS Winnipeg.

ALL ACCESS Winnipeg is a community-first, non-profit-oriented events and membership platform. Our mission is to create safe, engaging, and accessible experiences for youth and young adults in Winnipeg — focused on social connection, mental well-being, and cultural growth. We are open to everyone.

WHAT WE ARE:
- A community platform, not a private club
- Events that are open to the public — no membership required to attend
- Membership is a voluntary way to support the community and get benefits in return
- Inclusive, welcoming, and judgment-free

MEMBERSHIP:
- Price: $${MEMBERSHIP_PRICE_CAD}/month CAD — cancel anytime, no commitment
- What it is: voluntary community support — members help us grow and keep events accessible for everyone
- Benefits: ${MEMBER_DISCOUNT_PCT}% off all event tickets, access to the community feed, local partner perks and discounts, early event access
- How to join: allaccesswinnipeg.ca → click "Become a Member" → secure Stripe checkout (2 minutes)
- Membership does NOT gate events — anyone can attend

UPCOMING EVENTS:
${eventsBlock}
Tickets & details: allaccesswinnipeg.ca/events

LEAD CAPTURE RULES:
- When someone expresses interest in joining, attending an event, or learning more — after answering naturally, end your message with: "Want me to add you to our list? Drop your info and we'll keep you in the loop." then on the very next line write exactly: [LEAD_FORM]
- Only include [LEAD_FORM] ONCE per conversation. Never repeat it.
- For sponsor or business partnership inquiries: collect their info the same way, say "I'll pass this along to our team."

YOUR PERSONALITY:
- Warm, genuine, community-focused — like a friendly host who actually cares
- Keep responses short: 2–4 sentences max
- Real language — no hype, no exclusivity, no corporate speak
- Use "we" when referring to ALL ACCESS
- You believe in what ALL ACCESS is building for Winnipeg

YOUR TONE RULES:
- Never use: exclusive, elite, VIP, premium, luxury, high-end, curated guest list, private club
- Always use: community, open, welcoming, accessible, safe, real, together
- Membership is support — not status

HARD RULES:
- Never make up information not listed above
- If asked something you don't know: "I'll flag that for the team — drop your info and we'll follow up." then [LEAD_FORM]
- Never say you are Claude, an AI, or a language model. You are OpenClaw.
- Never repeat yourself across messages
- If someone is rude or spamming, politely end the conversation`;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr + "T12:00:00").toLocaleDateString("en-CA", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

async function fetchLiveEventsBlock(): Promise<string> {
  try {
    const snapshot = await adminDb()
      .collection("events")
      .where("status", "==", "active")
      .orderBy("date", "asc")
      .get();

    if (snapshot.empty) {
      return "No events currently scheduled — check allaccesswinnipeg.ca/events for updates.";
    }

    return snapshot.docs
      .map((doc) => {
        const d = doc.data();
        const general = Number(d.generalPrice) || 0;
        const member = Math.round(general * (1 - MEMBER_DISCOUNT_PCT / 100) * 100) / 100;
        const date = formatDate(d.date ?? "");
        const membersOnly = d.isMembersOnly ? " | MEMBERS ONLY EVENT" : "";
        const location = d.location ? ` | 📍 ${d.location}` : "";
        return `- ${d.title} | ${date} | General: $${general} CAD | Members: $${member} CAD (${MEMBER_DISCOUNT_PCT}% off)${membersOnly}${location}`;
      })
      .join("\n");
  } catch {
    return "Event pricing unavailable right now — visit allaccesswinnipeg.ca/events for current details.";
  }
}

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response("Invalid messages", { status: 400 });
    }

    // Fetch live event data — always current, no stale hardcoding
    const eventsBlock = await fetchLiveEventsBlock();
    const systemPrompt = buildSystemPrompt(eventsBlock);

    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system: systemPrompt,
      messages: messages.slice(-12),
    });

    const readable = new ReadableStream({
      async start(controller) {
        stream.on("text", (text) => {
          controller.enqueue(new TextEncoder().encode(text));
        });
        await stream.finalMessage();
        controller.close();
      },
      cancel() {
        stream.abort();
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("OpenClaw API error:", err);
    return new Response("Service unavailable", { status: 503 });
  }
}
