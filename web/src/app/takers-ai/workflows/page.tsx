"use client";

import { useEffect, useState, useCallback } from "react";
import { getAuth } from "firebase/auth";
import type {
  WorkflowRun,
  WorkflowStatus,
  WorkflowDefinition,
  AgentRole,
} from "@/lib/takers-ai/types";
import {
  AGENT_ROLE_LABELS,
  AGENT_ROLE_COLORS,
  AGENT_ROLE_ICONS,
} from "@/lib/takers-ai/types";

async function authFetch(path: string, opts: RequestInit = {}) {
  const token = await getAuth().currentUser?.getIdToken();
  const res = await fetch(path, {
    ...opts,
    headers: { ...((opts.headers as Record<string, string>) ?? {}), Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function fmtTokens(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

const STATUS_STYLES: Record<WorkflowStatus, string> = {
  routing:    "bg-amber-600/15 border-amber-600/25 text-amber-300",
  processing: "bg-blue-600/15 border-blue-600/25 text-blue-300",
  complete:   "bg-emerald-600/15 border-emerald-600/25 text-emerald-300",
  failed:     "bg-red-600/15 border-red-600/25 text-red-300",
};

const STATUS_DOTS: Record<WorkflowStatus, string> = {
  routing:    "bg-amber-400 animate-pulse",
  processing: "bg-blue-400 animate-pulse",
  complete:   "bg-emerald-400",
  failed:     "bg-red-400",
};

// ── Workflow Definition Card ──────────────────────────────────────────────────
function DefinitionCard({ def }: { def: WorkflowDefinition }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white/[0.02] border border-white/[0.07] rounded-xl overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-white/[0.02] transition"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="text-xl shrink-0">{def.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-white/80 text-sm font-semibold">{def.name}</p>
            <span className="text-[10px] text-white/20 border border-white/10 rounded px-1.5 py-0.5">
              {def.steps.length} steps
            </span>
            {def.approvalCount > 0 && (
              <span className="text-[10px] text-amber-300 border border-amber-600/25 bg-amber-600/10 rounded px-1.5 py-0.5">
                {def.approvalCount} approval{def.approvalCount > 1 ? "s" : ""}
              </span>
            )}
            {!def.isActive && (
              <span className="text-[10px] text-white/20 border border-white/10 rounded px-1.5 py-0.5">inactive</span>
            )}
          </div>
          <p className="text-white/30 text-xs mt-0.5 truncate">{def.description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-white/20 text-[10px]">~{def.estimatedMinutes}m</span>
          <span className={`text-white/20 text-xs transition-transform ${expanded ? "rotate-180" : ""}`}>▾</span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-white/[0.05] px-4 py-4 space-y-3">
          {/* Step timeline */}
          <div className="space-y-2">
            {def.steps
              .sort((a, b) => a.order - b.order)
              .map((step, i) => (
                <div key={step.id} className="flex items-start gap-3">
                  <div className="flex flex-col items-center gap-0 shrink-0">
                    <div className="w-5 h-5 rounded-full bg-white/10 border border-white/15 flex items-center justify-center">
                      <span className="text-[9px] text-white/50">{i + 1}</span>
                    </div>
                    {i < def.steps.length - 1 && (
                      <div className="w-px flex-1 min-h-[12px] bg-white/[0.06] my-0.5" />
                    )}
                  </div>
                  <div className="flex-1 pb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm">{AGENT_ROLE_ICONS[step.agentRole as AgentRole] ?? "◎"}</span>
                      <span className="text-white/60 text-xs font-medium">{step.name}</span>
                      <span className="text-[10px] text-white/25">
                        {AGENT_ROLE_LABELS[step.agentRole as AgentRole]}
                      </span>
                      {step.requiresApproval && (
                        <span className="text-[10px] text-amber-300 border border-amber-600/25 bg-amber-600/10 rounded px-1 py-0.5">
                          approval required
                        </span>
                      )}
                    </div>
                    {step.description && (
                      <p className="text-white/25 text-[10px] mt-0.5">{step.description}</p>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Workflow Run Card ─────────────────────────────────────────────────────────
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
      run.status === "failed"   ? "border-red-600/15 bg-red-950/10" :
                                  "border-white/[0.05] bg-white/[0.01]"
    }`}>
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOTS[run.status as WorkflowStatus]}`} />

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-white/20 text-xs">◎</span>
          <span className="text-white/15 text-xs">→</span>
          <span className="text-base">{icon}</span>
          <span className="text-white/50 text-xs font-medium">{AGENT_ROLE_LABELS[role]}</span>
        </div>

        {/* Confidence badge */}
        {run.routingConfidence != null && (
          <span className={`text-[10px] font-bold shrink-0 ${
            run.routingConfidence >= 80 ? "text-emerald-400" :
            run.routingConfidence >= 60 ? "text-amber-400" : "text-red-400"
          }`}>
            {run.routingConfidence}%
          </span>
        )}

        <p className="flex-1 text-white/40 text-xs truncate min-w-0">{run.userMessage}</p>

        <div className="flex items-center gap-3 shrink-0">
          {run.tokenUsage?.totalTokens && (
            <span className="text-white/15 text-[10px]">{fmtTokens(run.tokenUsage.totalTokens)}t</span>
          )}
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
              <p className="text-white/25 text-[10px] uppercase tracking-wider font-bold">Confidence</p>
              <p className={`text-xs font-bold ${
                (run.routingConfidence ?? 0) >= 80 ? "text-emerald-400" :
                (run.routingConfidence ?? 0) >= 60 ? "text-amber-400" : "text-red-400"
              }`}>
                {run.routingConfidence != null ? `${run.routingConfidence}%` : "—"}
              </p>
            </div>
            {run.alternativeRoles?.length ? (
              <div className="space-y-1">
                <p className="text-white/25 text-[10px] uppercase tracking-wider font-bold">Alternatives considered</p>
                <p className="text-white/40 text-xs">
                  {run.alternativeRoles.map((r) => AGENT_ROLE_LABELS[r]).join(", ")}
                </p>
              </div>
            ) : null}
            {run.tokenUsage && (
              <div className="space-y-1">
                <p className="text-white/25 text-[10px] uppercase tracking-wider font-bold">Token usage</p>
                <p className="text-white/40 text-xs">
                  {fmtTokens(run.tokenUsage.inputTokens)} in · {fmtTokens(run.tokenUsage.outputTokens)} out
                  {run.tokenUsage.routingInputTokens
                    ? ` · ${fmtTokens((run.tokenUsage.routingInputTokens ?? 0) + (run.tokenUsage.routingOutputTokens ?? 0))} routing`
                    : ""}
                </p>
              </div>
            )}
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
            <button
              onClick={() => onDelete(run.id)}
              className="ml-auto text-xs text-white/15 hover:text-red-400 transition"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function WorkflowsPage() {
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [definitions, setDefinitions] = useState<WorkflowDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [defsLoading, setDefsLoading] = useState(true);
  const [filter, setFilter] = useState<WorkflowStatus | "all">("all");
  const [tab, setTab] = useState<"runs" | "definitions">("runs");

  const loadRuns = useCallback(async () => {
    setLoading(true);
    try {
      const data = await authFetch("/api/takers-ai/workflows?limit=100");
      setRuns(data.runs ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDefs = useCallback(async () => {
    setDefsLoading(true);
    try {
      const data = await authFetch("/api/takers-ai/workflow-definitions");
      setDefinitions(data.definitions ?? []);
    } finally {
      setDefsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRuns();
    loadDefs();
  }, [loadRuns, loadDefs]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this workflow run?")) return;
    await authFetch(`/api/takers-ai/workflows?id=${id}`, { method: "DELETE" });
    setRuns((prev) => prev.filter((r) => r.id !== id));
  }

  const filtered = filter === "all" ? runs : runs.filter((r) => r.status === filter);
  const total = runs.length;
  const complete = runs.filter((r) => r.status === "complete").length;
  const failed = runs.filter((r) => r.status === "failed").length;
  const totalTokens = runs.reduce((s, r) => s + (r.tokenUsage?.totalTokens ?? 0), 0);
  const avgConfidence = runs.filter((r) => r.routingConfidence != null).length > 0
    ? Math.round(
        runs.reduce((s, r) => s + (r.routingConfidence ?? 0), 0) /
        runs.filter((r) => r.routingConfidence != null).length
      )
    : null;

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
            <p className="text-white/30 text-sm mt-0.5">
              Reusable workflow definitions and live routing run history.
            </p>
          </div>
          <button onClick={() => { loadRuns(); loadDefs(); }} disabled={loading}
            className="text-xs px-3 py-1.5 border border-white/10 hover:border-white/25 rounded-lg text-white/40 hover:text-white transition disabled:opacity-40">
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
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
            <p className="text-white/25 text-[10px] uppercase tracking-wider mb-1">Avg Confidence</p>
            <p className={`text-xl font-bold ${
              avgConfidence == null ? "text-white/30" :
              avgConfidence >= 80 ? "text-emerald-400" :
              avgConfidence >= 60 ? "text-amber-400" : "text-red-400"
            }`}>
              {avgConfidence != null ? `${avgConfidence}%` : "—"}
            </p>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <p className="text-white/25 text-[10px] uppercase tracking-wider mb-1">Tokens Used</p>
            <p className="text-blue-400 text-xl font-bold">{totalTokens > 0 ? fmtTokens(totalTokens) : "—"}</p>
          </div>
        </div>

        {/* Top routed agents */}
        {topRoles.length > 0 && (
          <div className="flex gap-3 flex-wrap items-center">
            <span className="text-white/25 text-xs">Most routed:</span>
            {topRoles.map(([role, count]) => (
              <span key={role} className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-white/10 text-white/50`}>
                {AGENT_ROLE_ICONS[role]} {role} <span className="text-white/25">({count})</span>
              </span>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 border-b border-white/[0.07] pb-0">
          {(["runs", "definitions"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`text-sm px-4 py-2 -mb-px border-b-2 transition capitalize ${
                tab === t
                  ? "border-red-500 text-white"
                  : "border-transparent text-white/30 hover:text-white/60"
              }`}
            >
              {t === "runs" ? `Runs (${total})` : `Definitions (${definitions.length})`}
            </button>
          ))}
        </div>

        {/* Runs tab */}
        {tab === "runs" && (
          <>
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
          </>
        )}

        {/* Definitions tab */}
        {tab === "definitions" && (
          <>
            {defsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />)}
              </div>
            ) : definitions.length === 0 ? (
              <div className="text-center py-16 text-white/20">
                <p>No workflow definitions yet.</p>
                <p className="text-xs mt-2">Run the seed script to add the 4 built-in workflows.</p>
                <code className="block text-xs bg-white/5 rounded px-3 py-2 text-emerald-300/60 font-mono max-w-md mx-auto mt-3">
                  cd functions && node ../scripts/seed-takers-ai.mjs
                </code>
              </div>
            ) : (
              <div className="space-y-2">
                {definitions.map((def) => (
                  <DefinitionCard key={def.id} def={def} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
