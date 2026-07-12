"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";

interface MemoryAlbum {
  id: string;
  title: string;
  eventDate: string;
  coverImageUrl?: string;
  description?: string;
  location?: string;
  category?: string;
  episodeNumber?: number;
  status: string;
  photoCount: number;
  videoCount: number;
  creatorCount: number;
  attendeeCount: number;
  isFeatured?: boolean;
}

function formatDate(dateStr: string) {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" });
  } catch { return dateStr; }
}

function AlbumCard({ album }: { album: MemoryAlbum }) {
  return (
    <Link href={`/memories/${album.id}`} className="group block">
      <div className="relative overflow-hidden rounded-2xl border border-white/10 hover:border-pink-500/25 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_40px_rgba(236,72,153,0.10)]">
        <div className="relative h-52 bg-white/[0.03] overflow-hidden">
          {album.coverImageUrl ? (
            <>
              <img
                src={album.coverImageUrl}
                alt={album.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
            </>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-pink-950/50 via-black to-purple-950/30 flex items-center justify-center">
              <span className="text-5xl opacity-10">📸</span>
            </div>
          )}
          <div className="absolute top-3 left-3 flex gap-1.5">
            {album.isFeatured && (
              <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-pink-600/90 text-white uppercase tracking-widest">
                Featured
              </span>
            )}
            {album.category && (
              <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-black/60 border border-white/10 text-white/50 uppercase">
                {album.category}
              </span>
            )}
          </div>
          {(album.photoCount > 0 || album.videoCount > 0 || album.attendeeCount > 0) && (
            <div className="absolute bottom-3 left-4 flex items-center gap-3 text-xs text-white/60">
              {album.photoCount > 0 && <span>📸 {album.photoCount}</span>}
              {album.videoCount > 0 && <span>🎥 {album.videoCount}</span>}
              {album.attendeeCount > 0 && <span>👥 {album.attendeeCount}</span>}
            </div>
          )}
        </div>
        <div className="p-4 space-y-1.5 bg-white/[0.02]">
          <h3 className="font-bold text-white text-base leading-tight line-clamp-1">{album.title}</h3>
          <p className="text-white/30 text-xs">
            {formatDate(album.eventDate)}{album.location ? ` · ${album.location}` : ""}
          </p>
          {album.description && (
            <p className="text-white/40 text-xs leading-relaxed line-clamp-2">{album.description}</p>
          )}
          <p className="text-pink-400/80 text-sm font-semibold group-hover:text-pink-300 transition pt-0.5">
            View Memories →
          </p>
        </div>
      </div>
    </Link>
  );
}

function EpisodeCard({ album }: { album: MemoryAlbum }) {
  return (
    <Link href={`/memories/${album.id}`} className="group shrink-0 block w-44">
      <div className="relative w-44 h-64 rounded-2xl overflow-hidden border border-white/10 group-hover:border-pink-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(236,72,153,0.18)]">
        {album.coverImageUrl ? (
          <img
            src={album.coverImageUrl}
            alt={album.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-pink-950/50 via-black to-purple-950/40" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
        {album.episodeNumber && (
          <div className="absolute top-3 left-3">
            <span className="text-[10px] font-black px-2 py-1 rounded-lg bg-pink-600 text-white">
              EP.{album.episodeNumber}
            </span>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <p className="text-white font-bold text-sm leading-tight line-clamp-2">{album.title}</p>
          {album.description && (
            <p className="text-white/40 text-xs mt-1 line-clamp-1">{album.description}</p>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function MemoriesPage() {
  const { user, hasCommunityAccess, loading } = useAuth();
  const router = useRouter();
  const [albums, setAlbums] = useState<MemoryAlbum[]>([]);
  const [fetching, setFetching] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "events" | "founding-15">("all");

  useEffect(() => {
    if (!loading && !user) router.push("/login?redirect=/memories");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user || !hasCommunityAccess) { setFetching(false); return; }
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, "memoryAlbums"), where("status", "==", "active")));
        const result = snap.docs.map(d => ({ id: d.id, ...d.data() } as MemoryAlbum));
        result.sort((a, b) => (b.eventDate ?? "").localeCompare(a.eventDate ?? ""));
        setAlbums(result);
      } finally { setFetching(false); }
    })();
  }, [user, hasCommunityAccess]);

  if (loading || !user) return null;

  if (!hasCommunityAccess) {
    return (
      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="text-center py-24 space-y-6">
          <p className="text-7xl">🔒</p>
          <div className="space-y-3">
            <h2 className="text-2xl font-bold">Memories are for the community.</h2>
            <p className="text-white/40 text-sm max-w-md mx-auto leading-relaxed">
              Attend an ALL ACCESS event or become a monthly supporter to view event albums, photos, videos, and downloadable memories.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link href="/signup" className="bg-pink-600 hover:bg-pink-500 px-6 py-2.5 rounded-xl text-sm font-bold transition">
              Become a Supporter — $25/mo
            </Link>
            <Link href="/events" className="text-white/40 hover:text-white text-sm transition">
              View Upcoming Events →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const founding15 = albums
    .filter(a => a.category === "Founding 15")
    .sort((a, b) => (a.episodeNumber ?? 99) - (b.episodeNumber ?? 99));
  const communitySpotlight = albums.filter(a => a.category === "Community Spotlight");
  const eventAlbums = albums.filter(a => a.category !== "Founding 15" && a.category !== "Community Spotlight");
  const featuredAlbum = albums.find(a => a.isFeatured);
  const isSearching = searchQuery.trim().length > 0;
  const isFiltering = activeFilter !== "all";

  const filteredAlbums = albums.filter(a => {
    const q = searchQuery.toLowerCase();
    if (q && !a.title.toLowerCase().includes(q) && !(a.description ?? "").toLowerCase().includes(q)) return false;
    if (activeFilter === "founding-15") return a.category === "Founding 15";
    if (activeFilter === "events") return a.category !== "Founding 15";
    return true;
  });

  return (
    <main className="max-w-5xl mx-auto px-6 py-12 space-y-12">
      {/* Header */}
      <div className="text-center space-y-3">
        <p className="text-white/25 text-[10px] font-bold uppercase tracking-widest">ALL ACCESS Winnipeg</p>
        <h1 className="text-5xl md:text-6xl font-black tracking-tight">MEMORIES</h1>
        <p className="text-white/40 text-sm max-w-sm mx-auto leading-relaxed">
          Real community. Real experiences. Relive every moment.
        </p>
      </div>

      {/* Search + Filters */}
      <div className="space-y-4">
        <div className="relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search memories, episodes, events…"
            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-10 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-pink-500/30 transition"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition text-sm">✕</button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(["all", "founding-15", "events"] as const).map(f => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${
                activeFilter === f
                  ? "bg-pink-600 text-white"
                  : "bg-white/5 border border-white/10 text-white/50 hover:text-white/80 hover:border-white/20"
              }`}
            >
              {f === "all" ? "All" : f === "founding-15" ? "Founding 15" : "Events"}
            </button>
          ))}
          {!fetching && (
            <span className="text-white/15 text-xs ml-auto">
              {albums.length} album{albums.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      {fetching ? (
        <div className="space-y-10">
          <div className="h-[400px] bg-white/5 rounded-3xl animate-pulse" />
          <div className="flex gap-4">
            {[1, 2, 3].map(i => <div key={i} className="w-44 h-64 bg-white/5 rounded-2xl animate-pulse shrink-0" />)}
          </div>
        </div>
      ) : albums.length === 0 ? (
        <div className="text-center py-24 space-y-5">
          <p className="text-7xl">📸</p>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white/70">No memories uploaded yet.</h2>
            <p className="text-white/30 text-sm max-w-sm mx-auto leading-relaxed">
              After each ALL ACCESS experience, photos, videos, and creator content will live here for members to relive and download.
            </p>
          </div>
          <Link href="/events" className="inline-block mt-2 bg-pink-600 hover:bg-pink-500 px-6 py-2.5 rounded-xl text-sm font-bold transition">
            View Upcoming Events →
          </Link>
        </div>
      ) : (isSearching || isFiltering) ? (
        <div className="space-y-6">
          <p className="text-white/30 text-sm">
            {filteredAlbums.length} result{filteredAlbums.length !== 1 ? "s" : ""}
            {searchQuery ? ` for "${searchQuery}"` : ""}
          </p>
          {filteredAlbums.length === 0 ? (
            <div className="text-center py-16 text-white/25 space-y-3">
              <p className="text-5xl">🔍</p>
              <p className="text-sm">No albums found. Try a different search.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              {filteredAlbums.map(a => <AlbumCard key={a.id} album={a} />)}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-14">

          {/* Featured Hero */}
          {featuredAlbum && (
            <section>
              <Link href={`/memories/${featuredAlbum.id}`} className="group block">
                <div className="relative h-[340px] md:h-[460px] rounded-3xl overflow-hidden">
                  {featuredAlbum.coverImageUrl ? (
                    <img
                      src={featuredAlbum.coverImageUrl}
                      alt={featuredAlbum.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-pink-950/70 via-[#080412] to-purple-950/60" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-7 md:p-10">
                    <div className="max-w-xl">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[9px] font-black px-2 py-1 rounded-full bg-pink-600 text-white uppercase tracking-widest">
                          Featured
                        </span>
                        {featuredAlbum.category && (
                          <span className="text-[9px] font-semibold px-2 py-1 rounded-full border border-white/20 text-white/50 uppercase">
                            {featuredAlbum.category}
                            {featuredAlbum.episodeNumber ? ` · EP.${featuredAlbum.episodeNumber}` : ""}
                          </span>
                        )}
                      </div>
                      <h2 className="text-3xl md:text-4xl font-black text-white leading-tight">
                        {featuredAlbum.title}
                      </h2>
                      {featuredAlbum.description && (
                        <p className="text-white/50 text-sm mt-2 leading-relaxed line-clamp-2">
                          {featuredAlbum.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-5">
                        <span className="bg-pink-600 group-hover:bg-pink-500 transition px-5 py-2.5 rounded-xl text-sm font-bold text-white">
                          View Memories →
                        </span>
                        <div className="flex items-center gap-3 text-white/35 text-xs">
                          {(featuredAlbum.photoCount ?? 0) > 0 && <span>📸 {featuredAlbum.photoCount}</span>}
                          {(featuredAlbum.attendeeCount ?? 0) > 0 && <span>👥 {featuredAlbum.attendeeCount}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            </section>
          )}

          {/* Founding 15 Series */}
          {founding15.length > 0 && (
            <section className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/25 text-[10px] font-bold uppercase tracking-widest">Series</p>
                  <h2 className="text-xl font-bold text-white mt-1">Founding 15</h2>
                </div>
                <button
                  onClick={() => setActiveFilter("founding-15")}
                  className="text-pink-400/70 hover:text-pink-300 text-sm transition font-medium"
                >
                  View All {founding15.length} →
                </button>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-3 -mx-6 px-6" style={{ scrollbarWidth: "none" }}>
                {founding15.map(a => <EpisodeCard key={a.id} album={a} />)}
              </div>
            </section>
          )}

          {/* Community Spotlight */}
          {communitySpotlight.length > 0 && (
            <section className="space-y-5">
              <div>
                <p className="text-white/25 text-[10px] font-bold uppercase tracking-widest">Community Spotlight</p>
                <h2 className="text-xl font-bold text-white mt-1">Community Moments</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                {communitySpotlight.map(a => <AlbumCard key={a.id} album={a} />)}
              </div>
            </section>
          )}

          {/* Event Albums */}
          {eventAlbums.length > 0 && (
            <section className="space-y-5">
              <div>
                <p className="text-white/25 text-[10px] font-bold uppercase tracking-widest">Archives</p>
                <h2 className="text-xl font-bold text-white mt-1">Event Albums</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                {eventAlbums.map(a => <AlbumCard key={a.id} album={a} />)}
              </div>
            </section>
          )}

          {/* If only founding-15 albums exist, still show them as a grid below */}
          {founding15.length > 0 && eventAlbums.length === 0 && (
            <section className="space-y-5">
              <div>
                <p className="text-white/25 text-[10px] font-bold uppercase tracking-widest">All Episodes</p>
                <h2 className="text-xl font-bold text-white mt-1">Founding 15 Series</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                {founding15.map(a => <AlbumCard key={a.id} album={a} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
