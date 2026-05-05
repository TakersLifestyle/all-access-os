"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface EventTeaser {
  id: string;
  title: string;
  date: string;
  location: string;
  imageUrl: string;
  ticketsRemaining: number;
  capacity: number;
  memberPrice: number;
  generalPrice: number;
  isLaunchEvent?: boolean;
  status: string;
}

function useEventTeasers() {
  const [events, setEvents] = useState<EventTeaser[]>([]);
  useEffect(() => {
    getDocs(
      query(collection(db, "events"), orderBy("date", "asc"))
    ).then((snap) => {
      const all = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as EventTeaser))
        .filter((e) => e.status !== "draft");
      // Launch event first, active by date middle, coming_soon last
      all.sort((a, b) => {
        if (a.isLaunchEvent && !b.isLaunchEvent) return -1;
        if (!a.isLaunchEvent && b.isLaunchEvent) return 1;
        if (a.status === "coming_soon" && b.status !== "coming_soon") return 1;
        if (a.status !== "coming_soon" && b.status === "coming_soon") return -1;
        return (a.date ?? "").localeCompare(b.date ?? "");
      });
      setEvents(all);
    }).catch(() => {});
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

function fmt(n: number): string {
  const r = Math.round(n * 100) / 100;
  return `$${r % 1 === 0 ? r.toFixed(0) : r.toFixed(2)}`;
}

function cleanTitle(title: string): string {
  return title.replace(/\s*—\s*coming soon/i, "").replace(/coming soon/i, "").trim();
}

export default function Home() {
  const { user, isActive, loading } = useAuth();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const events = useEventTeasers();

  const launchEvent = events.find((e) => e.isLaunchEvent);
  const otherEvents = events.filter((e) => !e.isLaunchEvent);

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

      {/* ── HERO ──────────────────────────────────────────── */}
      <section className="pt-16 text-center space-y-6">
        <div className="inline-flex items-center gap-2 bg-pink-600/15 border border-pink-500/30 rounded-full px-4 py-1.5 text-sm text-pink-300 font-medium">
          <span className="w-2 h-2 bg-pink-400 rounded-full animate-pulse" />
          Launching June 30 — Only 15 Tickets
        </div>

        <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight">
          Built for the<br />
          <span className="text-pink-500">Community</span>
        </h1>

        <p className="text-white/60 text-lg max-w-xl mx-auto leading-relaxed">
          Safe events. Real connection. Lasting impact.<br />
          <span className="text-white/80">ALL ACCESS</span> exists to build healthier communities — one experience at a time.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link
            href="/events"
            className="bg-pink-600 hover:bg-pink-500 px-8 py-3.5 rounded-xl font-bold text-lg transition"
          >
            View Events →
          </Link>
          {!user ? (
            <Link
              href="/signup"
              className="border border-white/20 hover:border-white/40 px-8 py-3.5 rounded-xl font-semibold text-lg transition text-white/70 hover:text-white"
            >
              Create Account
            </Link>
          ) : !isActive ? (
            <button
              onClick={handleCheckout}
              disabled={checkoutLoading}
              className="border border-pink-500/40 hover:border-pink-500/70 px-8 py-3.5 rounded-xl font-semibold text-lg transition text-pink-300 hover:text-pink-200"
            >
              {checkoutLoading ? "Redirecting..." : "Unlock Member Pricing"}
            </button>
          ) : (
            <Link
              href="/perks"
              className="border border-white/20 hover:border-white/40 px-8 py-3.5 rounded-xl font-semibold text-lg transition text-white/70 hover:text-white"
            >
              My Perks
            </Link>
          )}
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-950/40 border border-red-800 rounded-lg p-3 max-w-sm mx-auto">
            {error}
          </p>
        )}
      </section>

      {/* ── LAUNCH EVENT SPOTLIGHT ────────────────────────── */}
      {launchEvent && (
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-white/20 text-xs uppercase tracking-widest font-semibold">First Launch Event</span>
            <div className="flex-1 h-px bg-white/5" />
            <Link href="/events" className="text-pink-400 hover:text-pink-300 text-xs transition">View all →</Link>
          </div>

          <Link href="/events" className="group block rounded-2xl overflow-hidden border border-pink-500/25 bg-pink-950/10 hover:border-pink-500/50 transition-all duration-300 hover:shadow-[0_0_40px_rgba(236,72,153,0.1)]">
            <div className="flex flex-col md:flex-row">
              {launchEvent.imageUrl && (
                <div className="relative md:w-72 h-52 md:h-auto shrink-0 overflow-hidden">
                  <img src={launchEvent.imageUrl} alt={launchEvent.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/30 md:bg-gradient-to-l" />
                </div>
              )}

              <div className="flex-1 p-6 md:p-8 flex flex-col justify-between gap-5">
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <span className="bg-pink-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                      🚀 Launch Event
                    </span>
                    <span className="bg-black/40 border border-white/20 text-white/80 text-xs font-bold px-3 py-1 rounded-full animate-pulse">
                      Only {launchEvent.ticketsRemaining} tickets
                    </span>
                    <span className="bg-white/5 border border-white/15 text-white/50 text-xs font-medium px-3 py-1 rounded-full">
                      June 30, 2026
                    </span>
                  </div>

                  <div>
                    <p className="text-white/30 text-xs font-semibold uppercase tracking-widest mb-1">Founding 15</p>
                    <h2 className="text-2xl md:text-3xl font-bold leading-tight group-hover:text-pink-300 transition">
                      Sea Bears Courtside Experience
                    </h2>
                  </div>

                  <p className="text-white/50 text-sm leading-relaxed max-w-md">
                    15 people. One first launch. June 30 decides who was here first.
                  </p>
                </div>

                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="space-y-0.5">
                    {!user ? (
                      <p className="text-white/40 text-sm">Sign in to view pricing</p>
                    ) : (
                      <>
                        <p className="text-white font-bold text-xl">
                          {fmt(launchEvent.generalPrice)}
                        </p>
                        <p className="text-white/30 text-xs">Founding access — flat rate</p>
                      </>
                    )}
                  </div>
                  <span className="text-pink-400 text-sm font-semibold group-hover:translate-x-1 transition-transform">
                    Claim founding access →
                  </span>
                </div>
              </div>
            </div>
          </Link>
        </section>
      )}

      {/* ── STATS ─────────────────────────────────────────── */}
      <section className="grid grid-cols-3 gap-4 text-center">
        {[
          { stat: "15", label: "Founding seats available" },
          { stat: "6+", label: "Community perks" },
          { stat: "WPG", label: "100% Winnipeg-based" },
        ].map((item) => (
          <div key={item.label} className="bg-white/5 border border-white/10 rounded-2xl py-6 px-4">
            <p className="text-3xl font-bold text-pink-400">{item.stat}</p>
            <p className="text-white/40 text-sm mt-1">{item.label}</p>
          </div>
        ))}
      </section>

      {/* ── THIS SUMMER LINEUP ────────────────────────────── */}
      {otherEvents.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">This Summer Lineup</h2>
              <p className="text-white/35 text-sm mt-1">Four curated experiences. One community.</p>
            </div>
            <Link href="/events" className="text-pink-400 hover:text-pink-300 text-sm transition shrink-0 mt-1">
              View all →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {otherEvents.map((ev) => {
              if (ev.status === "coming_soon") {
                return (
                  <div key={ev.id} className="bg-white/5 border border-white/15 hover:border-purple-500/30 hover:shadow-[0_0_20px_rgba(168,85,247,0.07)] rounded-2xl overflow-hidden transition-all duration-300 group">
                    <div className="relative h-40 overflow-hidden">
                      {ev.imageUrl ? (
                        <img src={ev.imageUrl} alt={cleanTitle(ev.title)}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 brightness-90" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-purple-900/40 via-pink-900/20 to-black" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute top-3 left-3">
                        <span className="bg-purple-600/90 backdrop-blur-sm text-xs text-white border border-purple-400/40 px-2.5 py-0.5 rounded-full font-bold">
                          Future Drop
                        </span>
                      </div>
                    </div>
                    <div className="p-4 space-y-2">
                      <h3 className="font-semibold text-sm leading-tight text-white">{cleanTitle(ev.title)}</h3>
                      <div className="flex items-center justify-between">
                        <span className="text-white/40 text-xs">📅 Date TBA</span>
                        <span className="text-purple-400 text-xs font-semibold">Details soon</span>
                      </div>
                      <p className="text-white/30 text-xs truncate">📍 Private Rooftop Venue</p>
                    </div>
                  </div>
                );
              }

              const spotsLow = ev.capacity > 0 && ev.ticketsRemaining <= Math.ceil(ev.capacity * 0.3);
              const memberPrice = Math.round(ev.generalPrice * 0.85);
              return (
                <Link key={ev.id} href="/events" className="bg-white/5 border border-white/10 hover:border-white/20 rounded-2xl overflow-hidden transition group">
                  <div className="relative h-40 bg-white/5 overflow-hidden">
                    {ev.imageUrl ? (
                      <img src={ev.imageUrl} alt={ev.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-pink-900/30 to-purple-900/30" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    {spotsLow && (
                      <div className="absolute top-3 left-3">
                        <span className="bg-red-900/80 backdrop-blur text-xs text-red-300 border border-red-500/30 px-2 py-0.5 rounded-full font-semibold animate-pulse">
                          ⚡ {ev.ticketsRemaining} left
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-4 space-y-2">
                    <h3 className="font-semibold text-sm leading-tight">{ev.title}</h3>
                    <div className="flex items-center justify-between">
                      <span className="text-white/40 text-xs">{formatDate(ev.date)}</span>
                      {!user ? (
                        <span className="text-emerald-400 text-xs font-semibold">FREE</span>
                      ) : ev.generalPrice > 0 ? (
                        <span className="text-white/60 text-xs font-semibold">
                          From {fmt(isActive ? memberPrice : ev.generalPrice)}
                        </span>
                      ) : (
                        <span className="text-emerald-400 text-xs font-semibold">Free</span>
                      )}
                    </div>
                    {ev.location && <p className="text-white/30 text-xs truncate">📍 {ev.location}</p>}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ── WHAT YOU GET ──────────────────────────────────── */}
      <section className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">Community Experiences</h2>
          <p className="text-white/40 text-sm">Designed for connection. Open to everyone.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            {
              icon: "🎉",
              title: "Events for Everyone",
              desc: "Community socials, sports nights, fundraisers, and cultural experiences. Tickets open to all — members save more.",
              href: "/events",
            },
            {
              icon: "🎁",
              title: "Member Perks",
              desc: "Restaurant discounts, local partner deals, and exclusive promo codes — as a thank-you for supporting the community.",
              href: "/perks",
            },
            {
              icon: "👥",
              title: "Real Connections",
              desc: "A growing network of Winnipeggers who show up, give back, and build something together.",
              href: "/community",
            },
          ].map((f) => (
            <Link
              key={f.title}
              href={f.href}
              className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-pink-500/30 rounded-2xl p-6 space-y-3 transition group"
            >
              <span className="text-3xl">{f.icon}</span>
              <h3 className="font-bold text-lg group-hover:text-pink-400 transition">{f.title}</h3>
              <p className="text-white/50 text-sm leading-relaxed">{f.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* ── MEMBERSHIP ────────────────────────────────────── */}
      {(!user || !isActive) && (
        <section className="max-w-lg mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold">Support the Mission</h2>
            <p className="text-white/40 text-sm max-w-sm mx-auto">
              Membership is voluntary — but it funds real impact and saves you 15% on every ticket.
            </p>
          </div>

          <div className="bg-white/5 border border-pink-500/30 rounded-2xl p-8 space-y-6 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-pink-600/10 rounded-full blur-3xl pointer-events-none" />

            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold">$25</span>
                <span className="text-white/50">/month</span>
              </div>
              <p className="text-pink-400 text-sm font-semibold">Cancel anytime. No commitment.</p>
            </div>

            <ul className="space-y-3 text-sm">
              {[
                "15% off all event tickets",
                "Early access to new events",
                "Local partner perks & discounts",
                "Community feed access",
                "Directly fund safe, accessible experiences",
                "Be part of building Winnipeg's social ecosystem",
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
              {checkoutLoading ? "Redirecting..." : "Become a Supporter — $25/mo"}
            </button>

            {error && (
              <p className="text-red-400 text-sm bg-red-950/40 border border-red-800 rounded-lg p-3">
                {error}
              </p>
            )}

            <p className="text-center text-white/20 text-xs">
              Secure checkout via Stripe. Cancel anytime. Events open to everyone — membership is optional.
            </p>
          </div>
        </section>
      )}

      {/* ── MISSION STRIP ─────────────────────────────────── */}
      <section className="text-center space-y-4 border-t border-white/5 pt-16">
        <p className="text-white/20 text-xs uppercase tracking-widest font-semibold">Our Mission</p>
        <p className="text-white/60 text-lg max-w-2xl mx-auto leading-relaxed">
          ALL ACCESS Winnipeg exists to create safe, engaging, and accessible experiences for youth and young adults — fostering social connection, mental well-being, and cultural growth across our city.
        </p>
        <div className="flex flex-wrap gap-3 justify-center pt-2">
          {["Social Connection", "Mental Well-being", "Youth Engagement", "Cultural Experiences", "Safe Spaces", "Open to Everyone"].map((tag) => (
            <span key={tag} className="bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-white/40 text-xs font-medium">
              {tag}
            </span>
          ))}
        </div>
      </section>

    </main>
  );
}
