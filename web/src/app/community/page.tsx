"use client";

import { useEffect, useState, useRef } from "react";
import {
  collection, addDoc, onSnapshot, query, where, orderBy,
  serverTimestamp, Timestamp, deleteDoc, doc, getDocs, limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { GuidelinesStrip, GuidelinesModal } from "@/components/CommunityGuidelines";

const GUIDELINES_KEY = "aa_community_guidelines_accepted";

// ── Types ──────────────────────────────────────────────────
interface Post {
  id: string;
  userId: string;
  displayName: string;
  badge?: string;
  content: string;
  isPinned?: boolean;
  createdAt: Timestamp | null;
}
interface Comment {
  id: string;
  userId: string;
  displayName: string;
  badge?: string;
  postId: string;
  content: string;
  createdAt: Timestamp | null;
}
interface Reply {
  id: string;
  userId: string;
  displayName: string;
  badge?: string;
  commentId: string;
  postId: string;
  content: string;
  createdAt: Timestamp | null;
}
interface Prompt {
  id: string;
  text: string;
  createdAt: Timestamp | null;
}

// ── Helpers ────────────────────────────────────────────────
function timeAgo(ts: Timestamp | null): string {
  if (!ts) return "";
  try {
    const d = ts.toDate();
    const m = Math.floor((Date.now() - d.getTime()) / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
  } catch { return ""; }
}

function Avatar({ name }: { name: string }) {
  return (
    <div className="w-8 h-8 rounded-full bg-pink-600 flex items-center justify-center text-sm font-bold shrink-0 select-none">
      {(name || "?")[0].toUpperCase()}
    </div>
  );
}

// ── Badge chip ─────────────────────────────────────────────
function Badge({ badge }: { badge?: string }) {
  if (!badge) return null;
  const styles: Record<string, string> = {
    "Admin":           "bg-pink-900/40 border-pink-500/30 text-pink-300",
    "Founding Member": "bg-amber-900/30 border-amber-500/25 text-amber-300/80",
    "Active Member":   "bg-white/5 border-white/10 text-white/40",
  };
  const cls = styles[badge] ?? "bg-white/5 border-white/10 text-white/40";
  return (
    <span className={`inline-flex items-center border rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none ${cls}`}>
      {badge}
    </span>
  );
}

// ── Report button ──────────────────────────────────────────
function ReportBtn({ contentId, contentType, reporterId }: {
  contentId: string;
  contentType: "post" | "comment" | "reply";
  reporterId?: string;
}) {
  const [done, setDone] = useState(false);
  if (!reporterId || done) return null;

  const handleReport = async () => {
    await addDoc(collection(db, "reports"), {
      contentId,
      contentType,
      userId: reporterId,
      reason: "flagged",
      createdAt: serverTimestamp(),
    });
    setDone(true);
  };

  return (
    <button
      onClick={handleReport}
      title="Report"
      className="text-white/15 hover:text-amber-400/60 text-xs transition px-1"
    >
      ⚑
    </button>
  );
}

// ── Auth gate (signed out) ─────────────────────────────────
function SignInGate() {
  return (
    <div className="flex flex-col items-center justify-center py-20 space-y-5 text-center">
      <div className="w-14 h-14 rounded-full bg-pink-600/15 border border-pink-500/20 flex items-center justify-center">
        <svg className="w-6 h-6 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
        </svg>
      </div>
      <div className="space-y-1">
        <p className="text-white/70 font-semibold">Sign in to view the community</p>
        <p className="text-white/30 text-sm">This feed is for ALL ACCESS members and registered users.</p>
      </div>
      <div className="flex gap-3">
        <Link href="/login" className="border border-white/15 hover:border-white/30 px-5 py-2.5 rounded-xl text-sm font-semibold text-white/60 hover:text-white transition">
          Log in
        </Link>
        <Link href="/signup" className="bg-pink-600 hover:bg-pink-500 px-5 py-2.5 rounded-xl text-sm font-bold transition">
          Create account
        </Link>
      </div>
    </div>
  );
}

// ── Members-only block ─────────────────────────────────────
function MembersOnlyBlock() {
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-pink-600/15 border border-pink-500/20 flex items-center justify-center shrink-0">
          <svg className="w-3.5 h-3.5 text-pink-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
          </svg>
        </div>
        <span className="text-white/50 text-sm">Members only — join to participate</span>
      </div>
      <Link href="/" className="bg-pink-600 hover:bg-pink-500 px-4 py-2 rounded-xl text-sm font-bold transition shrink-0">
        Join — $25/mo
      </Link>
    </div>
  );
}

function MembersOnlyInline() {
  return (
    <p className="text-white/25 text-xs">
      <Link href="/" className="text-pink-400/70 hover:text-pink-400 transition">Join to participate</Link>
    </p>
  );
}

// ── Delete button ──────────────────────────────────────────
function DeleteBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label="Delete"
      className="text-white/15 hover:text-red-400 text-xs transition px-1 shrink-0">
      ✕
    </button>
  );
}

