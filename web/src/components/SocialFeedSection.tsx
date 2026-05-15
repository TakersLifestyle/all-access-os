"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface SocialPost {
  id: string;
  platform: "instagram" | "tiktok";
  postUrl: string;
  imageUrl: string;
  caption: string;
  likes?: number;
  views?: number;
  postedAt: string;
  featured?: boolean;
}

// ── Icons ─────────────────────────────────────────────────────────────────────

export function InstagramIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

export function TikTokIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.77a4.84 4.84 0 01-1.01-.08z" />
    </svg>
  );
}

// ── Image with error fallback ─────────────────────────────────────────────────

function PostImage({
  src,
  alt,
  postUrl,
  platform,
}: {
  src: string;
  alt: string;
  postUrl: string;
  platform: "instagram" | "tiktok";
}) {
  const [errored, setErrored] = useState(false);
  const isIG = platform === "instagram";

  if (!src || errored) {
    return (
      <a
        href={postUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col items-center justify-center gap-3 w-full h-full text-center px-3"
      >
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white"
          style={{
            background: isIG
              ? "linear-gradient(135deg, #ff007f 0%, #cc0055 100%)"
              : "linear-gradient(135deg, #333 0%, #555 100%)",
          }}
        >
          {isIG ? <InstagramIcon size={16} /> : <TikTokIcon size={14} />}
        </div>
        <p className="text-white/50 text-[10px] leading-tight font-medium">
          Media preview unavailable
        </p>
        <span className="text-pink-400 text-[10px] font-bold border border-pink-500/30 rounded-lg px-2.5 py-1 hover:bg-pink-600/10 transition">
          View Post →
        </span>
      </a>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
      loading="lazy"
      onError={() => setErrored(true)}
    />
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

function SocialCard({ post }: { post: SocialPost }) {
  const isIG = post.platform === "instagram";
  const dateStr = (() => {
    try {
      return new Date(post.postedAt).toLocaleDateString("en-CA", {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "";
    }
  })();

  const hasImage = Boolean(post.imageUrl);

  return (
    <a
      href={post.postUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-2xl overflow-hidden border border-white/10 bg-[#0e0a1a] hover:border-pink-500/40 transition-all duration-300 hover:shadow-[0_0_28px_rgba(255,0,127,0.15)] hover:-translate-y-0.5"
    >
      {/* Image area */}
      <div className="aspect-square relative overflow-hidden bg-[#130e24] flex items-center justify-center">
        <PostImage
          src={post.imageUrl}
          alt={post.caption.slice(0, 60) || "Social post"}
          postUrl={post.postUrl}
          platform={post.platform}
        />

        {/* Only overlay things when image loads successfully */}
        {hasImage && (
          <>
            {/* Gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent pointer-events-none" />

            {/* Platform badge */}
            <div className="absolute top-2.5 left-2.5 pointer-events-none">
              <div
                className="flex items-center gap-1.5 px-2 py-1 rounded-full text-white text-[9px] font-bold uppercase tracking-wider backdrop-blur-md"
                style={{
                  background: isIG ? "rgba(255,0,127,0.85)" : "rgba(10,10,10,0.85)",
                  border: isIG ? "1px solid rgba(255,0,127,0.3)" : "1px solid rgba(255,255,255,0.15)",
                }}
              >
                {isIG ? <InstagramIcon size={10} /> : <TikTokIcon size={10} />}
                {isIG ? "Instagram" : "TikTok"}
              </div>
            </div>

            {/* Stats */}
            {(post.views || post.likes) && (
              <div className="absolute bottom-2.5 right-2.5 text-[9px] text-white/70 font-medium bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded-md pointer-events-none">
                {post.views
                  ? `${Number(post.views).toLocaleString()} views`
                  : `${Number(post.likes).toLocaleString()} likes`}
              </div>
            )}
          </>
        )}

        {/* Platform badge when no image */}
        {!hasImage && (
          <div className="absolute top-2.5 left-2.5">
            <div
              className="flex items-center gap-1.5 px-2 py-1 rounded-full text-white text-[9px] font-bold uppercase tracking-wider"
              style={{
                background: isIG ? "rgba(255,0,127,0.7)" : "rgba(30,30,30,0.9)",
                border: isIG ? "none" : "1px solid rgba(255,255,255,0.15)",
              }}
            >
              {isIG ? <InstagramIcon size={10} /> : <TikTokIcon size={10} />}
              {isIG ? "IG" : "TT"}
            </div>
          </div>
        )}
      </div>

      {/* Caption */}
      <div className="p-3 border-t border-white/5">
        <p className="text-white/70 text-[11px] leading-relaxed line-clamp-2 group-hover:text-white/90 transition min-h-[2.4rem]">
          {post.caption || <span className="text-white/25 italic">No caption</span>}
        </p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-white/25 text-[9px]">{dateStr}</span>
          <span className="text-pink-400 text-[9px] font-bold uppercase tracking-wide group-hover:translate-x-0.5 transition-transform">
            View →
          </span>
        </div>
      </div>
    </a>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyFeed() {
  return (
    <div className="text-center py-16 px-6 border border-dashed border-white/10 rounded-2xl space-y-4">
      <div className="flex items-center justify-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-pink-600/15 border border-pink-500/20 flex items-center justify-center">
          <InstagramIcon size={18} />
        </div>
        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
          <TikTokIcon size={16} />
        </div>
      </div>
      <div>
        <p className="text-white/50 text-sm font-semibold">No posts yet</p>
        <p className="text-white/25 text-xs mt-1 max-w-xs mx-auto">
          Add posts via{" "}
          <Link href="/admin/social-feed" className="text-pink-400 hover:text-pink-300 transition">
            Admin → Social Feed
          </Link>{" "}
          and they&apos;ll appear here instantly.
        </p>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function SocialFeedSection({
  maxPosts = 8,
  showHeader = true,
  showFollowCTAs = true,
}: {
  maxPosts?: number;
  showHeader?: boolean;
  showFollowCTAs?: boolean;
}) {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "socialFeed"),
      orderBy("postedAt", "desc"),
      limit(maxPosts)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SocialPost)));
        setLoading(false);
      },
      () => setLoading(false)
    );

    return unsub;
  }, [maxPosts]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: Math.min(maxPosts, 4) }).map((_, i) => (
          <div
            key={i}
            className="aspect-square rounded-2xl border border-white/8 bg-white/[0.02] animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <section className="space-y-6">
      {showHeader && (
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-pulse" />
              <span className="text-pink-400 text-[10px] font-bold uppercase tracking-widest">
                Live
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight">LIVE FROM ALL ACCESS</h2>
            <p className="text-white/35 text-sm mt-1">
              Real moments. Real community. Real time.
            </p>
          </div>
          <Link
            href="/connect"
            className="text-pink-400 hover:text-pink-300 text-xs font-semibold transition shrink-0 mt-1"
          >
            See all →
          </Link>
        </div>
      )}

      {posts.length === 0 ? (
        <EmptyFeed />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {posts.map((post) => (
            <SocialCard key={post.id} post={post} />
          ))}
        </div>
      )}

      {showFollowCTAs && posts.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          <a
            href="https://www.instagram.com/allaccesswinnipeg/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 border border-white/10 hover:border-pink-500/40 hover:bg-pink-600/5 px-4 py-2 rounded-xl text-sm text-white/55 hover:text-white transition"
          >
            <InstagramIcon size={15} />
            Follow on Instagram
          </a>
          <a
            href="https://www.tiktok.com/@allaccesswinnipeg"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 border border-white/10 hover:border-pink-500/40 hover:bg-pink-600/5 px-4 py-2 rounded-xl text-sm text-white/55 hover:text-white transition"
          >
            <TikTokIcon size={14} />
            Follow on TikTok
          </a>
        </div>
      )}
    </section>
  );
}
