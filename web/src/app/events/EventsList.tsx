"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";

// ── Pricing constant ────────────────────────────────────────────────────────
const MEMBER_DISCOUNT = 0.15;

function calcMemberPrice(generalPrice: number): number {
  return Math.round(generalPrice * (1 - MEMBER_DISCOUNT) * 100) / 100;
}
function calcSavings(generalPrice: number): number {
  return Math.round(generalPrice * MEMBER_DISCOUNT * 100) / 100;
}

function fmt(n: number): string {
  const r = Math.round(n * 100) / 100;
  return `$${r % 1 === 0 ? r.toFixed(0) : r.toFixed(2)}`;
}

// ── Types ────────────────────────────────────────────────────────────────────
interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  location: string;
  generalPrice: number;
  memberPrice: number;
  capacity: number;
  ticketsRemaining: number;
  isMembersOnly: boolean;
  status: string;
  imageUrl: string;
  isLaunchEvent?: boolean;
  noMemberDiscount?: boolean;
  soldOut?: boolean;
  registrationOpen?: boolean;
  checkoutEnabled?: boolean;
  type?: string;
  featured?: boolean;
  slug?: string;
}

// EventPurchase — mirrors the eventPurchases Firestore collection
// Written by webhook, queried client-side for ownership detection
interface EventPurchase {
  id: string;          // Firestore doc ID (= orderId)
  orderId: string;
  userId: string;
  eventId: string;
  eventTitle?: string;
  isFoundingMember: boolean;
  quantity: number;
  totalPrice: number;
  totalPriceCents?: number;
  status: string;      // "confirmed"
  purchasedAt?: string;
  stripeSessionId?: string;
  stripePaymentIntentId?: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(dateStr: string) {
  if (!dateStr) return "";
  try {
    return new Date(dateStr + "T12:00:00").toLocaleDateString("en-CA", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
  } catch { return dateStr; }
}

function formatShortDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-CA", {
      month: "long", day: "numeric", year: "numeric",
    });
  } catch { return ""; }
}

// ── Countdown timer ──────────────────────────────────────────────────────────
function getTimeLeft(target: Date) {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  return { days, hours, minutes, seconds, expired: false };
}

