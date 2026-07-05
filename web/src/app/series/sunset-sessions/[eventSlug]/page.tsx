"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import type { SeriesEvent } from "@/types/series";

const SERIES_ID = "sunset-sessions";
const TICKET_TYPES = ["supporter", "community", "public"] as const;
type TicketType = (typeof TICKET_TYPES)[number];

function fmt(n: number) {
  return `$${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// ── Toast ──
function Toast({ type, message, onClose }: { type: "success" | "cancel"; message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 7000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border text-sm font-medium whitespace-nowrap ${
        type === "success"
          ? "bg-[#1a1200] border-[#D4AF37]/40 text-[#D4AF37]"
          : "bg-white/10 border-white/20 text-white/60"
      }`}
    >
      <span>{type === "success" ? "🌅" : "↩️"}</span>
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 opacity-50 hover:opacity-100 transition text-lg leading-none">×</button>
    </div>
  );
}

function ToastWrapper() {
  const searchParams = useSearchParams();
  const [toast, setToast] = useState<{ type: "success" | "cancel"; message: string } | null>(null);
  useEffect(() => {
    const order = searchParams.get("order");
    if (order === "success") setToast({ type: "success", message: "You're in. Check your email for confirmation." });
    else if (order === "cancel") setToast({ type: "cancel", message: "No worries — your spot is still available." });
  }, [searchParams]);
  if (!toast) return null;
  return <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />;
}

// ── FAQ Item ──
function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/8 last:border-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between py-5 text-left gap-4 group"
      >
        <span className="text-white/80 font-semibold text-sm group-hover:text-white transition">{q}</span>
        <span className={`text-[#D4AF37] transition-transform duration-300 text-xl flex-shrink-0 ${open ? "rotate-45" : ""}`}>+</span>
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? "max-h-60 pb-5" : "max-h-0"}`}>
        <p className="text-white/50 text-sm leading-relaxed">{a}</p>
      </div>
    </div>
  );
}

// ── Gallery Placeholder ──
function GalleryPlaceholder({ label, className }: { label: string; className?: string }) {
  return (
    <div
      className={`relative rounded-2xl overflow-hidden bg-white/4 border border-white/6 flex items-center justify-center group hover:border-[#D4AF37]/20 transition ${className ?? ""}`}
    >
      <div className="text-center">
        <div className="text-3xl opacity-20 mb-1">🌅</div>
        <p className="text-white/15 text-[9px] tracking-widest uppercase">{label}</p>
      </div>
    </div>
  );
}

// ── Skeleton ──
function Skeleton() {
  return (
    <div className="min-h-screen bg-black animate-pulse">
      <div className="h-[92vh] bg-white/3" />
      <div className="py-24 px-6 max-w-4xl mx-auto space-y-4">
        <div className="h-4 bg-white/5 rounded w-24" />
        <div className="h-8 bg-white/5 rounded w-64" />
        <div className="h-4 bg-white/5 rounded w-96" />
      </div>
    </div>
  );
}

