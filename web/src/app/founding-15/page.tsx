"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface LaunchEvent {
  id: string;
  ticketsRemaining: number;
  capacity: number;
  generalPrice: number;
  memberPrice: number;
  status: string;
}

function useCountdown(targetDate: string) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const target = new Date(targetDate).getTime();

    const tick = () => {
      const now = Date.now();
      const diff = target - now;
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft({ days, hours, minutes, seconds });
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  return timeLeft;
}

function fmt(n: number) {
  return `$${Math.round(n)}`;
}

export default function Founding15Page() {
  const { user, isActive, loading } = useAuth();
  const [launchEvent, setLaunchEvent] = useState<LaunchEvent | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const countdown = useCountdown("2026-06-30T19:00:00-05:00");

  useEffect(() => {
    getDocs(query(collection(db, "events"), where("isLaunchEvent", "==", true)))
      .then((snap) => {
        if (!snap.empty) {
          const doc = snap.docs[0];
          setLaunchEvent({ id: doc.id, ...doc.data() } as LaunchEvent);
        }
      })
      .catch(() => {});
  }, []);

  const handleCheckout = async () => {
    setError(null);
    if (!user) {
      window.location.href = "/signup?redirect=/founding-15";
      return;
    }
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/event-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: launchEvent?.id,
          quantity: 1,
          uid: user.uid,
          userEmail: user.email,
        }),
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

  const seatsLeft = launchEvent?.ticketsRemaining ?? 15;
  const isSoldOut = launchEvent?.status === "sold_out" || seatsLeft === 0;
  const price = launchEvent?.generalPrice ?? 300;

  if (loading) return null;

  return (
    <main className="min-h-screen">

      {/* ── URGENCY BAR ──────────────────────────────────────── */}
      <div
        className="sticky top-0 z-40 border-b border-pink-500/20 backdrop-blur-md"
        style={{ background: "rgba(14,10,26,0.95)" }}
      >
        <div className="max-w-4xl mx-auto px-6 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-pink-500 rounded-full animate-pulse" />
            <span className="text-xs text-white/50 font-medium uppercase tracking-widest">Founding 15</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 text-xs text-white/40">
              <span className="font-bold text-pink-400 text-sm">{seatsLeft}</span>
              <span>of 15 seats left</span>
            </div>
            {!isSoldOut && (
              <button
                onClick={handleCheckout}
                disabled={checkoutLoading}
                className="bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white text-xs font-bold px-4 py-1.5 rounded-lg transition"
              >
                {checkoutLoading ? "Loading…" : "Claim Yours →"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden flex flex-col items-center justify-center text-center px-6 pt-20 pb-24"
        style={{ minHeight: "90vh" }}
      >
        {/* Background glows */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full opacity-20"
            style={{ background: "radial-gradient(ellipse, #ff007f 0%, transparent 65%)" }}
          />
          <div
            className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full opacity-10"
            style={{ background: "radial-gradient(ellipse, #ff007f 0%, transparent 70%)" }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-3xl mx-auto space-y-8">
          <div className="inline-flex items-center gap-2 border border-pink-500/30 bg-pink-600/10 rounded-full px-5 py-2 text-sm text-pink-300 font-semibold tracking-wide uppercase">
            June 30, 2026 · Winnipeg
          </div>

          <h1
            className="font-black uppercase leading-none tracking-tight"
            style={{ fontSize: "clamp(64px, 12vw, 120px)", letterSpacing: "-0.03em" }}
          >
            <span className="text-white">FOUNDING</span>
            <br />
            <span style={{ color: "#ff007f" }}>15</span>
          </h1>

          <p className="text-white/60 text-lg md:text-xl leading-relaxed max-w-xl mx-auto">
            Sea Bears Courtside Experience — Dinner, transport, courtside seats, and 14 people
            who showed up when it mattered. <span className="text-white/90 font-semibold">This is how ALL ACCESS begins.</span>
          </p>

          {/* Countdown */}
          <div className="flex items-center justify-center gap-3 md:gap-6">
            {[
              { val: countdown.days, label: "Days" },
              { val: countdown.hours, label: "Hours" },
              { val: countdown.minutes, label: "Min" },
              { val: countdown.seconds, label: "Sec" },
            ].map(({ val, label }) => (
              <div key={label} className="text-center">
                <div
                  className="text-3xl md:text-4xl font-black text-white tabular-nums"
                  style={{ minWidth: "2.5ch", fontVariantNumeric: "tabular-nums" }}
                >
                  {String(val).padStart(2, "0")}
                </div>
                <div className="text-[10px] text-white/30 uppercase tracking-widest mt-1">{label}</div>
              </div>
            ))}
          </div>

          {/* Seat visual */}
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            {Array.from({ length: 15 }).map((_, i) => (
              <div
                key={i}
                className={`w-7 h-7 rounded-md border flex items-center justify-center text-[10px] font-bold transition-all ${
                  i < (15 - seatsLeft)
                    ? "bg-white/5 border-white/10 text-white/20"
                    : "border-pink-500/50 bg-pink-600/20 text-pink-400"
                }`}
              >
                {i < (15 - seatsLeft) ? "✗" : "✓"}
              </div>
            ))}
          </div>
          <p className="text-white/30 text-xs uppercase tracking-widest">
            {seatsLeft} of 15 founding seats remaining
          </p>

          {/* CTA */}
          {isSoldOut ? (
            <div className="bg-white/5 border border-white/10 rounded-2xl px-8 py-6 max-w-sm mx-auto">
              <p className="text-white/60 font-semibold text-lg">Sold Out</p>
              <p className="text-white/30 text-sm mt-1">Follow us for the next drop.</p>
              <a
                href="https://www.instagram.com/allaccesswinnipeg/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-4 text-pink-400 text-sm font-semibold hover:text-pink-300 transition"
              >
                @allaccesswinnipeg →
              </a>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <button
                onClick={handleCheckout}
                disabled={checkoutLoading}
                className="group relative inline-flex items-center gap-3 text-white font-black text-xl px-10 py-5 rounded-2xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: "linear-gradient(135deg, #ff007f 0%, #cc0055 100%)",
                  boxShadow: "0 0 40px rgba(255,0,127,0.35)",
                }}
              >
                {checkoutLoading ? "Redirecting…" : (
                  <>
                    {!user ? "Create Account to Claim" : `Claim Your Seat — ${fmt(price)}`}
                    <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
                  </>
                )}
              </button>
              <p className="text-white/25 text-xs">
                Secure checkout via Stripe · No membership required
              </p>
            </div>
          )}

          {error && (
            <p className="text-red-400 text-sm bg-red-950/40 border border-red-800 rounded-xl px-4 py-3 max-w-sm mx-auto">
              {error}
            </p>
          )}
        </div>
      </section>

      {/* ── WHAT YOU GET ─────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 pb-24 space-y-12">
        <div className="text-center space-y-3">
          <p className="text-pink-400 text-xs font-bold uppercase tracking-widest">What's Included</p>
          <h2 className="text-3xl md:text-4xl font-black text-white">Everything. One flat rate.</h2>
          <p className="text-white/40 text-base max-w-md mx-auto">
            No upsells. No add-ons. One price covers the full experience from pickup to final buzzer.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {[
            {
              icon: "🏀",
              title: "Courtside Seats",
              desc: "Not the nosebleeds. You're watching the Sea Bears from the floor — feet from the action.",
            },
            {
              icon: "🍽️",
              title: "Sit-Down Dinner",
              desc: "Premium pre-game buffet. Show up hungry. Leave full. No extra cost.",
            },
            {
              icon: "🚐",
              title: "Private Group Transport",
              desc: "Door-to-door. No designated driver stress. Everyone arrives and leaves together.",
            },
            {
              icon: "🤝",
              title: "14 Real People",
              desc: "Curated crowd. This isn't a stranger event — it's 15 people who chose to show up.",
            },
            {
              icon: "📸",
              title: "Documented Memory",
              desc: "Content captured on the night. You'll have something to look back on.",
            },
            {
              icon: "🔑",
              title: "Founding Status",
              desc: "You were here first. That matters when this grows into something bigger.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="flex gap-4 bg-white/4 border border-white/8 rounded-2xl p-5 hover:border-pink-500/25 hover:bg-white/6 transition group"
            >
              <span className="text-2xl mt-0.5 shrink-0">{item.icon}</span>
              <div>
                <h3 className="font-bold text-white text-sm mb-1 group-hover:text-pink-300 transition">
                  {item.title}
                </h3>
                <p className="text-white/45 text-sm leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── THE PITCH ────────────────────────────────────────── */}
      <section className="border-t border-white/5 py-24">
        <div className="max-w-2xl mx-auto px-6 text-center space-y-6">
          <p className="text-white/20 text-xs uppercase tracking-widest font-semibold">Why Founding 15</p>
          <h2 className="text-3xl md:text-4xl font-black leading-tight">
            Every city moment starts with <span style={{ color: "#ff007f" }}>15 people</span> who said yes first.
          </h2>
          <p className="text-white/55 text-base leading-relaxed">
            ALL ACCESS Winnipeg is being built in public — starting with one night, 15 seats, and the people willing to bet on something before it's big. This isn't a product launch. It's a founding document written by the people in the room.
          </p>
          <p className="text-white/55 text-base leading-relaxed">
            When this platform has 1,000 members, the Founding 15 will still be a story worth telling.
          </p>
        </div>
      </section>

      {/* ── TRUST SIGNALS ────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 pb-24">
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            {
              label: "Community-First",
              detail: "ALL ACCESS exists to build safer, more connected communities — not just throw parties.",
            },
            {
              label: "Winnipeg-Based",
              detail: "Founded here. Run here. Every dollar stays in the city.",
            },
            {
              label: "Safe Spaces Policy",
              detail: "Every ALL ACCESS event follows a zero-tolerance conduct standard. You're protected.",
            },
          ].map((t) => (
            <div
              key={t.label}
              className="bg-white/4 border border-white/8 rounded-2xl p-5 text-center space-y-2"
            >
              <span className="text-pink-400 text-xs font-bold uppercase tracking-widest">{t.label}</span>
              <p className="text-white/40 text-xs leading-relaxed">{t.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────── */}
      <section className="border-t border-white/5 py-24 px-6">
        <div className="max-w-lg mx-auto text-center space-y-8">
          <div className="space-y-3">
            <div className="text-6xl font-black" style={{ color: "#ff007f" }}>
              {fmt(price)}
            </div>
            <p className="text-white/40 text-sm">One flat rate. Everything included.</p>
          </div>

          <ul className="text-left space-y-2.5 max-w-xs mx-auto">
            {[
              "Courtside seats at Sea Bears",
              "Sit-down dinner",
              "Private group transport",
              "14 curated co-attendees",
              "Founding 15 status",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-sm text-white/60">
                <span className="text-pink-400 shrink-0">✓</span> {item}
              </li>
            ))}
          </ul>

          {isSoldOut ? (
            <div className="space-y-3">
              <p className="text-white/50 font-semibold">All 15 seats have been claimed.</p>
              <a
                href="https://www.instagram.com/allaccesswinnipeg/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-pink-400 font-semibold hover:text-pink-300 transition text-sm"
              >
                Follow for the next drop →
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                onClick={handleCheckout}
                disabled={checkoutLoading}
                className="w-full py-5 rounded-2xl font-black text-xl text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg, #ff007f 0%, #cc0055 100%)",
                  boxShadow: "0 0 50px rgba(255,0,127,0.3)",
                }}
              >
                {checkoutLoading
                  ? "Redirecting…"
                  : !user
                  ? "Create Account to Claim"
                  : `Claim Founding Seat — ${fmt(price)}`}
              </button>

              {!user && (
                <p className="text-white/30 text-xs">
                  Already have an account?{" "}
                  <Link href="/login?redirect=/founding-15" className="text-pink-400 hover:text-pink-300 transition">
                    Sign in
                  </Link>
                </p>
              )}

              {error && (
                <p className="text-red-400 text-sm bg-red-950/40 border border-red-800 rounded-xl px-4 py-3">
                  {error}
                </p>
              )}

              <p className="text-white/20 text-xs leading-relaxed">
                Secure checkout via Stripe · June 30, 2026 · Winnipeg, MB
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── FOOTER LINKS ─────────────────────────────────────── */}
      <section className="border-t border-white/5 py-8 px-6">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-6 text-xs text-white/25">
          <Link href="/" className="hover:text-white/50 transition">ALL ACCESS Winnipeg</Link>
          <Link href="/events" className="hover:text-white/50 transition">All Events</Link>
          <Link href="/about" className="hover:text-white/50 transition">About</Link>
          <a
            href="https://www.instagram.com/allaccesswinnipeg/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-pink-400 transition"
          >
            @allaccesswinnipeg
          </a>
          <Link href="/guidelines" className="hover:text-white/50 transition">Community Guidelines</Link>
        </div>
      </section>

    </main>
  );
}
