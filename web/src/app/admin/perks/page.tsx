"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection, addDoc, getDocs, deleteDoc, doc, updateDoc,
  orderBy, query, serverTimestamp, Timestamp,
} from "firebase/firestore";

interface Perk {
  id: string;
  title: string;
  description: string;
  partner: string;
  discount: string;
  code: string;
  createdAt?: Timestamp;
}

const empty = { title: "", description: "", partner: "", discount: "", code: "" };

export default function AdminPerksPage() {
  const { isAdmin, loading } = useAuth();
  const router = useRouter();
  const [perks, setPerks] = useState<Perk[]>([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !isAdmin) router.push("/");
  }, [loading, isAdmin, router]);

  const fetchPerks = async () => {
    const snap = await getDocs(query(collection(db, "perks"), orderBy("createdAt", "desc")));
    setPerks(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Perk)));
  };

  useEffect(() => { if (isAdmin) fetchPerks(); }, [isAdmin]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    const data = {
      title: form.title,
      description: form.description,
      partner: form.partner,
      discount: form.discount,
      code: form.code.toUpperCase(),
    };
    if (editId) {
      await updateDoc(doc(db, "perks", editId), data);
    } else {
      await addDoc(collection(db, "perks"), { ...data, createdAt: serverTimestamp() });
    }
    setForm(empty);
    setEditId(null);
    await fetchPerks();
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this perk?")) return;
    await deleteDoc(doc(db, "perks", id));
    await fetchPerks();
  };

  const handleEdit = (p: Perk) => {
    setEditId(p.id);
    setForm({ title: p.title, description: p.description, partner: p.partner, discount: p.discount, code: p.code || "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (loading || !isAdmin) return null;

  return (
    <main className="max-w-4xl mx-auto px-6 py-12 space-y-10">
      <div className="flex items-center gap-4">
        <button onClick={() => router.push("/admin")} className="text-white/40 hover:text-white text-sm transition">← Back</button>
        <h1 className="text-3xl font-bold">Manage Perks</h1>
      </div>

      {/* Form */}
      <form onSubmit={handleSave} className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-lg">{editId ? "Edit Perk" : "Add New Perk"}</h2>

        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Perk title * (e.g. 20% off at Bison)"
          required
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-pink-500 transition"
        />

        <div className="grid md:grid-cols-2 gap-4">
          <input
            value={form.partner}
            onChange={(e) => setForm({ ...form, partner: e.target.value })}
            placeholder="Partner / Brand name"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-pink-500 transition"
          />
          <input
            value={form.discount}
            onChange={(e) => setForm({ ...form, discount: e.target.value })}
            placeholder="Discount label (e.g. 20% off, $10 off, Free item)"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-pink-500 transition"
          />
        </div>

        <div className="relative">
          <input
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            placeholder="PROMO CODE (e.g. ALLACCESS20)"
            className="w-full bg-pink-950/20 border border-pink-500/30 rounded-xl px-4 py-3 outline-none focus:border-pink-500 transition font-mono tracking-widest text-pink-300 uppercase"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-white/30">CODE</span>
        </div>

        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Description — how to redeem, what's included, any restrictions"
          rows={3}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-pink-500 transition resize-none"
        />

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="bg-pink-600 hover:bg-pink-500 disabled:opacity-50 px-6 py-2 rounded-xl font-medium transition"
          >
            {saving ? "Saving..." : editId ? "Update Perk" : "Add Perk"}
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
        {perks.length === 0 ? (
          <p className="text-white/40">No perks yet. Add one above.</p>
        ) : perks.map((p) => (
          <div key={p.id} className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-start justify-between gap-4">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="font-semibold">{p.title}</h3>
                {p.discount && (
                  <span className="bg-pink-600/20 border border-pink-500/30 text-pink-300 text-xs px-2 py-0.5 rounded-full font-medium">{p.discount}</span>
                )}
              </div>
              {p.partner && <p className="text-pink-400 text-sm font-medium">{p.partner}</p>}
              {p.description && <p className="text-white/40 text-sm">{p.description}</p>}
              {p.code && (
                <div className="inline-flex items-center gap-2 bg-black/40 border border-white/10 rounded-lg px-3 py-1.5">
                  <span className="font-mono text-sm text-pink-300 tracking-widest">{p.code}</span>
                </div>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => handleEdit(p)} className="text-sm px-3 py-1 rounded-lg border border-white/20 hover:border-white/40 transition">Edit</button>
              <button onClick={() => handleDelete(p.id)} className="text-sm px-3 py-1 rounded-lg border border-red-800 text-red-400 hover:bg-red-950/40 transition">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
