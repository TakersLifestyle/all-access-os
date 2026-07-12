"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import {
  collection, getDocs, doc, addDoc, deleteDoc, updateDoc,
  query, where, serverTimestamp, increment, Timestamp,
} from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────

interface MemoryAlbum {
  id: string;
  title: string;
  eventDate: string;
  location?: string;
  category?: string;
  episodeNumber?: number;
  focalX?: number;
  focalY?: number;
  zoom?: number;
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
  storagePath?: string;
  thumbnailUrl?: string;
  caption: string;
  isPinned: boolean;
  isFeatured?: boolean;
  featuredOrder?: number;
  featuredAt?: Timestamp;
  creatorName?: string;
  creatorRole?: string;
  uploadedByName: string;
  downloadEnabled: boolean;
  likesCount: number;
  commentsCount: number;
  createdAt: Timestamp | string;
  likedBy: string[];
}

interface EventOption {
  id: string;
  title: string;
  date?: string;
}

interface UploadItem {
  id: string;
  name: string;
  progress: number;
  status: "queued" | "uploading" | "done" | "error";
}

function toMillis(ts: Timestamp | string | undefined): number {
  if (!ts) return 0;
  if (ts instanceof Timestamp) return ts.toMillis();
  try { return new Date(ts as string).getTime(); } catch { return 0; }
}

