"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection, getDocs, doc, updateDoc, orderBy, query, Timestamp,
} from "firebase/firestore";

interface Member {
  id: string;
  email: string;
  role: string;
  status: string;
  displayName?: string;
  createdAt?: Timestamp;
}

export default function AdminUsersPage() {
  const { isAdmin, loading } = useAuth();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [fetching, setFetching] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!loading && !isAdmin) router.push("/");
  }, [loading, isAdmin, router]);

  const fetchMembers = async () => {
    setFetching(true);
    const snap = await getDocs(query(collection(db, "users"), orderBy("email")));
    setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Member)));
    setFetching(false);
  };

  useEffect(() => { if (isAdmin) fetchMembers(); }, [isAdmin]);

  const toggleStatus = async (member: Member) => {
    const newStatus = member.status === "active" ? "inactive" : "active";
    setUpdating(member.id);
    await updateDoc(doc(db, "users", member.id), { status: newStatus });
    setMembers((prev) => prev.map((m) => m.id === member.id ? { ...m, status: newStatus } : m));
    setUpdating(null);
  };

  const toggleRole = async (member: Member) => {
    const newRole = member.role === "admin" ? "member" : "admin";
    if (!confirm(`Set ${member.email} as ${newRole}?`)) return;
    setUpdating(member.id);
    await updateDoc(doc(db, "users", member.id), { role: newRole });
    setMembers((prev) => prev.map((m) => m.id === member.id ? { ...m, role: newRole } : m));
    setUpdating(null);
  };

  if (loading || !isAdmin) return null;

  const filtered = members.filter(
    (m) =>
      m.email?.toLowerCase().includes(search.toLowerCase()) ||
      m.displayName?.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = members.filter((m) => m.status === "active").length;
  const totalCount = members.length;

  return (
    <main className="max-w-5xl mx-auto px-6 py-12 space-y-8">
      <div className="flex items-center gap-4">
        <button onClick={() => router.push("/admin")} className="text-white/40 hover:text-white text-sm transition">← Back</button>
        <h1 className="text-3xl font-bold">Manage Members</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
          <p className="text-3xl font-bold">{totalCount}</p>
          <p className="text-white/40 text-sm mt-1">Total Users</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
          <p className="text-3xl font-bold text-green-400">{activeCount}</p>
          <p className="text-white/40 text-sm mt-1">Active Members</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
          <p className="text-3xl font-bold text-yellow-400">{totalCount - activeCount}</p>
          <p className="text-white/40 text-sm mt-1">Inactive</p>
        </div>
      </div>

      {/* Search */}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by email or name..."
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-pink-500 transition"
      />

      {/* List */}
      {fetching ? (
        <p className="text-white/40">Loading members...</p>
      ) : filtered.length === 0 ? (
        <p className="text-white/40">No members found.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((m) => (
            <div key={m.id} className="bg-white/5 border border-white/10 rounded-2xl px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-pink-600/30 border border-pink-600/40 flex items-center justify-center font-bold text-pink-300 shrink-0">
                  {(m.displayName ?? m.email ?? "?")[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-medium">{m.displayName ?? m.email}</p>
                  {m.displayName && <p className="text-white/40 text-xs">{m.email}</p>}
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      m.status === "active"
                        ? "bg-green-900/40 text-green-400 border border-green-700/40"
                        : "bg-yellow-900/40 text-yellow-400 border border-yellow-700/40"
                    }`}>
                      {m.status === "active" ? "Active" : "Inactive"}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      m.role === "admin"
                        ? "bg-amber-900/40 text-amber-400 border border-amber-700/40"
                        : "bg-white/5 text-white/40 border border-white/10"
                    }`}>
                      {m.role === "admin" ? "Owner" : "Member"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => toggleStatus(m)}
                  disabled={updating === m.id}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition disabled:opacity-50 ${
                    m.status === "active"
                      ? "border-yellow-700/50 text-yellow-400 hover:bg-yellow-950/40"
                      : "border-green-700/50 text-green-400 hover:bg-green-950/40"
                  }`}
                >
                  {updating === m.id ? "..." : m.status === "active" ? "Deactivate" : "Activate"}
                </button>
                <button
                  onClick={() => toggleRole(m)}
                  disabled={updating === m.id}
                  className="text-xs px-3 py-1.5 rounded-lg border border-white/20 hover:border-white/40 transition disabled:opacity-50"
                >
                  {m.role === "admin" ? "Remove Admin" : "Make Admin"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
