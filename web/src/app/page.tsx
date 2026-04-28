"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { collection, getDocs, orderBy, query, where, limit } from "firebase/firestore";
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

      {/* ── HERO ──────────────────────────────────────────── */}
      <section className="pt-16 text-center space-y-6">
        <div className="inline-flex items-center gap-2 bg-pink-600/15 border border-pink-500/30 rounded-full px-4 py-1.5 text-sm text-pink-300 font-medium">
          <span className="w-2 h-2 bg-pink-400 rounded-full animate-pulse" />
          Community Impact Organization · Winnipeg
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
            Explore Events →
          </Link>
          {!user ? (
            <Link
              href="/signup"
              className="border border-white/20 hover:border-white/40 px-8 py-3.5 rounded-xl font-semibold text-lg transition text-white/70 hover:text-white"
            >
              Become a Member
            </Link>
          ) : !isActive ? (
            <button
              onClick={handleCheckout}
              disabled={checkoutLoading}
              className="border border-pink-500/40 hover:border-pink-500/70 px-8 py-3.5 rounded-xl font-semibold text-lg transition text-pink-300 hover:text-pink-200"
            >
              {checkoutLoading ? "Redirecting..." : "Unlock Member Benefits"}
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

      {/* ── STATS ─────────────────────────────────────────── */}
      <section className="grid grid-cols-3 gap-4 text-center">
        {[
          { stat: "4", label: "Events this summer" },
          { stat: "6+", label: "Community perks" },
          { stat: "WPG", label: "100% Winnipeg-based" },
        ].map((item) => (
          <div key={item.label} className="bg-white/5 border border-white/10 rounded-2xl py-6 px-4">
            <p className="text-3xl font-bold text-pink-400">{item.stat}</p>
            <p className="text-white/40 text-sm mt-1">{item.label}</p>
          </div>
        ))}
      </section>

      {/* ── UPCOMING EVENTS ───────────────────────────────── */}
      {events.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Upcoming Events</h2>
            <Link href="/events" className="text-pink-400 hover:text-pink-300 text-sm transition">
              View all →
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {events.map((ev) => {
              const spotsLow = ev.capacity > 0 && ev.ticketsRemaining <= Math.ceil(ev.capacity * 0.3);
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
                      {/* Signed-out users see FREE — real pricing only after sign-in */}
                      {!user ? (
                        <span className="text-emerald-400 text-xs font-semibold">FREE</span>
                      ) : ev.generalPrice > 0 ? (
                        <span className="text-white/60 text-xs font-semibold">
                          From ${ev.memberPrice > 0 ? ev.memberPrice : ev.generalPrice}
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
              Membership is a voluntary community contribution — not a requirement. Every supporter helps fund safe events, accessibility programs, and community growth.
            </p>
          </div>

          {/* Where support goes */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: "🎯", text: "Safe event production" },
              { icon: "🔓", text: "Accessibility programs" },
              { icon: "🤝", text: "Community partnerships" },
              { icon: "🌱", text: "Platform & outreach" },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-2.5 bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2.5">
                <span className="text-base">{item.icon}</span>
                <p className="text-white/45 text-xs">{item.text}</p>
              </div>
            ))}
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
              Secure checkout via Stripe. Cancel anytime. Events are open to everyone — membership is optional.
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
        <p className="text-white/30 text-sm max-w-xl mx-auto">
          Community-supported · Mission-driven · Incorporating as a nonprofit organization
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
