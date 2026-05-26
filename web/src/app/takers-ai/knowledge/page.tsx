"use client";

// Takers AI — Knowledge Center
// /takers-ai/knowledge
// Admin visibility into: provider status, event facts, brand memory, agent config
// Shows exactly what every AI agent knows and where the gaps are.

import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";

async function getToken() {
  return (await getAuth().currentUser?.getIdToken()) ?? "";
}

interface StatusData {
  providers: {
    image: string;
    imageConnected: boolean;
    anthropicConnected: boolean;
  };
  events: Array<{
    id: string;
    title: string;
    date: string;
    venue: string | null;
    generalPrice: number | null;
    memberPrice: number | null;
    status: string;
    capacity: number | null;
    ticketsRemaining: number | null;
    isMembersOnly: boolean;
  }>;
  memoryBlocks: Array<{
    id: string;
    key: string;
    title: string;
    category: string;
    priority: number;
    isActive: boolean;
    contentLength: number;
    updatedAt: string;
  }>;
  agents: Array<{
    id: string;
    name: string;
    role: string;
    model: string;
    maxTokens: number;
    isDefault: boolean;
    isActive: boolean;
  }>;
  warnings: string[];
  timestamp: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  openai: "DALL-E 3 (OpenAI)",
  replicate: "Flux (Replicate)",
  stability: "Stability AI",
  mock: "Mock (not connected)",
};

const STATUS_COLORS: Record<string, string> = {
  active: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  coming_soon: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  archived: "text-white/30 bg-white/5 border-white/10",
  draft: "text-white/30 bg-white/5 border-white/10",
};

const CATEGORY_COLORS: Record<string, string> = {
  brandVoice: "text-red-300 bg-red-600/10 border-red-600/20",
  eventStandards: "text-purple-300 bg-purple-600/10 border-purple-600/20",
  communityRules: "text-amber-300 bg-amber-600/10 border-amber-600/20",
  pricingStrategy: "text-emerald-300 bg-emerald-600/10 border-emerald-600/20",
  contentFrameworks: "text-pink-300 bg-pink-600/10 border-pink-600/20",
  audienceProfiles: "text-blue-300 bg-blue-600/10 border-blue-600/20",
  operationalSOPs: "text-cyan-300 bg-cyan-600/10 border-cyan-600/20",
  bannedPhrases: "text-orange-300 bg-orange-600/10 border-orange-600/20",
};

const MODEL_COLORS: Record<string, string> = {
  "claude-opus-4-5": "text-purple-300",
  "claude-sonnet-4-5": "text-blue-300",
  "claude-haiku-4-5": "text-green-300",
};

