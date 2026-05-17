"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import {
  collection, query, orderBy, onSnapshot,
  addDoc, deleteDoc, doc, updateDoc, serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { type SocialPost } from "@/components/SocialFeedSection";

// ── Icons ─────────────────────────────────────────────────────────────────────

function IGIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}
function TTIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.77a4.84 4.84 0 01-1.01-.08z" />
    </svg>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type AdminTab = "overview" | "posts" | "add" | "settings";
type PostFilter = "all" | "instagram" | "tiktok" | "featured" | "draft";

const emptyForm = {
  platform: "" as "instagram" | "tiktok" | "",
  postUrl: "",
  imageUrl: "",
  caption: "",
  likes: "",
  views: "",
  postedAt: new Date().toISOString().slice(0, 10),
  scheduledAt: "",
  featured: false,
  pinned: false,
  status: "published" as "published" | "draft",
};
type FormState = typeof emptyForm;

function postToForm(p: SocialPost): FormState {
  return {
    platform: p.platform,
    postUrl: p.postUrl,
    imageUrl: p.imageUrl ?? "",
    caption: p.caption ?? "",
    likes: p.likes != null ? String(p.likes) : "",
    views: p.views != null ? String(p.views) : "",
    postedAt: p.postedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    scheduledAt: p.scheduledAt?.slice(0, 10) ?? "",
    featured: p.featured ?? false,
    pinned: p.pinned ?? false,
    status: p.status ?? "published",
  };
}

function detectPlatform(url: string): "instagram" | "tiktok" | "" {
  if (url.includes("instagram.com") || url.includes("instagr.am")) return "instagram";
  if (url.includes("tiktok.com") || url.includes("vm.tiktok.com")) return "tiktok";
  return "";
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = "text-white" }: {
  label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="bg-white/[0.03] border border-white/8 rounded-2xl px-5 py-4 space-y-1">
      <p className="text-white/30 text-[10px] font-bold uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-black ${color}`}>{value}</p>
      {sub && <p className="text-white/25 text-[10px]">{sub}</p>}
    </div>
  );
}

// ── Post form ─────────────────────────────────────────────────────────────────

