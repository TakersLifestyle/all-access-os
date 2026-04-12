"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export default function Home() {
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
    <main className="max-w-5xl mx-auto px-6 py-16 space-y-24">

      {/* Hero */}
      <section className="text-center space-y-6">
        <h1 className="text-5xl font-bold tracking-tight">
          ALL ACCESS by <span className="text-pink-500">TakersLifestyle</span>
        </h1>
        <p className="text-white/60 text-lg max-w-xl mx-auto">
          Premium membership for exclusive events, perks, and community.
        </p>
        {!user && (
          <div className="flex gap-4 justify-center pt-2">
            <Link
              href="/signup"
              className="bg-pink-600 hover:bg-pink-500 px-8 py-3 rounded-xl font-semibold text-lg transition"
            >
              Become a Member
            </Link>
            <Link
              href="/login"
              className="border border-white/20 hover:border-white/40 px-8 py-3 rounded-xl font-semibold text-lg transition"
            >
              Log in
            </Link>
          </div>
        )}
        {user && isActive && (
          <Link
            href="/events"
            className="inline-block bg-pink-600 hover:bg-pink-500 px-8 py-3 rounded-xl font-semibold text-lg transition"
          >
            View Events →
          </Link>
        )}
      </section>

      {/* Membership card */}
      {(!user || !isActive) && (
        <section className="max-w-sm mx-auto bg-white/5 border border-white/10 rounded-2xl p-8 space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Become a Member</h2>
            <p className="text-white/50 text-sm mt-1">
              Unlock exclusive access to events, perks, and our community.
            </p>
          </div>

          <div>
            <span className="text-4xl font-bold">$50</span>
            <span className="text-white/50 ml-2">/first month</span>
            <p className="text-pink-400 text-sm font-medium mt-1">
              Founding 50 Offer (Limited to the first 50 members)
            </p>
            <p className="text-white/40 text-sm">Then $99/month.</p>
          </div>

          <button
            onClick={handleCheckout}
            disabled={checkoutLoading}
            className="w-full bg-pink-600 hover:bg-pink-500 disabled:opacity-50 py-3 rounded-xl font-semibold transition"
          >
            {checkoutLoading ? "Redirecting..." : "Subscribe Now"}
          </button>

          {error && (
            <p className="text-red-400 text-sm bg-red-950/40 border border-red-800 rounded-lg p-3">
              {error}
            </p>
          )}
        </section>
      )}

      {/* Features */}
      <section className="grid md:grid-cols-3 gap-6">
        {[
          { title: "Exclusive Events", desc: "Nightlife, experiences, and trips curated for members only.", href: "/events" },
          { title: "Member Perks", desc: "Discounts, giveaways, and partner deals you won't find elsewhere.", href: "/perks" },
          { title: "Community", desc: "Connect and engage with a network of like-minded members.", href: "/community" },
        ].map((f) => (
          <Link
            key={f.title}
            href={user && isActive ? f.href : "/signup"}
            className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-6 space-y-2 transition group"
          >
            <h3 className="font-semibold text-lg group-hover:text-pink-400 transition">{f.title}</h3>
            <p className="text-white/50 text-sm">{f.desc}</p>
          </Link>
        ))}
      </section>

    </main>
  );
}
