"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

// ── Types ─────────────────────────────────────────────────────────────────────
interface EventPurchase {
  id: string;
  orderId: string;
  userId: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventLocation?: string;
  isFoundingMember: boolean;
  quantity: number;
  totalPrice: number;
  status: string;
  purchasedAt?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(dateStr: string) {
  if (!dateStr) return "";
  try {
    return new Date(dateStr + "T12:00:00").toLocaleDateString("en-CA", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
  } catch { return dateStr; }
}

function formatShortDate(iso: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-CA", {
      month: "long", day: "numeric", year: "numeric",
    });
  } catch { return ""; }
}

// ── Countdown timer ───────────────────────────────────────────────────────────
function getTimeLeft(target: Date) {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  return { days, hours, minutes, seconds, expired: false };
}

function CountdownTimer({ targetDate }: { targetDate: Date }) {
  const [timeLeft, setTimeLeft] = useState(getTimeLeft(targetDate));

  useEffect(() => {
    const t = setInterval(() => setTimeLeft(getTimeLeft(targetDate)), 1000);
    return () => clearInterval(t);
  }, [targetDate]);

  if (timeLeft.expired) {
    return (
      <div className="flex items-center gap-2 justify-center py-1">
        <span>🎉</span>
        <span className="text-emerald-300 font-bold text-sm">Event day is here!</span>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      {[
        { label: "Days", value: timeLeft.days },
        { label: "Hrs", value: timeLeft.hours },
        { label: "Min", value: timeLeft.minutes },
        { label: "Sec", value: timeLeft.seconds },
      ].map(({ label, value }) => (
        <div key={label} className="flex-1 flex flex-col items-center bg-black/40 border border-white/8 rounded-xl py-2">
          <span className="text-lg font-black tabular-nums text-white leading-none">
            {String(value).padStart(2, "0")}
          </span>
          <span className="text-[9px] text-white/20 font-bold uppercase tracking-widest mt-1">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Founding 15 purchase card ─────────────────────────────────────────────────
function FoundingMemberCard({ purchase }: { purchase: EventPurchase }) {
  const eventTarget = new Date(purchase.eventDate + "T19:00:00");
  const paidDate = purchase.purchasedAt ? formatShortDate(purchase.purchasedAt) : null;
  const shortOrderId = purchase.id.slice(-8).toUpperCase();

  return (
    <div className="bg-gradient-to-br from-emerald-950/40 via-black/60 to-black/80 border border-emerald-500/25 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="text-emerald-300 text-[11px] font-bold uppercase tracking-widest">
              Founding 15 Member
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 text-xs font-bold">Confirmed</span>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-black text-white leading-tight">{purchase.eventTitle}</h3>
          <p className="text-white/40 text-sm mt-0.5">
            {formatDate(purchase.eventDate)}
            {purchase.eventLocation ? ` · ${purchase.eventLocation}` : ""}
          </p>
        </div>

        {/* Countdown */}
        <div className="space-y-1.5">
          <p className="text-white/20 text-[9px] font-bold uppercase tracking-widest">Countdown to event</p>
          <CountdownTimer targetDate={eventTarget} />
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-white/[0.06]" />

      {/* Details grid */}
      <div className="grid grid-cols-3 divide-x divide-white/[0.06]">
        <div className="px-4 py-3 text-center">
          <p className="text-white/25 text-[10px] uppercase tracking-widest mb-0.5">Tickets</p>
          <p className="text-white font-bold text-lg leading-none">{purchase.quantity}</p>
        </div>
        <div className="px-4 py-3 text-center">
          <p className="text-white/25 text-[10px] uppercase tracking-widest mb-0.5">Paid</p>
          <p className="text-emerald-400 font-bold text-sm leading-none">
            ${purchase.totalPrice.toFixed(0)}
          </p>
        </div>
        <div className="px-4 py-3 text-center">
          <p className="text-white/25 text-[10px] uppercase tracking-widest mb-0.5">Order</p>
          <p className="text-white/40 font-mono text-[11px] leading-none tracking-wider">#{shortOrderId}</p>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-white/[0.06]" />

      {/* What's included — compact */}
      <div className="px-5 py-4 space-y-2">
        <p className="text-white/25 text-[10px] font-bold uppercase tracking-widest">Your access includes</p>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { emoji: "🏀", label: "Courtside ticket" },
            { emoji: "🍽️", label: "Dinner buffet" },
            { emoji: "🚐", label: "Group transport" },
            { emoji: "📍", label: "Private meetup" },
            { emoji: "🥤", label: "Beverages" },
            { emoji: "📸", label: "Group photos" },
            { emoji: "🏅", label: "Founding badge" },
            { emoji: "⚡", label: "Priority access" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2 px-2.5 py-1.5 bg-white/[0.02] rounded-lg border border-white/[0.04]">
              <span className="text-xs shrink-0">{item.emoji}</span>
              <span className="text-white/45 text-xs">{item.label}</span>
              <span className="text-emerald-400 text-[10px] font-bold ml-auto shrink-0">✓</span>
            </div>
          ))}
        </div>
      </div>

      {/* Transport callout */}
      <div className="mx-5 mb-4 flex items-start gap-2.5 bg-blue-950/25 border border-blue-500/15 rounded-xl px-3.5 py-3">
        <span className="text-base shrink-0 mt-0.5">🚌</span>
        <div>
          <p className="text-blue-300 text-xs font-bold mb-0.5">Transportation included</p>
          <p className="text-blue-300/50 text-xs leading-relaxed">
            Pickup details, meetup location, and departure time sent before June 30.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="h-px bg-white/[0.06]" />
      <div className="px-5 py-3 flex items-center justify-between gap-3">
        {paidDate && (
          <p className="text-white/20 text-xs">Purchased {paidDate}</p>
        )}
        <Link
          href="/events"
          className="ml-auto text-white/50 hover:text-white text-xs font-semibold flex items-center gap-1 transition"
        >
          View event details
          <span className="text-xs">→</span>
        </Link>
      </div>
    </div>
  );
}

// ── Generic event purchase card ───────────────────────────────────────────────
function GenericPurchaseCard({ purchase }: { purchase: EventPurchase }) {
  const eventTarget = new Date(purchase.eventDate + "T19:00:00");
  const shortOrderId = purchase.id.slice(-8).toUpperCase();

  return (
    <div className="bg-white/5 border border-emerald-500/20 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-300 text-xs font-bold">Ticket Confirmed</span>
        </div>

        <div>
          <h3 className="text-base font-bold text-white">{purchase.eventTitle}</h3>
          <p className="text-white/40 text-sm mt-0.5">{formatDate(purchase.eventDate)}</p>
        </div>

        <CountdownTimer targetDate={eventTarget} />
      </div>

      <div className="h-px bg-white/[0.06]" />

      <div className="grid grid-cols-3 divide-x divide-white/[0.06]">
        <div className="px-4 py-3 text-center">
          <p className="text-white/25 text-[10px] uppercase tracking-widest mb-0.5">Tickets</p>
          <p className="text-white font-bold">{purchase.quantity}</p>
        </div>
        <div className="px-4 py-3 text-center">
          <p className="text-white/25 text-[10px] uppercase tracking-widest mb-0.5">Paid</p>
          <p className="text-emerald-400 font-bold text-sm">${purchase.totalPrice.toFixed(0)}</p>
        </div>
        <div className="px-4 py-3 text-center">
          <p className="text-white/25 text-[10px] uppercase tracking-widest mb-0.5">Order</p>
          <p className="text-white/40 font-mono text-[11px] tracking-wider">#{shortOrderId}</p>
        </div>
      </div>

      <div className="h-px bg-white/[0.06]" />
      <div className="px-5 py-3 flex justify-end">
        <Link href="/events" className="text-white/40 hover:text-white text-xs font-semibold flex items-center gap-1 transition">
          View event →
        </Link>
      </div>
    </div>
  );
}

// ── Checkout status banner ────────────────────────────────────────────────────
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

// ── Profile page ──────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { user, profile, isAdmin, loading, refreshToken } = useAuth();
  const router = useRouter();
  const didRefresh = useRef(false);
  const [purchases, setPurchases] = useState<EventPurchase[]>([]);
  const [purchasesLoading, setPurchasesLoading] = useState(false);

  // Force-refresh Firebase ID token when landing from checkout success
  // so new custom claims (status: "active") apply immediately
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.location.search.includes("checkout=success") &&
      user &&
      !didRefresh.current
    ) {
      didRefresh.current = true;
      setTimeout(() => refreshToken(), 2500);
    }
  }, [user, refreshToken]);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  // Fetch this user's confirmed event purchases
  const fetchPurchases = useCallback(async () => {
    if (!user?.uid) return;
    setPurchasesLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, "eventPurchases"), where("userId", "==", user.uid))
      );
      const confirmed = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as EventPurchase))
        .filter((p) => p.status === "confirmed")
        .sort((a, b) => (a.eventDate ?? "").localeCompare(b.eventDate ?? ""));
      setPurchases(confirmed);
    } catch (err) {
      console.error("eventPurchases fetch failed:", err);
    } finally {
      setPurchasesLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (!loading && user) {
      fetchPurchases();
    }
  }, [loading, user, fetchPurchases]);

  if (loading || !profile) return null;

  const isFoundingMember = purchases.some((p) => p.isFoundingMember);
  const roleLabel = profile.role === "admin" ? "Owner" : "Member";
  const roleBadgeClass =
    profile.role === "admin"
      ? "text-amber-400 bg-amber-400/10 border border-amber-400/30"
      : "text-white/60 bg-white/5 border border-white/10";

  const initial = (profile.displayName ?? profile.email ?? "M")[0].toUpperCase();

  return (
    <main className="max-w-xl mx-auto px-6 py-12 space-y-8">
      <Suspense>
        <CheckoutStatus />
      </Suspense>

      <h1 className="text-3xl font-bold">Your Profile</h1>

      {/* Account card */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
        {/* Avatar + name */}
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-600 to-pink-800 flex items-center justify-center text-2xl font-bold">
              {initial}
            </div>
            {/* Founding member ring */}
            {isFoundingMember && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-black flex items-center justify-center">
                <span className="text-[9px]">✓</span>
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-lg">
                {profile.displayName ?? profile.email?.split("@")[0] ?? "Member"}
              </p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${roleBadgeClass}`}>
                {roleLabel}
              </span>
              {isFoundingMember && (
                <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                  🏀 Founding 15
                </span>
              )}
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

      {/* ── Your Experiences ── */}
      {(purchasesLoading || purchases.length > 0) && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Your Experiences</h2>
            {purchases.length > 0 && (
              <span className="text-white/30 text-sm">{purchases.length} upcoming</span>
            )}
          </div>

          {purchasesLoading ? (
            <div className="bg-white/5 border border-white/10 rounded-2xl h-48 animate-pulse" />
          ) : (
            <div className="space-y-4">
              {purchases.map((purchase) =>
                purchase.isFoundingMember ? (
                  <FoundingMemberCard key={purchase.id} purchase={purchase} />
                ) : (
                  <GenericPurchaseCard key={purchase.id} purchase={purchase} />
                )
              )}
            </div>
          )}
        </div>
      )}

      {/* No experiences — gentle nudge toward events */}
      {!purchasesLoading && purchases.length === 0 && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 text-center space-y-3">
          <p className="text-3xl">🏀</p>
          <p className="text-white/50 font-semibold">No upcoming experiences yet</p>
          <p className="text-white/25 text-sm">
            Join us courtside for the ALL ACCESS Founding 15 launch on June 30.
          </p>
          <Link
            href="/events"
            className="inline-block mt-2 bg-pink-600 hover:bg-pink-500 px-6 py-2.5 rounded-xl text-sm font-bold transition"
          >
            Browse Events
          </Link>
        </div>
      )}
    </main>
  );
}
