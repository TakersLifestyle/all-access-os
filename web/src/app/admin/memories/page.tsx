"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import {
  collection, getDocs, doc, addDoc, deleteDoc, updateDoc,
  query, where, serverTimestamp, increment, Timestamp,
} from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────

interface MemoryAlbum {
  id: string;
  title: string;
  eventDate: string;
  eventId?: string;
  description: string;
  coverImageUrl: string;
  status: "active" | "draft";
  photoCount: number;
  videoCount: number;
  creatorCount: number;
  attendeeCount: number;
  isFeatured: boolean;
}

interface MemoryMedia {
  id: string;
  albumId: string;
  type: "photo" | "video" | "creator_content";
  url: string;
  thumbnailUrl?: string;
  caption: string;
  isPinned: boolean;
  isFeatured?: boolean;
  featuredOrder?: number;
  featuredAt?: Timestamp;
  creatorName?: string;
  creatorRole?: string;
  uploadedByName: string;
  createdAt: Timestamp | string;
  likedBy: string[];
}

interface EventOption {
  id: string;
  title: string;
  date?: string;
}

function toMillis(ts: Timestamp | string | undefined): number {
  if (!ts) return 0;
  if (ts instanceof Timestamp) return ts.toMillis();
  try { return new Date(ts as string).getTime(); } catch { return 0; }
}

// ─── Admin Memories Page ──────────────────────────────────

