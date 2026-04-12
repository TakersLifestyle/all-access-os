"use client";

import MemberGate from "@/components/MemberGate";
import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Perk {
  id: string;
  title: string;
  partner: string;
  discount: string;
  code: string;
  redemptionMethod: string;
  description: string;
  status: string;
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
      className="flex items-center gap-3 bg-pink-600/15 hover:bg-pink-600/25 border border-pink-500/30 rounded-xl px-4 py-3 transition w-full group"
    >
      <div className="flex-1 text-left">
        <p className="text-xs text-pink-400/70 uppercase tracking-widest mb-0.5">Promo Code</p>
        <p className="font-mono font-bold text-pink-300 tracking-widest text-sm">{code}</p>
      </div>
      <span className={`text-xs font-medium shrink-0 transition ${copied ? "text-green-400" : "text-pink-400/70 group-hover:text-pink-300"}`}>
        {copied ? "✓ Copied!" : "Tap to copy"}
      </span>
    </button>
  );
}

function AutomaticBadge() {
  return (
    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
      <span className="text-white/30 text-sm">✦</span>
      <div>
        <p className="text-xs text-white/30 uppercase tracking-widest mb-0.5">How it works</p>
        <p className="text-sm text-white/60">Automatically applied for all active members</p>
      </div>
    </div>
  );
}

function PerkCard({ perk }: { perk: Perk }) {
  const hasCode = perk.code && perk.code !== "NONE" && perk.code !== "AUTOMATIC";
  const isAutomatic = perk.code === "AUTOMATIC";

  return (
    <div className="bg-white/5 border border-white/10 hover:border-white/20 rounded-2xl p-6 space-y-4 transition flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h2 className="text-lg font-bold leading-tight">{perk.title}</h2>
          {perk.partner && <p className="text-pink-400 text-sm font-medium mt-0.5">{perk.partner}</p>}
        </div>
        {perk.discount && (
          <span className="bg-pink-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shrink-0 whitespace-nowrap">
            {perk.discount}
          </span>
        )}
      </div>

      {/* Description */}
      {perk.description && (
        <p className="text-white/50 text-sm leading-relaxed">{perk.description}</p>
      )}

      {/* Redemption Method */}
      {perk.redemptionMethod && (
        <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl px-4 py-3 space-y-1">
          <p className="text-xs text-amber-400/70 uppercase tracking-widest font-semibold">How to Redeem</p>
          <p className="text-sm text-white/60 leading-relaxed">{perk.redemptionMethod}</p>
        </div>
      )}

      {/* Code / Automatic */}
      <div className="mt-auto pt-1">
        {hasCode && <CopyButton code={perk.code} />}
        {isAutomatic && <AutomaticBadge />}
        {!hasCode && !isAutomatic && (
          <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/40">
            Show your ALL ACCESS membership to redeem
          </div>
        )}
      </div>
    </div>
  );
}

function PerksList() {
  const [perks, setPerks] = useState<Perk[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDocs(
      query(
        collection(db, "perks"),
        where("status", "==", "active"),
        orderBy("createdAt", "asc")
      )
    )
      .then((snap) => setPerks(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Perk))))
      .catch(() => {
        // Fallback if index not ready — fetch all and filter client-side
        getDocs(query(collection(db, "perks"), orderBy("createdAt", "asc")))
          .then((snap) =>
            setPerks(
              snap.docs
                .map((d) => ({ id: d.id, ...d.data() } as Perk))
                .filter((p) => p.status === "active")
            )
          );
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="grid md:grid-cols-2 gap-5">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white/5 border border-white/10 rounded-2xl h-48 animate-pulse" />
      ))}
    </div>
  );

  if (perks.length === 0) return (
    <div className="text-center py-24 space-y-3">
      <p className="text-5xl">🎁</p>
      <p className="text-white font-semibold text-lg">Exclusive perks coming soon.</p>
      <p className="text-white/30 text-sm">New partner deals drop regularly — check back.</p>
    </div>
  );

  return (
    <div className="grid md:grid-cols-2 gap-5">
      {perks.map((perk) => (
        <PerkCard key={perk.id} perk={perk} />
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
          <p className="text-white/40 mt-1 text-sm">
            Exclusive deals and discounts — available to ALL ACCESS members only.
          </p>
        </div>
        <PerksList />
      </main>
    </MemberGate>
  );
}
