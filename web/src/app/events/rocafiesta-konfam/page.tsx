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
    soldOut?: boolean;
  }
> = {
  earlybird: {
    name: "Early Bird",
    price: 15,
    desc: "Limited availability. Lock in the lowest price.",
    features: ["General admission", "Full concert access", "Doors open 5PM", "Early bird pricing"],
    recommended: true,
    soldOut: true,
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
  const [selectedTier, setSelectedTier] = useState<TicketType>("regular");
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [toast, setToast] = useState<{ type: "success" | "cancel"; message: string } | null>(null);
  const [successData, setSuccessData] = useState<{
    email: string | null;
    ticketTierName: string;
    quantity: number;
    totalPrice: number;
    orderId: string;
  } | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const GALLERY = [
    { src: "/events/konfam-railing.jpeg", alt: "Konfam" },
    { src: "/events/konfam-motion-blur.jpeg", alt: "Konfam in motion" },
    { src: "/events/konfam-urban-visor.jpeg", alt: "Konfam downtown Winnipeg" },
    { src: "/events/konfam-plane-fuselage.jpeg", alt: "Konfam against plane fuselage" },
  ];

  const openLightbox = (src: string) => {
    const idx = GALLERY.findIndex((g) => g.src === src);
    setLightboxIndex(idx >= 0 ? idx : 0);
  };
  const closeLightbox = () => setLightboxIndex(null);
  const prevPhoto = () => setLightboxIndex((i) => (i === null ? 0 : (i - 1 + GALLERY.length) % GALLERY.length));
  const nextPhoto = () => setLightboxIndex((i) => (i === null ? 0 : (i + 1) % GALLERY.length));

  // Keyboard navigation
  useEffect(() => {
    if (lightboxIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") prevPhoto();
      if (e.key === "ArrowRight") nextPhoto();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxIndex]);

  // Handle ?order=success / ?order=cancel return from Stripe
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const order = params.get("order");
    const orderId = params.get("orderId");
    const sessionId = params.get("session_id");
    window.history.replaceState({}, "", window.location.pathname);

    if (order === "success" && orderId && sessionId) {
      // Fire confirmation immediately — no waiting for webhook
      fetch("/api/concert-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, sessionId }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.ok) {
            setSuccessData({
              email: data.email,
              ticketTierName: data.ticketTierName,
              quantity: data.quantity,
              totalPrice: data.totalPrice,
              orderId: data.orderId,
            });
          } else {
            setToast({ type: "success", message: "Tickets confirmed! Check your email for details." });
          }
        })
        .catch(() => {
          setToast({ type: "success", message: "Tickets confirmed! Check your email for details." });
        });
    } else if (order === "success") {
      setToast({ type: "success", message: "Tickets confirmed! Check your email for details." });
    } else if (order === "cancel") {
      setToast({ type: "cancel", message: "Checkout cancelled — your spot is still available." });
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
          promoCode: promoCode.trim() || undefined,
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
            src="/events/rocafiesta-banner.png"
            alt="ROCAFIESTA poster"
            className="absolute inset-0 w-full h-full object-cover [object-position:center_30%]"
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
            <button
              onClick={() => openLightbox("/events/konfam-railing.jpeg")}
              className="relative rounded-2xl overflow-hidden border border-amber-500/20 h-96 bg-black group focus:outline-none"
            >
              <img
                src="/events/konfam-railing.jpeg"
                alt="Konfam"
                className="w-full h-full object-cover object-[center_25%] transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
                <svg className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                </svg>
              </div>
              <div className="absolute bottom-4 left-4">
                <span className="bg-amber-500/90 text-black text-xs font-black px-3 py-1.5 rounded-full">
                  Headline Artist
                </span>
              </div>
            </button>

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

              {/* Social links */}
              <div className="space-y-3 pt-1">
                {/* YouTube — primary */}
                <a
                  href="https://www.youtube.com/@konfam"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-red-950/40 hover:bg-red-950/60 border border-red-700/30 hover:border-red-600/50 rounded-xl px-4 py-3.5 transition group"
                >
                  <svg className="w-5 h-5 text-red-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-sm">Watch on YouTube</p>
                    <p className="text-white/35 text-xs">@konfam</p>
                  </div>
                  <svg className="w-4 h-4 text-white/20 group-hover:text-white/50 transition shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>

                {/* Other socials */}
                <div className="flex gap-2">
                  <a
                    href="https://www.instagram.com/konfam/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center gap-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 rounded-xl px-4 py-3 transition group"
                  >
                    <svg className="w-4 h-4 text-pink-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                    <span className="text-white/70 text-xs font-semibold">Instagram</span>
                  </a>
                  <a
                    href="https://www.threads.com/@konfam"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center gap-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 rounded-xl px-4 py-3 transition group"
                  >
                    <svg className="w-4 h-4 text-white/60 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.822-2.047 1.679-1.621 1.594-3.583 1.062-4.799-.303-.7-.953-1.236-1.795-1.585-.2.857-.545 1.806-1.11 2.562-1.002 1.357-2.498 2.072-4.44 2.124-1.552.04-3.012-.404-4.104-1.252-1.27-.978-1.953-2.41-1.914-4.035.038-1.546.73-2.916 1.945-3.861 1.207-.939 2.852-1.423 4.756-1.403 1.39.014 2.677.329 3.837.933.09-.592.134-1.207.134-1.837V8.5c0-2.485-2.019-4.504-4.504-4.504h-.012C8.507 4.01 6.5 6.015 6.5 8.5v.012c0 .552-.448 1-1 1s-1-.448-1-1V8.5C4.5 4.91 7.41 2 11 2h.012c3.59.014 6.488 2.924 6.488 6.512v.488c0 .948-.112 1.877-.329 2.777.733.417 1.352.994 1.806 1.708.845 1.319 1.003 2.922.441 4.333C18.012 19.853 15.706 24 12.193 24h-.007z"/>
                    </svg>
                    <span className="text-white/70 text-xs font-semibold">Threads</span>
                  </a>
                  <a
                    href="https://linktr.ee/rocboy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center gap-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 rounded-xl px-4 py-3 transition group"
                  >
                    <svg className="w-4 h-4 text-green-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M7.953 15.066c-.08.163-.08.324-.08.486.08.517.528.897 1.052.897h5.897c.528 0 .975-.38 1.052-.897.016-.162 0-.323-.08-.486l-3.035-5.632 3.198-5.84c.08-.163.098-.325.08-.487-.077-.517-.525-.897-1.052-.897H9.088c-.527 0-.975.38-1.052.897-.016.162 0 .324.08.487l3.197 5.84zm4.489 3.282l-.44-.813-.438.813c-.08.162-.08.324-.08.486.08.517.528.897 1.052.897h.884c.528 0 .975-.38 1.052-.897.016-.162 0-.324-.08-.486l-.438-.813-.44.813zm5.32-11.53l-2.795 5.15 2.63 4.88c.08.163.098.325.08.487-.077.516-.525.896-1.052.896h-.884c-.365 0-.692-.2-.87-.517l-.44-.813-.438.813c-.178.316-.504.517-.87.517H9.977c-.366 0-.692-.2-.87-.517l-.44-.813-.438.813c-.178.316-.504.517-.87.517h-.884c-.527 0-.975-.38-1.052-.897-.016-.162 0-.323.08-.486l2.63-4.88L5.337 6.82c-.08-.163-.098-.325-.08-.487.077-.517.525-.897 1.052-.897h11.295c.527 0 .975.38 1.052.897.016.162 0 .324-.08.487z"/>
                    </svg>
                    <span className="text-white/70 text-xs font-semibold">Linktree</span>
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Artist photo gallery */}
          <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { src: "/events/konfam-motion-blur.jpeg", alt: "Konfam in motion", cls: "aspect-square", pos: "object-[center_60%]" },
              { src: "/events/konfam-urban-visor.jpeg", alt: "Konfam downtown Winnipeg", cls: "aspect-square", pos: "object-[center_65%]" },
              { src: "/events/konfam-plane-fuselage.jpeg", alt: "Konfam against plane fuselage", cls: "col-span-2", pos: "", contain: true },
            ].map(({ src, alt, cls, pos, contain }) => (
              <button
                key={src}
                onClick={() => openLightbox(src)}
                className={`${cls} rounded-2xl overflow-hidden group relative focus:outline-none bg-black`}
              >
                <img src={src} alt={alt} className={`w-full h-full ${contain ? "object-contain" : `object-cover ${pos} transition-transform duration-300 group-hover:scale-105`}`} />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors duration-300 flex items-center justify-center">
                  <svg className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                  </svg>
                </div>
              </button>
            ))}
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
              const isSoldOut = !!t.soldOut;
              return (
                <button
                  key={id}
                  onClick={() => !isSoldOut && setSelectedTier(id)}
                  disabled={isSoldOut}
                  className={`relative text-left rounded-2xl border p-5 space-y-4 transition-all duration-200 ${
                    isSoldOut
                      ? "border-white/10 bg-white/[0.02] cursor-not-allowed opacity-60"
                      : isSelected
                      ? "border-white/40 bg-white/[0.06]"
                      : "border-white/10 bg-white/[0.02] hover:border-white/25"
                  }`}
                >
                  {/* Sold out overlay */}
                  {isSoldOut && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-2xl z-10 bg-black/40">
                      <span className="bg-red-600 text-white text-xs font-black px-4 py-1.5 rounded-full tracking-widest uppercase">
                        SOLD OUT
                      </span>
                    </div>
                  )}

                  {/* Recommended badge */}
                  {t.recommended && !isSoldOut && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-amber-500 text-black text-[10px] font-black px-3 py-1 rounded-full whitespace-nowrap">
                        RECOMMENDED
                      </span>
                    </div>
                  )}

                  {/* Selection indicator */}
                  {isSelected && !isSoldOut && (
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

            {/* Promo code */}
            <div className="flex gap-2">
              <input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                placeholder="Promo code (optional)"
                className="flex-1 bg-white/5 border border-white/10 focus:border-amber-500/50 focus:outline-none text-white placeholder-white/25 text-sm font-mono px-4 py-3 rounded-xl transition"
              />
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

      {/* ── SUCCESS MODAL ─────────────────────────────────────────────────── */}
      {successData && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0d0d0d] border border-white/10 rounded-3xl max-w-md w-full p-8 text-center space-y-6 shadow-2xl">
            {/* Icon */}
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto text-3xl">
              🎟
            </div>

            {/* Headline */}
            <div className="space-y-1">
              <h2 className="text-2xl font-black text-white">You&apos;re on the list.</h2>
              <p className="text-amber-400 font-bold text-sm">ROCAFIESTA — A Spiritual Experience with Konfam</p>
            </div>

            {/* Details */}
            <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-5 text-left space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-white/40">Ticket</span>
                <span className="text-white font-semibold">{successData.quantity} × {successData.ticketTierName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/40">Date</span>
                <span className="text-white font-semibold">Saturday, September 5, 2026</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/40">Venue</span>
                <span className="text-white font-semibold text-right">Pyramid Cabaret · 176 Fort St</span>
              </div>
              <div className="flex justify-between text-sm border-t border-white/8 pt-3">
                <span className="text-white/40">Total paid</span>
                <span className="text-emerald-400 font-black">${successData.totalPrice.toFixed(2)} CAD</span>
              </div>
            </div>

            {/* Email notice */}
            <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl px-4 py-3">
              <p className="text-amber-300/80 text-sm">
                📧 Confirmation + QR code sent to{" "}
                <span className="font-bold text-amber-300">{successData.email ?? "your email"}</span>
              </p>
            </div>

            {/* Order ID */}
            <p className="text-white/15 text-xs font-mono">{successData.orderId}</p>

            {/* Close */}
            <button
              onClick={() => setSuccessData(null)}
              className="w-full bg-amber-500 hover:bg-amber-400 text-black font-black py-4 rounded-xl text-base transition"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* ── LIGHTBOX ─────────────────────────────────────────────────────── */}
      {lightboxIndex !== null && (() => {
        const photo = GALLERY[lightboxIndex];
        return (
          <div
            className="fixed inset-0 z-50 bg-black/97 flex flex-col items-center justify-center"
            onClick={closeLightbox}
          >
            {/* Top bar */}
            <div
              className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 py-4 z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-white/35 text-xs tracking-widest uppercase font-semibold">
                {lightboxIndex + 1} / {GALLERY.length} — {photo.alt}
              </p>
              <div className="flex items-center gap-3">
                <a
                  href={photo.src}
                  download
                  className="flex items-center gap-2 text-xs font-black text-black bg-amber-500 hover:bg-amber-400 active:bg-amber-600 px-4 py-2 rounded-xl transition"
                  onClick={(e) => e.stopPropagation()}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </a>
                <button
                  onClick={closeLightbox}
                  className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center transition text-xl leading-none"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Full image */}
            <img
              key={photo.src}
              src={photo.src}
              alt={photo.alt}
              className="max-h-[85vh] max-w-[90vw] object-contain select-none"
              onClick={(e) => e.stopPropagation()}
            />

            {/* Prev / Next arrows */}
            <button
              onClick={(e) => { e.stopPropagation(); prevPhoto(); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition text-xl"
            >
              ‹
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); nextPhoto(); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition text-xl"
            >
              ›
            </button>

            {/* Dot indicators */}
            <div className="absolute bottom-6 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              {GALLERY.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setLightboxIndex(i)}
                  className={`w-2 h-2 rounded-full transition-all duration-200 ${i === lightboxIndex ? "bg-amber-400 scale-125" : "bg-white/25 hover:bg-white/50"}`}
                />
              ))}
            </div>
          </div>
        );
      })()}
    </main>
  );
}
