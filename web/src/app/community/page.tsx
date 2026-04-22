"use client";

import { useEffect, useState, useRef } from "react";
import {
  collection, addDoc, onSnapshot, query, where, orderBy,
  serverTimestamp, Timestamp, deleteDoc, doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";

// ── Types ──────────────────────────────────────────────────
interface Post {
  id: string;
  userId: string;
  displayName: string;
  content: string;
  createdAt: Timestamp | null;
}
interface Comment {
  id: string;
  userId: string;
  displayName: string;
  postId: string;
  content: string;
  createdAt: Timestamp | null;
}
interface Reply {
  id: string;
  userId: string;
  displayName: string;
  commentId: string;
  postId: string;
  content: string;
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

// ── Community guidelines ───────────────────────────────────
function Guidelines() {
  return (
    <div className="bg-white/[0.03] border border-white/8 rounded-2xl px-5 py-4 space-y-2">
      <p className="text-white/40 text-xs font-semibold uppercase tracking-widest">Community Guidelines</p>
      <ul className="grid grid-cols-2 gap-x-6 gap-y-1">
        {[
          "Respect everyone",
          "No spam or promotions",
          "No harassment or threats",
          "Keep it real",
        ].map((g) => (
          <li key={g} className="text-white/35 text-xs flex items-center gap-1.5">
            <span className="text-pink-500/60">·</span> {g}
          </li>
        ))}
      </ul>
    </div>
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

// ── Members-only composer gate ─────────────────────────────
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

// ── Delete button (admin + owner) ──────────────────────────
function DeleteBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label="Delete"
      className="ml-auto text-white/20 hover:text-red-400 text-xs transition px-1 shrink-0">
      ✕
    </button>
  );
}

// ── Inline members-only reply to threads ───────────────────
function MembersOnlyInline() {
  return (
    <p className="text-white/25 text-xs">
      <Link href="/" className="text-pink-400/70 hover:text-pink-400 transition">Join to participate</Link>
    </p>
  );
}

// ── Composer ───────────────────────────────────────────────
function Composer({
  placeholder, onSubmit, rows = 3, compact = false,
}: {
  placeholder: string;
  onSubmit: (text: string) => Promise<void>;
  rows?: number;
  compact?: boolean;
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
  );
}

// ── Reply thread ───────────────────────────────────────────
function ReplyThread({ commentId, postId, canInteract, isAdmin, currentUserId, displayName }: {
  commentId: string; postId: string; canInteract: boolean; isAdmin: boolean;
  currentUserId?: string; displayName?: string;
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
  const label = open ? "Hide replies" : count > 0 ? `${count} repl${count === 1 ? "y" : "ies"}${canInteract ? " · Reply" : ""}` : canInteract ? "Reply" : "";

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
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-medium text-xs text-white/80">{r.displayName}</span>
                  <span className="text-white/25 text-xs">{timeAgo(r.createdAt)}</span>
                  {(isAdmin || r.userId === currentUserId) && (
                    <DeleteBtn onClick={() => deleteDoc(doc(db, "replies", r.id))} />
                  )}
                </div>
                <p className="text-white/65 leading-relaxed">{r.content}</p>
              </div>
            </div>
          ))}
          {canInteract
            ? <Composer placeholder="Write a reply..." onSubmit={async (t) => {
                await addDoc(collection(db, "replies"), {
                  userId: currentUserId, displayName: displayName ?? "Member",
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
function CommentThread({ postId, canInteract, isAdmin, currentUserId, displayName }: {
  postId: string; canInteract: boolean; isAdmin: boolean;
  currentUserId?: string; displayName?: string;
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
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-xs text-white/80">{c.displayName}</span>
                    <span className="text-white/25 text-xs">{timeAgo(c.createdAt)}</span>
                    {(isAdmin || c.userId === currentUserId) && (
                      <DeleteBtn onClick={() => deleteDoc(doc(db, "comments", c.id))} />
                    )}
                  </div>
                  <p className="text-white/65 leading-relaxed">{c.content}</p>
                </div>
              </div>
              <ReplyThread commentId={c.id} postId={postId} canInteract={canInteract}
                isAdmin={isAdmin} currentUserId={currentUserId} displayName={displayName} />
            </div>
          ))}
          {canInteract
            ? <Composer placeholder="Write a comment..." onSubmit={async (t) => {
                await addDoc(collection(db, "comments"), {
                  userId: currentUserId, displayName: displayName ?? "Member",
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
function PostCard({ post, canInteract, isAdmin, currentUserId, displayName }: {
  post: Post; canInteract: boolean; isAdmin: boolean;
  currentUserId?: string; displayName?: string;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
      <div className="flex items-start gap-3">
        <Avatar name={post.displayName} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-white/90">{post.displayName}</span>
            <span className="text-white/25 text-xs">{timeAgo(post.createdAt)}</span>
            {(isAdmin || post.userId === currentUserId) && (
              <DeleteBtn onClick={() => deleteDoc(doc(db, "posts", post.id))} />
            )}
          </div>
          <p className="text-white/75 text-sm leading-relaxed mt-1 whitespace-pre-wrap">{post.content}</p>
        </div>
      </div>
      <CommentThread postId={post.id} canInteract={canInteract} isAdmin={isAdmin}
        currentUserId={currentUserId} displayName={displayName} />
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────
export default function CommunityPage() {
  const { user, isActive, isAdmin, profile, loading } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);

  const canInteract = isActive || isAdmin;
  const isSignedIn = !!user;
  const currentUserId = user?.uid;
  const displayName = profile?.displayName ?? profile?.email ?? "Member";

  // Only fetch feed when signed in — Firestore rules block signed-out reads
  useEffect(() => {
    if (!isSignedIn) { setFeedLoading(false); return; }
    const unsub = onSnapshot(
      query(collection(db, "posts"), orderBy("createdAt", "desc")),
      (snap) => { setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post))); setFeedLoading(false); },
      () => setFeedLoading(false)
    );
    return () => unsub();
  }, [isSignedIn]);

  if (loading) return null;

  // Signed-out — full page gate
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
    <main className="max-w-2xl mx-auto px-6 py-12 space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">Community</h1>
        <p className="text-white/40 text-sm">What&apos;s happening in Winnipeg</p>
      </div>

      {/* Guidelines */}
      <Guidelines />

      {/* Composer or members-only block */}
      {canInteract ? (
        <Composer placeholder="Share something with the community..." onSubmit={async (text) => {
          await addDoc(collection(db, "posts"), {
            userId: currentUserId, displayName, content: text, createdAt: serverTimestamp(),
          });
        }} />
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
              currentUserId={currentUserId} displayName={displayName} />
          ))}
        </div>
      )}
    </main>
  );
}
