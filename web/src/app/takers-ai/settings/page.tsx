"use client";

import { useEffect, useState, useCallback } from "react";
import { getAuth } from "firebase/auth";
import type { Agent, AgentModel } from "@/lib/takers-ai/types";
import { AGENT_ROLE_LABELS } from "@/lib/takers-ai/types";

async function authFetch(path: string, opts: RequestInit = {}) {
  const token = await getAuth().currentUser?.getIdToken();
  const res = await fetch(path, {
    ...opts,
    headers: { ...((opts.headers as Record<string, string>) ?? {}), Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

const MODELS: { value: AgentModel; label: string; desc: string }[] = [
  { value: "claude-opus-4-5", label: "Claude Opus 4.5", desc: "Most capable — complex strategy and long-form" },
  { value: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", desc: "Best balance — fast and smart (recommended)" },
  { value: "claude-haiku-4-5", label: "Claude Haiku 4.5", desc: "Fastest — quick tasks and simple copy" },
];

const ICONS = ["🤖", "◎", "✦", "⚡", "🎯", "📣", "🧠", "🛠", "📋", "🏀", "✏️", "📧"];
const COLORS = [
  { value: "bg-red-600", label: "Red" },
  { value: "bg-blue-600", label: "Blue" },
  { value: "bg-purple-600", label: "Purple" },
  { value: "bg-emerald-600", label: "Green" },
  { value: "bg-amber-500", label: "Amber" },
  { value: "bg-pink-600", label: "Pink" },
  { value: "bg-indigo-600", label: "Indigo" },
  { value: "bg-white", label: "White" },
];

function AgentEditForm({
  agent,
  onSave,
  onCancel,
}: {
  agent: Agent;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description);
  const [systemPrompt, setSystemPrompt] = useState(agent.systemPrompt);
  const [model, setModel] = useState<AgentModel>(agent.model);
  const [maxTokens, setMaxTokens] = useState(agent.maxTokens ?? 2048);
  const [icon, setIcon] = useState(agent.icon);
  const [color, setColor] = useState(agent.color);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await authFetch(`/api/takers-ai/agents/${agent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, systemPrompt, model, maxTokens, icon, color }),
      });
      onSave();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 border border-red-600/20 rounded-2xl p-5 bg-red-600/[0.03]">
      <div className="grid grid-cols-2 gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500/50"
          placeholder="Agent name"
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500/50"
          placeholder="Short description"
        />
      </div>

      {/* Icon picker */}
      <div className="space-y-1.5">
        <label className="text-white/30 text-xs">Icon</label>
        <div className="flex gap-2 flex-wrap">
          {ICONS.map((i) => (
            <button
              key={i}
              onClick={() => setIcon(i)}
              className={`w-9 h-9 rounded-lg text-xl flex items-center justify-center transition ${icon === i ? "bg-red-600/30 border border-red-600/50" : "bg-white/5 border border-white/10 hover:border-white/25"}`}
            >
              {i}
            </button>
          ))}
        </div>
      </div>

      {/* Color picker */}
      <div className="space-y-1.5">
        <label className="text-white/30 text-xs">Color</label>
        <div className="flex gap-2 flex-wrap">
          {COLORS.map((c) => (
            <button
              key={c.value}
              onClick={() => setColor(c.value)}
              title={c.label}
              className={`w-7 h-7 rounded-lg ${c.value} transition ${color === c.value ? "ring-2 ring-white/60 ring-offset-2 ring-offset-[#13131f]" : "opacity-60 hover:opacity-90"}`}
            />
          ))}
        </div>
      </div>

      {/* Model */}
      <div className="space-y-1.5">
        <label className="text-white/30 text-xs">Model</label>
        <div className="grid gap-2">
          {MODELS.map((m) => (
            <button
              key={m.value}
              onClick={() => setModel(m.value)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-left transition ${model === m.value ? "bg-red-600/15 border-red-600/30" : "bg-white/[0.02] border-white/[0.06] hover:border-white/15"}`}
            >
              <div className={`w-3 h-3 rounded-full border-2 shrink-0 ${model === m.value ? "bg-red-400 border-red-400" : "border-white/20"}`} />
              <div>
                <p className="text-white/70 text-sm font-medium">{m.label}</p>
                <p className="text-white/30 text-xs">{m.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Max tokens */}
      <div className="space-y-1.5">
        <label className="text-white/30 text-xs">Max tokens: {maxTokens.toLocaleString()}</label>
        <input
          type="range"
          min={512}
          max={8192}
          step={512}
          value={maxTokens}
          onChange={(e) => setMaxTokens(Number(e.target.value))}
          className="w-full accent-red-500"
        />
        <div className="flex justify-between text-white/20 text-[10px]">
          <span>512</span><span>4096</span><span>8192</span>
        </div>
      </div>

      {/* System prompt */}
      <div className="space-y-1.5">
        <label className="text-white/30 text-xs">System Prompt</label>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={12}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white resize-none focus:outline-none focus:border-red-500/50 font-mono leading-relaxed"
        />
        <p className="text-white/20 text-xs">
          Brand memory is automatically appended — no need to repeat it here.
        </p>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-white/50 hover:text-white/70 text-sm transition"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold text-sm transition"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadAgents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await authFetch("/api/takers-ai/agents");
      setAgents(data.agents ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  async function toggleActive(agent: Agent) {
    await authFetch(`/api/takers-ai/agents/${agent.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !agent.isActive }),
    });
    setAgents((prev) => prev.map((a) => (a.id === agent.id ? { ...a, isActive: !a.isActive } : a)));
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-8 py-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Agent Settings</h1>
          <p className="text-white/30 text-sm mt-0.5">Configure system prompts, models, and agent behavior.</p>
        </div>

        {/* Agent list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse" />)}
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-16 text-white/20 space-y-2">
            <p>No agents found.</p>
            <code className="block text-xs bg-white/5 rounded px-3 py-2 text-emerald-300/60 font-mono">
              node ../scripts/seed-takers-ai.mjs
            </code>
          </div>
        ) : (
          <div className="space-y-4">
            {agents.map((agent) => (
              <div key={agent.id} className="space-y-4">
                {/* Agent card */}
                <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className={`w-10 h-10 rounded-xl ${agent.color} bg-opacity-20 border border-white/10 flex items-center justify-center text-xl shrink-0`}>
                      {agent.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-white/80 font-semibold">{agent.name}</p>
                        {agent.isDefault && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-600/20 border border-red-600/25 text-red-400 font-bold">
                            DEFAULT
                          </span>
                        )}
                        {!agent.isActive && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/30">
                            INACTIVE
                          </span>
                        )}
                      </div>
                      <p className="text-white/30 text-xs">{AGENT_ROLE_LABELS[agent.role]} · {agent.model}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => toggleActive(agent)}
                        disabled={agent.isDefault}
                        title={agent.isDefault ? "Default agent cannot be deactivated" : undefined}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition disabled:opacity-30 disabled:cursor-not-allowed ${
                          agent.isActive
                            ? "border-white/10 text-white/30 hover:text-white/60"
                            : "border-emerald-600/30 text-emerald-400 hover:border-emerald-500/50"
                        }`}
                      >
                        {agent.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => setEditingId(editingId === agent.id ? null : agent.id)}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                          editingId === agent.id
                            ? "bg-red-600/20 border-red-600/30 text-red-300"
                            : "border-white/10 text-white/30 hover:text-white/60"
                        }`}
                      >
                        {editingId === agent.id ? "Editing…" : "Edit"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Edit form inline */}
                {editingId === agent.id && (
                  <AgentEditForm
                    agent={agent}
                    onSave={() => { setEditingId(null); loadAgents(); }}
                    onCancel={() => setEditingId(null)}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Info */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl px-5 py-4 space-y-1">
          <p className="text-white/40 text-sm font-semibold">Phase 2 — Agent Team</p>
          <p className="text-white/20 text-xs leading-relaxed">
            Content Agent, Marketing Agent, Event Agent, Support Agent, Strategy Agent, Developer Agent, and Operations Agent will be added in Phase 2.
            Each will have a dedicated system prompt, specialized templates, and direct routing from the Takers Operator.
          </p>
        </div>
      </div>
    </div>
  );
}
