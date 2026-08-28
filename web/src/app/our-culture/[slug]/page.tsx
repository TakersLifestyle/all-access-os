import Link from "next/link";
import type { Metadata } from "next";
import type { CultureEpisode } from "@/lib/culture-types";

// ─── Static placeholder until Firestore/CMS is wired ───────────────────────
// Replace this with a real data fetch (Firestore, CMS, or static JSON) in Phase 2.
async function getEpisode(slug: string): Promise<CultureEpisode | null> {
  // TODO Phase 2: fetch from Firestore `cultureEpisodes` collection where slug == slug
  void slug;
  return null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const episode = await getEpisode(slug);
  if (!episode) {
    return {
      title: "Episode Not Found — OUR CULTURE | ALL ACCESS Winnipeg",
    };
  }
  return {
    title: `${episode.guestDisplayName} — OUR CULTURE | ALL ACCESS Winnipeg`,
    description: episode.seoDescription ?? episode.shortBio,
  };
}

export default async function EpisodePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const episode = await getEpisode(slug);

  if (!episode) {
    return (
      <main className="bg-black text-white min-h-screen flex flex-col items-center justify-center px-4 text-center space-y-6">
        <p className="text-pink-500/60 text-xs font-black uppercase tracking-[0.25em]">OUR CULTURE</p>
        <h1 className="text-3xl font-black">This conversation hasn&apos;t been published yet.</h1>
        <p className="text-white/40 text-sm max-w-sm leading-relaxed">
          We&apos;re still building the archive. The first couch conversations are coming soon.
        </p>
        <Link
          href="/our-culture"
          className="bg-pink-600 hover:bg-pink-500 text-white font-black px-6 py-3 rounded-xl transition"
        >
          ← Back to OUR CULTURE
        </Link>
      </main>
    );
  }

  return (
    <main className="bg-black text-white min-h-screen">
      {/* ── EPISODE HERO ──────────────────────────────────────────────────── */}
      <section className="relative min-h-[70vh] flex flex-col justify-end overflow-hidden">
        {episode.coverImage ? (
          <img
            src={episode.coverImage}
            alt={episode.guestDisplayName}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-pink-950/30 via-black to-purple-950/20" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/20" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pb-14 pt-24 w-full space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/our-culture"
              className="text-white/40 hover:text-white/70 text-xs font-semibold transition flex items-center gap-1"
            >
              ← OUR CULTURE
            </Link>
            <span className="text-white/20">·</span>
            <span className="bg-pink-600/20 border border-pink-500/30 text-pink-400 text-xs font-black px-3 py-1 rounded-full">
              {episode.category}
            </span>
            {episode.duration && (
              <span className="text-white/30 text-xs">{episode.duration}</span>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-pink-400/70 text-sm font-bold">Ep. {String(episode.episodeNumber).padStart(2, "0")} — The Couch</p>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black leading-tight">
              {episode.guestDisplayName}
            </h1>
            <p className="text-white/60 text-lg">{episode.guestRole}{episode.guestOrganization ? ` · ${episode.guestOrganization}` : ""}</p>
          </div>

          {episode.featuredQuotes[0] && (
            <blockquote className="border-l-2 border-pink-500/50 pl-4 text-white/70 text-base italic max-w-xl leading-relaxed">
              &ldquo;{episode.featuredQuotes[0].text}&rdquo;
            </blockquote>
          )}
        </div>
      </section>

      {/* ── MAIN VIDEO ────────────────────────────────────────────────────── */}
      {(episode.youtubeUrl || episode.fullVideoUrl) && (
        <section className="bg-[#050505] py-12">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <div className="rounded-2xl overflow-hidden border border-white/10 bg-black aspect-video">
              {episode.youtubeUrl ? (
                <iframe
                  src={episode.youtubeUrl.replace("watch?v=", "embed/")}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video
                  src={episode.fullVideoUrl}
                  controls
                  playsInline
                  className="w-full h-full"
                />
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── GUEST PROFILE ─────────────────────────────────────────────────── */}
      <section className="bg-black py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-3 gap-10">
            {/* Left: photo + links */}
            <div className="space-y-5">
              {episode.profileImage ? (
                <div className="rounded-2xl overflow-hidden border border-white/10 aspect-square">
                  <img src={episode.profileImage} alt={episode.guestDisplayName} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="rounded-2xl border border-white/8 aspect-square bg-white/[0.02] flex items-center justify-center">
                  <svg className="w-12 h-12 text-white/15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}

              <div className="space-y-2">
                {episode.socialLinks.instagram && (
                  <a href={episode.socialLinks.instagram} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2.5 text-white/50 hover:text-white text-sm transition">
                    <svg className="w-4 h-4 text-pink-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                    Instagram
                  </a>
                )}
                {episode.socialLinks.youtube && (
                  <a href={episode.socialLinks.youtube} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2.5 text-white/50 hover:text-white text-sm transition">
                    <svg className="w-4 h-4 text-red-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                    YouTube
                  </a>
                )}
                {episode.websiteUrl && (
                  <a href={episode.websiteUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2.5 text-white/50 hover:text-white text-sm transition">
                    <svg className="w-4 h-4 text-white/40 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Website
                  </a>
                )}
              </div>
            </div>

            {/* Right: bio + topics */}
            <div className="md:col-span-2 space-y-8">
              <div className="space-y-4">
                <h2 className="text-2xl font-black">{episode.title || `A conversation with ${episode.guestDisplayName}`}</h2>
                <p className="text-white/55 text-base leading-relaxed">{episode.longBio ?? episode.shortBio}</p>
              </div>

              {episode.topics.length > 0 && (
                <div className="space-y-3">
                  <p className="text-white/30 text-xs font-black uppercase tracking-wider">Topics covered</p>
                  <div className="flex flex-wrap gap-2">
                    {episode.topics.map((t) => (
                      <span key={t} className="bg-white/[0.04] border border-white/8 text-white/50 text-xs px-3 py-1.5 rounded-full">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {episode.featuredQuotes.length > 1 && (
                <div className="space-y-3">
                  <p className="text-white/30 text-xs font-black uppercase tracking-wider">From the conversation</p>
                  {episode.featuredQuotes.slice(1).map((q, i) => (
                    <blockquote key={i} className="border-l-2 border-pink-500/40 pl-4 text-white/65 text-sm italic leading-relaxed">
                      &ldquo;{q.text}&rdquo;
                    </blockquote>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── PHOTO GALLERY ─────────────────────────────────────────────────── */}
      {episode.photoGallery.length > 0 && (
        <section className="bg-[#050505] py-16 border-t border-white/5">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-6">
            <p className="text-white/30 text-xs font-black uppercase tracking-wider">Photo Gallery</p>
            <div className="columns-2 sm:columns-3 gap-3">
              {episode.photoGallery.map((src, i) => (
                <div key={i} className="break-inside-avoid mb-3 rounded-xl overflow-hidden">
                  <img src={src} alt={`${episode.guestDisplayName} photo ${i + 1}`} className="w-full object-cover" loading="lazy" />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── BACK / CTA ────────────────────────────────────────────────────── */}
      <section className="bg-black py-16 border-t border-white/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/our-culture" className="text-white/40 hover:text-white transition text-sm font-semibold">
            ← Back to OUR CULTURE
          </Link>
          <Link
            href="/our-culture#nominate"
            className="bg-pink-600 hover:bg-pink-500 text-white font-black px-6 py-3 rounded-xl transition text-sm"
          >
            Nominate the Next Guest →
          </Link>
        </div>
      </section>
    </main>
  );
}
