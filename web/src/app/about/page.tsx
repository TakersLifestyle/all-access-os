"use client";

import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="max-w-5xl mx-auto px-6 pb-32 space-y-32">

      {/* ── HERO ──────────────────────────────────────────────── */}
      <section className="pt-20 text-center space-y-6 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-pink-600/10 border border-pink-500/20 rounded-full px-4 py-1.5 text-xs text-pink-400 font-semibold uppercase tracking-widest">
          Our Story
        </div>
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight">
          Built for connection.<br />
          <span className="text-pink-500">Designed with intention.</span>
        </h1>
        <p className="text-white/50 text-lg leading-relaxed max-w-xl mx-auto">
          ALL ACCESS is a Winnipeg-based community platform bringing people together
          through real shared experiences — events, relationships, and belonging.
        </p>
      </section>

      {/* ── DIVIDER ───────────────────────────────────────────── */}
      <div className="border-t border-white/5" />

      {/* ── WHO WE ARE ────────────────────────────────────────── */}
      <section className="grid md:grid-cols-2 gap-16 items-center">
        <div className="space-y-6">
          <p className="text-xs text-white/20 uppercase tracking-widest font-semibold">Who We Are</p>
          <h2 className="text-3xl md:text-4xl font-bold leading-snug">
            A non-profit rooted in<br />
            <span className="text-pink-400">community first.</span>
          </h2>
          <div className="space-y-4 text-white/50 text-base leading-relaxed">
            <p>
              ALL ACCESS Winnipeg is a registered non-profit organization dedicated to creating
              safe, engaging, and accessible experiences for youth and young adults across our city.
            </p>
            <p>
              We believe connection is the foundation of well-being — and we build the spaces where
              that connection happens.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { number: "4", label: "Events this summer" },
            { number: "6+", label: "Community perks" },
            { number: "100%", label: "Winnipeg-based" },
            { number: "2026", label: "Founded with purpose" },
          ].map((item) => (
            <div
              key={item.label}
              className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-1"
            >
              <p className="text-3xl font-bold text-pink-400">{item.number}</p>
              <p className="text-white/40 text-xs font-medium">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── OUR MISSION ───────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-pink-950/30 to-purple-950/20 border border-pink-500/15 rounded-3xl p-12 md:p-16 text-center space-y-6">
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-pink-600/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-purple-600/8 rounded-full blur-3xl pointer-events-none" />
        <p className="text-xs text-pink-400/60 uppercase tracking-widest font-semibold">Our Mission</p>
        <blockquote className="text-2xl md:text-3xl font-medium leading-relaxed text-white/80 max-w-3xl mx-auto">
          &ldquo;To create safe, engaging, and accessible experiences for youth and young adults —
          fostering social connection, mental well-being, and cultural growth across Winnipeg.&rdquo;
        </blockquote>
        <div className="flex flex-wrap gap-3 justify-center pt-2">
          {["Social Connection", "Mental Well-being", "Youth Engagement", "Cultural Experiences", "Accessibility"].map((tag) => (
            <span key={tag} className="bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-white/40 text-xs font-medium">
              {tag}
            </span>
          ))}
        </div>
      </section>

      {/* ── WHAT WE CREATE ────────────────────────────────────── */}
      <section className="space-y-10">
        <div className="text-center space-y-2">
          <p className="text-xs text-white/20 uppercase tracking-widest font-semibold">What We Create</p>
          <h2 className="text-3xl font-bold">Four pillars of experience.</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-5">
          {[
            {
              icon: "🎉",
              title: "Community Events",
              desc: "Social nights, fundraisers, cultural experiences, and sports gatherings — open to all Winnipeggers with members saving more.",
            },
            {
              icon: "🤝",
              title: "Real Relationships",
              desc: "A growing network of people who show up, support each other, and build something meaningful together.",
            },
            {
              icon: "🎁",
              title: "Partner Perks",
              desc: "Local restaurant and business discounts as a thank-you to members who choose to support the community financially.",
            },
            {
              icon: "💬",
              title: "Community Voice",
              desc: "A members-only feed where the community can connect, share, and stay engaged between events.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="bg-white/5 border border-white/10 rounded-2xl p-7 space-y-3 hover:border-pink-500/20 transition"
            >
              <span className="text-3xl">{item.icon}</span>
              <h3 className="font-bold text-lg">{item.title}</h3>
              <p className="text-white/40 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── WHY IT MATTERS ────────────────────────────────────── */}
      <section className="grid md:grid-cols-2 gap-16 items-center">
        <div className="order-2 md:order-1 space-y-5">
          <div className="h-1 w-12 bg-pink-500 rounded-full" />
          <p className="text-white/60 text-base leading-relaxed">
            Loneliness is a public health crisis. Young adults in Winnipeg are craving spaces that
            feel authentic — where showing up is easy and connection is guaranteed.
          </p>
          <p className="text-white/60 text-base leading-relaxed">
            ALL ACCESS was built as the answer to that need. Every event we host, every perk we
            offer, every post in our community feed — it&apos;s all in service of one goal:
            getting people together.
          </p>
          <p className="text-white/60 text-base leading-relaxed">
            Membership is optional but meaningful. When you subscribe, you&apos;re not just
            getting discounts — you&apos;re funding the next event, the next connection,
            the next moment that matters.
          </p>
        </div>
        <div className="order-1 md:order-2 space-y-4">
          <p className="text-xs text-white/20 uppercase tracking-widest font-semibold">Why It Matters</p>
          <h2 className="text-3xl md:text-4xl font-bold leading-snug">
            Connection is<br />
            <span className="text-pink-400">the mission.</span>
          </h2>
        </div>
      </section>

      {/* ── LEADERSHIP ────────────────────────────────────────── */}
      <section className="space-y-10">
        <div className="text-center space-y-2">
          <p className="text-xs text-white/20 uppercase tracking-widest font-semibold">Leadership</p>
          <h2 className="text-3xl font-bold">The people behind it.</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {[
            {
              initials: "CB",
              name: "Charles Bendu",
              role: "Founder",
              bio: "Lifelong Winnipegger and community builder. Charles created ALL ACCESS to give young people a platform for real connection and shared experience.",
            },
            {
              initials: "T",
              name: "Teniola",
              role: "Co-Founder",
              bio: "Cultural organizer and event architect. Teniola brings the vision for inclusive, high-energy experiences that bring people together across backgrounds.",
            },
          ].map((person) => (
            <div
              key={person.name}
              className="bg-white/5 border border-white/10 rounded-2xl p-8 space-y-5 text-center hover:border-white/20 transition"
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-600/40 to-purple-600/40 border border-pink-500/30 flex items-center justify-center mx-auto">
                <span className="text-pink-300 font-bold text-lg">{person.initials}</span>
              </div>
              <div className="space-y-1">
                <p className="font-bold text-lg">{person.name}</p>
                <p className="text-pink-400 text-sm font-semibold">{person.role}</p>
              </div>
              <p className="text-white/40 text-sm leading-relaxed">{person.bio}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-pink-950/40 to-purple-950/30 border border-pink-500/20 rounded-3xl p-12 md:p-16 text-center space-y-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(236,72,153,0.05)_0%,_transparent_70%)] pointer-events-none" />
        <p className="text-xs text-pink-400/60 uppercase tracking-widest font-semibold">Join the Community</p>
        <h2 className="text-3xl md:text-4xl font-bold">
          Winnipeg&apos;s community<br />
          <span className="text-pink-400">is waiting for you.</span>
        </h2>
        <p className="text-white/40 text-base max-w-md mx-auto leading-relaxed">
          Events are open to everyone. Membership is optional — but when you support us,
          you get real perks and help us grow.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link
            href="/events"
            className="bg-pink-600 hover:bg-pink-500 px-8 py-3.5 rounded-xl font-bold text-base transition"
          >
            Explore Events →
          </Link>
          <Link
            href="/signup"
            className="border border-white/20 hover:border-white/40 px-8 py-3.5 rounded-xl font-semibold text-base transition text-white/60 hover:text-white"
          >
            Become a Member
          </Link>
        </div>
      </section>

    </main>
  );
}
