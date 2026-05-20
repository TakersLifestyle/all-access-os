"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface PurchaseRecord {
  id: string;
  orderId: string;
  userId: string | null;
  userEmail: string | null;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  isFoundingMember: boolean;
  quantity: number;
  totalPrice: number;
  status: string;
  purchasedAt: string;
  stripeSessionId?: string;
  stripePaymentIntentId?: string | null;
  source?: string;
}

function formatDateTime(iso: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-CA", {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
    });
  } catch { return iso; }
}

function OwnershipBadge({ userId }: { userId: string | null }) {
  if (userId) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        Linked
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/25 text-red-400">
      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
      No UID
    </span>
  );
}

export default function AdminPurchasesPage() {
  const { isAdmin, loading } = useAuth();
  const router = useRouter();
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !isAdmin) router.push("/");
  }, [loading, isAdmin, router]);

  const loadPurchases = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const snap = await getDocs(
        query(collection(db, "eventPurchases"), orderBy("purchasedAt", "desc"))
      );
      const records = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      } as PurchaseRecord));
      setPurchases(records);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load purchases");
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && isAdmin) loadPurchases();
  }, [loading, isAdmin, loadPurchases]);

  if (loading || !isAdmin) return null;

  const confirmed = purchases.filter((p) => p.status === "confirmed");
  const linked = confirmed.filter((p) => !!p.userId);
  const unlinked = confirmed.filter((p) => !p.userId);
  const foundingCount = confirmed.filter((p) => p.isFoundingMember).length;
  const totalRevenue = confirmed.reduce((sum, p) => sum + (p.totalPrice ?? 0), 0);

  return (
    <main className="max-w-6xl mx-auto px-6 py-12 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/admin" className="text-white/30 hover:text-white/60 text-sm transition">
          ← Admin
        </Link>
        <h1 className="text-3xl font-bold">Purchase Records</h1>
        <button
          onClick={loadPurchases}
          disabled={fetching}
          className="ml-auto text-xs px-3 py-1.5 border border-white/15 hover:border-white/30 rounded-lg text-white/50 hover:text-white transition disabled:opacity-40"
        >
          {fetching ? "Loading…" : "Refresh"}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Purchases", value: confirmed.length, color: "text-white" },
          { label: "Ownership Linked", value: `${linked.length} / ${confirmed.length}`, color: linked.length === confirmed.length ? "text-emerald-400" : "text-amber-400" },
          { label: "Founding 15 Sold", value: `${foundingCount} / 15`, color: "text-pink-400" },
          { label: "Total Revenue", value: `$${totalRevenue.toFixed(0)} CAD`, color: "text-emerald-400" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-white/30 text-xs uppercase tracking-wider mb-1">{stat.label}</p>
            <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Unlinked alert */}
      {unlinked.length > 0 && (
        <div className="bg-amber-950/30 border border-amber-500/25 rounded-xl px-4 py-3.5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="text-lg">⚠️</span>
            <div>
              <p className="text-amber-300 text-sm font-bold">
                {unlinked.length} purchase{unlinked.length !== 1 ? "s" : ""} without linked account
              </p>
              <p className="text-amber-300/50 text-xs">
                These buyers won&apos;t see their confirmed state. Run Sync from the admin dashboard.
              </p>
            </div>
          </div>
          <Link
            href="/admin"
            className="shrink-0 text-amber-300 hover:text-amber-200 text-xs font-semibold border border-amber-500/30 hover:border-amber-400/50 px-3 py-1.5 rounded-lg transition"
          >
            Run Sync →
          </Link>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-950/30 border border-red-500/25 rounded-xl px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Purchase table */}
      {fetching ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-xl h-16 animate-pulse" />
          ))}
        </div>
      ) : purchases.length === 0 ? (
        <div className="text-center py-16 text-white/30">
          No purchase records yet.
        </div>
      ) : (
        <div className="space-y-2">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_1.5fr_80px_80px_100px_100px] gap-4 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white/25">
            <span>Buyer</span>
            <span>Event</span>
            <span>Qty</span>
            <span>Amount</span>
            <span>Ownership</span>
            <span>Date</span>
          </div>

          {purchases.map((p) => (
            <div
              key={p.id}
              className={`grid grid-cols-[1fr_1.5fr_80px_80px_100px_100px] gap-4 items-center px-4 py-3.5 rounded-xl border transition ${
                p.status === "confirmed"
                  ? "bg-white/[0.03] border-white/[0.06] hover:border-white/15"
                  : "bg-white/[0.01] border-white/[0.04] opacity-40"
              }`}
            >
              {/* Buyer */}
              <div className="min-w-0">
                <p className="text-white/70 text-xs font-medium truncate">
                  {p.userEmail ?? "—"}
                </p>
                {p.userId && (
                  <p className="text-white/20 text-[10px] font-mono truncate mt-0.5">
                    {p.userId.slice(0, 12)}…
                  </p>
                )}
              </div>

              {/* Event */}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  {p.isFoundingMember && (
                    <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-pink-600/20 border border-pink-500/25 text-pink-300">
                      F15
                    </span>
                  )}
                  <p className="text-white/60 text-xs truncate">{p.eventTitle}</p>
                </div>
                {p.eventDate && (
                  <p className="text-white/20 text-[10px] mt-0.5">{p.eventDate}</p>
                )}
              </div>

              {/* Quantity */}
              <p className="text-white/60 text-sm font-bold">{p.quantity}</p>

              {/* Amount */}
              <p className="text-emerald-400 text-sm font-bold">
                ${(p.totalPrice ?? 0).toFixed(0)}
              </p>

              {/* Ownership */}
              <OwnershipBadge userId={p.userId ?? null} />

              {/* Date */}
              <p className="text-white/25 text-[10px]">
                {p.purchasedAt ? formatDateTime(p.purchasedAt) : "—"}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Footer note */}
      <p className="text-center text-white/20 text-xs">
        Showing all <code className="text-pink-400/60">eventPurchases</code> documents ·{" "}
        Source of truth for user ownership detection
      </p>
    </main>
  );
}
