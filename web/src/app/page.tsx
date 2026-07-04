"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import SocialFeedSection from "@/components/SocialFeedSection";

interface EventTeaser {
  id: string;
  title: string;
  date: string;
  location: string;
  imageUrl?: string;
  heroImageUrl?: string;
  ticketsRemaining: number;
  capacity: number;
  memberPrice?: number;
  generalPrice?: number;
  ticketTiers?: Record<string, { name: string; price: number }>;
  isLaunchEvent?: boolean;
  status: string;
  type?: string;
  featured?: boolean;
  slug?: string;
  seriesId?: string;
  seriesVolumeLabel?: string;
  checkoutEnabled?: boolean;
}

function useEventTeasers() {
  const [events, setEvents] = useState<EventTeaser[]>([]);
  useEffect(() => {
    getDocs(query(collection(db, "events"), orderBy("date", "asc")))
      .then((snap) => {
        const all = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as EventTeaser))
          .filter((e) => e.status !== "draft");
        all.sort((a, b) => {
          if (a.isLaunchEvent && !b.isLaunchEvent) return -1;
          if (!a.isLaunchEvent && b.isLaunchEvent) return 1;
          if (a.status === "coming_soon" && b.status !== "coming_soon") return 1;
          if (a.status !== "coming_soon" && b.status === "coming_soon") return -1;
          return (a.date ?? "").localeCompare(b.date ?? "");
        });
        setEvents(all);
      })
      .catch(() => {});
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

function getEventImage(ev: EventTeaser): string | undefined {
  return ev.heroImageUrl || ev.imageUrl || undefined;
}

function getEventHref(ev: EventTeaser): string {
  if (ev.seriesId && ev.slug) return `/series/${ev.seriesId}/${ev.slug}`;
  if (ev.type === "concert" && ev.slug) return `/events/${ev.slug}`;
  if (ev.status === "completed") return "/memories";
  return "/events";
}

function getMinPrice(ev: EventTeaser): number {
  if (ev.generalPrice && ev.generalPrice > 0) return ev.generalPrice;
  if (ev.ticketTiers) {
    const prices = Object.values(ev.ticketTiers).map((t) => t.price).filter(p => p > 0);
    return prices.length ? Math.min(...prices) : 0;
  }
  return ev.generalPrice ?? 0;
}

export default function Home() {
  const { user, isActive, loading } = useAuth();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const events = useEventTeasers();

  const featuredSeries = events.find(
    (e) => e.type === "series_event" && e.status === "active" && e.checkoutEnabled
  );
  const featuredConcert = events.find(
    (e) => e.type === "concert" && e.featured && e.status === "active"
  );
  const launchEvent = events.find((e) => e.isLaunchEvent);
  const heroEvent = featuredSeries ?? featuredConcert ?? launchEvent ?? null;

  const urgencyEvent = events
    .filter(
      (e) =>
        e.status === "active" &&
        e.capacity > 0 &&
        e.ticketsRemaining > 0 &&
        e.ticketsRemaining <= Math.ceil(e.capacity * 0.35)
    )
    .sort((a, b) => a.ticketsRemaining / a.capacity - b.ticketsRemaining / b.capacity)[0];

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

  const isSeries = heroEvent?.type === "series_event";
  const isConcert = heroEvent?.type === "concert";
  const heroMinPrice = heroEvent ? getMinPrice(heroEvent) : 0;

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 space-y-10 sm:space-y-14 pb-32">

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="pt-6 sm:pt-10 grid md:grid-cols-2 gap-8 sm:gap-10 items-center">

        {/* Left: copy + CTAs */}
        <div className="space-y-6">
          {/* Dynamic badge */}
          {isSeries && heroEvent ? (
            <div className="inline-flex items-center gap-2 bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-sm text-[#D4AF37] font-medium flex-wrap">
              <span className="w-2 h-2 bg-[#D4AF37] rounded-full animate-pulse" />
              Sunset Sessions&nbsp;•&nbsp;{heroEvent.seriesVolumeLabel ?? "Vol. 01"}&nbsp;•&nbsp;{heroMinPrice > 0 ? `From ${fmt(heroMinPrice)}` : "Tickets Available"}
            </div>
          ) : isConcert && heroEvent ? (
            <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-sm text-amber-400 font-medium flex-wrap">
              <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
              Featured Event&nbsp;•&nbsp;{formatDate(heroEvent.date)}&nbsp;•&nbsp;{heroMinPrice > 0 ? `From ${fmt(heroMinPrice)}` : "Tickets Available"}
            </div>
          ) : launchEvent?.status === "completed" ? (
            <div className="inline-flex items-center gap-2 bg-emerald-900/20 border border-emerald-700/30 rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-sm text-emerald-400 font-medium flex-wrap">
              <span className="text-emerald-400">✓</span>
              Sea Bears Courtside&nbsp;•&nbsp;June 30, 2026&nbsp;•&nbsp;Sold Out
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 bg-pink-600/15 border border-pink-500/30 rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-sm text-pink-300 font-medium flex-wrap">
              <span className="w-2 h-2 bg-pink-400 rounded-full animate-pulse" />
              {launchEvent
                ? `Founding Event&nbsp;•&nbsp;Only ${launchEvent.ticketsRemaining} spots remaining`
                : "Winnipeg Community Events — Now Open"}
            </div>
          )}

          <div className="space-y-3">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-tight">
              Built for the<br />
              <span className="text-pink-500">Community</span>
            </h1>
            <p className="text-white/75 text-xl font-medium leading-snug">
              Connecting Winnipeg through safe events, local experiences, and genuine relationships.
            </p>
          </div>

          <p className="text-white/50 text-base leading-relaxed">
            ALL ACCESS Winnipeg is a non-profit community organization focused on bringing
            people together through experiences that promote connection, belonging, and well-being.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <Link
              href="/events"
              className="bg-pink-600 hover:bg-pink-500 px-7 py-3.5 rounded-xl font-bold text-base transition text-center"
            >
              Explore Events →
            </Link>
            {!user ? (
              <Link
                href="/signup"
                className="border border-white/20 hover:border-white/40 px-7 py-3.5 rounded-xl font-semibold text-base transition text-white/70 hover:text-white text-center"
              >
                Join the Community
              </Link>
            ) : !isActive ? (
              <button
                onClick={handleCheckout}
                disabled={checkoutLoading}
                className="border border-pink-500/40 hover:border-pink-500/70 px-7 py-3.5 rounded-xl font-semibold text-base transition text-pink-300 hover:text-pink-200"
              >
                {checkoutLoading ? "Redirecting…" : "Become a Supporter"}
              </button>
            ) : (
              <Link
                href="/perks"
                className="border border-white/20 hover:border-white/40 px-7 py-3.5 rounded-xl font-semibold text-base transition text-white/70 hover:text-white text-center"
              >
                View My Perks
              </Link>
            )}
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-950/40 border border-red-800 rounded-lg p-3">{error}</p>
          )}
        </div>

        {/* Right: hero event card */}
        {heroEvent && (
          <Link
            href={getEventHref(heroEvent)}
            className={`group block rounded-2xl overflow-hidden border transition-all duration-300 ${
              isSeries
                ? "border-[#D4AF37]/30 bg-black hover:border-[#D4AF37]/60 hover:shadow-[0_0_40px_rgba(212,175,55,0.12)]"
                : isConcert
                ? "border-amber-500/30 bg-black hover:border-amber-500/60 hover:shadow-[0_0_40px_rgba(245,158,11,0.12)]"
                : heroEvent.status === "completed"
                ? "border-white/15 bg-white/[0.03] hover:border-white/25"
                : "border-pink-500/30 bg-pink-950/10 hover:border-pink-500/60 hover:shadow-[0_0_40px_rgba(236,72,153,0.12)]"
            }`}
          >
            <div className="relative h-52 overflow-hidden bg-black">
              {getEventImage(heroEvent) ? (
                <img
                  src={getEventImage(heroEvent)}
                  alt={cleanTitle(heroEvent.title)}
                  className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-700"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              ) : (
                <div className={`w-full h-full ${
                  isSeries
                    ? "bg-gradient-to-br from-[#D4AF37]/20 via-black to-amber-900/20"
                    : "bg-gradient-to-br from-pink-900/50 to-purple-900/40"
                }`} />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

              {/* Event type badge */}
              <div className="absolute top-3 left-3">
                {isSeries ? (
                  <span className="bg-[#D4AF37] text-black text-xs font-black px-3 py-1 rounded-full">
                    SUNSET SESSIONS
                  </span>
                ) : isConcert ? (
                  <span className="bg-amber-500 text-black text-xs font-black px-3 py-1 rounded-full">
                    FEATURED CONCERT
                  </span>
                ) : (
                  <span className="bg-pink-600/90 backdrop-blur-sm text-white text-xs font-bold px-3 py-1 rounded-full">
                    🏀 Founding 15
                  </span>
                )}
              </div>

              {/* Availability badge */}
              <div className="absolute top-3 right-3">
                {heroEvent.status === "completed" ? (
                  <span className="bg-black/80 backdrop-blur-sm border border-white/20 text-white/60 text-xs font-bold px-3 py-1 rounded-full">
                    ✅ SOLD OUT
                  </span>
                ) : heroEvent.capacity > 0 && heroEvent.ticketsRemaining <= Math.ceil(heroEvent.capacity * 0.35) ? (
                  <span className={`bg-black/80 backdrop-blur-sm border text-xs font-bold px-3 py-1 rounded-full animate-pulse ${
                    isSeries ? "border-[#D4AF37]/30 text-[#D4AF37]" : "border-amber-500/30 text-amber-400"
                  }`}>
                    {heroEvent.ticketsRemaining} left
                  </span>
                ) : heroMinPrice > 0 ? (
                  <span className={`bg-black/80 backdrop-blur-sm border text-xs font-bold px-3 py-1 rounded-full ${
                    isSeries ? "border-[#D4AF37]/30 text-[#D4AF37]" : "border-amber-500/30 text-amber-400"
                  }`}>
                    From {fmt(heroMinPrice)}
                  </span>
                ) : null}
              </div>

              <div className="absolute bottom-3 left-4 right-4">
                {isSeries && (
                  <p className={`text-xs font-bold uppercase tracking-wider ${isSeries ? "text-[#D4AF37]/80" : "text-amber-400/80"}`}>
                    {heroEvent.seriesVolumeLabel ?? "Vol. 01"}&nbsp;·&nbsp;Rooftop Experience
                  </p>
                )}
                <p className="text-white font-bold text-lg leading-tight mt-0.5">{cleanTitle(heroEvent.title)}</p>
                <p className="text-white/55 text-xs mt-0.5">
                  {heroEvent.date ? formatDate(heroEvent.date) : "Date TBA"}&nbsp;·&nbsp;{heroEvent.location}
                </p>
              </div>
            </div>

            <div className="p-4 bg-black space-y-3">
              {isSeries && (
                <div className="flex flex-wrap gap-1.5">
                  {["Art & Painting", "Rooftop", "18+", "Community Access"].map((tag) => (
                    <span key={tag} className="text-[11px] bg-[#D4AF37]/5 border border-[#D4AF37]/15 rounded-full px-2.5 py-0.5 text-[#D4AF37]/60 font-medium">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between">
                <div>
                  {heroMinPrice > 0 ? (
                    <>
                      <p className="text-white font-bold text-lg">{fmt(heroMinPrice)}</p>
                      <p className="text-white/30 text-xs">
                        {isSeries ? "Supporter · Community · General tiers" : "Open to everyone"}
                      </p>
                    </>
                  ) : (
                    <p className="text-white/50 font-semibold text-sm">
                      {heroEvent.status === "completed" ? formatDate(heroEvent.date) : "Tickets TBA"}
                    </p>
                  )}
                </div>
                <span className={`text-sm font-semibold group-hover:translate-x-1 transition-transform ${
                  isSeries ? "text-[#D4AF37]" : isConcert ? "text-amber-400" : "text-pink-400"
                }`}>
                  {heroEvent.status === "completed" ? "View Memories →" : "Get tickets →"}
                </span>
              </div>
            </div>
          </Link>
        )}
      </section>

      {/* ── WHY ALL ACCESS WINNIPEG ───────────────────────────────────────── */}
      <section className="space-y-6">
        <div className="text-center space-y-1.5">
          <h2 className="text-2xl font-bold">Why ALL ACCESS Winnipeg?</h2>
          <p className="text-white/40 text-sm">A non-profit built around what Winnipeg actually needs.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: "🫶", title: "Community First", desc: "Building real connections across Winnipeg — not followers, not clout. People." },
            { icon: "🔒", title: "Safe Spaces", desc: "Respectful, welcoming, drama-free experiences where everyone feels they belong." },
            { icon: "🎉", title: "Unique Experiences", desc: "Sports, social events, wellness activities, and local outings — curated with purpose." },
            { icon: "🌎", title: "Inclusive For Everyone", desc: "Open to all backgrounds, ages (where applicable), and communities across Winnipeg." },
          ].map((card) => (
            <div key={card.title} className="bg-white/[0.04] border border-white/10 rounded-2xl p-5 space-y-3 hover:border-pink-500/20 transition">
              <span className="text-3xl">{card.icon}</span>
              <h3 className="font-bold text-sm text-white">{card.title}</h3>
              <p className="text-white/45 text-xs leading-relaxed">{card.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── COMMUNITY IMPACT STRIP ────────────────────────────────────────── */}
      <section className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
        {[
          { stat: `${Math.max(events.filter((e) => e.status !== "draft").length, 4)}+`, label: "Community events", pink: false },
          { stat: "6+", label: "Member perks", pink: false },
          { stat: "WPG", label: "100% Winnipeg-based", pink: false },
        ].map((item) => (
          <div key={item.label} className={`rounded-2xl py-4 sm:py-6 px-2 sm:px-4 border ${item.pink ? "bg-pink-950/20 border-pink-500/30" : "bg-white/5 border-white/10"}`}>
            <p className="text-3xl font-bold text-pink-400">{item.stat}</p>
            <p className={`text-sm mt-1 ${item.pink ? "text-white/60" : "text-white/40"}`}>{item.label}</p>
          </div>
        ))}
      </section>

      {/* ── SUNSET SESSIONS PROMO ─────────────────────────────────────────── */}
      <Link
        href="/series/sunset-sessions"
        className="group block relative overflow-hidden rounded-2xl border border-[#D4AF37]/25 bg-black hover:border-[#D4AF37]/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(212,175,55,0.08)]"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-[#D4AF37]/5 via-transparent to-[#D4AF37]/3 pointer-events-none" />
        <div className="relative px-6 sm:px-8 py-6 flex items-center justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <p className="text-[#D4AF37] text-xs font-bold tracking-[0.2em] uppercase">
              Now Ongoing · Event Series
            </p>
            <h2 className="text-xl font-bold text-white">Sunset Sessions by ALL ACCESS</h2>
            <p className="text-white/45 text-sm max-w-sm">
              Winnipeg&apos;s premium rooftop experience series. Art, music, culture — every session intentional.
            </p>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <div className="text-right hidden sm:block">
              <p className="text-[#D4AF37] font-bold text-sm">Vol. 01 Active</p>
              <p className="text-white/30 text-xs">Paint &amp; Sip · Rooftop</p>
            </div>
            <span className="text-[#D4AF37] font-semibold text-sm group-hover:translate-x-1 transition-transform whitespace-nowrap">
              Explore Series →
            </span>
          </div>
        </div>
      </Link>

      {/* ── URGENCY BANNER (dynamic — only shows when spots are low) ─────── */}
      {urgencyEvent && (
        <Link
          href={getEventHref(urgencyEvent)}
          className="group flex items-center justify-between gap-4 flex-wrap bg-gradient-to-r from-amber-950/30 via-black/40 to-amber-950/30 border border-amber-600/20 rounded-2xl px-6 py-4 hover:border-amber-500/40 transition"
        >
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-pulse shrink-0" />
            <p className="text-white/80 font-semibold text-sm">
              {cleanTitle(urgencyEvent.title)} is filling up fast.{" "}
              <span className="text-amber-400">
                Only {urgencyEvent.ticketsRemaining}{" "}
                {urgencyEvent.ticketsRemaining === 1 ? "spot" : "spots"} remaining.
              </span>
            </p>
          </div>
          <span className="text-amber-400 text-sm font-bold group-hover:translate-x-1 transition-transform shrink-0">
            Grab yours →
          </span>
        </Link>
      )}

      {/* ── UPCOMING COMMUNITY EXPERIENCES ───────────────────────────────── */}
      {events.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">Upcoming Community Experiences</h2>
              <p className="text-white/35 text-sm mt-1">Real events. Real people. Open to everyone.</p>
            </div>
            <Link href="/events" className="text-pink-400 hover:text-pink-300 text-sm transition shrink-0 mt-1">
              View all →
            </Link>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {events.map((ev) => {
              const isComingSoon = ev.status === "coming_soon";
              const isCompleted = ev.status === "completed";
              const spotsLow =
                !isComingSoon &&
                !isCompleted &&
                ev.capacity > 0 &&
                ev.ticketsRemaining <= Math.ceil(ev.capacity * 0.35);
              const isSeriesCard = ev.type === "series_event";
              const isConcertCard = ev.type === "concert" && !isCompleted;
              const href = getEventHref(ev);
              const img = getEventImage(ev);
              const publicPrice = getMinPrice(ev);
              const memberPrice = ev.memberPrice && ev.memberPrice > 0
                ? ev.memberPrice
                : (publicPrice > 0 ? Math.round(publicPrice * 0.85) : 0);
              const minPrice = (isActive && memberPrice > 0) ? memberPrice : publicPrice;

              return (
                <Link
                  key={ev.id}
                  href={href}
                  className={`group rounded-2xl overflow-hidden border transition-all duration-300 ${
                    isSeriesCard
                      ? "border-[#D4AF37]/20 bg-black hover:border-[#D4AF37]/45 hover:shadow-[0_0_30px_rgba(212,175,55,0.08)]"
                      : isConcertCard
                      ? "border-amber-500/25 bg-black hover:border-amber-500/50 hover:shadow-[0_0_30px_rgba(245,158,11,0.1)]"
                      : ev.isLaunchEvent && !isCompleted
                      ? "border-pink-500/30 bg-pink-950/10 hover:border-pink-500/55 hover:shadow-[0_0_30px_rgba(236,72,153,0.1)]"
                      : isComingSoon
                      ? "border-white/10 bg-white/[0.03] hover:border-purple-500/25"
                      : "border-white/10 bg-white/[0.03] hover:border-white/20"
                  }`}
                >
                  {/* Event image */}
                  <div className="relative h-44 overflow-hidden">
                    {img ? (
                      <img
                        src={img}
                        alt={cleanTitle(ev.title)}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                    ) : (
                      <div className={`w-full h-full ${
                        isSeriesCard
                          ? "bg-gradient-to-br from-[#D4AF37]/15 via-black to-amber-900/15"
                          : "bg-gradient-to-br from-pink-900/30 to-purple-900/30"
                      }`} />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

                    {/* Badges */}
                    <div className="absolute top-3 left-3 flex gap-2 flex-wrap">
                      {isSeriesCard && (
                        <span className="bg-[#D4AF37] text-black text-xs font-black px-2.5 py-0.5 rounded-full">
                          SERIES
                        </span>
                      )}
                      {isConcertCard && !isSeriesCard && (
                        <span className="bg-amber-500 text-black text-xs font-black px-2.5 py-0.5 rounded-full">
                          FEATURED
                        </span>
                      )}
                      {ev.isLaunchEvent && !isConcertCard && !isSeriesCard && (
                        <span className="bg-pink-600/90 backdrop-blur-sm text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                          🏀 Founding 15
                        </span>
                      )}
                      {isComingSoon && (
                        <span className="bg-purple-600/90 backdrop-blur-sm text-white text-xs font-bold px-2.5 py-0.5 rounded-full border border-purple-400/30">
                          Coming Soon
                        </span>
                      )}
                      {isCompleted && (
                        <span className="bg-black/80 backdrop-blur-sm border border-white/20 text-white/50 text-xs font-bold px-2.5 py-0.5 rounded-full">
                          ✓ Completed
                        </span>
                      )}
                      {spotsLow && (
                        <span className="bg-red-900/80 backdrop-blur text-xs text-red-300 border border-red-500/30 px-2.5 py-0.5 rounded-full font-semibold animate-pulse">
                          ⚡ {ev.ticketsRemaining} left
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="p-4 space-y-2">
                    <h3 className="font-semibold text-sm leading-tight text-white">{cleanTitle(ev.title)}</h3>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-white/40 text-xs">
                        {isComingSoon ? "📅 Date TBA" : `📅 ${formatDate(ev.date)}`}
                      </span>
                      {isCompleted ? (
                        <span className="text-white/30 text-xs font-semibold">✓ Completed</span>
                      ) : isComingSoon ? (
                        <span className="text-purple-400 text-xs font-semibold">Details soon</span>
                      ) : publicPrice > 0 ? (
                        <span className={`text-xs font-semibold ${isActive && memberPrice > 0 ? "text-pink-400" : isSeriesCard ? "text-[#D4AF37]/80" : "text-white/60"}`}>
                          {isActive && memberPrice > 0 ? `Member ${fmt(memberPrice)}` : fmt(publicPrice)}
                        </span>
                      ) : (
                        <span className="text-emerald-400 text-xs font-semibold">Free</span>
                      )}
                    </div>
                    {ev.location && !isComingSoon && (
                      <p className="text-white/30 text-xs truncate">📍 {ev.location}</p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ── MEMBERSHIP ────────────────────────────────────────────────────── */}
      {(!user || !isActive) && (
        <section className="max-w-lg mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold">Support the Mission.</h2>
            <p className="text-white/40 text-sm max-w-sm mx-auto">
              Membership directly funds safe, accessible experiences for Winnipeg youth and young adults —
              and saves you money at every event.
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
                "15% off all event tickets — every time, automatically",
                "Priority access to new events before public release",
                "Local partner perks & community discounts",
                "Access to the community feed + founding supporter status",
                "Directly fund safe, accessible experiences for Winnipeg youth",
                "Help us build more — more events, more spaces, more impact",
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
              {checkoutLoading ? "Redirecting…" : "Become a Supporter — $25/mo"}
            </button>

            {error && (
              <p className="text-red-400 text-sm bg-red-950/40 border border-red-800 rounded-lg p-3">{error}</p>
            )}

            <p className="text-center text-white/20 text-xs">
              Secure checkout via Stripe. Cancel anytime. Events are open to everyone — membership is how you support the community.
            </p>
          </div>
        </section>
      )}

      {/* ── LIVE SOCIAL FEED ──────────────────────────────────────────────── */}
      <SocialFeedSection maxPosts={8} showHeader={true} showFollowCTAs={true} />

      {/* ── MISSION STRIP ─────────────────────────────────────────────────── */}
      <section className="text-center space-y-6 border-t border-white/5 pt-12">
        <p className="text-white/20 text-xs uppercase tracking-[0.2em] font-bold">Built in Winnipeg</p>
        <div className="space-y-4">
          <p className="text-white/70 text-xl md:text-2xl font-bold max-w-2xl mx-auto leading-snug">
            We&apos;re building more than events.
          </p>
          <p className="text-white/40 text-base max-w-xl mx-auto leading-relaxed">
            ALL ACCESS exists to give youth and young adults in Winnipeg real access — to safe experiences,
            genuine connection, and a community that moves with purpose.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5 justify-center pt-2">
          {[
            "Real Access", "Community First", "Mental Well-being",
            "Youth-Led", "Cultural Growth", "Open to Everyone",
          ].map((tag) => (
            <span
              key={tag}
              className="bg-white/[0.04] border border-white/[0.08] rounded-full px-4 py-1.5 text-white/35 text-xs font-medium tracking-wide"
            >
              {tag}
            </span>
          ))}
        </div>
        <p className="text-white/15 text-sm font-bold uppercase tracking-[0.3em] pt-4">
          TakersLifestyle
        </p>
      </section>

    </main>
  );
}
