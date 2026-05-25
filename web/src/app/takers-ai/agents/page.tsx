"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getAuth } from "firebase/auth";
import type {
  Agent, AgentInstructions, AgentModel, AgentTool, AgentRole,
} from "@/lib/takers-ai/types";
import {
  AGENT_ROLE_LABELS, AGENT_ROLE_COLORS, AGENT_ROLE_ICONS,
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

const MODELS: { value: AgentModel; label: string }[] = [
  { value: "claude-opus-4-5", label: "Opus 4.5 (powerful)" },
  { value: "claude-sonnet-4-5", label: "Sonnet 4.5 (recommended)" },
  { value: "claude-haiku-4-5", label: "Haiku 4.5 (fast)" },
];

const ALL_TOOLS: { tool: AgentTool; label: string; desc: string }[] = [
  { tool: "save_output", label: "Save Output", desc: "Save response to Saved Outputs" },
  { tool: "create_task", label: "Create Task", desc: "Create a task from this response" },
  { tool: "log_feedback", label: "Log Feedback", desc: "Accept thumbs up/down on responses" },
  { tool: "route_to_agent", label: "Route to Agent", desc: "Operator only — route to specialists" },
  { tool: "search_memory", label: "Search Memory", desc: "Query brand memory by keyword" },
];

// ── The 4 pillars panel ───────────────────────────────────────────────────────
function FourPillars({
  agent,
  instructions,
}: {
  agent: Agent;
  instructions: AgentInstructions | null;
}) {
  const pillars = [
    {
      label: "Role",
      value: AGENT_ROLE_LABELS[agent.role],
      sub: `${agent.model} · ${(agent.maxTokens ?? 2048).toLocaleString()} tokens`,
      icon: "①",
    },
    {
      label: "Instructions",
      value: instructions?.instructions
        ? `${instructions.instructions.slice(0, 80)}…`
        : "No custom instructions yet",
      sub: instructions ? `Updated ${new Date(instructions.updatedAt).toLocaleDateString()}` : "Using base system prompt only",
      icon: "②",
    },
    {
      label: "Tools",
      value: (agent.tools ?? []).length > 0
        ? agent.tools.join(", ")
        : "No tools enabled",
      sub: `${(agent.tools ?? []).length} / ${ALL_TOOLS.length} tools active`,
      icon: "③",
    },
    {
      label: "Memory",
      value: "Brand Memory (shared)",
      sub: "All 9 memory blocks injected on every response",
      icon: "④",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {pillars.map((p) => (
        <div key={p.label} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="text-white/20 text-xs">{p.icon}</span>
            <span className="text-white/40 text-[10px] font-bold uppercase tracking-wider">{p.label}</span>
          </div>
          <p className="text-white/70 text-xs leading-relaxed">{p.value}</p>
          <p className="text-white/25 text-[10px]">{p.sub}</p>
        </div>
      ))}
    </div>
  );
}

// ── Instruction editor inline ─────────────────────────────────────────────────
function InstructionEditor({
  agent,
  instructions,
  onSave,
  onCancel,
}: {
  agent: Agent;
  instructions: AgentInstructions | null;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(instructions?.instructions ?? "");
  const [tools, setTools] = useState<AgentTool[]>(instructions?.tools ?? agent.tools ?? []);
  const [model, setModel] = useState<AgentModel>(agent.model);
  const [maxTokens, setMaxTokens] = useState(agent.maxTokens ?? 2048);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function toggleTool(tool: AgentTool) {
    setTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      // Save instructions
      await authFetch("/api/takers-ai/instructions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: agent.id,
          agentName: agent.name,
          instructions: text,
          tools,
        }),
      });
      // Update model + maxTokens on agent
      await authFetch(`/api/takers-ai/agents/${agent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, maxTokens, tools }),
      });
      setSaved(true);
      setTimeout(() => { setSaved(false); onSave(); }, 1200);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 border-t border-white/[0.07] pt-5 mt-2">
      {/* Instructions textarea */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-white/40 text-xs font-bold uppercase tracking-wider">② Custom Instructions</label>
          <span className="text-white/20 text-[10px]">Appended after base system prompt</span>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Add specific instructions for ${agent.name}.\n\nExample:\n- Always structure responses with a TL;DR at the top\n- Never suggest events without a clear CTA\n- Prioritize free/low-cost tactics for ALL ACCESS`}
          rows={8}
          className="w-full bg-white/[0.03] border border-white/[0.08] hover:border-white/15 focus:border-red-500/40 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 resize-none focus:outline-none leading-relaxed transition"
        />
      </div>

      {/* Tools */}
      <div className="space-y-2">
        <label className="text-white/40 text-xs font-bold uppercase tracking-wider block">③ Tools</label>
        <div className="space-y-1.5">
          {ALL_TOOLS.filter((t) => agent.role === "operator" || t.tool !== "route_to_agent").map(({ tool, label, desc }) => (
            <button
              key={tool}
              onClick={() => toggleTool(tool)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition ${
                tools.includes(tool)
                  ? "bg-emerald-600/10 border-emerald-600/25"
                  : "bg-white/[0.02] border-white/[0.06] hover:border-white/10"
              }`}
            >
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition ${
                tools.includes(tool) ? "bg-emerald-400 border-emerald-400" : "border-white/20"
              }`}>
                {tools.includes(tool) && <span className="text-black text-[10px] font-bold">✓</span>}
              </div>
              <div>
                <p className={`text-xs font-medium ${tools.includes(tool) ? "text-emerald-300" : "text-white/50"}`}>{label}</p>
                <p className="text-white/20 text-[10px]">{desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Model + max tokens */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-white/40 text-xs font-bold uppercase tracking-wider block">Model</label>
          <select value={model} onChange={(e) => setModel(e.target.value as AgentModel)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/70 focus:outline-none">
            {MODELS.map((m) => (
              <option key={m.value} value={m.value} className="bg-[#13131f]">{m.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-white/40 text-xs font-bold uppercase tracking-wider block">
            Max tokens: {maxTokens.toLocaleString()}
          </label>
          <input type="range" min={512} max={8192} step={512} value={maxTokens}
            onChange={(e) => setMaxTokens(Number(e.target.value))}
            className="w-full mt-2 accent-red-500" />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button onClick={onCancel} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-white/50 hover:text-white/70 text-sm transition">
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving || saved}
          className={`flex-1 px-4 py-2.5 rounded-xl font-bold text-sm transition ${
            saved ? "bg-emerald-600 text-white" : "bg-red-600 hover:bg-red-500 text-white disabled:opacity-40"
          }`}>
          {saved ? "✓ Saved" : saving ? "Saving…" : "Save instructions"}
        </button>
      </div>
    </div>
  );
}

// ── Agent card ────────────────────────────────────────────────────────────────
function AgentCard({
  agent,
  instructions,
  onUpdate,
}: {
  agent: Agent;
  instructions: AgentInstructions | null;
  onUpdate: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const color = AGENT_ROLE_COLORS[agent.role as AgentRole] ?? "bg-red-600";

  async function toggleActive() {
    if (agent.isDefault) return;
    setToggling(true);
    try {
      await authFetch(`/api/takers-ai/agents/${agent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !agent.isActive }),
      });
      onUpdate();
    } finally { setToggling(false); }
  }

  return (
    <div className={`bg-white/[0.03] border rounded-2xl overflow-hidden transition ${
      agent.isActive ? "border-white/[0.07]" : "border-white/[0.03] opacity-60"
    }`}>
      {/* Header */}
      <div className="flex items-center gap-4 p-5">
        <div className={`w-11 h-11 rounded-xl ${color} bg-opacity-20 border border-white/10 flex items-center justify-center text-2xl shrink-0`}>
          {agent.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-white/90 font-bold">{agent.name}</p>
            {agent.isDefault && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-600/20 border border-red-600/25 text-red-400 font-bold">OPERATOR</span>
            )}
            {!agent.isActive && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/30">INACTIVE</span>
            )}
            {instructions?.instructions && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-600/10 border border-emerald-600/20 text-emerald-400">CUSTOMIZED</span>
            )}
          </div>
          <p className="text-white/30 text-xs">{AGENT_ROLE_LABELS[agent.role as AgentRole]} · {agent.model}</p>
          <p className="text-white/40 text-xs mt-0.5 line-clamp-1">{agent.description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href={`/takers-ai/chat?agentId=${agent.id}`}
            className="text-xs px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white/50 hover:text-white transition">
            Chat →
          </Link>
          <button onClick={() => { setExpanded((v) => !v); if (!expanded) setEditing(false); }}
            className={`text-xs px-3 py-1.5 rounded-lg border transition ${
              expanded ? "bg-red-600/15 border-red-600/30 text-red-300" : "border-white/10 text-white/30 hover:text-white/60"
            }`}>
            {expanded ? "Collapse" : "Edit"}
          </button>
          <button onClick={toggleActive} disabled={agent.isDefault || toggling}
            className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-white/20 hover:text-white/60 disabled:opacity-30 disabled:cursor-not-allowed transition">
            {agent.isActive ? "Pause" : "Enable"}
          </button>
        </div>
      </div>

      {/* Expanded: 4 pillars + instruction editor */}
      {expanded && (
        <div className="border-t border-white/[0.06] px-5 pb-5 space-y-4 pt-4">
          <FourPillars agent={agent} instructions={instructions} />

          {!editing ? (
            <button onClick={() => setEditing(true)}
              className="w-full text-xs px-4 py-2.5 rounded-xl border border-dashed border-white/10 text-white/30 hover:text-white/60 hover:border-white/20 transition">
              ✏️ Edit instructions, tools &amp; model →
            </button>
          ) : (
            <InstructionEditor
              agent={agent}
              instructions={instructions}
              onSave={() => { setEditing(false); onUpdate(); }}
              onCancel={() => setEditing(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [instructionsMap, setInstructionsMap] = useState<Record<string, AgentInstructions>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [agentsData, instrData] = await Promise.all([
        authFetch("/api/takers-ai/agents"),
        authFetch("/api/takers-ai/instructions"),
      ]);
      setAgents(agentsData.agents ?? []);
      const map: Record<string, AgentInstructions> = {};
      for (const instr of (instrData.instructions ?? [])) {
        map[instr.agentId] = instr;
      }
      setInstructionsMap(map);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Sort: operator first, then alphabetical by role
  const sorted = [...agents].sort((a, b) => {
    if (a.isDefault) return -1;
    if (b.isDefault) return 1;
    return a.role.localeCompare(b.role);
  });

  const activeCount = agents.filter((a) => a.isActive).length;
  const customizedCount = Object.keys(instructionsMap).length;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">Agent Roster</h1>
            <p className="text-white/30 text-sm mt-0.5">
              {activeCount} active · {customizedCount} customized · Each agent has 4 pillars: Role, Instructions, Tools, Memory
            </p>
          </div>
          <Link href="/takers-ai/chat"
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition">
            Open Chat →
          </Link>
        </div>

        {/* 4 Pillars legend */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { num: "①", label: "Role", desc: "What the agent IS" },
            { num: "②", label: "Instructions", desc: "How it behaves (editable)" },
            { num: "③", label: "Tools", desc: "What it can do" },
            { num: "④", label: "Memory", desc: "Brand context it knows" },
          ].map((p) => (
            <div key={p.label} className="text-center p-3 bg-white/[0.02] rounded-xl border border-white/[0.05]">
              <p className="text-white/20 text-lg">{p.num}</p>
              <p className="text-white/60 text-xs font-bold">{p.label}</p>
              <p className="text-white/25 text-[10px] mt-0.5">{p.desc}</p>
            </div>
          ))}
        </div>

        {/* Agent cards */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-white/5 rounded-2xl animate-pulse" />)}
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-16 text-white/20 space-y-3">
            <p>No agents seeded yet.</p>
            <code className="block text-xs bg-white/5 rounded px-3 py-2 text-emerald-300/60 font-mono">
              cd functions &amp;&amp; node ../scripts/seed-takers-ai.mjs
            </code>
          </div>
        ) : (
          <div className="space-y-4">
            {sorted.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                instructions={instructionsMap[agent.id] ?? null}
                onUpdate={load}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
