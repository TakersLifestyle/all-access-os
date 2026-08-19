"use client";

import Link from "next/link";

// ── Accent palette — lime-green from Skales' signature look ──────────────────
// Only applies to this page. No other ALL ACCESS page is affected.
const LIME = {
  badge: "bg-[#84cc16]",
  badgeDim: "bg-[#84cc16]/20 border border-[#84cc16]/30",
  text: "text-[#84cc16]",
  textDim: "text-[#84cc16]/70",
  border: "border-[#84cc16]/30",
  borderHover: "hover:border-[#84cc16]/60",
  glow: "shadow-[0_0_50px_rgba(132,204,22,0.10)]",
  bar: "bg-[#84cc16]",
};

const EVENT = {
  title: "DJ LANKZ & FRIENDS",
  headline: "SKALES LIVE IN WINNIPEG",
  guest: "WITH SPECIAL GUEST DANAGOG",
  date: "Friday, October 9, 2026",
  dateShort: "Oct 9, 2026",
  doorsOpen: "10:00 PM",
  address: "265 Portage Ave, Winnipeg, MB",
  age: "18+",
  presenter: "DJ LANKZ & ALL ACCESS Winnipeg",
};

export default function DJLankzSkalesPage() {
  return (
    <main className="min-h-screen bg-black text-white">

      {/* ── Back nav ───────────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6">
        <Link
          href="/events"
          className="inline-flex items-center gap-2 text-white/40 hover:text-white/70 text-sm font-medium transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Events
        </Link>
      </div>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative w-full overflow-hidden" style={{ minHeight: "580px" }}>
        {/* Skales live performance — full bleed hero */}
        <img
          src="/events/skales-live-1.jpg"
          alt="SKALES — DJ LANKZ & FRIENDS, October 9, 2026"
          className="absolute inset-0 w-full h-full object-cover object-center"
          style={{ filter: "brightness(0.6) saturate(1.15) contrast(1.05)" }}
        />

        {/* Lime-green gradient overlay from bottom */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.97) 0%, rgba(0,0,0,0.65) 45%, rgba(0,0,0,0.25) 75%, transparent 100%)",
          }}
        />

        {/* Subtle lime tint at bottom edge */}
        <div
          className="absolute bottom-0 left-0 right-0 h-48 pointer-events-none"
          style={{
            background:
              "linear-gradient(to top, rgba(132,204,22,0.07) 0%, transparent 100%)",
          }}
        />

        {/* Hero content */}
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pb-14 pt-28 sm:pt-36 flex flex-col justify-end min-h-[580px]">
          {/* Badges */}
          <div className="flex flex-wrap gap-2 mb-5">
            <span className={`${LIME.badge} text-black text-xs font-black px-3 py-1.5 rounded-full`}>
              LIVE CONCERT
            </span>
            <span className="bg-black/70 backdrop-blur-sm border border-white/20 text-white/70 text-xs font-bold px-3 py-1.5 rounded-full">
              {EVENT.dateShort}
            </span>
            <span className="bg-black/70 backdrop-blur-sm border border-white/20 text-white/70 text-xs font-bold px-3 py-1.5 rounded-full">
              {EVENT.age}
            </span>
          </div>

          {/* Event name stack */}
          <p className={`${LIME.textDim} text-xs font-bold uppercase tracking-[0.18em] mb-2`}>
            {EVENT.title}
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white tracking-tight leading-none mb-3">
            SKALES<br />
            <span className="text-3xl sm:text-4xl md:text-5xl font-black">LIVE IN WINNIPEG</span>
          </h1>
          <p className="text-white/55 text-sm sm:text-base font-semibold tracking-widest uppercase">
            {EVENT.guest}
          </p>

          {/* Quick details row */}
          <div className="flex flex-wrap gap-4 mt-6 text-sm text-white/50">
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
              {EVENT.date}
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              Doors {EVENT.doorsOpen}
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              {EVENT.address}
            </span>
          </div>
        </div>
      </section>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-10">

        {/* ── Event details card ─────────────────────────────────────────── */}
        <div className={`rounded-2xl border ${LIME.border} bg-white/[0.03] p-6 sm:p-8 grid sm:grid-cols-2 gap-5`}>
          {[
            { label: "Date", value: EVENT.date, emoji: "📅" },
            { label: "Doors Open", value: EVENT.doorsOpen, emoji: "🚪" },
            { label: "Address", value: EVENT.address, emoji: "📍" },
            { label: "Age Restriction", value: EVENT.age + " · Valid ID required at door", emoji: "🪪" },
            { label: "Headline Artist", value: "SKALES", emoji: "🎤" },
            { label: "Special Guest", value: "DANAGOG", emoji: "⭐" },
            { label: "Host / DJ", value: "DJ LANKZ", emoji: "🎧" },
            { label: "Presented by", value: "ALL ACCESS Winnipeg", emoji: "🏴" },
          ].map((item) => (
            <div key={item.label} className="flex items-start gap-3">
              <span className="text-lg shrink-0 mt-0.5">{item.emoji}</span>
              <div>
                <p className="text-white/25 text-[10px] font-bold uppercase tracking-widest">{item.label}</p>
                <p className="text-white font-semibold text-sm mt-0.5">{item.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Promo Video ────────────────────────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className={`h-px flex-1 ${LIME.bar} opacity-20`} />
            <p className={`${LIME.text} text-xs font-bold uppercase tracking-[0.18em]`}>Watch the Promo</p>
            <div className={`h-px flex-1 ${LIME.bar} opacity-20`} />
          </div>
          <div className={`rounded-2xl overflow-hidden border ${LIME.border}`}>
            <video
              src="/events/dj-lankz-skales-promo.mp4"
              controls
              playsInline
              preload="metadata"
              poster="/events/skales-hero.jpg"
              className="w-full"
              style={{ maxHeight: "480px", background: "#000" }}
            />
          </div>
        </section>

        {/* ── About ──────────────────────────────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className={`h-px flex-1 ${LIME.bar} opacity-20`} />
            <p className={`${LIME.text} text-xs font-bold uppercase tracking-[0.18em]`}>About The Event</p>
            <div className={`h-px flex-1 ${LIME.bar} opacity-20`} />
          </div>

          <div className="space-y-4 text-white/55 leading-relaxed text-sm sm:text-base">
            <p>
              DJ LANKZ brings the biggest Afrobeats night Winnipeg has ever seen.
              One stage. One headliner. One city. <strong className="text-white/80">SKALES LIVE IN WINNIPEG</strong> is
              an immersive evening of Afrobeats, culture, live energy, and community —
              curated by DJ LANKZ and presented by ALL ACCESS Winnipeg.
            </p>
            <p>
              With global hit-maker <strong className="text-white/80">SKALES</strong> headlining and
              special guest <strong className="text-white/80">DANAGOG</strong> on stage,
              this is a night Winnipeg will be talking about long after the last song drops.
            </p>
            <p>
              Expect nonstop live performance, premium production, and real crowd energy.
              Friday, October 9, 2026 · Doors 10 PM.
            </p>
          </div>
        </section>

        {/* ── Headline Artist — SKALES ───────────────────────────────────── */}
        <section className={`rounded-2xl border ${LIME.border} overflow-hidden`}>
          <div className="grid sm:grid-cols-[280px_1fr]">
            {/* Artist photos — press shot + live */}
            <div className="relative h-64 sm:h-auto overflow-hidden grid grid-cols-2 sm:grid-cols-1 sm:grid-rows-2">
              <div className="relative overflow-hidden">
                <img
                  src="/events/skales-hero.jpg"
                  alt="SKALES"
                  className="w-full h-full object-cover object-top"
                  style={{ filter: "brightness(0.85) saturate(1.1)" }}
                />
              </div>
              <div className="relative overflow-hidden">
                <img
                  src="/events/skales-live-2.jpg"
                  alt="SKALES performing live"
                  className="w-full h-full object-cover object-center"
                  style={{ filter: "brightness(0.85) saturate(1.1)" }}
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/50 hidden sm:block" />
            </div>

            {/* Artist info */}
            <div className="p-6 sm:p-8 space-y-4 bg-white/[0.02]">
              <div>
                <p className={`${LIME.text} text-[10px] font-bold uppercase tracking-[0.18em] mb-1`}>
                  Headline Artist
                </p>
                <h2 className="text-3xl font-black text-white tracking-tight">SKALES</h2>
                <p className="text-white/40 text-sm mt-1">Afrobeats / Afropop · Lagos, Nigeria</p>
              </div>

              <p className="text-white/50 text-sm leading-relaxed">
                One of Afrobeats' most celebrated voices, SKALES has delivered global hits across
                more than a decade — blending infectious rhythm, raw storytelling, and undeniable stage presence.
                His discography has garnered hundreds of millions of streams worldwide, making him
                one of the genre's most recognized names internationally.
              </p>
              <p className="text-white/50 text-sm leading-relaxed">
                October 9th — Winnipeg gets its moment.
              </p>

              <div className={`inline-flex items-center gap-2 ${LIME.badgeDim} rounded-full px-3 py-1.5`}>
                <span className={`w-1.5 h-1.5 rounded-full ${LIME.badge} animate-pulse`} />
                <span className={`${LIME.text} text-xs font-bold`}>Headlining October 9, 2026</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Special Guest — DANAGOG ────────────────────────────────────── */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:p-8 space-y-4">
          <div>
            <p className="text-white/25 text-[10px] font-bold uppercase tracking-[0.18em] mb-1">Special Guest</p>
            <h2 className="text-2xl font-black text-white tracking-tight">DANAGOG</h2>
            <p className="text-white/40 text-sm mt-1">Afrobeats · Lagos, Nigeria</p>
          </div>
          <p className="text-white/50 text-sm leading-relaxed">
            DANAGOG brings raw Afrobeats energy to the stage as special guest for this night.
            Known for his infectious sound and crowd-moving performances, he adds another dimension
            to an already loaded lineup.
          </p>
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1.5">
            <span className="text-white/40 text-xs font-bold">⭐ Special Guest · Oct 9, 2026</span>
          </div>
        </section>

        {/* ── Ticket CTA ─────────────────────────────────────────────────── */}
        <section id="tickets" className="space-y-4">
          <div className="flex items-center gap-3">
            <div className={`h-px flex-1 ${LIME.bar} opacity-20`} />
            <p className={`${LIME.text} text-xs font-bold uppercase tracking-[0.18em]`}>Tickets</p>
            <div className={`h-px flex-1 ${LIME.bar} opacity-20`} />
          </div>

          <div className={`rounded-2xl border ${LIME.border} bg-white/[0.02] p-6 sm:p-8 space-y-5 text-center`}>
            <div className={`inline-flex items-center gap-2 ${LIME.badgeDim} rounded-full px-4 py-2`}>
              <span className={`w-2 h-2 rounded-full ${LIME.badge} animate-pulse`} />
              <span className={`${LIME.text} text-xs font-bold uppercase tracking-widest`}>Tickets Dropping Soon</span>
            </div>

            <div>
              <h3 className="text-2xl font-black text-white">
                DJ LANKZ & FRIENDS<br />
                <span className="text-white/60 font-bold text-xl">October 9, 2026</span>
              </h3>
              <p className="text-white/35 text-sm mt-2 leading-relaxed">
                Ticket prices and on-sale date will be announced soon.<br />
                Follow ALL ACCESS Winnipeg to be first to know.
              </p>
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
              {[
                { label: "Date", val: "Oct 9, 2026" },
                { label: "Doors", val: "10:00 PM" },
                { label: "Age", val: "18+ with ID" },
                { label: "Venue", val: "265 Portage Ave" },
              ].map((item) => (
                <div key={item.label} className="bg-black/40 border border-white/8 rounded-xl px-3 py-3">
                  <p className="text-white/25 text-[10px] font-bold uppercase tracking-widest">{item.label}</p>
                  <p className="text-white font-semibold text-sm mt-0.5">{item.val}</p>
                </div>
              ))}
            </div>

            {/* Coming soon button */}
            <div className={`w-full py-4 rounded-xl border ${LIME.border} ${LIME.badgeDim} ${LIME.text} font-bold text-base cursor-default select-none`}>
              🎟 Tickets Coming Soon
            </div>

            <p className="text-white/20 text-xs">
              Questions?{" "}
              <a href="mailto:hello@allaccesswinnipeg.ca" className="text-white/35 hover:text-white/60 transition underline">
                hello@allaccesswinnipeg.ca
              </a>
            </p>
          </div>
        </section>

        {/* ── 6 Reasons ──────────────────────────────────────────────────── */}
        <section className="space-y-4">
          <p className={`${LIME.text} text-xs font-bold uppercase tracking-[0.18em] text-center`}>Why Attend</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { emoji: "🎵", title: "SKALES Live", sub: "One of Afrobeats' biggest acts — performing live in Winnipeg for the first time." },
              { emoji: "⭐", title: "Special Guest DANAGOG", sub: "Two headline-level acts on one stage for one night only." },
              { emoji: "🎧", title: "DJ LANKZ", sub: "The host and curator — expect a curated Afrobeats set experience from start to finish." },
              { emoji: "🕙", title: "Doors 10 PM", sub: "Late-night energy. Premium atmosphere. This is the Winnipeg nightlife moment." },
              { emoji: "🫶", title: "Community First", sub: "Presented by ALL ACCESS Winnipeg — a night that belongs to the culture and the people." },
              { emoji: "🎤", title: "Say I Was There", sub: "Historic night for Winnipeg's Afrobeats scene. Don't hear about it later." },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-4 bg-white/[0.03] border border-white/8 rounded-2xl p-5">
                <span className="text-2xl shrink-0">{item.emoji}</span>
                <div>
                  <p className="text-white font-bold text-sm">{item.title}</p>
                  <p className="text-white/40 text-xs leading-relaxed mt-1">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Location ───────────────────────────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className={`h-px flex-1 ${LIME.bar} opacity-20`} />
            <p className={`${LIME.text} text-xs font-bold uppercase tracking-[0.18em]`}>Location</p>
            <div className={`h-px flex-1 ${LIME.bar} opacity-20`} />
          </div>

          <div className={`rounded-2xl border ${LIME.border} bg-white/[0.02] p-6 space-y-3`}>
            <div className="flex items-start gap-3">
              <span className="text-xl shrink-0">📍</span>
              <div>
                <p className="text-white font-bold text-base">265 Portage Ave</p>
                <p className="text-white/45 text-sm">Winnipeg, MB · Doors 10 PM</p>
              </div>
            </div>
            <p className="text-white/25 text-xs leading-relaxed pl-9">
              October 9, 2026 · 10 PM – Late · 18+ with valid ID
            </p>
          </div>
        </section>

        {/* ── Bottom CTA strip ───────────────────────────────────────────── */}
        <div className={`rounded-2xl border ${LIME.border} ${LIME.glow} p-6 sm:p-8 text-center space-y-3`}>
          <p className={`${LIME.text} text-xs font-bold uppercase tracking-[0.18em]`}>
            October 9, 2026 · 265 Portage Ave · Doors 10 PM · 18+
          </p>
          <h3 className="text-2xl font-black text-white">
            SKALES LIVE IN WINNIPEG
          </h3>
          <p className="text-white/40 text-sm">Presented by DJ LANKZ & ALL ACCESS Winnipeg</p>
          <div className={`inline-flex items-center gap-2 ${LIME.badgeDim} rounded-full px-4 py-2 mt-2`}>
            <span className={`w-1.5 h-1.5 rounded-full ${LIME.badge} animate-pulse`} />
            <span className={`${LIME.text} text-xs font-bold`}>Tickets Dropping Soon — Stay Tuned</span>
          </div>
          <p className="text-white/20 text-xs pt-1">
            Questions?{" "}
            <a href="mailto:hello@allaccesswinnipeg.ca" className="text-white/35 hover:text-white/60 transition underline">
              hello@allaccesswinnipeg.ca
            </a>
          </p>
        </div>

      </div>
    </main>
  );
}
