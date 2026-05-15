"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";

function ConnectDropdown() {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button className="flex items-center gap-1 text-white/70 hover:text-white transition text-sm">
        Connect
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`}>
          <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute top-full left-1/2 -translate-x-1/2 mt-2 rounded-xl border border-white/10 shadow-2xl shadow-black/60 overflow-hidden z-50 min-w-[160px]"
          style={{ background: "#0e0a1a" }}
        >
          <div className="py-1">
            <a
              href="https://www.instagram.com/allaccesswinnipeg/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-white/60 hover:text-white hover:bg-white/5 transition"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="text-pink-400">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
              Instagram
            </a>
            <a
              href="https://www.tiktok.com/@allaccesswinnipeg"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-white/60 hover:text-white hover:bg-white/5 transition"
            >
              <svg width="12" height="13" viewBox="0 0 24 24" fill="currentColor" className="text-white/50">
                <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.77a4.84 4.84 0 01-1.01-.08z"/>
              </svg>
              TikTok
            </a>
            <a
              href="https://www.twitch.tv/takerslifestyle"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-white/60 hover:text-white hover:bg-white/5 transition"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ color: "#9146ff" }}>
                <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
              </svg>
              Twitch
            </a>
            <div className="h-px bg-white/5 mx-3 my-1" />
            <Link
              href="/connect"
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-white/60 hover:text-white hover:bg-white/5 transition"
            >
              <span className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-pulse" />
              Live Feed
            </Link>
            <Link
              href="/connect?tab=streams"
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-white/60 hover:text-white hover:bg-white/5 transition"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ color: "#9146ff" }}>
                <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
              </svg>
              Streams
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function SocialIcons() {
  return (
    <div className="flex items-center gap-3">
      <a
        href="https://www.instagram.com/allaccesswinnipeg/"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Instagram"
        className="text-white/30 hover:text-pink-500 transition"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
        </svg>
      </a>
      <a
        href="https://www.tiktok.com/@allaccesswinnipeg"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="TikTok"
        className="text-white/30 hover:text-pink-500 transition"
      >
        <svg width="15" height="17" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.77a4.84 4.84 0 01-1.01-.08z"/>
        </svg>
      </a>
    </div>
  );
}

export default function Nav() {
  const { user, profile, isAdmin, loading } = useAuth();
  const router = useRouter();

  if (loading) return null;

  return (
    <nav className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
      <Link href="/" className="text-lg font-bold tracking-tight">
        ALL ACCESS
      </Link>

      <div className="flex items-center gap-6 text-sm">
        {user ? (
          <>
            <Link href="/events" className="text-white/70 hover:text-white transition">Events</Link>
            <Link href="/perks" className="text-white/70 hover:text-white transition">Perks</Link>
            <Link href="/community" className="text-white/70 hover:text-white transition">Community</Link>
            <ConnectDropdown />
            <Link href="/about" className="text-white/70 hover:text-white transition">About</Link>
            {isAdmin && (
              <Link href="/admin" className="text-amber-400 hover:text-amber-300 transition font-medium">
                Admin
              </Link>
            )}
            <Link href="/profile" className="text-white/70 hover:text-white transition">
              {profile?.displayName ?? profile?.email ?? "Profile"}
            </Link>
            <button
              onClick={async () => { await signOut(auth); router.push("/"); }}
              className="text-white/40 hover:text-white transition"
            >
              Sign out
            </button>
          </>
        ) : (
          <>
            <Link href="/events" className="text-white/70 hover:text-white transition">Events</Link>
            <ConnectDropdown />
            <Link href="/about" className="text-white/70 hover:text-white transition">About</Link>
            <SocialIcons />
            <Link href="/login" className="text-white/70 hover:text-white transition">Log in</Link>
            <Link
              href="/signup"
              className="bg-pink-600 hover:bg-pink-500 px-4 py-2 rounded-lg font-medium transition"
            >
              Join Now
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
