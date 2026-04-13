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
  partner: string;
  discount: string;
  code: string;
  redemptionMethod: string;
  description: string;
  status: "active" | "inactive";
  createdAt?: Timestamp;
}

const empty = {
  title: "",
  partner: "",
  discount: "",
  code: "",
  redemptionMethod: "",
  description: "",
  status: "active" as "active" | "inactive",
};

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
      partner: form.partner,
      discount: form.discount,
      code: form.code.toUpperCase(),
      redemptionMethod: form.redemptionMethod,
      description: form.description,
      status: form.status,
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

  const toggleStatus = async (perk: Perk) => {
    const newStatus = perk.status === "active" ? "inactive" : "active";
    await updateDoc(doc(db, "perks", perk.id), { status: newStatus });
    setPerks((prev) => prev.map((p) => p.id === perk.id ? { ...p, status: newStatus } : p));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this perk?")) return;
    await deleteDoc(doc(db, "perks", id));
    await fetchPerks();
  };

  const handleEdit = (p: Perk) => {
    setEditId(p.id);
    setForm({
      title: p.title || "",
      partner: p.partner || "",
      discount: p.discount || "",
      code: p.code || "",
      redemptionMethod: p.redemptionMethod || "",
      description: p.description || "",
      status: p.status || "active",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (loading || !isAdmin) return null;

  const activeCount = perks.filter((p) => p.status === "active").length;

  return (
    <main className="max-w-4xl mx-auto px-6 py-12 space-y-10">
      <div className="flex items-center gap-4">
        <button onClick={() => router.push("/admin")} className="text-white/40 hover:text-white text-sm transition">← Back</button>
        <div>
          <h1 className="text-3xl font-bold">Manage Perks</h1>
          <p className="text-white/40 text-sm mt-0.5">{activeCount} active · {perks.length} total</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSave} className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-lg">{editId ? "Edit Perk" : "Add New Perk"}</h2>

        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Perk title * (e.g. VIP Lounge Entry Access)"
          required
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-pink-500 transition"
        />

        <div className="grid md:grid-cols-2 gap-4">
          <input
            value={form.partner}
            onChange={(e) => setForm({ ...form, partner: e.target.value })}
            placeholder="Partner / Brand (can be updated later)"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-pink-500 transition"
          />
          <input
            value={form.discount}
            onChange={(e) => setForm({ ...form, discount: e.target.value })}
            placeholder="Discount label (e.g. Free entry, 15% off, $25 off)"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-pink-500 transition"
          />
        </div>

        <input
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
          placeholder='Promo Code — type "none" or "automatic" if no code'
          className="w-full bg-pink-950/20 border border-pink-500/30 rounded-xl px-4 py-3 outline-none focus:border-pink-500 transition font-mono tracking-widest text-pink-300 uppercase"
        />

        <textarea
          value={form.redemptionMethod}
          onChange={(e) => setForm({ ...form, redemptionMethod: e.target.value })}
          placeholder="How to redeem — what the member needs to do to claim this perk"
          rows={2}
          className="w-full bg-white/5 border border-amber-500/20 rounded-xl px-4 py-3 outline-none focus:border-amber-500 transition resize-none"
        />

        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Description — sell the value, any restrictions, partner details"
          rows={3}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-pink-500 transition resize-none"
        />

        <div className="flex items-center gap-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setForm({ ...form, status: form.status === "active" ? "inactive" : "active" })}
              className={`w-10 h-6 rounded-full transition-colors ${form.status === "active" ? "bg-green-600" : "bg-white/20"} relative cursor-pointer`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${form.status === "active" ? "translate-x-5" : "translate-x-1"}`} />
            </div>
            <span className="text-sm text-white/70">Active</span>
          </label>
        </div>

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
      <div className="space-y-3">
        {perks.length === 0 ? (
          <p className="text-white/40">No perks yet. Add one above.</p>
        ) : perks.map((p) => (
          <div
            key={p.id}
            className={`border rounded-2xl p-5 flex items-start justify-between gap-4 transition ${
              p.status === "active"
                ? "bg-white/5 border-white/10"
                : "bg-white/[0.02] border-white/5 opacity-60"
            }`}
          >
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="font-semibold">{p.title}</h3>
                {p.discount && (
                  <span className="bg-pink-600/20 border border-pink-500/30 text-pink-300 text-xs px-2 py-0.5 rounded-full font-medium">
                    {p.discount}
                  </span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                  p.status === "active"
                    ? "border-green-700/50 text-green-400"
                    : "border-white/10 text-white/30"
                }`}>
                  {p.status === "active" ? "Active" : "Inactive"}
                </span>
              </div>
              {p.partner && <p className="text-pink-400 text-sm font-medium">{p.partner}</p>}
              {p.redemptionMethod && (
                <p className="text-amber-300/70 text-sm">
                  <span className="text-white/30 mr-1">How to redeem:</span>{p.redemptionMethod}
                </p>
              )}
              {p.description && <p className="text-white/40 text-sm">{p.description}</p>}
              {p.code && !["NONE", "AUTOMATIC"].includes(p.code) && (
                <div className="inline-flex items-center gap-2 bg-black/40 border border-white/10 rounded-lg px-3 py-1.5">
                  <span className="font-mono text-sm text-pink-300 tracking-widest">{p.code}</span>
                </div>
              )}
              {p.code === "AUTOMATIC" && (
                <span className="text-white/30 text-xs">✦ Automatic — no code needed</span>
              )}
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <button
                onClick={() => toggleStatus(p)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                  p.status === "active"
                    ? "border-yellow-700/50 text-yellow-400 hover:bg-yellow-950/30"
                    : "border-green-700/50 text-green-400 hover:bg-green-950/30"
                }`}
              >
                {p.status === "active" ? "Deactivate" : "Activate"}
              </button>
              <button onClick={() => handleEdit(p)} className="text-xs px-3 py-1.5 rounded-lg border border-white/20 hover:border-white/40 transition">Edit</button>
              <button onClick={() => handleDelete(p.id)} className="text-xs px-3 py-1.5 rounded-lg border border-red-800 text-red-400 hover:bg-red-950/40 transition">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
