"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection, getDocs, doc, updateDoc, orderBy, query, Timestamp, where,
} from "firebase/firestore";
import type { AuthUserRecord } from "@/app/api/admin/auth-users/route";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Member {
  id: string;
  email: string;
  role: string;
  status: string;
  displayName?: string;
  isFoundingMember?: boolean;
  membershipTier?: string;
  memberPriceEligible?: boolean;
  foundingMemberSince?: string;
  notes?: string;
  createdAt?: Timestamp;
  isCreator?: boolean;
  creatorStatus?: string;
  // Populated client-side from Auth cross-reference
  _missingFirestoreDoc?: boolean;
  _authRecord?: AuthUserRecord;
}

interface EventPurchase {
  id: string;
  eventTitle?: string;
  eventDate?: string;
  quantity?: number;
  totalPaid?: number;
  pricePerTicket?: number;
  paymentMethod?: string;
  status?: string;
  source?: string;
  isFoundingMember?: boolean;
  purchasedAt?: Timestamp | string;
  createdAt?: Timestamp | string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(raw?: Timestamp | string | null): string {
  if (!raw) return "—";
  const d = typeof raw === "string" ? new Date(raw) : (raw as Timestamp).toDate();
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const { isAdmin, loading, user } = useAuth();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [fetching, setFetching] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [fixingAll, setFixingAll] = useState(false);

  // Event history per member
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);
  const [purchasesMap, setPurchasesMap] = useState<Record<string, EventPurchase[]>>({});
  const [purchasesLoading, setPurchasesLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !isAdmin) router.push("/");
  }, [loading, isAdmin, router]);

  const fetchMembers = async () => {
    setFetching(true);

    // Fetch Firestore profiles + Auth user list in parallel
    const [firestoreSnap, authRes] = await Promise.all([
      getDocs(query(collection(db, "users"), orderBy("email"))),
      fetch("/api/admin/auth-users").then((r) => r.json()).catch(() => ({ users: [] })),
    ]);

    const firestoreMembers: Member[] = firestoreSnap.docs.map(
      (d) => ({ id: d.id, ...d.data() } as Member)
    );
    const firestoreUids = new Set(firestoreMembers.map((m) => m.id));

    // Auth users that have NO Firestore profile → flag them
    const authUsers: AuthUserRecord[] = authRes.users ?? [];
    const orphanedAuthUsers: Member[] = authUsers
      .filter((u) => u.uid && !firestoreUids.has(u.uid))
      .map((u) => ({
        id: u.uid,
        email: u.email ?? "(no email)",
        displayName: u.displayName,
        role: (u.customClaims?.role as string) ?? "unknown",
        status: (u.customClaims?.status as string) ?? "unknown",
        _missingFirestoreDoc: true,
        _authRecord: u,
      }));

    // Merge: Firestore members first (sorted by email), then orphaned Auth users at top
    const combined: Member[] = [
      ...orphanedAuthUsers,
      ...firestoreMembers,
    ];

    setMembers(combined);
    setFetching(false);
  };

  useEffect(() => { if (isAdmin) fetchMembers(); }, [isAdmin]);

  const createProfile = async (member: Member) => {
    setUpdating(member.id);
    try {
      const token = await user!.getIdToken();
      const res = await fetch("/api/admin/create-user-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ uid: member.id, email: member.email, displayName: member.displayName }),
      });
      if (!res.ok) {
        const d = await res.json();
        alert(`Failed: ${d.error ?? "Unknown error"}`);
        return;
      }
      // Remove from orphan list — profile now exists
      setMembers((prev) => prev.map((m) =>
        m.id === member.id ? { ...m, _missingFirestoreDoc: false, role: "member", status: "inactive" } : m
      ));
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUpdating(null);
    }
  };

  const fixAllMissing = async () => {
    const orphans = members.filter((m) => m._missingFirestoreDoc);
    if (!orphans.length) return;
    if (!confirm(`Create profiles for all ${orphans.length} missing users?`)) return;
    setFixingAll(true);
    const token = await user!.getIdToken();
    for (const m of orphans) {
      await fetch("/api/admin/create-user-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ uid: m.id, email: m.email, displayName: m.displayName }),
      });
    }
    setFixingAll(false);
    await fetchMembers();
  };

  const syncClaims = async (uid: string, role: string, status: string) => {
    const token = await user!.getIdToken();
    await fetch("/api/admin/sync-claims", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ uid, role, status }),
    });
  };

  const toggleStatus = async (member: Member) => {
    const newStatus = member.status === "active" ? "inactive" : "active";
    setUpdating(member.id);
    await syncClaims(member.id, member.role ?? "member", newStatus);
    setMembers((prev) => prev.map((m) => m.id === member.id ? { ...m, status: newStatus } : m));
    setUpdating(null);
  };

  const toggleRole = async (member: Member) => {
    const newRole = member.role === "admin" ? "member" : "admin";
    if (!confirm(`Set ${member.email} as ${newRole}?`)) return;
    setUpdating(member.id);
    await syncClaims(member.id, newRole, member.status ?? "inactive");
    setMembers((prev) => prev.map((m) => m.id === member.id ? { ...m, role: newRole } : m));
    setUpdating(null);
  };

  const toggleFoundingMember = async (member: Member) => {
    const newVal = !member.isFoundingMember;
    if (!confirm(`${newVal ? "Grant" : "Revoke"} Founding Member status for ${member.email}?`)) return;
    setUpdating(member.id);
    const updates: Partial<Member> = {
      isFoundingMember: newVal,
      membershipTier: newVal ? "founding_member" : "member",
      memberPriceEligible: newVal,
      ...(newVal ? { foundingMemberSince: new Date().toISOString() } : {}),
    };
    await updateDoc(doc(db, "users", member.id), updates);
    setMembers((prev) => prev.map((m) => m.id === member.id ? { ...m, ...updates } : m));
    setUpdating(null);
  };

  // ── Event history toggle ───────────────────────────────────────────────────
  const toggleEventHistory = async (memberId: string, email: string) => {
    if (expandedMemberId === memberId) {
      setExpandedMemberId(null);
      return;
    }
    setExpandedMemberId(memberId);
    if (purchasesMap[memberId]) return;
    setPurchasesLoading(memberId);
    try {
      const [byUid, byEmail] = await Promise.all([
        getDocs(query(collection(db, "eventPurchases"), where("userId", "==", memberId))),
        getDocs(query(collection(db, "eventPurchases"), where("userEmail", "==", email.toLowerCase()))),
      ]);
      const seen = new Set<string>();
      const list: EventPurchase[] = [];
      [...byUid.docs, ...byEmail.docs].forEach((d) => {
        if (!seen.has(d.id)) { seen.add(d.id); list.push({ id: d.id, ...d.data() } as EventPurchase); }
      });
      list.sort((a, b) => {
        const aT = a.purchasedAt ?? a.createdAt;
        const bT = b.purchasedAt ?? b.createdAt;
        const aMs = typeof aT === "string" ? new Date(aT).getTime() : (aT as Timestamp)?.toMillis?.() ?? 0;
        const bMs = typeof bT === "string" ? new Date(bT).getTime() : (bT as Timestamp)?.toMillis?.() ?? 0;
        return bMs - aMs;
      });
      setPurchasesMap((prev) => ({ ...prev, [memberId]: list }));
    } catch (err) {
      console.error("Failed to fetch event history:", err);
      setPurchasesMap((prev) => ({ ...prev, [memberId]: [] }));
    } finally {
      setPurchasesLoading(null);
    }
  };

  if (loading || !isAdmin) return null;

  const filtered = members.filter(
    (m) =>
      m.email?.toLowerCase().includes(search.toLowerCase()) ||
      m.displayName?.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = members.filter((m) => m.status === "active" && !m._missingFirestoreDoc).length;
  const foundingCount = members.filter((m) => m.isFoundingMember).length;
  const totalCount = members.filter((m) => !m._missingFirestoreDoc).length;
  const orphanCount = members.filter((m) => m._missingFirestoreDoc).length;

  return (
    <main className="max-w-5xl mx-auto px-6 py-12 space-y-8">
      <div className="flex items-center gap-4">
        <button onClick={() => router.push("/admin")} className="text-white/40 hover:text-white text-sm transition">← Back</button>
        <h1 className="text-3xl font-bold">Manage Members</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
          <p className="text-3xl font-bold">{totalCount}</p>
          <p className="text-white/40 text-sm mt-1">Total Users</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
          <p className="text-3xl font-bold text-green-400">{activeCount}</p>
          <p className="text-white/40 text-sm mt-1">Active Members</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
          <p className="text-3xl font-bold text-amber-400">{foundingCount}</p>
          <p className="text-white/40 text-sm mt-1">Founding Members</p>
        </div>
        <div className={`rounded-2xl p-5 text-center border ${orphanCount > 0 ? "bg-red-950/30 border-red-700/40" : "bg-white/5 border-white/10"}`}>
          <p className={`text-3xl font-bold ${orphanCount > 0 ? "text-red-400" : "text-yellow-400"}`}>{orphanCount > 0 ? orphanCount : totalCount - activeCount}</p>
          <p className="text-white/40 text-sm mt-1">{orphanCount > 0 ? "Missing Profile" : "Inactive"}</p>
        </div>
      </div>

      {/* Warning banner for orphaned auth users */}
      {orphanCount > 0 && (
        <div className="border border-red-700/50 bg-red-950/30 rounded-2xl px-5 py-4 flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <span className="text-red-400 text-lg mt-0.5">⚠</span>
            <div>
              <p className="text-red-300 font-semibold text-sm">
                {orphanCount} Auth {orphanCount === 1 ? "account" : "accounts"} missing a Firestore profile
              </p>
              <p className="text-red-400/70 text-xs mt-1">
                These users signed up but have no <code className="bg-white/10 px-1 rounded">users/</code> document. Click &ldquo;Fix All Missing&rdquo; to create their profiles.
              </p>
            </div>
          </div>
          <button
            onClick={fixAllMissing}
            disabled={fixingAll}
            className="shrink-0 text-xs px-4 py-2 rounded-xl bg-red-700/40 hover:bg-red-700/60 border border-red-600/50 text-red-200 font-semibold transition disabled:opacity-50"
          >
            {fixingAll ? "Fixing…" : `Fix All Missing (${orphanCount})`}
          </button>
        </div>
      )}

      {/* Search */}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by email or name..."
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-pink-500 transition"
      />

      {/* Member list */}
      {fetching ? (
        <p className="text-white/40">Loading members...</p>
      ) : filtered.length === 0 ? (
        <p className="text-white/40">No members found.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((m) => {
            const isExpanded = expandedMemberId === m.id;
            const purchases = purchasesMap[m.id];

            // Orphaned Auth user — no Firestore profile
            if (m._missingFirestoreDoc) {
              return (
                <div key={m.id} className="bg-red-950/20 border border-red-700/40 rounded-2xl px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0 bg-red-900/40 border border-red-700/50 text-red-300">
                      {(m.displayName ?? m.email ?? "?")[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{m.displayName ?? m.email}</p>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-900/50 border border-red-700/50 text-red-400 font-semibold tracking-wide">
                          ⚠ NO PROFILE
                        </span>
                      </div>
                      {m.displayName && <p className="text-white/40 text-xs">{m.email}</p>}
                      <p className="text-red-400/60 text-xs mt-0.5">Auth UID: {m.id}</p>
                      <p className="text-white/30 text-xs">
                        Signed up {m._authRecord?.createdAt ? formatDate(m._authRecord.createdAt) : "—"} · Claims: {m._authRecord?.customClaims ? JSON.stringify(m._authRecord.customClaims) : "none"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <code className="text-[10px] text-red-400/50 hidden sm:block">users/{m.id}</code>
                    <button
                      onClick={() => createProfile(m)}
                      disabled={updating === m.id}
                      className="text-xs px-3 py-1.5 rounded-lg bg-red-700/30 hover:bg-red-700/50 border border-red-600/50 text-red-200 font-semibold transition disabled:opacity-50 shrink-0"
                    >
                      {updating === m.id ? "Creating…" : "Create Profile"}
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div key={m.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                {/* Member row */}
                <div className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0 ${m.isFoundingMember ? "bg-amber-600/30 border border-amber-600/40 text-amber-300" : "bg-pink-600/30 border border-pink-600/40 text-pink-300"}`}>
                      {(m.displayName ?? m.email ?? "?")[0].toUpperCase()}
                    </div>

                    {/* Info */}
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{m.displayName ?? m.email}</p>
                        {m.isFoundingMember && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-900/50 border border-amber-700/50 text-amber-400 font-semibold tracking-wide">
                            FOUNDING
                          </span>
                        )}
                      </div>
                      {m.displayName && <p className="text-white/40 text-xs">{m.email}</p>}
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.status === "active" ? "bg-green-900/40 text-green-400 border border-green-700/40" : "bg-yellow-900/40 text-yellow-400 border border-yellow-700/40"}`}>
                          {m.status === "active" ? "Active" : "Inactive"}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.role === "admin" ? "bg-amber-900/40 text-amber-400 border border-amber-700/40" : m.status === "active" ? "bg-pink-900/40 text-pink-400 border border-pink-700/40" : "bg-white/5 text-white/40 border border-white/10"}`}>
                          {m.role === "admin" ? "Owner" : "Member"}
                        </span>
                        {m.isCreator && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-900/40 text-purple-300 border border-purple-700/40">
                            Creator
                          </span>
                        )}
                        {m.memberPriceEligible && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-pink-900/30 text-pink-400 border border-pink-700/30">
                            Member Price ✓
                          </span>
                        )}
                      </div>
                      {m.notes && <p className="text-white/30 text-xs mt-0.5 italic">{m.notes}</p>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 shrink-0 flex-wrap justify-end items-center">
                    <button
                      onClick={() => toggleEventHistory(m.id, m.email)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-white/15 text-white/50 hover:text-white hover:border-white/30 transition flex items-center gap-1"
                    >
                      {isExpanded ? "▲" : "▼"} Events
                      {purchases !== undefined && purchases.length > 0 && (
                        <span className="ml-1 bg-pink-600/20 border border-pink-700/40 text-pink-300 px-1.5 rounded-full text-[10px]">{purchases.length}</span>
                      )}
                    </button>
                    <button
                      onClick={() => toggleFoundingMember(m)}
                      disabled={updating === m.id}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition disabled:opacity-50 ${m.isFoundingMember ? "border-amber-700/50 text-amber-400 hover:bg-amber-950/40" : "border-white/20 text-white/40 hover:border-amber-700/50 hover:text-amber-400"}`}
                    >
                      {updating === m.id ? "…" : m.isFoundingMember ? "✦ Founding" : "Grant Founding"}
                    </button>
                    <button
                      onClick={() => toggleStatus(m)}
                      disabled={updating === m.id}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition disabled:opacity-50 ${m.status === "active" ? "border-yellow-700/50 text-yellow-400 hover:bg-yellow-950/40" : "border-green-700/50 text-green-400 hover:bg-green-950/40"}`}
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

                {/* Event history panel */}
                {isExpanded && (
                  <div className="border-t border-white/10 px-5 py-4 bg-white/[0.02]">
                    <p className="text-xs text-white/30 uppercase tracking-wider mb-3">Event Purchase History</p>
                    {purchasesLoading === m.id ? (
                      <p className="text-white/40 text-sm">Loading…</p>
                    ) : !purchases || purchases.length === 0 ? (
                      <p className="text-white/30 text-sm">No event purchases on record.</p>
                    ) : (
                      <div>
                        <div className="grid grid-cols-[3fr_1fr_1fr_1fr_1fr] text-[10px] uppercase tracking-wider text-white/30 pb-2 border-b border-white/10 mb-1">
                          <span>Event</span>
                          <span>Qty</span>
                          <span>Paid</span>
                          <span>Method</span>
                          <span>Date</span>
                        </div>
                        {purchases.map((p) => (
                          <div key={p.id} className="grid grid-cols-[3fr_1fr_1fr_1fr_1fr] text-sm py-2.5 border-b border-white/5 last:border-0 items-center gap-2">
                            <div className="min-w-0">
                              <p className="truncate font-medium">{p.eventTitle ?? "—"}</p>
                              <div className="flex gap-1.5 mt-0.5">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${p.status === "confirmed" ? "border-green-700/40 text-green-400" : "border-white/20 text-white/30"}`}>
                                  {p.status ?? "—"}
                                </span>
                                {p.isFoundingMember && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-900/40 border border-amber-700/40 text-amber-400">FOUNDING</span>}
                                {p.source === "admin_manual" && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-900/40 border border-blue-700/40 text-blue-400">OFFLINE</span>}
                              </div>
                            </div>
                            <span className="text-white/70">{p.quantity ?? 1}</span>
                            <span className="text-white/70">{p.totalPaid != null ? `$${p.totalPaid}` : p.pricePerTicket != null ? `$${p.pricePerTicket}` : "—"}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full border w-fit ${p.paymentMethod === "cash" ? "border-emerald-700/50 text-emerald-400" : p.paymentMethod === "etransfer" ? "border-blue-700/50 text-blue-400" : "border-white/20 text-white/40"}`}>
                              {p.paymentMethod ?? "stripe"}
                            </span>
                            <span className="text-white/40 text-xs">{formatDate(p.purchasedAt ?? p.createdAt)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
