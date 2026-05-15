"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";

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
