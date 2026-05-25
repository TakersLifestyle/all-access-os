"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getAuth } from "firebase/auth";
import type { Agent, SavedOutput, Conversation } from "@/lib/takers-ai/types";
import { AGENT_ROLE_LABELS } from "@/lib/takers-ai/types";

async function authFetch(path: string) {
  const token = await getAuth().currentUser?.getIdToken();
  const res = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

const QUICK_ACTIONS = [
  { label: "Write an event caption", icon: "✏️", href: "/takers-ai/chat?prompt=Write+3+Instagram+captions+for+our+next+event" },
  { label: "Draft a member email", icon: "📧", href: "/takers-ai/chat?prompt=Draft+a+member+newsletter+email" },
  { label: "Plan event logistics", icon: "📋", href: "/takers-ai/chat?prompt=Help+me+plan+logistics+for+an+upcoming+ALL+ACCESS+event" },
  { label: "Brand strategy session", icon: "🎯", href: "/takers-ai/chat?prompt=Let%27s+review+our+current+brand+strategy+for+ALL+ACCESS+Winnipeg" },
  { label: "Content calendar ideas", icon: "📅", href: "/takers-ai/chat?prompt=Give+me+30+content+ideas+for+TakersLifestyle+this+month" },
  { label: "Dev task prompt", icon: "⚙️", href: "/takers-ai/chat?prompt=Help+me+write+a+clear+implementation+prompt+for+a+Next.js+feature" },
];

export default function TakersAIDashboard() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [recentOutputs, setRecentOutputs] = useState<SavedOutput[]>([]);
  const [recentConvs, setRecentConvs] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [agentsData, outputsData, convsData] = await Promise.all([
        authFetch("/api/takers-ai/agents"),
        authFetch("/api/takers-ai/outputs"),
        authFetch("/api/takers-ai/conversations"),
      ]);
      setAgents(agentsData.agents ?? []);
      setRecentOutputs((outputsData.outputs ?? []).slice(0, 4));
      setRecentConvs((convsData.conversations ?? []).slice(0, 5));
    } catch {
      // Agents might not be seeded yet — silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const defaultAgent = agents.find((a) => a.isDefault) ?? agents[0];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-8 py-8 space-y-8">

        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-600/20 border border-red-600/40 flex items-center justify-center text-red-400 text-lg">
              ◎
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Takers AI Command Center</h1>
              <p className="text-white/30 text-sm">Your AI operator team for TakersLifestyle &amp; ALL ACCESS Winnipeg</p>
            </div>
          </div>
        </div>

        {/* No agents — setup prompt */}
        {!loading && agents.length === 0 && (
          <div className="bg-amber-950/30 border border-amber-500/25 rounded-2xl px-6 py-5 flex items-start gap-4">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="text-amber-300 font-semibold">No agents seeded yet</p>
              <p className="text-amber-300/60 text-sm mt-1">
                Run the seed script to initialize Takers Operator and brand memory:
              </p>
              <code className="block mt-2 text-xs bg-black/30 rounded px-3 py-2 text-emerald-300 font-mono">
                cd ~/all-access-platform/functions &amp;&amp; node ../scripts/seed-takers-ai.mjs
              </code>
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-white/25 mb-3">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {QUICK_ACTIONS.map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className="group flex items-center gap-3 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.07] hover:border-red-600/30 rounded-xl px-4 py-3 transition"
              >
                <span className="text-xl">{action.icon}</span>
                <span className="text-sm text-white/60 group-hover:text-white/80 transition">{action.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Active agents */}
        {agents.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold uppercase tracking-widest text-white/25">Active Agents</h2>
              <Link href="/takers-ai/settings" className="text-xs text-white/30 hover:text-white/60 transition">
                Manage →
              </Link>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {agents.filter((a) => a.isActive).map((agent) => (
                <Link
                  key={agent.id}
                  href={`/takers-ai/chat?agentId=${agent.id}`}
                  className="group flex items-start gap-3 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.07] hover:border-white/15 rounded-xl p-4 transition"
                >
                  <div className={`w-9 h-9 rounded-lg ${agent.color} bg-opacity-20 border border-white/10 flex items-center justify-center text-xl shrink-0`}>
                    {agent.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white/80 text-sm font-semibold group-hover:text-white transition truncate">{agent.name}</p>
                    <p className="text-white/30 text-xs truncate">{AGENT_ROLE_LABELS[agent.role]}</p>
                    {agent.isDefault && (
                      <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-red-600/20 border border-red-600/25 text-red-400 font-bold">
                        DEFAULT
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Two-col: Recent convs + Recent outputs */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Recent conversations */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold uppercase tracking-widest text-white/25">Recent Conversations</h2>
              <Link href="/takers-ai/chat" className="text-xs text-white/30 hover:text-white/60 transition">
                New chat →
              </Link>
            </div>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-white/5 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : recentConvs.length === 0 ? (
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-8 text-center text-white/20 text-sm">
                No conversations yet. Start chatting.
              </div>
            ) : (
              <div className="space-y-1.5">
                {recentConvs.map((conv) => (
                  <Link
                    key={conv.id}
                    href={`/takers-ai/chat?convId=${conv.id}`}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] hover:border-white/10 transition group"
                  >
                    <span className="text-white/20 text-xs shrink-0">◎</span>
                    <div className="min-w-0">
                      <p className="text-white/60 text-xs truncate group-hover:text-white/80 transition">{conv.title}</p>
                      <p className="text-white/20 text-[10px] truncate">{new Date(conv.updatedAt).toLocaleDateString()}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Recent saved outputs */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold uppercase tracking-widest text-white/25">Saved Outputs</h2>
              <Link href="/takers-ai/outputs" className="text-xs text-white/30 hover:text-white/60 transition">
                View all →
              </Link>
            </div>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-white/5 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : recentOutputs.length === 0 ? (
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-8 text-center text-white/20 text-sm">
                No saved outputs yet. Save responses from chat.
              </div>
            ) : (
              <div className="space-y-1.5">
                {recentOutputs.map((output) => (
                  <Link
                    key={output.id}
                    href="/takers-ai/outputs"
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] hover:border-white/10 transition group"
                  >
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/30 uppercase tracking-wider font-bold shrink-0">
                      {output.type}
                    </span>
                    <div className="min-w-0">
                      <p className="text-white/60 text-xs truncate group-hover:text-white/80 transition">{output.title}</p>
                      <p className="text-white/20 text-[10px]">{new Date(output.createdAt).toLocaleDateString()}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Start button */}
        {defaultAgent && (
          <div className="text-center pt-4">
            <Link
              href={`/takers-ai/chat?agentId=${defaultAgent.id}`}
              className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold px-8 py-3.5 rounded-xl transition text-sm"
            >
              <span>◎</span>
              Start with {defaultAgent.name}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