function slugify(str: string) {
  return str.toLowerCase()
    .replace(/[—–]/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ─── Main Page ────────────────────────────────────────────

export default function AdminMemoriesPage() {
  const { user, profile, isAdmin, loading } = useAuth();
  const router = useRouter();

  const [albums, setAlbums] = useState<MemoryAlbum[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<MemoryAlbum | null>(null);
  const [media, setMedia] = useState<MemoryMedia[]>([]);
  const [fetching, setFetching] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isPhotoDragOver, setIsPhotoDragOver] = useState(false);
  const [isVideoDragOver, setIsVideoDragOver] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [mediaTab, setMediaTab] = useState<"photo" | "video" | "creator_content">("photo");
  const [featuredLimitError, setFeaturedLimitError] = useState(false);

  // Create album form
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newStatus, setNewStatus] = useState<"active" | "draft">("draft");
  const [newFeatured, setNewFeatured] = useState(false);
  const [newEventId, setNewEventId] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [creatingAlbum, setCreatingAlbum] = useState(false);

  // Video form
  const [videoUrl, setVideoUrl] = useState("");
  const [videoCaption, setVideoCaption] = useState("");
  const [videoThumbnail, setVideoThumbnail] = useState("");
  const [addingVideo, setAddingVideo] = useState(false);

  // Creator content form
  const [creatorUrl, setCreatorUrl] = useState("");
  const [creatorCaption, setCreatorCaption] = useState("");
  const [creatorName, setCreatorName] = useState("");
  const [creatorRole, setCreatorRole] = useState("");
  const [creatorThumbnail, setCreatorThumbnail] = useState("");
  const [addingCreator, setAddingCreator] = useState(false);

  // Focal point editor state
  const [showFocalEditor, setShowFocalEditor] = useState(false);
  const [editFocalX, setEditFocalX] = useState(50);
  const [editFocalY, setEditFocalY] = useState(50);
  const [editZoom, setEditZoom] = useState(1);
  const [savingFocal, setSavingFocal] = useState(false);

  // Move photo state
  const [movingPhoto, setMovingPhoto] = useState<MemoryMedia | null>(null);
  const [moveTargetAlbumId, setMoveTargetAlbumId] = useState("");
  const [moving, setMoving] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [pendingUploadOpen, setPendingUploadOpen] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoUploadQueue, setVideoUploadQueue] = useState<UploadItem[]>([]);

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
      setEvents(eventsSnap.docs.map(d => ({
        id: d.id,
        title: d.data().title as string,
        date: d.data().date as string | undefined,
      })));
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

  const selectAlbum = async (album: MemoryAlbum, openFilePicker = false) => {
    setSelectedAlbum(album);
    setMedia([]);
    setFeaturedLimitError(false);
    setUploadQueue([]);
    setMediaTab("photo");
    setShowFocalEditor(false);
    setEditFocalX(album.focalX ?? 50);
    setEditFocalY(album.focalY ?? 50);
    setEditZoom(album.zoom ?? 1);
    if (openFilePicker) setPendingUploadOpen(true);
    await loadMedia(album.id);
  };

  useEffect(() => {
    if (pendingUploadOpen && selectedAlbum && photoInputRef.current) {
      setPendingUploadOpen(false);
      photoInputRef.current.click();
    }
  }, [pendingUploadOpen, selectedAlbum]);

  const uploadCoverImage = async (file: File, albumId: string): Promise<string> => {
    const sRef = storageRef(storage, `memories/${albumId}/covers/${Date.now()}_${file.name}`);
    const snap = await (await import("firebase/storage")).uploadBytes(sRef, file);
    return getDownloadURL(snap.ref);
  };

  const createAlbum = async () => {
    if (!newTitle.trim() || !newDate) return;
    setCreatingAlbum(true);
    try {
      const albumData = {
        title: newTitle.trim(),
        eventDate: newDate,
        location: newLocation.trim() || undefined,
        category: newCategory.trim() || undefined,
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

      const created: MemoryAlbum = { id: newRef.id, ...albumData, coverImageUrl: coverUrl };
      setAlbums(prev => [created, ...prev]);
      setNewTitle(""); setNewDate(""); setNewLocation(""); setNewCategory("");
      setNewDesc(""); setNewFeatured(false); setNewStatus("draft");
      setCoverFile(null); setNewEventId("");
      setShowCreateForm(false);
      await selectAlbum(created);
    } finally {
      setCreatingAlbum(false);
    }
  };

  const quickCreateSeaBears = () => {
    setNewTitle("Founding 15 — Sea Bears Courtside Experience");
    setNewDate("2026-06-30");
    setNewLocation("Canada Life Centre");
    setNewCategory("Founding 15");
    setNewDesc("Our first sold-out ALL ACCESS Winnipeg experience. A courtside night built around community, connection, and unforgettable memories.");
    setNewStatus("active");
    setNewFeatured(true);
    setNewEventId("2PsGI8PCNoIdCudbR8Sh");
    setShowCreateForm(true);
  };

  const handlePhotoUpload = useCallback(async (files: FileList | File[]) => {
    if (!selectedAlbum || !user) return;

    const fileArray = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (fileArray.length === 0) return;

    const ts = Date.now();
    const initialQueue: UploadItem[] = fileArray.map((f, i) => ({
      id: `${ts}-${i}`,
      name: f.name,
      progress: 0,
      status: "queued",
    }));
    setUploadQueue(initialQueue);
    setUploading(true);

    let completedCount = 0;

    await Promise.all(fileArray.map((file, i) => {
      const queueId = initialQueue[i].id;

      return new Promise<void>(resolve => {
        setUploadQueue(prev => prev.map(q => q.id === queueId ? { ...q, status: "uploading" } : q));

        const storagePath = `memories/${selectedAlbum.id}/photos/${ts}_${i}_${file.name}`;
        const sRef = storageRef(storage, storagePath);
        const task = uploadBytesResumable(sRef, file);

        task.on("state_changed",
          snapshot => {
            const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            setUploadQueue(prev => prev.map(q => q.id === queueId ? { ...q, progress: pct } : q));
          },
          () => {
            setUploadQueue(prev => prev.map(q => q.id === queueId ? { ...q, status: "error" } : q));
            resolve();
          },
          async () => {
            try {
              const url = await getDownloadURL(task.snapshot.ref);
              await addDoc(collection(db, "memoryMedia"), {
                albumId: selectedAlbum.id,
                type: "photo",
                url,
                storagePath,
                caption: "",
                isPinned: false,
                isFeatured: false,
                downloadEnabled: true,
                likesCount: 0,
                commentsCount: 0,
                uploadedBy: user.uid,
                uploadedByName: profile?.displayName ?? profile?.email ?? "Admin",
                createdAt: serverTimestamp(),
                likedBy: [],
              });
              await updateDoc(doc(db, "memoryAlbums", selectedAlbum.id), { photoCount: increment(1) });
              completedCount++;
              setUploadQueue(prev => prev.map(q => q.id === queueId ? { ...q, status: "done", progress: 100 } : q));
            } catch {
              setUploadQueue(prev => prev.map(q => q.id === queueId ? { ...q, status: "error" } : q));
            }
            resolve();
          }
        );
      });
    }));

    await loadMedia(selectedAlbum.id);
    setAlbums(prev => prev.map(a =>
      a.id === selectedAlbum.id ? { ...a, photoCount: a.photoCount + completedCount } : a
    ));
    setUploading(false);
    setTimeout(() => setUploadQueue([]), 5000);
  }, [selectedAlbum, user, profile]);

  const handleVideoUpload = useCallback(async (files: FileList | File[]) => {
    if (!selectedAlbum || !user) return;

    const fileArray = Array.from(files).filter(f => f.type.startsWith("video/"));
    if (fileArray.length === 0) return;

    const ts = Date.now();
    const initialQueue: UploadItem[] = fileArray.map((f, i) => ({
      id: `${ts}-${i}`,
      name: f.name,
      progress: 0,
      status: "queued",
    }));
    setVideoUploadQueue(initialQueue);
    setVideoUploading(true);

    await Promise.all(fileArray.map((file, i) => {
      const queueId = initialQueue[i].id;

      return new Promise<void>(resolve => {
        setVideoUploadQueue(prev => prev.map(q => q.id === queueId ? { ...q, status: "uploading" } : q));

        const storagePath = `memories/${selectedAlbum.id}/videos/${ts}_${i}_${file.name}`;
        const sRef = storageRef(storage, storagePath);
        const task = uploadBytesResumable(sRef, file);

        task.on("state_changed",
          snapshot => {
            const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            setVideoUploadQueue(prev => prev.map(q => q.id === queueId ? { ...q, progress: pct } : q));
          },
          () => {
            setVideoUploadQueue(prev => prev.map(q => q.id === queueId ? { ...q, status: "error" } : q));
            resolve();
          },
          async () => {
            try {
              const url = await getDownloadURL(task.snapshot.ref);
              await addDoc(collection(db, "memoryMedia"), {
                albumId: selectedAlbum.id,
                type: "video",
                url,
                storagePath,
                caption: "",
                isPinned: false,
                isFeatured: false,
                downloadEnabled: true,
                likesCount: 0,
                commentsCount: 0,
                uploadedBy: user.uid,
                uploadedByName: profile?.displayName ?? profile?.email ?? "Admin",
                createdAt: serverTimestamp(),
                likedBy: [],
              });
              await updateDoc(doc(db, "memoryAlbums", selectedAlbum.id), { videoCount: increment(1) });
              setVideoUploadQueue(prev => prev.map(q => q.id === queueId ? { ...q, status: "done", progress: 100 } : q));
            } catch {
              setVideoUploadQueue(prev => prev.map(q => q.id === queueId ? { ...q, status: "error" } : q));
            }
            resolve();
          }
        );
      });
    }));

    await loadMedia(selectedAlbum.id);
    setVideoUploading(false);
    setTimeout(() => setVideoUploadQueue([]), 5000);
  }, [selectedAlbum, user, profile]);

  const setAsCover = async (url: string) => {
    if (!selectedAlbum) return;
    await updateDoc(doc(db, "memoryAlbums", selectedAlbum.id), { coverImageUrl: url });
    setSelectedAlbum(prev => prev ? { ...prev, coverImageUrl: url } : prev);
    setAlbums(prev => prev.map(a => a.id === selectedAlbum.id ? { ...a, coverImageUrl: url } : a));
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
        downloadEnabled: false,
        likesCount: 0,
        commentsCount: 0,
        uploadedBy: user.uid,
        uploadedByName: profile?.displayName ?? profile?.email ?? "Admin",
        createdAt: serverTimestamp(),
        likedBy: [],
      });
      await updateDoc(doc(db, "memoryAlbums", selectedAlbum.id), { videoCount: increment(1) });
      setVideoUrl(""); setVideoCaption(""); setVideoThumbnail("");
      await loadMedia(selectedAlbum.id);
      setAlbums(prev => prev.map(a => a.id === selectedAlbum.id ? { ...a, videoCount: a.videoCount + 1 } : a));
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
        downloadEnabled: true,
        likesCount: 0,
        commentsCount: 0,
        uploadedBy: user.uid,
        uploadedByName: profile?.displayName ?? profile?.email ?? "Admin",
        createdAt: serverTimestamp(),
        likedBy: [],
      });
      await updateDoc(doc(db, "memoryAlbums", selectedAlbum.id), { creatorCount: increment(1) });
      setCreatorUrl(""); setCreatorCaption(""); setCreatorName(""); setCreatorRole(""); setCreatorThumbnail("");
      await loadMedia(selectedAlbum.id);
      setAlbums(prev => prev.map(a => a.id === selectedAlbum.id ? { ...a, creatorCount: a.creatorCount + 1 } : a));
    } finally {
      setAddingCreator(false);
    }
  };

  const saveFocalPoint = async () => {
    if (!selectedAlbum) return;
    setSavingFocal(true);
    try {
      await updateDoc(doc(db, "memoryAlbums", selectedAlbum.id), {
        focalX: editFocalX,
        focalY: editFocalY,
        zoom: editZoom,
      });
      setSelectedAlbum(prev => prev ? { ...prev, focalX: editFocalX, focalY: editFocalY, zoom: editZoom } : prev);
      setAlbums(prev => prev.map(a => a.id === selectedAlbum.id ? { ...a, focalX: editFocalX, focalY: editFocalY, zoom: editZoom } : a));
      setShowFocalEditor(false);
    } finally {
      setSavingFocal(false);
    }
  };

  const movePhoto = async () => {
    if (!movingPhoto || !moveTargetAlbumId || !selectedAlbum) return;
    setMoving(true);
    try {
      await updateDoc(doc(db, "memoryMedia", movingPhoto.id), { albumId: moveTargetAlbumId });
      const srcCountField = movingPhoto.type === "photo" ? "photoCount" : movingPhoto.type === "video" ? "videoCount" : "creatorCount";
      await updateDoc(doc(db, "memoryAlbums", selectedAlbum.id), { [srcCountField]: increment(-1) });
      await updateDoc(doc(db, "memoryAlbums", moveTargetAlbumId), { [srcCountField]: increment(1) });
      setMedia(prev => prev.filter(m => m.id !== movingPhoto.id));
      setAlbums(prev => prev.map(a => {
        if (a.id === selectedAlbum.id) return { ...a, [srcCountField]: a[srcCountField as keyof MemoryAlbum] as number - 1 };
        if (a.id === moveTargetAlbumId) return { ...a, [srcCountField]: a[srcCountField as keyof MemoryAlbum] as number + 1 };
        return a;
      }));
      setMovingPhoto(null);
      setMoveTargetAlbumId("");
    } finally {
      setMoving(false);
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
      await updateDoc(doc(db, "memoryMedia", item.id), { isFeatured: false, featuredOrder: null, featuredAt: null });
      setMedia(prev => prev.map(m => m.id === item.id ? { ...m, isFeatured: false, featuredOrder: undefined } : m));
      setFeaturedLimitError(false);
    } else {
      const currentFeaturedCount = media.filter(m => m.isFeatured && m.id !== item.id).length;
      if (currentFeaturedCount >= 10) { setFeaturedLimitError(true); return; }
      const order = Date.now();
      await updateDoc(doc(db, "memoryMedia", item.id), {
        isFeatured: true, featuredOrder: order, featuredAt: serverTimestamp(),
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

  const deleteAlbum = async (album: MemoryAlbum) => {
    if (!confirm(`Delete album "${album.title}"?\n\nThis removes the album. Media files in Storage will remain — delete them manually from Firebase Console if needed.`)) return;
    await deleteDoc(doc(db, "memoryAlbums", album.id));
    setAlbums(prev => prev.filter(a => a.id !== album.id));
    if (selectedAlbum?.id === album.id) { setSelectedAlbum(null); setMedia([]); }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setIsPhotoDragOver(false);
    setIsVideoDragOver(false);
    if (!selectedAlbum) return;
    const files = e.dataTransfer.files;
    if (files.length === 0) return;
    if (mediaTab === "photo") handlePhotoUpload(files);
    else if (mediaTab === "video") handleVideoUpload(files);
  }, [selectedAlbum, mediaTab, handlePhotoUpload, handleVideoUpload]);

  if (loading || !isAdmin) return null;

  const filteredMedia = media.filter(m => m.type === mediaTab);
  const featuredCount = media.filter(m => m.isFeatured).length;
  const slugPreview = slugify(newTitle);
  const doneCount = uploadQueue.filter(q => q.status === "done").length;
  const errorCount = uploadQueue.filter(q => q.status === "error").length;

  return (
    <main
      className="max-w-6xl mx-auto px-6 py-12 space-y-8"
      onDragOver={e => { e.preventDefault(); if (selectedAlbum && (mediaTab === "photo" || mediaTab === "video")) setIsDragOver(true); }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false); }}
      onDrop={onDrop}
    >
      {/* Move Photo Modal */}
      {movingPhoto && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6" onClick={() => setMovingPhoto(null)}>
          <div className="bg-[#0e0a1a] border border-white/15 rounded-2xl p-6 w-full max-w-sm space-y-5" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-white">Move Photo to Album</h3>
            {movingPhoto.url && (
              <img src={movingPhoto.url} alt="" className="w-full h-36 object-cover rounded-xl border border-white/10" />
            )}
            <div className="space-y-2">
              <label className="text-white/40 text-xs">Destination Album</label>
              <select
                value={moveTargetAlbumId}
                onChange={e => setMoveTargetAlbumId(e.target.value)}
                className="w-full bg-[#0e0a1a] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500/50"
              >
                <option value="">Select album…</option>
                {albums.filter(a => a.id !== selectedAlbum?.id).map(a => (
                  <option key={a.id} value={a.id}>{a.title}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => { setMovingPhoto(null); setMoveTargetAlbumId(""); }}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border border-white/10 text-white/50 hover:text-white/80 transition"
              >
                Cancel
              </button>
              <button
                onClick={movePhoto}
                disabled={!moveTargetAlbumId || moving}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold bg-pink-600 hover:bg-pink-500 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                {moving ? "Moving…" : "Move →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isDragOver && (
        <div className="fixed inset-0 z-50 bg-pink-950/80 border-4 border-dashed border-pink-400/60 flex items-center justify-center pointer-events-none">
          <div className="text-center space-y-3">
            <p className="text-6xl">{mediaTab === "video" ? "🎥" : "📸"}</p>
            <p className="text-white text-2xl font-bold">Drop {mediaTab === "video" ? "videos" : "photos"} to upload</p>
            <p className="text-white/50 text-sm">to {selectedAlbum?.title}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/admin" className="text-white/30 hover:text-white/60 text-sm transition">← Admin</Link>
        <h1 className="text-3xl font-bold">Manage Memories</h1>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <button
            onClick={quickCreateSeaBears}
            className="text-xs font-bold px-3 py-2 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition"
          >
            ⚡ Quick: Sea Bears Album
          </button>
          <button
            onClick={() => { setShowCreateForm(v => !v); }}
            className="bg-pink-600 hover:bg-pink-500 px-4 py-2 rounded-xl text-sm font-bold transition"
          >
            {showCreateForm ? "Cancel" : "+ New Album"}
          </button>
        </div>
      </div>

      {/* Create album form */}
      {showCreateForm && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-white">Create Album</h2>
            {slugPreview && (
              <p className="text-white/25 text-xs font-mono">/{slugPreview}</p>
            )}
          </div>
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
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500/50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-white/40 text-xs">Location</label>
              <input
                value={newLocation}
                onChange={e => setNewLocation(e.target.value)}
                placeholder="Canada Life Centre"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-pink-500/50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-white/40 text-xs">Category</label>
              <input
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                placeholder="Founding 15, Nightlife, Social…"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-pink-500/50"
              />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <label className="text-white/40 text-xs">Description</label>
              <textarea
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                placeholder="Our first sold-out ALL ACCESS Winnipeg experience. A courtside night built around community, connection, and unforgettable memories."
                rows={2}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-pink-500/50 resize-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-white/40 text-xs">Linked Event</label>
              <select
                value={newEventId}
                onChange={e => setNewEventId(e.target.value)}
                className="w-full bg-[#0e0a1a] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
              >
                <option value="">No linked event</option>
                {events.map(ev => (
                  <option key={ev.id} value={ev.id}>{ev.title}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-white/40 text-xs">Cover Image</label>
              <input type="file" ref={coverInputRef} accept="image/*" onChange={e => setCoverFile(e.target.files?.[0] ?? null)} className="hidden" />
              <button
                onClick={() => coverInputRef.current?.click()}
                className="w-full bg-white/5 border border-dashed border-white/15 rounded-xl px-4 py-2.5 text-sm text-white/40 hover:text-white/70 hover:border-white/30 transition text-left"
              >
                {coverFile ? `✓ ${coverFile.name}` : "Click to select cover image…"}
              </button>
            </div>
            <div className="space-y-1">
              <label className="text-white/40 text-xs">Status</label>
              <select
                value={newStatus}
                onChange={e => setNewStatus(e.target.value as "active" | "draft")}
                className="w-full bg-[#0e0a1a] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
              >
                <option value="draft">Draft — hidden from members</option>
                <option value="active">Published — visible to members</option>
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
              <span className="text-white/60 text-sm">Featured on Memories page</span>
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

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-start">
        {/* Album list */}
        <div className="space-y-2">
          <p className="text-white/25 text-[10px] font-bold uppercase tracking-widest px-1">
            Albums ({albums.length})
          </p>
          {fetching ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="bg-white/5 rounded-xl h-20 animate-pulse" />)}
            </div>
          ) : albums.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <p className="text-white/20 text-sm">No albums yet.</p>
              <button onClick={quickCreateSeaBears} className="text-xs text-amber-400/70 hover:text-amber-400 transition">
                ⚡ Quick-create Sea Bears album →
              </button>
            </div>
          ) : (
            albums.map(album => (
              <AlbumCard
                key={album.id}
                album={album}
                isSelected={selectedAlbum?.id === album.id}
                onSelect={() => selectAlbum(album)}
                onUpload={() => selectAlbum(album, true)}
                onToggleStatus={() => toggleAlbumStatus(album)}
                onDelete={() => deleteAlbum(album)}
              />
            ))
          )}
        </div>

        {/* Right panel */}
        {selectedAlbum ? (
          <div className="space-y-5">
            {/* Always-rendered hidden file inputs — keeps refs stable */}
            <input
              type="file"
              ref={photoInputRef}
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => {
                if (e.target.files) { handlePhotoUpload(e.target.files); e.target.value = ""; }
              }}
            />
            <input
              type="file"
              ref={videoInputRef}
              accept="video/*"
              multiple
              className="hidden"
              onChange={e => {
                if (e.target.files) { handleVideoUpload(e.target.files); e.target.value = ""; }
              }}
            />
            {/* Album info bar */}
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
              <div className="flex items-start gap-4 flex-wrap">
                {selectedAlbum.coverImageUrl && (
                  <img
                    src={selectedAlbum.coverImageUrl}
                    alt="cover"
                    className="w-16 h-16 rounded-xl object-cover border border-white/10 shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0 space-y-1">
                  <h2 className="font-bold text-white text-lg leading-tight">{selectedAlbum.title}</h2>
                  <p className="text-white/35 text-sm">
                    {selectedAlbum.eventDate}{selectedAlbum.location ? ` · ${selectedAlbum.location}` : ""}
                    {selectedAlbum.category ? ` · ${selectedAlbum.category}` : ""}
                  </p>
                  <div className="flex items-center gap-3 text-sm text-white/30 pt-1 flex-wrap">
                    <span>📸 {selectedAlbum.photoCount}</span>
                    <span>🎥 {selectedAlbum.videoCount}</span>
                    <span>🎨 {selectedAlbum.creatorCount}</span>
                    <span className={featuredCount >= 10 ? "text-amber-400 font-semibold" : ""}>
                      ⭐ {featuredCount}/10 Featured
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {selectedAlbum.coverImageUrl && (
                    <button
                      onClick={() => {
                        const next = !showFocalEditor;
                        setShowFocalEditor(next);
                        if (next) {
                          setEditFocalX(selectedAlbum.focalX ?? 50);
                          setEditFocalY(selectedAlbum.focalY ?? 50);
                          setEditZoom(selectedAlbum.zoom ?? 1);
                        }
                      }}
                      className={`text-xs border px-3 py-1.5 rounded-lg transition ${showFocalEditor ? "bg-pink-600/20 border-pink-500/40 text-pink-300" : "text-white/40 hover:text-white border-white/10 hover:border-white/25"}`}
                    >
                      {showFocalEditor ? "Close Editor" : "Adjust Position"}
                    </button>
                  )}
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

            {/* Focal point editor */}
            {showFocalEditor && selectedAlbum.coverImageUrl && (
              <div className="bg-white/[0.03] border border-pink-500/20 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-white text-sm">Adjust Cover Position</h3>
                    <p className="text-white/30 text-xs mt-0.5">Click on the image to set the focal point — the hero banner will center there.</p>
                  </div>
                  <button onClick={() => setShowFocalEditor(false)} className="text-white/30 hover:text-white text-sm transition">✕</button>
                </div>

                {/* Click-to-set preview */}
                <div
                  className="relative w-full overflow-hidden rounded-xl cursor-crosshair bg-black select-none"
                  style={{ height: "220px" }}
                  onClick={e => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
                    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
                    setEditFocalX(Math.max(0, Math.min(100, x)));
                    setEditFocalY(Math.max(0, Math.min(100, y)));
                  }}
                >
                  <img
                    src={selectedAlbum.coverImageUrl}
                    alt="Cover preview"
                    className="w-full h-full object-cover pointer-events-none"
                    style={{
                      objectPosition: `${editFocalX}% ${editFocalY}%`,
                      transform: editZoom !== 1 ? `scale(${editZoom})` : undefined,
                      transformOrigin: `${editFocalX}% ${editFocalY}%`,
                    }}
                    draggable={false}
                  />
                  {/* Focal crosshair */}
                  <div
                    className="absolute pointer-events-none"
                    style={{ left: `${editFocalX}%`, top: `${editFocalY}%`, transform: "translate(-50%,-50%)" }}
                  >
                    <div className="w-7 h-7 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)] relative">
                      <div className="absolute top-1/2 -left-4 right-1/2 h-px bg-white opacity-70" />
                      <div className="absolute top-1/2 left-1/2 -right-4 h-px bg-white opacity-70" />
                      <div className="absolute left-1/2 -top-4 bottom-1/2 w-px bg-white opacity-70" />
                      <div className="absolute left-1/2 top-1/2 -bottom-4 w-px bg-white opacity-70" />
                    </div>
                  </div>
                  <p className="absolute bottom-2 right-2 text-white/50 text-[9px] bg-black/60 px-2 py-0.5 rounded-full pointer-events-none">
                    Click to move focal point
                  </p>
                </div>

                {/* Sliders */}
                <div className="grid grid-cols-2 gap-x-5 gap-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-white/40 text-xs">Horizontal (X)</label>
                      <span className="text-white/25 text-xs tabular-nums">{editFocalX}%</span>
                    </div>
                    <input
                      type="range" min={0} max={100} value={editFocalX}
                      onChange={e => setEditFocalX(Number(e.target.value))}
                      className="w-full accent-pink-500 h-1"
                    />
                    <div className="flex justify-between text-[9px] text-white/15">
                      <span>Left</span><span>Center</span><span>Right</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-white/40 text-xs">Vertical (Y)</label>
                      <span className="text-white/25 text-xs tabular-nums">{editFocalY}%</span>
                    </div>
                    <input
                      type="range" min={0} max={100} value={editFocalY}
                      onChange={e => setEditFocalY(Number(e.target.value))}
                      className="w-full accent-pink-500 h-1"
                    />
                    <div className="flex justify-between text-[9px] text-white/15">
                      <span>Top</span><span>Middle</span><span>Bottom</span>
                    </div>
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-white/40 text-xs">Zoom</label>
                      <span className="text-white/25 text-xs tabular-nums">{editZoom.toFixed(2)}×</span>
                    </div>
                    <input
                      type="range" min={100} max={200} value={Math.round(editZoom * 100)}
                      onChange={e => setEditZoom(Number(e.target.value) / 100)}
                      className="w-full accent-pink-500 h-1"
                    />
                    <div className="flex justify-between text-[9px] text-white/15">
                      <span>1× (default)</span><span>1.5×</span><span>2× (max)</span>
                    </div>
                  </div>
                </div>

                {/* Quick presets */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white/20 text-[10px]">Presets:</span>
                  {[
                    { label: "Top Left", x: 15, y: 15 },
                    { label: "Top Center", x: 50, y: 10 },
                    { label: "Top Right", x: 85, y: 15 },
                    { label: "Center", x: 50, y: 50 },
                    { label: "Center Right", x: 80, y: 35 },
                  ].map(p => (
                    <button
                      key={p.label}
                      onClick={() => { setEditFocalX(p.x); setEditFocalY(p.y); }}
                      className="text-[10px] px-2 py-1 rounded-lg border border-white/10 text-white/40 hover:text-white/70 hover:border-white/20 transition"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-1 border-t border-white/10">
                  <button
                    onClick={() => { setEditFocalX(50); setEditFocalY(50); setEditZoom(1); }}
                    className="text-white/40 hover:text-white/70 text-xs transition border border-white/10 px-3 py-1.5 rounded-lg"
                  >
                    Reset
                  </button>
                  <div className="text-white/20 text-xs ml-1">
                    ({editFocalX}%, {editFocalY}%) · {editZoom.toFixed(2)}×
                  </div>
                  <button
                    onClick={saveFocalPoint}
                    disabled={savingFocal}
                    className="ml-auto bg-pink-600 hover:bg-pink-500 disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2 rounded-xl text-sm font-bold transition"
                  >
                    {savingFocal ? "Saving…" : "Save Position"}
                  </button>
                </div>
              </div>
            )}

            {/* Featured limit warning */}
            {featuredLimitError && (
              <div className="bg-amber-950/30 border border-amber-500/25 rounded-xl px-4 py-3 flex items-center gap-3">
                <span className="text-amber-400">⚠️</span>
                <p className="text-amber-300 text-sm">10-item Featured limit reached. Unfeature one to add another.</p>
                <button onClick={() => setFeaturedLimitError(false)} className="ml-auto text-amber-400/50 hover:text-amber-300 text-xs">✕</button>
              </div>
            )}

            {/* Media type tabs */}
            <div className="flex items-center gap-2">
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
                  {t === "photo" ? `📸 Photos (${media.filter(m => m.type === "photo").length})`
                    : t === "video" ? `🎥 Videos (${media.filter(m => m.type === "video").length})`
                    : `🎨 Creator (${media.filter(m => m.type === "creator_content").length})`}
                </button>
              ))}
            </div>

            {/* Photo upload zone */}
            {mediaTab === "photo" && (
              <div className="space-y-4">
                <div
                  onClick={() => !uploading && photoInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setIsPhotoDragOver(true); }}
                  onDragEnter={e => { e.preventDefault(); setIsPhotoDragOver(true); }}
                  onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsPhotoDragOver(false); }}
                  onDrop={e => { e.preventDefault(); setIsPhotoDragOver(false); setIsDragOver(false); if (e.dataTransfer.files.length > 0) handlePhotoUpload(e.dataTransfer.files); }}
                  className={`w-full border-2 border-dashed rounded-2xl py-10 flex flex-col items-center gap-3 transition select-none ${
                    uploading
                      ? "border-pink-500/30 bg-pink-950/10 cursor-default"
                      : isPhotoDragOver
                        ? "border-pink-400 bg-pink-950/25 cursor-copy"
                        : "border-white/15 hover:border-pink-500/40 hover:bg-white/[0.02] cursor-pointer"
                  }`}
                >
                  {uploading ? (
                    <>
                      <div className="w-8 h-8 border-2 border-pink-400/30 border-t-pink-400 rounded-full animate-spin pointer-events-none" />
                      <p className="text-white/50 text-sm pointer-events-none">
                        {doneCount} / {uploadQueue.length} uploaded
                        {errorCount > 0 ? ` · ${errorCount} failed` : ""}
                      </p>
                    </>
                  ) : isPhotoDragOver ? (
                    <>
                      <span className="text-5xl pointer-events-none">📸</span>
                      <p className="text-pink-300 text-sm font-bold pointer-events-none">Drop to upload</p>
                    </>
                  ) : (
                    <>
                      <span className="text-4xl pointer-events-none">📸</span>
                      <div className="text-center pointer-events-none">
                        <p className="text-white/60 text-sm font-medium">Click to select or drag &amp; drop photos</p>
                        <p className="text-white/25 text-xs mt-1">JPG, PNG, WEBP, HEIC · 50+ photos supported</p>
                      </div>
                    </>
                  )}
                </div>

                {/* Per-file progress */}
                {uploadQueue.length > 0 && (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {uploadQueue.map(item => (
                      <div key={item.id} className="flex items-center gap-3 px-3 py-2 bg-white/[0.03] rounded-xl">
                        <span className="text-sm shrink-0">
                          {item.status === "done" ? "✅" : item.status === "error" ? "❌" : item.status === "uploading" ? "⬆️" : "⏳"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-white/60 text-xs truncate">{item.name}</p>
                          {item.status === "uploading" && (
                            <div className="mt-1 h-1 bg-white/10 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-pink-500 rounded-full transition-all duration-150"
                                style={{ width: `${item.progress}%` }}
                              />
                            </div>
                          )}
                        </div>
                        <span className="text-white/30 text-xs shrink-0">
                          {item.status === "uploading" ? `${item.progress}%` : item.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Add video */}
            {mediaTab === "video" && (
              <div className="space-y-4">
                {/* Direct file upload */}
                <div
                  onClick={() => !videoUploading && videoInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setIsVideoDragOver(true); }}
                  onDragEnter={e => { e.preventDefault(); setIsVideoDragOver(true); }}
                  onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsVideoDragOver(false); }}
                  onDrop={e => { e.preventDefault(); setIsVideoDragOver(false); setIsDragOver(false); if (e.dataTransfer.files.length > 0) handleVideoUpload(e.dataTransfer.files); }}
                  className={`w-full border-2 border-dashed rounded-2xl py-10 flex flex-col items-center gap-3 transition select-none ${
                    videoUploading
                      ? "border-pink-500/30 bg-pink-950/10 cursor-default"
                      : isVideoDragOver
                        ? "border-pink-400 bg-pink-950/25 cursor-copy"
                        : "border-white/15 hover:border-pink-500/40 hover:bg-white/[0.02] cursor-pointer"
                  }`}
                >
                  {videoUploading ? (
                    <>
                      <div className="w-8 h-8 border-2 border-pink-400/30 border-t-pink-400 rounded-full animate-spin pointer-events-none" />
                      <p className="text-white/50 text-sm pointer-events-none">
                        {videoUploadQueue.filter(q => q.status === "done").length} / {videoUploadQueue.length} uploaded
                        {videoUploadQueue.filter(q => q.status === "error").length > 0
                          ? ` · ${videoUploadQueue.filter(q => q.status === "error").length} failed` : ""}
                      </p>
                    </>
                  ) : isVideoDragOver ? (
                    <>
                      <span className="text-5xl pointer-events-none">🎥</span>
                      <p className="text-pink-300 text-sm font-bold pointer-events-none">Drop to upload</p>
                    </>
                  ) : (
                    <>
                      <span className="text-4xl pointer-events-none">🎥</span>
                      <div className="text-center pointer-events-none">
                        <p className="text-white/60 text-sm font-medium">Click to select or drag &amp; drop videos</p>
                        <p className="text-white/25 text-xs mt-1">MP4, MOV, AVI, WEBM supported</p>
                      </div>
                    </>
                  )}
                </div>

                {/* Per-file progress */}
                {videoUploadQueue.length > 0 && (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {videoUploadQueue.map(item => (
                      <div key={item.id} className="flex items-center gap-3 px-3 py-2 bg-white/[0.03] rounded-xl">
                        <span className="text-sm shrink-0">
                          {item.status === "done" ? "✅" : item.status === "error" ? "❌" : item.status === "uploading" ? "⬆️" : "⏳"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-white/60 text-xs truncate">{item.name}</p>
                          {item.status === "uploading" && (
                            <div className="mt-1 h-1 bg-white/10 rounded-full overflow-hidden">
                              <div className="h-full bg-pink-500 rounded-full transition-all duration-150" style={{ width: `${item.progress}%` }} />
                            </div>
                          )}
                        </div>
                        <span className="text-white/30 text-xs shrink-0">
                          {item.status === "uploading" ? `${item.progress}%` : item.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* URL paste option */}
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 space-y-3">
                  <div>
                    <h3 className="font-semibold text-white/70 text-sm">Or paste a URL</h3>
                    <p className="text-white/25 text-xs mt-0.5">YouTube, TikTok, Instagram, or direct video link</p>
                  </div>
                  <input
                    value={videoUrl}
                    onChange={e => setVideoUrl(e.target.value)}
                    placeholder="https://youtube.com/watch?v=..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-pink-500/50"
                  />
                  <input
                    value={videoThumbnail}
                    onChange={e => setVideoThumbnail(e.target.value)}
                    placeholder="Thumbnail image URL (optional)"
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
                    placeholder="Role (Photographer, Videographer…)"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-purple-500/50"
                  />
                  <div className="sm:col-span-2">
                    <input
                      value={creatorUrl}
                      onChange={e => setCreatorUrl(e.target.value)}
                      placeholder="YouTube, image, or direct video URL"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-purple-500/50"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <input
                      value={creatorThumbnail}
                      onChange={e => setCreatorThumbnail(e.target.value)}
                      placeholder="Thumbnail image URL (optional)"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-purple-500/50"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <input
                      value={creatorCaption}
                      onChange={e => setCreatorCaption(e.target.value)}
                      placeholder="Caption (optional)"
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
            {filteredMedia.length === 0 && !uploading && (
              <div className="py-10 text-center text-white/20 text-sm border border-dashed border-white/5 rounded-2xl">
                {mediaTab === "photo" ? "No photos uploaded yet." : mediaTab === "video" ? "No videos added yet." : "No creator content added yet."}
              </div>
            )}

            {filteredMedia.length > 0 && (
              <div className="space-y-3">
                <p className="text-white/25 text-[10px] font-bold uppercase tracking-widest">
                  {mediaTab === "photo" ? "Photos" : mediaTab === "video" ? "Videos" : "Creator Content"} ({filteredMedia.length})
                </p>
                {mediaTab === "photo" ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {filteredMedia.map(item => (
                      <PhotoMediaItem
                        key={item.id}
                        item={item}
                        featuredCount={featuredCount}
                        isCover={selectedAlbum.coverImageUrl === item.url}
                        onDelete={() => deleteMediaItem(item)}
                        onTogglePin={() => togglePin(item)}
                        onToggleFeatured={() => toggleFeatured(item)}
                        onSetCover={() => setAsCover(item.url)}
                        onMove={() => { setMovingPhoto(item); setMoveTargetAlbumId(""); }}
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
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <p className="text-white/20 text-sm">Select an album to manage its content</p>
            {albums.length === 0 && (
              <button onClick={quickCreateSeaBears} className="text-xs text-amber-400/70 hover:text-amber-400 transition border border-amber-500/20 px-4 py-2 rounded-xl">
                ⚡ Quick-create the Sea Bears album
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

// ─── Album Card ───────────────────────────────────────────

function AlbumCard({
  album,
  isSelected,
  onSelect,
  onUpload,
  onToggleStatus,
  onDelete,
}: {
  album: MemoryAlbum;
  isSelected: boolean;
  onSelect: () => void;
  onUpload: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={`rounded-xl border transition ${isSelected ? "bg-pink-600/10 border-pink-500/40" : "bg-white/[0.03] border-white/10 hover:border-white/20"}`}>
      <button onClick={onSelect} className="w-full text-left p-4 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-white/80 text-sm font-semibold line-clamp-1">{album.title}</p>
          <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
            album.status === "active"
              ? "bg-emerald-500/15 border border-emerald-500/25 text-emerald-400"
              : "bg-white/5 border border-white/10 text-white/30"
          }`}>
            {album.status === "active" ? "live" : "draft"}
          </span>
        </div>
        <p className="text-white/25 text-xs">{album.eventDate}{album.location ? ` · ${album.location}` : ""}</p>
        <div className="flex items-center gap-3 text-white/25 text-xs">
          <span>📸 {album.photoCount}</span>
          <span>🎥 {album.videoCount}</span>
          {album.isFeatured && <span className="text-amber-400/50">⭐</span>}
        </div>
      </button>
      {/* Quick action buttons */}
      <div className="px-3 pb-3 flex items-center gap-1.5">
        <button
          onClick={onUpload}
          className="flex-1 text-[10px] font-semibold text-white/50 hover:text-white bg-white/5 hover:bg-pink-600/20 border border-white/5 hover:border-pink-500/30 px-2 py-1.5 rounded-lg transition"
        >
          Upload
        </button>
        <Link
          href={`/memories/${album.id}`}
          target="_blank"
          className="flex-1 text-center text-[10px] font-semibold text-white/50 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 px-2 py-1.5 rounded-lg transition"
        >
          View
        </Link>
        <button
          onClick={onToggleStatus}
          className="flex-1 text-[10px] font-semibold text-white/40 hover:text-white/70 bg-white/5 hover:bg-white/10 border border-white/5 px-2 py-1.5 rounded-lg transition"
        >
          {album.status === "active" ? "Unpublish" : "Publish"}
        </button>
        <button
          onClick={onDelete}
          className="text-[10px] text-white/20 hover:text-red-400 bg-white/5 hover:bg-red-500/10 border border-white/5 px-2 py-1.5 rounded-lg transition"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ─── Media Item Components ────────────────────────────────

function PhotoMediaItem({
  item,
  featuredCount,
  isCover,
  onDelete,
  onTogglePin,
  onToggleFeatured,
  onSetCover,
  onMove,
}: {
  item: MemoryMedia;
  featuredCount: number;
  isCover: boolean;
  onDelete: () => void;
  onTogglePin: () => void;
  onToggleFeatured: () => void;
  onSetCover: () => void;
  onMove: () => void;
}) {
  const canFeature = item.isFeatured || featuredCount < 10;
  const [imgSrc, setImgSrc] = useState(item.url);
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="group relative aspect-square overflow-hidden rounded-xl bg-white/5">
      <img
        src={imgSrc}
        alt={item.caption}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => {
          // retry once with cache-bust then give up
          if (!imgSrc.includes("&retry=1")) setImgSrc(imgSrc + "&retry=1");
        }}
        className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
      {/* Badges */}
      <div className="absolute top-1.5 left-1.5 flex flex-col gap-1">
        {isCover && (
          <span className="bg-blue-500/80 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full">COVER</span>
        )}
        {item.isFeatured && (
          <span className="bg-amber-500/80 text-black text-[8px] font-black px-1.5 py-0.5 rounded-full">⭐ FEAT</span>
        )}
        {item.isPinned && (
          <span className="bg-pink-600/80 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full">📌</span>
        )}
      </div>
      {/* Hover actions */}
      <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-2">
        <button
          onClick={onSetCover}
          className={`w-full text-[10px] font-bold px-2 py-1 rounded-lg transition ${isCover ? "bg-blue-500/80 text-white" : "bg-white/15 text-white/70 hover:bg-blue-500/60 hover:text-white"}`}
        >
          {isCover ? "✓ Cover" : "Set Cover"}
        </button>
        <button
          onClick={onToggleFeatured}
          disabled={!canFeature}
          className={`w-full text-[10px] font-bold px-2 py-1 rounded-lg transition ${
            item.isFeatured
              ? "bg-amber-500/80 text-black hover:bg-amber-400"
              : canFeature
                ? "bg-white/15 text-white/70 hover:bg-amber-500/60 hover:text-black"
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
          onClick={e => { e.stopPropagation(); onMove(); }}
          className="w-full text-[10px] px-2 py-1 rounded-lg bg-white/15 text-white/70 hover:bg-blue-500/60 hover:text-white transition"
        >
          Move →
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
      {item.thumbnailUrl && (
        <img src={item.thumbnailUrl} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0 border border-white/10" />
      )}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          {item.isFeatured && (
            <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400">⭐ Featured</span>
          )}
          <p className="text-white/50 text-xs truncate">{item.url}</p>
        </div>
        {item.caption && <p className="text-white/30 text-xs">{item.caption}</p>}
        {item.creatorName && (
          <p className="text-purple-300/50 text-xs">{item.creatorName}{item.creatorRole ? ` · ${item.creatorRole}` : ""}</p>
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
