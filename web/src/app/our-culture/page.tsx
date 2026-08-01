"use client";

import { useState } from "react";
import Link from "next/link";
import type { CultureCategory, GuestNomination } from "@/lib/culture-types";

const CATEGORIES: CultureCategory[] = [
  "Music", "Business", "Sports", "Fashion", "Food", "Community",
  "Media", "Art", "Entrepreneurship", "Non-Profit", "Leadership",
  "Culture", "Youth", "Wellness", "Technology",
];

const EMPTY_FORM: GuestNomination = {
  yourName: "",
  yourEmail: "",
  nomineeName: "",
  nomineeRole: "",
  nomineeOrganization: "",
  socialLinks: "",
  whyFeature: "",
  winnipegImpact: "",
  nomineeContact: "",
  category: "",
  notes: "",
};

function NominationForm() {
  const [form, setForm] = useState<GuestNomination>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (field: keyof GuestNomination, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/nominate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setSubmitted(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center py-12 space-y-4">
        <div className="w-14 h-14 rounded-full bg-pink-500/15 border border-pink-500/30 flex items-center justify-center mx-auto text-2xl">
          ✓
        </div>
        <h3 className="text-xl font-black text-white">Nomination received.</h3>
        <p className="text-white/50 text-sm max-w-sm mx-auto leading-relaxed">
          Thank you for nominating someone worth documenting. We review every submission and reach out when the timing is right.
        </p>
        <button
          onClick={() => { setSubmitted(false); setForm(EMPTY_FORM); }}
          className="text-pink-400 text-sm underline hover:text-pink-300 transition"
        >
          Submit another nomination
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-white/50 text-xs font-bold uppercase tracking-wider">Your Name *</label>
          <input
            required
            value={form.yourName}
            onChange={(e) => set("yourName", e.target.value)}
            placeholder="Your full name"
            className="w-full bg-white/5 border border-white/10 focus:border-pink-500/50 focus:outline-none text-white placeholder-white/20 text-sm px-4 py-3 rounded-xl transition"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-white/50 text-xs font-bold uppercase tracking-wider">Your Email *</label>
          <input
            required
            type="email"
            value={form.yourEmail}
            onChange={(e) => set("yourEmail", e.target.value)}
            placeholder="your@email.com"
            className="w-full bg-white/5 border border-white/10 focus:border-pink-500/50 focus:outline-none text-white placeholder-white/20 text-sm px-4 py-3 rounded-xl transition"
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-white/50 text-xs font-bold uppercase tracking-wider">Nominee Name *</label>
          <input
            required
            value={form.nomineeName}
            onChange={(e) => set("nomineeName", e.target.value)}
            placeholder="Who are you nominating?"
            className="w-full bg-white/5 border border-white/10 focus:border-pink-500/50 focus:outline-none text-white placeholder-white/20 text-sm px-4 py-3 rounded-xl transition"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-white/50 text-xs font-bold uppercase tracking-wider">Their Role *</label>
          <input
            required
            value={form.nomineeRole}
            onChange={(e) => set("nomineeRole", e.target.value)}
            placeholder="Artist, entrepreneur, athlete…"
            className="w-full bg-white/5 border border-white/10 focus:border-pink-500/50 focus:outline-none text-white placeholder-white/20 text-sm px-4 py-3 rounded-xl transition"
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-white/50 text-xs font-bold uppercase tracking-wider">Business / Brand / Organization</label>
          <input
            value={form.nomineeOrganization}
            onChange={(e) => set("nomineeOrganization", e.target.value)}
            placeholder="Optional"
            className="w-full bg-white/5 border border-white/10 focus:border-pink-500/50 focus:outline-none text-white placeholder-white/20 text-sm px-4 py-3 rounded-xl transition"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-white/50 text-xs font-bold uppercase tracking-wider">Category</label>
          <select
            value={form.category}
            onChange={(e) => set("category", e.target.value)}
            className="w-full bg-[#0e0a1a] border border-white/10 focus:border-pink-500/50 focus:outline-none text-white/80 text-sm px-4 py-3 rounded-xl transition"
          >
            <option value="">Select a category</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-white/50 text-xs font-bold uppercase tracking-wider">Social Media Links</label>
        <input
          value={form.socialLinks}
          onChange={(e) => set("socialLinks", e.target.value)}
          placeholder="Instagram, TikTok, website… (optional)"
          className="w-full bg-white/5 border border-white/10 focus:border-pink-500/50 focus:outline-none text-white placeholder-white/20 text-sm px-4 py-3 rounded-xl transition"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-white/50 text-xs font-bold uppercase tracking-wider">Why should they be featured? *</label>
        <textarea
          required
          rows={4}
          value={form.whyFeature}
          onChange={(e) => set("whyFeature", e.target.value)}
          placeholder="Tell us their story and why it deserves to be documented."
          className="w-full bg-white/5 border border-white/10 focus:border-pink-500/50 focus:outline-none text-white placeholder-white/20 text-sm px-4 py-3 rounded-xl transition resize-none"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-white/50 text-xs font-bold uppercase tracking-wider">Their impact on Winnipeg *</label>
        <textarea
          required
          rows={3}
          value={form.winnipegImpact}
          onChange={(e) => set("winnipegImpact", e.target.value)}
          placeholder="How have they contributed to the city?"
          className="w-full bg-white/5 border border-white/10 focus:border-pink-500/50 focus:outline-none text-white placeholder-white/20 text-sm px-4 py-3 rounded-xl transition resize-none"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-white/50 text-xs font-bold uppercase tracking-wider">Their Contact (if known)</label>
          <input
            value={form.nomineeContact}
            onChange={(e) => set("nomineeContact", e.target.value)}
            placeholder="Email or phone (optional)"
            className="w-full bg-white/5 border border-white/10 focus:border-pink-500/50 focus:outline-none text-white placeholder-white/20 text-sm px-4 py-3 rounded-xl transition"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-white/50 text-xs font-bold uppercase tracking-wider">Anything else?</label>
          <input
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Additional context (optional)"
            className="w-full bg-white/5 border border-white/10 focus:border-pink-500/50 focus:outline-none text-white placeholder-white/20 text-sm px-4 py-3 rounded-xl transition"
          />
        </div>
      </div>

      {error && (
        <p className="text-red-400 text-sm flex items-center gap-2">
          <span>⚠</span> {error}
        </p>
      )}

      <p className="text-white/25 text-xs">
        Nomination does not guarantee an invitation. We review every submission carefully.
      </p>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-pink-600 hover:bg-pink-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-4 rounded-xl transition flex items-center justify-center gap-2"
      >
        {loading ? (
          <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting…</>
        ) : (
          "Submit Nomination →"
        )}
      </button>
    </form>
  );
}

export default function OurCulturePage() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  return (
    <main className="bg-black text-white min-h-screen">
      <style>{`
        @keyframes oc-fade-up {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .oc-fade { animation: oc-fade-up 0.7s ease both; }
        .oc-fade-2 { animation: oc-fade-up 0.7s ease 0.15s both; }
        .oc-fade-3 { animation: oc-fade-up 0.7s ease 0.3s both; }
      `}</style>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[80vh] flex flex-col justify-end overflow-hidden bg-[#080608]">
        {/* Background texture */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-pink-950/20 via-black to-black" />
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-pink-900/10 blur-[120px]" />
          <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] rounded-full bg-purple-900/8 blur-[100px]" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pb-16 pt-28 w-full">
          <div className="max-w-3xl space-y-6">
            <div className="oc-fade flex flex-wrap items-center gap-3">
              <span className="text-white/20 text-xs font-black uppercase tracking-[0.25em]">
                ALL ACCESS Winnipeg
              </span>
              <span className="text-white/10">·</span>
              <span className="bg-pink-600/20 border border-pink-500/30 text-pink-400 text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest">
                Our Culture
              </span>
            </div>

            <h1 className="oc-fade-2 text-5xl sm:text-6xl md:text-7xl font-black leading-none tracking-tight">
              Stories behind the people<br />
              <span className="text-pink-500">shaping Winnipeg.</span>
            </h1>

            <p className="oc-fade-3 text-white/50 text-lg sm:text-xl leading-relaxed max-w-xl">
              Honest couch conversations with artists, entrepreneurs, athletes, creators, business owners, and community leaders.
            </p>

            <div className="oc-fade-3 flex flex-col sm:flex-row gap-3 pt-2">
              <a
                href="#nominate"
                className="bg-pink-600 hover:bg-pink-500 text-white font-black px-8 py-4 rounded-xl text-base transition text-center"
              >
                Nominate a Guest
              </a>
              <a
                href="#the-couch"
                className="border border-white/15 hover:border-white/30 text-white/60 hover:text-white font-semibold px-8 py-4 rounded-xl text-base transition text-center"
              >
                Learn About The Couch ↓
              </a>
            </div>
          </div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black to-transparent pointer-events-none" />
      </section>

      {/* ── THE COUCH ────────────────────────────────────────────────────── */}
      <section id="the-couch" className="bg-black py-20 sm:py-28">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-center">
            {/* Left: visual placeholder */}
            <div className="relative rounded-3xl overflow-hidden bg-[#0e0a12] border border-white/8 aspect-[4/3] flex flex-col items-center justify-center gap-4">
              <div className="absolute inset-0 bg-gradient-to-br from-pink-950/20 to-purple-950/10" />
              <div className="relative z-10 text-center space-y-3 px-8">
                <p className="text-white/15 text-xs font-black uppercase tracking-[0.3em]">The Couch</p>
                <p className="text-white/25 text-sm leading-relaxed">
                  Set photography and production stills will appear here once production begins.
                </p>
                <div className="flex items-center justify-center gap-2 pt-2">
                  <div className="w-8 h-1 rounded-full bg-pink-500/30" />
                  <div className="w-3 h-1 rounded-full bg-pink-500/15" />
                  <div className="w-3 h-1 rounded-full bg-pink-500/15" />
                </div>
              </div>
            </div>

            {/* Right: copy */}
            <div className="space-y-6">
              <div>
                <p className="text-pink-500/70 text-xs font-black uppercase tracking-[0.25em] mb-3">The Flagship Series</p>
                <h2 className="text-4xl sm:text-5xl font-black leading-tight">The Couch.</h2>
              </div>
              <div className="space-y-4 text-white/55 text-base leading-relaxed">
                <p>
                  The Couch is where Winnipeg&apos;s stories slow down.
                </p>
                <p>
                  Invited guests sit with ALL ACCESS for honest conversations about the beginning, the journey, the person behind the work, the future, and the city that shaped them.
                </p>
                <p>
                  This is not a press run. It is not a scripted promotional interview.
                </p>
                <p className="text-white/80 font-semibold">
                  It is a real conversation.
                </p>
              </div>
              <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-5 space-y-2">
                <p className="text-white/30 text-xs font-black uppercase tracking-wider">Each conversation covers</p>
                {["The Beginning", "The Journey", "The Person", "The Business or Craft", "The Future", "Winnipeg"].map((part) => (
                  <div key={part} className="flex items-center gap-3 text-sm text-white/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-pink-500/60 shrink-0" />
                    {part}
                  </div>
                ))}
              </div>
              <p className="text-white/35 text-sm italic leading-relaxed">
                &ldquo;Getting invited to The Couch should feel like being recognized as part of the culture.&rdquo;
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── COMING SOON / EMPTY STATE ────────────────────────────────────── */}
      <section className="bg-[#050505] py-20 sm:py-28 border-t border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-16">
          <div className="text-center space-y-3">
            <p className="text-pink-500/60 text-xs font-black uppercase tracking-[0.25em]">The Conversations</p>
            <h2 className="text-3xl sm:text-4xl font-black">First conversations coming.</h2>
            <p className="text-white/40 text-base max-w-lg mx-auto leading-relaxed">
              We are inviting artists, entrepreneurs, athletes, creators, business owners, and community leaders whose work deserves to be documented.
            </p>
          </div>

          {/* Placeholder cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white/[0.02] border border-white/6 rounded-2xl overflow-hidden"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className="aspect-[4/3] bg-white/[0.02] flex items-center justify-center">
                  <div className="text-center space-y-2">
                    <div className="w-10 h-10 rounded-full bg-white/5 mx-auto flex items-center justify-center">
                      <svg className="w-5 h-5 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <p className="text-white/15 text-xs">Guest TBA</p>
                  </div>
                </div>
                <div className="p-4 space-y-2">
                  <div className="h-3 w-24 bg-white/5 rounded-full" />
                  <div className="h-2 w-40 bg-white/[0.03] rounded-full" />
                  <div className="h-2 w-32 bg-white/[0.03] rounded-full" />
                </div>
              </div>
            ))}
          </div>

          <div className="text-center">
            <a
              href="#nominate"
              className="inline-flex items-center gap-2 bg-pink-600 hover:bg-pink-500 text-white font-black px-8 py-4 rounded-xl transition"
            >
              Nominate Someone for the First Episode
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* ── WHAT IS OUR CULTURE ──────────────────────────────────────────── */}
      <section className="bg-black py-20 sm:py-28 border-t border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-14">
          <div className="text-center space-y-3">
            <p className="text-pink-500/60 text-xs font-black uppercase tracking-[0.25em]">The Mission</p>
            <h2 className="text-3xl sm:text-4xl font-black max-w-2xl mx-auto leading-tight">
              Documenting the people building Winnipeg.
            </h2>
            <p className="text-white/40 text-base max-w-xl mx-auto leading-relaxed">
              Every artist, entrepreneur, athlete, creator, business owner, and community leader has a story worth preserving.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: "🎵", title: "Musicians & Artists", desc: "The creative voices shaping Winnipeg's sound and visual culture." },
              { icon: "🏀", title: "Athletes & Coaches", desc: "From local courts to national stages — their journey and discipline." },
              { icon: "🏢", title: "Entrepreneurs", desc: "The builders, founders, and business owners driving the local economy." },
              { icon: "📸", title: "Creators & Photographers", desc: "The visual storytellers documenting the city as it evolves." },
              { icon: "🤝", title: "Community Leaders", desc: "Non-profit founders, organizers, and public figures driving real change." },
              { icon: "✨", title: "People With Important Stories", desc: "Sometimes the most valuable stories come from unexpected places." },
            ].map((item) => (
              <div key={item.title} className="bg-white/[0.03] border border-white/8 rounded-2xl p-5 space-y-3 hover:border-pink-500/20 hover:bg-pink-950/5 transition">
                <span className="text-2xl">{item.icon}</span>
                <h3 className="font-bold text-white text-sm">{item.title}</h3>
                <p className="text-white/40 text-xs leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BROWSE BY CATEGORY ───────────────────────────────────────────── */}
      <section className="bg-[#050505] py-16 border-t border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="text-center space-y-2">
            <p className="text-pink-500/60 text-xs font-black uppercase tracking-[0.25em]">Browse by Category</p>
            <p className="text-white/30 text-sm">Categories will activate as conversations are published.</p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                className={`px-4 py-2 rounded-full text-xs font-bold border transition ${
                  activeCategory === cat
                    ? "bg-pink-600 border-pink-500 text-white"
                    : "bg-white/[0.03] border-white/10 text-white/40 hover:border-white/20 hover:text-white/60"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          {activeCategory && (
            <div className="text-center">
              <p className="text-white/30 text-sm">
                No <span className="text-white/60">{activeCategory}</span> conversations published yet.{" "}
                <a href="#nominate" className="text-pink-400 underline hover:text-pink-300 transition">Nominate someone.</a>
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section className="bg-black py-20 sm:py-28 border-t border-white/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-12">
          <div className="text-center space-y-2">
            <p className="text-pink-500/60 text-xs font-black uppercase tracking-[0.25em]">How It Works</p>
            <h2 className="text-3xl font-black">A conversation, not an interview.</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            {[
              { num: "01", title: "Guests are invited", desc: "We identify and reach out to people whose stories deserve to be documented. Public nominations are also reviewed." },
              { num: "02", title: "Pre-interview process", desc: "Guests complete a brief intake where they share topics they want covered, things to avoid, and current projects." },
              { num: "03", title: "The Couch conversation", desc: "An honest, unhurried conversation covering the beginning, the journey, the person, the craft, the future, and Winnipeg." },
              { num: "04", title: "Content across platforms", desc: "Full episode, clips, quote graphics, written profile, and more — all reviewed and approved before publishing." },
            ].map((step) => (
              <div key={step.num} className="flex gap-5">
                <span className="text-pink-500/40 font-black text-3xl shrink-0 leading-none">{step.num}</span>
                <div className="space-y-1.5">
                  <h3 className="font-bold text-white text-sm">{step.title}</h3>
                  <p className="text-white/40 text-xs leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── NOMINATE A GUEST ─────────────────────────────────────────────── */}
      <section id="nominate" className="bg-[#050505] py-20 sm:py-28 border-t border-white/5">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 space-y-10">
          <div className="text-center space-y-3">
            <p className="text-pink-500/60 text-xs font-black uppercase tracking-[0.25em]">Nominate a Guest</p>
            <h2 className="text-3xl font-black">Know someone whose story belongs on The Couch?</h2>
            <p className="text-white/40 text-sm leading-relaxed">
              Tell us about them. We review every nomination personally.
            </p>
          </div>
          <div className="bg-white/[0.02] border border-white/8 rounded-2xl p-6 sm:p-8">
            <NominationForm />
          </div>
        </div>
      </section>

      {/* ── PARTNER WITH OUR CULTURE ─────────────────────────────────────── */}
      <section className="bg-black py-20 sm:py-24 border-t border-white/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="bg-gradient-to-br from-pink-950/30 via-black to-purple-950/20 border border-white/8 rounded-3xl p-10 sm:p-14 text-center space-y-6">
            <div className="space-y-3">
              <p className="text-pink-400/60 text-xs font-black uppercase tracking-[0.25em]">Partner With OUR CULTURE</p>
              <h2 className="text-3xl sm:text-4xl font-black leading-tight">
                Be part of documenting<br />Winnipeg&apos;s story.
              </h2>
              <p className="text-white/45 text-base max-w-lg mx-auto leading-relaxed">
                Support the conversations, set production, and platform that will document Winnipeg&apos;s cultural leaders for years to come.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-white/30">
              {["Episode Sponsor", "Season Sponsor", "Set Partner", "Beverage Partner", "Venue Partner", "Production Partner"].map((t) => (
                <span key={t} className="bg-white/5 border border-white/8 px-3 py-1.5 rounded-full">{t}</span>
              ))}
            </div>
            <a
              href="mailto:hello@allaccesswinnipeg.ca?subject=OUR CULTURE Partnership Inquiry"
              className="inline-flex items-center gap-2 bg-pink-600 hover:bg-pink-500 text-white font-black px-8 py-4 rounded-xl transition"
            >
              Partner With OUR CULTURE
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </a>
            <p className="text-white/20 text-xs">
              Inquiries: <a href="mailto:hello@allaccesswinnipeg.ca" className="underline hover:text-white/40 transition">hello@allaccesswinnipeg.ca</a>
            </p>
          </div>
        </div>
      </section>

      {/* ── WHAT OUR CULTURE IS ──────────────────────────────────────────── */}
      <section className="bg-[#050505] py-16 border-t border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="grid sm:grid-cols-4 gap-6 text-center sm:text-left">
            {[
              { label: "Events", desc: "The experiences.", href: "/events" },
              { label: "Sessions", desc: "Smaller curated gatherings.", href: "/series/sunset-sessions" },
              { label: "Memories", desc: "The visual archive.", href: "/memories" },
              { label: "Our Culture", desc: "The conversations and stories.", href: "/our-culture", active: true },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`group space-y-1 p-4 rounded-xl border transition ${
                  item.active
                    ? "border-pink-500/30 bg-pink-950/10"
                    : "border-white/5 hover:border-white/10 bg-transparent"
                }`}
              >
                <p className={`font-black text-sm ${item.active ? "text-pink-400" : "text-white/60 group-hover:text-white/80 transition"}`}>
                  {item.label}
                </p>
                <p className="text-white/30 text-xs">{item.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