// ── Composer ───────────────────────────────────────────────
function Composer({
  placeholder, onSubmit, rows = 3, compact = false, microText,
}: {
  placeholder: string;
  onSubmit: (text: string) => Promise<void>;
  rows?: number;
  compact?: boolean;
  microText?: string;
}) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    try { await onSubmit(text.trim()); setText(""); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-1.5">
      {microText && <p className="text-white/20 text-xs">{microText}</p>}
      <form onSubmit={handleSubmit} className={compact ? "flex gap-2 items-start" : "flex flex-col gap-2"}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder}
          rows={rows} disabled={submitting}
          className="flex-1 w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-pink-500/60 transition resize-none disabled:opacity-40"
        />
        <button type="submit" disabled={!text.trim() || submitting}
          className="shrink-0 bg-pink-600 hover:bg-pink-500 disabled:opacity-40 px-4 py-2 rounded-xl font-semibold text-sm transition">
          {submitting ? "..." : "Post"}
        </button>
      </form>
    </div>
  );
}

// ── Weekly prompt card ─────────────────────────────────────
function WeeklyPrompt({ prompt }: { prompt: Prompt | null }) {
  if (!prompt) return null;
  return (
    <div className="bg-pink-950/20 border border-pink-500/15 rounded-2xl px-5 py-4 space-y-1">
      <p className="text-pink-400/50 text-[10px] font-semibold uppercase tracking-widest">Weekly Prompt</p>
      <p className="text-white/70 text-sm font-medium leading-snug">{prompt.text}</p>
    </div>
  );
}

// ── Reply thread ───────────────────────────────────────────
function ReplyThread({ commentId, postId, canInteract, isAdmin, currentUserId, displayName, badge }: {
  commentId: string; postId: string; canInteract: boolean; isAdmin: boolean;
  currentUserId?: string; displayName?: string; badge?: string;
}) {
  const [replies, setReplies] = useState<Reply[]>([]);
  const [open, setOpen] = useState(false);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!open) { unsubRef.current?.(); unsubRef.current = null; return; }
    unsubRef.current = onSnapshot(
      query(collection(db, "replies"), where("commentId", "==", commentId), orderBy("createdAt", "asc")),
      (snap) => setReplies(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Reply)))
    );
    return () => { unsubRef.current?.(); unsubRef.current = null; };
  }, [open, commentId]);

  const count = replies.length;
  const label = open ? "Hide replies"
    : count > 0 ? `${count} repl${count === 1 ? "y" : "ies"}${canInteract ? " · Reply" : ""}`
    : canInteract ? "Reply" : "";

  if (!label && !open) return null;

  return (
    <div className="ml-10 mt-1.5 space-y-2">
      <button onClick={() => setOpen((v) => !v)} className="text-xs text-white/25 hover:text-white/55 transition">
        {label}
      </button>
      {open && (
        <div className="space-y-2">
          {replies.map((r) => (
            <div key={r.id} className="flex gap-2">
              <Avatar name={r.displayName} />
              <div className="flex-1 bg-white/[0.04] rounded-xl px-3 py-2 text-sm">
                <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                  <span className="font-medium text-xs text-white/80">{r.displayName}</span>
                  <Badge badge={r.badge} />
                  <span className="text-white/25 text-xs">{timeAgo(r.createdAt)}</span>
                  <div className="ml-auto flex items-center gap-0.5">
                    <ReportBtn contentId={r.id} contentType="reply" reporterId={currentUserId} />
                    {(isAdmin || r.userId === currentUserId) && (
                      <DeleteBtn onClick={() => deleteDoc(doc(db, "replies", r.id))} />
                    )}
                  </div>
                </div>
                <p className="text-white/65 leading-relaxed">{r.content}</p>
              </div>
            </div>
          ))}
          {canInteract
            ? <Composer placeholder="Write a reply..." onSubmit={async (t) => {
                await addDoc(collection(db, "replies"), {
                  userId: currentUserId, displayName: displayName ?? "Member", badge: badge ?? null,
                  commentId, postId, content: t, createdAt: serverTimestamp(),
                });
              }} rows={1} compact />
            : <MembersOnlyInline />
          }
        </div>
      )}
    </div>
  );
}

