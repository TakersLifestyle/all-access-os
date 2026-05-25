"use client";

import { useEffect, useState, useCallback } from "react";
import { getAuth } from "firebase/auth";
import type { BrandMemory, MemoryCategory, MemoryVersion } from "@/lib/takers-ai/types";
import {
  MEMORY_CATEGORY_LABELS,
  MEMORY_CATEGORY_COLORS,
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

function PriorityBadge({ priority }: { priority: number }) {
  const color =
    priority >= 8 ? "text-red-400 border-red-600/30 bg-red-600/10" :
    priority >= 5 ? "text-amber-400 border-amber-600/30 bg-amber-600/10" :
    "text-white/30 border-white/10 bg-white/5";
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${color}`}>
      P{priority}
    </span>
  );
}

function VersionHistoryDrawer({
  memId,
  memTitle,
  onClose,
}: {
  memId: string;
  memTitle: string;
  onClose: () => void;
}) {
  const [versions, setVersions] = useState<MemoryVersion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch(`/api/takers-ai/memory?versions=${memId}`)
      .then((d) => setVersions(d.versions ?? []))
      .finally(() => setLoading(false));
  }, [memId]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#13131f] border border-white/10 rounded-2xl p-6 w-full max-w-xl max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div>
            <h3 className="font-bold text-white text-sm">Version History</h3>
            <p className="text-white/30 text-xs mt-0.5 truncate">{memTitle}</p>
          </div>
          <button onClick={onClose} className="text-white/20 hover:text-white/50 transition text-lg">✕</button>
        </div>
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-white/20 text-sm">Loading…</div>
        ) : versions.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-white/20 text-sm">
            No previous versions. Edits will be stored here.
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-3">
            {versions.map((v) => (
              <div key={v.id} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-white/60 text-xs font-bold">v{v.version}</span>
                  <span className="text-white/20 text-[10px]">
                    {new Date(v.updatedAt).toLocaleString("en-CA")}
                  </span>
                  {v.changeNote && (
                    <span className="text-white/30 text-[10px] italic truncate flex-1">{v.changeNote}</span>
                  )}
                </div>
                <p className="text-white/40 text-xs leading-relaxed whitespace-pre-wrap line-clamp-4">{v.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
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
  const [category, setCategory] = useState<MemoryCategory>(mem?.category ?? "brandVoice");
  const [key, setKey] = useState(mem?.key ?? "");
  const [priority, setPriority] = useState(mem?.priority ?? 5);
  const [changeNote, setChangeNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    try {
      if (mem) {
        await authFetch("/api/takers-ai/memory", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: mem.id, title, content, category, priority, changeNote: changeNote || undefined }),
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
            priority,
          }),
        });
      }
      onSave();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#13131f] border border-white/10 rounded-2xl p-6 w-full max-w-lg space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white">{mem ? "Edit Memory Block" : "New Memory Block"}</h3>
          <button onClick={onClose} className="text-white/20 hover:text-white/50 transition">✕</button>
        </div>

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
              placeholder="Key slug (auto-generated if blank)"
              className="col-span-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-red-500/50"
            />
          )}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as MemoryCategory)}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white/70 focus:outline-none focus:border-red-500/50"
          >
            {Object.entries(MEMORY_CATEGORY_LABELS).map(([k, label]) => (
              <option key={k} value={k} className="bg-[#13131f]">{label}</option>
            ))}
          </select>
          <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 flex items-center gap-3">
            <span className="text-white/30 text-xs shrink-0">Priority</span>
            <input
              type="range"
              min={1}
              max={10}
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              className="flex-1 accent-red-500"
            />
            <span className="text-white/60 text-sm font-bold w-4 text-right shrink-0">{priority}</span>
          </div>
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Memory content — injected into every agent system prompt as brand context…"
          rows={8}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 resize-none focus:outline-none focus:border-red-500/50 leading-relaxed"
        />

        {mem && (
          <input
            value={changeNote}
            onChange={(e) => setChangeNote(e.target.value)}
            placeholder="Change note (optional, stored in version history)…"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-red-500/50"
          />
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-xl border border-white/10 text-white/50 hover:text-white/70 text-sm transition">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim() || !content.trim() || saving}
            className="flex-1 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold text-sm transition"
          >
            {saving ? "Saving…" : mem ? "Save Changes" : "Create Block"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MemoryCard({
  mem,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  mem: BrandMemory;
  onEdit: (m: BrandMemory) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const categoryColor = MEMORY_CATEGORY_COLORS[mem.category] ?? "bg-white/5 border-white/10 text-white/40";

  return (
    <>
      <div className={`border rounded-xl overflow-hidden transition ${
        mem.isActive === false ? "opacity-50 border-white/[0.04]" : "border-white/[0.07]"
      } bg-white/[0.02]`}>
        <div
          className="flex items-start gap-3 px-4 py-3.5 cursor-pointer hover:bg-white/[0.02] transition"
          onClick={() => setExpanded((v) => !v)}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-white/80 text-sm font-semibold">{mem.title}</p>
              <PriorityBadge priority={mem.priority ?? 5} />
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${categoryColor}`}>
                {MEMORY_CATEGORY_LABELS[mem.category]}
              </span>
              {mem.version > 1 && (
                <span className="text-[10px] text-white/20">v{mem.version}</span>
              )}
              {mem.isActive === false && (
                <span className="text-[10px] text-white/20 border border-white/10 rounded px-1.5 py-0.5">inactive</span>
              )}
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
            <div className="flex gap-2 pt-1 flex-wrap">
              <button onClick={() => onEdit(mem)}
                className="text-xs px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/25 text-white/40 hover:text-white/70 transition">
                Edit
              </button>
              <button
                onClick={() => onToggleActive(mem.id, !(mem.isActive !== false))}
                className="text-xs px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/25 text-white/40 hover:text-white/70 transition"
              >
                {mem.isActive !== false ? "Deactivate" : "Activate"}
              </button>
              {mem.version > 1 && (
                <button
                  onClick={() => setShowVersions(true)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/25 text-white/40 hover:text-white/70 transition"
                >
                  History ({mem.version - 1})
                </button>
              )}
              <button onClick={() => onDelete(mem.id)}
                className="text-xs px-3 py-1.5 rounded-lg border border-red-600/20 hover:border-red-600/40 text-red-500/60 hover:text-red-400 transition">
                Delete
              </button>
              <span className="ml-auto text-white/15 text-[10px] self-center">
                Updated {new Date(mem.updatedAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        )}
      </div>

      {showVersions && (
        <VersionHistoryDrawer
          memId={mem.id}
          memTitle={mem.title}
          onClose={() => setShowVersions(false)}
        />
      )}
    </>
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

  async function handleToggleActive(id: string, isActive: boolean) {
    await authFetch("/api/takers-ai/memory", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isActive }),
    });
    setMemory((prev) => prev.map((m) => m.id === id ? { ...m, isActive } : m));
  }

  const filtered = filter === "all" ? memory : memory.filter((m) => m.category === filter);
  const activeCount = memory.filter((m) => m.isActive !== false).length;
  const tokenEstimate = memory
    .filter((m) => m.isActive !== false)
    .reduce((s, m) => s + Math.round(m.content.length / 4), 0);

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
              Injected into every AI conversation, priority-ordered. Deactivated blocks are skipped.
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
        <div className="flex items-center gap-4 text-sm text-white/30 flex-wrap">
          <span>{memory.length} total blocks · {activeCount} active</span>
          <span>·</span>
          <span>~{tokenEstimate.toLocaleString()} tokens injected</span>
          {memory.length > activeCount && (
            <>
              <span>·</span>
              <span className="text-white/20">{memory.length - activeCount} inactive</span>
            </>
          )}
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
              className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                filter === cat
                  ? MEMORY_CATEGORY_COLORS[cat as MemoryCategory]
                  : "border-white/10 text-white/30 hover:text-white/60"
              }`}
            >
              {label}
              <span className="ml-1 text-white/20">
                ({memory.filter((m) => m.category === cat).length})
              </span>
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
              cd functions && node ../scripts/seed-takers-ai.mjs
            </code>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(({ cat, label, items }) =>
              items.length === 0 ? null : (
                <div key={cat}>
                  <h2 className="text-xs font-bold uppercase tracking-widest text-white/20 mb-3 flex items-center gap-2">
                    {label}
                    <span className="text-white/10">({items.length})</span>
                  </h2>
                  <div className="space-y-2">
                    {items.map((m) => (
                      <MemoryCard
                        key={m.id}
                        mem={m}
                        onEdit={setEditModal}
                        onDelete={handleDelete}
                        onToggleActive={handleToggleActive}
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
