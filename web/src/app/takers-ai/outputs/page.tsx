"use client";

import { useEffect, useState, useCallback } from "react";
import { getAuth } from "firebase/auth";
import type { SavedOutput, OutputType } from "@/lib/takers-ai/types";
import { OUTPUT_TYPE_LABELS } from "@/lib/takers-ai/types";

async function authFetch(path: string, opts: RequestInit = {}) {
  const token = await getAuth().currentUser?.getIdToken();
  const res = await fetch(path, {
    ...opts,
    headers: { ...((opts.headers as Record<string, string>) ?? {}), Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

const TYPE_COLORS: Record<OutputType, string> = {
  caption: "bg-pink-600/15 border-pink-600/25 text-pink-300",
  email: "bg-blue-600/15 border-blue-600/25 text-blue-300",
  strategy: "bg-purple-600/15 border-purple-600/25 text-purple-300",
  copy: "bg-emerald-600/15 border-emerald-600/25 text-emerald-300",
  task: "bg-amber-600/15 border-amber-600/25 text-amber-300",
  prompt: "bg-red-600/15 border-red-600/25 text-red-300",
  plan: "bg-indigo-600/15 border-indigo-600/25 text-indigo-300",
  other: "bg-white/5 border-white/10 text-white/40",
};

function OutputCard({
  output,
  onDelete,
}: {
  output: SavedOutput;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(output.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl overflow-hidden group hover:border-white/15 transition">
      <div
        className="flex items-start gap-3 px-4 py-3.5 cursor-pointer hover:bg-white/[0.02] transition"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-white/80 text-sm font-semibold group-hover:text-white transition">{output.title}</p>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${TYPE_COLORS[output.type]}`}>
              {OUTPUT_TYPE_LABELS[output.type]}
            </span>
          </div>
          {!expanded && (
            <p className="text-white/30 text-xs mt-1 line-clamp-2">{output.content}</p>
          )}
        </div>
        <span className={`text-white/25 text-xs shrink-0 mt-0.5 transition-transform ${expanded ? "rotate-180" : ""}`}>▾</span>
      </div>
      {expanded && (
        <div className="border-t border-white/[0.05]">
          <div className="px-4 py-4">
            <div className="bg-black/20 rounded-xl px-4 py-3 max-h-80 overflow-y-auto">
              <p className="text-white/60 text-sm whitespace-pre-wrap leading-relaxed">{output.content}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 pb-4">
            <button
              onClick={handleCopy}
              className="text-xs px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/25 text-white/40 hover:text-white/70 transition"
            >
              {copied ? "✓ Copied" : "Copy"}
            </button>
            <span className="ml-auto text-white/15 text-[10px]">
              {new Date(output.createdAt).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}
            </span>
            <button
              onClick={() => onDelete(output.id)}
              className="text-xs text-red-500/40 hover:text-red-400 transition px-2"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OutputsPage() {
  const [outputs, setOutputs] = useState<SavedOutput[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<OutputType | "all">("all");
  const [search, setSearch] = useState("");

  const loadOutputs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await authFetch("/api/takers-ai/outputs");
      setOutputs(data.outputs ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadOutputs(); }, [loadOutputs]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this saved output?")) return;
    await authFetch(`/api/takers-ai/outputs/${id}`, { method: "DELETE" });
    setOutputs((prev) => prev.filter((o) => o.id !== id));
  }

  const filtered = outputs.filter((o) => {
    const matchType = filter === "all" || o.type === filter;
    const matchSearch = !search || o.title.toLowerCase().includes(search.toLowerCase()) || o.content.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  const types = [...new Set(outputs.map((o) => o.type))];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">Saved Outputs</h1>
            <p className="text-white/30 text-sm mt-0.5">Copy-ready content saved from chat conversations.</p>
          </div>
          <span className="text-white/20 text-sm">{outputs.length} outputs</span>
        </div>

        {/* Search + filter */}
        <div className="flex gap-3 flex-wrap">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search outputs…"
            className="flex-1 min-w-48 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-red-500/40"
          />
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilter("all")}
              className={`text-xs px-3 py-1.5 rounded-lg border transition ${filter === "all" ? "bg-red-600/20 border-red-600/30 text-red-300" : "border-white/10 text-white/30 hover:text-white/60"}`}
            >
              All
            </button>
            {types.map((type) => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition ${filter === type ? TYPE_COLORS[type] : "border-white/10 text-white/30 hover:text-white/60"}`}
              >
                {OUTPUT_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>

        {/* Output list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-white/20">
            {outputs.length === 0
              ? 'No saved outputs yet. Click "Save output" on any chat response.'
              : "No outputs match your filter."}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((output) => (
              <OutputCard key={output.id} output={output} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
