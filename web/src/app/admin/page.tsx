"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getAuth } from "firebase/auth";

export default function AdminPage() {
  const { isAdmin, loading } = useAuth();
  const router = useRouter();
  const [syncStatus, setSyncStatus] = useState<
    | { state: "idle" }
    | { state: "running" }
    | { state: "done"; summary: string; created: number; updated: number }
    | { state: "error"; message: string }
  >({ state: "idle" });

  useEffect(() => {
    if (!loading && !isAdmin) router.push("/");
  }, [loading, isAdmin, router]);

  if (loading || !isAdmin) return null;

  async function runBackfill() {
    setSyncStatus({ state: "running" });
    try {
      const fbAuth = getAuth();
      const token = await fbAuth.currentUser?.getIdToken();
      if (!token) throw new Error("Not authenticated");

      const res = await fetch("/api/admin/backfill-purchases", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Backfill failed");

      setSyncStatus({
        state: "done",
        summary: data.summary,
        created: data.created,
        updated: data.updated,
      });
    } catch (err) {
      setSyncStatus({
        state: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return (
    <main className="max-w-5xl mx-auto px-6 py-12 space-y-10">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>

      {/* Nav cards */}
      <div className="grid md:grid-cols-3 gap-6">
        {[
          { title: "Manage Events", desc: "Create, edit, and delete events.", href: "/admin/events" },
          { title: "Manage Perks", desc: "Add and update member perks.", href: "/admin/perks" },
          { title: "Manage Users", desc: "View members and manage access.", href: "/admin/users" },
          { title: "Purchase Records", desc: "View all ticket purchases and ownership status.", href: "/admin/purchases" },
          { title: "Manage Memories", desc: "Create albums, upload photos, add videos and creator content.", href: "/admin/memories" },
        ].map((item) => (
          <Link
            key={item.title}
            href={item.href}
            className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-6 space-y-2 transition group"
          >
            <h2 className="font-semibold text-lg group-hover:text-amber-400 transition">{item.title}</h2>
            <p className="text-white/50 text-sm">{item.desc}</p>
          </Link>
        ))}
      </div>

      {/* Tools section */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white/70">Platform Tools</h2>

        {/* Sync Purchase Records */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <h3 className="font-semibold text-white">🎟 Sync Purchase Records</h3>
              <p className="text-white/40 text-sm leading-relaxed max-w-md">
                Backfills the <code className="text-pink-400 text-xs">eventPurchases</code> ownership registry from
                all existing paid ticket orders. Run this once to fix buyers who purchased before the
                ownership system was live — they&apos;ll immediately see their confirmed attendee state.
              </p>
            </div>

            <button
              onClick={runBackfill}
              disabled={syncStatus.state === "running"}
              className="shrink-0 bg-pink-600 hover:bg-pink-500 disabled:opacity-50 disabled:cursor-not-allowed px-5 py-2.5 rounded-xl text-sm font-bold transition flex items-center gap-2"
            >
              {syncStatus.state === "running" ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Syncing…
                </>
              ) : (
                "Run Sync"
              )}
            </button>
          </div>

          {/* Status output */}
          {syncStatus.state === "done" && (
            <div className="bg-emerald-950/40 border border-emerald-700/40 rounded-xl px-4 py-3 space-y-1">
              <p className="text-emerald-300 text-sm font-semibold">✅ Sync complete</p>
              <p className="text-emerald-300/70 text-xs">{syncStatus.summary}</p>
              <div className="flex gap-4 pt-1 text-xs text-white/40">
                <span>Created: <span className="text-white/70 font-bold">{syncStatus.created}</span></span>
                <span>Updated: <span className="text-white/70 font-bold">{syncStatus.updated}</span></span>
              </div>
            </div>
          )}

          {syncStatus.state === "error" && (
            <div className="bg-red-950/40 border border-red-700/40 rounded-xl px-4 py-3">
              <p className="text-red-400 text-sm font-semibold">⚠ Sync failed</p>
              <p className="text-red-400/70 text-xs mt-1">{syncStatus.message}</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
