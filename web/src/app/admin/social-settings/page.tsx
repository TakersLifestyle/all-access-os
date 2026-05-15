"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface SyncConfig {
  lastSyncedAt?: string;
  lastSyncResults?: {
    instagramAdded?: number;
    instagramUpdated?: number;
    twitchLive?: boolean;
    errors?: string[];
  };
}

interface ApiStatus {
  instagram: boolean;
  twitch: boolean;
  instagramConfigured?: boolean;
  twitchConfigured?: boolean;
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
        ok
          ? "bg-emerald-900/30 border border-emerald-500/30 text-emerald-400"
          : "bg-red-900/20 border border-red-500/20 text-red-400"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-emerald-400" : "bg-red-400"}`} />
      {label}
    </span>
  );
}

export default function AdminSocialSettingsPage() {
  const { isAdmin, loading } = useAuth();
  const router = useRouter();
  const [config, setConfig] = useState<SyncConfig>({});
  const [apiStatus, setApiStatus] = useState<ApiStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !isAdmin) router.push("/");
  }, [loading, isAdmin, router]);

  // Load sync config from Firestore
  useEffect(() => {
    if (!isAdmin) return;
    const unsub = onSnapshot(doc(db, "config", "social"), (snap) => {
      if (snap.exists()) setConfig(snap.data() as SyncConfig);
    });
    return unsub;
  }, [isAdmin]);

  // Check API status
  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/social/status")
      .then((r) => r.json())
      .then(setApiStatus)
      .catch(() => setApiStatus({ instagram: false, twitch: false }));
  }, [isAdmin]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    setSyncError(null);
    try {
      const { auth } = await import("@/lib/firebase");
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/social/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      const parts: string[] = [];
      if (data.instagramAdded) parts.push(`${data.instagramAdded} new Instagram posts`);
      if (data.instagramUpdated) parts.push(`${data.instagramUpdated} updated`);
      if (data.twitchLive !== undefined) parts.push(`Twitch: ${data.twitchLive ? "🔴 LIVE" : "offline"}`);
      if (data.errors?.length) parts.push(`${data.errors.length} error(s)`);
      setSyncResult(parts.length ? parts.join(" · ") : "Sync complete — no new posts");
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  if (loading || !isAdmin) return null;

  const lastSync = config.lastSyncedAt
    ? new Date(config.lastSyncedAt).toLocaleString("en-CA", {
        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : null;

  return (
    <main className="max-w-4xl mx-auto px-6 pb-24 space-y-10 pt-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/admin/social-feed" className="text-white/30 hover:text-white/60 text-sm transition">
              ← Social Feed
            </Link>
          </div>
          <h1 className="text-2xl font-bold">Social API Settings</h1>
          <p className="text-white/40 text-sm mt-1">
            Configure Instagram, TikTok, and Twitch integrations. Sync real posts into the feed.
          </p>
        </div>
      </div>

      {/* ── Sync Now ─────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-pink-950/30 to-purple-950/20 border border-pink-500/20 rounded-2xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-bold">Manual Sync</h2>
            <p className="text-white/40 text-sm mt-0.5">
              Pull latest posts from configured platforms into the live feed.
            </p>
            {lastSync && (
              <p className="text-white/25 text-xs mt-1">Last synced: {lastSync}</p>
            )}
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="shrink-0 flex items-center gap-2 bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl transition text-sm"
          >
            {syncing ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Syncing…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync Latest Posts
              </>
            )}
          </button>
        </div>

        {syncResult && (
          <p className="text-emerald-400 text-sm bg-emerald-950/30 border border-emerald-800/40 rounded-xl px-4 py-2">
            ✓ {syncResult}
          </p>
        )}
        {syncError && (
          <p className="text-red-400 text-sm bg-red-950/30 border border-red-800/40 rounded-xl px-4 py-2">
            ✗ {syncError}
          </p>
        )}

        {config.lastSyncResults?.errors?.length ? (
          <div className="text-xs text-red-400/70 space-y-0.5">
            {config.lastSyncResults.errors.map((e, i) => (
              <p key={i}>⚠ {e}</p>
            ))}
          </div>
        ) : null}
      </div>

      {/* ── Instagram ────────────────────────────────────── */}
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #ff007f 0%, #7928ca 100%)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-sm">Instagram Graph API</h3>
              <p className="text-white/30 text-xs">@allaccesswinnipeg</p>
            </div>
          </div>
          {apiStatus && (
            <StatusBadge
              ok={apiStatus.instagram}
              label={apiStatus.instagram ? "Connected" : "Token Required"}
            />
          )}
        </div>

        {apiStatus && !apiStatus.instagram ? (
          <div className="space-y-4">
            <div className="bg-amber-950/20 border border-amber-500/20 rounded-xl p-4 space-y-2">
              <p className="text-amber-400 text-xs font-bold uppercase tracking-wider">⚠ Instagram token required</p>
              <p className="text-white/50 text-xs leading-relaxed">
                Auto-fetching Instagram posts requires a long-lived Graph API access token.
                Without it, posts must be added manually via the Social Feed Manager.
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-white/50 text-xs font-bold uppercase tracking-wider">Setup Steps</p>
              <ol className="space-y-2 text-xs text-white/40 leading-relaxed">
                <li className="flex gap-2">
                  <span className="text-pink-400 shrink-0 font-bold">1.</span>
                  Go to{" "}
                  <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer"
                    className="text-pink-400 hover:text-pink-300 underline transition">
                    developers.facebook.com
                  </a>{" "}
                  → Create App → Consumer type
                </li>
                <li className="flex gap-2">
                  <span className="text-pink-400 shrink-0 font-bold">2.</span>
                  Add "Instagram Basic Display" product to the app
                </li>
                <li className="flex gap-2">
                  <span className="text-pink-400 shrink-0 font-bold">3.</span>
                  Generate a User Token with{" "}
                  <code className="bg-white/5 px-1 rounded text-white/60">instagram_basic</code> and{" "}
                  <code className="bg-white/5 px-1 rounded text-white/60">media_content</code> scopes
                </li>
                <li className="flex gap-2">
                  <span className="text-pink-400 shrink-0 font-bold">4.</span>
                  Exchange for a long-lived token (60-day expiry — refresh regularly)
                </li>
                <li className="flex gap-2">
                  <span className="text-pink-400 shrink-0 font-bold">5.</span>
                  Add{" "}
                  <code className="bg-white/5 px-1 rounded text-white/60">INSTAGRAM_GRAPH_TOKEN=your_token</code>{" "}
                  to Vercel Environment Variables → Redeploy
                </li>
              </ol>

              <a
                href="https://vercel.com/tharealprincecharless-projects/all-access-platform/settings/environment-variables"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-pink-400 hover:text-pink-300 text-xs font-bold transition"
              >
                Open Vercel Env Vars →
              </a>
            </div>
          </div>
        ) : apiStatus?.instagram ? (
          <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-4">
            <p className="text-emerald-400 text-xs font-semibold">
              ✓ Connected — sync will pull your latest Instagram posts into the feed automatically.
            </p>
            <p className="text-white/30 text-xs mt-1">
              Note: Instagram tokens expire every 60 days. Refresh before expiry.
            </p>
          </div>
        ) : null}

        <div className="text-white/20 text-xs">
          What syncs: IMAGE posts, CAROUSEL_ALBUM covers, VIDEO thumbnails from @allaccesswinnipeg
        </div>
      </div>

      {/* ── TikTok ───────────────────────────────────────── */}
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-black border border-white/10">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.77a4.84 4.84 0 01-1.01-.08z" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-sm">TikTok</h3>
              <p className="text-white/30 text-xs">@allaccesswinnipeg</p>
            </div>
          </div>
          <StatusBadge ok={true} label="oEmbed Active" />
        </div>

        <div className="bg-white/[0.03] border border-white/8 rounded-xl p-4 space-y-2">
          <p className="text-white/50 text-xs leading-relaxed">
            TikTok uses the public <strong className="text-white/70">oEmbed API</strong> — no token required.
            When you paste a TikTok URL in the Social Feed Manager, the thumbnail and caption
            auto-fill automatically.
          </p>
          <p className="text-white/30 text-xs">
            Limitation: TikTok has no public "fetch my posts" API. Posts must be added manually by URL.
            Full auto-sync would require a TikTok for Business developer account (approval required).
          </p>
        </div>
      </div>

      {/* ── Twitch ───────────────────────────────────────── */}
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "#9146ff" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-sm">Twitch</h3>
              <p className="text-white/30 text-xs">takerslifestyle · 97 followers</p>
            </div>
          </div>
          {apiStatus && (
            <StatusBadge
              ok={apiStatus.twitch}
              label={apiStatus.twitch ? "Connected" : "Credentials Required"}
            />
          )}
        </div>

        {apiStatus && !apiStatus.twitch && (
          <div className="space-y-4">
            <div className="bg-purple-950/20 border border-purple-500/20 rounded-xl p-4 space-y-2">
              <p className="text-purple-400 text-xs font-bold uppercase tracking-wider">⚠ Twitch credentials required for live status</p>
              <p className="text-white/50 text-xs leading-relaxed">
                The Twitch embed player on the Streams tab works without credentials.
                For live status detection (🔴 Live badge, viewer count), add API credentials to Vercel.
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-white/50 text-xs font-bold uppercase tracking-wider">Setup Steps</p>
              <ol className="space-y-2 text-xs text-white/40 leading-relaxed">
                <li className="flex gap-2">
                  <span className="text-purple-400 shrink-0 font-bold">1.</span>
                  Go to{" "}
                  <a href="https://dev.twitch.tv/console/apps" target="_blank" rel="noopener noreferrer"
                    className="text-purple-400 hover:text-purple-300 underline transition">
                    dev.twitch.tv/console/apps
                  </a>{" "}
                  → Register Your Application
                </li>
                <li className="flex gap-2">
                  <span className="text-purple-400 shrink-0 font-bold">2.</span>
                  Category: Website Integration · OAuth: <code className="bg-white/5 px-1 rounded text-white/60">https://allaccesswinnipeg.ca</code>
                </li>
                <li className="flex gap-2">
                  <span className="text-purple-400 shrink-0 font-bold">3.</span>
                  Copy Client ID and generate a Client Secret
                </li>
                <li className="flex gap-2">
                  <span className="text-purple-400 shrink-0 font-bold">4.</span>
                  Add to Vercel:{" "}
                  <code className="bg-white/5 px-1 rounded text-white/60">TWITCH_CLIENT_ID</code> and{" "}
                  <code className="bg-white/5 px-1 rounded text-white/60">TWITCH_CLIENT_SECRET</code>
                </li>
              </ol>

              <a
                href="https://vercel.com/tharealprincecharless-projects/all-access-platform/settings/environment-variables"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 text-xs font-bold transition"
              >
                Open Vercel Env Vars →
              </a>
            </div>
          </div>
        )}

        {apiStatus?.twitch && (
          <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-4">
            <p className="text-emerald-400 text-xs font-semibold">
              ✓ Connected — live status, viewer count, and stream info will show on the Streams tab.
            </p>
          </div>
        )}

        <div className="text-white/20 text-xs">
          Twitch embed player always active at{" "}
          <a href="https://allaccesswinnipeg.ca/connect?tab=streams" className="underline hover:text-white/40 transition">
            /connect?tab=streams
          </a>
        </div>
      </div>

      {/* ── Scheduled Sync ───────────────────────────────── */}
      <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-5 space-y-2">
        <p className="text-white/25 text-xs font-bold uppercase tracking-wider">Scheduled Auto-Sync</p>
        <p className="text-white/25 text-xs leading-relaxed">
          The sync endpoint lives at <code className="text-white/40">/api/social/sync</code> and can be
          called by an external cron service (e.g. Vercel Cron, GitHub Actions, or EasyCron)
          every 2–6 hours to keep the feed current automatically.
          Set the{" "}
          <code className="text-white/40">Authorization: Bearer {"{admin_token}"}</code> header when calling
          externally. For now, use the "Sync Latest Posts" button above to update manually.
        </p>
      </div>
    </main>
  );
}
