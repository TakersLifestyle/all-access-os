"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";

const perks = [
  {
    icon: "📸",
    title: "Download 4,000+ photos",
    desc: "Every event. Full resolution. Yours to keep forever.",
  },
  {
    icon: "🎟",
    title: "30% off every ticket",
    desc: "DJ LANKZ & SKALES GA: $35 → $24.50. One ticket pays for the month.",
  },
  {
    icon: "⚡",
    title: "Early access — before events sell out",
    desc: "Sea Bears Courtside and ROCAFIESTA both sold out. Members always get in first.",
  },
  {
    icon: "🖤",
    title: "Fund the community directly",
    desc: "ALL ACCESS is a non-profit. Your $10/mo keeps Winnipeg moving.",
  },
];

export default function MembershipPage() {
  const { user, isActive, loading } = useAuth();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    setError(null);
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user?.uid ?? null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Checkout failed");
      if (data.url) window.location.href = data.url;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (loading) return null;

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-16 pb-32">

      {/* Header */}
      <div className="text-center mb-12">
        <p className="text-xs font-bold tracking-[0.2em] uppercase text-pink-500 mb-4">Go ALL ACCESS</p>
        <h1 className="text-4xl sm:text-5xl font-black text-white leading-tight tracking-tight mb-4">
          A lot has happened.<br />
          <span className="text-pink-500">Don&apos;t miss what&apos;s next.</span>
        </h1>
        <p className="text-white/40 text-base leading-relaxed max-w-md mx-auto">
          Two sold-out events. 7+ community nights. 4,000+ photos. And DJ LANKZ &amp; SKALES coming October 9th.
          Membership is how you go deeper — and how you keep this going.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-10">
        {[
          { num: "2", label: "Sold Out Events" },
          { num: "7+", label: "Community Nights" },
          { num: "4K+", label: "Photos Captured" },
        ].map((s) => (
          <div key={s.label} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 text-center">
            <p className="text-2xl font-black text-pink-500 leading-none tracking-tight">{s.num}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/20 mt-2">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Membership card */}
      <div className="bg-white/[0.03] border border-pink-500/20 rounded-2xl overflow-hidden mb-6">
        {/* Card head */}
        <div className="flex items-center justify-between px-6 py-4 bg-pink-500/10 border-b border-pink-500/10">
          <p className="text-xs font-black uppercase tracking-[0.15em] text-pink-400">ALL ACCESS Membership</p>
          <p className="text-2xl font-black text-white tracking-tight">
            $10.61<span className="text-sm font-medium text-white/30">/mo CAD</span>
          </p>
        </div>
        {/* Perks */}
        <div className="divide-y divide-white/[0.04]">
          {perks.map((p) => (
            <div key={p.title} className="flex gap-4 items-start px-6 py-4">
              <span className="text-xl mt-0.5 flex-shrink-0">{p.icon}</span>
              <div>
                <p className="font-bold text-white/85 text-sm">{p.title}</p>
                <p className="text-xs text-white/30 mt-1 leading-relaxed">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      {isActive ? (
        <div className="text-center">
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl px-6 py-5 mb-4">
            <p className="text-white/60 text-sm font-medium">
              ✅ You&apos;re already an ALL ACCESS member. Thank you for supporting the community.
            </p>
          </div>
          <Link href="/events" className="text-sm text-white/30 hover:text-white/60 transition">
            See upcoming events →
          </Link>
        </div>
      ) : (
        <div>
          {error && (
            <p className="text-red-400 text-sm text-center mb-4">{error}</p>
          )}
          <button
            onClick={handleCheckout}
            disabled={checkoutLoading}
            className="w-full bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white font-black text-sm uppercase tracking-wide py-4 rounded-xl transition mb-3"
          >
            {checkoutLoading ? "Redirecting…" : "Go ALL ACCESS — $10.61/mo →"}
          </button>
          <p className="text-center text-xs text-white/20">
            $10.61/mo includes Stripe processing fee · Cancel anytime · Community first
          </p>
          {!user && (
            <p className="text-center text-xs text-white/25 mt-3">
              Already have an account?{" "}
              <Link href="/login" className="text-pink-400 hover:text-pink-300 transition">
                Log in first
              </Link>{" "}
              to link your membership.
            </p>
          )}
        </div>
      )}

    </main>
  );
}