export default function KnowledgeCenterPage() {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchStatus() {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch("/api/takers-ai/status", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load status");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchStatus(); }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-white/20 text-sm animate-pulse">Loading knowledge status…</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-red-400 text-sm">{error ?? "No data"}</div>
      </div>
    );
  }

  const activeEvents = data.events.filter((e) => e.status === "active");
  const comingSoonEvents = data.events.filter((e) => e.status === "coming_soon");

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-white font-bold text-xl">Knowledge Center</h1>
            <p className="text-white/30 text-sm mt-1">
              What every AI agent knows right now. Fix gaps before they cause wrong answers.
            </p>
          </div>
          <button
            onClick={fetchStatus}
            className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-white/40 hover:text-white/70 hover:border-white/20 transition"
          >
            ↺ Refresh
          </button>
        </div>

        {/* Warnings */}
        {data.warnings.length > 0 && (
          <div className="space-y-2">
            {data.warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-500/[0.08] border border-amber-500/20 text-amber-300 text-sm">
                <span className="mt-0.5 shrink-0">⚠</span>
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        {/* Provider Status */}
        <section className="space-y-3">
          <h2 className="text-white/50 text-xs font-bold uppercase tracking-widest">Provider Status</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* AI provider */}
            <div className={`rounded-xl border p-4 ${data.providers.anthropicConnected ? "border-emerald-500/25 bg-emerald-500/[0.05]" : "border-red-500/25 bg-red-500/[0.05]"}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${data.providers.anthropicConnected ? "bg-emerald-400" : "bg-red-400"}`} />
                <span className="text-white/50 text-xs font-medium">AI (Anthropic)</span>
              </div>
              <p className={`text-sm font-bold ${data.providers.anthropicConnected ? "text-emerald-300" : "text-red-300"}`}>
                {data.providers.anthropicConnected ? "✓ Connected" : "✗ No ANTHROPIC_API_KEY"}
              </p>
            </div>

            {/* Image provider */}
            <div className={`rounded-xl border p-4 ${data.providers.imageConnected ? "border-emerald-500/25 bg-emerald-500/[0.05]" : "border-amber-500/25 bg-amber-500/[0.05]"}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${data.providers.imageConnected ? "bg-emerald-400" : "bg-amber-400 animate-pulse"}`} />
                <span className="text-white/50 text-xs font-medium">Image Generation</span>
              </div>
              <p className={`text-sm font-bold ${data.providers.imageConnected ? "text-emerald-300" : "text-amber-300"}`}>
                {PROVIDER_LABELS[data.providers.image] ?? data.providers.image}
              </p>
              {!data.providers.imageConnected && (
                <p className="text-amber-400/60 text-[10px] mt-1">Add OPENAI_API_KEY to Vercel</p>
              )}
            </div>

            {/* Counts */}
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
              <p className="text-white/30 text-xs mb-2">System</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-white/40">Active events</span>
                  <span className="text-white/70 font-mono">{activeEvents.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Memory blocks</span>
                  <span className="text-white/70 font-mono">{data.memoryBlocks.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Active agents</span>
                  <span className="text-white/70 font-mono">{data.agents.length}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Active Events */}
        <section className="space-y-3">
          <h2 className="text-white/50 text-xs font-bold uppercase tracking-widest">
            Active Events — Verified Source of Truth
          </h2>
          {activeEvents.length === 0 ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/[0.05] px-4 py-3 text-red-400 text-sm">
              No active events found in Firestore. Agents will use placeholders.
            </div>
          ) : (
            <div className="space-y-3">
              {activeEvents.map((event) => (
                <div key={event.id} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-white/80 font-medium text-sm">{event.title}</h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[event.status] ?? STATUS_COLORS.active}`}>
                          {event.status}
                        </span>
                        {event.isMembersOnly && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full border border-violet-500/25 bg-violet-500/10 text-violet-300">
                            Members only
                          </span>
                        )}
                      </div>
                      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1 text-xs">
                        <div>
                          <span className="text-white/30">Date</span>
                          <p className={`font-mono mt-0.5 ${event.date === "TBD" ? "text-amber-400" : "text-white/70"}`}>
                            {event.date}
                          </p>
                        </div>
                        <div>
                          <span className="text-white/30">Venue</span>
                          <p className="text-white/70 mt-0.5 truncate">{event.venue ?? <span className="text-amber-400/70">TBD</span>}</p>
                        </div>
                        <div>
                          <span className="text-white/30">Price</span>
                          <p className="text-white/70 font-mono mt-0.5">
                            {event.generalPrice != null ? `$${event.generalPrice} CAD` : <span className="text-amber-400/70">TBD</span>}
                            {event.memberPrice != null && event.memberPrice !== event.generalPrice && (
                              <span className="text-emerald-400/70 ml-1">(M: ${event.memberPrice})</span>
                            )}
                          </p>
                        </div>
                        <div>
                          <span className="text-white/30">Tickets</span>
                          <p className="text-white/70 font-mono mt-0.5">
                            {event.ticketsRemaining != null ? `${event.ticketsRemaining} / ${event.capacity ?? "?"}` : "TBD"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {comingSoonEvents.length > 0 && (
            <div className="space-y-2">
              <p className="text-white/20 text-xs">Coming Soon</p>
              {comingSoonEvents.map((event) => (
                <div key={event.id} className="rounded-lg border border-white/[0.05] bg-white/[0.01] px-4 py-2.5 flex items-center justify-between text-xs">
                  <span className="text-white/40">{event.title}</span>
                  <span className="text-amber-400/50">{event.date}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Brand Memory */}
        <section className="space-y-3">
          <h2 className="text-white/50 text-xs font-bold uppercase tracking-widest">
            Brand Memory — Active Blocks ({data.memoryBlocks.length})
          </h2>
          <div className="space-y-2">
            {data.memoryBlocks.map((block) => (
              <div key={block.id} className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-4 py-3 flex items-center gap-4">
                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-xs font-bold text-white/30 shrink-0">
                  P{block.priority}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white/70 text-xs font-medium">{block.title}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${CATEGORY_COLORS[block.category] ?? "text-white/30 bg-white/5 border-white/10"}`}>
                      {block.category}
                    </span>
                  </div>
                  <p className="text-white/25 text-[10px] mt-0.5">
                    {block.contentLength.toLocaleString()} chars · {block.key}
                  </p>
                </div>
                <div className={`w-2 h-2 rounded-full shrink-0 ${block.isActive ? "bg-emerald-400" : "bg-white/20"}`} />
              </div>
            ))}
          </div>
          {data.memoryBlocks.length === 0 && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/[0.05] px-4 py-3 text-red-400 text-sm">
              No active brand memory. Run <code>seed-brand-knowledge.mjs</code> from functions/.
            </div>
          )}
        </section>

        {/* Agents */}
        <section className="space-y-3">
          <h2 className="text-white/50 text-xs font-bold uppercase tracking-widest">Active Agents</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.agents.map((agent) => (
              <div key={agent.id} className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white/70 text-xs font-medium">{agent.name}</span>
                    {agent.isDefault && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-red-500/25 bg-red-500/10 text-red-300">default</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[10px]">
                    <span className="text-white/30">{agent.role}</span>
                    <span className={`font-mono ${MODEL_COLORS[agent.model] ?? "text-white/30"}`}>{agent.model}</span>
                    <span className="text-white/20">{agent.maxTokens?.toLocaleString()} tok</span>
                  </div>
                </div>
                <div className={`w-2 h-2 rounded-full ${agent.isActive ? "bg-emerald-400" : "bg-white/20"}`} />
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <div className="text-white/15 text-[10px] text-center pb-4">
          Last updated: {new Date(data.timestamp).toLocaleString("en-CA")}
        </div>

      </div>
    </div>
  );
}
