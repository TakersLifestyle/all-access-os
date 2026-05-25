"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getAuth } from "firebase/auth";
import type { PromptTemplate } from "@/lib/takers-ai/types";

async function authFetch(path: string, opts: RequestInit = {}) {
  const token = await getAuth().currentUser?.getIdToken();
  const res = await fetch(path, {
    ...opts,
    headers: { ...((opts.headers as Record<string, string>) ?? {}), Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

const CATEGORIES = ["all", "content", "events", "marketing", "strategy", "developer", "operations", "general"];

function TemplateCard({
  template,
  onUse,
  onDelete,
}: {
  template: PromptTemplate;
  onUse: (t: PromptTemplate) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4 hover:border-white/15 transition group space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-white/80 text-sm font-semibold group-hover:text-white transition">{template.name}</p>
          {template.description && (
            <p className="text-white/30 text-xs mt-0.5">{template.description}</p>
          )}
        </div>
        <span className="shrink-0 text-[10px] px-2 py-1 rounded bg-white/5 border border-white/10 text-white/30 uppercase tracking-wider font-bold">
          {template.category}
        </span>
      </div>

      <div className="bg-black/20 rounded-lg px-3 py-2.5 max-h-24 overflow-hidden relative">
        <p className="text-white/30 text-xs font-mono leading-relaxed line-clamp-3">{template.prompt}</p>
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-[#0d0d15] to-transparent" />
      </div>

      {template.variables.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {template.variables.map((v) => (
            <span key={v} className="text-[10px] px-1.5 py-0.5 rounded bg-red-600/10 border border-red-600/20 text-red-400 font-mono">
              {`{{${v}}}`}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => onUse(template)}
          className="flex-1 px-3 py-2 rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-600/25 hover:border-red-600/40 text-red-300 text-xs font-bold transition"
        >
          Use in Chat →
        </button>
        <span className="text-white/20 text-[10px]">Used {template.usageCount}×</span>
        <button
          onClick={() => onDelete(template.id)}
          className="text-xs text-white/20 hover:text-red-400 transition px-2"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function NewTemplateModal({
  onSave,
  onClose,
}: {
  onSave: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");
  const [category, setCategory] = useState("general");
  const [saving, setSaving] = useState(false);

  // Auto-detect variables like {{variable_name}}
  const variables = Array.from(prompt.matchAll(/\{\{(\w+)\}\}/g)).map((m) => m[1]);
  const uniqueVars = [...new Set(variables)];

  async function handleSave() {
    if (!name.trim() || !prompt.trim()) return;
    setSaving(true);
    try {
      await authFetch("/api/takers-ai/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, prompt, category, variables: uniqueVars }),
      });
      onSave();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#13131f] border border-white/10 rounded-2xl p-6 w-full max-w-lg space-y-4">
        <h3 className="font-bold text-white">New Prompt Template</h3>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Template name…"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-red-500/50"
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short description (optional)"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-red-500/50"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white/70 focus:outline-none focus:border-red-500/50"
        >
          {CATEGORIES.filter((c) => c !== "all").map((c) => (
            <option key={c} value={c} className="bg-[#13131f] capitalize">{c.charAt(0).toUpperCase() + c.slice(1)}</option>
          ))}
        </select>
        <div className="space-y-1.5">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={"Write the prompt here. Use {{variable_name}} for dynamic fields.\n\nExample: Write 3 Instagram captions for the event '{{event_name}}' on {{event_date}} at {{location}}."}
            rows={7}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 resize-none focus:outline-none focus:border-red-500/50 font-mono leading-relaxed"
          />
          {uniqueVars.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-white/30 text-xs">Auto-detected variables:</span>
              {uniqueVars.map((v) => (
                <span key={v} className="text-[10px] px-1.5 py-0.5 rounded bg-red-600/10 border border-red-600/20 text-red-400 font-mono">
                  {`{{${v}}}`}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-xl border border-white/10 text-white/50 hover:text-white/70 text-sm transition">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || !prompt.trim() || saving}
            className="flex-1 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold text-sm transition"
          >
            {saving ? "Saving…" : "Save template"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [showNew, setShowNew] = useState(false);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await authFetch("/api/takers-ai/templates");
      setTemplates(data.templates ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  async function handleUse(template: PromptTemplate) {
    // Increment usage count
    await authFetch("/api/takers-ai/templates", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: template.id, incrementUsage: true }),
    });
    // Navigate to chat with prompt pre-filled
    const encoded = encodeURIComponent(template.prompt);
    router.push(`/takers-ai/chat?prompt=${encoded}`);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this template?")) return;
    await authFetch(`/api/takers-ai/templates?id=${id}`, { method: "DELETE" });
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  const filtered = filter === "all" ? templates : templates.filter((t) => t.category === filter);
  const categories = [...new Set(templates.map((t) => t.category))];
  const availableFilters = ["all", ...categories];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">Prompt Templates</h1>
            <p className="text-white/30 text-sm mt-0.5">Reusable prompts. Click "Use in Chat" to send directly to an agent.</p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition"
          >
            + New template
          </button>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 flex-wrap">
          {availableFilters.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition capitalize ${
                filter === cat
                  ? "bg-red-600/20 border-red-600/30 text-red-300"
                  : "border-white/10 text-white/30 hover:text-white/60"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Template grid */}
        {loading ? (
          <div className="grid md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-48 bg-white/5 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-white/20 space-y-3">
            <p>No templates yet.</p>
            <p className="text-xs">Run the seed script to load the starter library.</p>
            <button
              onClick={() => setShowNew(true)}
              className="text-xs text-red-400 hover:text-red-300 transition"
            >
              Or create one manually →
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {filtered.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                onUse={handleUse}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {showNew && (
        <NewTemplateModal
          onSave={() => { setShowNew(false); loadTemplates(); }}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  );
}
