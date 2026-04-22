"use client";

import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="overflow-hidden">

      {/* ── HERO ──────────────────────────────────────────────── */}
      <section className="relative min-h-[80vh] flex flex-col items-center justify-center text-center px-6 pt-24 pb-32">
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-pink-600/8 rounded-full blur-[120px]" />
          <div className="absolute top-1/3 left-1/3 w-[300px] h-[300px] bg-purple-600/6 rounded-full blur-[100px]" />
        </div>

        <div className="relative space-y-8 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2.5 border border-white/10 rounded-full px-5 py-2 text-xs text-white/30 font-semibold uppercase tracking-[0.2em]">
            <span className="w-1 h-1 bg-pink-400 rounded-full" />
            Our Story
          </div>

          <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.0] text-white">
            Built for<br />
            <em className="not-italic text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-rose-500">
              connection.
            </em>
          </h1>

          <p className="text-xl md:text-2xl text-white/35 font-light leading-relaxed max-w-2xl mx-auto tracking-wide">
            Designed with intention.
          </p>

          <p className="text-base text-white/40 leading-relaxed max-w-lg mx-auto pt-4">
            ALL ACCESS is a Winnipeg-based non-profit bringing people together
            through real shared experiences — events, relationships, and belonging.
          </p>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-20">
          <div className="w-px h-12 bg-gradient-to-b from-transparent to-white" />
        </div>
      </section>

      {/* ── WHO WE ARE ────────────────────────────────────────── */}
      <section className="px-6 py-24 max-w-6xl mx-auto">
        <div className="grid md:grid-cols-[1fr_2fr] gap-16 md:gap-24 items-start">

          {/* Label column */}
          <div className="space-y-6 md:pt-3">
            <div className="w-8 h-px bg-pink-500" />
            <p className="text-xs text-white/20 uppercase tracking-[0.25em] font-semibold">Who We Are</p>
            <div className="grid grid-cols-2 gap-3 pt-4">
              {[
                { number: "4", label: "Events\nthis summer" },
                { number: "6+", label: "Community\nperks" },
                { number: "WPG", label: "100%\nWinnipeg" },
                { number: "'26", label: "Founded\nwith purpose" },
              ].map((item) => (
                <div key={item.label} className="space-y-1 py-4 border-t border-white/8">
                  <p className="text-2xl font-bold text-pink-400">{item.number}</p>
                  <p className="text-white/25 text-xs leading-relaxed whitespace-pre-line">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Copy column */}
          <div className="space-y-8">
            <h2 className="text-4xl md:text-5xl font-bold leading-tight tracking-tight">
              A non-profit rooted in<br />
              <span className="text-pink-400">community first.</span>
            </h2>
            <div className="space-y-5 text-white/45 text-lg leading-relaxed font-light">
              <p>
                ALL ACCESS Winnipeg is a registered non-profit organization dedicated to creating
                safe, engaging, and accessible experiences for youth and young adults across our city.
              </p>
              <p>
                We believe connection is the foundation of well-being — and we build the spaces where
                that connection happens. Every event we host is a deliberate act of community care.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── MISSION ───────────────────────────────────────────── */}
      <section className="relative px-6 py-28 overflow-hidden">
        {/* Full-bleed background */}
        <div className="absolute inset-0 bg-gradient-to-br from-pink-950/20 via-[#0e0a1a] to-purple-950/15" />
        <div className="absolute inset-0 border-y border-white/5" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-pink-500/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-pink-500/20 to-transparent" />

        <div className="relative max-w-4xl mx-auto text-center space-y-10">
          <p className="text-xs text-pink-400/40 uppercase tracking-[0.3em] font-semibold">Our Mission</p>

          <blockquote className="text-2xl md:text-3xl lg:text-4xl font-light leading-relaxed text-white/70 tracking-wide">
            &ldquo;To create safe, engaging, and accessible experiences for youth and young adults —
            fostering{" "}
            <span className="text-white font-medium">social connection</span>,{" "}
            <span className="text-white font-medium">mental well-being</span>, and{" "}
            <span className="text-white font-medium">cultural growth</span>{" "}
            across Winnipeg.&rdquo;
          </blockquote>

          <div className="flex flex-wrap gap-3 justify-center pt-4">
            {["Social Connection", "Mental Well-being", "Youth Engagement", "Cultural Experiences", "Accessibility"].map((tag) => (
              <span
                key={tag}
                className="border border-white/8 rounded-full px-5 py-2 text-white/25 text-xs font-medium tracking-wide"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHAT WE CREATE ────────────────────────────────────── */}
      <section className="px-6 py-24 max-w-6xl mx-auto space-y-16">
        <div className="space-y-4">
          <div className="w-8 h-px bg-pink-500" />
          <p className="text-xs text-white/20 uppercase tracking-[0.25em] font-semibold">What We Create</p>
          <h2 className="text-4xl md:text-5xl font-bold leading-tight tracking-tight">
            Four pillars of experience.
          </h2>
        </div>

        {/* Horizontal rule cards — not grid tiles */}
        <div className="divide-y divide-white/8">
          {[
            {
              num: "01",
              icon: "🎉",
              title: "Community Events",
              desc: "Social nights, fundraisers, cultural experiences, and sports gatherings — open to all Winnipeggers. Members save on every ticket.",
            },
            {
              num: "02",
              icon: "🤝",
              title: "Real Relationships",
              desc: "A growing network of people who show up, support each other, and build something meaningful together across the city.",
            },
            {
              num: "03",
              icon: "🎁",
              title: "Partner Perks",
              desc: "Local restaurant and business discounts as a thank-you to members who choose to support the community financially.",
            },
            {
              num: "04",
              icon: "💬",
              title: "Community Voice",
              desc: "A members-only feed where the community can connect, share, and stay engaged between events.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="grid md:grid-cols-[80px_1fr_1fr] gap-6 py-8 group hover:bg-white/[0.015] transition-colors px-2 -mx-2 rounded-xl"
            >
              <span className="text-white/15 font-bold text-sm tracking-widest self-start pt-1">{item.num}</span>
              <div className="space-y-1">
                <span className="text-2xl">{item.icon}</span>
                <h3 className="font-bold text-xl group-hover:text-pink-400 transition-colors">{item.title}</h3>
              </div>
              <p className="text-white/35 text-base leading-relaxed font-light self-center">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── WHY IT MATTERS ────────────────────────────────────── */}
      <section className="relative px-6 py-24 overflow-hidden">
        <div className="absolute right-0 top-0 w-[500px] h-[500px] bg-pink-600/5 rounded-full blur-[150px] pointer-events-none" />
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 md:gap-24 items-center relative">

          <div className="space-y-5">
            <div className="w-8 h-px bg-pink-500" />
            <p className="text-xs text-white/20 uppercase tracking-[0.25em] font-semibold">Why It Matters</p>
            <h2 className="text-4xl md:text-5xl font-bold leading-tight tracking-tight">
              Connection is<br />
              <span className="text-pink-400">the mission.</span>
            </h2>
          </div>

          <div className="space-y-6 text-white/40 text-lg leading-relaxed font-light">
            <p>
              Loneliness is a public health crisis. Young adults in Winnipeg are craving spaces that
              feel authentic — where showing up is easy and connection is guaranteed.
            </p>
            <p>
              ALL ACCESS was built as the answer. Every event we host, every perk we
              offer, every post in our community feed — all in service of one goal:
              getting people together.
            </p>
            <p>
              Membership is optional but meaningful. When you subscribe, you&apos;re not just
              getting discounts — you&apos;re funding the next event, the next connection,
              the next moment that matters.
            </p>
          </div>
        </div>
      </section>

      {/* ── LEADERSHIP ────────────────────────────────────────── */}
      <section className="px-6 py-24 max-w-6xl mx-auto space-y-20">
        <div className="space-y-4">
          <div className="w-8 h-px bg-pink-500" />
          <p className="text-xs text-white/20 uppercase tracking-[0.25em] font-semibold">Leadership</p>
          <h2 className="text-4xl md:text-5xl font-bold leading-tight tracking-tight">
            The people behind it.
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-1">
          {[
            {
              initials: "CB",
              name: "Charles Bendu",
              role: "Founder",
              bio: "Lifelong Winnipegger and community builder. Charles created ALL ACCESS to give young people a platform for real connection and shared experience — built on the belief that community is infrastructure.",
              accent: "from-pink-600/30 to-rose-700/20",
            },
            {
              initials: "T",
              name: "Teniola",
              role: "Co-Founder",
              bio: "Cultural organizer and event architect. Teniola brings the vision for inclusive, high-energy experiences that bring people together across backgrounds — turning an idea into a movement.",
              accent: "from-purple-600/30 to-pink-700/20",
            },
          ].map((person, i) => (
            <div
              key={person.name}
              className={`relative group p-10 md:p-14 space-y-8 overflow-hidden border-white/5 ${i === 0 ? "border-r" : ""} border-b md:border-b-0 hover:bg-white/[0.02] transition-colors`}
            >
              {/* Ambient gradient */}
              <div className={`absolute top-0 ${i === 0 ? "right-0" : "left-0"} w-48 h-48 bg-gradient-to-br ${person.accent} rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none`} />

              <div className="relative flex items-center gap-5">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-600/20 to-purple-600/20 border border-pink-500/20 flex items-center justify-center shrink-0">
                  <span className="text-pink-300 font-bold text-base tracking-wide">{person.initials}</span>
                </div>
                <div>
                  <p className="font-bold text-xl tracking-tight">{person.name}</p>
                  <p className="text-pink-400/70 text-sm font-semibold tracking-wider uppercase mt-0.5">{person.role}</p>
                </div>
              </div>

              <p className="relative text-white/35 text-lg leading-relaxed font-light">{person.bio}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────── */}
      <section className="relative px-6 py-32 text-center overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-pink-950/10 to-transparent" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-pink-600/6 rounded-full blur-[100px]" />
        </div>

        <div className="relative max-w-3xl mx-auto space-y-8">
          <p className="text-xs text-white/20 uppercase tracking-[0.3em] font-semibold">Join the Community</p>

          <h2 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-tight">
            Winnipeg&apos;s community<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-rose-500">
              is waiting.
            </span>
          </h2>

          <p className="text-white/30 text-lg max-w-md mx-auto leading-relaxed font-light">
            Events are open to everyone. Membership is optional — but when you support us,
            you get real perks and help us grow.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Link
              href="/events"
              className="bg-pink-600 hover:bg-pink-500 px-10 py-4 rounded-xl font-bold text-base transition-all duration-200 hover:-translate-y-0.5 shadow-lg shadow-pink-900/30 hover:shadow-pink-900/50"
            >
              Explore Events →
            </Link>
            <Link
              href="/signup"
              className="border border-white/12 hover:border-white/25 px-10 py-4 rounded-xl font-semibold text-base transition-all duration-200 text-white/50 hover:text-white hover:-translate-y-0.5"
            >
              Become a Member
            </Link>
          </div>
        </div>
      </section>

    </main>
  );
}
