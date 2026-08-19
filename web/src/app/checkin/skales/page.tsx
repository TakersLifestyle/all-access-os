"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Order {
  id: string;
  userEmail: string | null;
  quantity: number;
  totalPrice: number | null;
  checkedIn: boolean;
  checkedInAt: string | null;
  createdAt: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const PIN_LENGTH = 4;
const REFRESH_INTERVAL = 30_000; // 30 s

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(iso: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("en-CA", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CheckInPage() {
  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [pinError, setPinError] = useState(false);

  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [checkedInCount, setCheckedInCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const [search, setSearch] = useState("");
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const pinRef = useRef(pin);
  pinRef.current = pin;

  // ── Fetch orders ─────────────────────────────────────────────────────────
  const fetchOrders = useCallback(async (currentPin: string, silent = false) => {
    if (!silent) setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/checkin?pin=${encodeURIComponent(currentPin)}`);
      if (res.status === 401) {
        setUnlocked(false);
        setPinError(true);
        setPin("");
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setOrders(data.orders ?? []);
      setTotal(data.total ?? 0);
      setCheckedInCount(data.checkedInCount ?? 0);
      setLastRefresh(new Date());
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Failed to load guest list.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Auto-refresh when unlocked
  useEffect(() => {
    if (!unlocked) return;
    const id = setInterval(() => fetchOrders(pinRef.current, true), REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [unlocked, fetchOrders]);

  // ── PIN handlers ─────────────────────────────────────────────────────────
  const pressDigit = (d: string) => {
    if (pin.length >= PIN_LENGTH) return;
    setPinError(false);
    const next = pin + d;
    setPin(next);
    if (next.length === PIN_LENGTH) submitPin(next);
  };

  const pressBack = () => setPin((p) => p.slice(0, -1));

  const submitPin = async (p: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/checkin?pin=${encodeURIComponent(p)}`);
      if (res.status === 401) {
        setPinError(true);
        setPin("");
        return;
      }
      if (!res.ok) {
        const errText = await res.text().catch(() => `Server error (${res.status})`);
        setFetchError(`Server error — try again. (${res.status})`);
        console.error("[checkin] submitPin error:", errText);
        setPin("");
        return;
      }
      const data = await res.json();
      setOrders(data.orders ?? []);
      setTotal(data.total ?? 0);
      setCheckedInCount(data.checkedInCount ?? 0);
      setLastRefresh(new Date());
      setUnlocked(true);
    } catch (e) {
      setFetchError("Network error — check connection and try again.");
      setPin("");
      console.error("[checkin] submitPin threw:", e);
    } finally {
      setLoading(false);
    }
  };

  // ── Check in ─────────────────────────────────────────────────────────────
  const checkIn = async (orderId: string) => {
    setCheckingIn(orderId);
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinRef.current, orderId }),
      });
      const data = await res.json();
      if (data.already) {
        showToast(`Already checked in at ${fmt(data.checkedInAt)}`, false);
      } else if (data.success) {
        showToast("✓ Checked in!", true);
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? { ...o, checkedIn: true, checkedInAt: new Date().toISOString() }
              : o
          )
        );
        setCheckedInCount((c) => {
          const qty = orders.find((o) => o.id === orderId)?.quantity ?? 1;
          return c + qty;
        });
      } else {
        showToast(data.error ?? "Check-in failed", false);
      }
    } catch {
      showToast("Network error — try again", false);
    } finally {
      setCheckingIn(null);
    }
  };

  const showToast = (text: string, ok: boolean) => {
    setToastMsg({ text, ok });
    setTimeout(() => setToastMsg(null), 3000);
  };

  // ── Filter ───────────────────────────────────────────────────────────────
  const filtered = orders.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (o.userEmail ?? "").toLowerCase().includes(q) || o.id.toLowerCase().includes(q);
  });

  const checkedInOrders = filtered.filter((o) => o.checkedIn);
  const pendingOrders = filtered.filter((o) => !o.checkedIn);
  const pct = total > 0 ? Math.round((checkedInCount / total) * 100) : 0;

  // ── Render: PIN screen ───────────────────────────────────────────────────
  if (!unlocked) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 select-none">
        {/* Header */}
        <div className="text-center mb-10">
          <p className="text-[#84cc16] text-xs font-black uppercase tracking-[0.25em] mb-2">
            Door Staff Access
          </p>
          <h1 className="text-white text-2xl font-black tracking-tight">DJ LANKZ & FRIENDS</h1>
          <p className="text-white/40 text-sm mt-1">SKALES · October 9, 2026</p>
        </div>

        {/* PIN dots */}
        <div className="flex gap-4 mb-8">
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                i < pin.length
                  ? "bg-[#84cc16] border-[#84cc16]"
                  : pinError
                  ? "bg-red-500/30 border-red-500"
                  : "bg-transparent border-white/30"
              }`}
            />
          ))}
        </div>
        {pinError && (
          <p className="text-red-400 text-sm font-semibold mb-6 -mt-4">Incorrect PIN</p>
        )}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
          {["1","2","3","4","5","6","7","8","9"].map((d) => (
            <button
              key={d}
              onClick={() => pressDigit(d)}
              disabled={loading}
              className="h-16 rounded-2xl bg-white/[0.07] hover:bg-white/[0.14] active:bg-white/[0.20] text-white text-2xl font-bold transition-all duration-100 disabled:opacity-40"
            >
              {d}
            </button>
          ))}
          <div />
          <button
            onClick={() => pressDigit("0")}
            disabled={loading}
            className="h-16 rounded-2xl bg-white/[0.07] hover:bg-white/[0.14] active:bg-white/[0.20] text-white text-2xl font-bold transition-all duration-100 disabled:opacity-40"
          >
            0
          </button>
          <button
            onClick={pressBack}
            disabled={loading}
            className="h-16 rounded-2xl bg-white/[0.07] hover:bg-white/[0.14] active:bg-white/[0.20] text-white/60 text-xl font-bold transition-all duration-100 disabled:opacity-40"
          >
            ⌫
          </button>
        </div>

        {loading && (
          <div className="mt-8 flex items-center gap-2 text-white/40 text-sm">
            <span className="w-4 h-4 border-2 border-white/20 border-t-[#84cc16] rounded-full animate-spin" />
            Verifying…
          </div>
        )}
        {fetchError && !loading && (
          <p className="mt-6 text-red-400 text-sm font-semibold text-center max-w-xs">
            {fetchError}
          </p>
        )}
      </div>
    );
  }

  // ── Render: Guest list ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Toast */}
      {toastMsg && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-bold shadow-xl transition-all ${
            toastMsg.ok
              ? "bg-[#84cc16] text-black"
              : "bg-red-600 text-white"
          }`}
        >
          {toastMsg.text}
        </div>
      )}

      {/* Sticky header */}
      <div className="sticky top-0 z-40 bg-black/95 backdrop-blur border-b border-white/10 px-4 py-4 space-y-3">
        {/* Event + stats */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[#84cc16] text-[10px] font-black uppercase tracking-[0.2em]">
              DJ LANKZ & FRIENDS
            </p>
            <h1 className="text-white text-base font-black leading-tight">
              SKALES · Oct 9
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-[#84cc16] text-2xl font-black leading-none">{checkedInCount}</p>
              <p className="text-white/30 text-[9px] uppercase tracking-widest mt-0.5">In</p>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-center">
              <p className="text-white text-2xl font-black leading-none">{total}</p>
              <p className="text-white/30 text-[9px] uppercase tracking-widest mt-0.5">Total</p>
            </div>
            <div className="text-center">
              <p className="text-white/50 text-2xl font-black leading-none">{total - checkedInCount}</p>
              <p className="text-white/30 text-[9px] uppercase tracking-widest mt-0.5">Left</p>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#84cc16] rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Search */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input
            type="search"
            placeholder="Search by email or order ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/[0.06] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-[#84cc16]/50"
          />
        </div>

        {/* Refresh info */}
        <div className="flex items-center justify-between text-[10px] text-white/25">
          <span>Auto-refresh every 30s{lastRefresh ? ` · Last: ${fmt(lastRefresh.toISOString())}` : ""}</span>
          <button
            onClick={() => fetchOrders(pin)}
            className="text-[#84cc16]/60 hover:text-[#84cc16] font-bold transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-lg mx-auto px-4 py-4 space-y-6">
        {loading && (
          <div className="flex justify-center py-12">
            <span className="w-8 h-8 border-2 border-white/10 border-t-[#84cc16] rounded-full animate-spin" />
          </div>
        )}
        {fetchError && (
          <div className="bg-red-950/50 border border-red-800/50 rounded-xl px-4 py-3 text-red-400 text-sm">
            {fetchError}
          </div>
        )}

        {!loading && pendingOrders.length > 0 && (
          <section className="space-y-2">
            <p className="text-white/25 text-[10px] font-bold uppercase tracking-widest px-1">
              Not yet checked in ({pendingOrders.reduce((s, o) => s + o.quantity, 0)} tickets)
            </p>
            {pendingOrders.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                checking={checkingIn === order.id}
                onCheckIn={() => checkIn(order.id)}
              />
            ))}
          </section>
        )}

        {!loading && checkedInOrders.length > 0 && (
          <section className="space-y-2">
            <p className="text-white/25 text-[10px] font-bold uppercase tracking-widest px-1">
              Checked in ({checkedInOrders.reduce((s, o) => s + o.quantity, 0)} tickets)
            </p>
            {checkedInOrders.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                checking={false}
                onCheckIn={() => {}}
              />
            ))}
          </section>
        )}

        {!loading && filtered.length === 0 && !fetchError && (
          <div className="text-center py-16 text-white/30 text-sm">
            {search ? "No guests match that search." : "No paid tickets yet."}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Order row ─────────────────────────────────────────────────────────────────
function OrderRow({
  order,
  checking,
  onCheckIn,
}: {
  order: Order;
  checking: boolean;
  onCheckIn: () => void;
}) {
  const email = order.userEmail ?? null;
  const displayName = email ?? "Guest checkout";
  const isGuest = !email;

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-3.5 transition-all ${
        order.checkedIn
          ? "bg-[#84cc16]/5 border-[#84cc16]/20"
          : "bg-white/[0.03] border-white/10"
      }`}
    >
      {/* Status dot */}
      <div
        className={`w-2.5 h-2.5 rounded-full shrink-0 ${
          order.checkedIn ? "bg-[#84cc16]" : "bg-white/20"
        }`}
      />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-semibold truncate ${
            order.checkedIn ? "text-white/60" : "text-white"
          } ${isGuest ? "italic" : ""}`}
        >
          {displayName}
        </p>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-white/30 text-xs">
            {order.quantity} ticket{order.quantity > 1 ? "s" : ""}
          </span>
          {order.checkedIn && order.checkedInAt && (
            <span className="text-[#84cc16]/60 text-xs font-bold">
              ✓ {fmt(order.checkedInAt)}
            </span>
          )}
        </div>
      </div>

      {/* Action */}
      {order.checkedIn ? (
        <span className="shrink-0 text-[#84cc16]/50 text-xs font-bold uppercase tracking-wider">
          In
        </span>
      ) : (
        <button
          onClick={onCheckIn}
          disabled={checking}
          className="shrink-0 bg-[#84cc16] hover:bg-[#a3e635] active:bg-[#65a30d] disabled:opacity-50 text-black text-xs font-black uppercase tracking-wider px-4 py-2 rounded-lg transition-all"
        >
          {checking ? (
            <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin inline-block" />
          ) : (
            "Check In"
          )}
        </button>
      )}
    </div>
  );
}
