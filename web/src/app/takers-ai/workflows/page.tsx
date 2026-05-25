"use client";

import { useEffect, useState, useCallback } from "react";
import { getAuth } from "firebase/auth";
import type { WorkflowRun, WorkflowStatus, AgentRole } from "@/lib/takers-ai/types";
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

const STATUS_STYLES: Record<WorkflowStatus, string> = {
  routing: "bg-amber-600/15 border-amber-600/25 text-amber-300",
  processing: "bg-blue-600/15 border-blue-600/25 text-blue-300",
  complete: "bg-emerald-600/15 border-emerald-600/25 text-emerald-300",
  failed: "bg-red-600/15 border-red-600/25 text-red-300",
};

const STATUS_DOTS: Record<WorkflowStatus, string> = {
  routing: "bg-amber-400 animate-pulse",
  processing: "bg-blue-400 animate-pulse",
  complete: "bg-emerald-400",
  failed: "bg-red-400",
};

function RunCard({ run, onDelete }: { run: WorkflowRun; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const role = run.routedToRole as AgentRole;
  const color = AGENT_ROLE_COLORS[role] ?? "bg-white/10";
  const icon = AGENT_ROLE_ICONS[role] ?? "◎";

  const duration = run.completedAt && run.startedAt
    ? Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)
    : null;

  return (
    <div className={`border rounded-xl overflow-hidden transition ${
      run.status === "complete" ? "border-white/[0.07] bg-white/[0.02]" :
      run.status === "failed" ? "border-red-600/15 bg-red-950/10" :
      "border-white/[0.05] bg-white/[0.01]"
    }`}>
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Status dot */}
        <div className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOTS[run.status as WorkflowStatus]}`} />

        {/* Route: Operator → Specialist */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-white/20 text-xs">◎</span>
          <span className="text-white/15 text-xs">→</span>
          <span className={`text-base`}>{icon}</span>
          <span className="text-white/50 text-xs font-medium">{AGENT_ROLE_LABELS[role]}</span>
        </div>

        {/* Message preview */}
        <p className="flex-1 text-white/40 text-xs truncate min-w-0">
          {run.userMessage}
        </p>

        {/* Meta */}
        <div className="flex items-center gap-3 shrink-0">
          {duration !== null && (
            <span className="text-white/20 text-[10px]">{duration}s</span>
          )}
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${STATUS_STYLES[run.status as WorkflowStatus]}`}>
            {run.status}
          </span>
          <span className="text-white/15 text-[10px]">
            {new Date(run.startedAt).toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" })}
          </span>
          <span className={`text-white/20 text-xs transition-transform ${expanded ? "rotate-180" : ""}`}>▾</span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-white/[0.05] px-4 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-white/25 text-[10px] uppercase tracking-wider font-bold">Routing reason</p>
              <p className="text-white/60 text-xs">{run.routingReason}</p>
            </div>
            <div className="space-y-1">
              <p className="text-white/25 text-[10px] uppercase tracking-wider font-bold">Conversation</p>
              <p className="text-white/40 text-xs font-mono">{run.conversationId?.slice(0, 16) ?? "—"}…</p>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-white/25 text-[10px] uppercase tracking-wider font-bold">User message</p>
            <p className="text-white/60 text-xs bg-black/20 rounded-lg px-3 py-2">{run.userMessage}</p>
          </div>
          {run.errorMessage && (
            <div className="bg-red-950/30 border border-red-600/20 rounded-lg px-3 py-2">
              <p className="text-red-400 text-xs">{run.errorMessage}</p>
            </div>
          )}
          <div className="flex items-center gap-3 pt-1">
            <span className="text-white/15 text-[10px]">
              Started {new Date(run.startedAt).toLocaleString("en-CA")}
            </span>
            {run.completedAt && (
              <span className="text-white/15 text-[10px]">
                · Completed {new Date(run.completedAt).toLocaleString("en-CA")}
              </span>
            )}
            <button onClick={() => onDelete(run.id)}
              className="ml-auto text-xs text-white/15 hover:text-red-400 transition">
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WorkflowsPage() {
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<WorkflowStatus | "all">("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await authFetch("/api/takers-ai/workflows?limit=100");
      setRuns(data.runs ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this workflow run?")) return;
    await authFetch(`/api/takers-ai/workflows?id=${id}`, { method: "DELETE" });
    setRuns((prev) => prev.filter((r) => r.id !== id));
  }

  const filtered = filter === "all" ? runs : runs.filter((r) => r.status === filter);

  // Stats
  const total = runs.length;
  const complete = runs.filter((r) => r.status === "complete").length;
  const failed = runs.filter((r) => r.status === "failed").length;

  // Role distribution
  const roleCounts: Partial<Record<AgentRole, number>> = {};
  for (const run of runs) {
    roleCounts[run.routedToRole as AgentRole] = (roleCounts[run.routedToRole as AgentRole] ?? 0) + 1;
  }
  const topRoles = Object.entries(roleCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4) as [AgentRole, number][];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">Workflow Pipeline</h1>
            <p className="text-white/30 text-sm mt-0.5">Every Operator routing decision logged here in real time.</p>
          </div>
          <button onClick={load} disabled={loading}
            className="text-xs px-3 py-1.5 border border-white/10 hover:border-white/25 rounded-lg text-white/40 hover:text-white transition disabled:opacity-40">
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <p className="text-white/25 text-[10px] uppercase tracking-wider mb-1">Total Runs</p>
            <p className="text-white text-xl font-bold">{total}</p>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <p className="text-white/25 text-[10px] uppercase tracking-wider mb-1">Completed</p>
            <p className="text-emerald-400 text-xl font-bold">{complete}</p>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <p className="text-white/25 text-[10px] uppercase tracking-wider mb-1">Failed</p>
            <p className="text-red-400 text-xl font-bold">{failed}</p>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <p className="text-white/25 text-[10px] uppercase tracking-wider mb-1">Success Rate</p>
            <p className="text-white text-xl font-bold">
              {total > 0 ? Math.round((complete / total) * 100) : 0}%
            </p>
          </div>
        </div>

        {/* Top routed agents */}
        {topRoles.length > 0 && (
          <div className="flex gap-3 flex-wrap">
            <span className="text-white/25 text-xs self-center">Most routed:</span>
            {topRoles.map(([role, count]) => (
              <span key={role} className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-white/10 ${AGENT_ROLE_COLORS[role]} bg-opacity-10 text-white/50`}>
                {AGENT_ROLE_ICONS[role]} {role} <span className="text-white/25">({count})</span>
              </span>
            ))}
          </div>
        )}

        {/* Filter */}
        <div className="flex gap-2 flex-wrap">
          {(["all", "complete", "failed", "processing", "routing"] as const).map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition capitalize ${
                filter === s ? "bg-red-600/20 border-red-600/30 text-red-300" : "border-white/10 text-white/30 hover:text-white/60"
              }`}>
              {s === "all" ? "All" : s}
              {s !== "all" && <span className="ml-1 text-white/20">({runs.filter((r) => r.status === s).length})</span>}
            </button>
          ))}
        </div>

        {/* Run list */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-14 bg-white/5 rounded-xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-white/20">
            {total === 0
              ? "No workflow runs yet. Send a message to the Takers Operator to see routing in action."
              : "No runs match this filter."}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((run) => (
              <RunCard key={run.id} run={run} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
