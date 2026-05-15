"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { InstagramIcon, TikTokIcon, type SocialPost } from "@/components/SocialFeedSection";

function detectPlatform(url: string): "instagram" | "tiktok" | "" {
  if (url.includes("instagram.com") || url.includes("instagr.am")) return "instagram";
  if (url.includes("tiktok.com") || url.includes("vm.tiktok.com")) return "tiktok";
  return "";
}

const emptyForm = {
  platform: "" as "instagram" | "tiktok" | "",
  postUrl: "",
  imageUrl: "",
  caption: "",
  likes: "",
  views: "",
  postedAt: new Date().toISOString().slice(0, 10),
  featured: false,
};

export default function AdminSocialFeedPage() {
  const { isAdmin, loading } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !isAdmin) router.push("/");
  }, [loading, isAdmin, router]);

  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, "socialFeed"), orderBy("postedAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SocialPost)));
    });
    return unsub;
  }, [isAdmin]);

  // Auto-detect platform when URL is typed
  const handleUrlChange = async (url: string) => {
    const detected = detectPlatform(url);
    setForm((f) => ({ ...f, postUrl: url, platform: detected || f.platform }));

    // Auto-fetch oEmbed if URL looks complete
    if (url.length > 20 && (url.includes("instagram.com/p/") || url.includes("tiktok.com/@"))) {
      setFetching(true);
      try {
        const res = await fetch("/api/social-feed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        const data = await res.json();
        if (data.imageUrl || data.caption) {
          setForm((f) => ({
            ...f,
            platform: data.platform ?? f.platform,
            imageUrl: data.imageUrl ?? f.imageUrl,
            caption: data.caption ?? f.caption,
          }));
        }
      } catch {}
      setFetching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!form.platform) { setError("Select a platform"); return; }
    if (!form.postUrl.trim()) { setError("Post URL is required"); return; }
    if (!form.caption.trim()) { setError("Caption is required"); return; }

    setSaving(true);
    try {
      await addDoc(collection(db, "socialFeed"), {
        platform: form.platform,
        postUrl: form.postUrl.trim(),
        imageUrl: form.imageUrl.trim(),
        caption: form.caption.trim(),
        likes: form.likes ? Number(form.likes) : null,
        views: form.views ? Number(form.views) : null,
        postedAt: new Date(form.postedAt + "T12:00:00").toISOString(),
        featured: form.featured,
        createdAt: serverTimestamp(),
      });
      setForm(emptyForm);
      setSuccess("Post added to feed ✓");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this post from the feed?")) return;
    try {
      await deleteDoc(doc(db, "socialFeed", id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  };

  if (loading || !isAdmin) return null;

  return (
    <main className="max-w-5xl mx-auto px-6 pb-24 space-y-10 pt-8">
      <div>
        <h1 className="text-2xl font-bold">Social Feed Manager</h1>
        <p className="text-white/40 text-sm mt-1">
          Add posts to the Live Feed on the homepage and Connect page. Posts appear in real-time.
        </p>
      </div>

      {/* ── Add Post Form ─────────────────────────────────── */}
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 space-y-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-white/50">
          Add New Post
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Post URL (auto-detects platform + auto-fetches metadata) */}
          <div className="space-y-1">
            <label className="text-xs text-white/40 font-medium uppercase tracking-wider">
              Post URL *
              {fetching && (
                <span className="ml-2 text-pink-400 normal-case font-normal">
                  Fetching metadata…
                </span>
              )}
            </label>
            <input
              type="url"
              placeholder="https://www.instagram.com/p/... or https://www.tiktok.com/@..."
              value={form.postUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-pink-500/50 transition"
            />
            <p className="text-white/25 text-[10px]">
              TikTok posts auto-fetch thumbnail. Instagram image URL required manually.
            </p>
          </div>

          {/* Platform */}
          <div className="space-y-1">
            <label className="text-xs text-white/40 font-medium uppercase tracking-wider">Platform *</label>
            <div className="flex gap-2">
              {(["instagram", "tiktok"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, platform: p }))}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition ${
                    form.platform === p
                      ? "bg-pink-600 border-pink-500 text-white"
                      : "border-white/10 text-white/40 hover:text-white/70"
                  }`}
                >
                  {p === "instagram" ? <InstagramIcon size={13} /> : <TikTokIcon size={12} />}
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Image URL */}
          <div className="space-y-1">
            <label className="text-xs text-white/40 font-medium uppercase tracking-wider">
              Image URL
              {form.imageUrl && (
                <span className="ml-2 text-emerald-400 normal-case font-normal">✓ Preview loaded</span>
              )}
            </label>
            <input
              type="url"
              placeholder="https://... (direct image link, Firebase Storage, or Canva export URL)"
              value={form.imageUrl}
              onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-pink-500/50 transition"
            />
            {form.imageUrl && (
              <div className="mt-2 w-24 h-24 rounded-xl overflow-hidden border border-white/10 bg-white/5">
                <img
                  src={form.imageUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            )}
          </div>

          {/* Caption */}
          <div className="space-y-1">
            <label className="text-xs text-white/40 font-medium uppercase tracking-wider">Caption *</label>
            <textarea
              placeholder="Caption text (shown in the feed card)"
              value={form.caption}
              onChange={(e) => setForm((f) => ({ ...f, caption: e.target.value }))}
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-pink-500/50 transition resize-none"
            />
          </div>

          {/* Stats + Date */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-white/40 font-medium uppercase tracking-wider">
                Likes
              </label>
              <input
                type="number"
                placeholder="0"
                value={form.likes}
                onChange={(e) => setForm((f) => ({ ...f, likes: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-pink-500/50 transition"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-white/40 font-medium uppercase tracking-wider">
                Views (TikTok)
              </label>
              <input
                type="number"
                placeholder="0"
                value={form.views}
                onChange={(e) => setForm((f) => ({ ...f, views: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-pink-500/50 transition"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-white/40 font-medium uppercase tracking-wider">
                Posted Date
              </label>
              <input
                type="date"
                value={form.postedAt}
                onChange={(e) => setForm((f) => ({ ...f, postedAt: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500/50 transition"
              />
            </div>
          </div>

          {/* Featured */}
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))}
              className="w-4 h-4 accent-pink-500"
            />
            <span className="text-sm text-white/50 group-hover:text-white/70 transition">
              Featured post (shown first)
            </span>
          </label>

          {error && (
            <p className="text-red-400 text-sm bg-red-950/30 border border-red-800/40 rounded-xl px-4 py-2">
              {error}
            </p>
          )}
          {success && (
            <p className="text-emerald-400 text-sm bg-emerald-950/30 border border-emerald-800/40 rounded-xl px-4 py-2">
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl transition"
          >
            {saving ? "Adding…" : "Add to Feed"}
          </button>
        </form>
      </div>

      {/* ── Current Feed Posts ────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white/50">
            Live Feed ({posts.length} posts)
          </h2>
          <p className="text-white/25 text-xs">Updates in real-time</p>
        </div>

        {posts.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl">
            <p className="text-white/25 text-sm">No posts yet. Add your first one above.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {posts.map((post) => (
              <div
                key={post.id}
                className="flex items-center gap-4 bg-white/[0.03] border border-white/8 rounded-xl px-4 py-3 hover:border-white/15 transition group"
              >
                {/* Thumbnail */}
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/5 shrink-0">
                  {post.imageUrl ? (
                    <img
                      src={post.imageUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/10 text-xs">
                      {post.platform === "instagram" ? "IG" : "TT"}
                    </div>
                  )}
                </div>

                {/* Platform badge */}
                <div
                  className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider text-white shrink-0"
                  style={{
                    background:
                      post.platform === "instagram"
                        ? "rgba(255,0,127,0.7)"
                        : "rgba(30,30,30,0.9)",
                    border:
                      post.platform === "instagram"
                        ? "none"
                        : "1px solid rgba(255,255,255,0.15)",
                  }}
                >
                  {post.platform === "instagram" ? "IG" : "TT"}
                </div>

                {/* Caption */}
                <p className="flex-1 text-white/60 text-xs truncate min-w-0">
                  {post.caption}
                </p>

                {/* Stats */}
                <div className="text-white/25 text-[10px] shrink-0 hidden sm:block">
                  {post.views
                    ? `${Number(post.views).toLocaleString()}v`
                    : post.likes
                    ? `${Number(post.likes).toLocaleString()}♥`
                    : "—"}
                </div>

                {/* Date */}
                <div className="text-white/20 text-[10px] shrink-0 hidden sm:block">
                  {new Date(post.postedAt).toLocaleDateString("en-CA", {
                    month: "short",
                    day: "numeric",
                  })}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={post.postUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-pink-400/60 hover:text-pink-400 text-[10px] font-semibold transition"
                  >
                    View
                  </a>
                  <button
                    onClick={() => handleDelete(post.id)}
                    className="text-red-500/40 hover:text-red-500 text-[10px] font-semibold transition"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Phase 2 note ──────────────────────────────────── */}
      <div className="border border-white/5 rounded-2xl p-5 space-y-2 bg-white/[0.01]">
        <p className="text-white/25 text-xs font-bold uppercase tracking-wider">Phase 2 — Auto-sync</p>
        <p className="text-white/25 text-xs leading-relaxed">
          Add <code className="text-white/40">INSTAGRAM_GRAPH_TOKEN</code> to Vercel env vars to enable automatic
          Instagram post fetching via the Graph API. TikTok auto-fetch (thumbnail + caption) is already active
          for TikTok posts — paste the URL and it fills in automatically.
        </p>
      </div>
    </main>
  );
}
