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
  address: "625 Portage Ave, Winnipeg, MB R3B 2G4",
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
      <section className="relative w-full overflow-hidden bg-black" style={{ minHeight: "600px" }}>
        {/* Promo video — autoplay muted loop as hero background */}
        <video
          src="/events/dj-lankz-skales-promo.mp4"
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover object-center"
          style={{ filter: "brightness(0.45) saturate(1.1)" }}
        />

        {/* Directional overlays: heavier on left so text always reads clearly */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.70) 50%, rgba(0,0,0,0.15) 100%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.98) 0%, rgba(0,0,0,0.50) 35%, transparent 70%)",
          }}
        />
        {/* Subtle lime tint at bottom edge */}
        <div
          className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none"
          style={{ background: "linear-gradient(to top, rgba(132,204,22,0.06) 0%, transparent 100%)" }}
        />

        {/* Hero content — desktop: side-by-side; mobile: stacked over video */}
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 min-h-[600px] flex items-end lg:items-center gap-8 pb-12 pt-28 lg:pb-16 lg:pt-20">

          {/* Left column: all text */}
          <div className="flex-1 space-y-4 lg:pr-4">
            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              <span className="bg-red-900/90 border border-red-700/50 text-red-300 text-xs font-black px-3 py-1.5 rounded-full uppercase tracking-wider">
                CANCELLED
              </span>
              <span className="bg-black/70 backdrop-blur-sm border border-white/20 text-white/70 text-xs font-bold px-3 py-1.5 rounded-full line-through">
                {EVENT.dateShort}
              </span>
            </div>

            {/* Event name stack — clear 4-level hierarchy */}
            <div className="space-y-1">
              <p className={`${LIME.textDim} text-[11px] sm:text-xs font-black uppercase tracking-[0.22em]`}>
                {EVENT.title}
              </p>
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight leading-none">
                SKALES
              </h1>
              <p className="text-2xl sm:text-3xl lg:text-4xl font-black text-white/90 leading-tight tracking-tight">
                LIVE IN WINNIPEG
              </p>
              <p className="text-white/50 text-xs sm:text-sm font-semibold tracking-[0.18em] uppercase pt-1">
                {EVENT.guest}
              </p>
            </div>

            {/* Quick details row */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-5 pt-1 text-sm text-white/50">
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-white/30 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
                {EVENT.date}
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-white/30 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                Doors {EVENT.doorsOpen}
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-white/30 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
                {EVENT.address}
              </span>
            </div>
          </div>

        </div>
      </section>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-10">

        {/* ── Promo Video — top of page ──────────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className={`h-px flex-1 ${LIME.bar} opacity-20`} />
            <p className={`${LIME.text} text-xs font-bold uppercase tracking-[0.18em]`}>Watch the Promo</p>
            <div className={`h-px flex-1 ${LIME.bar} opacity-20`} />
          </div>
          <div className={`rounded-2xl overflow-hidden border ${LIME.border}`}>
            <video
              src="/events/dj-lankz-skales-promo.mp4"
              autoPlay
              muted
              loop
              playsInline
              controls
              preload="auto"
              poster="/events/skales-hero.jpg"
              className="w-full"
              style={{ maxHeight: "520px", background: "#000" }}
            />
          </div>
        </section>

        {/* ── Event details card ─────────────────────────────────────────── */}
        <div className={`rounded-2xl border ${LIME.border} bg-white/[0.03] p-6 sm:p-8 grid sm:grid-cols-2 gap-5`}>
          {[
            { label: "Date", value: EVENT.date, emoji: "📅" },
            { label: "Doors Open", value: EVENT.doorsOpen, emoji: "🚪" },
            { label: "Address", value: EVENT.address, emoji: "📍" },
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
            {/* Artist photo — press shot */}
            <div className="relative h-64 sm:h-auto overflow-hidden">
              <img
                src="/events/skales-hero.jpg"
                alt="SKALES"
                className="w-full h-full object-cover object-top"
                style={{ filter: "brightness(0.85) saturate(1.1)" }}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/50 hidden sm:block" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent sm:hidden" />
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
        <section className="rounded-2xl border border-white/10 overflow-hidden">
          <div className="grid sm:grid-cols-[280px_1fr]">
            {/* Artist photo */}
            <div className="relative h-64 sm:h-auto overflow-hidden">
              <img
                src="/events/danagog.jpg"
                alt="DANAGOG"
                className="w-full h-full object-cover object-top"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/50 hidden sm:block" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent sm:hidden" />
            </div>

            {/* Artist info */}
            <div className="p-6 sm:p-8 space-y-4 bg-white/[0.02]">
              <div>
                <p className="text-white/25 text-[10px] font-bold uppercase tracking-[0.18em] mb-1">
                  Special Guest
                </p>
                <h2 className="text-3xl font-black text-white tracking-tight">DANAGOG</h2>
                <p className="text-white/40 text-sm mt-1">Afrobeats · Lagos, Nigeria</p>
              </div>
              <p className="text-white/55 text-sm leading-relaxed">
                DANAGOG is one of Afrobeats&rsquo; most electrifying live performers — known for
                infectious energy, crowd-moving anthems, and a stage presence that commands
                every room. Joining SKALES for this historic Winnipeg night, he brings
                another headline-level act to an already loaded lineup.
              </p>
              <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1.5">
                <span className="text-white/40 text-xs font-bold">⭐ Special Guest · Oct 9, 2026</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Performing Live — POPS ─────────────────────────────────────── */}
        <section className="rounded-2xl border border-white/10 overflow-hidden">
          <div className="grid sm:grid-cols-[280px_1fr]">
            {/* Artist photo */}
            <div className="relative h-64 sm:h-auto overflow-hidden">
              <img
                src="/events/pops.jpg"
                alt="POPS"
                className="w-full h-full object-cover object-top"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/50 hidden sm:block" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent sm:hidden" />
            </div>

            {/* Artist info */}
            <div className="p-6 sm:p-8 space-y-4 bg-white/[0.02]">
              <div>
                <p className="text-white/25 text-[10px] font-bold uppercase tracking-[0.18em] mb-1">
                  Performing Live
                </p>
                <h2 className="text-3xl font-black text-white tracking-tight">POPS</h2>
                <p className="text-white/40 text-sm mt-1">Winnipeg, MB</p>
              </div>
              <p className="text-white/55 text-sm leading-relaxed">
                Winnipeg&rsquo;s own POPS hits the stage live — bringing raw energy and hometown
                pride to one of the city&rsquo;s biggest nights. A name the city knows, on a stage
                it won&rsquo;t forget.
              </p>
              <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1.5">
                <span className="text-white/40 text-xs font-bold">🎤 Performing Live · Oct 9, 2026</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Cancellation notice ────────────────────────────────────────── */}
        <div className="rounded-2xl border border-red-800/40 bg-red-950/20 p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3">
            <span className="bg-red-900/60 border border-red-700/50 text-red-300 text-xs font-black px-3 py-1.5 rounded-full uppercase tracking-wider">
              Cancelled
            </span>
          </div>
          <div className="space-y-2">
            <h3 className="text-white font-black text-lg leading-tight">This event has been cancelled.</h3>
            <p className="text-white/50 text-sm leading-relaxed">
              We&apos;re deeply sorry. Some things happened outside of our control and we had no choice but to cancel.
              Full refunds have been issued to all ticket holders — your money is already on its way back to you
              within 5–10 business days, straight to the card you used.
            </p>
          </div>
          <div className="flex items-start gap-3 bg-white/[0.03] border border-white/8 rounded-xl px-4 py-3.5">
            <span className="text-base shrink-0 mt-0.5">💸</span>
            <div>
              <p className="text-white font-bold text-sm">Full refund processed</p>
              <p className="text-white/40 text-xs mt-0.5">No action needed — refunds were issued September 18, 2026. Allow 5–10 business days to appear.</p>
            </div>
          </div>
          <p className="text-white/25 text-xs">
            Questions?{" "}
            <a href="mailto:hello@allaccesswinnipeg.ca" className="text-white/40 hover:text-white/60 transition underline">
              hello@allaccesswinnipeg.ca
            </a>
          </p>
        </div>

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
                <p className="text-white font-bold text-base">625 Portage Ave</p>
                <p className="text-white/45 text-sm">Winnipeg, MB R3B 2G4 · Doors 10 PM</p>
              </div>
            </div>
            <p className="text-white/25 text-xs leading-relaxed pl-9">
              October 9, 2026 · 10 PM – Late
            </p>
          </div>
        </section>

        {/* ── Bottom CTA strip ───────────────────────────────────────────── */}
        <div className={`rounded-2xl border ${LIME.border} ${LIME.glow} p-6 sm:p-8 text-center space-y-3`}>
          <p className={`${LIME.text} text-xs font-bold uppercase tracking-[0.18em]`}>
            October 9, 2026 · 625 Portage Ave · Doors 10 PM
          </p>
          <h3 className="text-2xl font-black text-white">
            SKALES LIVE IN WINNIPEG
          </h3>
          <p className="text-white/40 text-sm">Presented by DJ LANKZ & ALL ACCESS Winnipeg</p>
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            <div className="inline-flex items-center gap-2 bg-red-950/40 border border-red-800/30 rounded-full px-3 py-1.5">
              <span className="text-red-400 text-xs font-bold">Event Cancelled — Full Refunds Issued</span>
            </div>
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
