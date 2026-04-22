"use client";

import { useState } from "react";

const RULES = [
  {
    n: "1",
    title: "Respect Always",
    body: "Treat others how you'd want to be treated. No harassment, disrespect, or hostile behavior.",
  },
  {
    n: "2",
    title: "Keep It Positive",
    body: "This is a space for good energy and real interactions. Negativity, drama, or disruptive behavior isn't part of the culture here.",
  },
  {
    n: "3",
    title: "No Hate or Harm",
    body: "Any form of hate speech, discrimination, or harmful content is not allowed.",
  },
  {
    n: "4",
    title: "Be Genuine",
    body: "No spam, excessive self-promotion, or fake engagement. Bring value to the conversation.",
  },
  {
    n: "5",
    title: "Respect the Community",
    body: "Everyone is here for a reason. Keep interactions thoughtful and intentional.",
  },
  {
    n: "6",
    title: "Standards Are Enforced",
    body: "To protect the experience, content that doesn't align with these guidelines may be removed, and accounts may lose access to community features.",
  },
];

// ── Full guidelines card ───────────────────────────────────
export function CommunityGuidelinesCard() {
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 space-y-5">
      <div className="space-y-2">
        <h2 className="text-base font-bold text-white/90 tracking-tight">Community Guidelines</h2>
        <p className="text-white/45 text-sm leading-relaxed">
          ALL ACCESS is open to everyone—but built for people who value respect, good energy, and real connection.
          To keep the experience strong for everyone, we operate with a few simple standards:
        </p>
      </div>

      <div className="space-y-3">
        {RULES.map((r) => (
          <div key={r.n} className="flex gap-3">
            <span className="text-pink-500/60 text-xs font-bold tabular-nums mt-0.5 shrink-0 w-4">{r.n}.</span>
            <div>
              <p className="text-white/75 text-sm font-semibold leading-snug">{r.title}</p>
              <p className="text-white/40 text-xs leading-relaxed mt-0.5">{r.body}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-white/25 text-xs border-t border-white/8 pt-4 leading-relaxed">
        Open to everyone.<br />
        <span className="text-pink-400/60">Built for those who move right.</span>
      </p>
    </div>
  );
}

// ── Compact collapsible strip for the community page ──────
export function GuidelinesStrip() {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-3">
      {/* Banner line */}
      <div className="flex items-center justify-between">
        <p className="text-white/30 text-xs tracking-wide">Respect the space. Keep it real.</p>
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-white/25 hover:text-white/55 text-xs transition underline underline-offset-2"
        >
          {open ? "Hide guidelines" : "View guidelines"}
        </button>
      </div>
      {open && <CommunityGuidelinesCard />}
    </div>
  );
}

// ── First-time post modal ──────────────────────────────────
export function GuidelinesModal({ onAccept }: { onAccept: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Card */}
      <div className="relative bg-[#16102a] border border-white/15 rounded-2xl p-7 max-w-sm w-full space-y-5 shadow-2xl">
        <div className="space-y-1.5">
          <h3 className="text-lg font-bold">Before you post</h3>
          <p className="text-white/50 text-sm leading-relaxed">
            This is a public space with high standards. Keep it respectful and real.
          </p>
        </div>

        <div className="space-y-2">
          {["Respect everyone", "No harassment or hate", "Be genuine — no spam"].map((item) => (
            <div key={item} className="flex items-center gap-2.5 text-sm text-white/60">
              <span className="text-pink-400 text-xs shrink-0">✓</span>
              {item}
            </div>
          ))}
        </div>

        <button
          onClick={onAccept}
          className="w-full bg-pink-600 hover:bg-pink-500 py-3 rounded-xl font-bold text-sm transition"
        >
          Got it
        </button>

        <p className="text-center text-white/20 text-xs">
          Open to everyone. Built for those who move right.
        </p>
      </div>
    </div>
  );
}
