"use client";

import { useEffect, useState, useCallback } from "react";
import { getAuth } from "firebase/auth";
import type { AgentLog, AgentLogType, AgentRole } from "@/lib/takers-ai/types";
import {
  AGENT_ROLE_ICONS,
  AGENT_ROLE_LABELS,
  LOG_TYPE_COLORS,
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

function fmtMs(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}s` : `${n}ms`;
}

interface LogStats {
  totalLogs: number;
  byType: Record<string, number>;
  byRole: Record<string, number>;
  totalTokens: number;
  errorCount: number;
  avgConfidence: number;
}

function LogRow({ log }: { log: AgentLog }) {
  const [expanded, setExpanded] = useState(false);
  const typeColor = LOG_TYPE_COLORS[log.type] ?? "text-white/30";

  return (
    <div className="border border-white/[0.05] rounded-xl bg-white/[0.01] overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-white/[0.02] transition"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Type */}
        <span className={`text-[10px] font-bold uppercase tracking-wider w-24 shrink-0 ${typeColor}`}>
          {log.type}
        </span>

        {/* Agent */}
        <span className="text-base shrink-0">{AGENT_ROLE_ICONS[log.agentRole] ?? "◎"}</span>
        <span className="text-white/40 text-xs shrink-0">{log.agentName}</span>

        {/* Message preview */}
        {log.userMessage && (
          <p className="flex-1 text-white/25 text-xs truncate min-w-0">{log.userMessage}</p>
        )}

        {/* Metadata chips */}
        <div className="flex items-center gap-3 shrink-0 ml-auto">
          {log.routingDecision && (
            <span className={`text-[10px] ${
              log.routingDecision.confidence >= 80 ? "text-emerald-400" :
              log.routingDecision.confidence >= 60 ? "text-amber-400" : "text-red-400"
            }`}>
              {log.routingDecision.confidence}%
            </span>
          )}
          {log.tokenUsage?.totalTokens && (
            <span className="text-white/20 text-[10px]">{fmtTokens(log.tokenUsage.totalTokens)}t</span>
          )}
          {log.durationMs && (
            <span className="text-white/20 text-[10px]">{fmtMs(log.durationMs)}</span>
          )}
          <span className="text-white/15 text-[10px]">
            {new Date(log.createdAt).toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
          <span className={`text-white/20 text-xs transition-transform ${expanded ? "rotate-180" : ""}`}>▾</span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-white/[0.05] px-4 py-3 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <p className="text-white/25 text-[10px] uppercase tracking-wider mb-1">Agent</p>
              <p className="text-white/60">{log.agentName} ({log.agentRole})</p>
            </div>
            <div>
              <p className="text-white/25 text-[10px] uppercase tracking-wider mb-1">Type</p>
              <p className={typeColor}>{log.type}</p>
            </div>
            {log.durationMs != null && (
              <div>
                <p className="text-white/25 text-[10px] uppercase tracking-wider mb-1">Duration</p>
                <p className="text-white/60">{fmtMs(log.durationMs)}</p>
              </div>
            )}
            {log.conversationId && (
              <div>
                <p className="text-white/25 text-[10px] uppercase tracking-wider mb-1">Conversation</p>
                <p className="text-white/40 font-mono text-[10px]">{log.conversationId.slice(0, 12)}…</p>
              </div>
            )}
          </div>

          {/* Routing decision */}
          {log.routingDecision && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 space-y-2">
              <p className="text-white/25 text-[10px] uppercase tracking-wider font-bold">Routing Decision</p>
              <div className="flex items-center gap-3">
                <span>{AGENT_ROLE_ICONS[log.routingDecision.role] ?? "◎"}</span>
                <span className="text-white/60 text-xs">{AGENT_ROLE_LABELS[log.routingDecision.role]}</span>
                <span className={`text-xs font-bold ml-auto ${
                  log.routingDecision.confidence >= 80 ? "text-emerald-400" :
                  log.routingDecision.confidence >= 60 ? "text-amber-400" : "text-red-400"
                }`}>
                  {log.routingDecision.confidence}% confidence
                </span>
                {log.routingDecision.fallback && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-600/15 border border-orange-600/25 text-orange-300">
                    FALLBACK
                  </span>
                )}
              </div>
              <p className="text-white/40 text-xs">{log.routingDecision.reason}</p>
              {log.routingDecision.alternativeRoles?.length ? (
                <p className="text-white/25 text-[10px]">
                  Alternatives: {log.routingDecision.alternativeRoles.map(
                    (r) => AGENT_ROLE_LABELS[r]
                  ).join(", ")}
                </p>
              ) : null}
            </div>
          )}

          {/* Token usage */}
          {log.tokenUsage && (
            <div className="flex gap-4 text-xs">
              <span className="text-white/25">Input: <span className="text-white/50">{fmtTokens(log.tokenUsage.inputTokens)}</span></span>
              <span className="text-white/25">Output: <span className="text-white/50">{fmtTokens(log.tokenUsage.outputTokens)}</span></span>
              <span className="text-white/25">Total: <span className="text-white/60 font-bold">{fmtTokens(log.tokenUsage.totalTokens)}</span></span>
              {log.tokenUsage.routingInputTokens && (
                <span className="text-white/20">Routing: {fmtTokens((log.tokenUsage.routingInputTokens ?? 0) + (log.tokenUsage.routingOutputTokens ?? 0))}</span>
              )}
            </div>
          )}

          {/* Error */}
          {log.error && (
            <div className="bg-red-950/20 border border-red-600/20 rounded-lg px-3 py-2">
              <p className="text-red-400 text-xs">{log.error}</p>
            </div>
          )}

          {/* User message */}
          {log.userMessage && (
            <div className="bg-black/20 rounded-lg px-3 py-2">
              <p className="text-white/30 text-[10px] uppercase tracking-wider mb-1">User Message</p>
              <p className="text-white/50 text-xs">{log.userMessage}</p>
            </div>
          )}

          <p className="text-white/15 text-[10px]">
            {new Date(log.createdAt).toLocaleString("en-CA")}
          </p>
        </div>
      )}
    </div>
  );
}

export default function LogsPage() {
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<AgentLogType | "all">("all");
  const [roleFilter, setRoleFilter] = useState<AgentRole | "all">("all");
  const [purging, setPurging] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (roleFilter !== "all") params.set("agentRole", roleFilter);
      const data = await authFetch(`/api/takers-ai/logs?${params}`);
      setLogs(data.logs ?? []);
      setStats(data.stats ?? null);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, roleFilter]);

  useEffect(() => { load(); }, [load]);

  async function handlePurge() {
    if (!confirm("Delete all logs older than 7 days?")) return;
    setPurging(true);
    try {
      const data = await authFetch("/api/takers-ai/logs?purge=true", { method: "DELETE" });
      alert(`Deleted ${data.deleted} old log entries.`);
      load();
    } finally {
      setPurging(false);
    }
  }

  const LOG_TYPES: AgentLogType[] = [
    "routing", "generation", "tool_call", "error", "approval_created",
    "approval_resolved", "workflow_step", "fallback",
  ];

  const ROLES: AgentRole[] = [
    "operator", "content", "marketing", "events", "support", "strategy", "developer", "operations",
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">Observability Log</h1>
            <p className="text-white/30 text-sm mt-0.5">
              Every routing decision, generation, tool call, and error from the last 200 operations.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={load} disabled={loading}
              className="text-xs px-3 py-1.5 border border-white/10 hover:border-white/25 rounded-lg text-white/40 hover:text-white transition disabled:opacity-40">
              {loading ? "Loading…" : "Refresh"}
            </button>
            <button onClick={handlePurge} disabled={purging}
              className="text-xs px-3 py-1.5 border border-red-600/20 hover:border-red-600/40 rounded-lg text-red-500/60 hover:text-red-400 transition disabled:opacity-40">
              {purging ? "Purging…" : "Purge Old"}
            </button>
          </div>
        </div>

        {/* Stats grid */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
              <p className="text-white/25 text-[10px] uppercase tracking-wider mb-1">Log Entries</p>
              <p className="text-white text-xl font-bold">{stats.totalLogs}</p>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
              <p className="text-white/25 text-[10px] uppercase tracking-wider mb-1">Total Tokens</p>
              <p className="text-blue-400 text-xl font-bold">{fmtTokens(stats.totalTokens)}</p>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
              <p className="text-white/25 text-[10px] uppercase tracking-wider mb-1">Errors</p>
              <p className={`text-xl font-bold ${stats.errorCount > 0 ? "text-red-400" : "text-white/40"}`}>
                {stats.errorCount}
              </p>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
              <p className="text-white/25 text-[10px] uppercase tracking-wider mb-1">Avg Confidence</p>
              <p className={`text-xl font-bold ${
                stats.avgConfidence >= 80 ? "text-emerald-400" :
                stats.avgConfidence >= 60 ? "text-amber-400" : "text-red-400"
              }`}>
                {stats.avgConfidence > 0 ? `${stats.avgConfidence}%` : "—"}
              </p>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
              <p className="text-white/25 text-[10px] uppercase tracking-wider mb-1">Routings</p>
              <p className="text-amber-400 text-xl font-bold">{stats.byType["routing"] ?? 0}</p>
            </div>
          </div>
        )}

        {/* Activity by role */}
        {stats && Object.keys(stats.byRole).length > 0 && (
          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-white/25 text-xs">Activity:</span>
            {Object.entries(stats.byRole)
              .sort(([, a], [, b]) => b - a)
              .map(([role, count]) => (
                <span key={role} className="flex items-center gap-1 text-xs text-white/30">
                  {AGENT_ROLE_ICONS[role as AgentRole]} {role}
                  <span className="text-white/15">({count})</span>
                </span>
              ))}
          </div>
        )}

        {/* Filters */}
        <div className="space-y-2">
          {/* Type filter */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setTypeFilter("all")}
              className={`text-xs px-2.5 py-1 rounded-lg border transition ${typeFilter === "all" ? "bg-red-600/20 border-red-600/30 text-red-300" : "border-white/10 text-white/30 hover:text-white/60"}`}>
              All types
            </button>
            {LOG_TYPES.map((t) => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={`text-xs px-2.5 py-1 rounded-lg border transition ${typeFilter === t ? "bg-red-600/20 border-red-600/30 text-red-300" : "border-white/10 text-white/30 hover:text-white/60"}`}>
                <span className={LOG_TYPE_COLORS[t]}>{t}</span>
              </button>
            ))}
          </div>
          {/* Role filter */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setRoleFilter("all")}
              className={`text-xs px-2.5 py-1 rounded-lg border transition ${roleFilter === "all" ? "bg-white/10 border-white/20 text-white/60" : "border-white/[0.06] text-white/20 hover:text-white/40"}`}>
              All agents
            </button>
            {ROLES.map((r) => (
              <button key={r} onClick={() => setRoleFilter(r)}
                className={`text-xs px-2.5 py-1 rounded-lg border transition ${roleFilter === r ? "bg-white/10 border-white/20 text-white/60" : "border-white/[0.06] text-white/20 hover:text-white/40"}`}>
                {AGENT_ROLE_ICONS[r]} {r}
              </button>
            ))}
          </div>
        </div>

        {/* Log list */}
        {loading ? (
          <div className="space-y-1.5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-10 bg-white/5 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-20 text-white/20">
            {typeFilter !== "all" || roleFilter !== "all"
              ? "No logs match this filter."
              : "No logs yet. Send a message to the Takers Operator to generate entries."}
          </div>
        ) : (
          <div className="space-y-1.5">
            {logs.map((log) => <LogRow key={log.id} log={log} />)}
          </div>
        )}
      </div>
    </div>
  );
}
