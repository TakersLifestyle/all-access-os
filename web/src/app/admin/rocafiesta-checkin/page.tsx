"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { getIdToken } from "firebase/auth";

// ROCAFIESTA event ID — update when adding more events
const ROCAFIESTA_ID = "MCzwl8mGF8P1rL5goEab";

type Tab = "scanner" | "guestlist";

interface OrderResult {
  valid: boolean;
  reason?: string;
  error?: string;
  checkedInAt?: string;
  order?: {
    eventTitle: string;
    userEmail: string;
    quantity: number;
    ticketTierName: string;
    orderId: string;
  };
}

interface GuestOrder {
  orderId: string;
  userEmail: string;
  eventTitle: string;
  ticketTierName: string;
  quantity: number;
  totalPrice: number;
  checkedIn: boolean;
  checkedInAt: string | null;
  createdAt: string;
}

interface Stats {
  total: number;
  checkedIn: number;
  remaining: number;
  totalTickets: number;
}

function fmt12(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit", hour12: true });
  } catch { return iso; }
}

export default function CheckinPage() {
  const { user, profile } = useAuth();
  const [tab, setTab] = useState<Tab>("scanner");

  // Scanner state
  const scannerDivRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<unknown>(null);
  const [scannerActive, setScannerActive] = useState(false);
  const [scanResult, setScanResult] = useState<OrderResult | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [manualId, setManualId] = useState("");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Guest list state
  const [orders, setOrders] = useState<GuestOrder[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [search, setSearch] = useState("");
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [manualCheckinId, setManualCheckinId] = useState<string | null>(null);

  const isAdmin = profile?.role === "admin";

  // ── Auth token helper ───────────────────────────────────────────────────────
  const getToken = useCallback(async () => {
    if (!user) return null;
    try { return await getIdToken(user, false); } catch { return null; }
  }, [user]);

  // ── Verify ticket (scanner + manual) ───────────────────────────────────────
  const verifyTicket = useCallback(async (orderId: string) => {
    setScanLoading(true);
    setScanResult(null);
    const token = await getToken();
    if (!token) { setScanLoading(false); return; }
    try {
      const res = await fetch("/api/admin/verify-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderId: orderId.trim() }),
      });
      const data: OrderResult = await res.json();
      setScanResult(data);
      // Auto-clear after 6 seconds to ready for next scan
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setScanResult(null), 6000);
    } catch {
      setScanResult({ valid: false, reason: "error", error: "Network error. Try again." });
    } finally {
      setScanLoading(false);
    }
  }, [getToken]);

  // ── Start camera scanner ────────────────────────────────────────────────────
  const startScanner = useCallback(async () => {
    if (typeof window === "undefined" || !scannerDivRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { Html5Qrcode } = await import("html5-qrcode") as any;
    const scanner = new Html5Qrcode("qr-reader");
    scannerRef.current = scanner;
    setScannerActive(true);

    await scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 240, height: 240 } },
      async (decodedText: string) => {
        // Pause scanner while processing
        try { await scanner.pause(true); } catch { /* ok */ }
        await verifyTicket(decodedText.trim());
        // Resume after result shown
        setTimeout(async () => {
          try { await scanner.resume(); } catch { /* ok */ }
        }, 3000);
      },
      () => { /* scan failure — quiet */ }
    );
  }, [verifyTicket]);

  const stopScanner = useCallback(async () => {
    const s = scannerRef.current as { stop?: () => Promise<void> } | null;
    if (s?.stop) {
      try { await s.stop(); } catch { /* ok */ }
    }
    scannerRef.current = null;
    setScannerActive(false);
    setScanResult(null);
  }, []);

  // Stop scanner on tab change
  useEffect(() => {
    if (tab !== "scanner" && scannerActive) stopScanner();
  }, [tab, scannerActive, stopScanner]);

  // Cleanup on unmount
  useEffect(() => () => { stopScanner(); }, [stopScanner]);

  // ── Load guest list ─────────────────────────────────────────────────────────
  const loadOrders = useCallback(async (q = "") => {
    setListLoading(true);
    setListError(null);
    const token = await getToken();
    if (!token) { setListLoading(false); return; }
    try {
      const url = `/api/admin/event-orders?eventId=${ROCAFIESTA_ID}${q ? `&search=${encodeURIComponent(q)}` : ""}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load orders.");
      setOrders(data.orders ?? []);
      setStats(data.stats ?? null);
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Failed to load guest list.");
    } finally {
      setListLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (tab === "guestlist" && isAdmin) loadOrders();
  }, [tab, isAdmin, loadOrders]);

  // Search debounce
  useEffect(() => {
    const t = setTimeout(() => { if (tab === "guestlist") loadOrders(search); }, 350);
    return () => clearTimeout(t);
  }, [search, tab, loadOrders]);

  // ── Manual check-in from guest list ────────────────────────────────────────
  const manualCheckin = useCallback(async (orderId: string) => {
    setManualCheckinId(orderId);
    await verifyTicket(orderId);
    setManualCheckinId(null);
    await loadOrders(search);
  }, [verifyTicket, loadOrders, search]);

  // ── Guard ───────────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white/40">Sign in to access check-in.</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white/40">Admin access required.</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#060606] text-white">
      {/* Header */}
      <div className="border-b border-white/8 px-4 py-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] text-amber-400/60 font-bold tracking-[0.2em] uppercase">ALL ACCESS</p>
          <h1 className="text-lg font-black tracking-tight">Door Check-In</h1>
          <p className="text-white/30 text-xs mt-0.5">ROCAFIESTA · September 5, 2026</p>
        </div>
        {stats && (
          <div className="text-right">
            <p className="text-2xl font-black text-amber-400">{stats.checkedIn}</p>
            <p className="text-white/30 text-[10px]">of {stats.totalTickets} checked in</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/8">
        {(["scanner", "guestlist"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3.5 text-sm font-bold tracking-wide transition ${
              tab === t
                ? "text-amber-400 border-b-2 border-amber-400"
                : "text-white/30 hover:text-white/60"
            }`}
          >
            {t === "scanner" ? "📷  Scanner" : "📋  Guest List"}
          </button>
        ))}
      </div>

      {/* ── SCANNER TAB ── */}
      {tab === "scanner" && (
        <div className="p-4 space-y-4 max-w-md mx-auto">

          {/* Result banner */}
          {scanResult && (
            <div
              className={`rounded-2xl border p-5 text-center transition-all ${
                scanResult.valid
                  ? "bg-emerald-950/60 border-emerald-500/40"
                  : scanResult.reason === "already_used"
                  ? "bg-orange-950/60 border-orange-500/40"
                  : "bg-red-950/60 border-red-500/40"
              }`}
            >
              <div className="text-4xl mb-2">
                {scanResult.valid ? "✅" : scanResult.reason === "already_used" ? "⚠️" : "❌"}
              </div>
              <p className={`font-black text-lg mb-1 ${
                scanResult.valid ? "text-emerald-300" : scanResult.reason === "already_used" ? "text-orange-300" : "text-red-300"
              }`}>
                {scanResult.valid
                  ? "Checked In!"
                  : scanResult.reason === "already_used"
                  ? "Already Scanned"
                  : "Invalid Ticket"}
              </p>
              {scanResult.order && (
                <div className="mt-2 space-y-0.5 text-sm">
                  <p className="text-white/70 font-semibold">{scanResult.order.userEmail}</p>
                  <p className="text-white/40">{scanResult.order.quantity} × {scanResult.order.ticketTierName}</p>
                </div>
              )}
              {scanResult.reason === "already_used" && scanResult.checkedInAt && (
                <p className="text-orange-400/60 text-xs mt-1">Scanned at {fmt12(scanResult.checkedInAt)}</p>
              )}
              {scanResult.error && !scanResult.order && (
                <p className="text-white/50 text-sm mt-1">{scanResult.error}</p>
              )}
              <button
                onClick={() => setScanResult(null)}
                className="mt-3 text-white/25 text-xs hover:text-white/50 transition"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Camera scanner box */}
          {!scanResult && (
            <div className="rounded-2xl border border-white/10 bg-black overflow-hidden">
              <div
                id="qr-reader"
                ref={scannerDivRef}
                className="w-full aspect-square"
                style={{ minHeight: 280 }}
              />
              {!scannerActive && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 rounded-2xl pointer-events-none">
                  <p className="text-white/30 text-sm">Camera off</p>
                </div>
              )}
            </div>
          )}

          {/* Start / Stop scanner */}
          {!scannerActive ? (
            <button
              onClick={startScanner}
              disabled={scanLoading}
              className="w-full bg-amber-500 hover:bg-amber-400 text-black font-black py-4 rounded-2xl text-base transition"
            >
              {scanLoading ? "Processing…" : "Start Camera Scanner"}
            </button>
          ) : (
            <button
              onClick={stopScanner}
              className="w-full border border-white/15 text-white/60 hover:text-white hover:border-white/30 font-bold py-3.5 rounded-2xl text-sm transition"
            >
              Stop Scanner
            </button>
          )}

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/8" />
            <span className="text-white/20 text-xs">or enter manually</span>
            <div className="flex-1 h-px bg-white/8" />
          </div>

          {/* Manual Order ID entry */}
          <div className="flex gap-2">
            <input
              type="text"
              value={manualId}
              onChange={(e) => setManualId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && manualId.trim()) {
                  verifyTicket(manualId.trim());
                  setManualId("");
                }
              }}
              placeholder="Paste Order ID…"
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-amber-500/40"
            />
            <button
              onClick={() => { if (manualId.trim()) { verifyTicket(manualId.trim()); setManualId(""); } }}
              disabled={!manualId.trim() || scanLoading}
              className="bg-amber-500 hover:bg-amber-400 disabled:opacity-30 text-black font-black px-5 rounded-xl transition"
            >
              ✓
            </button>
          </div>
        </div>
      )}

      {/* ── GUEST LIST TAB ── */}
      {tab === "guestlist" && (
        <div className="p-4 space-y-4 max-w-2xl mx-auto">

          {/* Stats bar */}
          {stats && (
            <div className="space-y-2">
              {/* Still expected — biggest, most important for staff */}
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-amber-300 text-xs font-bold tracking-widest uppercase">Still Expected</p>
                  <p className="text-amber-400 text-4xl font-black leading-none mt-1">{stats.remaining}</p>
                  <p className="text-amber-300/50 text-xs mt-1">guests still on their way</p>
                </div>
                <span className="text-5xl opacity-20">🎟</span>
              </div>
              {/* Secondary stats */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-emerald-950/30 border border-emerald-700/30 rounded-xl p-3 text-center">
                  <p className="text-emerald-400 text-2xl font-black">{stats.checkedIn}</p>
                  <p className="text-emerald-400/50 text-[10px] mt-0.5">✅ Checked In</p>
                </div>
                <div className="bg-white/[0.03] border border-white/8 rounded-xl p-3 text-center">
                  <p className="text-white text-2xl font-black">{stats.total}</p>
                  <p className="text-white/30 text-[10px] mt-0.5">Total Tickets</p>
                </div>
              </div>
            </div>
          )}

          {/* Inline scan result when checking in from list */}
          {scanResult && (
            <div className={`rounded-xl border p-3 flex items-center gap-3 ${
              scanResult.valid ? "bg-emerald-950/50 border-emerald-600/30" :
              scanResult.reason === "already_used" ? "bg-orange-950/50 border-orange-600/30" :
              "bg-red-950/50 border-red-600/30"
            }`}>
              <span className="text-xl">{scanResult.valid ? "✅" : scanResult.reason === "already_used" ? "⚠️" : "❌"}</span>
              <p className="text-sm text-white/70">{scanResult.valid ? "Checked in successfully." : scanResult.error}</p>
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by email or Order ID…"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-amber-500/40 pr-10"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 text-lg"
              >
                ×
              </button>
            )}
          </div>

          {/* Refresh */}
          <div className="flex items-center justify-between">
            <p className="text-white/25 text-xs">{orders.length} result{orders.length !== 1 ? "s" : ""}</p>
            <button
              onClick={() => loadOrders(search)}
              disabled={listLoading}
              className="text-amber-400/60 hover:text-amber-400 text-xs font-semibold transition"
            >
              {listLoading ? "Loading…" : "↻ Refresh"}
            </button>
          </div>

          {listError && (
            <div className="bg-red-950/40 border border-red-800/40 rounded-xl px-4 py-3 text-red-400 text-sm">
              {listError}
            </div>
          )}

          {/* Orders list */}
          <div className="space-y-2">
            {orders.map((o) => (
              <div
                key={o.orderId}
                className={`border rounded-xl px-4 py-3.5 flex items-center gap-3 transition ${
                  o.checkedIn
                    ? "bg-emerald-950/30 border-emerald-600/30"
                    : "bg-white/[0.02] border-white/8"
                }`}
              >
                {/* Checkmark / dot */}
                <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
                  {o.checkedIn
                    ? <span className="text-xl">✅</span>
                    : <div className="w-3 h-3 rounded-full bg-white/15" />}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white/90 truncate">{o.userEmail || "Guest"}</p>
                  <p className="text-xs text-white/35 mt-0.5">
                    {o.quantity} × {o.ticketTierName}
                  </p>
                  <p className="text-[10px] font-mono text-white/20 mt-0.5 truncate">{o.orderId}</p>
                  {o.checkedIn && o.checkedInAt && (
                    <p className="text-[10px] text-emerald-400/70 mt-0.5">✓ Checked in at {fmt12(o.checkedInAt)}</p>
                  )}
                </div>

                {/* Check-in button */}
                {!o.checkedIn ? (
                  <button
                    onClick={() => manualCheckin(o.orderId)}
                    disabled={manualCheckinId === o.orderId}
                    className="flex-shrink-0 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black text-xs font-black px-3 py-2 rounded-lg transition"
                  >
                    {manualCheckinId === o.orderId ? "…" : "Check In"}
                  </button>
                ) : (
                  <span className="flex-shrink-0 text-emerald-400 text-sm font-black">IN</span>
                )}
              </div>
            ))}

            {!listLoading && orders.length === 0 && (
              <div className="text-center py-12 text-white/20 text-sm">
                {search ? "No guests match that search." : "No confirmed orders yet."}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
