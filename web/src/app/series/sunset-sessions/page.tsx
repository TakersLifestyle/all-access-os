"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { SeriesEvent } from "@/types/series";

const SERIES_ID = "sunset-sessions";

// Roadmap for volumes not yet live in Firestore
const UPCOMING_ROADMAP = [
  { volume: 2, label: "Vol. 02", subtitle: "Wine & Jazz", icon: "🍷" },
  { volume: 3, label: "Vol. 03", subtitle: "Networking Under the Stars", icon: "✨" },
  { volume: 4, label: "Vol. 04", subtitle: "Outdoor Movie Night", icon: "🎬" },
  { volume: 5, label: "Vol. 05", subtitle: "Sunset Yoga", icon: "🧘" },
  { volume: 6, label: "Vol. 06", subtitle: "Brunch Above the City", icon: "☀️" },
  { volume: 7, label: "Vol. 07", subtitle: "Live Music & Cocktails", icon: "🎶" },
  { volume: 8, label: "Vol. 08", subtitle: "Creative Mixer", icon: "🎨" },
];

const WHY_JOIN = [
  {
    icon: "🌇",
    title: "Premium Rooftop Settings",
    desc: "Every Sunset Sessions event takes place at a curated premium venue above the city. The view is part of the experience.",
  },
  {
    icon: "📸",
    title: "Professional Photography",
    desc: "Every event is professionally photographed. Your memories live in your personal ALL ACCESS album — not just your camera roll.",
  },
  {
    icon: "🤝",
    title: "Real Community",
    desc: "Creatives, professionals, entrepreneurs, and great people — all in one room. Sunset Sessions is how you expand your circle in Winnipeg.",
  },
  {
    icon: "🎟",
    title: "Community Access Included",
    desc: "Every ticket unlocks ALL ACCESS Community Access. Memories, Feed, Chat, and priority spots at future sessions — automatically.",
  },
];

function fmt(n: number) {
  return `$${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}`;
}

