"use client";

import { useState } from "react";
import SocialFeedSection, {
  InstagramIcon,
  TikTokIcon,
} from "@/components/SocialFeedSection";

function StreamsSection() {
  return (
    <section id="streams" className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="w-1.5 h-1.5 bg-white/20 rounded-full" />
          <span className="text-white/30 text-[10px] font-bold uppercase tracking-widest">
            Coming Soon
          </span>
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Streams</h2>
        <p className="text-white/35 text-sm mt-1">
          Live events. Behind-the-scenes. In the moment.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {[
          {
            icon: "📺",
            title: "Instagram Live",
            desc: "Catch us live during events, venue reveals, and community moments. Follow to get notified.",
            href: "https://www.instagram.com/allaccesswinnipeg/",
            label: "Follow on Instagram",
          },
          {
            icon: "🎵",
            title: "TikTok Live",
            desc: "Real-time event coverage, founder Q&As, and exclusive behind-the-scenes drops.",
            href: "https://www.tiktok.com/@allaccesswinnipeg",
            label: "Follow on TikTok",
          },
          {
            icon: "🎬",
            title: "Event Streams",
            desc: "On-site event streams for members who couldn't make it. Full coverage, premium quality.",
            href: null,
            label: "Members only — coming soon",
          },
        ].map((s) => (
          <div
            key={s.title}
            className="bg-white/[0.03] border border-white/8 rounded-2xl p-5 space-y-3 hover:border-white/15 transition group"
          >
            <span className="text-2xl">{s.icon}</span>
            <div>
              <h3 className="font-bold text-sm text-white group-hover:text-pink-300 transition">
                {s.title}
              </h3>
              <p className="text-white/40 text-xs leading-relaxed mt-1">{s.desc}</p>
            </div>
            {s.href ? (
              <a
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-pink-400 text-xs font-semibold hover:text-pink-300 transition"
              >
                {s.label} →
              </a>
            ) : (
              <span className="inline-block text-white/20 text-xs">{s.label}</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function PlatformCard({
  platform,
  handle,
  href,
  followers,
  cta,
}: {
  platform: "instagram" | "tiktok";
  handle: string;
  href: string;
  followers: string;
  cta: string;
}) {
  const isIG = platform === "instagram";

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-5 border border-white/8 bg-white/[0.03] hover:border-pink-500/30 hover:bg-pink-600/5 rounded-2xl p-5 transition-all duration-300 hover:shadow-[0_0_24px_rgba(255,0,127,0.08)]"
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-white"
        style={{
          background: isIG
            ? "linear-gradient(135deg, #ff007f 0%, #cc0055 100%)"
            : "linear-gradient(135deg, #1a1a1a 0%, #333 100%)",
          border: isIG ? "none" : "1px solid rgba(255,255,255,0.1)",
        }}
      >
        {isIG ? <InstagramIcon size={20} /> : <TikTokIcon size={18} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-white text-sm">{handle}</p>
        <p className="text-white/35 text-xs mt-0.5">{followers}</p>
      </div>
      <span className="text-pink-400 text-xs font-bold group-hover:translate-x-0.5 transition-transform shrink-0">
        {cta} →
      </span>
    </a>
  );
}

export default function ConnectPage() {
  const [activeTab, setActiveTab] = useState<"feed" | "instagram" | "tiktok" | "streams">("feed");

  const tabs = [
    { id: "feed" as const, label: "Live Feed" },
    { id: "instagram" as const, label: "Instagram" },
    { id: "tiktok" as const, label: "TikTok" },
    { id: "streams" as const, label: "Streams" },
  ];

  return (
    <main className="max-w-5xl mx-auto px-6 pb-24 space-y-12">

      {/* ── Hero ────────────────────────────────────────── */}
      <section className="pt-12 space-y-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-pulse" />
            <span className="text-pink-400 text-[10px] font-bold uppercase tracking-widest">
              ALL ACCESS Social
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white">
            Connect
          </h1>
          <p className="text-white/45 text-base max-w-md">
            Follow the moments. Join the community. Stay in the loop on everything ALL ACCESS.
          </p>
        </div>

        {/* Platform cards */}
        <div className="grid sm:grid-cols-2 gap-3 max-w-xl">
          <PlatformCard
            platform="instagram"
            handle="@allaccesswinnipeg"
            href="https://www.instagram.com/allaccesswinnipeg/"
            followers="Instagram · Follow for updates"
            cta="Follow"
          />
          <PlatformCard
            platform="tiktok"
            handle="@allaccesswinnipeg"
            href="https://www.tiktok.com/@allaccesswinnipeg"
            followers="TikTok · 6K+ views"
            cta="Follow"
          />
        </div>
      </section>

      {/* ── Tabs ────────────────────────────────────────── */}
      <div className="flex gap-1 bg-white/[0.03] border border-white/8 rounded-xl p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab.id
                ? "bg-pink-600 text-white shadow"
                : "text-white/40 hover:text-white/70"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ─────────────────────────────────── */}
      <div>
        {activeTab === "feed" && (
          <SocialFeedSection maxPosts={16} showHeader={false} showFollowCTAs={false} />
        )}

        {activeTab === "instagram" && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl font-bold">Instagram</h2>
              <p className="text-white/40 text-sm">
                Our latest posts and stories from{" "}
                <a
                  href="https://www.instagram.com/allaccesswinnipeg/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-pink-400 hover:text-pink-300 transition"
                >
                  @allaccesswinnipeg
                </a>
              </p>
            </div>
            <SocialFeedSection
              maxPosts={12}
              showHeader={false}
              showFollowCTAs={false}
            />
            <div className="text-center pt-4">
              <a
                href="https://www.instagram.com/allaccesswinnipeg/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-pink-600 hover:bg-pink-500 text-white font-bold px-6 py-3 rounded-xl transition"
              >
                <InstagramIcon size={16} />
                Follow @allaccesswinnipeg
              </a>
            </div>
          </div>
        )}

        {activeTab === "tiktok" && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl font-bold">TikTok</h2>
              <p className="text-white/40 text-sm">
                Videos, event moments, and community highlights from{" "}
                <a
                  href="https://www.tiktok.com/@allaccesswinnipeg"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-pink-400 hover:text-pink-300 transition"
                >
                  @allaccesswinnipeg
                </a>
              </p>
            </div>
            <SocialFeedSection
              maxPosts={12}
              showHeader={false}
              showFollowCTAs={false}
            />
            <div className="text-center pt-4">
              <a
                href="https://www.tiktok.com/@allaccesswinnipeg"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white font-bold px-6 py-3 rounded-xl border border-white/15 transition"
              >
                <TikTokIcon size={16} />
                Follow @allaccesswinnipeg
              </a>
            </div>
          </div>
        )}

        {activeTab === "streams" && <StreamsSection />}
      </div>
    </main>
  );
}
