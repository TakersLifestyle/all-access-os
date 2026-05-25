"use client";

import { useEffect, useState, useCallback } from "react";
import { getAuth } from "firebase/auth";
import type { FeedbackLog, AgentRole } from "@/lib/takers-ai/types";
import { AGENT_ROLE_LABELS, AGENT_ROLE_COLORS, AGENT_ROLE_ICONS } from "@/lib/takers-ai/types";

async function authFetch(path: string, opts: RequestInit = {}) {
  const token = await getAuth().currentUser?.getIdToken();
  const res = await fetch(path, {
    ...opts,
    headers: { ...((opts.headers as Record<string, string>) ?? {}), Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function FeedbackPage() {
  const [logs, setLogs] = useState<FeedbackLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "positive" | "negative">("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await authFetch("/api/takers-ai/feedback");
      setLogs(data.logs ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string) {
    await authFetch(`/api/takers-ai/feedback?id=${id}`, { method: "DELETE" });
    setLogs((prev) => prev.filter((l) => l.id !== id));
  }

  const total = logs.length;
  const positive = logs.filter((l) => l.rating === "positive").length;
  const negative = logs.filter((l) => l.rating === "negative").length;
  const score = total > 0 ? Math.round((positive / total) * 100) : 0;

  // Unique agents in feedback
  const agentNames = [...new Set(logs.map((l) => l.agentName))].filter(Boolean);

  const filtered = logs.filter((l) => {
    const ratingMatch = filter === "all" || l.rating === filter;
    const agentMatch = agentFilter === "all" || l.agentName === agentFilter;
    return ratingMatch && agentMatch;
  });

  // Per-agent breakdown
  const agentBreakdown: Record<string, { positive: number; negative: number; role: AgentRole }> = {};
  for (const log of logs) {
    if (!agentBreakdown[log.agentName]) {
      agentBreakdown[log.agentName] = { positive: 0, negative: 0, role: log.agentRole };
    }
    agentBreakdown[log.agentName][log.rating]++;
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">Feedback Log</h1>
            <p className="text-white/30 text-sm mt-0.5">
              Admin ratings on agent responses. Used to identify which agents need instruction updates.
            </p>
          </div>
          <button onClick={load} disabled={loading}
            className="text-xs px-3 py-1.5 border border-white/10 hover:border-white/25 rounded-lg text-white/40 hover:text-white transition disabled:opacity-40">
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>

        {/* Overall stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <p className="text-white/25 text-[10px] uppercase tracking-wider mb-1">Total Feedback</p>
            <p className="text-white text-xl font-bold">{total}</p>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <p className="text-white/25 text-[10px] uppercase tracking-wider mb-1">Positive</p>
            <p className="text-emerald-400 text-xl font-bold">👍 {positive}</p>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <p className="text-white/25 text-[10px] uppercase tracking-wider mb-1">Negative</p>
            <p className="text-red-400 text-xl font-bold">👎 {negative}</p>
          </div>
          <div className={`border rounded-xl p-4 ${
            score >= 80 ? "bg-emerald-950/20 border-emerald-600/20" :
            score >= 50 ? "bg-amber-950/20 border-amber-600/20" :
            "bg-red-950/20 border-red-600/20"
          }`}>
            <p className="text-white/25 text-[10px] uppercase tracking-wider mb-1">Approval Score</p>
            <p className={`text-xl font-bold ${score >= 80 ? "text-emerald-400" : score >= 50 ? "text-amber-400" : "text-red-400"}`}>
              {score}%
            </p>
          </div>
        </div>

        {/* Per-agent breakdown */}
        {Object.keys(agentBreakdown).length > 0 && (
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-white/25 mb-3">By Agent</h2>
            <div className="grid md:grid-cols-2 gap-2">
              {Object.entries(agentBreakdown).map(([name, { positive: pos, negative: neg, role }]) => {
                const total = pos + neg;
                const pct = total > 0 ? Math.round((pos / total) * 100) : 0;
                return (
                  <div key={name} className="flex items-center gap-3 bg-white/[0.02] border border-white/[0.05] rounded-xl px-4 py-3">
                    <span className="text-xl">{AGENT_ROLE_ICONS[role] ?? "◎"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white/60 text-xs font-medium">{name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-white/30 text-[10px] shrink-0">{pct}%</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-emerald-400 text-xs">👍{pos}</span>
                      <span className="text-white/20 text-xs mx-1">·</span>
                      <span className="text-red-400 text-xs">👎{neg}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2 flex-wrap items-center">
          <div className="flex gap-2">
            {(["all", "positive", "negative"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition capitalize ${
                  filter === f ? "bg-red-600/20 border-red-600/30 text-red-300" : "border-white/10 text-white/30 hover:text-white/60"
                }`}>
                {f === "positive" ? "👍 Positive" : f === "negative" ? "👎 Negative" : "All"}
              </button>
            ))}
          </div>
          {agentNames.length > 0 && (
            <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)}
              className="ml-2 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/50 focus:outline-none">
              <option value="all" className="bg-[#13131f]">All agents</option>
              {agentNames.map((name) => (
                <option key={name} value={name} className="bg-[#13131f]">{name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Log list */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-white/20">
            {total === 0
              ? "No feedback yet. Use the 👍👎 buttons on any chat response."
              : "No feedback matches this filter."}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((log) => (
              <div key={log.id} className={`border rounded-xl p-4 space-y-2 ${
                log.rating === "positive"
                  ? "bg-emerald-950/10 border-emerald-600/15"
                  : "bg-red-950/10 border-red-600/15"
              }`}>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xl">{log.rating === "positive" ? "👍" : "👎"}</span>
                  <span className="text-xl">{AGENT_ROLE_ICONS[log.agentRole] ?? "◎"}</span>
                  <span className="text-white/60 text-sm font-medium">{log.agentName}</span>
                  <span className="text-white/20 text-xs">{new Date(log.createdAt).toLocaleString("en-CA")}</span>
                  <button onClick={() => handleDelete(log.id)}
                    className="ml-auto text-white/15 hover:text-red-400 text-xs transition">
                    ✕
                  </button>
                </div>
                <div className="bg-black/20 rounded-lg px-3 py-2">
                  <p className="text-white/50 text-xs line-clamp-3">{log.messageContent}</p>
                </div>
                {log.comment && (
                  <div className="bg-white/[0.03] rounded-lg px-3 py-2">
                    <p className="text-white/40 text-xs">Comment: <span className="text-white/60">{log.comment}</span></p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
