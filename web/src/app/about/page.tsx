import Link from "next/link";

export const metadata = {
  title: "About — ALL ACCESS Winnipeg",
  description: "ALL ACCESS Winnipeg is a community-first, mission-driven organization creating safe, accessible experiences that foster social connection, mental well-being, and cultural growth.",
};

export default function AboutPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-16 space-y-16">

      {/* ── Mission ──────────────────────────────────────── */}
      <section className="space-y-6">
        <div className="space-y-4">
          <p className="text-white/25 text-xs uppercase tracking-widest font-semibold">Our Story</p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight">
            Loneliness isn&apos;t<br />always visible.
          </h1>
        </div>

        <div className="space-y-4 text-white/60 text-base leading-relaxed">
          <p>
            In a city full of people, many are still navigating life quietly — carrying stress, pressure,
            past experiences, and things they don&apos;t always talk about.
          </p>
          <p className="text-white/80 font-medium">ALL ACCESS was built to change that.</p>
          <p>
            Not just by creating events — but by creating environments where people feel comfortable
            showing up, connecting, and being themselves without judgment.
          </p>
          <p>
            Every experience we host is intentional.
            Every space is designed to feel safe, welcoming, and real.
          </p>
        </div>

        <div className="border-l-2 border-pink-500/40 pl-5">
          <p className="text-white/70 text-base italic leading-relaxed">
            &ldquo;This is more than going out.<br />
            This is about reconnecting — with people, with energy, and with yourself.&rdquo;
          </p>
        </div>

        <p className="text-white/50 text-base leading-relaxed">
          You don&apos;t have to carry everything alone.
        </p>
      </section>

      {/* ── Commitment ───────────────────────────────────── */}
      <section className="space-y-6">
        <div className="space-y-1">
          <p className="text-white/25 text-xs uppercase tracking-widest font-semibold">Our Commitment</p>
          <h2 className="text-2xl font-bold">Our Commitment to You</h2>
        </div>

        <p className="text-white/50 text-sm leading-relaxed">We are committed to building a space where:</p>

        <ul className="space-y-3">
          {[
            "People feel respected and welcomed",
            "Conversations stay positive and constructive",
            "Everyone can show up without pressure or judgment",
          ].map((item) => (
            <li key={item} className="flex items-start gap-3 text-white/70 text-sm">
              <span className="text-pink-400 shrink-0 mt-0.5">✓</span>
              {item}
            </li>
          ))}
        </ul>

        <div className="bg-white/[0.03] border border-white/8 rounded-2xl px-5 py-4 space-y-1">
          <p className="text-white/60 text-sm leading-relaxed">This is a community-first environment.</p>
          <p className="text-white/40 text-sm leading-relaxed">What you bring into the space shapes it.</p>
        </div>
      </section>

      {/* ── Community Standard ───────────────────────────── */}
      <section className="space-y-6">
        <div className="space-y-1">
          <p className="text-white/25 text-xs uppercase tracking-widest font-semibold">The Standard</p>
          <h2 className="text-2xl font-bold">Community Standard</h2>
        </div>

        <p className="text-white/55 text-sm leading-relaxed">
          ALL ACCESS exists to bring people together — not divide them.
          To protect that, we keep a few simple standards:
        </p>

        <ul className="space-y-3">
          {[
            "Respect everyone in the space",
            "No harassment, bullying, or negative behavior",
            "Keep interactions genuine and positive",
            "Disagreements are fine — disrespect is not",
          ].map((item) => (
            <li key={item} className="flex items-start gap-3 text-white/65 text-sm">
              <span className="text-pink-400/70 shrink-0 mt-0.5">·</span>
              {item}
            </li>
          ))}
        </ul>

        <div className="bg-pink-950/20 border border-pink-500/15 rounded-2xl px-5 py-4 space-y-2">
          <p className="text-white/50 text-sm leading-relaxed">
            We operate with zero tolerance for behavior that disrupts the environment.
            If something crosses the line, it will be addressed.
          </p>
          <p className="text-pink-300/60 text-sm font-medium">
            We&apos;re here to build something better — together.
          </p>
        </div>
      </section>

      {/* ── Mission tags ─────────────────────────────────── */}
      <section className="space-y-4 border-t border-white/5 pt-10">
        <p className="text-white/20 text-xs uppercase tracking-widest font-semibold">What We Stand For</p>
        <div className="flex flex-wrap gap-2.5">
          {[
            "Social Connection",
            "Mental Well-being",
            "Youth Engagement",
            "Cultural Experiences",
            "Safe Spaces",
            "Real Community",
          ].map((tag) => (
            <span key={tag} className="bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-white/40 text-xs font-medium">
              {tag}
            </span>
          ))}
        </div>
      </section>

      {/* ── Founder's Note ───────────────────────────────── */}
      <section className="space-y-5">
        <div className="space-y-1">
          <p className="text-white/25 text-xs uppercase tracking-widest font-semibold">A Note From the Founder</p>
        </div>

        <div className="bg-white/[0.03] border border-white/10 rounded-2xl px-6 py-6 space-y-4">
          <div className="space-y-3 text-white/60 text-sm leading-relaxed">
            <p>
              I know what it feels like to go through things and keep moving like everything is fine.
            </p>
            <p>
              To show up, stay strong, and handle life — without always having the right space to process it.
            </p>
            <p className="text-white/40 italic">
              That experience shaped this.
            </p>
          </div>

          <div className="border-t border-white/8 pt-4 space-y-3 text-white/65 text-sm leading-relaxed">
            <p>
              ALL ACCESS is built for people who want more than just distractions.
              It&apos;s for people who want real connection, better environments, and moments that actually mean something.
            </p>
            <p className="text-white/50">
              You don&apos;t have to explain everything you&apos;ve been through to belong here.
            </p>
            <p className="text-white font-semibold text-base">
              Just show up.
            </p>
          </div>
        </div>
      </section>

      {/* ── Why This Exists ──────────────────────────────── */}
      <section className="space-y-5">
        <div className="space-y-1">
          <p className="text-white/25 text-xs uppercase tracking-widest font-semibold">Why This Exists</p>
          <h2 className="text-2xl font-bold">Why This Exists</h2>
        </div>

        <div className="space-y-4 text-white/55 text-sm leading-relaxed">
          <p className="text-white/70">
            ALL ACCESS didn&apos;t start as a business idea.
          </p>
          <p>
            It started from a place of understanding what it feels like to carry things quietly.
          </p>
          <p>
            There are moments in life where you&apos;re surrounded by people, but still feel disconnected.
            Times where your environment doesn&apos;t reflect the energy you&apos;re trying to grow into.
          </p>
          <p className="text-white/70 font-medium">
            That gap — between where you are and what you need — is real.
          </p>
          <p>
            ALL ACCESS was built to close that gap.
          </p>
          <p>
            Not just with events, but with intentional spaces where people can show up, feel safe,
            and connect without pressure.
          </p>
        </div>

        <div className="space-y-3 border-t border-white/8 pt-5">
          <p className="text-white/40 text-sm italic">This isn&apos;t about status or clout.</p>
          <p className="text-white/70 text-sm font-semibold">It&apos;s about environment.</p>
          <p className="text-white/50 text-sm leading-relaxed">
            Because the right environment can change everything.
            And sometimes, being in the right room with the right people is where healing starts.
          </p>
        </div>
      </section>

      {/* ── How We Operate ───────────────────────────────── */}
      <section className="space-y-6">
        <div className="space-y-1">
          <p className="text-white/25 text-xs uppercase tracking-widest font-semibold">Our Model</p>
          <h2 className="text-2xl font-bold">Community-Supported. Mission-Driven.</h2>
        </div>

        <div className="space-y-4 text-white/55 text-sm leading-relaxed">
          <p className="text-white/75">
            ALL ACCESS is independently operated and community-supported — not backed by corporate investors or external funding.
          </p>
          <p>
            We grow through membership support and event participation. That&apos;s intentional.
            It keeps us accountable to the people we serve, not to shareholders or sponsors with their own agenda.
          </p>
          <p>
            We are currently in the process of incorporating as a nonprofit organization — formalizing what has always been true about how we operate: mission over profit, people over optics, and long-term community impact over short-term gains.
          </p>
          <p className="text-white/70 font-medium">
            Everything we earn goes back into building this.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: "🎯", label: "Event quality & production" },
            { icon: "🤝", label: "Community partnerships" },
            { icon: "⚙️", label: "Platform growth & operations" },
            { icon: "🔓", label: "Accessibility & inclusion" },
          ].map((item) => (
            <div key={item.label} className="bg-white/[0.03] border border-white/8 rounded-xl px-4 py-3.5 flex items-center gap-3">
              <span className="text-lg">{item.icon}</span>
              <p className="text-white/55 text-xs leading-snug">{item.label}</p>
            </div>
          ))}
        </div>

        <div className="bg-pink-950/20 border border-pink-500/15 rounded-2xl px-5 py-4 space-y-1">
          <p className="text-white/65 text-sm leading-relaxed">
            Membership isn&apos;t charity — it&apos;s how we stay independent and keep doing this.
          </p>
          <p className="text-pink-300/70 text-sm font-medium">
            Every member makes the next event possible.
          </p>
        </div>
      </section>

      {/* ── Partners & Sponsors ──────────────────────────── */}
      <section className="space-y-5 border-t border-white/5 pt-10">
        <div className="space-y-1">
          <p className="text-white/25 text-xs uppercase tracking-widest font-semibold">Work With Us</p>
          <h2 className="text-2xl font-bold">Sponsors & Partners</h2>
        </div>

        <p className="text-white/50 text-sm leading-relaxed">
          We partner with organizations that share our values — businesses, nonprofits, and community groups
          who want to reach Winnipeg&apos;s young adult community in a meaningful, trust-first environment.
        </p>

        <div className="space-y-3">
          {[
            "Event sponsorships and co-branding",
            "Community outreach and impact partnerships",
            "Grant-aligned programming and accessibility initiatives",
            "Local business perks and member discount partnerships",
          ].map((item) => (
            <div key={item} className="flex items-start gap-3 text-white/60 text-sm">
              <span className="text-pink-400/70 shrink-0 mt-0.5">→</span>
              {item}
            </div>
          ))}
        </div>

        <p className="text-white/35 text-xs">
          Interested in partnering?{" "}
          <a href="mailto:hello@allaccesswinnipeg.ca" className="text-pink-400/70 hover:text-pink-400 transition underline underline-offset-2">
            hello@allaccesswinnipeg.ca
          </a>
        </p>
      </section>

      {/* ── CTA ──────────────────────────────────────────── */}
      <section className="flex flex-col sm:flex-row gap-3 pt-2">
        <Link href="/events"
          className="flex-1 text-center bg-pink-600 hover:bg-pink-500 px-6 py-3.5 rounded-xl font-bold transition">
          Explore Events →
        </Link>
        <Link href="/community"
          className="flex-1 text-center border border-white/15 hover:border-white/30 px-6 py-3.5 rounded-xl font-semibold text-white/60 hover:text-white transition">
          Join the Community
        </Link>
      </section>

    </main>
  );
}
