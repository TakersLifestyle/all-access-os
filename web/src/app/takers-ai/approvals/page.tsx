"use client";

import { useEffect, useState, useCallback } from "react";
import { getAuth } from "firebase/auth";
import type {
  ApprovalItem,
  ApprovalStatus,
  ApprovalType,
  ApprovalPriority,
} from "@/lib/takers-ai/types";
import {
  APPROVAL_TYPE_LABELS,
  APPROVAL_PRIORITY_COLORS,
  APPROVAL_STATUS_STYLES,
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

const TYPE_ICONS: Record<ApprovalType, string> = {
  email_send:      "📧",
  stripe_action:   "💳",
  public_publish:  "🌐",
  announcement:    "📢",
  content_publish: "📝",
  workflow_step:   "⚙️",
  other:           "◎",
};

function ReviewModal({
  item,
  onResolve,
  onClose,
}: {
  item: ApprovalItem;
  onResolve: (status: "approved" | "rejected", note: string) => Promise<void>;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAction(status: "approved" | "rejected") {
    setSaving(true);
    try {
      await onResolve(status, note);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#13131f] border border-white/10 rounded-2xl p-6 w-full max-w-xl space-y-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">{TYPE_ICONS[item.type]}</span>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-white truncate">{item.title}</h3>
            <p className="text-white/40 text-xs mt-0.5">{item.description}</p>
          </div>
          <button onClick={onClose} className="text-white/20 hover:text-white/50 text-lg transition shrink-0">✕</button>
        </div>

        <div className="bg-black/30 border border-white/[0.06] rounded-xl px-4 py-3 max-h-48 overflow-y-auto">
          <p className="text-white/60 text-xs leading-relaxed whitespace-pre-wrap">{item.content}</p>
        </div>

        {item.agentName && (
          <div className="flex items-center gap-2 text-xs text-white/30">
            <span>{AGENT_ROLE_ICONS[item.agentRole!] ?? "◎"}</span>
            <span>Requested by {item.agentName}</span>
            {item.workflowRunId && (
              <span className="font-mono text-white/20 text-[10px]">· run {item.workflowRunId.slice(0, 8)}</span>
            )}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-white/40 text-xs font-medium">Review note (optional)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Reason for approving or rejecting…"
            rows={3}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 resize-none focus:outline-none focus:border-red-500/40"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => handleAction("rejected")}
            disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-xl border border-red-600/30 hover:border-red-600/50 text-red-400 hover:text-red-300 font-bold text-sm transition disabled:opacity-40"
          >
            {saving ? "…" : "✕ Reject"}
          </button>
          <button
            onClick={() => handleAction("approved")}
            disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-sm transition"
          >
            {saving ? "…" : "✓ Approve"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ApprovalCard({
  item,
  onReview,
  onDelete,
}: {
  item: ApprovalItem;
  onReview: (item: ApprovalItem) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`border rounded-xl overflow-hidden ${
      item.status === "pending"
        ? "border-amber-600/20 bg-amber-950/5"
        : item.status === "approved"
        ? "border-emerald-600/15 bg-emerald-950/5"
        : "border-red-600/15 bg-red-950/5"
    }`}>
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="text-lg shrink-0">{TYPE_ICONS[item.type]}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-white/80 text-sm font-medium truncate">{item.title}</p>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${APPROVAL_PRIORITY_COLORS[item.priority as ApprovalPriority]}`}>
              {item.priority}
            </span>
          </div>
          <p className="text-white/30 text-xs mt-0.5 truncate">{item.description || APPROVAL_TYPE_LABELS[item.type]}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${APPROVAL_STATUS_STYLES[item.status as ApprovalStatus]}`}>
            {item.status}
          </span>
          {item.status === "pending" && (
            <button
              onClick={(e) => { e.stopPropagation(); onReview(item); }}
              className="text-xs px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 hover:border-white/25 text-white/50 hover:text-white transition"
            >
              Review
            </button>
          )}
          <span className={`text-white/20 text-xs transition-transform ${expanded ? "rotate-180" : ""}`}>▾</span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-white/[0.05] px-4 py-4 space-y-3">
          <div className="bg-black/20 rounded-xl px-3 py-2.5 max-h-32 overflow-y-auto">
            <p className="text-white/50 text-xs leading-relaxed whitespace-pre-wrap">{item.content}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-white/25 text-[10px] uppercase tracking-wider mb-1">Type</p>
              <p className="text-white/50">{APPROVAL_TYPE_LABELS[item.type]}</p>
            </div>
            <div>
              <p className="text-white/25 text-[10px] uppercase tracking-wider mb-1">Requested</p>
              <p className="text-white/50">{new Date(item.createdAt).toLocaleString("en-CA")}</p>
            </div>
            {item.agentName && (
              <div>
                <p className="text-white/25 text-[10px] uppercase tracking-wider mb-1">Agent</p>
                <p className="text-white/50">{item.agentName}</p>
              </div>
            )}
            {item.reviewedAt && (
              <div>
                <p className="text-white/25 text-[10px] uppercase tracking-wider mb-1">Reviewed</p>
                <p className="text-white/50">{new Date(item.reviewedAt).toLocaleString("en-CA")}</p>
              </div>
            )}
          </div>

          {item.reviewNote && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2">
              <p className="text-white/30 text-[10px] uppercase tracking-wider mb-1">Review Note</p>
              <p className="text-white/50 text-xs">{item.reviewNote}</p>
            </div>
          )}

          {item.expiresAt && (
            <p className="text-white/20 text-[10px]">
              Expires {new Date(item.expiresAt).toLocaleString("en-CA")}
            </p>
          )}

          <div className="flex items-center justify-between pt-1">
            {item.status === "pending" && (
              <button
                onClick={() => onReview(item)}
                className="text-xs px-3 py-1.5 rounded-lg bg-amber-600/15 border border-amber-600/25 text-amber-300 hover:bg-amber-600/25 transition"
              >
                Review Now
              </button>
            )}
            <button
              onClick={() => onDelete(item.id)}
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

export default function ApprovalsPage() {
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | "all">("all");
  const [reviewItem, setReviewItem] = useState<ApprovalItem | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      const data = await authFetch(`/api/takers-ai/approvals${params}`);
      setItems(data.items ?? []);
      setCounts(data.counts ?? { pending: 0, approved: 0, rejected: 0 });
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function handleResolve(status: "approved" | "rejected", reviewNote: string) {
    if (!reviewItem) return;
    await authFetch("/api/takers-ai/approvals", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: reviewItem.id, status, reviewNote }),
    });
    setReviewItem(null);
    load();
  }

  async function handleDelete(id: string) {
    await authFetch(`/api/takers-ai/approvals?id=${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.id !== id));
    setCounts((prev) => ({ ...prev }));
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              Approval Queue
              {counts.pending > 0 && (
                <span className="text-sm font-normal px-2 py-0.5 rounded-full bg-amber-600/20 border border-amber-600/30 text-amber-300">
                  {counts.pending} pending
                </span>
              )}
            </h1>
            <p className="text-white/30 text-sm mt-0.5">
              Review and approve critical actions before they execute.
              Email sends, Stripe writes, public publishing, announcements.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={load} disabled={loading}
              className="text-xs px-3 py-1.5 border border-white/10 hover:border-white/25 rounded-lg text-white/40 hover:text-white transition disabled:opacity-40">
              {loading ? "Loading…" : "Refresh"}
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="text-xs px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded-lg text-white font-bold transition"
            >
              + Add Item
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-amber-950/10 border border-amber-600/15 rounded-xl p-4">
            <p className="text-white/25 text-[10px] uppercase tracking-wider mb-1">Pending</p>
            <p className="text-amber-400 text-xl font-bold">{counts.pending}</p>
          </div>
          <div className="bg-emerald-950/10 border border-emerald-600/15 rounded-xl p-4">
            <p className="text-white/25 text-[10px] uppercase tracking-wider mb-1">Approved</p>
            <p className="text-emerald-400 text-xl font-bold">{counts.approved}</p>
          </div>
          <div className="bg-red-950/10 border border-red-600/15 rounded-xl p-4">
            <p className="text-white/25 text-[10px] uppercase tracking-wider mb-1">Rejected</p>
            <p className="text-red-400 text-xl font-bold">{counts.rejected}</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          {(["all", "pending", "approved", "rejected"] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition capitalize ${
                statusFilter === s
                  ? "bg-red-600/20 border-red-600/30 text-red-300"
                  : "border-white/10 text-white/30 hover:text-white/60"
              }`}>
              {s === "all" ? "All" : s}
              {s !== "all" && (
                <span className="ml-1 text-white/20">
                  ({counts[s as ApprovalStatus]})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Items */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <p className="text-white/20">
              {statusFilter === "pending"
                ? "No pending approvals. The queue is clear."
                : "No items match this filter."}
            </p>
            <p className="text-white/10 text-xs">
              Approval items are created when agents or workflows flag an action that needs review.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <ApprovalCard
                key={item.id}
                item={item}
                onReview={setReviewItem}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Review modal */}
      {reviewItem && (
        <ReviewModal
          item={reviewItem}
          onResolve={handleResolve}
          onClose={() => setReviewItem(null)}
        />
      )}

      {/* Quick create modal */}
      {showCreateModal && (
        <CreateApprovalModal
          onSave={() => { setShowCreateModal(false); load(); }}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}

function CreateApprovalModal({ onSave, onClose }: { onSave: () => void; onClose: () => void }) {
  const [form, setForm] = useState({
    type: "other" as ApprovalType,
    title: "",
    description: "",
    content: "",
    priority: "medium" as ApprovalPriority,
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.title.trim() || !form.content.trim()) return;
    setSaving(true);
    try {
      await authFetch("/api/takers-ai/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      onSave();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#13131f] border border-white/10 rounded-2xl p-6 w-full max-w-lg space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white">New Approval Item</h3>
          <button onClick={onClose} className="text-white/20 hover:text-white/50 transition">✕</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            placeholder="Title…"
            className="col-span-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-red-500/50"
          />
          <select
            value={form.type}
            onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as ApprovalType }))}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/70 focus:outline-none"
          >
            {Object.entries(APPROVAL_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k} className="bg-[#13131f]">{v}</option>
            ))}
          </select>
          <select
            value={form.priority}
            onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value as ApprovalPriority }))}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/70 focus:outline-none"
          >
            {(["low", "medium", "high", "critical"] as const).map((p) => (
              <option key={p} value={p} className="bg-[#13131f]">{p}</option>
            ))}
          </select>
          <input
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            placeholder="Short description…"
            className="col-span-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-red-500/50"
          />
        </div>
        <textarea
          value={form.content}
          onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
          placeholder="Full content to review (email body, announcement text, etc.)…"
          rows={6}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 resize-none focus:outline-none focus:border-red-500/50 leading-relaxed"
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-xl border border-white/10 text-white/50 text-sm transition">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!form.title.trim() || !form.content.trim() || saving}
            className="flex-1 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold text-sm transition"
          >
            {saving ? "Saving…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
