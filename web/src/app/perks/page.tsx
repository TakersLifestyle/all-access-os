"use client";

import MemberGate from "@/components/MemberGate";
import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Perk {
  id: string;
  title: string;
  description: string;
  partner: string;
  discount: string;
  code: string;
}

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-2 bg-pink-600/20 hover:bg-pink-600/30 border border-pink-500/40 rounded-xl px-4 py-2.5 transition w-full group"
    >
      <span className="font-mono font-bold text-pink-300 tracking-widest flex-1 text-left">{code}</span>
      <span className="text-xs text-pink-400 group-hover:text-pink-200 transition shrink-0">
        {copied ? "✓ Copied!" : "Tap to copy"}
      </span>
    </button>
  );
}

function PerksList() {
  const [perks, setPerks] = useState<Perk[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDocs(query(collection(db, "perks"), orderBy("createdAt", "desc")))
      .then((snap) => setPerks(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Perk))))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-white/40">Loading perks...</p>;
  if (perks.length === 0) return (
    <div className="text-center py-20 space-y-2">
      <p className="text-4xl">🎁</p>
      <p className="text-white/60 font-medium">Exclusive perks coming soon.</p>
      <p className="text-white/30 text-sm">Check back — new partner deals drop regularly.</p>
    </div>
  );

  return (
    <div className="grid md:grid-cols-2 gap-5">
      {perks.map((perk) => (
        <div key={perk.id} className="bg-white/5 border border-white/10 hover:border-white/20 rounded-2xl p-6 space-y-4 transition">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold leading-tight">{perk.title}</h2>
              {perk.partner && <p className="text-pink-400 text-sm font-medium mt-0.5">{perk.partner}</p>}
            </div>
            {perk.discount && (
              <span className="bg-pink-600 text-white text-xs font-bold px-3 py-1 rounded-full shrink-0 whitespace-nowrap">
                {perk.discount}
              </span>
            )}
          </div>

          {/* Description */}
          {perk.description && (
            <p className="text-white/50 text-sm leading-relaxed">{perk.description}</p>
          )}

          {/* Code */}
          {perk.code && <CopyButton code={perk.code} />}

          {!perk.code && (
            <div className="bg-white/5 rounded-xl px-4 py-2.5 text-white/40 text-sm">
              Show your membership at checkout
            </div>
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
        <div>
          <h1 className="text-3xl font-bold">Member Perks</h1>
          <p className="text-white/40 mt-1">Exclusive deals and discounts — just for ALL ACCESS members.</p>
        </div>
        <PerksList />
      </main>
    </MemberGate>
  );
}
