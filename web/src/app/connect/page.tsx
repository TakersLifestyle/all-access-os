"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  collection, query, orderBy, limit, onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { type SocialPost } from "@/components/SocialFeedSection";

// ── Icons ─────────────────────────────────────────────────────────────────────

function InstagramIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function TikTokIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.77a4.84 4.84 0 01-1.01-.08z" />
    </svg>
  );
}

function TwitchIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
    </svg>
  );
}

// ── Data ──────────────────────────────────────────────────────────────────────

function isVisible(post: SocialPost): boolean {
  if (post.status === "draft") return false;
  if (post.scheduledAt && new Date(post.scheduledAt) > new Date()) return false;
  return true;
}

function usePosts() {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "socialFeed"), orderBy("postedAt", "desc"), limit(60));
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as SocialPost));
      setPosts(all.filter(isVisible));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  return { posts, loading };
}

function useTwitchStatus() {
  const [status, setStatus] = useState<{
    live: boolean; configured: boolean; channel: string;
    title?: string; viewerCount?: number; game?: string; thumbnailUrl?: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/twitch")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ live: false, configured: false, channel: "takerslifestyle" }));
  }, []);

  return status;
}

// ── Premium post card ─────────────────────────────────────────────────────────

function PostCard({ post }: { post: SocialPost }) {
  const [errored, setErrored] = useState(false);
  const isIG = post.platform === "instagram";

  const dateStr = (() => {
    try { return new Date(post.postedAt).toLocaleDateString("en-CA", { month: "short", day: "numeric" }); }
    catch { return ""; }
  })();

  const platformBadge = (
    <div
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-white text-[9px] font-bold uppercase tracking-wider backdrop-blur-md"
      style={{
        background: isIG ? "rgba(255,0,127,0.85)" : "rgba(10,10,10,0.88)",
        border: isIG ? "1px solid rgba(255,0,127,0.3)" : "1px solid rgba(255,255,255,0.12)",
      }}
    >
      {isIG ? <InstagramIcon size={9} /> : <TikTokIcon size={9} />}
      {isIG ? "Instagram" : "TikTok"}
    </div>
  );

  const hasImage = Boolean(post.imageUrl) && !errored;

  return (
    <a
      href={post.postUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,0,127,0.2)]"
      style={{
        background: hasImage
          ? "transparent"
          : isIG
          ? "linear-gradient(160deg,#1a0025 0%,#3d0055 35%,#7928ca 70%,#c0006a 100%)"
          : "linear-gradient(160deg,#060606 0%,#111118 40%,#1a1a2e 75%,#0f0f1a 100%)",
        border: hasImage ? "1px solid rgba(255,255,255,0.06)" : isIG ? "1px solid rgba(201,0,106,0.3)" : "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {/* Image / gradient area */}
      <div className="aspect-[4/5] relative overflow-hidden bg-[#0a0812]">
        {hasImage ? (
          <img
            src={post.imageUrl}
            alt={post.caption.slice(0, 60) || "Social post"}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            loading="lazy"
            onError={() => setErrored(true)}
          />
        ) : (
          <>
            <div className="absolute inset-0 opacity-20"
              style={{ background: `radial-gradient(ellipse at top right,${isIG ? "#ff007f" : "#69c9d0"},transparent 60%)` }} />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-5">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white"
                style={{ background: isIG ? "linear-gradient(135deg,#ff007f,#7928ca)" : "linear-gradient(135deg,#1a1a1a,#333)", boxShadow: isIG ? "0 8px 32px rgba(255,0,127,0.4)" : "0 8px 32px rgba(0,0,0,0.6)" }}>
                {isIG ? <InstagramIcon size={26} /> : <TikTokIcon size={22} />}
              </div>
              <p className="text-white/75 text-xs leading-relaxed text-center line-clamp-4 font-medium">
                {post.caption || <span className="text-white/30 italic">Latest ALL ACCESS post</span>}
              </p>
            </div>
          </>
        )}

        {/* Gradient overlay on image */}
        {hasImage && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
        )}

        {/* Platform badge */}
        <div className="absolute top-2.5 left-2.5 pointer-events-none">{platformBadge}</div>

        {/* Featured star */}
        {post.featured && (
          <div className="absolute top-2.5 right-2.5 pointer-events-none">
            <span className="bg-amber-500/90 backdrop-blur-sm text-black text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full">
              ★ Featured
            </span>
          </div>
        )}

        {/* Bottom overlay — caption + meta */}
        {hasImage && (
          <div className="absolute bottom-0 inset-x-0 p-3 pointer-events-none">
            <p className="text-white/90 text-[11px] leading-relaxed line-clamp-2 font-medium mb-1.5">
              {post.caption}
            </p>
            <div className="flex items-center justify-between">
              <span className="text-white/40 text-[9px]">{dateStr}</span>
              {(post.views || post.likes) && (
                <span className="text-white/40 text-[9px]">
                  {post.views ? `${Number(post.views).toLocaleString()} views` : `${Number(post.likes).toLocaleString()} likes`}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Hover CTA overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none"
          style={{ background: "rgba(0,0,0,0.35)" }}>
          <span className="bg-white text-black text-xs font-black uppercase tracking-wider px-5 py-2.5 rounded-full shadow-xl transform scale-90 group-hover:scale-100 transition-transform duration-300">
            View Post
          </span>
        </div>
      </div>

      {/* Caption footer (no-image cards only) */}
      {!hasImage && (
        <div className="px-3 py-2.5">
          <div className="flex items-center justify-between">
            <span className="text-white/25 text-[9px]">{dateStr}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg border"
              style={{ color: isIG ? "#ff7eb8" : "#69c9d0", borderColor: isIG ? "rgba(255,0,127,0.2)" : "rgba(105,201,208,0.2)" }}>
              View →
            </span>
          </div>
        </div>
      )}
    </a>
  );
}

// ── Featured spotlight ────────────────────────────────────────────────────────

function FeaturedSpotlight({ post }: { post: SocialPost }) {
  const [errored, setErrored] = useState(false);
  const isIG = post.platform === "instagram";
  const hasImage = Boolean(post.imageUrl) && !errored;

  const dateStr = (() => {
    try { return new Date(post.postedAt).toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" }); }
    catch { return ""; }
  })();

  return (
    <a
      href={post.postUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-3xl overflow-hidden border border-white/8 transition-all duration-500 hover:border-pink-500/30 hover:shadow-[0_20px_60px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,0,127,0.15)]"
    >
      <div className="relative aspect-[16/7] md:aspect-[16/6] overflow-hidden bg-[#0a0812]">
        {hasImage ? (
          <img
            src={post.imageUrl}
            alt={post.caption.slice(0, 80)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
            onError={() => setErrored(true)}
          />
        ) : (
          <div style={{
            background: isIG
              ? "linear-gradient(135deg,#1a0025 0%,#3d0055 40%,#7928ca 75%,#c0006a 100%)"
              : "linear-gradient(135deg,#060606 0%,#1a1a2e 60%,#0f0f1a 100%)"
          }} className="absolute inset-0" />
        )}

        {/* Cinematic gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/40 to-black/10 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

        {/* Content */}
        <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-10">
          <div className="max-w-lg space-y-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="bg-amber-500 text-black text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full">
                ★ Featured
              </span>
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-white text-[9px] font-bold uppercase tracking-wider backdrop-blur-md"
                style={{
                  background: isIG ? "rgba(255,0,127,0.85)" : "rgba(10,10,10,0.88)",
                  border: isIG ? "1px solid rgba(255,0,127,0.3)" : "1px solid rgba(255,255,255,0.15)",
                }}
              >
                {isIG ? <InstagramIcon size={9} /> : <TikTokIcon size={9} />}
                {isIG ? "@allaccesswinnipeg" : "@allaccesswinnipeg"}
              </span>
              <span className="text-white/30 text-[9px]">{dateStr}</span>
            </div>

            <p className="text-white text-lg md:text-2xl font-bold leading-snug line-clamp-3">
              {post.caption || "Latest from ALL ACCESS Winnipeg"}
            </p>

            <div className="flex items-center gap-3 pt-1">
              <span className="inline-flex items-center gap-2 bg-white text-black text-xs font-black uppercase tracking-wider px-5 py-2.5 rounded-full transform group-hover:scale-105 transition-transform duration-300 shadow-lg">
                View Post →
              </span>
              {(post.views || post.likes) && (
                <span className="text-white/40 text-xs">
                  {post.views ? `${Number(post.views).toLocaleString()} views` : `${Number(post.likes).toLocaleString()} likes`}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </a>
  );
}

// ── Streams section ───────────────────────────────────────────────────────────

function TwitchEmbed({ channel }: { channel: string }) {
  const [host, setHost] = useState("allaccesswinnipeg.ca");
  useEffect(() => { setHost(window.location.hostname || "allaccesswinnipeg.ca"); }, []);
  return (
    <div className="rounded-2xl overflow-hidden border border-white/8 bg-black aspect-video w-full">
      <iframe src={`https://player.twitch.tv/?channel=${channel}&parent=${host}&muted=false`}
        width="100%" height="100%" allowFullScreen className="w-full h-full" title={`${channel} on Twitch`} />
    </div>
  );
}

function TwitchChatEmbed({ channel }: { channel: string }) {
  const [host, setHost] = useState("allaccesswinnipeg.ca");
  useEffect(() => { setHost(window.location.hostname || "allaccesswinnipeg.ca"); }, []);
  return (
    <div className="rounded-2xl overflow-hidden border border-white/8 bg-[#18181b] h-full min-h-[420px]">
      <iframe src={`https://www.twitch.tv/embed/${channel}/chat?parent=${host}&darkpopout`}
        width="100%" height="100%" className="w-full h-full min-h-[420px]" title="Twitch Chat" />
    </div>
  );
}

function StreamsSection({ twitch }: { twitch: ReturnType<typeof useTwitchStatus> }) {
  const [showChat, setShowChat] = useState(false);

  return (
    <section className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {twitch?.live ? (
              <><span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" /><span className="text-red-400 text-[10px] font-bold uppercase tracking-widest">Live Now</span></>
            ) : (
              <><span className="w-1.5 h-1.5 bg-white/20 rounded-full" /><span className="text-white/30 text-[10px] font-bold uppercase tracking-widest">Streams</span></>
            )}
          </div>
          <h2 className="text-2xl font-bold">Live Streams</h2>
          <p className="text-white/35 text-sm mt-1">Lofi. Hip hop. Community. Real conversation.</p>
        </div>
        <a href="https://www.twitch.tv/takerslifestyle" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 text-white font-bold text-sm px-4 py-2 rounded-xl transition hover:opacity-80"
          style={{ background: "#9146ff" }}>
          <TwitchIcon size={14} />
          {twitch?.live ? "Watch Live" : "Follow"}
        </a>
      </div>

      {/* Channel bar */}
      <div className="flex items-center justify-between bg-white/[0.03] border border-white/8 rounded-2xl px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#9146ff" }}>
            <TwitchIcon size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-bold text-sm">takerslifestyle</p>
              {twitch?.live && <span className="bg-red-600 text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">Live</span>}
            </div>
            {twitch?.live ? (
              <p className="text-white/40 text-xs truncate max-w-xs">
                {twitch.title ?? "Live now"}{twitch.viewerCount ? ` · ${twitch.viewerCount} watching` : ""}
              </p>
            ) : (
              <p className="text-white/30 text-xs">Twitch · 97 followers</p>
            )}
          </div>
        </div>
        {twitch?.live && (
          <button onClick={() => setShowChat(v => !v)}
            className="text-xs text-white/40 hover:text-white/70 border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-lg transition">
            {showChat ? "Hide Chat" : "Show Chat"}
          </button>
        )}
      </div>

      {/* Player */}
      <div className={`grid gap-4 ${showChat && twitch?.live ? "lg:grid-cols-[1fr_320px]" : ""}`}>
        <TwitchEmbed channel="takerslifestyle" />
        {showChat && twitch?.live && <TwitchChatEmbed channel="takerslifestyle" />}
      </div>

      {twitch?.live && (twitch.game || twitch.viewerCount) && (
        <div className="flex flex-wrap gap-3">
          {twitch.game && <span className="bg-white/5 border border-white/10 text-white/50 text-xs px-3 py-1 rounded-full">🎮 {twitch.game}</span>}
          {twitch.viewerCount !== undefined && <span className="bg-white/5 border border-white/10 text-white/50 text-xs px-3 py-1 rounded-full">👁 {twitch.viewerCount.toLocaleString()} viewers</span>}
        </div>
      )}

      {twitch && !twitch.live && (
        <div className="bg-white/[0.02] border border-white/6 rounded-xl px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-white/40 text-sm font-medium">Channel is offline</p>
            <p className="text-white/20 text-xs mt-0.5">Follow to get notified when we go live. Lofi, hip hop, community conversation.</p>
          </div>
          <a href="https://www.twitch.tv/takerslifestyle" target="_blank" rel="noopener noreferrer"
            className="text-[#9146ff] hover:text-purple-400 text-xs font-bold transition shrink-0 ml-4">
            Follow →
          </a>
        </div>
      )}

      {/* Also on */}
      <div className="space-y-3 pt-2">
        <p className="text-white/20 text-xs font-bold uppercase tracking-wider">Also streaming on</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { icon: "📸", platform: "Instagram Live", desc: "Event coverage, reveals, and real-time community moments.", href: "https://www.instagram.com/allaccesswinnipeg/", label: "Follow on Instagram", color: "text-pink-400" },
            { icon: "🎵", platform: "TikTok Live", desc: "Behind-the-scenes drops, Q&As, and community highlights.", href: "https://www.tiktok.com/@allaccesswinnipeg", label: "Follow on TikTok", color: "text-white/50" },
          ].map((s) => (
            <a key={s.platform} href={s.href} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-4 bg-white/[0.03] border border-white/8 hover:border-pink-500/20 rounded-2xl p-4 transition group">
              <span className="text-2xl">{s.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-white group-hover:text-pink-300 transition">{s.platform}</p>
                <p className="text-white/35 text-xs leading-relaxed mt-0.5 truncate">{s.desc}</p>
              </div>
              <span className={`${s.color} text-xs font-bold shrink-0`}>Follow →</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function FeedSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="aspect-[4/5] rounded-2xl border border-white/6 bg-white/[0.03] animate-pulse" />
      ))}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ tab }: { tab: string }) {
  const platform = tab === "instagram" ? "Instagram" : tab === "tiktok" ? "TikTok" : null;
  return (
    <div className="text-center py-20 space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-2xl">
        {tab === "instagram" ? "📸" : tab === "tiktok" ? "🎵" : "📱"}
      </div>
      <div>
        <p className="text-white/40 font-semibold">No {platform ?? ""} posts yet</p>
        <p className="text-white/20 text-sm mt-1">
          Add posts via{" "}
          <Link href="/admin/social" className="text-pink-400 hover:text-pink-300 transition underline">Admin → Social</Link>
        </p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Tab = "all" | "instagram" | "tiktok" | "streams";

function ConnectPageInner() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as Tab | null;
  const [activeTab, setActiveTab] = useState<Tab>(
    (["all", "instagram", "tiktok", "streams"] as Tab[]).includes(tabParam as Tab)
      ? (tabParam as Tab)
      : "all"
  );

  const { posts, loading } = usePosts();
  const twitch = useTwitchStatus();

  // Separate featured from grid posts
  const featuredPost = posts.find((p) => p.featured && p.imageUrl);
  const gridPosts = posts.filter((p) => !(p.featured && p === featuredPost));

  const filtered = (tab: Tab) => {
    if (tab === "all") return gridPosts;
    if (tab === "instagram") return posts.filter((p) => p.platform === "instagram");
    if (tab === "tiktok") return posts.filter((p) => p.platform === "tiktok");
    return [];
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "all", label: "All Feed" },
    { id: "instagram", label: "Instagram" },
    { id: "tiktok", label: "TikTok" },
    { id: "streams", label: "Streams" },
  ];

  return (
    <main className="max-w-6xl mx-auto px-6 pb-32 space-y-14">

      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="pt-14 space-y-8">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-pink-500 rounded-full animate-pulse" />
            <span className="text-pink-400 text-[10px] font-black uppercase tracking-[0.2em]">
              ALL ACCESS Social
            </span>
          </div>
          <div>
            <h1 className="text-5xl md:text-6xl font-black tracking-tight leading-none text-white">
              Connect
            </h1>
            <p className="text-white/40 text-base max-w-md mt-3 leading-relaxed">
              Follow the moments. Join the conversation. Real community, real time.
            </p>
          </div>
        </div>

        {/* Platform cards */}
        <div className="grid grid-cols-3 gap-3">
          <a href="https://www.instagram.com/allaccesswinnipeg/" target="_blank" rel="noopener noreferrer"
            className="group flex flex-col sm:flex-row items-center gap-3 border border-white/8 bg-white/[0.03] hover:bg-pink-600/8 hover:border-pink-500/30 rounded-2xl p-4 transition-all duration-300 hover:shadow-[0_0_24px_rgba(255,0,127,0.08)]">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
              style={{ background: "linear-gradient(135deg,#ff007f,#7928ca)" }}>
              <InstagramIcon size={20} />
            </div>
            <div className="text-center sm:text-left">
              <p className="font-bold text-white text-sm leading-tight">@allaccesswinnipeg</p>
              <p className="text-white/30 text-xs mt-0.5">Instagram</p>
            </div>
          </a>

          <a href="https://www.tiktok.com/@allaccesswinnipeg" target="_blank" rel="noopener noreferrer"
            className="group flex flex-col sm:flex-row items-center gap-3 border border-white/8 bg-white/[0.03] hover:bg-white/5 hover:border-white/15 rounded-2xl p-4 transition-all duration-300">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 border border-white/10"
              style={{ background: "linear-gradient(135deg,#111,#222)" }}>
              <TikTokIcon size={18} />
            </div>
            <div className="text-center sm:text-left">
              <p className="font-bold text-white text-sm leading-tight">@allaccesswinnipeg</p>
              <p className="text-white/30 text-xs mt-0.5">TikTok</p>
            </div>
          </a>

          <a href="https://www.twitch.tv/takerslifestyle" target="_blank" rel="noopener noreferrer"
            className="group flex flex-col sm:flex-row items-center gap-3 border border-white/8 bg-white/[0.03] hover:bg-purple-600/8 hover:border-purple-500/30 rounded-2xl p-4 transition-all duration-300 hover:shadow-[0_0_24px_rgba(145,70,255,0.08)]">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
              style={{ background: "#9146ff" }}>
              <TwitchIcon size={18} />
            </div>
            <div className="text-center sm:text-left">
              <div className="flex items-center gap-1.5">
                <p className="font-bold text-white text-sm leading-tight">takerslifestyle</p>
                {twitch?.live && (
                  <span className="bg-red-600 text-white text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full animate-pulse">
                    Live
                  </span>
                )}
              </div>
              <p className="text-white/30 text-xs mt-0.5">Twitch</p>
            </div>
          </a>
        </div>
      </section>

      {/* ── Featured spotlight ─────────────────────────── */}
      {!loading && featuredPost && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 text-[10px] font-black uppercase tracking-widest">Featured</span>
            <div className="flex-1 h-px bg-amber-500/10" />
          </div>
          <FeaturedSpotlight post={featuredPost} />
        </section>
      )}

      {/* ── Tab navigation ─────────────────────────────── */}
      <section className="space-y-8">
        <div className="flex items-center gap-1 border-b border-white/8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative pb-3 px-4 text-sm font-bold transition-colors ${
                activeTab === tab.id ? "text-white" : "text-white/30 hover:text-white/60"
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-pink-500 rounded-full" />
              )}
              {tab.id === "streams" && twitch?.live && (
                <span className="absolute top-0 right-1 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "streams" ? (
          <StreamsSection twitch={twitch} />
        ) : loading ? (
          <FeedSkeleton count={activeTab === "all" ? 8 : 6} />
        ) : filtered(activeTab).length === 0 ? (
          <EmptyState tab={activeTab} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered(activeTab).map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </section>

      {/* ── Follow bar ─────────────────────────────────── */}
      {!loading && posts.length > 0 && activeTab !== "streams" && (
        <section className="flex flex-wrap items-center justify-center gap-3 py-8 border-t border-white/5">
          <a href="https://www.instagram.com/allaccesswinnipeg/" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 border border-white/10 hover:border-pink-500/40 hover:bg-pink-600/5 px-5 py-2.5 rounded-xl text-sm text-white/60 hover:text-white font-semibold transition">
            <InstagramIcon size={15} /> Follow on Instagram
          </a>
          <a href="https://www.tiktok.com/@allaccesswinnipeg" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 border border-white/10 hover:border-white/20 hover:bg-white/5 px-5 py-2.5 rounded-xl text-sm text-white/60 hover:text-white font-semibold transition">
            <TikTokIcon size={14} /> Follow on TikTok
          </a>
          <a href="https://www.twitch.tv/takerslifestyle" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 border border-purple-500/20 hover:border-purple-500/40 hover:bg-purple-600/5 px-5 py-2.5 rounded-xl text-sm text-white/60 hover:text-white font-semibold transition">
            <TwitchIcon size={14} /> Follow on Twitch
          </a>
        </section>
      )}
    </main>
  );
}

export default function ConnectPage() {
  return (
    <Suspense fallback={null}>
      <ConnectPageInner />
    </Suspense>
  );
}
