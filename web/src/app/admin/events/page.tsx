"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection, addDoc, getDocs, deleteDoc, doc, updateDoc,
  orderBy, query, serverTimestamp, Timestamp, where,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Event {
  id: string;
  title: string;
  date: string;
  location: string;
  description: string;
  imageUrl: string;
  generalPrice: number | string;
  memberPrice: number | string;
  memberDiscountPercent?: number | string;
  currency?: string;
  capacity: number | string;
  ticketsRemaining: number | string;
  isMembersOnly: boolean;
  status: "active" | "draft" | "sold_out" | "completed";
  createdAt?: Timestamp;
}

interface Attendee {
  id: string;
  userId?: string;
  displayName?: string;
  userEmail?: string;
  quantity?: number;
  status?: string;
  paymentMethod?: string;
  pricePerTicket?: number;
  totalPaid?: number;
  source?: string;
  isFoundingMember?: boolean;
  isCreator?: boolean;
  notes?: string;
  purchasedAt?: Timestamp | string;
  createdAt?: Timestamp | string;
}

type PaymentMethod = "cash" | "etransfer" | "other";

interface OfflineForm {
  displayName: string;
  userEmail: string;
  quantity: string;
  paymentMethod: PaymentMethod;
  pricePerTicket: string;
  totalPaid: string;
  notes: string;
}

const emptyEvent = {
  title: "",
  date: "",
  location: "",
  description: "",
  imageUrl: "",
  generalPrice: "",
  memberPrice: "",
  memberDiscountPercent: "15",
  currency: "CAD",
  capacity: "",
  ticketsRemaining: "",
  isMembersOnly: true,
  status: "active" as "active" | "draft" | "sold_out" | "completed",
};

