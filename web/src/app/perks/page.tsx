"use client";

import MemberGate from "@/components/MemberGate";
import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Perk {
  id: string;
  title: string;
  description: string;
  offerDetails: string;
  expiration?: string;
}

function PerksList() {
  const [perks, setPerks] = useState<Perk[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDocs(query(collection(db, "perks"), orderBy("title")))
      .then((snap) => setPerks(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Perk))))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-white/40">Loading perks...</p>;
  if (perks.length === 0) return <p className="text-white/40">No perks yet. Check back soon.</p>;

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {perks.map((perk) => (
        <div key={perk.id} className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-3">
          <h2 className="text-xl font-semibold">{perk.title}</h2>
          <p className="text-white/50 text-sm">{perk.description}</p>
          <div className="bg-pink-950/40 border border-pink-800/30 rounded-lg p-3 text-pink-300 text-sm font-medium">
            {perk.offerDetails}
          </div>
          {perk.expiration && (
            <p className="text-white/30 text-xs">Expires: {perk.expiration}</p>
          )}
        </div>
      ))}
    </div>
  );
}

export default function PerksPage() {
  return (
    <MemberGate>
      <main className="max-w-5xl mx-auto px-6 py-12 space-y-8">
        <h1 className="text-3xl font-bold">Member Perks</h1>
        <PerksList />
      </main>
    </MemberGate>
  );
}
