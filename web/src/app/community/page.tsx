"use client";

import MemberGate from "@/components/MemberGate";
import { useEffect, useState } from "react";
import {
  collection, addDoc, getDocs, orderBy, query, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";

interface Post {
  id: string;
  content: string;
  displayName: string;
  createdAt: Timestamp;
}

function CommunityBoard() {
  const { profile } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  const fetchPosts = async () => {
    const snap = await getDocs(query(collection(db, "posts"), orderBy("createdAt", "desc")));
    setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post)));
    setLoading(false);
  };

  useEffect(() => { fetchPosts(); }, []);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !profile) return;
    setPosting(true);
    await addDoc(collection(db, "posts"), {
      content: content.trim(),
      userId: profile.uid,
      displayName: profile.displayName ?? profile.email ?? "Member",
      createdAt: serverTimestamp(),
    });
    setContent("");
    await fetchPosts();
    setPosting(false);
  };

  return (
    <div className="space-y-8">
      <form onSubmit={handlePost} className="space-y-3">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Share something with the community..."
          rows={3}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-pink-500 transition resize-none"
        />
        <button
          type="submit"
          disabled={posting || !content.trim()}
          className="bg-pink-600 hover:bg-pink-500 disabled:opacity-50 px-6 py-2 rounded-xl font-medium transition"
        >
          {posting ? "Posting..." : "Post"}
        </button>
      </form>

      {loading ? (
        <p className="text-white/40">Loading posts...</p>
      ) : posts.length === 0 ? (
        <p className="text-white/40">No posts yet. Be the first!</p>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <div key={post.id} className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-pink-600 flex items-center justify-center text-sm font-bold">
                  {post.displayName[0].toUpperCase()}
                </div>
                <span className="font-medium text-sm">{post.displayName}</span>
                <span className="text-white/30 text-xs ml-auto">
                  {post.createdAt?.toDate?.()?.toLocaleDateString() ?? ""}
                </span>
              </div>
              <p className="text-white/80 text-sm leading-relaxed">{post.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CommunityPage() {
  return (
    <MemberGate>
      <main className="max-w-2xl mx-auto px-6 py-12 space-y-8">
        <h1 className="text-3xl font-bold">Community</h1>
        <CommunityBoard />
      </main>
    </MemberGate>
  );
}