const emptyOfflineForm: OfflineForm = {
  displayName: "",
  userEmail: "",
  quantity: "1",
  paymentMethod: "cash",
  pricePerTicket: "",
  totalPaid: "",
  notes: "",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(raw?: Timestamp | string): string {
  if (!raw) return "—";
  const d = typeof raw === "string" ? new Date(raw) : (raw as Timestamp).toDate();
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminEventsPage() {
  const { isAdmin, loading, user } = useAuth();
  const router = useRouter();

  // Event list state
  const [events, setEvents] = useState<Event[]>([]);
  const [form, setForm] = useState(emptyEvent);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Attendees state
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [attendeesMap, setAttendeesMap] = useState<Record<string, Attendee[]>>({});
  const [attendeesLoading, setAttendeesLoading] = useState<string | null>(null);

  // Offline attendee modal state
  const [offlineEventId, setOfflineEventId] = useState<string | null>(null);
  const [offlineForm, setOfflineForm] = useState<OfflineForm>(emptyOfflineForm);
  const [offlineSubmitting, setOfflineSubmitting] = useState(false);
  const [offlineError, setOfflineError] = useState<string | null>(null);
  const [offlineSuccess, setOfflineSuccess] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<{ existing: string; qty: number } | null>(null);

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!loading && !isAdmin) router.push("/");
  }, [loading, isAdmin, router]);

  // ── Event CRUD ──────────────────────────────────────────────────────────────
  const fetchEvents = async () => {
    const snap = await getDocs(query(collection(db, "events"), orderBy("date", "asc")));
    setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Event)));
  };

  useEffect(() => { if (isAdmin) fetchEvents(); }, [isAdmin]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    const cap = Number(form.capacity) || 0;
    const remaining = Number(form.ticketsRemaining) || cap;
    const gp = Number(form.generalPrice) || 0;
    const disc = Number(form.memberDiscountPercent) || 15;
    const mp = Number(form.memberPrice) || (gp > 0 ? Math.round(gp * (1 - disc / 100)) : 0);
    const data = {
      title: form.title,
      date: form.date,
      location: form.location,
      description: form.description,
      imageUrl: form.imageUrl,
      generalPrice: gp,
      memberPrice: mp,
      memberDiscountPercent: disc,
      currency: form.currency || "CAD",
      capacity: cap,
      ticketsRemaining: remaining,
      isMembersOnly: form.isMembersOnly,
      status: form.status,
    };
    if (editId) {
      await updateDoc(doc(db, "events", editId), data);
    } else {
      await addDoc(collection(db, "events"), { ...data, createdAt: serverTimestamp() });
    }
    setForm(emptyEvent);
    setEditId(null);
    await fetchEvents();
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this event?")) return;
    await deleteDoc(doc(db, "events", id));
    await fetchEvents();
  };

  const handleEdit = (ev: Event) => {
    setEditId(ev.id);
    setForm({
      title: ev.title || "",
      date: ev.date || "",
      location: ev.location || "",
      description: ev.description || "",
      imageUrl: ev.imageUrl || "",
      generalPrice: ev.generalPrice?.toString() || "",
      memberPrice: ev.memberPrice?.toString() || "",
      memberDiscountPercent: ev.memberDiscountPercent?.toString() || "15",
      currency: ev.currency || "CAD",
      capacity: ev.capacity?.toString() || "",
      ticketsRemaining: ev.ticketsRemaining?.toString() || "",
      isMembersOnly: ev.isMembersOnly ?? true,
      status: (ev.status || "active") as "active" | "draft" | "sold_out" | "completed",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Attendees ───────────────────────────────────────────────────────────────
  const toggleAttendees = async (eventId: string) => {
    if (expandedEventId === eventId) {
      setExpandedEventId(null);
      return;
    }
    setExpandedEventId(eventId);
    if (attendeesMap[eventId]) return;
    setAttendeesLoading(eventId);
    try {
      const snap = await getDocs(
        query(collection(db, "eventPurchases"), where("eventId", "==", eventId))
      );
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Attendee));
      list.sort((a, b) => {
        const aT = a.purchasedAt ?? a.createdAt;
        const bT = b.purchasedAt ?? b.createdAt;
        const aMs = typeof aT === "string" ? new Date(aT).getTime() : (aT as Timestamp)?.toMillis?.() ?? 0;
        const bMs = typeof bT === "string" ? new Date(bT).getTime() : (bT as Timestamp)?.toMillis?.() ?? 0;
        return bMs - aMs;
      });
      setAttendeesMap((prev) => ({ ...prev, [eventId]: list }));
    } catch (err) {
      console.error("Failed to fetch attendees:", err);
      setAttendeesMap((prev) => ({ ...prev, [eventId]: [] }));
    } finally {
      setAttendeesLoading(null);
    }
  };

  const refreshAttendees = async (eventId: string) => {
    setAttendeesMap((prev) => { const n = { ...prev }; delete n[eventId]; return n; });
    setAttendeesLoading(eventId);
    try {
      const snap = await getDocs(
        query(collection(db, "eventPurchases"), where("eventId", "==", eventId))
      );
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Attendee));
      list.sort((a, b) => {
        const aT = a.purchasedAt ?? a.createdAt;
        const bT = b.purchasedAt ?? b.createdAt;
        const aMs = typeof aT === "string" ? new Date(aT).getTime() : (aT as Timestamp)?.toMillis?.() ?? 0;
        const bMs = typeof bT === "string" ? new Date(bT).getTime() : (bT as Timestamp)?.toMillis?.() ?? 0;
        return bMs - aMs;
      });
      setAttendeesMap((prev) => ({ ...prev, [eventId]: list }));
    } finally {
      setAttendeesLoading(null);
    }
  };

  // ── Offline attendee submit ──────────────────────────────────────────────────
  const openOfflineModal = (eventId: string, ev: Event) => {
    setOfflineEventId(eventId);
    setOfflineForm({
      ...emptyOfflineForm,
      pricePerTicket: ev.memberPrice?.toString() ?? "",
      totalPaid: ev.memberPrice?.toString() ?? "",
    });
    setOfflineError(null);
    setOfflineSuccess(null);
    setDuplicateWarning(null);
  };

  const closeOfflineModal = () => {
    setOfflineEventId(null);
    setOfflineForm(emptyOfflineForm);
    setOfflineError(null);
    setOfflineSuccess(null);
    setDuplicateWarning(null);
  };

  const handleOfflineQtyChange = (qty: string) => {
    const q = Math.max(1, parseInt(qty) || 1);
    const ppt = parseFloat(offlineForm.pricePerTicket) || 0;
    setOfflineForm((f) => ({ ...f, quantity: q.toString(), totalPaid: (ppt * q).toFixed(0) }));
  };

  const handleOfflinePptChange = (ppt: string) => {
    const p = parseFloat(ppt) || 0;
    const q = parseInt(offlineForm.quantity) || 1;
    setOfflineForm((f) => ({ ...f, pricePerTicket: ppt, totalPaid: (p * q).toFixed(0) }));
  };

  const submitOfflineAttendee = async (confirmDuplicate = false) => {
    if (!offlineEventId) return;
    setOfflineSubmitting(true);
    setOfflineError(null);
    setDuplicateWarning(null);

    try {
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Not authenticated");

      const res = await fetch("/api/admin/add-offline-attendee", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          eventId: offlineEventId,
          displayName: offlineForm.displayName.trim(),
          userEmail: offlineForm.userEmail.trim(),
          quantity: parseInt(offlineForm.quantity) || 1,
          paymentMethod: offlineForm.paymentMethod,
          pricePerTicket: parseFloat(offlineForm.pricePerTicket) || 0,
          totalPaid: parseFloat(offlineForm.totalPaid) || 0,
          notes: offlineForm.notes.trim(),
          confirmDuplicate,
        }),
      });

      const data = await res.json() as {
        success?: boolean;
        error?: string;
        message?: string;
        existingOrdId?: string;
        existingQty?: number;
        orderId?: string;
      };

      if (!res.ok) {
        if (data.error === "duplicate") {
          setDuplicateWarning({ existing: data.existingOrdId ?? "", qty: data.existingQty ?? 1 });
        } else {
          setOfflineError(data.error ?? "Something went wrong");
        }
        return;
      }

      setOfflineSuccess(`✓ Attendee added — order ${data.orderId}`);
      // Refresh events list (ticketsRemaining changed) + attendees
      await fetchEvents();
      if (expandedEventId === offlineEventId) {
        await refreshAttendees(offlineEventId);
      }
      setTimeout(closeOfflineModal, 2000);
    } catch (err: unknown) {
      setOfflineError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setOfflineSubmitting(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loading || !isAdmin) return null;

  const offlineEvent = offlineEventId ? events.find((e) => e.id === offlineEventId) : null;

  return (
    <main className="max-w-4xl mx-auto px-6 py-12 space-y-10">
      <div className="flex items-center gap-4">
        <button onClick={() => router.push("/admin")} className="text-white/40 hover:text-white text-sm transition">← Back</button>
        <h1 className="text-3xl font-bold">Manage Events</h1>
      </div>

      {/* ── Event form ── */}
      <form onSubmit={handleSave} className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-lg">{editId ? "Edit Event" : "Add New Event"}</h2>

        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Event title *"
          required
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-pink-500 transition"
        />

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs text-white/40 uppercase tracking-wider pl-1">Event Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-pink-500 transition"
            />
          </div>
          <input
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder="Location / Venue"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-pink-500 transition"
          />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-white/40 uppercase tracking-wider pl-1 block mb-1">Public Price (CAD)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">$</span>
              <input
                value={form.generalPrice}
                onChange={(e) => {
                  const gp = parseFloat(e.target.value) || 0;
                  const disc = parseFloat(form.memberDiscountPercent?.toString() || "15") || 15;
                  const mp = gp > 0 ? Math.round(gp * (1 - disc / 100)) : 0;
                  setForm({ ...form, generalPrice: e.target.value, memberPrice: mp > 0 ? String(mp) : "" });
                }}
                placeholder="0"
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-4 py-3 outline-none focus:border-pink-500 transition"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-white/40 uppercase tracking-wider pl-1 block mb-1">Currency</label>
            <select
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-pink-500 transition"
            >
              <option value="CAD">CAD</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-white/40 uppercase tracking-wider pl-1 block mb-1">Member Discount (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              value={form.memberDiscountPercent}
              onChange={(e) => {
                const disc = parseFloat(e.target.value) || 0;
                const gp = parseFloat(form.generalPrice?.toString() || "0") || 0;
                const mp = gp > 0 && disc > 0 ? Math.round(gp * (1 - disc / 100)) : 0;
                setForm({ ...form, memberDiscountPercent: e.target.value, memberPrice: mp > 0 ? String(mp) : form.memberPrice });
              }}
              placeholder="15"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-pink-500 transition"
            />
          </div>
          <div>
            <label className="text-xs text-pink-400 uppercase tracking-wider pl-1 block mb-1">
              Member Price — auto-calculated, override if needed
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-pink-400">$</span>
              <input
                value={form.memberPrice}
                onChange={(e) => setForm({ ...form, memberPrice: e.target.value })}
                placeholder="auto"
                className="w-full bg-white/5 border border-pink-500/30 rounded-xl pl-8 pr-4 py-3 outline-none focus:border-pink-500 transition"
              />
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-white/40 uppercase tracking-wider pl-1 block mb-1">Total Capacity</label>
            <input value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} placeholder="e.g. 50" type="number" min={0} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-pink-500 transition" />
          </div>
          <div>
            <label className="text-xs text-amber-400 uppercase tracking-wider pl-1 block mb-1">Tickets Remaining</label>
            <input value={form.ticketsRemaining} onChange={(e) => setForm({ ...form, ticketsRemaining: e.target.value })} placeholder="Tracks urgency" type="number" min={0} className="w-full bg-white/5 border border-amber-500/30 rounded-xl px-4 py-3 outline-none focus:border-amber-500 transition" />
          </div>
        </div>

        <input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="Image URL" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-pink-500 transition" />
        {form.imageUrl && (
          <div className="rounded-xl overflow-hidden border border-white/10 h-40">
            <img src={form.imageUrl} alt="Preview" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          </div>
        )}

        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Event description" rows={3} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-pink-500 transition resize-none" />

        <div className="flex items-center gap-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <div onClick={() => setForm({ ...form, isMembersOnly: !form.isMembersOnly })} className={`w-10 h-6 rounded-full transition-colors ${form.isMembersOnly ? "bg-pink-600" : "bg-white/20"} relative`}>
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${form.isMembersOnly ? "translate-x-5" : "translate-x-1"}`} />
            </div>
            <span className="text-sm text-white/70">Members Only</span>
          </label>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as typeof form.status })} className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-pink-500 transition">
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="sold_out">Sold Out</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="bg-pink-600 hover:bg-pink-500 disabled:opacity-50 px-6 py-2 rounded-xl font-medium transition">
            {saving ? "Saving..." : editId ? "Update Event" : "Add Event"}
          </button>
          {editId && (
            <button type="button" onClick={() => { setEditId(null); setForm(emptyEvent); }} className="border border-white/20 hover:border-white/40 px-6 py-2 rounded-xl font-medium transition">
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* ── Event list ── */}
      <div className="space-y-4">
        {events.length === 0 ? (
          <p className="text-white/40">No events yet. Add one above.</p>
        ) : events.map((ev) => {
          const cap = Number(ev.capacity) || 0;
          const rem = Number(ev.ticketsRemaining ?? ev.capacity) || 0;
          const pct = cap ? Math.round(((cap - rem) / cap) * 100) : 0;
          const isExpanded = expandedEventId === ev.id;
          const attendees = attendeesMap[ev.id];

          return (
            <div key={ev.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              {/* Card row */}
              <div className="flex">
                {ev.imageUrl && (
                  <img src={ev.imageUrl} alt={ev.title} className="w-28 object-cover shrink-0" />
                )}
                <div className="flex-1 p-5 space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">{ev.title}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${ev.status === "active" ? "border-green-700/50 text-green-400" : ev.status === "sold_out" ? "border-red-700/50 text-red-400" : ev.status === "completed" ? "border-emerald-700/50 text-emerald-400" : "border-white/20 text-white/40"}`}>
                          {ev.status === "sold_out" ? "SOLD OUT" : ev.status === "completed" ? "COMPLETED" : ev.status}
                        </span>
                        {ev.isMembersOnly && <span className="text-xs px-2 py-0.5 rounded-full border border-pink-700/50 text-pink-400">Members Only</span>}
                      </div>
                      {ev.date && <p className="text-white/50 text-sm">{new Date(ev.date + "T12:00:00").toLocaleDateString("en-CA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}{ev.location ? ` · ${ev.location}` : ""}</p>}
                    </div>
                    <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                      <button onClick={() => openOfflineModal(ev.id, ev)} className="text-xs px-3 py-1 rounded-lg border border-emerald-700/60 text-emerald-400 hover:bg-emerald-950/40 transition">+ Offline</button>
                      <button onClick={() => handleEdit(ev)} className="text-sm px-3 py-1 rounded-lg border border-white/20 hover:border-white/40 transition">Edit</button>
                      <button onClick={() => handleDelete(ev.id)} className="text-sm px-3 py-1 rounded-lg border border-red-800 text-red-400 hover:bg-red-950/40 transition">Delete</button>
                    </div>
                  </div>

                  <div className="flex gap-4 text-sm">
                    {ev.generalPrice ? <span className="text-white/50">General: <span className="text-white">${ev.generalPrice}</span></span> : <span className="text-white/30">General: N/A</span>}
                    <span className="text-pink-400">Members: {ev.memberPrice ? `$${ev.memberPrice}` : "FREE"}</span>
                  </div>

                  {ev.capacity ? (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-white/40">
                        <span>{rem} of {cap} spots remaining</span>
                        <span>{pct}% filled · {cap - rem} confirmed</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${pct > 80 ? "bg-red-500" : pct > 50 ? "bg-amber-500" : "bg-green-500"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  ) : null}

                  <button
                    onClick={() => toggleAttendees(ev.id)}
                    className="text-xs text-pink-400 hover:text-pink-300 transition flex items-center gap-1 pt-1"
                  >
                    {isExpanded ? "▲ Hide Attendees" : "▼ View Attendees"}
                    {attendees !== undefined && (
                      <span className="ml-1 bg-pink-600/20 border border-pink-700/40 text-pink-300 px-1.5 py-0.5 rounded-full text-[10px]">
                        {attendees.length}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Attendees panel */}
              {isExpanded && (
                <div className="border-t border-white/10 px-5 py-4 bg-white/[0.02]">
                  {attendeesLoading === ev.id ? (
                    <p className="text-white/40 text-sm">Loading attendees…</p>
                  ) : !attendees || attendees.length === 0 ? (
                    <p className="text-white/30 text-sm">No attendees recorded yet.</p>
                  ) : (
                    <div>
                      <div className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr] text-[10px] uppercase tracking-wider text-white/30 pb-2 border-b border-white/10 mb-1">
                        <span>Name</span>
                        <span>Email</span>
                        <span>Qty</span>
                        <span>Paid</span>
                        <span>Method</span>
                        <span>Date</span>
                      </div>
                      {attendees.map((a) => (
                        <div key={a.id} className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr] text-sm py-2.5 border-b border-white/5 last:border-0 items-center gap-2">
                          <span className="font-medium flex items-center gap-1.5 min-w-0">
                            <span className="truncate">{a.displayName ?? "—"}</span>
                            {a.isFoundingMember && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-900/40 border border-amber-700/40 text-amber-400 shrink-0">FOUNDING</span>}
                            {a.isCreator && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-900/40 border border-purple-700/40 text-purple-300 shrink-0">CREATOR</span>}
                            {a.source === "admin_manual" && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-900/40 border border-blue-700/40 text-blue-400 shrink-0">OFFLINE</span>}
                          </span>
                          <span className="text-white/50 truncate">{a.userEmail ?? "—"}</span>
                          <span className="text-white/70">{a.quantity ?? 1}</span>
                          <span className="text-white/70">{a.totalPaid != null ? `$${a.totalPaid}` : a.pricePerTicket != null ? `$${a.pricePerTicket}` : "—"}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full border w-fit ${a.paymentMethod === "cash" ? "border-emerald-700/50 text-emerald-400" : a.paymentMethod === "etransfer" ? "border-blue-700/50 text-blue-400" : "border-white/20 text-white/40"}`}>
                            {a.paymentMethod ?? "stripe"}
                          </span>
                          <span className="text-white/40 text-xs">{formatDate(a.purchasedAt ?? a.createdAt)}</span>
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

      {/* ── Offline Attendee Modal ── */}
      {offlineEventId && offlineEvent && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl">
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-white/10">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-bold text-lg">Add Offline Attendee</h2>
                  <p className="text-white/40 text-sm mt-0.5 truncate">{offlineEvent.title}</p>
                </div>
                <button onClick={closeOfflineModal} className="text-white/30 hover:text-white text-xl leading-none mt-0.5">×</button>
              </div>
              <div className="flex gap-4 mt-3 text-xs text-white/40">
                <span>Capacity: <span className="text-white">{offlineEvent.capacity}</span></span>
                <span>Remaining: <span className={Number(offlineEvent.ticketsRemaining) <= 3 ? "text-red-400" : "text-green-400"}>{offlineEvent.ticketsRemaining}</span></span>
                <span>Member Price: <span className="text-pink-400">${offlineEvent.memberPrice}</span></span>
              </div>
            </div>

            {/* Form body */}
            <div className="px-6 py-5 space-y-4">
              {/* Name + Email */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/40 uppercase tracking-wider pl-1 block mb-1">Full Name *</label>
                  <input
                    value={offlineForm.displayName}
                    onChange={(e) => setOfflineForm((f) => ({ ...f, displayName: e.target.value }))}
                    placeholder="e.g. Tee"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-pink-500 transition"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/40 uppercase tracking-wider pl-1 block mb-1">Email *</label>
                  <input
                    type="email"
                    value={offlineForm.userEmail}
                    onChange={(e) => setOfflineForm((f) => ({ ...f, userEmail: e.target.value }))}
                    placeholder="email@example.com"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-pink-500 transition"
                  />
                </div>
              </div>

              {/* Quantity + Payment method */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/40 uppercase tracking-wider pl-1 block mb-1">Quantity</label>
                  <input
                    type="number"
                    min={1}
                    max={Number(offlineEvent.ticketsRemaining) || 10}
                    value={offlineForm.quantity}
                    onChange={(e) => handleOfflineQtyChange(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-pink-500 transition"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/40 uppercase tracking-wider pl-1 block mb-1">Payment Method</label>
                  <select
                    value={offlineForm.paymentMethod}
                    onChange={(e) => setOfflineForm((f) => ({ ...f, paymentMethod: e.target.value as PaymentMethod }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-pink-500 transition"
                  >
                    <option value="cash">Cash</option>
                    <option value="etransfer">E-Transfer</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              {/* Price per ticket + Total */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/40 uppercase tracking-wider pl-1 block mb-1">Price / Ticket (CAD)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">$</span>
                    <input
                      type="number"
                      min={0}
                      value={offlineForm.pricePerTicket}
                      onChange={(e) => handleOfflinePptChange(e.target.value)}
                      placeholder="0"
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-7 pr-3 py-2.5 text-sm outline-none focus:border-pink-500 transition"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-emerald-400 uppercase tracking-wider pl-1 block mb-1">Total Received (CAD)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400 text-sm">$</span>
                    <input
                      type="number"
                      min={0}
                      value={offlineForm.totalPaid}
                      onChange={(e) => setOfflineForm((f) => ({ ...f, totalPaid: e.target.value }))}
                      placeholder="0"
                      className="w-full bg-white/5 border border-emerald-500/30 rounded-xl pl-7 pr-3 py-2.5 text-sm outline-none focus:border-emerald-500 transition"
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs text-white/40 uppercase tracking-wider pl-1 block mb-1">Admin Notes (optional)</label>
                <textarea
                  value={offlineForm.notes}
                  onChange={(e) => setOfflineForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="e.g. Paid at the venue / founding member rate"
                  rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-pink-500 transition resize-none"
                />
              </div>

              {/* Duplicate warning */}
              {duplicateWarning && (
                <div className="bg-amber-950/40 border border-amber-700/40 rounded-xl px-4 py-3 space-y-2">
                  <p className="text-amber-400 text-sm font-medium">⚠ Duplicate — email already registered for this event ({duplicateWarning.qty} ticket{duplicateWarning.qty > 1 ? "s" : ""} on record)</p>
                  <p className="text-white/50 text-xs">Confirm below to add this as an additional entry.</p>
                  <button
                    onClick={() => submitOfflineAttendee(true)}
                    disabled={offlineSubmitting}
                    className="text-xs px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 font-medium transition"
                  >
                    Yes, add additional entry anyway
                  </button>
                </div>
              )}

              {/* Error */}
              {offlineError && (
                <p className="text-red-400 text-sm bg-red-950/30 border border-red-800/40 rounded-xl px-4 py-3">{offlineError}</p>
              )}

              {/* Success */}
              {offlineSuccess && (
                <p className="text-emerald-400 text-sm bg-emerald-950/30 border border-emerald-800/40 rounded-xl px-4 py-3">{offlineSuccess}</p>
              )}
            </div>

            {/* Footer */}
            {!offlineSuccess && (
              <div className="px-6 pb-6 flex gap-3">
                <button
                  onClick={() => submitOfflineAttendee(false)}
                  disabled={offlineSubmitting || !offlineForm.displayName.trim() || !offlineForm.userEmail.trim()}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 px-6 py-2.5 rounded-xl font-medium transition text-sm"
                >
                  {offlineSubmitting ? "Saving…" : "Confirm Attendee"}
                </button>
                <button
                  onClick={closeOfflineModal}
                  disabled={offlineSubmitting}
                  className="px-5 py-2.5 rounded-xl border border-white/20 hover:border-white/40 text-sm transition disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
