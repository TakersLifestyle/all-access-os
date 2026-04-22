import Link from "next/link";

export const metadata = {
  title: "About — ALL ACCESS Winnipeg",
  description: "ALL ACCESS was built to create environments where people feel comfortable showing up, connecting, and being themselves without judgment.",
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
