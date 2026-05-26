"use client";

import { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getAuth } from "firebase/auth";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import type {
  Agent, PromptTemplate, ChatMessage, OutputType, AgentRole,
  FeedbackRating,
} from "@/lib/takers-ai/types";
import { OUTPUT_TYPE_LABELS, AGENT_ROLE_LABELS, AGENT_ROLE_COLORS, AGENT_ROLE_ICONS } from "@/lib/takers-ai/types";
import {
  classifyFile,
  validateFile,
  formatFileSize,
  buildStoragePath,
  type AttachmentMeta,
  type AttachmentFileType,
} from "@/lib/takers-ai/attachments";

// ── Attachment upload state ───────────────────────────────────────────────────

interface AttachmentUpload {
  id: string;
  file: File;
  name: string;
  mimeType: string;
  size: number;
  fileType: AttachmentFileType;
  status: "pending" | "uploading" | "ready" | "error";
  progress: number;        // 0–100
  previewUrl?: string;     // object URL for image thumbnails
  meta?: AttachmentMeta;   // populated on successful upload
  errorMsg?: string;
}

// ── File type icons (no external deps) ───────────────────────────────────────

const FILE_TYPE_ICON: Record<AttachmentFileType, string> = {
  image:    "🖼",
  pdf:      "📄",
  document: "📝",
  text:     "📋",
};

// ── Attachment preview row ────────────────────────────────────────────────────

