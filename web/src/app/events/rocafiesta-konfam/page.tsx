"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

const EVENT_ID = "MCzwl8mGF8P1rL5goEab";

type TicketType = "earlybird" | "regular";

const TIERS: Record<
  TicketType,
  {
    name: string;
    price: number;
    desc: string;
    features: string[];
    recommended?: boolean;
  }
> = {
  earlybird: {
    name: "Early Bird",
    price: 15,
    desc: "Limited availability. Lock in the lowest price.",
    features: ["General admission", "Full concert access", "Doors open 5PM", "Early bird pricing"],
    recommended: true,
  },
  regular: {
    name: "General Admission",
    price: 20,
    desc: "General admission — doors open at 5PM.",
    features: ["General admission", "Full concert access", "Doors open 5PM"],
  },
};

function fmt(n: number) {
  return `$${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}`;
}

function Toast({
  type,
  message,
  onClose,
}: {
  type: "success" | "cancel";
  message: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 7000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border text-sm font-medium whitespace-nowrap ${
        type === "success"
          ? "bg-green-950 border-green-700/50 text-green-300"
          : "bg-white/10 border-white/20 text-white/60"
      }`}
    >
      <span>{type === "success" ? "🎉" : "↩️"}</span>
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 opacity-50 hover:opacity-100 transition text-lg leading-none">
        ×
      </button>
    </div>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/8 last:border-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between py-5 text-left gap-4 group"
      >
        <span className="text-white/80 font-semibold text-sm group-hover:text-white transition">{q}</span>
        <span
          className={`text-amber-400 text-xl leading-none shrink-0 transition-transform duration-200 ${
            open ? "rotate-45" : ""
          }`}
        >
          +
        </span>
      </button>
      {open && (
        <p className="text-white/45 text-sm leading-relaxed pb-5 -mt-1">{a}</p>
      )}
    </div>
  );
}

export default function RocafiestaPage() {
  const { user } = useAuth();
  const [selectedTier, setSelectedTier] = useState<TicketType>("earlybird");
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "cancel"; message: string } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Handle ?order=success / ?order=cancel return from Stripe
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const order = params.get("order");
    if (order === "success") {
      setToast({ type: "success", message: "Tickets confirmed! Check your email for details." });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (order === "cancel") {
      setToast({ type: "cancel", message: "Checkout cancelled — your spot is still available." });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const handleCheckout = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/concert-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: EVENT_ID,
          ticketType: selectedTier,
          quantity: qty,
          uid: user?.uid ?? null,
          userEmail: user?.email ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Checkout failed. Please try again.");
      if (data.url) { window.location.href = data.url; return; }
      throw new Error("No redirect URL returned.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setLoading(false);
    }
  }, [selectedTier, qty, user]);

  const tier = TIERS[selectedTier];
  const total = tier.price * qty;

  return (
    <main className="bg-black text-white min-h-screen">
      <style>{`
        @keyframes rf-spotlight-1 {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.25; }
          40% { transform: translate(40px, -30px) scale(1.2); opacity: 0.4; }
          70% { transform: translate(-20px, 15px) scale(0.9); opacity: 0.18; }
        }
        @keyframes rf-spotlight-2 {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.18; }
          35% { transform: translate(-35px, 25px) scale(1.15); opacity: 0.3; }
          70% { transform: translate(20px, -20px) scale(0.85); opacity: 0.12; }
        }
        .rf-spot-1 { animation: rf-spotlight-1 9s ease-in-out infinite; }
        .rf-spot-2 { animation: rf-spotlight-2 13s ease-in-out infinite 3s; }
      `}</style>

      {/* ── HERO ───────────────────────────────────────────────────────── */}
      <section className="relative min-h-[92vh] flex flex-col justify-end overflow-hidden">
        {/* Poster background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-950/40 via-black/60 to-green-950/30 z-0" />
          <img
            src="/events/rocafiesta-poster.jpg"
            alt="ROCAFIESTA poster"
            className="absolute inset-0 w-full h-full object-cover [object-position:center_15%]"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/20 z-[1]" />
        </div>

        {/* Animated spotlights */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-[2]">
          <div className="rf-spot-1 absolute top-1/3 left-1/3 w-[500px] h-[500px] rounded-full bg-amber-400/10 blur-[100px]" />
          <div className="rf-spot-2 absolute bottom-1/3 right-1/3 w-[400px] h-[400px] rounded-full bg-amber-300/8 blur-[80px]" />
        </div>

        {/* Back nav */}
        <div className="absolute top-4 left-4 z-10">
          <Link
            href="/events"
            className="flex items-center gap-2 text-white/40 hover:text-white/80 text-sm transition bg-black/40 backdrop-blur-sm px-3 py-2 rounded-xl border border-white/10"
          >
            ← Events
          </Link>
        </div>

        {/* Hero content */}
        <div className="relative z-[3] px-4 sm:px-6 pb-14 pt-24 max-w-4xl mx-auto w-full space-y-6">
          {/* Badge row */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-amber-500 text-black text-xs font-black px-3 py-1.5 rounded-full tracking-wide">
              FEATURED CONCERT
            </span>
            <span className="bg-black/60 backdrop-blur-sm border border-white/20 text-white/60 text-xs font-bold px-3 py-1.5 rounded-full">
              September 5, 2026
            </span>
            <span className="bg-black/60 backdrop-blur-sm border border-white/20 text-white/60 text-xs font-bold px-3 py-1.5 rounded-full">
              Winnipeg, MB
            </span>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <p className="text-amber-400/80 text-sm font-bold uppercase tracking-[0.2em]">
              A Spiritual Experience with Konfam
            </p>
            <h1 className="text-6xl sm:text-7xl md:text-8xl font-black tracking-tight leading-none">
              ROCA
              <span className="text-amber-400">FIESTA</span>
            </h1>
          </div>

          {/* Details strip */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/50">
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-400/60 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Saturday, September 5, 2026 · 5PM–10PM
            </span>
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-400/60 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Pyramid Cabaret · 176 Fort St, Winnipeg
            </span>
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-400/60 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              Tickets from $15 · 18+
            </span>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <a
              href="#tickets"
              className="bg-amber-500 hover:bg-amber-400 text-black font-black px-8 py-4 rounded-xl text-base transition text-center"
            >
              Get Tickets
            </a>
            <a
              href="#about"
              className="border border-white/20 hover:border-white/40 px-8 py-4 rounded-xl font-semibold text-white/60 hover:text-white transition text-center text-base"
            >
              Learn More ↓
            </a>
          </div>
        </div>
      </section>

      {/* ── PROMO VIDEO ─────────────────────────────────────────────────── */}
      <section className="bg-[#050505] py-12 sm:py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-5">
          <p className="text-center text-white/20 text-xs font-black uppercase tracking-[0.25em]">
            Watch the Promo
          </p>
          <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black aspect-video">
            <video
              ref={videoRef}
              src="/events/rocafiesta-promo.mov"
              autoPlay
              muted
              loop
              playsInline
              controls
              className="w-full h-full object-cover"
            />
          </div>
          {/* Banner */}
          <div className="rounded-2xl overflow-hidden border border-white/10">
            <img src="/events/rocafiesta-banner.png" alt="ROCAFIESTA — A Spiritual Experience with Konfam · Sept 5th" className="w-full" />
          </div>
        </div>
      </section>

      {/* ── ABOUT ───────────────────────────────────────────────────────── */}
      <section id="about" className="bg-black py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-2 gap-10 items-start">
            {/* Left: description */}
            <div className="space-y-6">
              <div>
                <p className="text-amber-400/70 text-xs font-black uppercase tracking-[0.2em] mb-3">About the Event</p>
                <h2 className="text-3xl sm:text-4xl font-black leading-tight">
                  Don&apos;t miss<br />history.
                </h2>
              </div>
              <div className="space-y-4 text-white/55 text-base leading-relaxed">
                <p>
                  ROCAFIESTA is an unforgettable spiritual experience with music, live entertainment &amp; culture.
                </p>
                <p>
                  Join Konfam and his live band as they bring fan favorites like &ldquo;Girl Come,&rdquo; &ldquo;Hiya,&rdquo; and &ldquo;Mona&rdquo; to life, alongside exclusive surprises and special moments.
                </p>
                <p>
                  Featuring a lineup of exceptional talent, surprise guest artists, and immersive live performances, ROCAFIESTA is a celebration of sound, culture, and connection.
                </p>
                <p className="text-white/80 font-semibold">
                  One stage. One band. An experience you&apos;ll never forget.
                </p>
              </div>
            </div>

            {/* Right: event details card */}
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 space-y-5">
              <h3 className="text-white/40 text-xs font-black uppercase tracking-[0.2em]">Event Details</h3>
              {[
                { label: "Date", value: "Saturday, September 5, 2026" },
                { label: "Time", value: "5:00 PM – 10:00 PM" },
                { label: "Venue", value: "Pyramid Cabaret" },
                { label: "Address", value: "176 Fort St, Winnipeg, MB R3C 1C9" },
                { label: "Host", value: "Konfam" },
                { label: "Presented by", value: "ALL ACCESS Winnipeg" },
                { label: "Age", value: "18+ with valid ID" },
                { label: "Tickets", value: "$15 Early Bird · $20 GA" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start justify-between gap-4 border-b border-white/5 pb-4 last:border-0 last:pb-0">
                  <span className="text-white/30 text-sm shrink-0">{label}</span>
                  <span className="text-white/80 text-sm font-semibold text-right">{value}</span>
                </div>
              ))}
              <a
                href="#tickets"
                className="block w-full text-center bg-amber-500 hover:bg-amber-400 text-black font-black py-3.5 rounded-xl transition"
              >
                Secure Your Spot →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── MEET KONFAM ─────────────────────────────────────────────────── */}
      <section className="bg-[#050505] py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            {/* Left: artist photo */}
            <div className="relative rounded-2xl overflow-hidden border border-amber-500/20 h-96 bg-black">
              <img
                src="/events/konfam-railing.jpeg"
                alt="Konfam"
                className="w-full h-full object-cover object-[center_25%]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-4 left-4">
                <span className="bg-amber-500/90 text-black text-xs font-black px-3 py-1.5 rounded-full">
                  Headline Artist
                </span>
              </div>
            </div>

            {/* Right: bio */}
            <div className="space-y-5">
              <div>
                <p className="text-amber-400/70 text-xs font-black uppercase tracking-[0.2em] mb-2">The Artist</p>
                <h2 className="text-4xl font-black text-white">Konfam</h2>
              </div>
              <div className="space-y-4 text-white/55 text-sm leading-relaxed">
                <p>
                  Rooted in Nigerian heritage and emerging from Winnipeg, Konfam is an Afrobeat/Afro-fusion artist, producer &amp; songwriter blending African rhythm with contemporary global sound.
                </p>
                <p>
                  His music pairs smooth melodies with emotional storytelling, exploring themes of love, vulnerability, and personal growth.
                </p>
                <p>
                  As his sound continues to evolve, he represents a new wave of Afro-fusion voices connecting cultures and emotions across borders.
                </p>
                <p className="text-white/75 font-semibold">
                  September 5th, 2026 — Winnipeg&apos;s stage is his.
                </p>
              </div>
            </div>
          </div>

          {/* Artist photo gallery */}
          <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="col-span-2 aspect-video rounded-2xl overflow-hidden">
              <img src="/events/konfam-plane-wing.jpeg" alt="Konfam standing on plane wing" className="w-full h-full object-cover object-[center_40%]" />
            </div>
            <div className="aspect-square rounded-2xl overflow-hidden">
              <img src="/events/konfam-motion-blur.jpeg" alt="Konfam in motion" className="w-full h-full object-cover object-top" />
            </div>
            <div className="aspect-square rounded-2xl overflow-hidden">
              <img src="/events/konfam-urban-visor.jpeg" alt="Konfam downtown Winnipeg" className="w-full h-full object-cover object-[center_30%]" />
            </div>
            <div className="col-span-2 aspect-video rounded-2xl overflow-hidden">
              <img src="/events/konfam-plane-fuselage.jpeg" alt="Konfam against plane fuselage" className="w-full h-full object-cover object-center" />
            </div>
          </div>

          {/* Artist in motion video */}
          <div className="mt-6 rounded-2xl overflow-hidden border border-white/8 bg-black aspect-video">
            <video
              src="/events/konfam-moving.mov"
              autoPlay
              muted
              loop
              playsInline
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* ── WHY ATTEND ──────────────────────────────────────────────────── */}
      <section className="bg-black py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-10">
          <div className="text-center space-y-2">
            <p className="text-amber-400/70 text-xs font-black uppercase tracking-[0.2em]">Why Attend</p>
            <h2 className="text-3xl font-black">6 reasons to attend ROCAFIESTA.</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                emoji: "⚡",
                title: "Feel the Energy",
                desc: "This is a full-on live experience. Expect nonstop vibration from the moment you walk in.",
              },
              {
                emoji: "🎵",
                title: "Soul-Stirring Live Music",
                desc: "Konfam and his incredible live band deliver a powerful, spirit-filled performance that will move your heart and stay with you long after the music ends.",
              },
              {
                emoji: "💃",
                title: "Dance the Night Away",
                desc: "Get lost in the rhythm as our incredible lineup of DJs, electrifying performances, and unforgettable surprise moments keep the energy sky-high from start to finish.",
              },
              {
                emoji: "📸",
                title: "Capture the Moment",
                desc: "From stunning stage production to Instagram-worthy photo spots, you'll leave with content you'll actually want to post.",
              },
              {
                emoji: "🫶",
                title: "Meet Your People",
                desc: "Connect with music lovers, creatives, and good vibes only. Come with friends or make new ones.",
              },
              {
                emoji: "🎤",
                title: "Say \"I Was There\"",
                desc: "Music, culture, and art come together in one incredible night. From the first note to the final encore — don't hear about it later. BE PART OF IT.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="bg-white/[0.03] border border-white/8 rounded-2xl p-5 space-y-3 hover:border-amber-500/20 hover:bg-amber-950/5 transition"
              >
                <span className="text-3xl">{item.emoji}</span>
                <h3 className="font-bold text-white text-sm">{item.title}</h3>
                <p
                  className="text-white/45 text-xs leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: item.desc }}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TICKETS ─────────────────────────────────────────────────────── */}
      <section id="tickets" className="bg-[#050505] py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-10">
          <div className="text-center space-y-2">
            <p className="text-amber-400/70 text-xs font-black uppercase tracking-[0.2em]">Ticket Options</p>
            <h2 className="text-3xl font-black">Choose Your Experience</h2>
            <p className="text-white/35 text-sm">18+ event. Valid ID required at door.</p>
          </div>

          {/* Tier cards */}
          <div className="grid sm:grid-cols-2 gap-4">
            {(["earlybird", "regular"] as TicketType[]).map((id) => {
              const t = TIERS[id];
              const isSelected = selectedTier === id;
              return (
                <button
                  key={id}
                  onClick={() => setSelectedTier(id)}
                  className={`relative text-left rounded-2xl border p-5 space-y-4 transition-all duration-200 ${
                    isSelected
                      ? "border-white/40 bg-white/[0.06]"
                      : "border-white/10 bg-white/[0.02] hover:border-white/25"
                  }`}
                >
                  {/* Recommended badge */}
                  {t.recommended && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-amber-500 text-black text-[10px] font-black px-3 py-1 rounded-full whitespace-nowrap">
                        RECOMMENDED
                      </span>
                    </div>
                  )}

                  {/* Selection indicator */}
                  {isSelected && (
                    <div className="absolute top-4 right-4 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                      <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}

                  <div className="space-y-1 pr-6">
                    <p className="font-black text-lg text-white">{t.name}</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-white">{fmt(t.price)}</span>
                      <span className="text-white/30 text-sm">CAD</span>
                    </div>
                  </div>

                  <p className="text-white/40 text-xs leading-relaxed">{t.desc}</p>

                  <ul className="space-y-1.5">
                    {t.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-xs">
                        <span className="shrink-0 font-bold text-emerald-400">✓</span>
                        <span className="text-white/55">{f}</span>
                      </li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>

          {/* Quantity + checkout */}
          <div className="max-w-lg mx-auto space-y-4">
            {/* Qty selector */}
            <div className="flex items-center justify-between bg-black/60 border border-white/10 rounded-xl px-5 py-4 gap-4">
              <span className="text-white/50 text-sm font-semibold">Quantity</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  disabled={qty <= 1}
                  className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-20 text-white font-bold text-xl flex items-center justify-center transition select-none"
                >
                  −
                </button>
                <span className="w-8 text-center font-black text-xl tabular-nums">{qty}</span>
                <button
                  onClick={() => setQty((q) => Math.min(10, q + 1))}
                  disabled={qty >= 10}
                  className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-20 text-white font-bold text-xl flex items-center justify-center transition select-none"
                >
                  +
                </button>
              </div>
              <div className="text-right">
                <p className="text-white font-black text-xl">{fmt(total)}</p>
                {qty > 1 && (
                  <p className="text-white/30 text-xs">{fmt(tier.price)} × {qty}</p>
                )}
              </div>
            </div>

            {/* Selected tier summary */}
            <div className="flex items-center gap-3 px-4 py-3 bg-amber-950/20 border border-amber-500/20 rounded-xl">
              <span className="text-amber-400 text-lg shrink-0">🎟</span>
              <div className="flex-1 min-w-0">
                <p className="text-white/80 text-sm font-bold">{tier.name}</p>
                <p className="text-white/35 text-xs">ROCAFIESTA · September 5, 2026</p>
              </div>
              <p className="text-amber-400 font-black text-sm shrink-0">{fmt(total)}</p>
            </div>

            {/* CTA */}
            <button
              onClick={handleCheckout}
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-400 active:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-black font-black py-5 rounded-xl text-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-amber-900/30"
            >
              {loading ? (
                <>
                  <span className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Redirecting…
                </>
              ) : (
                <>
                  Get {tier.name} Tickets — {fmt(total)}
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>

            {error && (
              <div className="bg-red-950/40 border border-red-800/50 rounded-lg px-4 py-3 space-y-1.5">
                <p className="text-red-400 text-sm flex items-start gap-2">
                  <span className="shrink-0 mt-0.5">⚠</span>
                  <span>{error}</span>
                </p>
                <button
                  onClick={() => { setError(null); handleCheckout(); }}
                  className="text-red-300 text-xs underline hover:text-red-200 transition pl-5"
                >
                  Try again →
                </button>
              </div>
            )}

            <p className="text-center text-white/20 text-xs flex items-center justify-center gap-1.5">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Secure checkout via Stripe · Refundable up to 72 hrs before the event
            </p>
          </div>
        </div>
      </section>

      {/* ── WHAT'S INCLUDED ─────────────────────────────────────────────── */}
      <section className="bg-black py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="text-center space-y-2">
            <p className="text-amber-400/70 text-xs font-black uppercase tracking-[0.2em]">Included</p>
            <h2 className="text-3xl font-black">What Each Ticket Covers</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px]">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 pr-4 text-white/30 text-xs font-bold uppercase tracking-widest">Feature</th>
                  <th className="text-center py-3 px-3 text-white/60 text-sm font-bold">Early Bird<br /><span className="text-amber-400 font-black">$15</span></th>
                  <th className="text-center py-3 px-3 text-white/60 text-sm font-bold">General Admission<br /><span className="text-amber-400 font-black">$20</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[
                  ["General Admission", true, true],
                  ["Full Concert Access", true, true],
                  ["Doors Open 5PM", true, true],
                  ["Early Bird Pricing", true, false],
                ].map(([feature, earlybird, regular]) => (
                  <tr key={String(feature)}>
                    <td className="py-3.5 pr-4 text-white/55 text-sm">{feature}</td>
                    {[earlybird, regular].map((has, i) => (
                      <td key={i} className="text-center py-3.5 px-3">
                        {has ? (
                          <span className="font-bold text-sm text-emerald-400">✓</span>
                        ) : (
                          <span className="text-white/15 text-sm">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <section className="bg-[#050505] py-16 sm:py-20">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 space-y-6">
          <div className="text-center space-y-2">
            <p className="text-amber-400/70 text-xs font-black uppercase tracking-[0.2em]">FAQ</p>
            <h2 className="text-3xl font-black">Common Questions</h2>
          </div>
          <div className="bg-white/[0.02] border border-white/8 rounded-2xl px-5 sm:px-6">
            <FAQItem
              q="What time is the event?"
              a="ROCAFIESTA runs from 5PM to 10PM on Saturday, September 5, 2026. Doors open at 5PM — don't be late."
            />
            <FAQItem
              q="Are tickets refundable?"
              a="Yes! You can request a refund up to 72 hours before ROCAFIESTA. After that, all ticket sales are final."
            />
            <FAQItem
              q="Where is ROCAFIESTA taking place?"
              a="Winnipeg, Manitoba @ PYRAMID CABARET — 176 Fort St, Winnipeg, MB R3C 1C9."
            />
            <FAQItem
              q="Is ROCAFIESTA an all-ages event?"
              a="No. ROCAFIESTA is strictly an 18+ event. Valid government-issued photo ID is required at entry. No exceptions."
            />
            <FAQItem
              q="Is there a dress code?"
              a="Come red carpet ready — dress to impress and make an entrance. ROCAFIESTA is all about style, confidence, and moments. Bring your best look."
            />
          </div>
        </div>
      </section>

      {/* ── LOCATION ────────────────────────────────────────────────────── */}
      <section className="bg-black py-16 sm:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-6">
          <div className="text-center space-y-1">
            <p className="text-amber-400/70 text-xs font-black uppercase tracking-[0.2em]">Location</p>
            <h3 className="text-2xl font-black">Pyramid Cabaret</h3>
            <p className="text-white/40 text-sm">176 Fort St, Winnipeg, MB R3C 1C9 · Doors 5PM</p>
          </div>
          <div className="rounded-2xl overflow-hidden border border-white/10">
            <img
              src="/events/pyramid-cabaret-sign.jpeg"
              alt="Pyramid Cabaret — Winnipeg"
              className="w-full object-cover"
            />
          </div>
          <div className="flex items-center gap-2 justify-center">
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            <p className="text-amber-400/70 text-xs font-semibold">September 5, 2026 · 5PM–10PM · 18+</p>
          </div>
        </div>
      </section>

      {/* ── FINAL PURCHASE CTA ──────────────────────────────────────────── */}
      <section className="bg-[#050505] py-16 sm:py-20 border-t border-amber-500/10">
        <div className="max-w-lg mx-auto px-4 sm:px-6 space-y-6 text-center">
          <div className="space-y-2">
            <h2 className="text-3xl font-black">Ready to be there?</h2>
            <p className="text-white/40 text-sm">September 5, 2026 · Pyramid Cabaret · 5PM–10PM · 18+</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(["earlybird", "regular"] as TicketType[]).map((id) => {
              const t = TIERS[id];
              return (
                <a
                  key={id}
                  href="#tickets"
                  onClick={(e) => { e.preventDefault(); setSelectedTier(id); document.getElementById("tickets")?.scrollIntoView({ behavior: "smooth" }); }}
                  className="rounded-xl border p-4 space-y-1 transition hover:scale-105 border-white/10 bg-white/[0.03] hover:border-white/25"
                >
                  <p className="font-black text-sm text-white/80">{t.name}</p>
                  <p className="text-white font-black text-xl">{fmt(t.price)}</p>
                </a>
              );
            })}
          </div>
          <a
            href="#tickets"
            className="block w-full bg-amber-500 hover:bg-amber-400 text-black font-black py-5 rounded-xl text-lg transition"
          >
            Get Your Tickets Now →
          </a>
          <p className="text-white/15 text-xs">
            Secure checkout via Stripe · Refundable up to 72 hrs before · 18+ event
          </p>
          <div className="pt-4 border-t border-white/5">
            <p className="text-white/20 text-xs">
              Questions?{" "}
              <a href="mailto:hello@allaccesswinnipeg.ca" className="text-white/35 underline hover:text-white/60 transition">
                hello@allaccesswinnipeg.ca
              </a>
            </p>
          </div>
        </div>
      </section>

      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </main>
  );
}
