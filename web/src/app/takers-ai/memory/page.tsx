"use client";

import { useEffect, useState, useCallback } from "react";
import { getAuth } from "firebase/auth";
import type { BrandMemory, MemoryCategory } from "@/lib/takers-ai/types";
import { MEMORY_CATEGORY_LABELS } from "@/lib/takers-ai/types";

async function authFetch(path: string, opts: RequestInit = {}) {
  const token = await getAuth().currentUser?.getIdToken();
  const res = await fetch(path, {
    ...opts,
    headers: { ...((opts.headers as Record<string, string>) ?? {}), Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

const CATEGORY_COLORS: Record<MemoryCategory, string> = {
  brand_voice: "bg-red-600/15 border-red-600/25 text-red-300",
  audience: "bg-blue-600/15 border-blue-600/25 text-blue-300",
  events: "bg-purple-600/15 border-purple-600/25 text-purple-300",
  platform_rules: "bg-amber-600/15 border-amber-600/25 text-amber-300",
  content: "bg-emerald-600/15 border-emerald-600/25 text-emerald-300",
  business: "bg-pink-600/15 border-pink-600/25 text-pink-300",
};

function MemoryCard({
  mem,
  onEdit,
  onDelete,
}: {
  mem: BrandMemory;
  onEdit: (m: BrandMemory) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl overflow-hidden">
      <div
        className="flex items-start gap-3 px-4 py-3.5 cursor-pointer hover:bg-white/[0.02] transition"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-white/80 text-sm font-semibold">{mem.title}</p>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${CATEGORY_COLORS[mem.category]}`}>
              {MEMORY_CATEGORY_LABELS[mem.category]}
            </span>
          </div>
          {!expanded && (
            <p className="text-white/30 text-xs mt-1 line-clamp-2">{mem.content}</p>
          )}
        </div>
        <span className={`text-white/25 text-xs shrink-0 mt-0.5 transition-transform ${expanded ? "rotate-180" : ""}`}>▾</span>
      </div>
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/[0.05]">
          <p className="text-white/60 text-sm leading-relaxed whitespace-pre-wrap pt-3">{mem.content}</p>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => onEdit(mem)}
              className="text-xs px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/25 text-white/40 hover:text-white/70 transition"
            >
              Edit
            </button>
            <button
              onClick={() => onDelete(mem.id)}
              className="text-xs px-3 py-1.5 rounded-lg border border-red-600/20 hover:border-red-600/40 text-red-500/60 hover:text-red-400 transition"
            >
              Delete
            </button>
            <span className="ml-auto text-white/15 text-[10px] self-center">
              Updated {new Date(mem.updatedAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function EditModal({
  mem,
  onSave,
  onClose,
}: {
  mem: BrandMemory | null;
  onSave: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(mem?.title ?? "");
  const [content, setContent] = useState(mem?.content ?? "");
  const [category, setCategory] = useState<MemoryCategory>(mem?.category ?? "brand_voice");
  const [key, setKey] = useState(mem?.key ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    try {
      if (mem) {
        await authFetch("/api/takers-ai/memory", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: mem.id, title, content, category }),
        });
      } else {
        await authFetch("/api/takers-ai/memory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: key.trim().replace(/\s+/g, "_").toLowerCase() || title.toLowerCase().replace(/\s+/g, "_"),
            category,
            title,
            content,
          }),
        });
      }
      onSave();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#13131f] border border-white/10 rounded-2xl p-6 w-full max-w-lg space-y-4">
        <h3 className="font-bold text-white">{mem ? "Edit Memory" : "New Memory Block"}</h3>
        <div className="grid grid-cols-2 gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title…"
            className="col-span-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-red-500/50"
          />
          {!mem && (
            <input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Key (slug, auto-generated if blank)"
              className="col-span-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-red-500/50"
            />
          )}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as MemoryCategory)}
            className="col-span-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white/70 focus:outline-none focus:border-red-500/50"
          >
            {Object.entries(MEMORY_CATEGORY_LABELS).map(([k, label]) => (
              <option key={k} value={k} className="bg-[#13131f]">{label}</option>
            ))}
          </select>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Memory content — this will be injected into every AI response as brand context…"
          rows={8}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 resize-none focus:outline-none focus:border-red-500/50 leading-relaxed"
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-xl border border-white/10 text-white/50 hover:text-white/70 text-sm transition">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim() || !content.trim() || saving}
            className="flex-1 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold text-sm transition"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BrandMemoryPage() {
  const [memory, setMemory] = useState<BrandMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<MemoryCategory | "all">("all");
  const [editModal, setEditModal] = useState<BrandMemory | null | "new">(null);

  const loadMemory = useCallback(async () => {
    setLoading(true);
    try {
      const data = await authFetch("/api/takers-ai/memory");
      setMemory(data.memory ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMemory(); }, [loadMemory]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this memory block? The AI will no longer have this context.")) return;
    await authFetch(`/api/takers-ai/memory?id=${id}`, { method: "DELETE" });
    setMemory((prev) => prev.filter((m) => m.id !== id));
  }

  const filtered = filter === "all" ? memory : memory.filter((m) => m.category === filter);

  const grouped = Object.entries(MEMORY_CATEGORY_LABELS).map(([cat, label]) => ({
    cat: cat as MemoryCategory,
    label,
    items: filtered.filter((m) => m.category === cat),
  }));

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">Brand Memory</h1>
            <p className="text-white/30 text-sm mt-0.5">
              This context is injected into every AI conversation. Keep it accurate and current.
            </p>
          </div>
          <button
            onClick={() => setEditModal("new")}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition"
          >
            + Add block
          </button>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 text-sm text-white/30">
          <span>{memory.length} memory blocks</span>
          <span>·</span>
          <span>~{Math.round(memory.reduce((s, m) => s + m.content.length, 0) / 4)} tokens injected</span>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilter("all")}
            className={`text-xs px-3 py-1.5 rounded-lg border transition ${filter === "all" ? "bg-red-600/20 border-red-600/30 text-red-300" : "border-white/10 text-white/30 hover:text-white/60"}`}
          >
            All
          </button>
          {Object.entries(MEMORY_CATEGORY_LABELS).map(([cat, label]) => (
            <button
              key={cat}
              onClick={() => setFilter(cat as MemoryCategory)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition ${filter === cat ? `${CATEGORY_COLORS[cat as MemoryCategory]}` : "border-white/10 text-white/30 hover:text-white/60"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Memory blocks */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : memory.length === 0 ? (
          <div className="text-center py-16 text-white/20 space-y-3">
            <p>No brand memory blocks.</p>
            <p className="text-xs">Run the seed script or add blocks manually.</p>
            <code className="block text-xs bg-white/5 rounded px-3 py-2 text-emerald-300/60 font-mono max-w-md mx-auto">
              node ../scripts/seed-takers-ai.mjs
            </code>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(({ cat, label, items }) =>
              items.length === 0 ? null : (
                <div key={cat}>
                  <h2 className="text-xs font-bold uppercase tracking-widest text-white/20 mb-3">{label}</h2>
                  <div className="space-y-2">
                    {items.map((m) => (
                      <MemoryCard
                        key={m.id}
                        mem={m}
                        onEdit={setEditModal}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editModal !== null && (
        <EditModal
          mem={editModal === "new" ? null : editModal}
          onSave={() => {
            setEditModal(null);
            loadMemory();
          }}
          onClose={() => setEditModal(null)}
        />
      )}
    </div>
  );
}