function AttachmentChip({
  upload,
  onRemove,
}: {
  upload: AttachmentUpload;
  onRemove: (id: string) => void;
}) {
  const isImage = upload.fileType === "image";

  return (
    <div className="relative group flex-shrink-0">
      <div
        className={`flex items-center gap-2 rounded-xl border text-xs transition-colors ${
          upload.status === "error"
            ? "border-red-500/40 bg-red-500/10"
            : upload.status === "ready"
            ? "border-white/15 bg-white/[0.06]"
            : "border-white/10 bg-white/[0.03]"
        }`}
        style={{ maxWidth: 180 }}
      >
        {/* Thumbnail or icon */}
        {isImage && upload.previewUrl ? (
          <div className="w-10 h-10 rounded-l-xl overflow-hidden flex-shrink-0 bg-white/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={upload.previewUrl}
              alt={upload.name}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="w-10 h-10 rounded-l-xl flex items-center justify-center flex-shrink-0 bg-white/5 text-base">
            {FILE_TYPE_ICON[upload.fileType]}
          </div>
        )}

        {/* Name + size */}
        <div className="flex-1 min-w-0 py-2 pr-1">
          <p className="text-white/70 truncate font-medium leading-tight" style={{ maxWidth: 100 }}>
            {upload.name}
          </p>
          <p className="text-white/30 leading-tight mt-0.5">
            {upload.status === "uploading"
              ? `${Math.round(upload.progress)}%`
              : upload.status === "error"
              ? upload.errorMsg ?? "Upload failed"
              : formatFileSize(upload.size)}
          </p>
        </div>

        {/* Remove button */}
        <button
          onClick={() => onRemove(upload.id)}
          className="w-5 h-5 mr-1.5 rounded-full flex items-center justify-center text-white/20 hover:text-white/70 hover:bg-white/10 transition flex-shrink-0"
          title="Remove attachment"
        >
          ×
        </button>
      </div>

      {/* Upload progress bar */}
      {upload.status === "uploading" && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-xl overflow-hidden bg-white/10">
          <div
            className="h-full bg-red-500 transition-all duration-200"
            style={{ width: `${upload.progress}%` }}
          />
        </div>
      )}

      {/* Ready checkmark */}
      {upload.status === "ready" && (
        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border border-[#13131f] flex items-center justify-center">
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M1.5 4L3 5.5L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      )}

      {/* Error dot */}
      {upload.status === "error" && (
        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 border border-[#13131f] flex items-center justify-center text-white text-[8px] font-bold">
          !
        </div>
      )}
    </div>
  );
}

function AttachmentPreviewRow({
  uploads,
  onRemove,
}: {
  uploads: AttachmentUpload[];
  onRemove: (id: string) => void;
}) {
  if (uploads.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 px-4 pt-3 pb-1">
      {uploads.map((u) => (
        <AttachmentChip key={u.id} upload={u} onRemove={onRemove} />
      ))}
    </div>
  );
}

async function getToken() {
  return (await getAuth().currentUser?.getIdToken()) ?? "";
}
async function authFetch(path: string, opts: RequestInit = {}) {
  const token = await getToken();
  const res = await fetch(path, {
    ...opts,
    headers: { ...((opts.headers as Record<string, string>) ?? {}), Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Conversation sidebar types + component ───────────────────────────────────

interface ConvSummary {
  id: string;
  title: string;
  lastMessage?: string;
  agentRole?: string;
  agentName?: string;
  messageCount?: number;
  updatedAt?: string;
  createdAt?: string;
}

function relativeTime(iso?: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

function ConversationSidebar({
  conversations,
  activeConvId,
  search,
  loading,
  onSearch,
  onSelect,
  onNewChat,
  onDelete,
}: {
  conversations: ConvSummary[];
  activeConvId: string;
  search: string;
  loading: boolean;
  onSearch: (q: string) => void;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDelete: (id: string) => void;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = search.trim()
    ? conversations.filter(
        (c) =>
          c.title.toLowerCase().includes(search.toLowerCase()) ||
          (c.lastMessage ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : conversations;

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm("Delete this conversation?")) return;
    setDeletingId(id);
    try {
      await authFetch(`/api/takers-ai/conversations?id=${id}`, { method: "DELETE" });
      onDelete(id);
    } catch {
      /* ignore */
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col w-64 shrink-0 border-r border-white/[0.07] bg-[#0a0a12] h-full">
      {/* Header */}
      <div className="h-14 flex items-center gap-2 px-3 border-b border-white/[0.07] shrink-0">
        <button
          onClick={onNewChat}
          className="flex-1 flex items-center gap-2 text-xs text-white/40 hover:text-white/80 px-2 py-1.5 rounded-lg hover:bg-white/5 transition border border-transparent hover:border-white/10"
        >
          <span className="text-sm">+</span>
          <span>New chat</span>
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-white/[0.05] shrink-0">
        <input
          type="text"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search chats…"
          className="w-full bg-white/[0.04] border border-white/[0.07] rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-white/20 transition"
        />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-1">
        {loading && filtered.length === 0 && (
          <div className="space-y-1 px-2 pt-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 rounded-lg bg-white/[0.03] animate-pulse" />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <span className="text-2xl mb-2 opacity-30">◎</span>
            <p className="text-white/20 text-xs">
              {search ? "No matching chats" : "No conversations yet"}
            </p>
            {!search && (
              <p className="text-white/15 text-[11px] mt-1">Start chatting to save history</p>
            )}
          </div>
        )}

        {filtered.map((conv) => {
          const isActive = conv.id === activeConvId;
          return (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg mx-1 group relative transition ${
                isActive
                  ? "bg-red-600/15 border border-red-600/20"
                  : "hover:bg-white/[0.04] border border-transparent"
              }`}
              style={{ width: "calc(100% - 8px)" }}
            >
              <div className="flex items-start justify-between gap-1">
                <p className={`text-xs font-medium truncate leading-tight ${isActive ? "text-white/90" : "text-white/55 group-hover:text-white/75"}`}>
                  {conv.title || "Untitled chat"}
                </p>
                <span className="text-[10px] text-white/20 shrink-0 mt-0.5">
                  {relativeTime(conv.updatedAt)}
                </span>
              </div>
              {conv.lastMessage && (
                <p className="text-[11px] text-white/20 truncate mt-0.5 leading-tight">
                  {conv.lastMessage}
                </p>
              )}
              {conv.agentName && (
                <p className="text-[10px] text-white/15 mt-0.5">{conv.agentName}</p>
              )}
              {/* Delete button */}
              <button
                onClick={(e) => handleDelete(e, conv.id)}
                disabled={deletingId === conv.id}
                className="absolute right-2 top-2.5 opacity-0 group-hover:opacity-100 w-5 h-5 rounded flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-red-400/10 transition text-xs"
                title="Delete conversation"
              >
                {deletingId === conv.id ? "…" : "×"}
              </button>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Routing indicator ─────────────────────────────────────────────────────────
function RoutingBadge({ role, name, reason }: { role: AgentRole; name: string; reason: string }) {
  const [showReason, setShowReason] = useState(false);
  const color = AGENT_ROLE_COLORS[role] ?? "bg-white/10";
  const icon = AGENT_ROLE_ICONS[role] ?? "◎";
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="flex-1 h-px bg-white/[0.05]" />
      <button
        onClick={() => setShowReason((v) => !v)}
        className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full border border-white/10 ${color} bg-opacity-15 text-white/50 hover:text-white/80 transition`}
      >
        <span>{icon}</span>
        <span>Routed → {name}</span>
        <span className="text-white/25 ml-0.5">{showReason ? "▴" : "▾"}</span>
      </button>
      <div className="flex-1 h-px bg-white/[0.05]" />
      {showReason && (
        <div className="absolute mt-6 z-10 left-1/2 -translate-x-1/2 bg-[#1a1a2e] border border-white/10 rounded-xl px-3 py-2 text-xs text-white/40 max-w-xs shadow-xl">
          {reason}
        </div>
      )}
    </div>
  );
}

// ── Feedback buttons ─────────────────────────────────────────────────────────
function FeedbackButtons({
  messageContent,
  agentId,
  agentRole,
  agentName,
  conversationId,
  workflowRunId,
}: {
  messageContent: string;
  agentId: string;
  agentRole: AgentRole;
  agentName: string;
  conversationId?: string;
  workflowRunId?: string;
}) {
  const [given, setGiven] = useState<FeedbackRating | null>(null);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  async function submitFeedback(rating: FeedbackRating, finalComment?: string) {
    if (given) return;
    setSaving(true);
    try {
      await authFetch("/api/takers-ai/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId, agentRole, agentName,
          conversationId, workflowRunId,
          messageContent,
          rating,
          comment: finalComment ?? "",
        }),
      });
      setGiven(rating);
      setShowComment(false);
    } finally {
      setSaving(false);
    }
  }

  if (given) {
    return (
      <span className="text-[11px] text-white/20">
        {given === "positive" ? "👍 Thanks" : "👎 Noted"}
      </span>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-1">
        <button
          onClick={() => submitFeedback("positive")}
          disabled={saving}
          className="text-[11px] text-white/20 hover:text-emerald-400 transition px-1"
          title="Good response"
        >👍</button>
        <button
          onClick={() => setShowComment((v) => !v)}
          disabled={saving}
          className="text-[11px] text-white/20 hover:text-red-400 transition px-1"
          title="Poor response"
        >👎</button>
      </div>
      {showComment && (
        <div className="absolute bottom-6 left-0 z-10 bg-[#1a1a2e] border border-white/10 rounded-xl p-3 w-64 shadow-xl space-y-2">
          <p className="text-white/40 text-xs">What was wrong?</p>
          <textarea
            autoFocus
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Optional comment…"
            rows={2}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white placeholder-white/20 resize-none focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setShowComment(false)}
              className="flex-1 text-xs py-1 rounded-lg border border-white/10 text-white/30 hover:text-white/60 transition"
            >Cancel</button>
            <button
              onClick={() => submitFeedback("negative", comment)}
              disabled={saving}
              className="flex-1 text-xs py-1 rounded-lg bg-red-600/30 border border-red-600/40 text-red-300 hover:bg-red-600/40 transition"
            >Submit</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Save output modal ─────────────────────────────────────────────────────────
function SaveOutputModal({
  content, agentId, agentRole, onSave, onClose,
}: {
  content: string; agentId: string; agentRole: AgentRole; onSave: () => void; onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<OutputType>("other");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await authFetch("/api/takers-ai/outputs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, agentRole, title, content, type }),
      });
      onSave();
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#13131f] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4">
        <h3 className="font-bold text-white">Save Output</h3>
        <input autoFocus type="text" value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="Title for this output…"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-red-500/50" />
        <select value={type} onChange={(e) => setType(e.target.value as OutputType)}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white/70 focus:outline-none">
          {Object.entries(OUTPUT_TYPE_LABELS).map(([k, label]) => (
            <option key={k} value={k} className="bg-[#13131f]">{label}</option>
          ))}
        </select>
        <div className="bg-white/[0.03] rounded-xl p-3 max-h-32 overflow-y-auto">
          <p className="text-white/30 text-xs">{content.slice(0, 200)}…</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-xl border border-white/10 text-white/50 text-sm transition hover:text-white/70">Cancel</button>
          <button onClick={handleSave} disabled={!title.trim() || saving}
            className="flex-1 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold text-sm transition">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Template picker ───────────────────────────────────────────────────────────
function TemplatePicker({ templates, onSelect, onClose }: {
  templates: PromptTemplate[]; onSelect: (p: string) => void; onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = templates.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()) || t.category.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#13131f] border border-white/10 rounded-2xl w-full max-w-lg max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
          <h3 className="font-bold text-white text-sm">Prompt Templates</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 text-xl leading-none">×</button>
        </div>
        <div className="px-4 py-3 border-b border-white/[0.05]">
          <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates…"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none" />
        </div>
        <div className="overflow-y-auto flex-1 p-3 space-y-2">
          {filtered.length === 0 ? (
            <p className="text-center text-white/20 text-sm py-8">No templates found.</p>
          ) : filtered.map((t) => (
            <button key={t.id} onClick={() => onSelect(t.prompt)}
              className="w-full text-left flex items-start gap-3 px-4 py-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] hover:border-white/10 transition group">
              <div className="flex-1 min-w-0">
                <p className="text-white/70 text-sm font-medium group-hover:text-white transition">{t.name}</p>
                <p className="text-white/30 text-xs mt-0.5">{t.description || t.category}</p>
              </div>
              <span className="text-white/20 group-hover:text-white/50 transition text-sm shrink-0">→</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Extended message type for UI ──────────────────────────────────────────────
interface UIMessage extends ChatMessage {
  routingInfo?: {
    routedToRole: AgentRole;
    routedToAgentId: string;
    routedToName: string;
    routingReason: string;
    workflowRunId?: string;
  };
}

// ── Creative action bar ───────────────────────────────────────────────────────
// Detects creative output (canva prompts, image prompts, flyer concepts)
// and surfaces copy + save buttons for each actionable section.

const CANVA_PROMPT_RE = /(?:\*{1,2}CANVA(?:[- ]READY)?(?:\s+DESIGN)?\s*PROMPT\*{0,2}|Canva(?:[- ]ready)?\s+(?:Design\s+)?Prompt)[\s:*]+([^\n*]{20,})/i;
const IMAGE_PROMPT_RE = /(?:\*{1,2}IMAGE(?:\s+GEN(?:ERATION)?)?\s*PROMPT\*{0,2}|(?:DALL-?E|Midjourney|Flux|Stable\s+Diffusion)\s+Prompt|Image\s+Gen(?:eration)?\s+Prompt)[\s:*]+([^\n*]{20,})/i;
const CREATIVE_ROLES = new Set(["creative", "content", "marketing", "image"]);
const CREATIVE_PATTERNS = [
  /canva(?:[- ]ready)?\s+prompt/i,
  /image\s+gen(?:eration)?\s+prompt/i,
  /dall-?e\s+prompt/i,
  /midjourney\s+prompt/i,
  /\*{1,2}concept\s+[1-4]\*{0,2}/i,
  /\*{1,2}headline\*{0,2}:/i,
  /ready_to_render/i,
];

function isCreativeOutput(content: string, agentRole?: string): boolean {
  if (agentRole && CREATIVE_ROLES.has(agentRole)) {
    return CREATIVE_PATTERNS.some((p) => p.test(content));
  }
  return CREATIVE_PATTERNS.filter((p) => p.test(content)).length >= 2;
}

function extractPromptSection(content: string, re: RegExp): string | null {
  const match = content.match(re);
  if (!match) return null;
  // Return up to 800 chars after the match heading, trimmed
  const start = content.indexOf(match[1] ?? "");
  if (start === -1) return null;
  const raw = content.slice(start, start + 800).split("\n\n")[0].trim();
  return raw.length > 10 ? raw : null;
}

function CreativeActionBar({
  content,
  agentRole,
  agentId,
  conversationId,
}: {
  content: string;
  agentRole?: string;
  agentId?: string;
  conversationId?: string;
}) {
  const [canvaCopied, setCanvaCopied] = useState(false);
  const [imgCopied, setImgCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const canvaPrompt = extractPromptSection(content, CANVA_PROMPT_RE);
  const imagePrompt = extractPromptSection(content, IMAGE_PROMPT_RE);
  const hasActions = canvaPrompt || imagePrompt;

  if (!hasActions) return null;

  function copyCanva() {
    if (!canvaPrompt) return;
    navigator.clipboard.writeText(canvaPrompt);
    setCanvaCopied(true);
    setTimeout(() => setCanvaCopied(false), 2000);
  }

  function copyImage() {
    if (!imagePrompt) return;
    navigator.clipboard.writeText(imagePrompt);
    setImgCopied(true);
    setTimeout(() => setImgCopied(false), 2000);
  }

  async function saveAsset() {
    setSaving(true);
    setSaveError(null);
    try {
      const token = await getToken();
      const res = await fetch("/api/takers-ai/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          assetType: "creative_brief",
          title: `Creative Package — ${new Date().toLocaleDateString("en-CA")}`,
          content,
          renderStatus: "ready_to_render",
          agentId: agentId ?? null,
          conversationId: conversationId ?? null,
          tags: ["creative", agentRole ?? "creative"],
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
      setTimeout(() => setSaveError(null), 4000);
    } finally {
      setSaving(false);
    }
  }

  function openInBing() {
    if (!imagePrompt) return;
    const url = `https://www.bing.com/images/create?q=${encodeURIComponent(imagePrompt.slice(0, 480))}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function openInCanva() {
    // Copy prompt then open Canva
    if (canvaPrompt) navigator.clipboard.writeText(canvaPrompt);
    window.open("https://www.canva.com/create/", "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mt-2 px-1">
      {/* Render buttons — generate actual images */}
      {imagePrompt && (
        <button
          onClick={openInBing}
          className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-300 hover:text-violet-100 hover:border-violet-400/50 hover:bg-violet-500/20 transition font-medium"
        >
          <span>🖼</span>
          <span>Render in Bing</span>
        </button>
      )}
      {canvaPrompt && (
        <button
          onClick={openInCanva}
          className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border border-purple-500/25 bg-purple-500/[0.08] text-purple-300/70 hover:text-purple-200 hover:border-purple-400/40 hover:bg-purple-500/15 transition"
        >
          <span>🎨</span>
          <span>Open Canva</span>
        </button>
      )}
      {/* Copy buttons */}
      {canvaPrompt && (
        <button
          onClick={copyCanva}
          className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/[0.03] text-white/40 hover:text-white/70 hover:border-white/20 transition"
        >
          <span>{canvaCopied ? "✓" : "📋"}</span>
          <span>{canvaCopied ? "Canva Copied!" : "Copy Canva Prompt"}</span>
        </button>
      )}
      {imagePrompt && (
        <button
          onClick={copyImage}
          className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/[0.03] text-white/40 hover:text-white/70 hover:border-white/20 transition"
        >
          <span>{imgCopied ? "✓" : "📋"}</span>
          <span>{imgCopied ? "Prompt Copied!" : "Copy Image Prompt"}</span>
        </button>
      )}
      <button
        onClick={saveAsset}
        disabled={saving || saved}
        className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-300/70 hover:text-emerald-200 hover:border-emerald-400/40 hover:bg-emerald-500/15 transition disabled:opacity-40"
      >
        <span>{saved ? "✓" : saving ? "…" : "💾"}</span>
        <span>{saved ? "Asset Saved!" : saving ? "Saving…" : "Save Asset"}</span>
      </button>
      {saveError && (
        <span className="text-[10px] text-red-400/70">{saveError}</span>
      )}
    </div>
  );
}

// ── Inline image render widget ────────────────────────────────────────────────
// Appears on image-agent responses. Calls generate-image in fast-path mode
// (skipBrief=true) — no Sonnet brief generation, direct provider render.

function ImageRenderWidget({
  imagePrompt,
  subject,
  agentId,
  conversationId,
}: {
  imagePrompt: string;
  subject?: string;
  agentId?: string;
  conversationId?: string;
}) {
  const [state, setState] = useState<"idle" | "loading" | "rendered" | "no_provider" | "error">("idle");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [stageMsg, setStageMsg] = useState("Connecting to image provider…");

  async function generate() {
    setState("loading");
    setStageMsg("Connecting to image provider…");
    try {
      const token = await getToken();
      const res = await fetch("/api/takers-ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          subject: subject || "Creative asset for ALL ACCESS Winnipeg",
          skipBrief: true,
          directPrompt: imagePrompt,
          agentId: agentId ?? null,
          conversationId: conversationId ?? null,
        }),
      });

      if (!res.ok || !res.body) {
        setState("no_provider");
        return;
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.type === "stage") setStageMsg(ev.message ?? stageMsg);
            if (ev.type === "render") {
              if (ev.renderStatus === "rendered" && ev.url) {
                setImageUrl(ev.url);
                setState("rendered");
              } else {
                setState("no_provider");
              }
            }
            if (ev.type === "fatal") { setState("error"); setStageMsg(ev.error ?? "Provider error"); }
          } catch { /* ignore partial lines */ }
        }
      }
      // If stream ended with no render event
      if (state === "loading") setState("no_provider");
    } catch {
      setState("no_provider");
    }
  }

  function openInBingDirect() {
    window.open(`https://www.bing.com/images/create?q=${encodeURIComponent(imagePrompt.slice(0, 480))}`, "_blank", "noopener,noreferrer");
  }

  if (state === "idle") {
    return (
      <div className="flex items-center gap-2 mt-1.5 px-1">
        <button
          onClick={generate}
          className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg border border-violet-500/40 bg-violet-600/15 text-violet-200 hover:bg-violet-600/25 hover:border-violet-400/60 transition font-medium"
        >
          <span>⚡</span>
          <span>Generate Image Now</span>
        </button>
        <span className="text-white/15 text-[10px]">or</span>
        <button
          onClick={openInBingDirect}
          className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.03] text-white/40 hover:text-white/70 transition"
        >
          <span>🖼</span>
          <span>Render in Bing</span>
        </button>
      </div>
    );
  }

  if (state === "loading") {
    return (
      <div className="flex items-center gap-2 mt-1.5 px-1 text-[11px] text-white/40">
        <span className="animate-spin">⟳</span>
        <span>{stageMsg}</span>
      </div>
    );
  }

  if (state === "rendered" && imageUrl) {
    return (
      <div className="mt-2 space-y-2 px-1">
        <div className="rounded-xl overflow-hidden border border-white/10 max-w-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="Generated image" className="w-full" />
        </div>
        <div className="flex items-center gap-2">
          <a
            href={imageUrl}
            download="allaccess-generated.png"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition"
          >
            <span>⬇</span>
            <span>Download PNG</span>
          </a>
          <button
            onClick={generate}
            className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.03] text-white/40 hover:text-white/70 transition"
          >
            <span>↺</span>
            <span>Regenerate</span>
          </button>
        </div>
      </div>
    );
  }

  // no_provider or error
  return (
    <div className="mt-1.5 px-1 space-y-1.5">
      <p className="text-[10px] text-amber-400/60">
        {state === "error" ? stageMsg : "No image provider connected."}{" "}
        Add <code className="text-amber-300/70">OPENAI_API_KEY</code> to Vercel to render images in-platform.
      </p>
      <button
        onClick={openInBingDirect}
        className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 transition"
      >
        <span>🖼</span>
        <span>Render Free in Bing Image Creator</span>
      </button>
    </div>
  );
}

// ── Image generation quick-action panel ──────────────────────────────────────
// Shown above the input bar when Creative Image Agent is active.
// Chips set a starter phrase in the input so the user can complete the request.

const IMAGE_QUICK_ACTIONS = [
  { icon: "🖼", label: "Generate Flyer",     text: "Generate a complete flyer package for " },
  { icon: "📱", label: "Instagram Post",     text: "Create an Instagram post graphic for " },
  { icon: "📲", label: "Instagram Story",    text: "Design an Instagram story for " },
  { icon: "🎬", label: "TikTok Cover",       text: "Generate a TikTok cover graphic for " },
  { icon: "✨", label: "4 Concepts",         text: "Generate 4 full creative concepts for " },
  { icon: "🖨", label: "Print Poster",       text: "Design a print-ready event poster for " },
];

function ImageGenerationPanel({
  onAction,
  onOpenFilePicker,
}: {
  onAction: (text: string) => void;
  onOpenFilePicker: () => void;
}) {
  return (
    <div className="space-y-2 max-w-3xl mx-auto pb-1">
      {/* Quick action chips */}
      <div className="flex flex-wrap gap-2">
        {IMAGE_QUICK_ACTIONS.map((a) => (
          <button
            key={a.label}
            onClick={() => onAction(a.text)}
            className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg border border-violet-500/25 bg-violet-500/[0.08] text-violet-300/70 hover:text-violet-200 hover:border-violet-400/40 hover:bg-violet-500/15 transition"
          >
            <span>{a.icon}</span>
            <span>{a.label}</span>
          </button>
        ))}
        <button
          onClick={onOpenFilePicker}
          className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg border border-blue-500/25 bg-blue-500/[0.08] text-blue-300/70 hover:text-blue-200 hover:border-blue-400/40 hover:bg-blue-500/15 transition"
        >
          <span>📎</span>
          <span>Use Reference Image</span>
        </button>
      </div>
      {/* Provider status notice */}
      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-amber-500/[0.06] border border-amber-500/15 text-[10px] text-amber-400/60">
        <span>⚡</span>
        <span>
          <strong>Render images:</strong> After generating, click &ldquo;Render in Bing&rdquo; button on the response — or add{" "}
          <code className="text-amber-300/70">OPENAI_API_KEY</code> to Vercel for in-platform DALL-E rendering.
        </span>
      </div>
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────
function MessageBubble({
  msg, allAgents, conversationId,
  onSave,
}: {
  msg: UIMessage;
  allAgents: Agent[];
  conversationId?: string;
  onSave: (content: string, agentId: string, agentRole: AgentRole) => void;
}) {
  const [copied, setCopied] = useState(false);
  const isUser = msg.role === "user";
  const respondingAgent = msg.agentId ? allAgents.find((a) => a.id === msg.agentId) : null;
  const agentIcon = respondingAgent ? AGENT_ROLE_ICONS[respondingAgent.role as AgentRole] : "◎";
  const agentColor = respondingAgent ? AGENT_ROLE_COLORS[respondingAgent.role as AgentRole] : "bg-red-600";
  const showCreativeActions = !isUser && isCreativeOutput(msg.content, msg.agentRole);

  function handleCopy() {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-1">
      {/* Routing indicator above assistant message */}
      {!isUser && msg.routingInfo && msg.routingInfo.routedToRole !== "operator" && (
        <div className="relative">
          <RoutingBadge
            role={msg.routingInfo.routedToRole}
            name={msg.routingInfo.routedToName}
            reason={msg.routingInfo.routingReason}
          />
        </div>
      )}

      <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"} group`}>
        {!isUser && (
          <div className={`w-8 h-8 rounded-lg ${agentColor} bg-opacity-20 border border-white/10 flex items-center justify-center text-sm shrink-0 mt-0.5`}>
            {agentIcon}
          </div>
        )}

        <div className={`max-w-[78%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
          {respondingAgent && !isUser && (
            <span className="text-[10px] text-white/20 px-1">{respondingAgent.name}</span>
          )}
          <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
            isUser
              ? "bg-red-600/20 border border-red-600/25 text-white/90 rounded-tr-sm"
              : "bg-white/[0.04] border border-white/[0.08] text-white/80 rounded-tl-sm"
          }`}>
            {msg.content}
          </div>

          {/* Creative action buttons — shown when creative output detected */}
          {showCreativeActions && (
            <>
              <CreativeActionBar
                content={msg.content}
                agentRole={msg.agentRole}
                agentId={msg.agentId}
                conversationId={conversationId}
              />
              {/* Inline image render — only for image agent responses */}
              {msg.agentRole === "image" && (() => {
                const imgPrompt = extractPromptSection(msg.content, IMAGE_PROMPT_RE);
                if (!imgPrompt) return null;
                return (
                  <ImageRenderWidget
                    imagePrompt={imgPrompt}
                    subject={msg.content.slice(0, 80)}
                    agentId={msg.agentId}
                    conversationId={conversationId}
                  />
                );
              })()}
            </>
          )}

          {!isUser && (
            <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition px-1">
              <button onClick={handleCopy} className="text-[11px] text-white/25 hover:text-white/60 transition">
                {copied ? "✓ Copied" : "Copy"}
              </button>
              <span className="text-white/10">·</span>
              <button
                onClick={() => onSave(msg.content, msg.agentId ?? "", msg.agentRole ?? "operator")}
                className="text-[11px] text-white/25 hover:text-red-400 transition"
              >
                Save output
              </button>
              <span className="text-white/10">·</span>
              <FeedbackButtons
                messageContent={msg.content}
                agentId={msg.agentId ?? ""}
                agentRole={msg.agentRole ?? "operator"}
                agentName={respondingAgent?.name ?? "Agent"}
                conversationId={conversationId}
                workflowRunId={msg.routingInfo?.workflowRunId}
              />
            </div>
          )}
        </div>

        {isUser && (
          <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/30 text-xs shrink-0 mt-0.5">
            T
          </div>
        )}
      </div>
    </div>
  );
}

// ── Chat inner ────────────────────────────────────────────────────────────────
function ChatInner() {
  const searchParams = useSearchParams();
  const initialAgentId = searchParams.get("agentId") ?? "";
  const initialConvId = searchParams.get("convId") ?? "";
  const initialPrompt = searchParams.get("prompt") ?? "";

  const [agents, setAgents] = useState<Agent[]>([]);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState(initialAgentId);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState(initialPrompt ? decodeURIComponent(initialPrompt) : "");
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streamingAgent, setStreamingAgent] = useState<{ role: AgentRole; name: string } | null>(null);
  const [conversationId, setConversationId] = useState(initialConvId || "");
  const [showTemplates, setShowTemplates] = useState(false);
  const [saveModal, setSaveModal] = useState<{ content: string; agentId: string; agentRole: AgentRole } | null>(null);
  const [savedToast, setSavedToast] = useState(false);
  const [loadingConv, setLoadingConv] = useState(false);

  // ── Conversation sidebar state ──────────────────────────────────────────────
  const [showConvSidebar, setShowConvSidebar] = useState(true);
  const [recentConvs, setRecentConvs] = useState<ConvSummary[]>([]);
  const [convSearch, setConvSearch] = useState("");
  const [convsLoading, setConvsLoading] = useState(false);

  // ── Attachment state ────────────────────────────────────────────────────────
  const [attachments, setAttachments] = useState<AttachmentUpload[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Response mode ───────────────────────────────────────────────────────────
  const [responseMode, setResponseMode] = useState<"quick" | "standard" | "campaign">("quick");

  // ── Scroll management ───────────────────────────────────────────────────────
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  function handleChatScroll() {
    const el = chatContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setUserScrolledUp(distFromBottom > 120);
  }

  function scrollToBottom(force = false) {
    if (force || !userScrolledUp) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }

  const isUploading = attachments.some(
    (a) => a.status === "uploading" || a.status === "pending"
  );
  const hasUploadErrors = attachments.some((a) => a.status === "error");

  // Revoke object URLs on unmount
  useEffect(() => {
    return () => {
      attachments.forEach((a) => {
        if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function removeAttachment(id: string) {
    setAttachments((prev) => {
      const item = prev.find((a) => a.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  }

  function clearAllAttachments() {
    attachments.forEach((a) => { if (a.previewUrl) URL.revokeObjectURL(a.previewUrl); });
    setAttachments([]);
  }

  async function uploadSingleFile(upload: AttachmentUpload) {
    const user = getAuth().currentUser;
    if (!user) {
      setAttachments((prev) =>
        prev.map((a) =>
          a.id === upload.id
            ? { ...a, status: "error", errorMsg: "Not authenticated" }
            : a
        )
      );
      return;
    }

    const sessionId = crypto.randomUUID();
    const path = buildStoragePath(user.uid, sessionId, upload.file.name);
    const sRef = storageRef(storage, path);

    // Mark as uploading
    setAttachments((prev) =>
      prev.map((a) => (a.id === upload.id ? { ...a, status: "uploading" } : a))
    );

    const task = uploadBytesResumable(sRef, upload.file, {
      contentType: upload.mimeType,
    });

    task.on(
      "state_changed",
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setAttachments((prev) =>
          prev.map((a) => (a.id === upload.id ? { ...a, progress } : a))
        );
      },
      (err) => {
        setAttachments((prev) =>
          prev.map((a) =>
            a.id === upload.id
              ? { ...a, status: "error", errorMsg: err.message }
              : a
          )
        );
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(task.snapshot.ref);
          const meta: AttachmentMeta = {
            id: upload.id,
            name: upload.name,
            type: upload.fileType,
            mimeType: upload.mimeType,
            size: upload.size,
            storagePath: path,
            downloadUrl,
            uploadedAt: new Date().toISOString(),
          };
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === upload.id
                ? { ...a, status: "ready", progress: 100, meta }
                : a
            )
          );
        } catch (err) {
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === upload.id
                ? { ...a, status: "error", errorMsg: String(err) }
                : a
            )
          );
        }
      }
    );
  }

  function handleFiles(files: FileList | File[]) {
    setAttachError(null);
    const fileArray = Array.from(files);
    const currentCount = attachments.length;

    const toUpload: AttachmentUpload[] = [];

    for (const file of fileArray) {
      const validation = validateFile(file, currentCount + toUpload.length);
      if (!validation.valid) {
        setAttachError(validation.error ?? "Invalid file.");
        continue;
      }

      const id = crypto.randomUUID();
      const fileType = classifyFile(file.type, file.name);
      const previewUrl =
        fileType === "image" ? URL.createObjectURL(file) : undefined;

      toUpload.push({
        id,
        file,
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        fileType,
        status: "pending",
        progress: 0,
        previewUrl,
      });
    }

    if (toUpload.length === 0) return;
    setAttachments((prev) => [...prev, ...toUpload]);

    // Start uploads immediately (parallel)
    for (const upload of toUpload) {
      uploadSingleFile(upload);
    }
  }

  // Drag-and-drop handlers (attached to the input wrapper div)
  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }
  function onDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }

  /** Clipboard paste — captures pasted images (e.g. screenshots) directly into the attachment queue */
  function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageItems: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          // Give pasted images a meaningful name with a timestamp
          const ext = item.type.split("/")[1] ?? "png";
          const named = new File([file], `paste-${Date.now()}.${ext}`, { type: item.type });
          imageItems.push(named);
        }
      }
    }

    if (imageItems.length > 0) {
      // Only prevent default if we're handling images — let normal text paste through
      e.preventDefault();
      handleFiles(imageItems);
    }
  }

  // Load agents + templates
  // ── Conversation helpers ────────────────────────────────────────────────────

  const fetchConversations = useCallback(async () => {
    setConvsLoading(true);
    try {
      const data = await authFetch("/api/takers-ai/conversations?limit=40");
      setRecentConvs(data.conversations ?? []);
    } catch {
      // fail silently — sidebar just shows empty
    } finally {
      setConvsLoading(false);
    }
  }, []);

  async function loadConversation(id: string) {
    if (id === conversationId) return; // already loaded
    setLoadingConv(true);
    setShowConvSidebar(false); // close on mobile after selection
    try {
      const { conversation, messages: msgs } = await authFetch(
        `/api/takers-ai/conversations/${id}`
      );
      setConversationId(id);
      setSelectedAgentId(conversation.agentId);
      setMessages((msgs ?? []).map((m: ChatMessage) => ({ ...m })));
      setInput("");
      clearAllAttachments();
    } catch {
      // fail silently — conversation stays as is
    } finally {
      setLoadingConv(false);
    }
  }

  useEffect(() => {
    Promise.all([
      authFetch("/api/takers-ai/agents"),
      authFetch("/api/takers-ai/templates"),
    ]).then(([agentsData, templatesData]) => {
      const agentList: Agent[] = agentsData.agents ?? [];
      setAgents(agentList);
      setTemplates(templatesData.templates ?? []);
      if (!selectedAgentId && agentList.length > 0) {
        const def = agentList.find((a) => a.isDefault) ?? agentList[0];
        setSelectedAgentId(def.id);
      }
    }).catch(() => {});
  }, []);

  // Fetch recent conversations on mount + when convSearch changes
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Load existing conversation (from URL param — deep-link support)
  useEffect(() => {
    if (!initialConvId || conversationId) return;
    loadConversation(initialConvId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialConvId]);

  // Auto-scroll — only when user hasn't scrolled up
  useEffect(() => {
    scrollToBottom();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, streamingText]);

  // When streaming starts, always jump to bottom and reset scroll guard
  useEffect(() => {
    if (streaming) {
      setUserScrolledUp(false);
      scrollToBottom(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streaming]);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);
  const isOperator = selectedAgent?.isDefault === true;

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    // Allow send with no text if attachments present
    if ((!text && attachments.length === 0) || !selectedAgentId || streaming) return;
    if (isUploading) return; // wait for uploads to finish

    const userMsg: UIMessage = { role: "user", content: text, createdAt: new Date().toISOString() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);
    setStreamingText("");
    setStreamingAgent(null);

    let pendingRoutingInfo: UIMessage["routingInfo"] | undefined;
    let pendingAgentId = selectedAgentId;
    let pendingAgentRole: AgentRole = (selectedAgent?.role as AgentRole) ?? "operator";

    try {
      const token = await getToken();
      const res = await fetch("/api/takers-ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          agentId: selectedAgentId,
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          conversationId: conversationId || undefined,
          saveConversation: true,
          responseMode,
          attachments: attachments
            .filter((a) => a.status === "ready" && a.meta)
            .map((a) => a.meta!),
        }),
      });

      if (!res.ok) {
        // Read the error body so we surface the actual server-side message
        let serverError = `HTTP ${res.status}`;
        try {
          const errBody = await res.json();
          serverError = errBody.detail ?? errBody.error ?? serverError;
        } catch {
          try { serverError = await res.text() || serverError; } catch { /* ignore */ }
        }
        throw new Error(serverError);
      }
      if (!res.body) throw new Error("Stream body is null — check server runtime config");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";
      let newConvId = conversationId;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6);
          try {
            const parsed = JSON.parse(raw);

            if (parsed.type === "routing") {
              pendingRoutingInfo = {
                routedToRole: parsed.routedToRole,
                routedToAgentId: parsed.routedToAgentId,
                routedToName: parsed.routedToName,
                routingReason: parsed.routingReason,
                workflowRunId: parsed.workflowRunId,
              };
              pendingAgentId = parsed.routedToAgentId;
              pendingAgentRole = parsed.routedToRole;
              setStreamingAgent({ role: parsed.routedToRole, name: parsed.routedToName });
            }

            if (parsed.type === "text") {
              fullText += parsed.text;
              setStreamingText(fullText);
            }

            if (parsed.type === "done") {
              if (parsed.conversationId) {
                newConvId = parsed.conversationId;
                setConversationId(parsed.conversationId);
                // Refresh sidebar after server confirms conversation ID
                fetchConversations();
              }
            }

            if (parsed.type === "error") {
              throw new Error(`[${parsed.stage ?? "stream"}] ${parsed.error ?? "Unknown stream error"}`);
            }
          } catch (parseErr) {
            // Only re-throw real errors (not JSON parse failures on partial lines)
            if (parseErr instanceof Error && parseErr.message.startsWith("[")) throw parseErr;
            /* ignore JSON parse noise on partial SSE lines */
          }
        }
      }

      const assistantMsg: UIMessage = {
        role: "assistant",
        content: fullText,
        agentId: pendingAgentId,
        agentRole: pendingAgentRole,
        routingInfo: pendingRoutingInfo,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setStreamingText("");
      setStreamingAgent(null);
    } catch (err) {
      const errMsg: UIMessage = {
        role: "assistant",
        content: `⚠ Error: ${err instanceof Error ? err.message : "Something went wrong."}`,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setStreaming(false);
      clearAllAttachments();
      setAttachError(null);
      inputRef.current?.focus();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, selectedAgentId, streaming, messages, conversationId, selectedAgent, attachments, isUploading]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  function handleNewChat() {
    setMessages([]);
    setConversationId("");
    setStreamingText("");
    setInput("");
    setStreamingAgent(null);
    clearAllAttachments();
    setAttachError(null);
    setShowConvSidebar(false); // close mobile overlay
    inputRef.current?.focus();
  }

  const streamingIcon = streamingAgent
    ? AGENT_ROLE_ICONS[streamingAgent.role] ?? "◎"
    : AGENT_ROLE_ICONS[selectedAgent?.role as AgentRole] ?? "◎";
  const streamingColor = streamingAgent
    ? AGENT_ROLE_COLORS[streamingAgent.role] ?? "bg-red-600"
    : AGENT_ROLE_COLORS[selectedAgent?.role as AgentRole] ?? "bg-red-600";

  const convTitle = recentConvs.find((c) => c.id === conversationId)?.title;

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Mobile sidebar overlay backdrop ── */}
      {showConvSidebar && (
        <div
          className="md:hidden fixed inset-0 z-20 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowConvSidebar(false)}
        />
      )}

      {/* ── Conversation sidebar ── */}
      <div className={`
        ${showConvSidebar ? "flex" : "hidden md:flex"}
        absolute md:relative inset-y-0 left-0 z-30 md:z-auto
        flex-col w-64 shrink-0
      `}>
        <ConversationSidebar
          conversations={recentConvs}
          activeConvId={conversationId}
          search={convSearch}
          loading={convsLoading}
          onSearch={setConvSearch}
          onSelect={loadConversation}
          onNewChat={handleNewChat}
          onDelete={(id) => {
            setRecentConvs((prev) => prev.filter((c) => c.id !== id));
            if (id === conversationId) handleNewChat();
          }}
        />
      </div>

      {/* ── Main chat area ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

      {/* ── Top bar ── */}
      <div className="h-14 shrink-0 border-b border-white/[0.07] flex items-center gap-3 px-4">
        {/* Mobile: sidebar toggle */}
        <button
          onClick={() => setShowConvSidebar((v) => !v)}
          className="md:hidden w-8 h-8 flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/5 rounded-lg transition shrink-0"
          title="Conversations"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="2" y1="4" x2="14" y2="4"/><line x1="2" y1="8" x2="14" y2="8"/><line x1="2" y1="12" x2="10" y2="12"/>
          </svg>
        </button>

        <div className="flex items-center gap-2 min-w-0">
          {selectedAgent && (
            <div className={`w-7 h-7 rounded-lg ${selectedAgent.color} bg-opacity-20 border border-white/10 flex items-center justify-center text-base shrink-0`}>
              {selectedAgent.icon}
            </div>
          )}
          <select value={selectedAgentId} onChange={(e) => setSelectedAgentId(e.target.value)}
            className="bg-transparent text-white/70 text-sm font-medium focus:outline-none cursor-pointer hover:text-white transition max-w-[130px] truncate">
            {agents.filter((a) => a.isActive).map((a) => (
              <option key={a.id} value={a.id} className="bg-[#13131f]">{a.name}</option>
            ))}
          </select>
        </div>

        {isOperator && (
          <span className="text-[10px] px-2 py-0.5 rounded-full border border-red-600/30 bg-red-600/10 text-red-400 font-bold hidden sm:block shrink-0">
            AUTO-ROUTES
          </span>
        )}

        {/* Conversation title (center) */}
        {convTitle && (
          <span className="flex-1 text-white/30 text-xs truncate text-center hidden sm:block px-2">
            {convTitle}
          </span>
        )}
        {!convTitle && <div className="flex-1" />}

        <div className="flex items-center gap-2 shrink-0">
          <button onClick={handleNewChat}
            className="text-xs px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/25 text-white/40 hover:text-white transition">
            New chat
          </button>
        </div>
      </div>

      {/* ── Messages ── */}
      <div
        ref={chatContainerRef}
        onScroll={handleChatScroll}
        className="flex-1 overflow-y-auto px-6 py-6 relative"
      >
        {loadingConv ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`flex gap-3 ${i % 2 ? "justify-end" : "justify-start"}`}>
                <div className="h-12 w-64 rounded-2xl bg-white/5 animate-pulse" />
              </div>
            ))}
          </div>
        ) : messages.length === 0 && !streamingText ? (
          <div className="flex flex-col items-center justify-center h-full space-y-6 text-center">
            {/* Agent icon — violet for image agent, red for all others */}
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl ${
              selectedAgent?.role === "image"
                ? "bg-violet-600/10 border border-violet-600/20"
                : "bg-red-600/10 border border-red-600/20"
            }`}>
              {selectedAgent?.icon ?? "◎"}
            </div>

            <div>
              <h2 className="text-white/70 font-bold text-lg">{selectedAgent?.name ?? "Takers Operator"}</h2>
              <p className="text-white/30 text-sm mt-1 max-w-xs">
                {isOperator
                  ? "Ask me anything. I'll route your request to the right specialist automatically."
                  : selectedAgent?.role === "image"
                  ? "Generate event flyers, social graphics, and visual asset packages. Paste or drag a reference image to match its style."
                  : selectedAgent?.description || "Specialist AI agent. Ready to help."}
              </p>
            </div>

            {/* Operator: role chips */}
            {isOperator && (
              <div className="flex flex-wrap gap-1.5 justify-center max-w-sm">
                {(["content", "marketing", "events", "strategy", "developer", "operations", "creative", "image"] as AgentRole[]).map((role) => (
                  <span key={role} className={`text-[10px] px-2 py-1 rounded-full border border-white/10 ${AGENT_ROLE_COLORS[role]} bg-opacity-10 text-white/40`}>
                    {AGENT_ROLE_ICONS[role]} {role}
                  </span>
                ))}
              </div>
            )}

            {/* Image agent: visual starter prompts */}
            {selectedAgent?.role === "image" ? (
              <>
                <div className="grid grid-cols-2 gap-2 max-w-sm">
                  {[
                    "Generate a flyer for the Mansion Party event",
                    "Create 4 creative concepts for Sea Bears Courtside",
                    "Design an Instagram story for Winnipeg After Dark",
                    "Make a TikTok cover graphic for ALL ACCESS",
                  ].map((starter) => (
                    <button key={starter} onClick={() => setInput(starter)}
                      className="text-xs text-left px-3 py-2.5 rounded-xl bg-violet-500/[0.04] hover:bg-violet-500/[0.08] border border-violet-500/[0.12] hover:border-violet-400/20 text-white/40 hover:text-white/70 transition">
                      {starter}
                    </button>
                  ))}
                </div>
                <p className="text-white/20 text-xs max-w-xs">
                  💡 Paste a reference image directly into the chat box to match its visual style.
                </p>
              </>
            ) : (
              /* Default starter prompts for all other agents */
              <div className="grid grid-cols-2 gap-2 max-w-sm">
                {[
                  "Write 3 IG captions for our next event",
                  "Give me a content plan for this week",
                  "Plan logistics for the Mansion Party",
                  "How do we grow ALL ACCESS membership?",
                ].map((starter) => (
                  <button key={starter} onClick={() => setInput(starter)}
                    className="text-xs text-left px-3 py-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] hover:border-white/10 text-white/40 hover:text-white/70 transition">
                    {starter}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6 max-w-3xl mx-auto">
            {messages.map((msg, i) => (
              <MessageBubble
                key={i}
                msg={msg}
                allAgents={agents}
                conversationId={conversationId}
                onSave={(content, aId, aRole) => setSaveModal({ content, agentId: aId, agentRole: aRole })}
              />
            ))}
            {/* Streaming bubble */}
            {streaming && (
              <div className="space-y-1">
                {streamingAgent && streamingAgent.role !== "operator" && (
                  <div className="flex items-center gap-2 py-1">
                    <div className="flex-1 h-px bg-white/[0.05]" />
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full border border-white/10 ${AGENT_ROLE_COLORS[streamingAgent.role]} bg-opacity-15 text-white/50`}>
                      {AGENT_ROLE_ICONS[streamingAgent.role]} Routing → {streamingAgent.name}
                    </span>
                    <div className="flex-1 h-px bg-white/[0.05]" />
                  </div>
                )}
                <div className="flex gap-3 justify-start">
                  <div className={`w-8 h-8 rounded-lg ${streamingColor} bg-opacity-20 border border-white/10 flex items-center justify-center text-sm shrink-0 mt-0.5`}>
                    {streamingIcon}
                  </div>
                  <div className="max-w-[78%] bg-white/[0.04] border border-white/[0.08] rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-white/80 whitespace-pre-wrap leading-relaxed">
                    {streamingText || (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-bounce [animation-delay:0ms]" />
                        <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-bounce [animation-delay:150ms]" />
                        <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-bounce [animation-delay:300ms]" />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}

        {/* Jump to latest — floating over the messages area */}
        {userScrolledUp && (
          <div className="sticky bottom-4 flex justify-center pointer-events-none">
            <button
              onClick={() => { setUserScrolledUp(false); scrollToBottom(true); }}
              className="pointer-events-auto flex items-center gap-1.5 text-xs px-4 py-2 rounded-full bg-[#13131f] border border-white/15 text-white/60 hover:text-white hover:border-white/30 shadow-2xl transition"
            >
              <span>↓</span>
              <span>Jump to latest</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Input area ── */}
      <div className="shrink-0 border-t border-white/[0.07] p-4">
        <div className="max-w-3xl mx-auto space-y-2">

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.txt,.csv,.md,.doc,.docx"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleFiles(e.target.files);
              // Reset so same file can be re-selected after removal
              e.target.value = "";
            }}
          />

          {/* Response mode selector */}
          <div className="flex items-center justify-between max-w-3xl mx-auto">
            <div className="flex items-center gap-0.5 bg-white/[0.04] border border-white/[0.07] rounded-lg p-0.5">
              {(["quick", "standard", "campaign"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setResponseMode(m)}
                  className={`text-[10px] px-2.5 py-1 rounded-md transition font-medium ${
                    responseMode === m
                      ? "bg-white/[0.10] text-white/80"
                      : "text-white/25 hover:text-white/50"
                  }`}
                >
                  {m === "quick" ? "⚡ Quick" : m === "standard" ? "◎ Standard" : "📦 Campaign"}
                </button>
              ))}
            </div>
          </div>

          {/* Image agent quick-action panel */}
          {selectedAgent?.role === "image" && !streaming && (
            <ImageGenerationPanel
              onAction={(text) => {
                setInput(text);
                inputRef.current?.focus();
              }}
              onOpenFilePicker={() => fileInputRef.current?.click()}
            />
          )}

          {/* Attachment error banner */}
          {attachError && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs">
              <span>⚠</span>
              <span className="flex-1">{attachError}</span>
              <button onClick={() => setAttachError(null)} className="text-red-400/60 hover:text-red-300 transition">×</button>
            </div>
          )}

          {/* Input box with drag-drop */}
          <div
            className={`relative bg-white/[0.04] border rounded-2xl transition ${
              isDragging
                ? "border-red-500/60 bg-red-500/5 ring-1 ring-red-500/20"
                : "border-white/[0.09] hover:border-white/15 focus-within:border-red-500/40"
            }`}
            onDragOver={onDragOver}
            onDragEnter={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            {/* Drag overlay */}
            {isDragging && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl pointer-events-none">
                <span className="text-2xl mb-1">📎</span>
                <span className="text-white/50 text-sm font-medium">Drop files to attach</span>
                <span className="text-white/25 text-xs mt-0.5">Images, PDFs, text files</span>
              </div>
            )}

            {/* Attachment preview chips (inside the box, above textarea) */}
            <AttachmentPreviewRow uploads={attachments} onRemove={removeAttachment} />

            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={onPaste}
              placeholder={
                attachments.length > 0
                  ? selectedAgent?.role === "image"
                    ? "Describe the flyer or image you want generated…"
                    : "Add a message (optional)…"
                  : isDragging
                  ? ""
                  : isOperator
                  ? "Ask anything — I'll route to the right specialist…"
                  : selectedAgent?.role === "image"
                  ? "Describe the event, style, or format you need. Paste a reference image to match its look…"
                  : `Message ${selectedAgent?.name ?? "Agent"}…`
              }
              rows={1}
              disabled={streaming}
              className={`w-full bg-transparent px-5 pt-4 pb-12 text-sm text-white placeholder-white/20 resize-none focus:outline-none min-h-[56px] max-h-48 overflow-y-auto disabled:opacity-50 ${isDragging ? "opacity-0" : ""}`}
              style={{ fieldSizing: "content" } as React.CSSProperties}
            />

            {/* Toolbar */}
            <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
              <div className="flex items-center gap-1">
                {/* Templates button */}
                <button
                  onClick={() => setShowTemplates(true)}
                  className="flex items-center gap-1.5 text-xs text-white/25 hover:text-white/60 transition px-2 py-1 rounded-lg hover:bg-white/5"
                >
                  <span>◧</span><span>Templates</span>
                </button>

                {/* Paperclip / attach button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={streaming || attachments.length >= 5}
                  title={attachments.length >= 5 ? "Max 5 files per message" : "Attach file"}
                  className={`flex items-center gap-1.5 text-xs transition px-2 py-1 rounded-lg hover:bg-white/5 ${
                    attachments.length > 0
                      ? "text-red-400/70 hover:text-red-300"
                      : "text-white/25 hover:text-white/60"
                  } disabled:opacity-30 disabled:cursor-not-allowed`}
                >
                  {/* Paperclip SVG */}
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11.5 6.5L6 12a3.536 3.536 0 0 1-5-5l6-6a2.357 2.357 0 0 1 3.333 3.333L4.5 10a1.178 1.178 0 0 1-1.667-1.667L8.5 2.5" />
                  </svg>
                  {attachments.length > 0 && (
                    <span className="text-[10px] font-bold">{attachments.length}</span>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-2">
                {/* Upload indicator */}
                {isUploading && (
                  <span className="text-white/30 text-[11px] animate-pulse">Uploading…</span>
                )}
                {!isUploading && hasUploadErrors && (
                  <span className="text-red-400/70 text-[11px]">Upload failed</span>
                )}
                {!isUploading && !hasUploadErrors && (
                  <span className="text-white/15 text-[11px]">⏎ send · ⇧⏎ newline</span>
                )}

                {/* Send button */}
                <button
                  onClick={sendMessage}
                  disabled={
                    (!input.trim() && attachments.length === 0) ||
                    streaming ||
                    !selectedAgentId ||
                    isUploading ||
                    hasUploadErrors
                  }
                  title={isUploading ? "Wait for uploads to finish" : "Send message"}
                  className="w-8 h-8 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition"
                >
                  {isUploading ? (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="animate-spin">
                      <circle cx="6" cy="6" r="4.5" stroke="white" strokeOpacity="0.3" strokeWidth="1.5"/>
                      <path d="M6 1.5A4.5 4.5 0 0 1 10.5 6" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M7 1L7 13M1 7L7 1L13 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showTemplates && <TemplatePicker templates={templates} onSelect={(p) => { setInput(p); setShowTemplates(false); inputRef.current?.focus(); }} onClose={() => setShowTemplates(false)} />}
      {saveModal && (
        <SaveOutputModal content={saveModal.content} agentId={saveModal.agentId} agentRole={saveModal.agentRole}
          onSave={() => { setSaveModal(null); setSavedToast(true); setTimeout(() => setSavedToast(false), 3000); }}
          onClose={() => setSaveModal(null)} />
      )}
      {savedToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-emerald-900/90 border border-emerald-500/30 text-emerald-300 text-sm font-medium px-5 py-2.5 rounded-xl backdrop-blur-sm z-70">
          ✓ Output saved
        </div>
      )}
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center text-white/20">Loading…</div>}>
      <ChatInner />
    </Suspense>
  );
}