function PostForm({
  form, setForm, onSubmit, saving, uploadProgress, uploadMode, setUploadMode,
  fileInputRef, onFileSelect, isEditing, onCancel, error, success,
  fetching,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  onSubmit: (e: React.FormEvent) => void;
  saving: boolean;
  uploadProgress: number | null;
  uploadMode: "file" | "url";
  setUploadMode: (m: "file" | "url") => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileSelect: (f: File) => void;
  isEditing: boolean;
  onCancel: () => void;
  error: string | null;
  success: string | null;
  fetching: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">

      {/* Post URL */}
      <div className="space-y-1">
        <label className="text-xs text-white/40 font-bold uppercase tracking-wider">
          Post URL *
          {fetching && <span className="ml-2 text-pink-400 normal-case font-normal">Auto-fetching…</span>}
        </label>
        <input type="url" placeholder="https://www.instagram.com/reel/... or https://www.tiktok.com/@..."
          value={form.postUrl}
          onChange={(e) => {
            const url = e.target.value;
            const detected = detectPlatform(url);
            setForm(f => ({ ...f, postUrl: url, platform: detected || f.platform }));
          }}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-pink-500/50 transition" />
      </div>

      {/* Platform */}
      <div className="space-y-1">
        <label className="text-xs text-white/40 font-bold uppercase tracking-wider">Platform *</label>
        <div className="flex gap-2">
          {(["instagram", "tiktok"] as const).map((p) => (
            <button key={p} type="button" onClick={() => setForm(f => ({ ...f, platform: p }))}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-bold transition ${
                form.platform === p ? "bg-pink-600 border-pink-500 text-white" : "border-white/10 text-white/35 hover:text-white/60"
              }`}>
              {p === "instagram" ? <IGIcon /> : <TTIcon />}
              {p === "instagram" ? "Instagram" : "TikTok"}
            </button>
          ))}
        </div>
      </div>

      {/* Thumbnail */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs text-white/40 font-bold uppercase tracking-wider">
            Thumbnail {form.imageUrl && uploadProgress === null && <span className="text-emerald-400 normal-case font-normal ml-1">✓</span>}
          </label>
          <div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
            {(["file", "url"] as const).map(m => (
              <button key={m} type="button" onClick={() => setUploadMode(m)}
                className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide transition ${
                  uploadMode === m ? "bg-pink-600 text-white" : "text-white/30 hover:text-white/60"
                }`}>
                {m === "file" ? "Upload" : "URL"}
              </button>
            ))}
          </div>
        </div>

        {uploadMode === "file" ? (
          <label htmlFor="post-img-upload"
            className="flex flex-col items-center justify-center gap-2 w-full h-28 rounded-xl border-2 border-dashed border-white/10 hover:border-pink-500/40 bg-white/[0.02] cursor-pointer transition group">
            {uploadProgress !== null ? (
              <div className="w-full px-8 space-y-1.5">
                <div className="w-full bg-white/10 rounded-full h-1.5">
                  <div className="bg-pink-500 h-1.5 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
                <p className="text-pink-400 text-xs font-semibold text-center">Uploading {uploadProgress}%</p>
              </div>
            ) : form.imageUrl ? (
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg overflow-hidden border border-white/10">
                  <img src={form.imageUrl} alt="" className="w-full h-full object-cover" />
                </div>
                <span className="text-white/35 text-xs group-hover:text-white/60">Click to replace</span>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-white/35 text-xs font-semibold group-hover:text-white/60">Click to upload thumbnail</p>
                <p className="text-white/20 text-[10px] mt-0.5">JPG, PNG, WebP · Max 10MB</p>
              </div>
            )}
            <input id="post-img-upload" ref={fileInputRef} type="file" accept="image/*" className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileSelect(f); }} />
          </label>
        ) : (
          <div>
            <input type="url" placeholder="https://... (direct image URL)"
              value={form.imageUrl} onChange={(e) => setForm(f => ({ ...f, imageUrl: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-pink-500/50 transition" />
            {form.imageUrl && (
              <div className="mt-2 w-20 h-20 rounded-xl overflow-hidden border border-white/10">
                <img src={form.imageUrl} alt="" className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              </div>
            )}
          </div>
        )}
        {form.imageUrl && uploadProgress === null && (
          <button type="button" onClick={() => { setForm(f => ({ ...f, imageUrl: "" })); if (fileInputRef.current) fileInputRef.current.value = ""; }}
            className="text-white/20 hover:text-red-400 text-[10px] transition">✕ Clear image</button>
        )}
      </div>

      {/* Caption */}
      <div className="space-y-1">
        <label className="text-xs text-white/40 font-bold uppercase tracking-wider">Caption *</label>
        <textarea placeholder="Caption text shown in the feed card" value={form.caption}
          onChange={(e) => setForm(f => ({ ...f, caption: e.target.value }))} rows={3}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-pink-500/50 transition resize-none" />
      </div>

      {/* Stats + Date + Schedule */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-white/40 font-bold uppercase tracking-wider">Likes</label>
          <input type="number" placeholder="0" value={form.likes} onChange={(e) => setForm(f => ({ ...f, likes: e.target.value }))}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-pink-500/50 transition" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-white/40 font-bold uppercase tracking-wider">Views</label>
          <input type="number" placeholder="0" value={form.views} onChange={(e) => setForm(f => ({ ...f, views: e.target.value }))}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-pink-500/50 transition" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-white/40 font-bold uppercase tracking-wider">Posted</label>
          <input type="date" value={form.postedAt} onChange={(e) => setForm(f => ({ ...f, postedAt: e.target.value }))}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500/50 transition" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-white/40 font-bold uppercase tracking-wider">Schedule</label>
          <input type="date" value={form.scheduledAt} onChange={(e) => setForm(f => ({ ...f, scheduledAt: e.target.value }))}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500/50 transition" />
        </div>
      </div>

      {/* Flags */}
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2.5 cursor-pointer group">
          <input type="checkbox" checked={form.featured} onChange={(e) => setForm(f => ({ ...f, featured: e.target.checked }))}
            className="w-4 h-4 accent-amber-500" />
          <span className="text-sm text-white/50 group-hover:text-white/70 transition">⭐ Featured (spotlight)</span>
        </label>
        <label className="flex items-center gap-2.5 cursor-pointer group">
          <input type="checkbox" checked={form.pinned} onChange={(e) => setForm(f => ({ ...f, pinned: e.target.checked }))}
            className="w-4 h-4 accent-pink-500" />
          <span className="text-sm text-white/50 group-hover:text-white/70 transition">📌 Pinned (top of feed)</span>
        </label>
        <label className="flex items-center gap-2.5 cursor-pointer group">
          <input type="checkbox" checked={form.status === "draft"} onChange={(e) => setForm(f => ({ ...f, status: e.target.checked ? "draft" : "published" }))}
            className="w-4 h-4 accent-white" />
          <span className="text-sm text-white/50 group-hover:text-white/70 transition">📝 Draft (hidden from public)</span>
        </label>
      </div>

      {error && <p className="text-red-400 text-sm bg-red-950/30 border border-red-800/40 rounded-xl px-4 py-2">{error}</p>}
      {success && <p className="text-emerald-400 text-sm bg-emerald-950/30 border border-emerald-800/40 rounded-xl px-4 py-2">{success}</p>}

      <div className="flex items-center gap-3 pt-1">
        <button type="submit" disabled={saving || uploadProgress !== null}
          className="bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl transition">
          {saving ? (isEditing ? "Saving…" : "Adding…") : uploadProgress !== null ? `Uploading ${uploadProgress}%…` : isEditing ? "Save Changes" : "Add to Feed"}
        </button>
        {isEditing && (
          <button type="button" onClick={onCancel} className="text-white/40 hover:text-white text-sm font-semibold transition">Cancel</button>
        )}
        {form.status === "draft" && !isEditing && (
          <span className="text-white/30 text-xs">This will be saved as a draft and hidden from the public.</span>
        )}
      </div>
    </form>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AdminSocialPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [postFilter, setPostFilter] = useState<PostFilter>("all");
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadMode, setUploadMode] = useState<"file" | "url">("file");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<{ instagram: boolean; twitch: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !isAdmin) router.push("/");
  }, [authLoading, isAdmin, router]);

  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, "socialFeed"), orderBy("postedAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SocialPost)));
    });
    return unsub;
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/social/status").then(r => r.json()).then(setApiStatus).catch(() => {});
  }, [isAdmin]);

  const handleFileUpload = (file: File) => {
    if (!file.type.startsWith("image/")) { setError("Image files only"); return; }
    if (file.size > 10 * 1024 * 1024) { setError("Max 10MB"); return; }
    setError(null);
    setUploadProgress(0);
    const storageRef = ref(storage, `social-feed/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`);
    const task = uploadBytesResumable(storageRef, file);
    task.on("state_changed",
      (snap) => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      (err) => { setError(`Upload failed: ${err.message}`); setUploadProgress(null); },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        setForm(f => ({ ...f, imageUrl: url }));
        setUploadProgress(null);
      }
    );
  };

  const handleUrlChange = async (url: string) => {
    const detected = detectPlatform(url);
    setForm(f => ({ ...f, postUrl: url, platform: detected || f.platform }));
    if (url.length > 20 && (url.includes("instagram.com/") || url.includes("tiktok.com/@"))) {
      setFetching(true);
      try {
        const res = await fetch("/api/social-feed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
        const data = await res.json();
        if (data.imageUrl || data.caption) {
          setForm(f => ({ ...f, platform: data.platform ?? f.platform, imageUrl: data.imageUrl ?? f.imageUrl, caption: data.caption ?? f.caption }));
        }
      } catch {}
      setFetching(false);
    }
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setError(null);
    setSuccess(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const startEdit = (post: SocialPost) => {
    setEditingId(post.id);
    setForm(postToForm(post));
    setError(null);
    setSuccess(null);
    setActiveTab("add");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!form.platform) { setError("Select a platform"); return; }
    if (!form.postUrl.trim()) { setError("Post URL required"); return; }
    if (!form.caption.trim()) { setError("Caption required"); return; }
    if (uploadProgress !== null) { setError("Wait for upload to complete"); return; }

    setSaving(true);
    try {
      const payload = {
        platform: form.platform,
        postUrl: form.postUrl.trim(),
        imageUrl: form.imageUrl.trim(),
        caption: form.caption.trim(),
        likes: form.likes ? Number(form.likes) : null,
        views: form.views ? Number(form.views) : null,
        postedAt: new Date(form.postedAt + "T12:00:00").toISOString(),
        scheduledAt: form.scheduledAt ? new Date(form.scheduledAt + "T09:00:00").toISOString() : null,
        featured: form.featured,
        pinned: form.pinned,
        status: form.status,
      };

      if (editingId) {
        await updateDoc(doc(db, "socialFeed", editingId), { ...payload, updatedAt: serverTimestamp() });
        setSuccess("Post updated ✓");
      } else {
        await addDoc(collection(db, "socialFeed"), { ...payload, createdAt: serverTimestamp() });
        setSuccess("Post added to feed ✓");
      }
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, caption: string) => {
    if (!confirm(`Remove "${caption.slice(0, 50)}..." from the feed?`)) return;
    try { await deleteDoc(doc(db, "socialFeed", id)); } catch (err) { alert(err instanceof Error ? err.message : "Delete failed"); }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const { auth } = await import("@/lib/firebase");
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/social/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      const parts = [];
      if (data.instagramAdded) parts.push(`${data.instagramAdded} new IG posts`);
      if (data.instagramUpdated) parts.push(`${data.instagramUpdated} updated`);
      if (data.twitchLive !== undefined) parts.push(`Twitch: ${data.twitchLive ? "🔴 Live" : "offline"}`);
      setSyncMsg(parts.length ? `✓ ${parts.join(" · ")}` : "✓ No new posts — feed is current");
    } catch (err) {
      setSyncMsg(`✗ ${err instanceof Error ? err.message : "Sync failed"}`);
    } finally {
      setSyncing(false);
    }
  };

  // Derived stats
  const stats = {
    total: posts.length,
    published: posts.filter(p => p.status !== "draft").length,
    drafts: posts.filter(p => p.status === "draft").length,
    featured: posts.filter(p => p.featured).length,
    instagram: posts.filter(p => p.platform === "instagram").length,
    tiktok: posts.filter(p => p.platform === "tiktok").length,
  };

  const filteredPosts = posts.filter(p => {
    if (postFilter === "instagram") return p.platform === "instagram";
    if (postFilter === "tiktok") return p.platform === "tiktok";
    if (postFilter === "featured") return p.featured;
    if (postFilter === "draft") return p.status === "draft";
    return true;
  });

  if (authLoading || !isAdmin) return null;

  const adminTabs: { id: AdminTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "posts", label: `Posts (${stats.total})` },
    { id: "add", label: editingId ? "✏ Edit Post" : "Add Post" },
    { id: "settings", label: "API Settings" },
  ];

  return (
    <main className="max-w-6xl mx-auto px-6 pb-24 pt-8 space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-white/30 text-xs uppercase tracking-wider mb-1">Admin</p>
          <h1 className="text-2xl font-black">Social Control Center</h1>
          <p className="text-white/35 text-sm mt-1">Manage all social content. Everything syncs to the live site instantly.</p>
        </div>
        <button onClick={handleSync} disabled={syncing}
          className="shrink-0 flex items-center gap-2 bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white font-bold px-4 py-2.5 rounded-xl transition text-sm">
          {syncing ? (
            <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Syncing…</>
          ) : (
            <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>Sync Now</>
          )}
        </button>
      </div>

      {syncMsg && (
        <div className={`text-sm rounded-xl px-4 py-2.5 border ${syncMsg.startsWith("✓") ? "text-emerald-400 bg-emerald-950/30 border-emerald-800/30" : "text-red-400 bg-red-950/30 border-red-800/30"}`}>
          {syncMsg}
        </div>
      )}

      {/* Tab nav */}
      <div className="flex gap-1 border-b border-white/8">
        {adminTabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`relative pb-3 px-4 text-sm font-bold transition-colors ${activeTab === tab.id ? "text-white" : "text-white/30 hover:text-white/60"}`}>
            {tab.label}
            {activeTab === tab.id && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-pink-500 rounded-full" />}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ──────────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="space-y-8">
          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard label="Total Posts" value={stats.total} color="text-white" />
            <StatCard label="Published" value={stats.published} color="text-emerald-400" />
            <StatCard label="Drafts" value={stats.drafts} color="text-white/40" />
            <StatCard label="Featured" value={stats.featured} color="text-amber-400" />
            <StatCard label="Instagram" value={stats.instagram} color="text-pink-400" />
            <StatCard label="TikTok" value={stats.tiktok} color="text-white/70" />
          </div>

          {/* API status */}
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              {
                label: "Instagram API",
                ok: apiStatus?.instagram,
                desc: apiStatus?.instagram ? "Auto-sync active" : "Add INSTAGRAM_GRAPH_TOKEN to Vercel",
                color: "pink",
              },
              {
                label: "TikTok oEmbed",
                ok: true,
                desc: "Active — paste URL to auto-fetch",
                color: "white",
              },
              {
                label: "Twitch API",
                ok: apiStatus?.twitch,
                desc: apiStatus?.twitch ? "Live status active" : "Add TWITCH_CLIENT_ID + SECRET to Vercel",
                color: "purple",
              },
            ].map(s => (
              <div key={s.label} className="bg-white/[0.03] border border-white/8 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-white/50 uppercase tracking-wider">{s.label}</p>
                  <span className={`w-2 h-2 rounded-full ${s.ok ? "bg-emerald-400" : "bg-red-400"}`} />
                </div>
                <p className="text-white/35 text-xs">{s.desc}</p>
              </div>
            ))}
          </div>

          {/* Recent posts */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-white/40 uppercase tracking-wider">Recent Posts</p>
              <button onClick={() => setActiveTab("posts")} className="text-pink-400 hover:text-pink-300 text-xs font-semibold transition">
                View all →
              </button>
            </div>
            {posts.slice(0, 5).map(post => (
              <div key={post.id} className="flex items-center gap-3 bg-white/[0.02] border border-white/6 rounded-xl px-4 py-3">
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/5 shrink-0">
                  {post.imageUrl ? (
                    <img src={post.imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/30 text-xs font-bold"
                      style={{ background: post.platform === "instagram" ? "linear-gradient(135deg,#7928ca,#ff007f)" : "linear-gradient(135deg,#111,#222)" }}>
                      {post.platform === "instagram" ? "IG" : "TT"}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white/70 text-xs truncate">{post.caption}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-white/25 text-[10px]">
                      {new Date(post.postedAt).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
                    </span>
                    {post.status === "draft" && <span className="text-white/30 text-[9px] border border-white/10 px-1.5 rounded">Draft</span>}
                    {post.featured && <span className="text-amber-400 text-[9px]">★ Featured</span>}
                    {post.pinned && <span className="text-pink-400 text-[9px]">📌 Pinned</span>}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => startEdit(post)} className="text-white/30 hover:text-white text-[10px] font-semibold transition">Edit</button>
                  <button onClick={() => handleDelete(post.id, post.caption)} className="text-red-500/30 hover:text-red-500 text-[10px] font-semibold transition">Remove</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── POSTS TAB ─────────────────────────────────────── */}
      {activeTab === "posts" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-1.5 flex-wrap">
            {(["all", "instagram", "tiktok", "featured", "draft"] as PostFilter[]).map(f => (
              <button key={f} onClick={() => setPostFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition capitalize ${
                  postFilter === f ? "bg-pink-600 text-white" : "bg-white/5 text-white/40 hover:text-white/70 hover:bg-white/8"
                }`}>
                {f === "all" ? `All (${stats.total})` : f === "instagram" ? `Instagram (${stats.instagram})` : f === "tiktok" ? `TikTok (${stats.tiktok})` : f === "featured" ? `Featured (${stats.featured})` : `Drafts (${stats.drafts})`}
              </button>
            ))}
          </div>

          {filteredPosts.length === 0 ? (
            <div className="text-center py-12 text-white/25 text-sm">No posts in this filter.</div>
          ) : (
            <div className="space-y-1.5">
              {filteredPosts.map(post => (
                <div key={post.id}
                  className="flex items-center gap-3 bg-white/[0.03] border border-white/6 hover:border-white/12 rounded-xl px-4 py-3 transition group">
                  {/* Thumb */}
                  <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0">
                    {post.imageUrl ? (
                      <img src={post.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/50 text-[10px] font-bold"
                        style={{ background: post.platform === "instagram" ? "linear-gradient(135deg,#7928ca,#ff007f)" : "linear-gradient(135deg,#111,#222)" }}>
                        {post.platform === "instagram" ? "IG" : "TT"}
                      </div>
                    )}
                  </div>

                  {/* Platform */}
                  <div className="shrink-0">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase text-white"
                      style={{ background: post.platform === "instagram" ? "rgba(255,0,127,0.7)" : "rgba(30,30,30,0.9)", border: post.platform === "instagram" ? "none" : "1px solid rgba(255,255,255,0.1)" }}>
                      {post.platform === "instagram" ? <><IGIcon />IG</> : <><TTIcon />TT</>}
                    </span>
                  </div>

                  {/* Caption */}
                  <p className="flex-1 text-white/60 text-xs truncate min-w-0">{post.caption}</p>

                  {/* Badges */}
                  <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                    {post.status === "draft" && <span className="text-[9px] text-white/30 border border-white/10 px-1.5 py-0.5 rounded-md">Draft</span>}
                    {post.featured && <span className="text-[9px] text-amber-400">★</span>}
                    {post.pinned && <span className="text-[9px] text-pink-400">📌</span>}
                    <span className="text-white/20 text-[9px]">
                      {new Date(post.postedAt).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <a href={post.postUrl} target="_blank" rel="noopener noreferrer"
                      className="text-pink-400/50 hover:text-pink-400 text-[10px] font-semibold transition">View</a>
                    <button onClick={() => startEdit(post)}
                      className="text-white/30 hover:text-white text-[10px] font-semibold transition">Edit</button>
                    <button onClick={() => handleDelete(post.id, post.caption)}
                      className="text-red-500/30 hover:text-red-500 text-[10px] font-semibold transition">Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ADD / EDIT TAB ────────────────────────────────── */}
      {activeTab === "add" && (
        <div className="max-w-2xl space-y-6">
          {editingId && (
            <div className="flex items-center justify-between bg-blue-950/20 border border-blue-500/20 rounded-xl px-4 py-3">
              <p className="text-blue-400 text-sm font-semibold">✏ Editing existing post</p>
              <button onClick={() => { resetForm(); }} className="text-white/40 hover:text-white text-xs font-semibold transition">✕ Cancel — New post instead</button>
            </div>
          )}
          <PostForm
            form={form} setForm={setForm} onSubmit={handleSubmit}
            saving={saving} uploadProgress={uploadProgress}
            uploadMode={uploadMode} setUploadMode={setUploadMode}
            fileInputRef={fileInputRef} onFileSelect={handleFileUpload}
            isEditing={Boolean(editingId)} onCancel={resetForm}
            error={error} success={success} fetching={fetching}
          />
        </div>
      )}

      {/* ── SETTINGS TAB ──────────────────────────────────── */}
      {activeTab === "settings" && (
        <div className="space-y-6 max-w-2xl">
          {/* Sync */}
          <div className="bg-gradient-to-br from-pink-950/30 to-purple-950/20 border border-pink-500/15 rounded-2xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-bold">Manual Sync</h3>
                <p className="text-white/40 text-sm mt-0.5">Pull latest posts from all connected platforms.</p>
              </div>
              <button onClick={handleSync} disabled={syncing}
                className="shrink-0 flex items-center gap-2 bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white font-bold px-4 py-2.5 rounded-xl transition text-sm">
                {syncing ? "Syncing…" : "Sync Now"}
              </button>
            </div>
            {syncMsg && <p className={`text-sm ${syncMsg.startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}>{syncMsg}</p>}
          </div>

          {/* Platform status */}
          {[
            {
              name: "Instagram Graph API",
              ok: apiStatus?.instagram,
              notok: "Add INSTAGRAM_GRAPH_TOKEN to Vercel env vars. See /admin/social-settings for full setup guide.",
              ok_msg: "Connected. Sync will pull your latest posts automatically.",
            },
            {
              name: "TikTok oEmbed",
              ok: true,
              notok: "",
              ok_msg: "Active without credentials. Paste a TikTok URL in Add Post to auto-fetch thumbnail + caption.",
            },
            {
              name: "Twitch API",
              ok: apiStatus?.twitch,
              notok: "Add TWITCH_CLIENT_ID + TWITCH_CLIENT_SECRET to Vercel for live status detection.",
              ok_msg: "Connected. Live status shows on the Connect → Streams page.",
            },
          ].map(s => (
            <div key={s.name} className="bg-white/[0.03] border border-white/8 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-bold text-sm">{s.name}</p>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${s.ok ? "bg-emerald-900/30 border border-emerald-500/30 text-emerald-400" : "bg-red-900/20 border border-red-500/20 text-red-400"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${s.ok ? "bg-emerald-400" : "bg-red-400"}`} />
                  {s.ok ? "Connected" : "Not configured"}
                </span>
              </div>
              <p className="text-white/40 text-xs leading-relaxed">{s.ok ? s.ok_msg : s.notok}</p>
              {!s.ok && s.notok && (
                <a href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer"
                  className="inline-block text-pink-400 hover:text-pink-300 text-xs font-bold transition">
                  Open Vercel Env Vars →
                </a>
              )}
            </div>
          ))}

          <div className="border border-white/5 rounded-xl p-4 bg-white/[0.01]">
            <p className="text-white/25 text-xs font-bold uppercase tracking-wider mb-1.5">Auto-Sync Endpoint</p>
            <p className="text-white/25 text-xs leading-relaxed">
              Call <code className="text-white/40">POST /api/social/sync</code> with{" "}
              <code className="text-white/40">Authorization: Bearer {"{admin_token}"}</code> from an external cron
              service (EasyCron, GitHub Actions, Vercel Cron) every 2–6 hours to keep the feed current automatically.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
