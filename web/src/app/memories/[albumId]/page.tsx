"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import {
  collection, getDocs, getDoc, doc, addDoc, deleteDoc,
  query, where, serverTimestamp, updateDoc, arrayUnion, arrayRemove, Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────

interface MemoryAlbum {
  id: string;
  title: string;
  eventDate: string;
  eventId?: string;
  description?: string;
  coverImageUrl?: string;
  location?: string;
  category?: string;
  episodeNumber?: number;
  focalX?: number;
  focalY?: number;
  zoom?: number;
  photoCount: number;
  videoCount: number;
  creatorCount: number;
  attendeeCount: number;
  isFeatured?: boolean;
}

interface MemoryMedia {
  id: string;
  albumId: string;
  type: "photo" | "video" | "creator_content";
  url: string;
  thumbnailUrl?: string;
  caption?: string;
  isPinned: boolean;
  isFeatured?: boolean;
  featuredOrder?: number;
  creatorName?: string;
  creatorRole?: string;
  uploadedByName: string;
  createdAt: Timestamp | string;
  likedBy?: string[];
}

interface MemoryComment {
  id: string;
  albumId: string;
  userId: string;
  displayName: string;
  text: string;
  createdAt: Timestamp | string;
}

interface AlbumAttendee {
  id: string;
  userId: string;
  userEmail: string;
  userName?: string;
  isFoundingMember?: boolean;
  isCreator?: boolean;
  membershipTier?: string;
  source?: string;
  status?: string;
}

type Tab = "photos" | "videos" | "creator" | "comments";

// ─── Helpers ──────────────────────────────────────────────

function toMillis(ts: Timestamp | string | undefined): number {
  if (!ts) return 0;
  if (ts instanceof Timestamp) return ts.toMillis();
  try { return new Date(ts as string).getTime(); } catch { return 0; }
}

function formatEventDate(dateStr: string) {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-CA", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });
  } catch { return dateStr; }
}

function formatCommentTime(ts: Timestamp | string) {
  try {
    const d = ts instanceof Timestamp ? ts.toDate() : new Date(ts as string);
    return d.toLocaleDateString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
  } catch { return ""; }
}

function getVideoEmbed(url: string): { isYoutube: boolean; embedSrc: string } {
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/);
  if (ytMatch) return { isYoutube: true, embedSrc: `https://www.youtube.com/embed/${ytMatch[1]}` };
  return { isYoutube: false, embedSrc: url };
}

async function downloadMedia(url: string, filename: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
  } catch {
    window.open(url, "_blank");
  }
}

// ─── Sub-components ───────────────────────────────────────

function FeaturedCard({
  item,
  onPhotoClick,
  onVideoClick,
}: {
  item: MemoryMedia;
  onPhotoClick: () => void;
  onVideoClick: () => void;
}) {
  const isPhoto = item.type === "photo";
  const imageSrc = isPhoto ? item.url : item.thumbnailUrl;

  return (
    <div
      className="relative shrink-0 w-56 aspect-video rounded-xl overflow-hidden cursor-pointer group border border-white/10 hover:border-pink-500/30 transition-colors bg-white/5"
      onClick={isPhoto ? onPhotoClick : onVideoClick}
    >
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={item.caption ?? ""}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-pink-950/50 via-black to-purple-950/40" />
      )}
      {!isPhoto && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/25">
          <div className="w-10 h-10 rounded-full bg-white/20 group-hover:bg-white/35 backdrop-blur-sm flex items-center justify-center transition-colors border border-white/20">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white" className="ml-0.5">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      {item.caption && (
        <p className="absolute bottom-2 left-2 right-2 text-white text-xs line-clamp-1 opacity-0 group-hover:opacity-100 transition-opacity drop-shadow">
          {item.caption}
        </p>
      )}
    </div>
  );
}