export default function AdminMemoriesPage() {
  const { user, profile, isAdmin, loading } = useAuth();
  const router = useRouter();

  const [albums, setAlbums] = useState<MemoryAlbum[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<MemoryAlbum | null>(null);
  const [media, setMedia] = useState<MemoryMedia[]>([]);
  const [fetching, setFetching] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [mediaTab, setMediaTab] = useState<"photo" | "video" | "creator_content">("photo");
  const [featuredLimitError, setFeaturedLimitError] = useState(false);

  // Create album form
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newStatus, setNewStatus] = useState<"active" | "draft">("draft");
  const [newFeatured, setNewFeatured] = useState(false);
  const [newEventId, setNewEventId] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [creatingAlbum, setCreatingAlbum] = useState(false);

  // Add video form
  const [videoUrl, setVideoUrl] = useState("");
  const [videoCaption, setVideoCaption] = useState("");
  const [videoThumbnail, setVideoThumbnail] = useState("");
  const [addingVideo, setAddingVideo] = useState(false);

  // Add creator content form
  const [creatorUrl, setCreatorUrl] = useState("");
  const [creatorCaption, setCreatorCaption] = useState("");
  const [creatorName, setCreatorName] = useState("");
  const [creatorRole, setCreatorRole] = useState("");
  const [creatorThumbnail, setCreatorThumbnail] = useState("");
  const [addingCreator, setAddingCreator] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !isAdmin) router.push("/");
  }, [loading, isAdmin, router]);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const [albumsSnap, eventsSnap] = await Promise.all([
        getDocs(collection(db, "memoryAlbums")),
        getDocs(collection(db, "events")),
      ]);
      const result = albumsSnap.docs.map(d => ({ id: d.id, ...d.data() } as MemoryAlbum));
      result.sort((a, b) => (b.eventDate ?? "").localeCompare(a.eventDate ?? ""));
      setAlbums(result);
      setEvents(eventsSnap.docs.map(d => ({ id: d.id, title: d.data().title as string, date: d.data().date as string | undefined })));
      setFetching(false);
    })();
  }, [isAdmin]);

  const loadMedia = async (albumId: string) => {
    const snap = await getDocs(
      query(collection(db, "memoryMedia"), where("albumId", "==", albumId))
    );
    const result = snap.docs.map(d => ({ id: d.id, ...d.data() } as MemoryMedia));
    result.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
    setMedia(result);
  };

  const selectAlbum = async (album: MemoryAlbum) => {
    setSelectedAlbum(album);
    setMedia([]);
    setFeaturedLimitError(false);
    await loadMedia(album.id);
  };

  const uploadCoverImage = async (file: File, albumId: string): Promise<string> => {
    const sRef = storageRef(storage, `memories/${albumId}/cover_${Date.now()}_${file.name}`);
    const snap = await uploadBytes(sRef, file);
    return getDownloadURL(snap.ref);
  };

  const createAlbum = async () => {
    if (!newTitle.trim() || !newDate) return;
    setCreatingAlbum(true);
    try {
      const albumData: Omit<MemoryAlbum, "id"> = {
        title: newTitle.trim(),
        eventDate: newDate,
        eventId: newEventId || undefined,
        description: newDesc.trim(),
        coverImageUrl: "",
        status: newStatus,
        photoCount: 0,
        videoCount: 0,
        creatorCount: 0,
        attendeeCount: 0,
        isFeatured: newFeatured,
      };
      const newRef = await addDoc(collection(db, "memoryAlbums"), {
        ...albumData,
        createdAt: serverTimestamp(),
      });

      let coverUrl = "";
      if (coverFile) {
        coverUrl = await uploadCoverImage(coverFile, newRef.id);
        await updateDoc(doc(db, "memoryAlbums", newRef.id), { coverImageUrl: coverUrl });
      }

      const created = { id: newRef.id, ...albumData, coverImageUrl: coverUrl };
      setAlbums(prev => [created, ...prev]);
      setNewTitle(""); setNewDate(""); setNewDesc(""); setNewFeatured(false);
      setNewStatus("draft"); setCoverFile(null); setNewEventId("");
      setShowCreateForm(false);
      await selectAlbum(created);
    } finally {
      setCreatingAlbum(false);
    }
  };

  const handlePhotoUpload = async (files: FileList) => {
    if (!selectedAlbum || !user) return;
    setUploading(true);
    const total = files.length;
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress(`Uploading ${i + 1} / ${total}…`);
        const sRef = storageRef(storage, `memories/${selectedAlbum.id}/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(sRef, file);
        const url = await getDownloadURL(snapshot.ref);
        await addDoc(collection(db, "memoryMedia"), {
          albumId: selectedAlbum.id,
          type: "photo",
          url,
          caption: "",
          isPinned: false,
          isFeatured: false,
          uploadedBy: user.uid,
          uploadedByName: profile?.displayName ?? profile?.email ?? "Admin",
          createdAt: serverTimestamp(),
          likedBy: [],
        });
        await updateDoc(doc(db, "memoryAlbums", selectedAlbum.id), { photoCount: increment(1) });
      }
      await loadMedia(selectedAlbum.id);
      setAlbums(prev => prev.map(a => a.id === selectedAlbum.id
        ? { ...a, photoCount: a.photoCount + total } : a));
    } finally {
      setUploading(false);
      setUploadProgress("");
    }
  };

  const addVideo = async () => {
    if (!selectedAlbum || !videoUrl.trim() || !user) return;
    setAddingVideo(true);
    try {
      await addDoc(collection(db, "memoryMedia"), {
        albumId: selectedAlbum.id,
        type: "video",
        url: videoUrl.trim(),
        thumbnailUrl: videoThumbnail.trim() || undefined,
        caption: videoCaption.trim(),
        isPinned: false,
        isFeatured: false,
        uploadedBy: user.uid,
        uploadedByName: profile?.displayName ?? profile?.email ?? "Admin",
        createdAt: serverTimestamp(),
        likedBy: [],
      });
      await updateDoc(doc(db, "memoryAlbums", selectedAlbum.id), { videoCount: increment(1) });
      setVideoUrl(""); setVideoCaption(""); setVideoThumbnail("");
      await loadMedia(selectedAlbum.id);
      setAlbums(prev => prev.map(a => a.id === selectedAlbum.id
        ? { ...a, videoCount: a.videoCount + 1 } : a));
    } finally {
      setAddingVideo(false);
    }
  };

  const addCreatorContent = async () => {
    if (!selectedAlbum || !creatorUrl.trim() || !user) return;
    setAddingCreator(true);
    try {
      await addDoc(collection(db, "memoryMedia"), {
        albumId: selectedAlbum.id,
        type: "creator_content",
        url: creatorUrl.trim(),
        thumbnailUrl: creatorThumbnail.trim() || undefined,
        caption: creatorCaption.trim(),
        creatorName: creatorName.trim(),
        creatorRole: creatorRole.trim(),
        isPinned: false,
        isFeatured: false,
        uploadedBy: user.uid,
        uploadedByName: profile?.displayName ?? profile?.email ?? "Admin",
        createdAt: serverTimestamp(),
        likedBy: [],
      });
      await updateDoc(doc(db, "memoryAlbums", selectedAlbum.id), { creatorCount: increment(1) });
      setCreatorUrl(""); setCreatorCaption(""); setCreatorName(""); setCreatorRole(""); setCreatorThumbnail("");
      await loadMedia(selectedAlbum.id);
      setAlbums(prev => prev.map(a => a.id === selectedAlbum.id
        ? { ...a, creatorCount: a.creatorCount + 1 } : a));
    } finally {
      setAddingCreator(false);
    }
  };

  const deleteMediaItem = async (item: MemoryMedia) => {
    if (!confirm(`Delete this ${item.type.replace(/_/g, " ")}?`)) return;
    await deleteDoc(doc(db, "memoryMedia", item.id));
    const countField = item.type === "photo" ? "photoCount" : item.type === "video" ? "videoCount" : "creatorCount";
    if (selectedAlbum) {
      await updateDoc(doc(db, "memoryAlbums", selectedAlbum.id), { [countField]: increment(-1) });
    }
    setMedia(prev => prev.filter(m => m.id !== item.id));
  };

  const togglePin = async (item: MemoryMedia) => {
    await updateDoc(doc(db, "memoryMedia", item.id), { isPinned: !item.isPinned });
    setMedia(prev => prev.map(m => m.id === item.id ? { ...m, isPinned: !m.isPinned } : m));
  };

  const toggleFeatured = async (item: MemoryMedia) => {
    if (item.isFeatured) {
      // Unfeature
      await updateDoc(doc(db, "memoryMedia", item.id), { isFeatured: false, featuredOrder: null, featuredAt: null });
      setMedia(prev => prev.map(m => m.id === item.id ? { ...m, isFeatured: false, featuredOrder: undefined } : m));
      setFeaturedLimitError(false);
    } else {
      // Check 10-item limit
      const currentFeaturedCount = media.filter(m => m.isFeatured && m.id !== item.id).length;
      if (currentFeaturedCount >= 10) {
        setFeaturedLimitError(true);
        return;
      }
      const order = Date.now();
      await updateDoc(doc(db, "memoryMedia", item.id), {
        isFeatured: true,
        featuredOrder: order,
        featuredAt: serverTimestamp(),
      });
      setMedia(prev => prev.map(m => m.id === item.id ? { ...m, isFeatured: true, featuredOrder: order } : m));
      setFeaturedLimitError(false);
    }
  };

  const toggleAlbumStatus = async (album: MemoryAlbum) => {
    const next = album.status === "active" ? "draft" : "active";
    await updateDoc(doc(db, "memoryAlbums", album.id), { status: next });
    setAlbums(prev => prev.map(a => a.id === album.id ? { ...a, status: next } : a));
    if (selectedAlbum?.id === album.id) setSelectedAlbum(prev => prev ? { ...prev, status: next } : prev);
  };

  if (loading || !isAdmin) return null;

  const filteredMedia = media.filter(m => m.type === mediaTab);
  const featuredCount = media.filter(m => m.isFeatured).length;

  return (
    <main className="max-w-6xl mx-auto px-6 py-12 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/admin" className="text-white/30 hover:text-white/60 text-sm transition">← Admin</Link>
        <h1 className="text-3xl font-bold">Manage Memories</h1>
        <button
          onClick={() => setShowCreateForm(v => !v)}
          className="ml-auto bg-pink-600 hover:bg-pink-500 px-4 py-2 rounded-xl text-sm font-bold transition"
        >
          {showCreateForm ? "Cancel" : "+ New Album"}
        </button>
      </div>

      {/* Create album form */}
      {showCreateForm && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
          <h2 className="font-bold text-white">Create Album</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-white/40 text-xs">Title *</label>
              <input
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="Founding 15 — Sea Bears Courtside Experience"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-pink-500/50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-white/40 text-xs">Event Date *</label>
              <input
                type="date"
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
                placeholder="2026-06-30"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500/50"
              />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <label className="text-white/40 text-xs">Description</label>
              <textarea
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                placeholder="Our very first ALL ACCESS Winnipeg experience. A sold-out courtside night built around community, connection, and unforgettable memories."
                rows={2}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-pink-500/50 resize-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-white/40 text-xs">Linked Event</label>
              <select
                value={newEventId}
                onChange={e => setNewEventId(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
              >
                <option value="">No linked event</option>
                {events.map(ev => (
                  <option key={ev.id} value={ev.id}>{ev.title}</option>
                ))}
              </select>
              <p className="text-white/20 text-[10px]">Links the album to event attendee records for "Who&apos;s In This Album"</p>
            </div>
            <div className="space-y-1">
              <label className="text-white/40 text-xs">Cover Image</label>
              <input
                type="file"
                ref={coverInputRef}
                accept="image/*"
                onChange={e => setCoverFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
              <button
                onClick={() => coverInputRef.current?.click()}
                className="w-full bg-white/5 border border-dashed border-white/15 rounded-xl px-4 py-2.5 text-sm text-white/40 hover:text-white/70 hover:border-white/30 transition text-left"
              >
                {coverFile ? coverFile.name : "Click to select cover image…"}
              </button>
            </div>
            <div className="space-y-1">
              <label className="text-white/40 text-xs">Status</label>
              <select
                value={newStatus}
                onChange={e => setNewStatus(e.target.value as "active" | "draft")}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
              >
                <option value="draft">Draft — hidden from members</option>
                <option value="active">Active — visible to members</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={newFeatured}
                onChange={e => setNewFeatured(e.target.checked)}
                className="w-4 h-4 accent-pink-500"
              />
              <span className="text-white/60 text-sm">Mark album as Featured on Memories page</span>
            </label>
            <button
              onClick={createAlbum}
              disabled={creatingAlbum || !newTitle.trim() || !newDate}
              className="ml-auto bg-pink-600 hover:bg-pink-500 disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2 rounded-xl text-sm font-bold transition"
            >
              {creatingAlbum ? "Creating…" : "Create Album"}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">
        {/* Album list */}
        <div className="space-y-2">
          <p className="text-white/25 text-[10px] font-bold uppercase tracking-widest px-1">Albums</p>
          {fetching ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="bg-white/5 rounded-xl h-16 animate-pulse" />)}
            </div>
          ) : albums.length === 0 ? (
            <div className="text-white/30 text-sm text-center py-8">No albums yet. Create one above.</div>
          ) : (
            albums.map(album => (
              <button
                key={album.id}
                onClick={() => selectAlbum(album)}
                className={`w-full text-left p-4 rounded-xl border transition space-y-1.5 ${
                  selectedAlbum?.id === album.id
                    ? "bg-pink-600/10 border-pink-500/40"
                    : "bg-white/[0.03] border-white/10 hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-white/80 text-sm font-semibold line-clamp-1">{album.title}</p>
                  <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                    album.status === "active"
                      ? "bg-emerald-500/15 border border-emerald-500/25 text-emerald-400"
                      : "bg-white/5 border border-white/10 text-white/30"
                  }`}>
                    {album.status}
                  </span>
                </div>
                <p className="text-white/25 text-xs">{album.eventDate}</p>
                <div className="flex items-center gap-3 text-white/25 text-xs">
                  <span>📸 {album.photoCount}</span>
                  <span>🎥 {album.videoCount}</span>
                  <span>🎨 {album.creatorCount}</span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Right panel */}
        {selectedAlbum ? (
          <div className="space-y-6">
            {/* Album info bar */}
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="space-y-1">
                  <h2 className="font-bold text-white text-lg">{selectedAlbum.title}</h2>
                  <p className="text-white/35 text-sm">{selectedAlbum.eventDate}</p>
                  <div className="flex items-center gap-3 text-sm text-white/30 pt-1 flex-wrap">
                    <span>📸 {selectedAlbum.photoCount}</span>
                    <span>🎥 {selectedAlbum.videoCount}</span>
                    <span>🎨 {selectedAlbum.creatorCount}</span>
                    <span className={`font-semibold ${featuredCount >= 10 ? "text-amber-400" : "text-white/30"}`}>
                      ⭐ {featuredCount}/10 Featured
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={`/memories/${selectedAlbum.id}`}
                    target="_blank"
                    className="text-white/40 hover:text-white text-xs border border-white/10 hover:border-white/25 px-3 py-1.5 rounded-lg transition"
                  >
                    Preview →
                  </Link>
                  <button
                    onClick={() => toggleAlbumStatus(selectedAlbum)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg transition border ${
                      selectedAlbum.status === "active"
                        ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400 hover:bg-red-500/10 hover:border-red-500/25 hover:text-red-400"
                        : "bg-white/5 border-white/15 text-white/50 hover:bg-emerald-500/10 hover:border-emerald-500/25 hover:text-emerald-400"
                    }`}
                  >
                    {selectedAlbum.status === "active" ? "Set Draft" : "Publish"}
                  </button>
                </div>
              </div>
            </div>

            {/* Featured limit warning */}
            {featuredLimitError && (
              <div className="bg-amber-950/30 border border-amber-500/25 rounded-xl px-4 py-3 flex items-center gap-3">
                <span className="text-amber-400">⚠️</span>
                <p className="text-amber-300 text-sm">
                  You can only feature up to 10 moments per album. Unfeature one to add another.
                </p>
                <button onClick={() => setFeaturedLimitError(false)} className="ml-auto text-amber-400/50 hover:text-amber-300 text-xs">✕</button>
              </div>
            )}

            {/* Media type tabs */}
            <div className="flex items-center gap-2 flex-wrap">
              {(["photo", "video", "creator_content"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setMediaTab(t)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                    mediaTab === t
                      ? "bg-pink-600/20 border border-pink-500/40 text-pink-300"
                      : "bg-white/5 border border-white/10 text-white/50 hover:text-white/80"
                  }`}
                >
                  {t === "photo" ? "📸 Photos" : t === "video" ? "🎥 Videos" : "🎨 Creator"}
                </button>
              ))}
            </div>

            {/* Photo upload */}
            {mediaTab === "photo" && (
              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 space-y-4">
                <h3 className="font-semibold text-white/70 text-sm">Upload Photos</h3>
                <input
                  type="file"
                  ref={photoInputRef}
                  accept="image/*"
                  multiple
                  onChange={e => e.target.files && handlePhotoUpload(e.target.files)}
                  className="hidden"
                />
                <button
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full border-2 border-dashed border-white/15 hover:border-pink-500/40 rounded-xl py-10 flex flex-col items-center gap-3 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? (
                    <>
                      <div className="w-8 h-8 border-2 border-pink-400/30 border-t-pink-400 rounded-full animate-spin" />
                      <p className="text-white/50 text-sm">{uploadProgress}</p>
                    </>
                  ) : (
                    <>
                      <span className="text-4xl">📸</span>
                      <p className="text-white/50 text-sm">Click to select photos — supports multiple files</p>
                      <p className="text-white/25 text-xs">JPG, PNG, WEBP · Uploaded to Firebase Storage</p>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Add video */}
            {mediaTab === "video" && (
              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 space-y-4">
                <h3 className="font-semibold text-white/70 text-sm">Add Video</h3>
                <p className="text-white/30 text-xs">Paste a YouTube URL or direct video URL</p>
                <div className="space-y-3">
                  <input
                    value={videoUrl}
                    onChange={e => setVideoUrl(e.target.value)}
                    placeholder="https://youtube.com/watch?v=... or direct video URL"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-pink-500/50"
                  />
                  <input
                    value={videoThumbnail}
                    onChange={e => setVideoThumbnail(e.target.value)}
                    placeholder="Thumbnail image URL (optional — shown in Featured Moments)"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-pink-500/50"
                  />
                  <input
                    value={videoCaption}
                    onChange={e => setVideoCaption(e.target.value)}
                    placeholder="Caption (optional)"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-pink-500/50"
                  />
                  <button
                    onClick={addVideo}
                    disabled={addingVideo || !videoUrl.trim()}
                    className="bg-pink-600 hover:bg-pink-500 disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2.5 rounded-xl text-sm font-bold transition"
                  >
                    {addingVideo ? "Adding…" : "Add Video"}
                  </button>
                </div>
              </div>
            )}

            {/* Add creator content */}
            {mediaTab === "creator_content" && (
              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 space-y-4">
                <h3 className="font-semibold text-white/70 text-sm">Add Creator Content</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    value={creatorName}
                    onChange={e => setCreatorName(e.target.value)}
                    placeholder="Creator name"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-purple-500/50"
                  />
                  <input
                    value={creatorRole}
                    onChange={e => setCreatorRole(e.target.value)}
                    placeholder="Role (e.g. Photographer, Videographer)"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-purple-500/50"
                  />
                  <div className="sm:col-span-2">
                    <input
                      value={creatorUrl}
                      onChange={e => setCreatorUrl(e.target.value)}
                      placeholder="YouTube URL, direct image or video URL"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-purple-500/50"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <input
                      value={creatorThumbnail}
                      onChange={e => setCreatorThumbnail(e.target.value)}
                      placeholder="Thumbnail image URL (optional — shown in Featured Moments)"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-purple-500/50"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <input
                      value={creatorCaption}
                      onChange={e => setCreatorCaption(e.target.value)}
                      placeholder="Caption or description (optional)"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-purple-500/50"
                    />
                  </div>
                </div>
                <button
                  onClick={addCreatorContent}
                  disabled={addingCreator || !creatorUrl.trim()}
                  className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2.5 rounded-xl text-sm font-bold transition"
                >
                  {addingCreator ? "Adding…" : "Add Creator Content"}
                </button>
              </div>
            )}

            {/* Media grid */}
            {filteredMedia.length > 0 && (
              <div className="space-y-3">
                <p className="text-white/25 text-[10px] font-bold uppercase tracking-widest">
                  {mediaTab === "photo" ? "Uploaded Photos" : mediaTab === "video" ? "Videos" : "Creator Content"} ({filteredMedia.length})
                </p>
                {mediaTab === "photo" ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {filteredMedia.map(item => (
                      <PhotoMediaItem
                        key={item.id}
                        item={item}
                        featuredCount={featuredCount}
                        onDelete={() => deleteMediaItem(item)}
                        onTogglePin={() => togglePin(item)}
                        onToggleFeatured={() => toggleFeatured(item)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredMedia.map(item => (
                      <ListMediaItem
                        key={item.id}
                        item={item}
                        featuredCount={featuredCount}
                        onDelete={() => deleteMediaItem(item)}
                        onToggleFeatured={() => toggleFeatured(item)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center py-24 text-white/20 text-sm">
            Select an album to manage its content
          </div>
        )}
      </div>
    </main>
  );
}

// ─── Media Item Components ────────────────────────────────

function PhotoMediaItem({
  item,
  featuredCount,
  onDelete,
  onTogglePin,
  onToggleFeatured,
}: {
  item: MemoryMedia;
  featuredCount: number;
  onDelete: () => void;
  onTogglePin: () => void;
  onToggleFeatured: () => void;
}) {
  const canFeature = item.isFeatured || featuredCount < 10;
  return (
    <div className="group relative aspect-square overflow-hidden rounded-xl bg-white/5">
      <img src={item.url} alt={item.caption} className="w-full h-full object-cover" />
      {item.isFeatured && (
        <div className="absolute top-1.5 left-1.5">
          <span className="bg-amber-500/80 text-black text-[8px] font-black px-1.5 py-0.5 rounded-full">⭐ FEATURED</span>
        </div>
      )}
      <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-2">
        <button
          onClick={onToggleFeatured}
          disabled={!canFeature}
          className={`w-full text-[10px] font-bold px-2 py-1 rounded-lg transition ${
            item.isFeatured
              ? "bg-amber-500/80 text-black hover:bg-amber-400"
              : canFeature
                ? "bg-white/20 text-white/80 hover:bg-amber-500/60 hover:text-black"
                : "bg-white/10 text-white/30 cursor-not-allowed"
          }`}
        >
          {item.isFeatured ? "⭐ Unfeature" : "☆ Feature"}
        </button>
        <button
          onClick={onTogglePin}
          className={`w-full text-[10px] px-2 py-1 rounded-lg transition ${item.isPinned ? "bg-pink-600/80 text-white" : "bg-white/15 text-white/70 hover:bg-white/25"}`}
        >
          {item.isPinned ? "📌 Pinned" : "Pin"}
        </button>
        <button
          onClick={onDelete}
          className="w-full text-[10px] px-2 py-1 rounded-lg bg-red-600/70 text-white hover:bg-red-500 transition"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function ListMediaItem({
  item,
  featuredCount,
  onDelete,
  onToggleFeatured,
}: {
  item: MemoryMedia;
  featuredCount: number;
  onDelete: () => void;
  onToggleFeatured: () => void;
}) {
  const canFeature = item.isFeatured || featuredCount < 10;
  return (
    <div className={`bg-white/[0.03] border rounded-xl p-4 flex items-start gap-4 ${item.isFeatured ? "border-amber-500/25" : "border-white/10"}`}>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          {item.isFeatured && (
            <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400">⭐ Featured</span>
          )}
          <p className="text-white/60 text-sm truncate">{item.url}</p>
        </div>
        {item.caption && <p className="text-white/30 text-xs">{item.caption}</p>}
        {item.creatorName && (
          <p className="text-purple-300/50 text-xs">{item.creatorName}{item.creatorRole ? ` · ${item.creatorRole}` : ""}</p>
        )}
        {item.thumbnailUrl && (
          <p className="text-white/20 text-[10px]">Thumbnail set</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onToggleFeatured}
          disabled={!canFeature}
          className={`text-xs font-bold px-2.5 py-1.5 rounded-lg transition border ${
            item.isFeatured
              ? "bg-amber-500/15 border-amber-500/25 text-amber-400 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400"
              : canFeature
                ? "bg-white/5 border-white/10 text-white/40 hover:bg-amber-500/10 hover:border-amber-500/20 hover:text-amber-400"
                : "bg-white/[0.02] border-white/[0.05] text-white/20 cursor-not-allowed"
          }`}
        >
          {item.isFeatured ? "Unfeature" : "Feature"}
        </button>
        <button
          onClick={onDelete}
          className="text-white/25 hover:text-red-400 transition text-sm w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-500/10"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
