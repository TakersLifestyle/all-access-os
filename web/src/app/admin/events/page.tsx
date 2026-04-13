"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection, addDoc, getDocs, deleteDoc, doc, updateDoc,
  orderBy, query, serverTimestamp, Timestamp,
} from "firebase/firestore";

interface Event {
  id: string;
  title: string;
  date: string;
  location: string;
  description: string;
  imageUrl: string;
  generalPrice: number | string;
  memberPrice: number | string;
  capacity: number | string;
  ticketsRemaining: number | string;
  isMembersOnly: boolean;
  status: "active" | "draft" | "sold_out";
  createdAt?: Timestamp;
}

const empty = {
  title: "",
  date: "",
  location: "",
  description: "",
  imageUrl: "",
  generalPrice: "",
  memberPrice: "",
  capacity: "",
  ticketsRemaining: "",
  isMembersOnly: true,
  status: "active" as "active" | "draft" | "sold_out",
};

export default function AdminEventsPage() {
  const { isAdmin, loading } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !isAdmin) router.push("/");
  }, [loading, isAdmin, router]);

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
    const data = {
      title: form.title,
      date: form.date,
      location: form.location,
      description: form.description,
      imageUrl: form.imageUrl,
      generalPrice: Number(form.generalPrice) || 0,
      memberPrice: Number(form.memberPrice) || 0,
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
    setForm(empty);
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
      capacity: ev.capacity?.toString() || "",
      ticketsRemaining: ev.ticketsRemaining?.toString() || "",
      isMembersOnly: ev.isMembersOnly ?? true,
      status: ev.status || "active",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (loading || !isAdmin) return null;

  return (
    <main className="max-w-4xl mx-auto px-6 py-12 space-y-10">
      <div className="flex items-center gap-4">
        <button onClick={() => router.push("/admin")} className="text-white/40 hover:text-white text-sm transition">← Back</button>
        <h1 className="text-3xl font-bold">Manage Events</h1>
      </div>

      {/* Form */}
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

        {/* Pricing */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="relative">
            <label className="text-xs text-white/40 uppercase tracking-wider pl-1 block mb-1">General Price</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">$</span>
              <input
                value={form.generalPrice}
                onChange={(e) => setForm({ ...form, generalPrice: e.target.value })}
                placeholder="0 = not available"
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-4 py-3 outline-none focus:border-pink-500 transition"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-pink-400 uppercase tracking-wider pl-1 block mb-1">Member Price</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-pink-400">$</span>
              <input
                value={form.memberPrice}
                onChange={(e) => setForm({ ...form, memberPrice: e.target.value })}
                placeholder="0 = FREE for members"
                className="w-full bg-white/5 border border-pink-500/30 rounded-xl pl-8 pr-4 py-3 outline-none focus:border-pink-500 transition"
              />
            </div>
          </div>
        </div>

        {/* Capacity */}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-white/40 uppercase tracking-wider pl-1 block mb-1">Total Capacity</label>
            <input
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: e.target.value })}
              placeholder="e.g. 50"
              type="number"
              min={0}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-pink-500 transition"
            />
          </div>
          <div>
            <label className="text-xs text-amber-400 uppercase tracking-wider pl-1 block mb-1">Tickets Remaining</label>
            <input
              value={form.ticketsRemaining}
              onChange={(e) => setForm({ ...form, ticketsRemaining: e.target.value })}
              placeholder="Tracks urgency / scarcity"
              type="number"
              min={0}
              className="w-full bg-white/5 border border-amber-500/30 rounded-xl px-4 py-3 outline-none focus:border-amber-500 transition"
            />
          </div>
        </div>

        {/* Image URL */}
        <input
          value={form.imageUrl}
          onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
          placeholder="Image URL (paste a direct image link)"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-pink-500 transition"
        />

        {form.imageUrl && (
          <div className="rounded-xl overflow-hidden border border-white/10 h-40">
            <img src={form.imageUrl} alt="Preview" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          </div>
        )}

        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Event description — what's happening, dress code, vibe, etc."
          rows={3}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-pink-500 transition resize-none"
        />

        {/* Toggles */}
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setForm({ ...form, isMembersOnly: !form.isMembersOnly })}
              className={`w-10 h-6 rounded-full transition-colors ${form.isMembersOnly ? "bg-pink-600" : "bg-white/20"} relative`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${form.isMembersOnly ? "translate-x-5" : "translate-x-1"}`} />
            </div>
            <span className="text-sm text-white/70">Members Only</span>
          </label>

          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as typeof form.status })}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-pink-500 transition"
          >
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="sold_out">Sold Out</option>
          </select>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="bg-pink-600 hover:bg-pink-500 disabled:opacity-50 px-6 py-2 rounded-xl font-medium transition"
          >
            {saving ? "Saving..." : editId ? "Update Event" : "Add Event"}
          </button>
          {editId && (
            <button
              type="button"
              onClick={() => { setEditId(null); setForm(empty); }}
              className="border border-white/20 hover:border-white/40 px-6 py-2 rounded-xl font-medium transition"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* List */}
      <div className="space-y-4">
        {events.length === 0 ? (
          <p className="text-white/40">No events yet. Add one above.</p>
        ) : events.map((ev) => {
          const cap = Number(ev.capacity) || 0;
          const rem = Number(ev.ticketsRemaining ?? ev.capacity) || 0;
          const pct = cap ? Math.round(((cap - rem) / cap) * 100) : 0;
          return (
            <div key={ev.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden flex">
              {ev.imageUrl && (
                <img src={ev.imageUrl} alt={ev.title} className="w-28 object-cover shrink-0" />
              )}
              <div className="flex-1 p-5 space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{ev.title}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${ev.status === "active" ? "border-green-700/50 text-green-400" : ev.status === "sold_out" ? "border-red-700/50 text-red-400" : "border-white/20 text-white/40"}`}>
                        {ev.status === "sold_out" ? "SOLD OUT" : ev.status}
                      </span>
                      {ev.isMembersOnly && <span className="text-xs px-2 py-0.5 rounded-full border border-pink-700/50 text-pink-400">Members Only</span>}
                    </div>
                    {ev.date && <p className="text-white/50 text-sm">{new Date(ev.date + "T12:00:00").toLocaleDateString("en-CA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}{ev.location ? ` · ${ev.location}` : ""}</p>}
                  </div>
                  <div className="flex gap-2 shrink-0">
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
                      <span>{ev.ticketsRemaining ?? ev.capacity} spots remaining</span>
                      <span>{pct}% filled</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${pct > 80 ? "bg-red-500" : pct > 50 ? "bg-amber-500" : "bg-green-500"}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