function CountdownTimer({ targetDate }: { targetDate: Date }) {
  const [timeLeft, setTimeLeft] = useState(getTimeLeft(targetDate));

  useEffect(() => {
    const t = setInterval(() => setTimeLeft(getTimeLeft(targetDate)), 1000);
    return () => clearInterval(t);
  }, [targetDate]);

  if (timeLeft.expired) {
    return (
      <div className="flex items-center justify-center gap-2 py-2">
        <span className="text-lg">🎉</span>
        <span className="text-emerald-300 font-bold text-sm">Event day is here!</span>
      </div>
    );
  }

  const segments = [
    { label: "Days", value: timeLeft.days },
    { label: "Hrs", value: timeLeft.hours },
    { label: "Min", value: timeLeft.minutes },
    { label: "Sec", value: timeLeft.seconds },
  ];

  return (
    <div className="flex gap-2 justify-center">
      {segments.map(({ label, value }) => (
        <div key={label} className="flex flex-col items-center bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 min-w-[52px]">
          <span className="text-xl font-black tabular-nums text-white leading-none">
            {String(value).padStart(2, "0")}
          </span>
          <span className="text-[9px] text-white/25 font-bold uppercase tracking-widest mt-1">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Founding 15 — Confirmed attendee state ───────────────────────────────────
function FoundingConfirmedState({ ticket, ev }: { ticket: EventPurchase; ev: Event }) {
  const paidDate = ticket.purchasedAt ? formatShortDate(ticket.purchasedAt) : null;
  const eventTarget = new Date(ev.date + "T19:00:00"); // 7PM local event day
  const shortOrderId = ticket.id.slice(-8).toUpperCase();

  const perks = [
    { emoji: "🏀", label: "Premium courtside Sea Bears ticket" },
    { emoji: "🍽️", label: "Dinner buffet" },
    { emoji: "🥤", label: "Beverages included (alcohol optional at venue)" },
    { emoji: "🚐", label: "Group transportation — to & from event" },
    { emoji: "📍", label: "Private host meetup location" },
    { emoji: "🪧", label: "Wristband + guest verification" },
    { emoji: "📸", label: "Group photos + founder social warm-up" },
    { emoji: "🏅", label: "Founding 15 recognition" },
    { emoji: "⚡", label: "Priority future ALL ACCESS opportunities" },
  ];

  return (
    <div className="space-y-4 border-t border-emerald-500/15 pt-5">
      {/* YOU'RE IN hero */}
      <div className="bg-gradient-to-br from-emerald-950/50 via-black/40 to-black/60 border border-emerald-500/25 rounded-2xl p-5 text-center space-y-3">
        <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/25 rounded-full px-4 py-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="text-emerald-300 text-[11px] font-bold uppercase tracking-widest">Founding 15 — Confirmed</span>
        </div>

        <div>
          <h3 className="text-2xl font-black text-white tracking-tight">You&rsquo;re in.</h3>
          <p className="text-white/45 text-sm mt-1 leading-relaxed">
            Welcome to ALL ACCESS.<br />
            <span className="text-white/30">You officially secured your courtside experience for June 30.</span>
          </p>
        </div>

        {/* Countdown */}
        <div className="space-y-2 pt-0.5">
          <p className="text-white/20 text-[9px] font-bold uppercase tracking-widest">Event countdown</p>
          <CountdownTimer targetDate={eventTarget} />
        </div>
      </div>

      {/* Ticket badge */}
      <div className="flex items-center justify-between bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-pink-600/15 border border-pink-500/25 flex items-center justify-center shrink-0">
            <span className="text-base">🎟</span>
          </div>
          <div>
            <p className="text-white text-sm font-bold leading-tight">
              {ticket.quantity} Founding Spot{ticket.quantity !== 1 ? "s" : ""} Secured
            </p>
            {paidDate && (
              <p className="text-white/25 text-xs mt-0.5">Purchased {paidDate}</p>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-white/15 text-[10px] font-mono tracking-wider">#{shortOrderId}</p>
          <div className="flex items-center gap-1 justify-end mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <p className="text-emerald-400 text-xs font-bold">PAID</p>
          </div>
        </div>
      </div>

      {/* What you get */}
      <div className="space-y-2">
        <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest px-0.5">
          🎟 Your Founding Access Includes
        </p>
        <div className="space-y-1.5">
          {perks.map((perk) => (
            <div
              key={perk.label}
              className="flex items-center gap-3 px-3 py-2 bg-white/[0.02] rounded-lg border border-white/[0.05]"
            >
              <span className="text-sm shrink-0">{perk.emoji}</span>
              <span className="text-white/55 text-xs flex-1">{perk.label}</span>
              <span className="text-emerald-400 text-xs font-bold shrink-0">✓</span>
            </div>
          ))}
        </div>
      </div>

      {/* Transport section */}
      <div className="bg-blue-950/20 border border-blue-500/15 rounded-xl px-4 py-4 space-y-3">
        <div className="flex items-center gap-2.5">
          <span className="text-base shrink-0">🚌</span>
          <p className="text-blue-300 text-xs font-bold uppercase tracking-wider">Transportation Included</p>
        </div>
        <p className="text-white/35 text-xs leading-relaxed pl-0.5">
          You&rsquo;ll receive everything you need before June 30:
        </p>
        <div className="space-y-1.5 pl-0.5">
          {[
            "Pickup instructions sent before the event",
            "Private meetup location revealed to all confirmed attendees",
            "Arrival time + group departure details via email",
            "Executive sprinter / limo bus — everyone travels together",
            "Safe controlled group return after the game",
          ].map((item) => (
            <div key={item} className="flex items-start gap-2">
              <span className="text-blue-400/40 shrink-0 text-xs mt-0.5">·</span>
              <span className="text-white/40 text-xs leading-relaxed">{item}</span>
            </div>
          ))}
        </div>
        <div className="flex items-start gap-2 bg-blue-950/30 border border-blue-500/10 rounded-lg px-3 py-2.5">
          <span className="shrink-0 text-xs mt-0.5">📍</span>
          <p className="text-blue-300/55 text-xs leading-relaxed">
            Exact meetup location revealed closer to June 30 — watch your email.
          </p>
        </div>
      </div>

      {/* Email reminder */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
        <span className="text-base shrink-0">📧</span>
        <p className="text-white/30 text-xs leading-relaxed">
          Ticket confirmation sent to your email.
          Questions?{" "}
          <a
            href="mailto:hello@allaccesswinnipeg.ca"
            className="text-white/45 hover:text-white/70 transition underline"
          >
            hello@allaccesswinnipeg.ca
          </a>
        </p>
      </div>
    </div>
  );
}

// ── Generic event — Confirmed attendee state ─────────────────────────────────
function GenericConfirmedState({ ticket, ev }: { ticket: EventPurchase; ev: Event }) {
  const paidDate = ticket.purchasedAt ? formatShortDate(ticket.purchasedAt) : null;
  const eventTarget = new Date(ev.date + "T19:00:00");
  const shortOrderId = ticket.id.slice(-8).toUpperCase();

  return (
    <div className="space-y-4 border-t border-emerald-500/15 pt-5">
      {/* Confirmed hero */}
      <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-xl px-4 py-4 text-center space-y-3">
        <div className="inline-flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-300 text-sm font-bold">You&rsquo;re attending</span>
        </div>
        <CountdownTimer targetDate={eventTarget} />
      </div>

      {/* Ticket badge */}
      <div className="flex items-center justify-between bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-pink-600/15 border border-pink-500/20 flex items-center justify-center shrink-0">
            <span className="text-sm">🎟</span>
          </div>
          <div>
            <p className="text-white text-sm font-bold">
              {ticket.quantity} Ticket{ticket.quantity !== 1 ? "s" : ""} Confirmed
            </p>
            {paidDate && <p className="text-white/25 text-xs mt-0.5">{paidDate}</p>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-white/15 text-[10px] font-mono tracking-wider">#{shortOrderId}</p>
          <div className="flex items-center gap-1 justify-end mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <p className="text-emerald-400 text-xs font-bold">PAID</p>
          </div>
        </div>
      </div>

      <p className="text-center text-white/20 text-xs">
        Confirmation email sent · Questions?{" "}
        <a href="mailto:hello@allaccesswinnipeg.ca" className="text-white/30 underline hover:text-white/50 transition">
          hello@allaccesswinnipeg.ca
        </a>
      </p>
    </div>
  );
}

// ── Urgency bar ──────────────────────────────────────────────────────────────
function UrgencyBar({ capacity, remaining }: { capacity: number; remaining: number }) {
  if (!capacity) return null;
  const filled = capacity - remaining;
  const pct = Math.min(Math.round((filled / capacity) * 100), 100);
  const isCritical = remaining <= 5;
  const isLow = remaining <= Math.ceil(capacity * 0.25);

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-xs">
        {isCritical ? (
          <span className="text-red-400 font-bold animate-pulse">🔥 Only {remaining} spot{remaining !== 1 ? "s" : ""} left!</span>
        ) : isLow ? (
          <span className="text-amber-400 font-semibold">⚡ {remaining} spots remaining — filling fast</span>
        ) : (
          <span className="text-white/40">{remaining} of {capacity} spots open</span>
        )}
        <span className="text-white/20 tabular-nums">{pct}% filled</span>
      </div>
      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${isCritical ? "bg-red-500" : isLow ? "bg-amber-500" : "bg-emerald-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

const MAX_QTY = 5;

// ── Sign-in gate ─────────────────────────────────────────────────────────────
function SignInGate({ isLaunchEvent }: { isLaunchEvent?: boolean }) {
  return (
    <div className="border-t border-white/8 pt-4 mt-2 space-y-3">
      <div className="flex items-center gap-3 bg-white/[0.03] border border-white/8 rounded-xl px-4 py-3.5">
        <div className="w-8 h-8 rounded-full bg-pink-600/15 border border-pink-500/20 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-white/70 text-sm font-semibold leading-tight">
            {isLaunchEvent ? "Apply for Founding Access" : "Sign in to unlock tickets"}
          </p>
          <p className="text-white/30 text-xs mt-0.5">
            {isLaunchEvent
              ? "Create your account to secure your founding spot."
              : "Create your account to view pricing and availability."}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Link href="/login" className="flex-1 text-center border border-white/15 hover:border-white/30 py-3 rounded-xl text-sm font-semibold text-white/60 hover:text-white transition">
          Log in
        </Link>
        <Link href="/signup" className="flex-1 text-center bg-pink-600 hover:bg-pink-500 py-3 rounded-xl text-sm font-bold transition">
          {isLaunchEvent ? "Claim Founding Access" : "Create account"}
        </Link>
      </div>
    </div>
  );
}

// ── Future Drop card ─────────────────────────────────────────────────────────
function FutureDropCard({ ev }: { ev: Event }) {
  const cleanTitle = ev.title
    .replace(/\s*—\s*coming soon/i, "")
    .replace(/coming soon/i, "")
    .trim();

  return (
    <div className="rounded-2xl overflow-hidden border border-white/15 bg-white/5 hover:border-purple-500/30 hover:shadow-[0_0_30px_rgba(168,85,247,0.07)] transition-all duration-300 group">
      {ev.imageUrl && (
        <div className="relative w-full h-60 overflow-hidden">
          <img src={ev.imageUrl} alt={cleanTitle} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 brightness-90" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute top-4 left-4">
            <span className="bg-purple-600/90 backdrop-blur-sm border border-purple-400/40 text-white text-xs font-bold px-3 py-1.5 rounded-full">
              Future Drop
            </span>
          </div>
          <div className="absolute bottom-4 right-4">
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 text-white/70 text-sm font-bold px-4 py-2 rounded-xl">
              Date TBA
            </div>
          </div>
        </div>
      )}

      <div className="p-6 space-y-4">
        {!ev.imageUrl && (
          <span className="inline-block bg-purple-600/20 border border-purple-500/30 text-purple-300 text-xs font-bold px-3 py-1 rounded-full mb-1">
            Future Drop
          </span>
        )}

        <h2 className="text-xl md:text-2xl font-bold leading-tight">{cleanTitle}</h2>

        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-white/50">
          <span className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 shrink-0 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            Date TBA
          </span>
          <span className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 shrink-0 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            Private Rooftop Venue (Location revealed later)
          </span>
        </div>

        <p className="text-white/45 text-sm leading-relaxed border-t border-white/5 pt-4">
          An exclusive rooftop social is coming later this season. Sunset views, curated energy, and elevated connection. Full details dropping soon.
        </p>

        <div className="pt-1 space-y-3">
          <div className="w-full text-center py-4 rounded-xl border border-purple-500/20 bg-purple-950/20 text-purple-300/60 text-sm font-semibold cursor-not-allowed select-none">
            Details Coming Soon
          </div>
          <p className="text-center text-white/15 text-xs flex items-center justify-center gap-1.5">
            Stay tuned — this one&apos;s worth the wait
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Founding value stack ─────────────────────────────────────────────────────
function FoundingValueStack() {
  const items = [
    { emoji: "🏀", label: "Premium courtside Sea Bears ticket" },
    { emoji: "🍽️", label: "Dinner buffet included" },
    { emoji: "🥤", label: "Beverages included — alcohol optionally available at venue" },
    { emoji: "📍", label: "Private host meetup location" },
    { emoji: "🪧", label: "Wristband + guest verification" },
    { emoji: "🚐", label: "Group transportation — to & from event" },
    { emoji: "📸", label: "Group photos + founder social warm-up" },
    { emoji: "🏅", label: "Founding 15 recognition" },
    { emoji: "⚡", label: "Priority future ALL ACCESS opportunities" },
  ];

  return (
    <div className="space-y-3 border-t border-white/8 pt-5">
      <div className="space-y-0.5">
        <p className="text-white/80 text-sm font-bold">What Your Founding Access Includes</p>
        <p className="text-white/30 text-xs">Everything covered. Nothing extra to buy.</p>
      </div>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-3 px-3 py-2.5 bg-white/[0.03] rounded-lg border border-white/[0.06]">
            <span className="text-sm shrink-0">{item.emoji}</span>
            <span className="text-white/65 text-xs font-medium flex-1">{item.label}</span>
            <span className="text-emerald-400 text-xs font-bold shrink-0">✓</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Founding 15 Experience Flow ──────────────────────────────────────────────
function ExperienceFlow({ ticketsRemaining }: { ticketsRemaining: number }) {
  const steps = [
    {
      num: "01",
      emoji: "📍",
      title: "Private Host Meetup",
      sub: "Winnipeg — Location revealed after booking",
      bullets: ["Check-in & guest verification", "Wristbands & group photos", "Meet the founders & host", "Social warm-up"],
    },
    {
      num: "02",
      emoji: "🚐",
      title: "Group Transportation",
      sub: "Premium Group Transportation",
      bullets: ["Executive sprinter / limo bus", "Unified group arrival", "Premium social content", "Everyone travels together"],
    },
    {
      num: "03",
      emoji: "🏀",
      title: "Sea Bears Courtside",
      sub: "Canada Life Centre",
      bullets: ["Premium courtside ticket", "Dinner buffet included", "Non-alcoholic beverages included", "Alcohol available at venue (optional)", "Community bonding + content capture"],
    },
    {
      num: "04",
      emoji: "🔒",
      title: "Return Transport",
      sub: "Safe group closeout",
      bullets: ["Controlled group return", "Full safety close", "Professional wrap", "The beginning of something real"],
    },
  ];

  return (
    <div className="space-y-4 border-t border-white/8 pt-5 mt-1">
      <div className="space-y-0.5">
        <p className="text-pink-400 text-xs font-bold uppercase tracking-widest">Founding 15 Experience Flow</p>
        <p className="text-white/35 text-xs">This is not just a ticket — it&apos;s the full ALL ACCESS experience.</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {steps.map((step) => (
          <div key={step.num} className="bg-black/40 border border-white/8 rounded-xl p-4 space-y-2 relative overflow-hidden">
            <div className="absolute top-2 right-3 text-white/[0.04] text-5xl font-black leading-none select-none pointer-events-none">{step.num}</div>
            <div className="flex items-center gap-2">
              <span className="text-base">{step.emoji}</span>
              <span className="text-white/25 text-xs font-bold uppercase tracking-wider">Step {step.num}</span>
            </div>
            <p className="text-white font-bold text-sm leading-tight">{step.title}</p>
            <p className="text-pink-400/60 text-xs">{step.sub}</p>
            <ul className="space-y-0.5 pt-0.5">
              {step.bullets.map((b) => (
                <li key={b} className="text-white/35 text-xs flex items-start gap-1.5">
                  <span className="text-pink-500/40 shrink-0 mt-0.5">·</span>
                  {b}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="bg-pink-950/20 border border-pink-500/15 rounded-xl px-4 py-3.5 space-y-2">
        <p className="text-white/70 text-xs leading-relaxed">
          <span className="font-semibold text-white/90">📍 Exact host meetup location revealed after confirmed booking.</span>
        </p>
        <p className="text-white/55 text-xs leading-relaxed">
          Your ticket includes buffet dining, courtside access, transportation, and beverages. Alcohol is optionally available at venue pricing.
        </p>
        <p className="text-white/30 text-xs">Only {ticketsRemaining} founding {ticketsRemaining === 1 ? "spot" : "spots"} remaining. This is the beginning of the ALL ACCESS experience standard.</p>
      </div>

      <p className="text-center text-white/30 text-xs font-medium italic">
        This is not mass entry. This is how ALL ACCESS begins.
      </p>
    </div>
  );
}

// ── Founding 15 — Post-event attended state ──────────────────────────────────
function FoundingAttendedState({ ticket, ev }: { ticket: EventPurchase; ev: Event }) {
  const paidDate = ticket.purchasedAt ? formatShortDate(ticket.purchasedAt) : null;
  const shortOrderId = ticket.id.slice(-8).toUpperCase();

  const perks = [
    { emoji: "🏀", label: "Premium courtside Sea Bears ticket" },
    { emoji: "🍽️", label: "Dinner buffet" },
    { emoji: "🥤", label: "Beverages included" },
    { emoji: "🚐", label: "Group transportation — to & from event" },
    { emoji: "📍", label: "Private host meetup" },
    { emoji: "🪧", label: "Wristband + guest verification" },
    { emoji: "📸", label: "Group photos + founder social" },
    { emoji: "🏅", label: "Founding 15 recognition" },
    { emoji: "⚡", label: "Priority future ALL ACCESS opportunities" },
  ];

  return (
    <div className="space-y-4 border-t border-white/10 pt-5">
      <div className="bg-gradient-to-br from-emerald-950/40 via-black/60 to-black/70 border border-emerald-500/20 rounded-2xl p-5 text-center space-y-3">
        <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5">
          <span className="text-emerald-400 text-sm">✓</span>
          <span className="text-emerald-300 text-[11px] font-bold uppercase tracking-widest">Founding 15 · You Attended</span>
        </div>
        <div>
          <h3 className="text-2xl font-black text-white tracking-tight">Thank you.</h3>
          <p className="text-white/50 text-sm mt-1 leading-relaxed">
            You were part of something real.<br />
            <span className="text-white/30">June 30, 2026 · Canada Life Centre</span>
          </p>
        </div>
        <Link
          href="/memories"
          className="inline-flex items-center gap-2 bg-pink-600/90 hover:bg-pink-500 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition"
        >
          📸 View Event Memories
        </Link>
      </div>

      <div className="flex items-center justify-between bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-600/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
            <span className="text-base">🎟</span>
          </div>
          <div>
            <p className="text-white text-sm font-bold leading-tight">
              {ticket.quantity} Founding Spot{ticket.quantity !== 1 ? "s" : ""} — Attended
            </p>
            {paidDate && <p className="text-white/25 text-xs mt-0.5">Purchased {paidDate}</p>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-white/15 text-[10px] font-mono tracking-wider">#{shortOrderId}</p>
          <p className="text-emerald-400 text-xs font-bold mt-0.5">✓ ATTENDED</p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest px-0.5">Your Founding Experience Included</p>
        <div className="space-y-1.5">
          {perks.map((perk) => (
            <div key={perk.label} className="flex items-center gap-3 px-3 py-2 bg-white/[0.02] rounded-lg border border-white/[0.04]">
              <span className="text-sm shrink-0">{perk.emoji}</span>
              <span className="text-white/40 text-xs flex-1">{perk.label}</span>
              <span className="text-emerald-400 text-xs font-bold shrink-0">✓</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Generic event — Post-event attended state ────────────────────────────────
function GenericAttendedState({ ticket }: { ticket: EventPurchase }) {
  const paidDate = ticket.purchasedAt ? formatShortDate(ticket.purchasedAt) : null;
  const shortOrderId = ticket.id.slice(-8).toUpperCase();

  return (
    <div className="space-y-4 border-t border-white/10 pt-5">
      <div className="bg-black/40 border border-white/10 rounded-xl px-4 py-4 text-center space-y-2">
        <p className="text-emerald-400 text-lg">✓</p>
        <p className="text-white/70 font-semibold text-sm">You attended this event.</p>
        <p className="text-white/30 text-xs">Thank you for being part of the community.</p>
      </div>
      <div className="flex items-center justify-between bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm">🎟</span>
          <div>
            <p className="text-white text-sm font-bold">{ticket.quantity} Ticket{ticket.quantity !== 1 ? "s" : ""} — Attended</p>
            {paidDate && <p className="text-white/25 text-xs">{paidDate}</p>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-white/15 text-[10px] font-mono">#{shortOrderId}</p>
          <p className="text-emerald-400 text-xs font-bold mt-0.5">✓ ATTENDED</p>
        </div>
      </div>
    </div>
  );
}

// ── Completed event — public/closed view ────────────────────────────────────
function CompletedEventClosed() {
  return (
    <div className="space-y-3 pt-1">
      <div className="w-full text-center py-5 px-4 rounded-2xl border border-white/10 bg-white/[0.02] space-y-3">
        <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1">
          <span className="text-emerald-400 text-xs">✓</span>
          <span className="text-white/40 text-xs font-bold uppercase tracking-widest">Event Completed</span>
        </div>
        <p className="text-white/50 text-sm font-medium">This event has ended.</p>
        <p className="text-white/25 text-xs leading-relaxed">
          Thank you to everyone who joined us for this inaugural experience.
        </p>
        <Link
          href="/memories"
          className="inline-flex items-center gap-2 mx-auto bg-white/8 hover:bg-white/12 border border-white/15 text-white/70 hover:text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition"
        >
          📸 View Event Memories
        </Link>
      </div>
    </div>
  );
}

// ── Featured concert card ────────────────────────────────────────────────────
function FeaturedConcertCard({ ev }: { ev: Event }) {
  const href = ev.slug ? `/events/${ev.slug}` : "/events";
  return (
    <Link
      href={href}
      className="group block rounded-2xl overflow-hidden border border-amber-500/30 bg-black hover:border-amber-500/60 hover:shadow-[0_0_50px_rgba(245,158,11,0.1)] transition-all duration-300"
    >
      {ev.imageUrl && (
        <div className="relative w-full h-72 overflow-hidden">
          <img
            src={ev.imageUrl}
            alt={ev.title}
            className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
          <div className="absolute top-4 left-4 flex gap-2 flex-wrap">
            <span className="bg-amber-500 text-black text-xs font-black px-3 py-1.5 rounded-full">
              FEATURED CONCERT
            </span>
            {ev.date && (
              <span className="bg-black/80 backdrop-blur-sm border border-white/20 text-white/70 text-xs font-bold px-3 py-1.5 rounded-full">
                {new Date(ev.date + "T12:00:00").toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            )}
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <p className="text-amber-400/80 text-xs font-bold uppercase tracking-[0.15em]">
              Konfam&apos;s First Headline Show
            </p>
            <h2 className="text-3xl font-black text-white mt-1 leading-tight tracking-tight">
              ROCAFIESTA
            </h2>
            <p className="text-white/55 text-sm mt-1">A Spiritual Experience with Konfam</p>
          </div>
        </div>
      )}
      <div className="px-6 py-4 bg-black flex items-center justify-between gap-4 border-t border-amber-500/10">
        <div className="flex gap-5 flex-wrap">
          <div>
            <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest">Tickets from</p>
            <p className="text-white font-black text-lg">$40</p>
          </div>
          <div className="border-l border-white/10 pl-5">
            <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest">Date</p>
            <p className="text-white font-semibold text-sm">September 5, 2026</p>
          </div>
          <div className="border-l border-white/10 pl-5">
            <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest">Location</p>
            <p className="text-white font-semibold text-sm">Winnipeg, MB</p>
          </div>
        </div>
        <span className="text-amber-400 font-bold text-sm group-hover:translate-x-1 transition-transform shrink-0">
          View Event →
        </span>
      </div>
    </Link>
  );
}

// ── Event card ───────────────────────────────────────────────────────────────
function EventCard({
  ev,
  isSignedIn,
  isMember,
  uid,
  userEmail,
  userTicket,
}: {
  ev: Event;
  isSignedIn: boolean;
  isMember: boolean;
  uid?: string;
  userEmail?: string;
  userTicket?: EventPurchase | null;
}) {
  const isCompleted = ev.status === "completed";
  const isSoldOut = isCompleted || ev.status === "sold_out" || ev.ticketsRemaining === 0;
  const isCritical = !isSoldOut && !isCompleted && ev.capacity > 0 && ev.ticketsRemaining <= 5;
  const isLow = !isSoldOut && !isCompleted && ev.capacity > 0 && ev.ticketsRemaining <= Math.ceil(ev.capacity * 0.25);
  const isConfirmed = !!userTicket;

  // ── Pricing ──────────────────────────────────────────────
  const generalPrice = Number(ev.generalPrice) || 0;
  const memberDiscountedPrice = (generalPrice > 0 && !ev.noMemberDiscount) ? calcMemberPrice(generalPrice) : 0;
  const savingsAmount = (generalPrice > 0 && !ev.noMemberDiscount) ? calcSavings(generalPrice) : 0;
  const displayPrice = isMember && memberDiscountedPrice > 0 ? memberDiscountedPrice : generalPrice;

  const [qty, setQty] = useState(1);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const maxQty = Math.min(MAX_QTY, ev.ticketsRemaining || MAX_QTY);
  const totalPrice = displayPrice * qty;

  const handleGetTickets = useCallback(async () => {
    setCheckoutError(null);
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/event-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: ev.id, quantity: qty, uid: uid ?? null, userEmail: userEmail ?? null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Checkout failed. Please try again.");
      if (data.url) { window.location.href = data.url; return; }
      throw new Error("No redirect URL returned. Please try again.");
    } catch (e: unknown) {
      setCheckoutError(e instanceof Error ? e.message : String(e));
      setCheckoutLoading(false);
    }
  }, [ev.id, qty, uid, userEmail]);

  return (
    <div className={`rounded-2xl overflow-hidden transition-all duration-300 group ${
      isCompleted
        ? "border border-white/10 bg-white/[0.03]"
        : isConfirmed
        ? "border border-emerald-500/20 bg-white/5 shadow-[0_0_40px_rgba(16,185,129,0.04)]"
        : isSoldOut
        ? "border border-white/5 bg-white/[0.02] opacity-50"
        : isCritical
        ? "border border-red-500/30 bg-white/5 shadow-[0_0_30px_rgba(239,68,68,0.08)]"
        : "border border-white/10 bg-white/5 hover:border-white/25 hover:shadow-[0_0_40px_rgba(236,72,153,0.06)]"
    }`}>

      {ev.imageUrl && (
        <div className="relative w-full h-60 overflow-hidden">
          <img
            src={ev.imageUrl}
            alt={ev.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          {/* Status badges */}
          <div className="absolute top-4 left-4 flex gap-2 flex-wrap">
            {isCompleted ? (
              <>
                {isConfirmed ? (
                  <span className="bg-emerald-900/90 backdrop-blur-sm border border-emerald-600/40 text-emerald-300 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    You Attended
                  </span>
                ) : (
                  <span className="bg-black/80 backdrop-blur-sm border border-white/15 text-white/60 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5">
                    ✓ Event Completed
                  </span>
                )}
                <span className="bg-black/80 backdrop-blur-sm border border-white/15 text-white/40 text-xs font-bold px-3 py-1.5 rounded-full">
                  SOLD OUT
                </span>
              </>
            ) : (
              <>
                {/* Confirmed badge — highest priority */}
                {isConfirmed && (
                  <span className="bg-emerald-600/90 backdrop-blur-sm border border-emerald-400/40 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    You&rsquo;re Attending
                  </span>
                )}
                {!isConfirmed && ev.isLaunchEvent && !isSoldOut && (
                  <span className="bg-pink-600/90 backdrop-blur-sm border border-pink-400/40 text-white text-xs font-bold px-3 py-1.5 rounded-full">
                    🚀 Founding 15
                  </span>
                )}
                {!isConfirmed && isSoldOut && (
                  <span className="bg-red-900/90 backdrop-blur-sm border border-red-500/50 text-red-200 text-xs font-bold px-3 py-1.5 rounded-full">SOLD OUT</span>
                )}
                {!isConfirmed && isCritical && !isSoldOut && !ev.isLaunchEvent && (
                  <span className="bg-red-900/90 backdrop-blur-sm border border-red-500/50 text-red-200 text-xs font-bold px-3 py-1.5 rounded-full animate-pulse">🔥 {ev.ticketsRemaining} Left</span>
                )}
                {!isConfirmed && ev.isLaunchEvent && !isSoldOut && ev.ticketsRemaining <= 15 && (
                  <span className="bg-black/70 backdrop-blur-sm border border-white/20 text-white/80 text-xs font-bold px-3 py-1.5 rounded-full animate-pulse">
                    Only {ev.ticketsRemaining} Tickets
                  </span>
                )}
                {!isConfirmed && !isCritical && isLow && (
                  <span className="bg-amber-900/90 backdrop-blur-sm border border-amber-500/40 text-amber-200 text-xs font-bold px-3 py-1.5 rounded-full animate-pulse">⚡ Limited Spots</span>
                )}
              </>
            )}
          </div>

          {/* Price badge — bottom right (hidden for completed events) */}
          {!isCompleted && <div className="absolute bottom-4 right-4 text-right">
            {isConfirmed ? (
              /* Confirmed — show paid amount */
              <div className="bg-emerald-600/90 backdrop-blur-sm border border-emerald-400/30 text-white text-sm font-bold px-4 py-2 rounded-xl shadow-lg">
                {fmt(userTicket.totalPrice)}
              </div>
            ) : !isSignedIn ? (
              <div className="bg-emerald-600/90 backdrop-blur-sm text-white text-sm font-bold px-4 py-2 rounded-xl border border-emerald-500/40 shadow-lg">
                FREE
              </div>
            ) : isMember && memberDiscountedPrice > 0 ? (
              <div className="space-y-0.5 text-right">
                <div className="bg-pink-600 text-white text-sm font-bold px-4 py-2 rounded-xl shadow-lg shadow-pink-900/50">
                  {fmt(memberDiscountedPrice)}
                </div>
                <div className="text-white/40 text-xs line-through pr-1">{fmt(generalPrice)}</div>
              </div>
            ) : generalPrice > 0 ? (
              ev.isLaunchEvent ? (
                <div className="text-right">
                  <div className="bg-pink-600/85 backdrop-blur-sm border border-pink-500/40 text-white text-sm font-bold px-4 py-2 rounded-xl shadow-lg shadow-pink-900/40">
                    {fmt(generalPrice)}
                  </div>
                  <div className="text-white/50 text-[10px] font-semibold mt-0.5 pr-0.5 tracking-wide">Founding Access</div>
                </div>
              ) : (
                <div className="bg-white/15 backdrop-blur-sm text-white text-sm font-bold px-4 py-2 rounded-xl border border-white/20">
                  {fmt(generalPrice)}
                </div>
              )
            ) : null}
          </div>}
        </div>
      )}

      <div className="p-4 sm:p-6 space-y-4">
        {/* No-image pricing row */}
        {!ev.imageUrl && (
          <div className="flex justify-between items-start gap-3 flex-wrap">
            <div className="flex gap-2 flex-wrap">
              {!isConfirmed && isCritical && (
                <span className="bg-red-900/60 border border-red-500/40 text-red-300 text-xs font-bold px-3 py-1.5 rounded-full animate-pulse">🔥 {ev.ticketsRemaining} Left</span>
              )}
              {!isConfirmed && !isCritical && isLow && (
                <span className="bg-amber-900/60 border border-amber-500/40 text-amber-300 text-xs font-bold px-3 py-1.5 rounded-full animate-pulse">⚡ Limited</span>
              )}
              {isConfirmed && (
                <span className="bg-emerald-900/60 border border-emerald-500/40 text-emerald-300 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Attending
                </span>
              )}
            </div>
            {isConfirmed ? (
              <span className="text-sm font-bold px-3 py-1.5 rounded-xl border bg-emerald-600/20 border-emerald-500/30 text-emerald-400">
                {fmt(userTicket.totalPrice)} paid
              </span>
            ) : !isSignedIn ? (
              <span className="text-sm font-bold px-3 py-1.5 rounded-xl border bg-emerald-600/20 border-emerald-500/30 text-emerald-400">FREE</span>
            ) : isMember && memberDiscountedPrice > 0 ? (
              <div className="text-right">
                <span className="text-sm font-bold px-3 py-1.5 rounded-xl border bg-pink-600/20 border-pink-500/30 text-pink-300">{fmt(memberDiscountedPrice)}</span>
                <div className="text-white/35 text-xs line-through mt-0.5">{fmt(generalPrice)}</div>
              </div>
            ) : generalPrice > 0 ? (
              <span className="text-sm font-bold px-3 py-1.5 rounded-xl border bg-white/10 border-white/15 text-white">{fmt(generalPrice)}</span>
            ) : null}
          </div>
        )}

        {/* Title */}
        <h2 className="text-xl md:text-2xl font-bold leading-tight">{ev.title}</h2>

        {/* Date + Location */}
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-white/50">
          {ev.date && (
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 shrink-0 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
              {formatDate(ev.date)}
            </span>
          )}
          {ev.location && (
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 shrink-0 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              {ev.location}
            </span>
          )}
        </div>

        {/* Member / savings callout — only when not confirmed */}
        {!isConfirmed && isSignedIn && generalPrice > 0 && savingsAmount > 0 && (
          isMember ? (
            <div className="flex items-center gap-2 bg-emerald-950/30 border border-emerald-500/20 rounded-xl px-4 py-2.5">
              <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
              </svg>
              <span className="text-emerald-300 text-sm font-medium">
                Member access unlocked — <span className="font-bold">{fmt(savingsAmount)}</span> saved
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-pink-950/30 border border-pink-500/20 rounded-xl px-4 py-2.5">
              <svg className="w-4 h-4 text-pink-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
              </svg>
              <span className="text-pink-300 text-sm">
                Unlock member pricing — save <span className="font-bold">{fmt(savingsAmount)}</span> with{" "}
                <Link href="/" className="underline hover:text-pink-200 transition">membership</Link>
              </span>
            </div>
          )
        )}

        {/* Capacity bar — hidden for completed events */}
        {ev.capacity > 0 && !isSoldOut && !isCompleted && (
          <UrgencyBar capacity={ev.capacity} remaining={ev.ticketsRemaining ?? ev.capacity} />
        )}

        {/* Description */}
        {ev.description && !ev.isLaunchEvent && (
          <p className="text-white/45 text-sm leading-relaxed border-t border-white/5 pt-4">{ev.description}</p>
        )}

        {/* Completed event summary — launch event public view */}
        {ev.isLaunchEvent && isCompleted && !isConfirmed && (
          <div className="border-t border-white/5 pt-4 grid grid-cols-2 gap-2">
            {[
              { label: "✔ Event Completed", sub: "June 30, 2026" },
              { label: "✔ Sold Out", sub: "15 of 15 attendees" },
              { label: "✔ Canada Life Centre", sub: "Sea Bears Courtside" },
              { label: "✔ Founding 15", sub: "Inaugural experience" },
            ].map((item) => (
              <div key={item.label} className="bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2.5">
                <p className="text-white/65 font-semibold text-xs">{item.label}</p>
                <p className="text-white/30 text-[10px] mt-0.5">{item.sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* Launch event: value stack + experience flow — only pre-event, not confirmed, not completed */}
        {ev.isLaunchEvent && !isConfirmed && !isCompleted && <FoundingValueStack />}
        {ev.isLaunchEvent && !isConfirmed && !isCompleted && <ExperienceFlow ticketsRemaining={ev.ticketsRemaining} />}

        {/* ── Action section ── */}
        <div className="pt-1 space-y-3">
          {isCompleted ? (
            isConfirmed ? (
              ev.isLaunchEvent
                ? <FoundingAttendedState ticket={userTicket} ev={ev} />
                : <GenericAttendedState ticket={userTicket} />
            ) : (
              <CompletedEventClosed />
            )
          ) : isConfirmed ? (
            /* ✅ Confirmed attendee — show confirmation state */
            ev.isLaunchEvent
              ? <FoundingConfirmedState ticket={userTicket} ev={ev} />
              : <GenericConfirmedState ticket={userTicket} ev={ev} />
          ) : isSoldOut ? (
            <div className="w-full text-center py-3 rounded-xl border border-white/10 text-white/25 text-sm font-medium cursor-not-allowed">
              Sold Out
            </div>
          ) : !isSignedIn ? (
            <SignInGate isLaunchEvent={ev.isLaunchEvent} />
          ) : (
            <>
              {/* Quantity selector */}
              <div className="flex items-center justify-between bg-black/30 border border-white/10 rounded-xl px-4 py-3 gap-3">
                <span className="text-sm text-white/50 shrink-0">Qty</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    disabled={qty <= 1}
                    className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 disabled:opacity-20 text-white font-bold text-xl flex items-center justify-center transition select-none"
                    aria-label="Decrease"
                  >−</button>
                  <span className="w-8 text-center font-bold text-lg tabular-nums">{qty}</span>
                  <button
                    onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                    disabled={qty >= maxQty}
                    className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 disabled:opacity-20 text-white font-bold text-xl flex items-center justify-center transition select-none"
                    aria-label="Increase"
                  >+</button>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-white font-bold text-lg tabular-nums">{fmt(totalPrice)}</div>
                  {ev.isLaunchEvent ? (
                    <div className="text-pink-400/70 text-xs font-semibold">Founding Access</div>
                  ) : qty > 1 ? (
                    <div className="text-white/30 text-xs">
                      {fmt(displayPrice)} × {qty}
                      {isMember && <span className="text-emerald-400/60 ml-1">· 15% off</span>}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* CTA button */}
              <button
                onClick={handleGetTickets}
                disabled={checkoutLoading}
                className="w-full bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 active:from-pink-700 active:to-rose-700 disabled:opacity-50 disabled:cursor-not-allowed py-4 rounded-xl font-bold text-base transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-pink-900/30 hover:shadow-pink-900/50 hover:-translate-y-0.5"
              >
                {checkoutLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Redirecting…</span>
                  </>
                ) : (
                  <>
                    <span>
                      {ev.isLaunchEvent
                        ? `Claim Founding Access — ${fmt(totalPrice)}`
                        : `Reserve Spot — ${fmt(totalPrice)}`}
                    </span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7"/>
                    </svg>
                  </>
                )}
              </button>

              {checkoutError && (
                <div className="bg-red-950/40 border border-red-800/50 rounded-lg px-3 py-2.5 space-y-1.5">
                  <p className="text-red-400 text-xs flex items-start gap-2">
                    <span className="shrink-0 mt-0.5">⚠</span>
                    <span>{checkoutError}</span>
                  </p>
                  <button
                    onClick={() => { setCheckoutError(null); handleGetTickets(); }}
                    className="text-red-300 text-xs underline hover:text-red-200 transition pl-5"
                  >
                    Try again →
                  </button>
                </div>
              )}

              <p className="text-center text-white/20 text-xs flex items-center justify-center gap-1.5">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                </svg>
                Secure checkout via Stripe
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Toast ────────────────────────────────────────────────────────────────────
function Toast({ type, message, onClose }: { type: "success" | "cancel"; message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border text-sm font-medium whitespace-nowrap ${
      type === "success" ? "bg-green-950 border-green-700/50 text-green-300" : "bg-white/10 border-white/20 text-white/60"
    }`}>
      <span>{type === "success" ? "✅" : "↩️"}</span>
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 opacity-50 hover:opacity-100 transition text-lg leading-none">×</button>
    </div>
  );
}

// ── EventsList (root) ────────────────────────────────────────────────────────
export default function EventsList() {
  const { user, isActive, isAdmin, loading: authLoading } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "cancel"; message: string } | null>(null);
  const [ticketsByEventId, setTicketsByEventId] = useState<Record<string, EventPurchase>>({});
  const [ticketFetchKey, setTicketFetchKey] = useState(0);

  // Handle ?order=success / ?order=cancel query params
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const order = params.get("order");
    if (order === "success") {
      setToast({ type: "success", message: "Payment confirmed! Your ticket is secured — check your email." });
      window.history.replaceState({}, "", window.location.pathname);
      // Re-fetch tickets after a delay to catch webhook-confirmed order
      setTimeout(() => setTicketFetchKey((k) => k + 1), 3000);
    } else if (order === "cancel") {
      setToast({ type: "cancel", message: "Checkout cancelled — your spot is still available." });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Fetch events
  useEffect(() => {
    if (authLoading) return;
    getDocs(query(collection(db, "events"), orderBy("date", "asc")))
      .then((snap) => {
        const all = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Event))
          .filter((ev) => ev.status !== "draft");
        all.sort((a, b) => {
          // Completed events sort after all upcoming events
          const aCompleted = a.status === "completed";
          const bCompleted = b.status === "completed";
          if (!aCompleted && bCompleted) return -1;
          if (aCompleted && !bCompleted) return 1;
          if (a.isLaunchEvent && !b.isLaunchEvent) return -1;
          if (!a.isLaunchEvent && b.isLaunchEvent) return 1;
          if (a.featured && !b.featured) return -1;
          if (!a.featured && b.featured) return 1;
          if (a.status === "coming_soon" && b.status !== "coming_soon") return 1;
          if (a.status !== "coming_soon" && b.status === "coming_soon") return -1;
          return (a.date ?? "").localeCompare(b.date ?? "");
        });
        setEvents(all);
      })
      .catch((err) => {
        console.error("Events fetch failed:", err.code, err.message);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [authLoading]);

  // Fetch user's confirmed event purchases (ownership registry)
  // Primary query: by userId. Email fallback: catches edge cases where
  // userId was null at write time (e.g. auth timing issues).
  useEffect(() => {
    if (authLoading) return;
    if (!user?.uid) {
      setTicketsByEventId({});
      return;
    }

    const fetchOwnership = async () => {
      const byEvent: Record<string, EventPurchase> = {};

      // Primary: query by userId (fast path — covers 99% of cases)
      const primarySnap = await getDocs(
        query(collection(db, "eventPurchases"), where("userId", "==", user.uid))
      );
      primarySnap.docs.forEach((d) => {
        const data = d.data() as Omit<EventPurchase, "id">;
        if (data.eventId && data.status === "confirmed") {
          byEvent[data.eventId] = { id: d.id, ...data };
        }
      });

      // Email fallback: if nothing found by uid and user has email,
      // try matching by email (covers records where userId was null at write time)
      if (Object.keys(byEvent).length === 0 && user.email) {
        const emailSnap = await getDocs(
          query(
            collection(db, "eventPurchases"),
            where("userEmail", "==", user.email)
          )
        );
        emailSnap.docs.forEach((d) => {
          const data = d.data() as Omit<EventPurchase, "id">;
          if (data.eventId && data.status === "confirmed" && !byEvent[data.eventId]) {
            byEvent[data.eventId] = { id: d.id, ...data };
          }
        });
      }

      setTicketsByEventId(byEvent);
    };

    fetchOwnership().catch((err) => {
      // Non-fatal — page still works, just won't show confirmed state
      console.error("eventPurchases fetch failed:", err);
    });
  }, [authLoading, user?.uid, user?.email, ticketFetchKey]);

  if (loading || authLoading) return (
    <div className="space-y-6">
      {[1, 2].map((i) => <div key={i} className="bg-white/5 border border-white/10 rounded-2xl h-80 animate-pulse" />)}
    </div>
  );

  if (error) return (
    <div className="text-center py-16">
      <p className="text-white/40">Couldn&apos;t load events. Please refresh.</p>
    </div>
  );

  if (events.length === 0) return (
    <div className="text-center py-24 space-y-3">
      <p className="text-5xl">🎉</p>
      <p className="text-white font-semibold text-lg">Events dropping soon.</p>
      <p className="text-white/30 text-sm">Stay tuned — something big is coming.</p>
    </div>
  );

  const isSignedIn = !!user;
  const isMember = isActive || isAdmin;

  return (
    <>
      <div className="space-y-6">
        {events.map((ev) =>
          ev.status === "coming_soon"
            ? <FutureDropCard key={ev.id} ev={ev} />
            : ev.type === "concert" && ev.status !== "completed"
            ? <FeaturedConcertCard key={ev.id} ev={ev} />
            : (
              <EventCard
                key={ev.id}
                ev={ev}
                isSignedIn={isSignedIn}
                isMember={isMember}
                uid={user?.uid}
                userEmail={user?.email ?? undefined}
                userTicket={ticketsByEventId[ev.id] ?? null}
              />
            )
        )}
      </div>
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </>
  );
}