function AttendeeCard({ attendee }: { attendee: AlbumAttendee }) {
  const name = attendee.userName ?? attendee.userEmail ?? "Member";
  const initial = name[0].toUpperCase();
  return (
    <div className="shrink-0 w-36 bg-white/[0.03] border border-white/10 rounded-2xl p-4 flex flex-col items-center gap-2.5 text-center">
      <div className="w-11 h-11 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-base font-bold text-white/70">
        {initial}
      </div>
      <div className="space-y-1.5 w-full">
        <p className="text-white/75 text-xs font-semibold truncate">{name}</p>
        <div className="flex flex-wrap justify-center gap-1">
          <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold bg-emerald-900/40 border border-emerald-700/40 text-emerald-300 uppercase tracking-wide">
            Member
          </span>
          {attendee.isCreator && (
            <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold bg-purple-900/40 border border-purple-700/40 text-purple-300 uppercase tracking-wide">
              Creator
            </span>
          )}
          {attendee.isFoundingMember && (
            <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold bg-amber-900/40 border border-amber-700/40 text-amber-400 uppercase tracking-wide">
              F15
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function MasonryPhotoGrid({
  photos,
  userId,
  onOpen,
  onLike,
}: {
  photos: MemoryMedia[];
  userId: string;
  onOpen: (i: number) => void;
  onLike: (item: MemoryMedia) => void;
}) {
  if (photos.length === 0) {
    return (
      <div className="text-center py-20 space-y-3 text-white/30">
        <p className="text-5xl">📸</p>
        <p className="font-semibold text-white/50">Photos coming soon.</p>
        <p className="text-sm max-w-xs mx-auto leading-relaxed">
          Check back after the event for official photos, videos, creator content, and downloadable memories.
        </p>
      </div>
    );
  }
  return (
    <div className="columns-2 sm:columns-3 gap-3">
      {photos.map((photo, i) => {
        const liked = (photo.likedBy ?? []).includes(userId);
        const likeCount = (photo.likedBy ?? []).length;
        return (
          <div
            key={photo.id}
            className="break-inside-avoid mb-3 group relative overflow-hidden rounded-xl bg-white/5 cursor-pointer"
            onClick={() => onOpen(i)}
          >
            <img
              src={photo.url}
              alt={photo.caption ?? ""}
              className="w-full block transition-transform duration-300 group-hover:scale-[1.02]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <button
              onClick={(e) => { e.stopPropagation(); onLike(photo); }}
              className="absolute bottom-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition bg-black/60 backdrop-blur-sm rounded-full px-2 py-1 text-xs"
            >
              <span>{liked ? "❤️" : "🤍"}</span>
              {likeCount > 0 && <span className="text-white/70">{likeCount}</span>}
            </button>
            {photo.isPinned && (
              <span className="absolute top-2 left-2 bg-pink-600/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                📌
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function VideoGrid({
  videos,
  userId,
  onLike,
}: {
  videos: MemoryMedia[];
  userId: string;
  onLike: (item: MemoryMedia) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (videos.length === 0) {
    return (
      <div className="text-center py-20 space-y-3 text-white/30">
        <p className="text-5xl">🎥</p>
        <p className="font-semibold text-white/50">Videos coming soon.</p>
        <p className="text-sm max-w-xs mx-auto leading-relaxed">
          Check back after the event for official photos, videos, creator content, and downloadable memories.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {videos.map(video => {
        const { isYoutube, embedSrc } = getVideoEmbed(video.url);
        const liked = (video.likedBy ?? []).includes(userId);
        const likeCount = (video.likedBy ?? []).length;
        const isOpen = expanded === video.id;
        return (
          <div key={video.id} className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
            {isOpen ? (
              <div className="w-full aspect-video bg-black">
                {isYoutube ? (
                  <iframe
                    src={embedSrc + "?autoplay=1"}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <video src={embedSrc} controls autoPlay className="w-full h-full" />
                )}
              </div>
            ) : (
              <button
                onClick={() => setExpanded(video.id)}
                className="w-full aspect-video bg-gradient-to-br from-pink-950/30 to-purple-950/30 flex items-center justify-center group relative overflow-hidden"
              >
                {video.thumbnailUrl && (
                  <img src={video.thumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-50" />
                )}
                <div className="relative z-10 w-16 h-16 rounded-full bg-white/20 group-hover:bg-white/30 backdrop-blur-sm border border-white/20 flex items-center justify-center transition">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white" className="ml-1">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </button>
            )}
            <div className="p-4 flex items-center justify-between gap-4">
              <div>
                {video.caption && <p className="text-white/80 text-sm font-medium">{video.caption}</p>}
                {video.creatorName && (
                  <p className="text-white/30 text-xs mt-0.5">
                    {video.creatorName}{video.creatorRole ? ` · ${video.creatorRole}` : ""}
                  </p>
                )}
              </div>
              <button
                onClick={() => onLike(video)}
                className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition shrink-0"
              >
                <span>{liked ? "❤️" : "🤍"}</span>
                {likeCount > 0 && <span>{likeCount}</span>}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CreatorGrid({
  items,
  userId,
  onLike,
}: {
  items: MemoryMedia[];
  userId: string;
  onLike: (item: MemoryMedia) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="text-center py-20 space-y-3 text-white/30">
        <p className="text-5xl">🎨</p>
        <p className="font-semibold text-white/50">Creator content coming soon.</p>
        <p className="text-sm max-w-xs mx-auto leading-relaxed">
          Check back after the event for official photos, videos, creator content, and downloadable memories.
        </p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      {items.map(item => {
        const liked = (item.likedBy ?? []).includes(userId);
        const likeCount = (item.likedBy ?? []).length;
        const { isYoutube, embedSrc } = getVideoEmbed(item.url);
        const isImage = item.url.match(/\.(jpg|jpeg|png|webp|gif)$/i);
        return (
          <div key={item.id} className="bg-white/[0.03] border border-purple-500/20 rounded-2xl overflow-hidden">
            <div className="aspect-video bg-purple-950/20">
              {isYoutube ? (
                <iframe src={embedSrc} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
              ) : isImage ? (
                <img src={item.url} alt={item.caption ?? ""} className="w-full h-full object-cover" />
              ) : (
                <video src={item.url} controls className="w-full h-full" />
              )}
            </div>
            <div className="p-4 flex items-start justify-between gap-3">
              <div className="space-y-1.5">
                {item.creatorName && (
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-purple-500/30 border border-purple-500/40 flex items-center justify-center text-xs font-bold text-purple-300">
                      {item.creatorName[0]}
                    </div>
                    <div>
                      <p className="text-white/80 text-sm font-semibold leading-none">{item.creatorName}</p>
                      {item.creatorRole && <p className="text-purple-300/50 text-xs mt-0.5">{item.creatorRole}</p>}
                    </div>
                  </div>
                )}
                {item.caption && <p className="text-white/50 text-sm">{item.caption}</p>}
              </div>
              <button
                onClick={() => onLike(item)}
                className="flex items-center gap-1 text-sm text-white/40 hover:text-white/70 transition shrink-0"
              >
                <span>{liked ? "❤️" : "🤍"}</span>
                {likeCount > 0 && <span className="text-xs">{likeCount}</span>}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CommentsSection({
  comments,
  commentText,
  setCommentText,
  submitting,
  onSubmit,
  onDelete,
  userId,
  isAdmin,
}: {
  comments: MemoryComment[];
  commentText: string;
  setCommentText: (v: string) => void;
  submitting: boolean;
  onSubmit: () => void;
  onDelete: (id: string, ownerId: string) => void;
  userId: string;
  isAdmin: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        <textarea
          value={commentText}
          onChange={e => setCommentText(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSubmit(); }
          }}
          placeholder="Share a memory or reaction..."
          rows={2}
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-pink-500/50 resize-none"
        />
        <button
          onClick={onSubmit}
          disabled={submitting || !commentText.trim()}
          className="self-end px-4 py-3 bg-pink-600 hover:bg-pink-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm font-bold transition"
        >
          {submitting ? "…" : "Post"}
        </button>
      </div>
      {comments.length === 0 ? (
        <div className="text-center py-12 text-white/25 text-sm">Be the first to share a memory.</div>
      ) : (
        <div className="space-y-4">
          {comments.map(c => (
            <div key={c.id} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-xs font-bold shrink-0">
                {c.displayName?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-sm font-semibold text-white/80">{c.displayName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white/20 text-xs">{formatCommentTime(c.createdAt)}</span>
                    {(c.userId === userId || isAdmin) && (
                      <button
                        onClick={() => onDelete(c.id, c.userId)}
                        className="text-white/20 hover:text-red-400 transition text-xs leading-none"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-white/60 text-sm leading-relaxed">{c.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Series Nav Card ──────────────────────────────────────

function SeriesNavCard({ album, direction }: { album: MemoryAlbum; direction: "prev" | "next" }) {
  return (
    <Link href={`/memories/${album.id}`} className="group flex-1 block">
      <div className={`flex items-center gap-3 p-4 rounded-2xl border border-white/10 hover:border-pink-500/25 bg-white/[0.02] hover:bg-white/[0.04] transition-all ${direction === "next" ? "flex-row-reverse text-right" : ""}`}>
        {album.coverImageUrl && (
          <img
            src={album.coverImageUrl}
            alt={album.title}
            className="w-14 h-14 rounded-xl object-cover shrink-0 border border-white/10"
          />
        )}
        <div className="min-w-0">
          <p className="text-white/25 text-[9px] font-bold uppercase tracking-widest mb-1">
            {direction === "prev" ? "← Previous" : "Next →"}
          </p>
          {album.episodeNumber && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-pink-600/80 text-white mb-1 inline-block">
              EP.{album.episodeNumber}
            </span>
          )}
          <p className="text-white/70 text-sm font-semibold leading-tight line-clamp-2 group-hover:text-white transition">{album.title}</p>
        </div>
      </div>
    </Link>
  );
}

// ─── Main page ────────────────────────────────────────────

export default function AlbumPage() {
  const params = useParams();
  const albumId = (Array.isArray(params?.albumId) ? params.albumId[0] : params?.albumId) ?? "";
  const { user, profile, isAdmin, hasCommunityAccess, loading } = useAuth();
  const router = useRouter();

  const [album, setAlbum] = useState<MemoryAlbum | null>(null);
  const [media, setMedia] = useState<MemoryMedia[]>([]);
  const [comments, setComments] = useState<MemoryComment[]>([]);
  const [attendees, setAttendees] = useState<AlbumAttendee[]>([]);
  const [seriesAlbums, setSeriesAlbums] = useState<MemoryAlbum[]>([]);
  const [fetching, setFetching] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("photos");
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [featuredVideoItem, setFeaturedVideoItem] = useState<MemoryMedia | null>(null);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Derived media sets
  const photos = media
    .filter(m => m.type === "photo")
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return toMillis(b.createdAt) - toMillis(a.createdAt);
    });

  const videos = media
    .filter(m => m.type === "video")
    .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

  const creatorContent = media
    .filter(m => m.type === "creator_content")
    .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

  const featuredMedia = media
    .filter(m => m.isFeatured)
    .sort((a, b) => (a.featuredOrder ?? 0) - (b.featuredOrder ?? 0));

  // Auth guard
  useEffect(() => {
    if (!loading && !user) router.push(`/login?redirect=/memories/${albumId}`);
  }, [loading, user, albumId, router]);

  // Load album + media + comments + attendees + series siblings
  useEffect(() => {
    if (!user || !albumId || !hasCommunityAccess) return;
    (async () => {
      setFetching(true);
      try {
        const albumSnap = await getDoc(doc(db, "memoryAlbums", albumId));
        if (!albumSnap.exists()) { router.push("/memories"); return; }
        const albumData = { id: albumSnap.id, ...albumSnap.data() } as MemoryAlbum;
        setAlbum(albumData);

        const [mediaSnap, commentSnap] = await Promise.all([
          getDocs(query(collection(db, "memoryMedia"), where("albumId", "==", albumId))),
          getDocs(query(collection(db, "memoryComments"), where("albumId", "==", albumId))),
        ]);
        setMedia(mediaSnap.docs.map(d => ({ id: d.id, ...d.data() } as MemoryMedia)));
        setComments(
          commentSnap.docs
            .map(d => ({ id: d.id, ...d.data() } as MemoryComment))
            .sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt))
        );

        // Load attendees if album is linked to an event
        if (albumData.eventId) {
          const attendeeSnap = await getDocs(
            query(collection(db, "eventPurchases"), where("eventId", "==", albumData.eventId))
          );
          const allAttendees = attendeeSnap.docs.map(d => ({ id: d.id, ...d.data() } as AlbumAttendee));
          setAttendees(allAttendees.filter(a => a.status === "confirmed" || !a.status));
        }

        // Load series siblings when category is set
        if (albumData.category) {
          const seriesSnap = await getDocs(
            query(collection(db, "memoryAlbums"),
              where("category", "==", albumData.category),
              where("status", "==", "active"))
          );
          const siblings = seriesSnap.docs
            .map(d => ({ id: d.id, ...d.data() } as MemoryAlbum))
            .filter(a => a.id !== albumId)
            .sort((a, b) => (a.episodeNumber ?? 99) - (b.episodeNumber ?? 99));
          setSeriesAlbums(siblings);
        }
      } finally {
        setFetching(false);
      }
    })();
  }, [user, albumId, hasCommunityAccess, router]);

  // Lightbox keyboard handler
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (featuredVideoItem) {
      if (e.key === "Escape") setFeaturedVideoItem(null);
      return;
    }
    if (lightboxIndex < 0) return;
    if (e.key === "Escape") setLightboxIndex(-1);
    if (e.key === "ArrowRight") setLightboxIndex(i => Math.min(i + 1, photos.length - 1));
    if (e.key === "ArrowLeft") setLightboxIndex(i => Math.max(i - 1, 0));
  }, [lightboxIndex, photos.length, featuredVideoItem]);

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  const submitComment = async () => {
    if (!user || !commentText.trim()) return;
    setSubmitting(true);
    try {
      const payload = {
        albumId,
        userId: user.uid,
        displayName: profile?.displayName ?? profile?.email ?? "Member",
        text: commentText.trim(),
        createdAt: serverTimestamp(),
      };
      const ref = await addDoc(collection(db, "memoryComments"), payload);
      setComments(prev => [...prev, { ...payload, id: ref.id, createdAt: new Date().toISOString() }]);
      setCommentText("");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteComment = async (id: string, ownerId: string) => {
    if (!user || (ownerId !== user.uid && !isAdmin)) return;
    await deleteDoc(doc(db, "memoryComments", id));
    setComments(prev => prev.filter(c => c.id !== id));
  };

  const toggleLike = async (item: MemoryMedia) => {
    if (!user) return;
    const liked = (item.likedBy ?? []).includes(user.uid);
    await updateDoc(doc(db, "memoryMedia", item.id), {
      likedBy: liked ? arrayRemove(user.uid) : arrayUnion(user.uid),
    });
    setMedia(prev => prev.map(m => m.id === item.id ? {
      ...m,
      likedBy: liked
        ? (m.likedBy ?? []).filter(id => id !== user.uid)
        : [...(m.likedBy ?? []), user.uid],
    } : m));
  };

  // ─── Render ───────────────────────────────────────────────

  if (loading || !user) return null;

  // Locked state
  if (!hasCommunityAccess) {
    return (
      <main className="max-w-5xl mx-auto px-6 py-12">
        <Link href="/memories" className="text-white/30 hover:text-white/60 text-sm transition inline-block mb-10">
          ← Memories
        </Link>
        <div className="text-center py-20 space-y-5">
          <p className="text-7xl">🔒</p>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Memories are for the community.</h2>
            <p className="text-white/40 text-sm max-w-md mx-auto leading-relaxed">
              Attend an ALL ACCESS event or become a monthly supporter to access event albums, recaps, and downloadable media.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-2">
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

  if (fetching) {
    return (
      <>
        <div className="h-[380px] bg-white/[0.03] animate-pulse" />
        <main className="max-w-5xl mx-auto px-6 py-10 space-y-6">
          <div className="h-4 bg-white/5 rounded w-24 animate-pulse" />
          <div className="h-9 bg-white/5 rounded-xl w-2/3 animate-pulse" />
          <div className="flex gap-3 mt-6">
            {[1, 2, 3].map(i => <div key={i} className="bg-white/5 rounded-xl w-56 aspect-video animate-pulse shrink-0" />)}
          </div>
          <div className="columns-2 sm:columns-3 gap-3 mt-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="break-inside-avoid mb-3 bg-white/5 rounded-xl animate-pulse" style={{ height: `${140 + (i % 3) * 40}px` }} />
            ))}
          </div>
        </main>
      </>
    );
  }

  if (!album) return null;

  const lightboxPhoto = lightboxIndex >= 0 ? photos[lightboxIndex] : null;

  // Series nav: find all siblings plus current sorted, locate prev/next
  const allSeriesSorted = [
    ...seriesAlbums,
    // current album stub for positioning
    { id: albumId, episodeNumber: album.episodeNumber ?? 99 } as MemoryAlbum,
  ].sort((a, b) => (a.episodeNumber ?? 99) - (b.episodeNumber ?? 99));
  const currentSeriesIdx = allSeriesSorted.findIndex(a => a.id === albumId);
  const prevAlbumStub = currentSeriesIdx > 0 ? allSeriesSorted[currentSeriesIdx - 1] : null;
  const nextAlbumStub = currentSeriesIdx < allSeriesSorted.length - 1 ? allSeriesSorted[currentSeriesIdx + 1] : null;
  const prevAlbum = prevAlbumStub ? seriesAlbums.find(a => a.id === prevAlbumStub.id) ?? null : null;
  const nextAlbum = nextAlbumStub ? seriesAlbums.find(a => a.id === nextAlbumStub.id) ?? null : null;

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "photos", label: "Photos", count: photos.length },
    { key: "videos", label: "Videos", count: videos.length },
    { key: "creator", label: "Creator", count: creatorContent.length },
    { key: "comments", label: "Comments", count: comments.length },
  ];

  return (
    <>
      {/* ── Full-width Hero Banner ─────────────────────────── */}
      <div className="relative h-[360px] md:h-[460px] overflow-hidden">
        {album.coverImageUrl ? (
          <img
            src={album.coverImageUrl}
            alt={album.title}
            className="w-full h-full object-cover"
            style={{
              objectPosition: `${album.focalX ?? 50}% ${album.focalY ?? 50}%`,
              transform: (album.zoom ?? 1) !== 1 ? `scale(${album.zoom})` : undefined,
              transformOrigin: `${album.focalX ?? 50}% ${album.focalY ?? 50}%`,
            }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-pink-950/60 via-[#080412] to-purple-950/50" />
        )}
        {/* Multi-layer gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#080412] via-[#080412]/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#080412]/70 to-transparent" />

        {/* Overlaid content */}
        <div className="absolute inset-0 flex flex-col justify-between p-6 md:p-10 max-w-5xl mx-auto w-full left-0 right-0">
          {/* Back link */}
          <Link href="/memories" className="text-white/40 hover:text-white/70 text-sm transition self-start">
            ← Memories
          </Link>

          {/* Album info */}
          <div className="space-y-3 max-w-xl">
            {(album.category || album.episodeNumber) && (
              <div className="flex items-center gap-2">
                {album.episodeNumber && (
                  <span className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-pink-600 text-white">
                    EP.{album.episodeNumber}
                  </span>
                )}
                {album.category && (
                  <span className="text-[9px] font-semibold px-2 py-1 rounded-full border border-white/20 text-white/50 uppercase">
                    {album.category}
                  </span>
                )}
              </div>
            )}
            <h1 className="text-3xl md:text-5xl font-black text-white leading-tight">{album.title}</h1>
            <p className="text-white/40 text-sm">
              {formatEventDate(album.eventDate)}{album.location ? ` · ${album.location}` : ""}
            </p>
            {album.description && (
              <p className="text-white/50 text-sm leading-relaxed line-clamp-2">{album.description}</p>
            )}
            <div className="flex items-center gap-4 text-sm text-white/30 pt-1">
              {(album.photoCount ?? 0) > 0 && <span>📸 {album.photoCount}</span>}
              {(album.videoCount ?? 0) > 0 && <span>🎥 {album.videoCount}</span>}
              {(album.attendeeCount ?? 0) > 0 && <span>👥 {album.attendeeCount}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-6 py-10 space-y-8">

        {/* ── Featured Moments ──────────────────────────────── */}
        {featuredMedia.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-white/25 text-[10px] font-bold uppercase tracking-widest">Featured Moments</p>
              <span className="text-white/20 text-xs">
                {featuredMedia.length} moment{featuredMedia.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-3 -mx-6 px-6" style={{ scrollbarWidth: "none" }}>
              {featuredMedia.map(item => (
                <FeaturedCard
                  key={item.id}
                  item={item}
                  onPhotoClick={() => {
                    const i = photos.findIndex(p => p.id === item.id);
                    setLightboxIndex(i >= 0 ? i : 0);
                  }}
                  onVideoClick={() => setFeaturedVideoItem(item)}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Who's In This Album ───────────────────────────── */}
        {attendees.length > 0 && (
          <section className="space-y-3">
            <p className="text-white/25 text-[10px] font-bold uppercase tracking-widest">Who&apos;s In This Album</p>
            <div className="flex gap-3 overflow-x-auto pb-3 -mx-6 px-6" style={{ scrollbarWidth: "none" }}>
              {attendees.map(a => <AttendeeCard key={a.id} attendee={a} />)}
            </div>
          </section>
        )}

        {/* ── Tabs ─────────────────────────────────────────── */}
        <div className="flex items-center gap-1 border-b border-white/10">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2.5 text-sm font-semibold transition border-b-2 -mb-px ${
                activeTab === t.key
                  ? "text-white border-pink-500"
                  : "text-white/40 border-transparent hover:text-white/70"
              }`}
            >
              {t.label}
              {t.count > 0 && (
                <span className={`ml-1.5 text-xs ${activeTab === t.key ? "text-pink-400" : "text-white/25"}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "photos" && (
          <MasonryPhotoGrid photos={photos} userId={user.uid} onOpen={setLightboxIndex} onLike={toggleLike} />
        )}
        {activeTab === "videos" && (
          <VideoGrid videos={videos} userId={user.uid} onLike={toggleLike} />
        )}
        {activeTab === "creator" && (
          <CreatorGrid items={creatorContent} userId={user.uid} onLike={toggleLike} />
        )}
        {activeTab === "comments" && (
          <CommentsSection
            comments={comments}
            commentText={commentText}
            setCommentText={setCommentText}
            submitting={submitting}
            onSubmit={submitComment}
            onDelete={deleteComment}
            userId={user.uid}
            isAdmin={isAdmin}
          />
        )}

        {/* ── Series Navigation ─────────────────────────────── */}
        {(prevAlbum || nextAlbum) && (
          <section className="pt-6 border-t border-white/10 space-y-4">
            <p className="text-white/25 text-[10px] font-bold uppercase tracking-widest">
              {album.category} Series
            </p>
            <div className="flex gap-4 flex-wrap sm:flex-nowrap">
              {prevAlbum && <SeriesNavCard album={prevAlbum} direction="prev" />}
              {nextAlbum && <SeriesNavCard album={nextAlbum} direction="next" />}
            </div>
          </section>
        )}
      </main>

      {/* ── Photo Lightbox ─────────────────────────────────── */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={() => setLightboxIndex(-1)}
        >
          <div className="absolute top-4 right-4 flex items-center gap-2 z-10" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => downloadMedia(lightboxPhoto.url, `memory-${lightboxPhoto.id}.jpg`)}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/15 px-3 py-2 rounded-lg text-xs font-semibold text-white transition"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
              </svg>
              Download
            </button>
            <button
              onClick={() => setLightboxIndex(-1)}
              className="bg-white/10 hover:bg-white/20 border border-white/15 w-9 h-9 rounded-lg text-white/60 hover:text-white transition flex items-center justify-center text-lg leading-none"
            >
              ✕
            </button>
          </div>

          {lightboxIndex > 0 && (
            <button
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 border border-white/15 w-10 h-10 rounded-full flex items-center justify-center text-white text-2xl transition z-10"
              onClick={e => { e.stopPropagation(); setLightboxIndex(i => i - 1); }}
            >
              ‹
            </button>
          )}

          {lightboxIndex < photos.length - 1 && (
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 border border-white/15 w-10 h-10 rounded-full flex items-center justify-center text-white text-2xl transition z-10"
              onClick={e => { e.stopPropagation(); setLightboxIndex(i => i + 1); }}
            >
              ›
            </button>
          )}

          <div
            className="max-w-4xl w-full px-16 flex flex-col items-center gap-3"
            onClick={e => e.stopPropagation()}
          >
            <img
              src={lightboxPhoto.url}
              alt={lightboxPhoto.caption ?? ""}
              className="max-w-full max-h-[75vh] object-contain rounded-xl"
            />
            {lightboxPhoto.caption && (
              <p className="text-white/45 text-sm text-center">{lightboxPhoto.caption}</p>
            )}
            <p className="text-white/20 text-xs">{lightboxIndex + 1} / {photos.length}</p>
          </div>
        </div>
      )}

      {/* ── Featured Video Modal ────────────────────────────── */}
      {featuredVideoItem && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={() => setFeaturedVideoItem(null)}
        >
          <button
            className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 border border-white/15 w-9 h-9 rounded-lg text-white/60 hover:text-white transition flex items-center justify-center text-lg z-10"
            onClick={() => setFeaturedVideoItem(null)}
          >
            ✕
          </button>
          <div className="max-w-3xl w-full px-6" onClick={e => e.stopPropagation()}>
            <div className="aspect-video bg-black rounded-xl overflow-hidden">
              {(() => {
                const { isYoutube, embedSrc } = getVideoEmbed(featuredVideoItem.url);
                return isYoutube ? (
                  <iframe
                    src={embedSrc + "?autoplay=1"}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <video src={embedSrc} controls autoPlay className="w-full h-full" />
                );
              })()}
            </div>
            {featuredVideoItem.caption && (
              <p className="text-white/40 text-sm text-center mt-3">{featuredVideoItem.caption}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