// ── Comment thread ─────────────────────────────────────────
function CommentThread({ postId, canInteract, isAdmin, currentUserId, displayName, badge }: {
  postId: string; canInteract: boolean; isAdmin: boolean;
  currentUserId?: string; displayName?: string; badge?: string;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [open, setOpen] = useState(false);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!open) { unsubRef.current?.(); unsubRef.current = null; return; }
    unsubRef.current = onSnapshot(
      query(collection(db, "comments"), where("postId", "==", postId), orderBy("createdAt", "asc")),
      (snap) => setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Comment)))
    );
    return () => { unsubRef.current?.(); unsubRef.current = null; };
  }, [open, postId]);

  return (
    <div className="mt-2 border-t border-white/[0.06] pt-3 space-y-3">
      <button onClick={() => setOpen((v) => !v)}
        className="text-xs text-white/25 hover:text-white/55 transition flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
        </svg>
        {open ? "Hide comments" : "Comment"}
      </button>
      {open && (
        <div className="space-y-3">
          {comments.length === 0 && <p className="text-white/25 text-xs">No comments yet.</p>}
          {comments.map((c) => (
            <div key={c.id}>
              <div className="flex gap-2">
                <Avatar name={c.displayName} />
                <div className="flex-1 bg-white/[0.04] rounded-xl px-3 py-2 text-sm">
                  <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    <span className="font-medium text-xs text-white/80">{c.displayName}</span>
                    <Badge badge={c.badge} />
                    <span className="text-white/25 text-xs">{timeAgo(c.createdAt)}</span>
                    <div className="ml-auto flex items-center gap-0.5">
                      <ReportBtn contentId={c.id} contentType="comment" reporterId={currentUserId} />
                      {(isAdmin || c.userId === currentUserId) && (
                        <DeleteBtn onClick={() => deleteDoc(doc(db, "comments", c.id))} />
                      )}
                    </div>
                  </div>
                  <p className="text-white/65 leading-relaxed">{c.content}</p>
                </div>
              </div>
              <ReplyThread commentId={c.id} postId={postId} canInteract={canInteract}
                isAdmin={isAdmin} currentUserId={currentUserId} displayName={displayName} badge={badge} />
            </div>
          ))}
          {canInteract
            ? <Composer placeholder="Write a comment..." microText="Respect the space. Keep it real."
                onSubmit={async (t) => {
                  await addDoc(collection(db, "comments"), {
                    userId: currentUserId, displayName: displayName ?? "Member", badge: badge ?? null,
                    postId, content: t, createdAt: serverTimestamp(),
                  });
                }} rows={2} />
            : <MembersOnlyInline />
          }
        </div>
      )}
    </div>
  );
}

