"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import SocialFeedSection, {
  InstagramIcon,
  TikTokIcon,
} from "@/components/SocialFeedSection";

// ── Twitch icon ───────────────────────────────────────────────────────────────

function TwitchIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
    </svg>
  );
}

// ── Twitch live status ────────────────────────────────────────────────────────

interface TwitchStatus {
  live: boolean;
  configured: boolean;
  channel: string;
  title?: string;
  viewerCount?: number;
  game?: string;
  thumbnailUrl?: string;
}

function useTwitchStatus() {
  const [status, setStatus] = useState<TwitchStatus | null>(null);

  useEffect(() => {
    fetch("/api/twitch")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ live: false, configured: false, channel: "takerslifestyle" }));
  }, []);

  return status;
}

// ── Twitch embed player ───────────────────────────────────────────────────────

function TwitchEmbed({ channel }: { channel: string }) {
  const [host, setHost] = useState("allaccesswinnipeg.ca");

  useEffect(() => {
    setHost(window.location.hostname || "allaccesswinnipeg.ca");
  }, []);

  return (
    <div className="rounded-2xl overflow-hidden border border-white/10 bg-black aspect-video w-full">
      <iframe
        src={`https://player.twitch.tv/?channel=${channel}&parent=${host}&muted=false`}
        width="100%"
        height="100%"
        allowFullScreen
        className="w-full h-full"
        title={`${channel} on Twitch`}
      />
    </div>
  );
}

function TwitchChatEmbed({ channel }: { channel: string }) {
  const [host, setHost] = useState("allaccesswinnipeg.ca");

  useEffect(() => {
    setHost(window.location.hostname || "allaccesswinnipeg.ca");
  }, []);

  return (
    <div className="rounded-2xl overflow-hidden border border-white/10 bg-[#18181b] h-full min-h-[400px]">
      <iframe
        src={`https://www.twitch.tv/embed/${channel}/chat?parent=${host}&darkpopout`}
        width="100%"
        height="100%"
        className="w-full h-full min-h-[400px]"
        title="Twitch Chat"
      />
    </div>
  );
}

// ── Streams section ───────────────────────────────────────────────────────────

