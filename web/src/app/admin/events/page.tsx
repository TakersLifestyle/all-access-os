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
  image: string;
  price: string;
  memberPrice: string;
  createdAt?: Timestamp;
}

const empty = { title: "", date: "", location: "", description: "", image: "", price: "", memberPrice: "" };

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
    const data = {
      title: form.title,
      date: form.date,
      location: form.location,
      description: form.description,
      image: form.image,
      price: form.price,
      memberPrice: form.memberPrice,
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
      title: ev.title,
      date: ev.date,
      location: ev.location,
      description: ev.description,
      image: ev.image || "",
      price: ev.price || "",
      memberPrice: ev.memberPrice || "",
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

        <div className="grid md:grid-cols-2 gap-4">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">$</span>
            <input
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder="General Ticket Price"
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-4 py-3 outline-none focus:border-pink-500 transition"
            />
          </div>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-pink-400">$</span>
            <input
              value={form.memberPrice}
              onChange={(e) => setForm({ ...form, memberPrice: e.target.value })}
              placeholder="Member Price (leave blank = FREE)"
              className="w-full bg-white/5 border border-pink-500/30 rounded-xl pl-8 pr-4 py-3 outline-none focus:border-pink-500 transition"
            />
          </div>
        </div>

        <input
          value={form.image}
          onChange={(e) => setForm({ ...form, image: e.target.value })}
          placeholder="Image URL (paste a direct image link)"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-pink-500 transition"
        />

        {/* Image preview */}
        {form.image && (
          <div className="rounded-xl overflow-hidden border border-white/10 h-40">
            <img src={form.image} alt="Preview" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          </div>
        )}

        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Event description — what's happening, dress code, vibe, etc."
          rows={3}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-pink-500 transition resize-none"
        />

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
        ) : events.map((ev) => (
          <div key={ev.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden flex gap-0">
            {ev.image && (
              <img src={ev.image} alt={ev.title} className="w-32 h-full object-cover shrink-0" />
            )}
            <div className="flex-1 p-5 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h3 className="font-semibold text-lg">{ev.title}</h3>
                {ev.date && <p className="text-white/50 text-sm">{new Date(ev.date + "T12:00:00").toLocaleDateString("en-CA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}{ev.location ? ` · ${ev.location}` : ""}</p>}
                {ev.description && <p className="text-white/40 text-sm line-clamp-2">{ev.description}</p>}
                <div className="flex gap-3 pt-1">
                  {ev.price && <span className="text-white/50 text-sm">General: <span className="text-white font-medium">${ev.price}</span></span>}
                  {ev.memberPrice ? (
                    <span className="text-pink-400 text-sm font-medium">Members: ${ev.memberPrice}</span>
                  ) : ev.price ? (
                    <span className="text-pink-400 text-sm font-medium">Members: FREE</span>
                  ) : null}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => handleEdit(ev)} className="text-sm px-3 py-1 rounded-lg border border-white/20 hover:border-white/40 transition">Edit</button>
                <button onClick={() => handleDelete(ev.id)} className="text-sm px-3 py-1 rounded-lg border border-red-800 text-red-400 hover:bg-red-950/40 transition">Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
