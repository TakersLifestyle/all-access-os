"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { collection, getDocs, orderBy, query, where, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Lightweight event teaser — only fetches 3 active events, no member-only details
interface EventTeaser {
  id: string;
  title: string;
  date: string;
  location: string;
  imageUrl: string;
  isMembersOnly: boolean;
  ticketsRemaining: number;
  capacity: number;
  memberPrice: number;
  generalPrice: number;
}

function useEventTeasers() {
  const [events, setEvents] = useState<EventTeaser[]>([]);
  useEffect(() => {
    getDocs(
      query(collection(db, "events"),
        where("status", "==", "active"),
        orderBy("date", "asc"),
        limit(3)
      )
    ).then((snap) =>
      setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() } as EventTeaser)))
    ).catch(() => {});
  }, []);
  return events;
}

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  try {
    return new Date(dateStr + "T12:00:00").toLocaleDateString("en-CA", {
      month: "short", day: "numeric", year: "numeric",
    });
  } catch { return dateStr; }
}

export default function Home() {
  const { user, isActive, loading } = useAuth();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const events = useEventTeasers();

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
    <main className="max-w-5xl mx-auto px-6 space-y-24 pb-24">

      {/* ── HERO ─────────────────────────────────────────── */}
      <section className="pt-16 text-center space-y-6">
        {/* Urgency banner */}
        <div className="inline-flex items-center gap-2 bg-pink-600/15 border border-pink-500/30 rounded-full px-4 py-1.5 text-sm text-pink-300 font-medium">
          <span className="w-2 h-2 bg-pink-400 rounded-full animate-pulse" />
          Founding 50 Offer — Limited Spots Remaining
        </div>

        <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight">
          Winnipeg&apos;s Most<br />
          <span className="text-pink-500">Exclusive Membership</span>
        </h1>

        <p className="text-white/60 text-lg max-w-xl mx-auto leading-relaxed">
          Private events. Partner perks. A curated network.<br />
          <span className="text-white/80">ALL ACCESS</span> gives you the life others only watch.
        </p>

        {!user && (
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <button
              onClick={handleCheckout}
              disabled={checkoutLoading}
              className="bg-pink-600 hover:bg-pink-500 disabled:opacity-50 px-8 py-3.5 rounded-xl font-bold text-lg transition"
            >
              {checkoutLoading ? "Redirecting..." : "Get Access — $50/mo →"}
            </button>
            <Link
              href="/login"
              className="border border-white/20 hover:border-white/40 px-8 py-3.5 rounded-xl font-semibold text-lg transition text-white/70 hover:text-white"
            >
              Log in
            </Link>
          </div>
        )}
        {user && !isActive && (
          <button
            onClick={handleCheckout}
            disabled={checkoutLoading}
            className="bg-pink-600 hover:bg-pink-500 disabled:opacity-50 px-10 py-3.5 rounded-xl font-bold text-lg transition"
          >
            {checkoutLoading ? "Redirecting..." : "Activate Membership — $50/mo →"}
          </button>
        )}
        {user && isActive && (
          <div className="flex gap-3 justify-center">
            <Link href="/events" className="bg-pink-600 hover:bg-pink-500 px-8 py-3.5 rounded-xl font-bold text-lg transition">
              View Events →
            </Link>
            <Link href="/perks" className="border border-white/20 hover:border-white/40 px-8 py-3.5 rounded-xl font-semibold text-lg transition text-white/70 hover:text-white">
              My Perks
            </Link>
          </div>
        )}

        {error && (
          <p className="text-red-400 text-sm bg-red-950/40 border border-red-800 rounded-lg p-3 max-w-sm mx-auto">
            {error}
          </p>
        )}

        <p className="text-white/30 text-sm">Then $99/month. Cancel anytime.</p>
      </section>

      {/* ── SOCIAL PROOF ─────────────────────────────────── */}
      <section className="grid grid-cols-3 gap-4 text-center">
        {[
          { stat: "4", label: "Events this summer" },
          { stat: "6+", label: "Exclusive perks" },
          { stat: "50", label: "Members max — founding offer" },
        ].map((item) => (
          <div key={item.label} className="bg-white/5 border border-white/10 rounded-2xl py-6 px-4">
            <p className="text-3xl font-bold text-pink-400">{item.stat}</p>
            <p className="text-white/40 text-sm mt-1">{item.label}</p>
          </div>
        ))}
      </section>

      {/* ── UPCOMING EVENTS TEASER ───────────────────────── */}
      {events.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Upcoming Events</h2>
            <Link href={user && isActive ? "/events" : "/signup"} className="text-pink-400 hover:text-pink-300 text-sm transition">
              {user && isActive ? "View all →" : "Join to unlock →"}
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {events.map((ev) => {
              const spotsLow = ev.capacity > 0 && ev.ticketsRemaining <= Math.ceil(ev.capacity * 0.3);
              return (
                <div key={ev.id} className="bg-white/5 border border-white/10 hover:border-white/20 rounded-2xl overflow-hidden transition group">
                  {/* Image or placeholder */}
                  <div className="relative h-40 bg-white/5 overflow-hidden">
                    {ev.imageUrl ? (
                      <img src={ev.imageUrl} alt={ev.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-pink-900/30 to-purple-900/30" />
                    )}
                    <div className="absolute top-3 left-3 flex gap-2">
                      {ev.isMembersOnly && (
                        <span className="bg-black/70 backdrop-blur text-xs text-pink-300 border border-pink-500/30 px-2 py-0.5 rounded-full font-semibold">
                          Members Only
                        </span>
                      )}
                      {spotsLow && (
                        <span className="bg-red-900/80 backdrop-blur text-xs text-red-300 border border-red-500/30 px-2 py-0.5 rounded-full font-semibold animate-pulse">
                          ⚡ {ev.ticketsRemaining} left
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="p-4 space-y-2">
                    <h3 className="font-semibold text-sm leading-tight">{ev.title}</h3>
                    <div className="flex items-center justify-between">
                      <span className="text-white/40 text-xs">{formatDate(ev.date)}</span>
                      {ev.memberPrice > 0 ? (
                        <span className="text-pink-400 text-xs font-semibold">Members: ${ev.memberPrice}</span>
                      ) : (
                        <span className="text-pink-400 text-xs font-semibold">Members: FREE</span>
                      )}
                    </div>
                    {ev.location && <p className="text-white/30 text-xs truncate">📍 {ev.location}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── WHAT YOU GET ─────────────────────────────────── */}
      <section className="space-y-6">
        <h2 className="text-2xl font-bold text-center">What Members Get</h2>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            {
              icon: "🎉",
              title: "Exclusive Events",
              desc: "Rooftop parties, VIP nightlife, courtside seats, mansion parties. You're on the list — they're not.",
              href: "/events",
            },
            {
              icon: "🎁",
              title: "Real Perks",
              desc: "Free entry, restaurant discounts, photoshoots, gym passes. Promo codes you can actually use.",
              href: "/perks",
            },
            {
              icon: "👥",
              title: "The Network",
              desc: "A curated community of people living the lifestyle. Connect, collaborate, and move as a unit.",
              href: "/community",
            },
          ].map((f) => (
            <Link
              key={f.title}
              href={user && isActive ? f.href : "/signup"}
              className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-pink-500/30 rounded-2xl p-6 space-y-3 transition group"
            >
              <span className="text-3xl">{f.icon}</span>
              <h3 className="font-bold text-lg group-hover:text-pink-400 transition">{f.title}</h3>
              <p className="text-white/50 text-sm leading-relaxed">{f.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* ── PRICING ──────────────────────────────────────── */}
      {(!user || !isActive) && (
        <section className="max-w-lg mx-auto space-y-6">
          <h2 className="text-2xl font-bold text-center">One Price. Full Access.</h2>
          <div className="bg-white/5 border border-pink-500/30 rounded-2xl p-8 space-y-6 relative overflow-hidden">
            {/* Glow */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-pink-600/10 rounded-full blur-3xl pointer-events-none" />

            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold">$50</span>
                <span className="text-white/50">/first month</span>
              </div>
              <p className="text-pink-400 text-sm font-semibold">Founding 50 — first 50 members only</p>
              <p className="text-white/30 text-sm">Then $99/month. Cancel anytime.</p>
            </div>

            <ul className="space-y-3 text-sm">
              {[
                "Access to all member-only events",
                "6+ exclusive partner perks",
                "Private community access",
                "Priority event RSVP",
                "2× giveaway entries",
                "Founding member status forever",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-white/70">
                  <span className="text-pink-400 shrink-0">✓</span> {item}
                </li>
              ))}
            </ul>

            <button
              onClick={handleCheckout}
              disabled={checkoutLoading}
              className="w-full bg-pink-600 hover:bg-pink-500 disabled:opacity-50 py-4 rounded-xl font-bold text-lg transition"
            >
              {checkoutLoading ? "Redirecting..." : "Join Now — $50 First Month"}
            </button>

            {error && (
              <p className="text-red-400 text-sm bg-red-950/40 border border-red-800 rounded-lg p-3">
                {error}
              </p>
            )}

            <p className="text-center text-white/20 text-xs">
              Secure checkout via Stripe. No hidden fees.
            </p>
          </div>
        </section>
      )}

    </main>
  );
}