function getMinPrice(event: SeriesEvent): number {
  if (!event.ticketTiers) return 0;
  const prices = Object.values(event.ticketTiers).map((t) => t.price);
  return prices.length ? Math.min(...prices) : 0;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function EventCard({ event }: { event: SeriesEvent }) {
  const isPast = event.status === "past";
  const isSoldOut = event.status === "sold_out";
  const minPrice = getMinPrice(event);

  return (
    <Link
      href={`/series/${SERIES_ID}/${event.slug}`}
      className="group block bg-white/3 border border-white/8 rounded-3xl overflow-hidden hover:border-[#D4AF37]/30 hover:bg-white/5 transition-all duration-300"
    >
      {/* Image area */}
      <div className="aspect-[4/3] bg-gradient-to-br from-[#1a1000] to-[#0a0800] relative flex items-center justify-center overflow-hidden">
        {event.heroImageUrl ? (
          <img
            src={event.heroImageUrl}
            alt={event.subtitle}
            className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
            style={{ filter: "saturate(1.3) brightness(1.06) contrast(1.08) sepia(0.1)" }}
          />
        ) : (
          <div className="text-center">
            <div className="text-5xl opacity-30 mb-2">🌅</div>
            <p className="text-white/15 text-xs tracking-widest uppercase">{event.seriesVolumeLabel}</p>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

        {/* Status badge */}
        <div className="absolute top-4 left-4">
          {isPast ? (
            <span className="text-[10px] font-bold tracking-widest uppercase bg-white/10 text-white/50 px-3 py-1 rounded-full">
              Past
            </span>
          ) : isSoldOut ? (
            <span className="text-[10px] font-bold tracking-widest uppercase bg-red-900/60 text-red-300 px-3 py-1 rounded-full border border-red-700/40">
              Sold Out
            </span>
          ) : event.status === "active" ? (
            <span className="text-[10px] font-bold tracking-widest uppercase bg-[#D4AF37]/20 text-[#D4AF37] px-3 py-1 rounded-full border border-[#D4AF37]/30">
              Reserve Now
            </span>
          ) : null}
        </div>

        {/* Volume label */}
        <div className="absolute bottom-4 left-4">
          <p className="text-[#D4AF37]/80 text-xs font-bold tracking-widest uppercase">
            {event.seriesVolumeLabel}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <h3 className="text-base font-bold text-white/90 group-hover:text-white transition mb-1">
          {event.subtitle}
        </h3>
        <div className="flex items-center justify-between">
          <p className="text-sm text-white/40">{formatDate(event.date)}</p>
          {!isPast && minPrice > 0 && (
            <p className="text-sm font-semibold text-[#D4AF37]/80">From {fmt(minPrice)}</p>
          )}
        </div>
        {event.location && (
          <p className="text-xs text-white/25 mt-1 truncate">{event.location}</p>
        )}
      </div>
    </Link>
  );
}

function RoadmapCard({ vol }: { vol: (typeof UPCOMING_ROADMAP)[0] }) {
  return (
    <div className="group bg-white/2 border border-white/5 rounded-3xl overflow-hidden">
      <div className="aspect-[4/3] bg-gradient-to-br from-white/3 to-transparent flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-2 opacity-25">{vol.icon}</div>
          <p className="text-white/15 text-[10px] tracking-widest uppercase">{vol.label}</p>
        </div>
      </div>
      <div className="p-5">
        <h3 className="text-sm font-semibold text-white/40 mb-1">{vol.subtitle}</h3>
        <span className="text-[10px] font-bold tracking-widest uppercase text-white/20 border border-white/10 px-2 py-0.5 rounded-full">
          Coming Soon
        </span>
      </div>
    </div>
  );
}

export default function SunsetSessionsPage() {
  const [events, setEvents] = useState<SeriesEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/series/events?seriesId=${SERIES_ID}`)
      .then((r) => r.json())
      .then((data) => {
        setEvents(data.events ?? []);
      })
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  const liveEvents = events.filter((e) => e.status !== "past");
  const pastEvents = events.filter((e) => e.status === "past");

  // Roadmap: volumes not yet in Firestore
  const liveVolumes = new Set(events.map((e) => e.seriesVolume));
  const roadmapItems = UPCOMING_ROADMAP.filter((r) => !liveVolumes.has(r.volume));

  const nextLiveEvent = liveEvents.find((e) => e.status === "active" || e.status === "coming_soon");

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">

      {/* ── HERO ── */}
      <section className="relative min-h-screen flex flex-col justify-center overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#070500] via-black to-[#0d0600]" />

        {/* Ambient orbs */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-[#D4AF37]/5 blur-[150px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full bg-[#D4AF37]/4 blur-[120px] pointer-events-none" />
        <div className="absolute top-0 left-0 w-[300px] h-[300px] rounded-full bg-amber-900/10 blur-[100px] pointer-events-none" />

        {/* Nav */}
        <div className="absolute top-0 left-0 right-0 z-20 px-6 py-5 flex items-center justify-between">
          <Link href="/" className="text-white/30 hover:text-white transition text-sm font-medium tracking-wide">
            ← ALL ACCESS
          </Link>
          {nextLiveEvent && (
            <Link
              href={`/series/${SERIES_ID}/${nextLiveEvent.slug}`}
              className="text-xs font-semibold tracking-widest uppercase text-[#D4AF37] border border-[#D4AF37]/30 px-4 py-2 rounded-full hover:bg-[#D4AF37]/10 transition"
            >
              Reserve Vol. 01
            </Link>
          )}
        </div>

        {/* Hero content */}
        <div className="relative z-10 px-6 max-w-5xl mx-auto w-full text-center">
          {/* Eyebrow */}
          <p className="text-[#D4AF37]/50 text-xs font-semibold tracking-[0.3em] uppercase mb-6">
            ALL ACCESS Winnipeg Presents
          </p>

          {/* Series name — cinematic */}
          <h1 className="text-6xl sm:text-8xl md:text-[9rem] font-black leading-[0.9] tracking-tight mb-6">
            <span className="block text-white">SUNSET</span>
            <span className="block text-[#D4AF37]">SESSIONS</span>
          </h1>

          {/* Tagline */}
          <p className="text-white/40 text-lg sm:text-xl font-light tracking-[0.15em] mb-10 max-w-lg mx-auto">
            Premium Social Experiences Above the City.
          </p>

          {/* CTA row */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            {nextLiveEvent ? (
              <Link
                href={`/series/${SERIES_ID}/${nextLiveEvent.slug}`}
                className="inline-flex items-center gap-3 bg-[#D4AF37] text-black font-bold px-8 py-4 rounded-2xl hover:bg-[#c9a430] active:scale-[0.98] transition-all duration-200 text-sm tracking-wide"
              >
                Reserve Vol. 01 — {nextLiveEvent.subtitle}
                <span>→</span>
              </Link>
            ) : null}
            <button
              onClick={() => document.getElementById("upcoming")?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center gap-2 text-white/40 hover:text-white/70 transition text-sm"
            >
              View All Sessions ↓
            </button>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-5 h-8 rounded-full border border-white/15 flex items-start justify-center pt-1.5">
            <div className="w-1 h-1.5 rounded-full bg-[#D4AF37]/60" />
          </div>
        </div>
      </section>

      {/* ── MISSION ── */}
      <section className="py-32 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid sm:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-[#D4AF37]/60 text-xs font-semibold tracking-[0.25em] uppercase mb-4">The Mission</p>
              <h2 className="text-3xl sm:text-4xl font-black leading-tight mb-6">
                Luxury without<br />feeling exclusive.
              </h2>
              <p className="text-white/50 text-base leading-relaxed mb-4">
                Sunset Sessions brings together young professionals, creatives, entrepreneurs, and great people through unforgettable rooftop experiences above Winnipeg.
              </p>
              <p className="text-white/35 text-base leading-relaxed">
                Every session is a new concept — a new reason to show up, connect, and experience something real. Beautiful venue. Amazing atmosphere. Great music. Meaningful conversations.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { value: "8", label: "Planned Sessions" },
                { value: "25", label: "Guests Per Event" },
                { value: "18+", label: "Age Requirement" },
                { value: "YWG", label: "Above Winnipeg" },
              ].map((s) => (
                <div
                  key={s.label}
                  className="bg-white/3 border border-white/8 rounded-2xl p-5 text-center hover:border-[#D4AF37]/20 transition"
                >
                  <div className="text-2xl font-black text-[#D4AF37] mb-1">{s.value}</div>
                  <div className="text-xs text-white/35 tracking-widest uppercase">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── UPCOMING SESSIONS ── */}
      <section id="upcoming" className="pb-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-[#D4AF37]/60 text-xs font-semibold tracking-[0.25em] uppercase mb-2">The Series</p>
              <h2 className="text-2xl sm:text-3xl font-bold">Upcoming Sessions</h2>
            </div>
          </div>

          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="aspect-[4/3] rounded-3xl bg-white/3 animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {liveEvents.length > 0 && (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-5">
                  {liveEvents.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              )}

              {/* Roadmap teasers */}
              {roadmapItems.length > 0 && (
                <>
                  <p className="text-white/20 text-xs font-semibold tracking-widest uppercase mb-4 mt-8">
                    On the Horizon
                  </p>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {roadmapItems.map((vol) => (
                      <RoadmapCard key={vol.volume} vol={vol} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </section>

      {/* ── WHY JOIN ── */}
      <section className="py-24 px-6 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[#D4AF37]/60 text-xs font-semibold tracking-[0.25em] uppercase mb-3">Why Sunset Sessions</p>
            <h2 className="text-2xl sm:text-3xl font-bold max-w-xl mx-auto">
              Built different. Every single time.
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            {WHY_JOIN.map((item) => (
              <div
                key={item.title}
                className="flex gap-5 p-6 rounded-2xl bg-white/3 border border-white/8 hover:border-[#D4AF37]/20 transition group"
              >
                <div className="text-3xl flex-shrink-0">{item.icon}</div>
                <div>
                  <h3 className="text-sm font-bold text-white/90 group-hover:text-white transition mb-2">{item.title}</h3>
                  <p className="text-sm text-white/45 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── GALLERY ── */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-[#D4AF37]/60 text-xs font-semibold tracking-[0.25em] uppercase mb-3">Gallery</p>
          <h2 className="text-2xl font-bold mb-8">The experience in photos.</h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Rooftop Views", aspect: "aspect-square" },
              { label: "Golden Hour", aspect: "aspect-square" },
              { label: "Community", aspect: "aspect-square row-span-2 sm:aspect-auto" },
              { label: "Atmosphere", aspect: "aspect-square" },
              { label: "Moments", aspect: "aspect-[2/1] col-span-2" },
              { label: "Connection", aspect: "aspect-square" },
            ].map((item, i) => (
              <div
                key={i}
                className={`relative rounded-2xl bg-white/4 border border-white/6 flex items-center justify-center overflow-hidden ${item.aspect}`}
              >
                <div className="text-center">
                  <div className="text-2xl opacity-20 mb-1">📸</div>
                  <p className="text-white/15 text-[9px] tracking-widest uppercase">{item.label}</p>
                </div>
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/10" />
              </div>
            ))}
          </div>

          <p className="text-white/15 text-xs text-center mt-4">
            Professional photos from each session added after the event.
          </p>
        </div>
      </section>

      {/* ── COMMUNITY ── */}
      <section className="py-24 px-6 bg-gradient-to-b from-[#0a0700] to-black border-t border-[#D4AF37]/8">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-[#D4AF37]/60 text-xs font-semibold tracking-[0.25em] uppercase mb-4">Community First</p>
          <h2 className="text-2xl sm:text-3xl font-bold mb-4 max-w-2xl mx-auto">
            Every ticket is a community membership.
          </h2>
          <p className="text-white/40 text-base leading-relaxed max-w-xl mx-auto mb-8">
            Purchasing any Sunset Sessions ticket grants you <strong className="text-white/60">Community Access</strong> — your personal Memories Album, the ALL ACCESS Community Feed, and priority spots at future sessions.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mb-10">
            {["📸 Memories Album", "💬 Community Feed", "🗣️ Chat", "🎟 Priority Access"].map((f) => (
              <span key={f} className="text-xs text-[#D4AF37]/60 border border-[#D4AF37]/15 px-4 py-2 rounded-full">
                {f}
              </span>
            ))}
          </div>

          <p className="text-white/25 text-sm mb-6">
            Want deeper access? The optional <strong className="text-white/40">$25/mo Supporting Membership</strong> unlocks member pricing on all sessions + full perks.
          </p>
          <Link
            href="/membership"
            className="text-[#D4AF37]/50 hover:text-[#D4AF37] text-sm underline underline-offset-4 transition"
          >
            Learn about Supporting Membership →
          </Link>
        </div>
      </section>

      {/* ── PAST SESSIONS ── */}
      {pastEvents.length > 0 && (
        <section className="py-24 px-6 border-t border-white/5">
          <div className="max-w-5xl mx-auto">
            <p className="text-[#D4AF37]/60 text-xs font-semibold tracking-[0.25em] uppercase mb-3">Past Sessions</p>
            <h2 className="text-2xl font-bold mb-8">Where we've been.</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {pastEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── FINAL CTA ── */}
      <section className="py-32 px-6 border-t border-white/5">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-[#D4AF37]/50 text-xs font-semibold tracking-[0.3em] uppercase mb-4">Vol. 01 — Now Available</p>
          <h2 className="text-3xl sm:text-4xl font-black mb-4">
            Rooftop Sunset<br />
            <span className="text-[#D4AF37]">Paint & Sip</span>
          </h2>
          <p className="text-white/40 text-base mb-2">Friday, July 31, 2026 · 5:30 PM</p>
          <p className="text-white/25 text-sm mb-10">25 spots. Winnipeg's best rooftop. From $60.</p>
          {nextLiveEvent ? (
            <Link
              href={`/series/${SERIES_ID}/${nextLiveEvent.slug}`}
              className="inline-flex items-center gap-3 bg-[#D4AF37] text-black font-bold px-10 py-4 rounded-2xl hover:bg-[#c9a430] active:scale-[0.98] transition-all duration-200 text-sm tracking-wide"
            >
              Reserve Your Spot
              <span>→</span>
            </Link>
          ) : (
            <Link
              href="/events"
              className="inline-flex items-center gap-3 bg-[#D4AF37] text-black font-bold px-10 py-4 rounded-2xl hover:bg-[#c9a430] transition text-sm tracking-wide"
            >
              View All Events →
            </Link>
          )}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/5 py-12 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-white/60 font-bold text-sm tracking-wide">SUNSET SESSIONS</p>
            <p className="text-white/25 text-xs mt-0.5">by ALL ACCESS Winnipeg · Community first. Always.</p>
          </div>
          <div className="flex gap-6 text-xs text-white/25">
            <Link href="/" className="hover:text-white/60 transition">Home</Link>
            <Link href="/events" className="hover:text-white/60 transition">Events</Link>
            <Link href="/membership" className="hover:text-white/60 transition">Membership</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
