// Takers AI — Live Event Knowledge Source
// Server-side only. Fetches event records from Firestore and formats them
// for injection into agent system prompts.
//
// PURPOSE: Prevent agents from inventing event details.
// HOW: Before each chat request (for content/events/marketing agents),
//       we inject verified event facts from the database.
//       Agents are instructed to NEVER use any date, price, or venue
//       that is not present in this block.
//
// Cache: module-level, 90-second TTL (balances freshness vs. read cost)

import type { Firestore } from "firebase-admin/firestore";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LiveEventRecord {
  id: string;
  title: string;
  date: string;           // from Firestore — could be ISO string or human-readable
  venue?: string;
  city: string;
  generalPrice?: number;
  memberPrice?: number;   // memberPrice field (if set) — otherwise 15% off generalPrice
  isMembersOnly?: boolean;
  capacity?: number;
  ticketsRemaining?: number;
  soldOut?: boolean;
  status: string;
  description?: string;
  inclusions?: string[];
  imageUrl?: string;
}

// ── Module-level cache ────────────────────────────────────────────────────────

let _cache: LiveEventRecord[] | null = null;
let _cacheAt = 0;
const CACHE_TTL_MS = 90_000; // 90 seconds

export function invalidateEventCache() {
  _cache = null;
  _cacheAt = 0;
}

// ── Core fetcher ──────────────────────────────────────────────────────────────

export async function fetchLiveEvents(db: Firestore): Promise<LiveEventRecord[]> {
  const now = Date.now();
  if (_cache !== null && now - _cacheAt < CACHE_TTL_MS) {
    return _cache;
  }

  try {
    const snap = await db.collection("events").get();
    const events: LiveEventRecord[] = [];

    for (const doc of snap.docs) {
      const d = doc.data();
      // Include active events only — skip archived/draft
      if (d.status && d.status !== "active") continue;

      const memberPrice = d.memberPrice !== undefined
        ? Number(d.memberPrice)
        : d.generalPrice !== undefined && !d.noMemberDiscount
          ? Math.round(Number(d.generalPrice) * 0.85 * 100) / 100
          : undefined;

      events.push({
        id: doc.id,
        title: d.title ?? d.name ?? "Unnamed Event",
        date: d.date ?? d.eventDate ?? "Date TBD",
        venue: d.venue ?? d.location ?? undefined,
        city: d.city ?? "Winnipeg",
        generalPrice: d.generalPrice !== undefined ? Number(d.generalPrice) : undefined,
        memberPrice,
        isMembersOnly: d.isMembersOnly ?? false,
        capacity: d.capacity !== undefined ? Number(d.capacity) : undefined,
        ticketsRemaining: d.ticketsRemaining !== undefined ? Number(d.ticketsRemaining) : undefined,
        soldOut: d.soldOut ?? false,
        status: d.status ?? "active",
        description: d.description ?? undefined,
        inclusions: Array.isArray(d.inclusions) ? d.inclusions : undefined,
        imageUrl: d.imageUrl ?? undefined,
      });
    }

    // Sort by date ascending
    events.sort((a, b) => {
      const da = new Date(a.date).getTime() || 0;
      const db_ = new Date(b.date).getTime() || 0;
      return da - db_;
    });

    _cache = events;
    _cacheAt = now;
    return events;
  } catch (err) {
    console.warn("[event-knowledge] Firestore fetch failed:", String(err));
    return _cache ?? [];
  }
}

// ── System prompt block formatter ─────────────────────────────────────────────

export function formatEventKnowledgeBlock(events: LiveEventRecord[]): string {
  if (events.length === 0) return "";

  const lines: string[] = [
    "",
    "---",
    "",
    "## LIVE EVENT DATA — VERIFIED FROM DATABASE",
    "⚠ CRITICAL: The following event details are the ONLY authorised source of truth.",
    "NEVER invent, modify, or guess any event date, price, venue, ticket detail,",
    "or inclusion. If a user asks about an event NOT listed below, respond:",
    '  "I need to verify those details — could you confirm the event name?"',
    "Do NOT rely on prior training data or memory for event specifics.",
    "",
  ];

  for (const e of events) {
    lines.push(`### ${e.title}`);
    lines.push(`- **Date:** ${e.date}`);
    lines.push(`- **City:** ${e.city}`);
    if (e.venue) lines.push(`- **Venue:** ${e.venue}`);
    if (e.generalPrice !== undefined) lines.push(`- **General Price:** $${e.generalPrice} CAD`);
    if (e.memberPrice !== undefined) lines.push(`- **Member Price:** $${e.memberPrice} CAD (preferred pricing for supporters)`);
    lines.push(`- **Access:** ${e.isMembersOnly ? "Members only" : "Open to everyone — members receive preferred pricing"}`);
    if (e.soldOut) {
      lines.push(`- **Availability:** SOLD OUT`);
    } else if (e.ticketsRemaining !== undefined) {
      lines.push(`- **Tickets Remaining:** ${e.ticketsRemaining}`);
    }
    if (e.description) lines.push(`- **Description:** ${e.description}`);
    if (e.inclusions?.length) lines.push(`- **Inclusions:** ${e.inclusions.join(", ")}`);
    lines.push("");
  }

  lines.push("BRAND NOTE: ALL ACCESS Winnipeg events are community-first, premium, safe, and inclusive.");
  lines.push("Membership is how people go deeper and support the mission — not gatekeeping.");
  lines.push("Never use luxury-exclusive language. Always emphasise community, belonging, and access.");

  return lines.join("\n");
}

/**
 * Fetches live event data and returns a formatted system prompt block.
 * Returns empty string on error (fail-open — no crash).
 *
 * Should be called for: content, marketing, events, operator agents.
 */
export async function buildEventKnowledgeContext(db: Firestore): Promise<{
  block: string;
  eventCount: number;
}> {
  try {
    const events = await fetchLiveEvents(db);
    return {
      block: formatEventKnowledgeBlock(events),
      eventCount: events.length,
    };
  } catch {
    return { block: "", eventCount: 0 };
  }
}

/**
 * Returns true for agent roles that should receive event knowledge injection.
 */
export function agentNeedsEventKnowledge(role: string): boolean {
  return ["content", "marketing", "events", "creative", "operator"].includes(role);
}
