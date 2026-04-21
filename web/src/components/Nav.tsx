"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";

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