// ── Post card ──────────────────────────────────────────────
function PostCard({ post, canInteract, isAdmin, currentUserId, displayName, badge }: {
  post: Post; canInteract: boolean; isAdmin: boolean;
  currentUserId?: string; displayName?: string; badge?: string;
}) {
  return (
    <div className={`border rounded-2xl p-5 space-y-3 ${
      post.isPinned
        ? "bg-pink-950/15 border-pink-500/20"
        : "bg-white/5 border-white/10"
    }`}>
      {post.isPinned && (
        <div className="flex items-center gap-1.5 text-pink-400/50 text-xs font-medium">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414L11 8.414V13a1 1 0 01-.553.894l-4 2A1 1 0 015 15v-2.586L1.707 9.121A1 1 0 011 8.414V5a1 1 0 011-1h3.586l2.707-2.707z"/>
          </svg>
          Pinned
        </div>
      )}
      <div className="flex items-start gap-3">
        <Avatar name={post.displayName} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-sm text-white/90">{post.displayName}</span>
            <Badge badge={post.badge} />
            <span className="text-white/25 text-xs">{timeAgo(post.createdAt)}</span>
            <div className="ml-auto flex items-center gap-0.5">
              <ReportBtn contentId={post.id} contentType="post" reporterId={currentUserId} />
              {(isAdmin || post.userId === currentUserId) && (
                <DeleteBtn onClick={() => deleteDoc(doc(db, "posts", post.id))} />
              )}
            </div>
          </div>
          <p className="text-white/75 text-sm leading-relaxed mt-1 whitespace-pre-wrap">{post.content}</p>
        </div>
      </div>
      <CommentThread postId={post.id} canInteract={canInteract} isAdmin={isAdmin}
        currentUserId={currentUserId} displayName={displayName} badge={badge} />
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────
export default function CommunityPage() {
  const { user, isActive, isAdmin, profile, loading } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [feedLoading, setFeedLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [pendingPost, setPendingPost] = useState<string | null>(null);

  const canInteract = isActive || isAdmin;
  const isSignedIn = !!user;
  const currentUserId = user?.uid;

  // Determine badge from profile
  const badge = isAdmin ? "Admin"
    : profile?.status === "active" ? "Active Member"
    : undefined;

  const displayName = profile?.displayName ?? profile?.email ?? "Member";

  // Fetch feed + weekly prompt when signed in
  useEffect(() => {
    if (!isSignedIn) { setFeedLoading(false); return; }
    const unsub = onSnapshot(
      query(collection(db, "posts"), orderBy("createdAt", "desc")),
      (snap) => {
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post));
        // Pinned posts float to top
        const pinned = all.filter((p) => p.isPinned);
        const rest = all.filter((p) => !p.isPinned);
        setPosts([...pinned, ...rest]);
        setFeedLoading(false);
      },
      () => setFeedLoading(false)
    );
    // Load latest weekly prompt
    getDocs(query(collection(db, "prompts"), orderBy("createdAt", "desc"), limit(1)))
      .then((snap) => {
        if (!snap.empty) setPrompt({ id: snap.docs[0].id, ...snap.docs[0].data() } as Prompt);
      })
      .catch(() => {});
    return () => unsub();
  }, [isSignedIn]);

  // First-time post handler — shows guidelines modal once
  const handlePost = async (text: string) => {
    const accepted = typeof window !== "undefined" && localStorage.getItem(GUIDELINES_KEY);
    if (!accepted) {
      setPendingPost(text);
      setShowModal(true);
      return;
    }
    await submitPost(text);
  };

  const submitPost = async (text: string) => {
    await addDoc(collection(db, "posts"), {
      userId: currentUserId,
      displayName,
      badge: badge ?? null,
      content: text,
      isPinned: false,
      createdAt: serverTimestamp(),
    });
  };

  const handleModalAccept = async () => {
    if (typeof window !== "undefined") localStorage.setItem(GUIDELINES_KEY, "1");
    setShowModal(false);
    if (pendingPost) {
      await submitPost(pendingPost);
      setPendingPost(null);
    }
  };

  if (loading) return null;

  // Signed-out gate
  if (!isSignedIn) {
    return (
      <main className="max-w-2xl mx-auto px-6 py-12">
        <div className="space-y-1 mb-8">
          <h1 className="text-3xl font-bold">Community</h1>
          <p className="text-white/40 text-sm">What&apos;s happening in Winnipeg</p>
        </div>
        <SignInGate />
      </main>
    );
  }

  return (
    <>
      {showModal && <GuidelinesModal onAccept={handleModalAccept} />}

      <main className="max-w-2xl mx-auto px-6 py-12 space-y-8">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Community</h1>
          <p className="text-white/40 text-sm">What&apos;s happening in Winnipeg</p>
        </div>

        {/* Guidelines strip (collapsible) */}
        <GuidelinesStrip />

        {/* Weekly prompt */}
        {prompt && <WeeklyPrompt prompt={prompt} />}

        {/* Composer or members-only block */}
        {canInteract ? (
          <Composer
            placeholder="Share something with the community..."
            microText="Respect the space. Keep it real."
            onSubmit={handlePost}
          />
        ) : (
          <MembersOnlyBlock />
        )}

        {/* Feed */}
        {feedLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => <div key={i} className="bg-white/5 border border-white/10 rounded-2xl h-28 animate-pulse" />)}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <p className="text-3xl">👋</p>
            <p className="text-white/50 text-sm">No posts yet — be the first to share something.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} canInteract={canInteract} isAdmin={isAdmin}
                currentUserId={currentUserId} displayName={displayName} badge={badge} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