function StreamsSection() {
  const twitch = useTwitchStatus();
  const [showChat, setShowChat] = useState(false);

  return (
    <section id="streams" className="space-y-8">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          {twitch?.live ? (
            <>
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-red-400 text-[10px] font-bold uppercase tracking-widest">
                Live Now
              </span>
            </>
          ) : (
            <>
              <span className="w-1.5 h-1.5 bg-white/20 rounded-full" />
              <span className="text-white/30 text-[10px] font-bold uppercase tracking-widest">
                Streams
              </span>
            </>
          )}
        </div>
        <h2 className="text-2xl font-bold">Live Streams</h2>
        <p className="text-white/35 text-sm mt-1">
          Lofi. Hip hop. Community. Real conversation.
        </p>
      </div>

      {/* Twitch — main stream block */}
      <div className="space-y-4">
        {/* Channel header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #9146ff 0%, #6b2fd6 100%)" }}
            >
              <TwitchIcon size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-bold text-white text-sm">takerslifestyle</p>
                {twitch?.live && (
                  <span className="bg-red-600 text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                    Live
                  </span>
                )}
              </div>
              {twitch?.live ? (
                <p className="text-white/40 text-xs truncate max-w-xs">
                  {twitch.title ?? "Live now"}{twitch.viewerCount ? ` · ${twitch.viewerCount} watching` : ""}
                </p>
              ) : (
                <p className="text-white/30 text-xs">Twitch · 97 followers</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {twitch?.live && (
              <button
                onClick={() => setShowChat((v) => !v)}
                className="text-xs text-white/40 hover:text-white/70 border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-lg transition"
              >
                {showChat ? "Hide Chat" : "Show Chat"}
              </button>
            )}
            <a
              href="https://www.twitch.tv/takerslifestyle"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition"
              style={{ background: "#9146ff" }}
            >
              <TwitchIcon size={12} />
              {twitch?.live ? "Watch Live" : "Follow"}
            </a>
          </div>
        </div>

        {/* Player + optional chat */}
        <div className={`grid gap-4 ${showChat && twitch?.live ? "lg:grid-cols-[1fr_320px]" : "grid-cols-1"}`}>
          <TwitchEmbed channel="takerslifestyle" />
          {showChat && twitch?.live && (
            <TwitchChatEmbed channel="takerslifestyle" />
          )}
        </div>

        {/* Stream meta */}
        {twitch?.live && (twitch.game || twitch.viewerCount) && (
          <div className="flex flex-wrap items-center gap-3">
            {twitch.game && (
              <span className="bg-white/5 border border-white/10 text-white/50 text-xs px-3 py-1 rounded-full">
                🎮 {twitch.game}
              </span>
            )}
            {twitch.viewerCount !== undefined && (
              <span className="bg-white/5 border border-white/10 text-white/50 text-xs px-3 py-1 rounded-full">
                👁 {twitch.viewerCount.toLocaleString()} viewers
              </span>
            )}
          </div>
        )}

        {/* Offline state */}
        {twitch && !twitch.live && (
          <div className="bg-white/[0.02] border border-white/6 rounded-xl px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-white/40 text-sm font-medium">Channel is offline</p>
              <p className="text-white/20 text-xs mt-0.5">
                Follow to get notified when we go live. Lofi, hip hop, and community conversation.
              </p>
            </div>
            <a
              href="https://www.twitch.tv/takerslifestyle"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#9146ff] hover:text-purple-400 text-xs font-bold transition shrink-0 ml-4"
            >
              Follow →
            </a>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-white/5" />

      {/* Other stream platforms */}
      <div className="space-y-4">
        <p className="text-white/25 text-xs font-bold uppercase tracking-wider">Also on</p>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            {
              icon: "📺",
              title: "Instagram Live",
              desc: "Event coverage, venue reveals, and community moments.",
              href: "https://www.instagram.com/allaccesswinnipeg/",
              label: "Follow on Instagram",
              color: "text-pink-400",
            },
            {
              icon: "🎵",
              title: "TikTok Live",
              desc: "Behind-the-scenes event drops and founder Q&As.",
              href: "https://www.tiktok.com/@allaccesswinnipeg",
              label: "Follow on TikTok",
              color: "text-white/50",
            },
            {
              icon: "🎬",
              title: "Event Streams",
              desc: "On-site event streams for members who couldn't make it in person.",
              href: null,
              label: "Members only — coming soon",
              color: "text-white/20",
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
                  className={`inline-block text-xs font-semibold hover:opacity-80 transition ${s.color}`}
                >
                  {s.label} →
                </a>
              ) : (
                <span className={`inline-block text-xs ${s.color}`}>{s.label}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Platform card ─────────────────────────────────────────────────────────────

function PlatformCard({
  platform,
  handle,
  href,
  followers,
  cta,
  iconBg,
  icon,
}: {
  platform: string;
  handle: string;
  href: string;
  followers: string;
  cta: string;
  iconBg: string;
  icon: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-4 border border-white/8 bg-white/[0.03] hover:border-pink-500/30 hover:bg-pink-600/5 rounded-2xl p-4 transition-all duration-300 hover:shadow-[0_0_24px_rgba(255,0,127,0.08)]"
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-white"
        style={{ background: iconBg }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-white text-sm">{handle}</p>
        <p className="text-white/30 text-xs mt-0.5">{followers}</p>
      </div>
      <span className="text-pink-400 text-xs font-bold group-hover:translate-x-0.5 transition-transform shrink-0">
        {cta} →
      </span>
    </a>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function ConnectPageInner() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const validTab = (["feed", "instagram", "tiktok", "streams"] as const).find(
    (t) => t === tabParam
  );
  const [activeTab, setActiveTab] = useState<"feed" | "instagram" | "tiktok" | "streams">(
    validTab ?? "feed"
  );

  const tabs = [
    { id: "feed" as const, label: "Live Feed" },
    { id: "instagram" as const, label: "Instagram" },
    { id: "tiktok" as const, label: "TikTok" },
    { id: "streams" as const, label: "Streams" },
  ];

  return (
    <main className="max-w-5xl mx-auto px-6 pb-24 space-y-10">

      {/* ── Hero ────────────────────────────────────────── */}
      <section className="pt-12 space-y-6">
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
          <p className="text-white/40 text-base max-w-md">
            Follow the moments. Join the community. Stay in the loop on everything ALL ACCESS.
          </p>
        </div>

        {/* Platform cards */}
        <div className="grid sm:grid-cols-3 gap-3">
          <PlatformCard
            platform="instagram"
            handle="@allaccesswinnipeg"
            href="https://www.instagram.com/allaccesswinnipeg/"
            followers="Instagram · Follow for updates"
            cta="Follow"
            iconBg="linear-gradient(135deg, #ff007f 0%, #cc0055 100%)"
            icon={<InstagramIcon size={20} />}
          />
          <PlatformCard
            platform="tiktok"
            handle="@allaccesswinnipeg"
            href="https://www.tiktok.com/@allaccesswinnipeg"
            followers="TikTok · 6K+ views"
            cta="Follow"
            iconBg="linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)"
            icon={<TikTokIcon size={18} />}
          />
          <PlatformCard
            platform="twitch"
            handle="takerslifestyle"
            href="https://www.twitch.tv/takerslifestyle"
            followers="Twitch · 97 followers"
            cta="Watch"
            iconBg="linear-gradient(135deg, #9146ff 0%, #6b2fd6 100%)"
            icon={<TwitchIcon size={18} />}
          />
        </div>
      </section>

      {/* ── Tabs ────────────────────────────────────────── */}
      <div className="flex gap-1 bg-white/[0.03] border border-white/8 rounded-xl p-1 w-fit flex-wrap">
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
                Videos and community highlights from{" "}
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

export default function ConnectPage() {
  return (
    <Suspense fallback={null}>
      <ConnectPageInner />
    </Suspense>
  );
}
