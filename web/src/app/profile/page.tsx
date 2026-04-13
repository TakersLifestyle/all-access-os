"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function CheckoutStatus() {
  const params = useSearchParams();
  const status = params.get("checkout");
  if (status === "success") {
    return (
      <div className="bg-green-950/50 border border-green-700 rounded-2xl p-4 text-green-300 text-sm">
        ✅ Payment successful! Your membership will be activated shortly.
      </div>
    );
  }
  if (status === "cancel") {
    return (
      <div className="bg-yellow-950/50 border border-yellow-700 rounded-2xl p-4 text-yellow-300 text-sm">
        Checkout cancelled. Subscribe anytime to activate your membership.
      </div>
    );
  }
  return null;
}

export default function ProfilePage() {
  const { user, profile, isAdmin, loading, refreshToken } = useAuth();
  const router = useRouter();
  const didRefresh = useRef(false);

  // Force-refresh the Firebase ID token when landing from checkout success
  // so new custom claims (status: "active") apply immediately
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.location.search.includes("checkout=success") &&
      user &&
      !didRefresh.current
    ) {
      didRefresh.current = true;
      // Small delay to give the webhook time to set claims before we refresh
      setTimeout(() => refreshToken(), 2500);
    }
  }, [user, refreshToken]);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  if (loading || !profile) return null;

  const roleLabel = profile.role === "admin" ? "Owner" : "Member";
  const roleBadgeClass = profile.role === "admin"
    ? "text-amber-400 bg-amber-400/10 border border-amber-400/30"
    : "text-white/60 bg-white/5 border border-white/10";

  const initial = (profile.displayName ?? profile.email ?? "M")[0].toUpperCase();

  return (
    <main className="max-w-xl mx-auto px-6 py-12 space-y-8">
      <Suspense>
        <CheckoutStatus />
      </Suspense>

      <h1 className="text-3xl font-bold">Your Profile</h1>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
        {/* Avatar + name */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-600 to-pink-800 flex items-center justify-center text-2xl font-bold shrink-0">
            {initial}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-lg">{profile.displayName ?? profile.email?.split("@")[0] ?? "Member"}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${roleBadgeClass}`}>
                {roleLabel}
              </span>
            </div>
            <p className="text-white/40 text-sm">{profile.email}</p>
          </div>
        </div>

        {/* Status + Role */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/5 rounded-xl p-4">
            <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Status</p>
            <p className={`font-semibold ${profile.status === "active" ? "text-green-400" : "text-yellow-400"}`}>
              {profile.status === "active" ? "Active Member" : "Inactive"}
            </p>
          </div>
          <div className="bg-white/5 rounded-xl p-4">
            <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Role</p>
            <p className={`font-semibold ${profile.role === "admin" ? "text-amber-400" : "text-white"}`}>
              {roleLabel}
            </p>
          </div>
        </div>

        {/* Admin shortcut */}
        {isAdmin && (
          <Link
            href="/admin"
            className="flex items-center justify-between w-full bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl px-5 py-4 transition group"
          >
            <div>
              <p className="font-semibold text-amber-400">Admin Dashboard</p>
              <p className="text-white/40 text-sm">Manage events, perks, and members</p>
            </div>
            <span className="text-amber-400 group-hover:translate-x-1 transition-transform">→</span>
          </Link>
        )}
      </div>
    </main>
  );
}