// ── Main Component ──
export default function SeriesEventPage() {
  const params = useParams<{ eventSlug: string }>();
  const { user, profile, isSupportingMember, isCommunityMember, hasCommunityAccess } = useAuth();

  const [event, setEvent] = useState<SeriesEvent | null>(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [selectedTier, setSelectedTier] = useState<TicketType>("public");
  const [quantity, setQuantity] = useState(1);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const ticketRef = useRef<HTMLDivElement>(null);

  // Fetch event data
  useEffect(() => {
    if (!params?.eventSlug) return;
    setLoadingEvent(true);
    fetch(`/api/series/event?seriesId=${SERIES_ID}&slug=${params.eventSlug}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.json();
      })
      .then((data) => {
        if (data?.event) setEvent(data.event as SeriesEvent);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoadingEvent(false));
  }, [params?.eventSlug]);

  // Auto-select best tier
  useEffect(() => {
    if (!event) return;
    if (isSupportingMember && event.ticketTiers?.supporter) setSelectedTier("supporter");
    else if ((hasCommunityAccess || isCommunityMember) && event.ticketTiers?.community) setSelectedTier("community");
    else setSelectedTier("public");
  }, [event, isSupportingMember, isCommunityMember, hasCommunityAccess]);

  const canSelectTier = useCallback(
    (tier: TicketType) => {
      if (tier === "supporter") return isSupportingMember || profile?.role === "admin";
      if (tier === "community") return hasCommunityAccess || isCommunityMember || profile?.role === "admin";
      return true;
    },
    [isSupportingMember, hasCommunityAccess, isCommunityMember, profile]
  );

  const handleCheckout = async () => {
    if (!event) return;
    setCheckoutError(null);
    setCheckoutLoading(true);
    try {
      const token = user ? await user.getIdToken() : null;
      const res = await fetch("/api/series-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          eventId: event.id,
          ticketType: selectedTier,
          quantity,
          uid: user?.uid,
          userEmail: user?.email,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setCheckoutError(data.error ?? "Something went wrong."); return; }
      window.location.href = data.url;
    } catch {
      setCheckoutError("Network error. Please try again.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (loadingEvent) return <Skeleton />;
  if (notFound || !event) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-center px-6">
        <div>
          <p className="text-[#D4AF37]/50 text-xs tracking-widest uppercase mb-3">Sunset Sessions</p>
          <h1 className="text-3xl font-bold text-white mb-4">Session Not Found</h1>
          <p className="text-white/40 mb-8">This session doesn't exist or hasn't been announced yet.</p>
          <Link href="/series/sunset-sessions" className="text-[#D4AF37] underline underline-offset-4">
            View All Sessions →
          </Link>
        </div>
      </div>
    );
  }

  const activeTierConfig = event.ticketTiers?.[selectedTier];
  const tierPrice = activeTierConfig?.price ?? 0;
  const total = tierPrice * quantity;
  const isCheckoutEnabled = event.checkoutEnabled && event.status === "active";
  const isSoldOut = event.status === "sold_out";

  return (
    <div className="min-h-screen bg-black text-white">

      {/* ── HERO ── */}
      <section className="relative min-h-[92vh] flex flex-col justify-end overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#080500] via-black to-[#0d0700]" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-[#D4AF37]/5 blur-[130px] pointer-events-none" />

        {/* Hero image — cinematic treatment */}
        {event.heroImageUrl ? (
          <div className="absolute inset-0">
            <img
              src={event.heroImageUrl}
              alt={event.subtitle}
              className="w-full h-full object-cover object-center"
              style={{
                filter: "saturate(1.35) brightness(1.08) contrast(1.1) sepia(0.12)",
                opacity: 0.65,
              }}
            />
            {/* Warm amber gradient — bottom for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-transparent" />
            {/* Subtle warm tone overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-amber-950/20 via-transparent to-transparent" />
          </div>
        ) : null}

        {/* Nav */}
        <div className="absolute top-0 left-0 right-0 z-20 px-6 py-5 flex items-center justify-between">
          <Link href="/series/sunset-sessions" className="text-white/35 hover:text-white transition text-sm font-medium">
            ← Sunset Sessions
          </Link>
          <button
            onClick={() => ticketRef.current?.scrollIntoView({ behavior: "smooth" })}
            className="text-xs font-semibold tracking-widest uppercase text-[#D4AF37] border border-[#D4AF37]/30 px-4 py-2 rounded-full hover:bg-[#D4AF37]/10 transition"
          >
            Reserve a Spot
          </button>
        </div>

        {/* Content */}
        <div className="relative z-10 px-6 pb-16 max-w-4xl mx-auto w-full">
          {/* Series badge */}
          <div className="flex flex-wrap gap-2 mb-5">
            <span className="text-xs font-bold tracking-widest uppercase text-[#D4AF37] border border-[#D4AF37]/25 px-3 py-1 rounded-full">
              {event.seriesVolumeLabel}
            </span>
            {[event.ageRestriction, `${event.capacity} Spots`].map((tag) => (
              <span key={tag} className="text-xs text-white/40 border border-white/12 px-3 py-1 rounded-full">
                {tag}
              </span>
            ))}
            {isSoldOut && (
              <span className="text-xs font-bold text-red-400 border border-red-700/40 px-3 py-1 rounded-full">
                Sold Out
              </span>
            )}
          </div>

          <p className="text-[#D4AF37]/50 text-xs font-semibold tracking-[0.25em] uppercase mb-3">
            ALL ACCESS Presents
          </p>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black leading-[1.05] tracking-tight mb-3">
            Sunset Sessions
          </h1>
          <h2 className="text-2xl sm:text-3xl font-light text-[#D4AF37] mb-4">{event.subtitle}</h2>

          {event.tagline && (
            <p className="text-white/45 text-base tracking-widest font-light mb-8">{event.tagline}</p>
          )}

          <div className="flex flex-wrap gap-6 text-sm text-white/45 mb-10">
            <span className="flex items-center gap-2"><span className="text-[#D4AF37]/50">📅</span>{formatDate(event.date)}</span>
            {event.time && <span className="flex items-center gap-2"><span className="text-[#D4AF37]/50">🕔</span>{event.time}</span>}
            <span className="flex items-center gap-2"><span className="text-[#D4AF37]/50">📍</span>{event.location}</span>
            {tierPrice > 0 && (
              <span className="flex items-center gap-2">
                <span className="text-[#D4AF37]/50">🎟</span>
                {isSupportingMember
                  ? `Member Price ${fmt(tierPrice)}`
                  : `From ${fmt(event.generalPrice ?? event.ticketTiers?.public?.price ?? tierPrice)}`}
              </span>
            )}
          </div>

          <button
            onClick={() => ticketRef.current?.scrollIntoView({ behavior: "smooth" })}
            className="inline-flex items-center gap-3 bg-[#D4AF37] text-black font-bold px-8 py-4 rounded-2xl hover:bg-[#c9a430] active:scale-[0.98] transition-all duration-200 text-sm tracking-wide"
          >
            Reserve Your Spot <span className="text-black/60">↓</span>
          </button>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent" />
      </section>

      {/* ── OVERVIEW ── */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-[#D4AF37]/60 text-xs font-semibold tracking-[0.25em] uppercase mb-4">The Experience</p>
          <h2 className="text-2xl sm:text-3xl font-bold leading-tight mb-6 max-w-2xl">
            {event.description ? event.description.split(".")[0] + "." : "An evening above the city you'll remember."}
          </h2>
          {event.description && (
            <p className="text-white/45 text-base leading-relaxed max-w-2xl mb-10">
              {event.description}
            </p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/8 rounded-2xl overflow-hidden">
            {[
              { value: String(event.capacity), label: "Guests" },
              { value: event.time?.split("–")[0]?.trim() ?? "5:30 PM", label: "Doors Open" },
              { value: event.ageRestriction, label: "Age" },
              { value: formatDate(event.date).split(",")[0], label: "Day" },
            ].map((s) => (
              <div key={s.label} className="bg-black/80 py-7 px-5 text-center">
                <div className="text-xl font-black text-[#D4AF37] mb-1">{s.value}</div>
                <div className="text-xs text-white/30 tracking-widest uppercase">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── GALLERY ── */}
      <section className="pb-24 px-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-[#D4AF37]/60 text-xs font-semibold tracking-[0.25em] uppercase mb-3">Gallery</p>
          <h2 className="text-2xl font-bold mb-8">The vibe.</h2>
          {event.galleryImages?.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {event.galleryImages.map((url, i) => (
                <div key={i} className="aspect-[4/5] rounded-2xl overflow-hidden">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          ) : params?.eventSlug === "vol-01" ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="col-span-1 sm:col-span-3 aspect-video rounded-2xl overflow-hidden">
                <img src="/events/paint-sip/venue-hero.png" alt="Rooftop venue at golden hour" className="w-full h-full object-cover object-center" />
              </div>
              <div className="aspect-[4/5] rounded-2xl overflow-hidden">
                <img src="/events/paint-sip/painting-reveal.png" alt="Guests revealing their finished paintings" className="w-full h-full object-cover object-center" />
              </div>
              <div className="aspect-[4/5] rounded-2xl overflow-hidden">
                <img src="/events/paint-sip/painting-session.png" alt="Guests painting at golden hour" className="w-full h-full object-cover object-center" />
              </div>
              <div className="aspect-[4/5] rounded-2xl overflow-hidden">
                <img src="/events/paint-sip/painting-celebration.png" alt="Group celebrating with their paintings" className="w-full h-full object-cover object-[center_35%]" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <GalleryPlaceholder label="Hero Shot" className="aspect-[4/5]" />
              <GalleryPlaceholder label="Venue" className="aspect-[4/5]" />
              <GalleryPlaceholder label="Atmosphere" className="aspect-[4/5] hidden sm:flex" />
              <GalleryPlaceholder label="Golden Hour" className="aspect-video col-span-2" />
              <GalleryPlaceholder label="Community" className="aspect-square hidden sm:flex" />
            </div>
          )}
          <p className="text-white/20 text-xs text-center mt-4">Photos added to your Memories Album after the event.</p>
        </div>
      </section>

      {/* ── WHAT'S INCLUDED ── */}
      {event.whatsIncluded?.length > 0 && (
        <section className="py-24 px-6 bg-white/[0.02] border-y border-white/5">
          <div className="max-w-4xl mx-auto">
            <p className="text-[#D4AF37]/60 text-xs font-semibold tracking-[0.25em] uppercase mb-4">Every Ticket Includes</p>
            <h2 className="text-2xl font-bold mb-10">Everything you need. Nothing you don't.</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-10">
              {event.whatsIncluded.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 bg-white/4 border border-white/8 rounded-xl px-4 py-3.5 hover:border-[#D4AF37]/25 transition group"
                >
                  <span className="text-xl flex-shrink-0">{item.icon}</span>
                  <span className="text-sm text-white/70 group-hover:text-white/90 transition font-medium">{item.label}</span>
                </div>
              ))}
            </div>
            {event.addOns?.length > 0 && (
              <div className="border border-white/8 rounded-2xl p-5">
                <p className="text-[#D4AF37]/60 text-xs font-semibold tracking-widest uppercase mb-3">Optional Add-Ons</p>
                <div className="flex flex-wrap gap-2">
                  {event.addOns.map((a) => (
                    <span key={a} className="text-xs text-white/40 border border-white/10 px-3 py-1.5 rounded-full">{a}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── SCHEDULE ── */}
      {event.schedule?.length > 0 && (
        <section className="py-24 px-6">
          <div className="max-w-4xl mx-auto">
            <p className="text-[#D4AF37]/60 text-xs font-semibold tracking-[0.25em] uppercase mb-4">Schedule</p>
            <h2 className="text-2xl font-bold mb-12">How the evening unfolds.</h2>
            <div className="relative">
              <div className="absolute left-[76px] top-3 bottom-3 w-px bg-white/8 hidden sm:block" />
              <div className="space-y-0">
                {event.schedule.map((item, i) => (
                  <div key={i} className="flex gap-5 sm:gap-8 group">
                    <div className="w-[68px] flex-shrink-0 pt-5">
                      <span className="text-xs font-semibold text-[#D4AF37]/55 whitespace-nowrap">{item.time}</span>
                    </div>
                    <div className="hidden sm:flex flex-col items-center flex-shrink-0 pt-5">
                      <div className="w-2.5 h-2.5 rounded-full border-2 border-[#D4AF37]/35 bg-black group-hover:border-[#D4AF37] group-hover:bg-[#D4AF37]/20 transition-all duration-300 z-10" />
                    </div>
                    <div className={`py-5 flex-1 ${i < event.schedule.length - 1 ? "border-b border-white/5" : ""}`}>
                      <h3 className="text-sm font-bold text-white/90 mb-1">{item.title}</h3>
                      <p className="text-sm text-white/40 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── DRESS CODE ── */}
      {event.dressCode && (
        <section className="py-24 px-6 bg-white/[0.02] border-y border-white/5">
          <div className="max-w-4xl mx-auto grid sm:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-[#D4AF37]/60 text-xs font-semibold tracking-[0.25em] uppercase mb-4">Dress Code</p>
              <h2 className="text-2xl sm:text-3xl font-bold mb-4">{event.dressCode.name}</h2>
              <p className="text-white/45 text-sm leading-relaxed mb-6">{event.dressCode.desc}</p>
              <div className="space-y-2">
                {event.dressCode.details?.map((row) => (
                  <div key={row.label} className="flex gap-4 py-3 border-b border-white/6 last:border-0">
                    <span className="text-xs text-white/25 font-medium w-20 flex-shrink-0 pt-0.5">{row.label}</span>
                    <span className="text-sm text-white/60">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
            {params?.eventSlug === "vol-01" ? (
              <div className="rounded-3xl overflow-hidden border border-white/8">
                <img
                  src="/events/paint-sip/dress-code.png"
                  alt="Paint & Sip Dress Code Style Reference"
                  className="w-full h-full object-cover object-top"
                />
              </div>
            ) : (
              <div className="aspect-square rounded-3xl bg-gradient-to-br from-[#1a1200]/80 to-white/5 border border-white/8 flex items-center justify-center">
                <div className="text-center opacity-30">
                  <div className="text-5xl mb-2">👗</div>
                  <p className="text-white/40 text-xs tracking-widest uppercase">Style Reference</p>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── COMMUNITY ACCESS ── */}
      <section className="py-16 px-6 bg-gradient-to-r from-[#0a0800] to-[#0a0800] border-y border-[#D4AF37]/8">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-[#D4AF37]/60 text-xs font-semibold tracking-[0.25em] uppercase mb-3">Community First</p>
          <h2 className="text-xl sm:text-2xl font-bold mb-3">Your ticket unlocks the community.</h2>
          <p className="text-white/40 text-sm leading-relaxed max-w-lg mx-auto mb-5">
            Every ticket grants you <strong className="text-white/60">Community Access</strong> — Memories Album, Feed, Chat, and priority spots at future Sunset Sessions.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {["📸 Memories", "💬 Feed", "🗣️ Chat", "🎟 Priority Access"].map((f) => (
              <span key={f} className="text-xs text-[#D4AF37]/55 border border-[#D4AF37]/12 px-3 py-1.5 rounded-full">{f}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── TICKET SELECTION ── */}
      <section id="reserve" ref={ticketRef} className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-[#D4AF37]/60 text-xs font-semibold tracking-[0.25em] uppercase mb-4">Reserve Your Spot</p>
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">{event.capacity} spots. One evening.</h2>
          <p className="text-white/35 text-sm mb-10">
            {event.ticketsRemaining > 0
              ? `${event.ticketsRemaining} spot${event.ticketsRemaining === 1 ? "" : "s"} remaining.`
              : "Sold out."}
          </p>

          {/* Tier cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
            {TICKET_TYPES.filter((t) => event.ticketTiers?.[t]).map((t) => {
              const config = event.ticketTiers[t]!;
              const eligible = canSelectTier(t);
              const active = selectedTier === t;
              return (
                <button
                  key={t}
                  onClick={() => eligible && setSelectedTier(t)}
                  disabled={!eligible || !isCheckoutEnabled}
                  className={`relative flex flex-col p-5 rounded-2xl border text-left transition-all duration-200 ${
                    active
                      ? "border-[#D4AF37]/60 bg-[#D4AF37]/8 shadow-[0_0_30px_rgba(212,175,55,0.07)]"
                      : eligible && isCheckoutEnabled
                      ? "border-white/10 bg-white/3 hover:border-white/20 hover:bg-white/5"
                      : "border-white/8 bg-white/2 cursor-not-allowed"
                  }`}
                >
                  {/* Tier badge */}
                  {t === "supporter" && (
                    <span className={`text-[10px] font-bold tracking-widest uppercase border px-2 py-0.5 rounded-full mb-3 self-start ${eligible ? "text-[#D4AF37] border-[#D4AF37]/25" : "text-white/20 border-white/8"}`}>
                      Member Perk
                    </span>
                  )}
                  {t === "community" && (
                    <span className={`text-[10px] font-bold tracking-widest uppercase border px-2 py-0.5 rounded-full mb-3 self-start ${eligible ? "text-white/50 border-white/15" : "text-white/20 border-white/8"}`}>
                      Community
                    </span>
                  )}

                  {/* Price */}
                  <div className={`text-2xl font-black mb-0.5 ${eligible ? "text-white" : "text-white/30"}`}>
                    {fmt(config.price)}
                    <span className="text-sm font-normal text-white/20 ml-1">CAD</span>
                  </div>
                  <div className={`text-sm font-semibold mb-1 ${eligible ? "text-white/75" : "text-white/25"}`}>{config.name}</div>
                  {config.description && (
                    <p className={`text-xs leading-relaxed ${eligible ? "text-white/35" : "text-white/20"}`}>{config.description}</p>
                  )}

                  {/* Lock explanation for ineligible tiers */}
                  {!eligible && (
                    <div className="mt-3 pt-3 border-t border-white/6 flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <svg width="9" height="10" viewBox="0 0 9 10" fill="none" className="flex-shrink-0">
                          <rect x="1" y="4.5" width="7" height="5" rx="1.2" fill="rgba(255,255,255,0.2)"/>
                          <path d="M2.5 4.5V3a2 2 0 0 1 4 0v1.5" stroke="rgba(255,255,255,0.25)" strokeWidth="1.2" strokeLinecap="round"/>
                        </svg>
                        <span className="text-[10px] text-white/40 font-semibold">
                          {t === "supporter" ? "Active Supporters only" : "Past attendees only"}
                        </span>
                      </div>
                      {t === "supporter" && (
                        <span className="text-[10px] text-[#D4AF37]/50 ml-[15px]">
                          Become a Supporter — $25/mo
                        </span>
                      )}
                      {t === "community" && (
                        <span className="text-[10px] text-white/25 ml-[15px]">
                          Attend any ALL ACCESS event to unlock
                        </span>
                      )}
                    </div>
                  )}

                  {/* Selected checkmark */}
                  {active && (
                    <div className="absolute top-3 right-3 w-4 h-4 rounded-full bg-[#D4AF37] flex items-center justify-center">
                      <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                        <path d="M1 3L3 5L7 1" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}

                  {/* Lock icon for ineligible */}
                  {!eligible && (
                    <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-white/6 border border-white/10 flex items-center justify-center">
                      <svg width="8" height="9" viewBox="0 0 8 9" fill="none">
                        <rect x="0.5" y="3.5" width="7" height="5" rx="1" fill="rgba(255,255,255,0.25)"/>
                        <path d="M2 3.5V2.5a2 2 0 0 1 4 0v1" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" strokeLinecap="round"/>
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Checkout panel */}
          <div className="bg-white/3 border border-white/8 rounded-2xl p-6">
            {isCheckoutEnabled && !isSoldOut ? (
              <>
                <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center mb-6">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white/90 mb-0.5">
                      {event.ticketTiers[selectedTier]?.name}
                    </p>
                    <p className="text-xs text-white/35">
                      {fmt(tierPrice)} × {quantity} = <span className="text-white/65 font-bold">{fmt(total)}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="w-9 h-9 rounded-xl border border-white/15 text-white/60 hover:border-white/30 hover:text-white transition flex items-center justify-center text-lg font-light"
                    >−</button>
                    <span className="text-white font-bold w-5 text-center">{quantity}</span>
                    <button
                      onClick={() => setQuantity((q) => Math.min(6, q + 1))}
                      className="w-9 h-9 rounded-xl border border-white/15 text-white/60 hover:border-white/30 hover:text-white transition flex items-center justify-center text-lg font-light"
                    >+</button>
                  </div>
                </div>

                {checkoutError && (
                  <div className="mb-4 px-4 py-3 rounded-xl bg-red-950/50 border border-red-700/40 text-red-300 text-sm">
                    {checkoutError}
                  </div>
                )}

                <button
                  onClick={handleCheckout}
                  disabled={checkoutLoading}
                  className="w-full bg-[#D4AF37] text-black font-bold py-4 rounded-xl hover:bg-[#c9a430] active:scale-[0.99] transition-all duration-200 text-sm tracking-wide disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {checkoutLoading ? (
                    <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>Preparing checkout...</>
                  ) : (
                    `Reserve ${quantity > 1 ? `${quantity} Spots` : "Your Spot"} — ${fmt(total)}`
                  )}
                </button>

                <p className="text-white/20 text-xs text-center mt-3">
                  Secure checkout via Stripe · Non-refundable, fully transferable · {event.ageRestriction}
                </p>
                {!user && (
                  <p className="text-white/25 text-xs text-center mt-2">
                    <Link href="/login" className="text-[#D4AF37]/55 hover:text-[#D4AF37] underline underline-offset-2 transition">Sign in</Link>{" "}
                    to access member pricing and your Memories Album.
                  </p>
                )}
              </>
            ) : isSoldOut ? (
              <div className="text-center py-6">
                <p className="text-white/50 font-semibold mb-2">This session is sold out.</p>
                <p className="text-white/30 text-sm">Follow us on Instagram for announcements about future sessions.</p>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-white/50 font-semibold mb-2">Tickets not yet available.</p>
                <p className="text-white/30 text-sm">Registration opens soon. Check back or follow @allaccess.wpg.</p>
              </div>
            )}
          </div>

          {/* Founding member note */}
          <div className="mt-4 p-4 rounded-xl border border-white/5 bg-white/2">
            <p className="text-xs text-white/25 text-center">
              🌟 <strong className="text-white/35">ALL ACCESS Founding Members</strong> — your exclusive discount is applied via promo code. Check your email or DM us on Instagram.
            </p>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      {event.faqs?.length > 0 && (
        <section className="py-24 px-6 border-t border-white/5">
          <div className="max-w-3xl mx-auto">
            <p className="text-[#D4AF37]/60 text-xs font-semibold tracking-[0.25em] uppercase mb-4">FAQ</p>
            <h2 className="text-2xl font-bold mb-10">Common questions.</h2>
            <div>
              {event.faqs.map((faq, i) => (
                <FAQItem key={i} q={faq.q} a={faq.a} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── MEMORIES ── */}
      <section className="py-24 px-6 bg-white/[0.015] border-t border-white/5">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-[#D4AF37]/60 text-xs font-semibold tracking-[0.25em] uppercase mb-3">Memories</p>
          <h2 className="text-2xl font-bold mb-3">Every photo. One album.</h2>
          <p className="text-white/35 text-sm max-w-md mx-auto mb-8">
            Professional photos from this session will be added to your personal ALL ACCESS Memories Album — exclusive to ticket holders.
          </p>
          <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto mb-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-xl bg-white/4 border border-white/6 flex items-center justify-center">
                <span className="text-xl opacity-15">📸</span>
              </div>
            ))}
          </div>
          <p className="text-white/15 text-xs">Album unlocks after the event · {formatDate(event.date)}</p>
        </div>
      </section>

      {/* ── MORE SESSIONS ── */}
      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <p className="text-[#D4AF37]/60 text-xs font-semibold tracking-[0.25em] uppercase mb-3">The Series</p>
          <h2 className="text-2xl font-bold mb-8">Explore all Sunset Sessions.</h2>
          <Link
            href="/series/sunset-sessions"
            className="group inline-flex items-center gap-4 p-5 rounded-2xl border border-white/8 bg-white/3 hover:border-[#D4AF37]/25 hover:bg-white/5 transition-all duration-200"
          >
            <div className="w-12 h-12 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 flex items-center justify-center text-xl">🌅</div>
            <div>
              <h3 className="text-sm font-semibold text-white/85 group-hover:text-white transition">View All Sunset Sessions</h3>
              <p className="text-xs text-white/35">Vol. 01 — Vol. 08 and beyond →</p>
            </div>
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/5 py-12 px-6">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-white/50 font-bold text-sm">SUNSET SESSIONS <span className="text-[#D4AF37]/60">{event.seriesVolumeLabel}</span></p>
            <p className="text-white/20 text-xs mt-0.5">by ALL ACCESS Winnipeg · Community first. Always.</p>
          </div>
          <div className="flex gap-6 text-xs text-white/20">
            <Link href="/" className="hover:text-white/50 transition">Home</Link>
            <Link href="/series/sunset-sessions" className="hover:text-white/50 transition">All Sessions</Link>
            <Link href="/membership" className="hover:text-white/50 transition">Membership</Link>
          </div>
        </div>
      </footer>

      <Suspense><ToastWrapper /></Suspense>
    </div>
  );
}
