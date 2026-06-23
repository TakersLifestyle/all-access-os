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
  status: string;
  photoCount: number;
  videoCount: number;
  creatorCount: number;
  attendeeCount: number;
  isFeatured?: boolean;
}

function formatEventDate(dateStr: string) {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-CA", {
      month: "long", day: "numeric", year: "numeric",
    });
  } catch { return dateStr; }
}

function AlbumCard({ album, featured }: { album: MemoryAlbum; featured?: boolean }) {
  const photoCount = album.photoCount ?? 0;
  const videoCount = album.videoCount ?? 0;
  return (
    <Link href={`/memories/${album.id}`} className="group block">
      <div className={`relative overflow-hidden rounded-2xl border transition-all duration-300 ${featured ? "border-pink-500/30 hover:border-pink-400/50" : "border-white/10 hover:border-white/20"}`}>
        {album.coverImageUrl ? (
          <div className="relative h-56 overflow-hidden">
            <img
              src={album.coverImageUrl}
              alt={album.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
            {(photoCount > 0 || videoCount > 0) && (
              <div className="absolute bottom-3 left-4 flex items-center gap-3 text-xs text-white/70">
                {photoCount > 0 && <span>📸 {photoCount}</span>}
                {videoCount > 0 && <span>🎥 {videoCount}</span>}
              </div>
            )}
          </div>
        ) : (
          <div className="h-56 bg-gradient-to-br from-pink-950/50 via-black to-purple-950/40 flex items-center justify-center">
            <span className="text-6xl opacity-20">📸</span>
          </div>
        )}
        <div className="p-5 space-y-2 bg-white/[0.02]">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-white leading-tight">{album.title}</h3>
            {featured && (
              <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-600/20 border border-pink-500/25 text-pink-300 uppercase">
                Featured
              </span>
            )}
          </div>
          <p className="text-white/35 text-sm">{formatEventDate(album.eventDate)}</p>
          <p className="text-pink-400 text-sm font-semibold group-hover:text-pink-300 transition pt-1">
            View Memories →
          </p>
        </div>
      </div>
    </Link>
  );
}

export default function MemoriesPage() {
  const { user, isActive, isAdmin, loading } = useAuth();
  const router = useRouter();
  const [albums, setAlbums] = useState<MemoryAlbum[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push("/login?redirect=/memories");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user || (!isActive && !isAdmin)) return;
    (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, "memoryAlbums"), where("status", "==", "active"))
        );
        const result = snap.docs.map(d => ({ id: d.id, ...d.data() } as MemoryAlbum));
        result.sort((a, b) => (b.eventDate ?? "").localeCompare(a.eventDate ?? ""));
        setAlbums(result);
      } catch (err) {
        console.error("Failed to load albums:", err);
      } finally {
        setFetching(false);
      }
    })();
  }, [user, isActive, isAdmin]);

  if (loading || !user) return null;

  // Locked state for non-active, non-admin members
  if (!isActive && !isAdmin) {
    return (
      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="text-center py-24 space-y-6">
          <p className="text-7xl">🔒</p>
          <div className="space-y-3">
            <h2 className="text-2xl font-bold text-white">Memories are available to ALL ACCESS members.</h2>
            <p className="text-white/40 text-sm max-w-md mx-auto leading-relaxed">
              Join the community to view event albums, recaps, and downloadable media.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/signup"
              className="bg-pink-600 hover:bg-pink-500 px-6 py-2.5 rounded-xl text-sm font-bold transition"
            >
              Become a Supporter — $25/mo
            </Link>
            <Link
              href="/events"
              className="text-white/40 hover:text-white text-sm transition"
            >
              View Upcoming Events →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const featured = albums.filter(a => a.isFeatured);

  return (
    <main className="max-w-5xl mx-auto px-6 py-12 space-y-12">
      {/* Header */}
      <div className="text-center space-y-3">
        <p className="text-white/25 text-[10px] font-bold uppercase tracking-widest">ALL ACCESS Winnipeg</p>
        <h1 className="text-5xl font-black tracking-tight">MEMORIES</h1>
        <p className="text-white/40 text-sm max-w-md mx-auto leading-relaxed">
          Relive every moment. Real community. Real experiences. Download your memories.
        </p>
      </div>

      {fetching ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl h-72 animate-pulse" />
          ))}
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
          <Link
            href="/events"
            className="inline-block mt-2 bg-pink-600 hover:bg-pink-500 px-6 py-2.5 rounded-xl text-sm font-bold transition"
          >
            View Upcoming Events →
          </Link>
        </div>
      ) : (
        <div className="space-y-10">
          {featured.length > 0 && (
            <section className="space-y-4">
              <p className="text-white/25 text-[10px] font-bold uppercase tracking-widest">Featured</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {featured.map(a => <AlbumCard key={a.id} album={a} featured />)}
              </div>
            </section>
          )}
          <section className="space-y-4">
            {featured.length > 0 && (
              <p className="text-white/25 text-[10px] font-bold uppercase tracking-widest">All Experiences</p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {albums.map(a => <AlbumCard key={a.id} album={a} />)}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
