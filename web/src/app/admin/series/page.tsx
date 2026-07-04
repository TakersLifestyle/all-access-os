"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import type { SeriesEvent } from "@/types/series";

const SERIES_ID = "sunset-sessions";

const DEFAULT_SCHEDULE = [
  { time: "5:30 PM", title: "Doors Open", desc: "Arrive, settle in, and enjoy your welcome drink." },
  { time: "6:00 PM", title: "Experience Begins", desc: "The main experience kicks off with professional guidance." },
  { time: "7:15 PM", title: "Networking Break", desc: "Mingle with Winnipeg's creative community." },
  { time: "7:45 PM", title: "Golden Hour", desc: "Watch the Winnipeg skyline turn gold. Photography encouraged." },
  { time: "8:15 PM", title: "Games & Music", desc: "Curated playlist, games, and candid moments." },
  { time: "9:00 PM", title: "Closing", desc: "Wrap up the evening and take your memories home." },
];

const DEFAULT_INCLUDED = [
  { icon: "🍷", label: "Welcome Drink" },
  { icon: "🏙️", label: "Premium Rooftop Venue" },
  { icon: "🎵", label: "Curated Playlist" },
  { icon: "📸", label: "Golden Hour Photography" },
  { icon: "🤝", label: "Networking" },
  { icon: "📱", label: "ALL ACCESS Memories Album" },
];

const DEFAULT_FAQS = [
  { q: "Is this an 18+ event?", a: "Yes — 18+ only. Valid ID required at the door." },
  { q: "What does Community Access unlock?", a: "Purchasing any ticket grants you access to the ALL ACCESS Memories Album, Community Feed, Chat, and priority access to future events." },
  { q: "Is there a refund policy?", a: "Tickets are non-refundable but fully transferable. Reach out to us if something comes up." },
  { q: "What is the venue address?", a: "The exact venue address will be confirmed and sent to all ticket holders approximately 1 week before the event." },
];

const DEFAULT_DRESS_CODE = {
  name: "Smart Casual",
  desc: "Elevated but comfortable. Think rooftop dinner meets creative studio.",
  details: [
    { label: "Palette", value: "Neutral · White · Cream · Beige · Earth tones" },
    { label: "Footwear", value: "Clean sneakers or stylish footwear" },
    { label: "Vibe", value: "Dressed to be seen. Comfortable enough to create." },
  ],
};

type FormState = {
  seriesVolume: string;
  seriesVolumeLabel: string;
  subtitle: string;
  tagline: string;
  description: string;
  date: string;
  time: string;
  location: string;
  locationTBA: boolean;
  capacity: string;
  ageRestriction: string;
  slug: string;
  pricePublic: string;
  priceCommunity: string;
  priceSupporter: string;
  scheduleJson: string;
  includedJson: string;
  addOnsJson: string;
  faqsJson: string;
  dressCodeJson: string;
};

const EMPTY_FORM: FormState = {
  seriesVolume: "",
  seriesVolumeLabel: "",
  subtitle: "",
  tagline: "",
  description: "",
  date: "",
  time: "5:30 PM – 9:00 PM",
  location: "Premium Rooftop Venue, Winnipeg, MB (TBA)",
  locationTBA: true,
  capacity: "25",
  ageRestriction: "18+",
  slug: "",
  pricePublic: "85",
  priceCommunity: "70",
  priceSupporter: "60",
  scheduleJson: JSON.stringify(DEFAULT_SCHEDULE, null, 2),
  includedJson: JSON.stringify(DEFAULT_INCLUDED, null, 2),
  addOnsJson: JSON.stringify(["Charcuterie board", "Mocktails", "Cocktails (venue permitting)", "Professional portrait station"], null, 2),
  faqsJson: JSON.stringify(DEFAULT_FAQS, null, 2),
  dressCodeJson: JSON.stringify(DEFAULT_DRESS_CODE, null, 2),
};

function fmt(n: number) {
  return `$${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}`;
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr + "T12:00:00").toLocaleDateString("en-CA", {
      month: "short", day: "numeric", year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-emerald-900/50 text-emerald-300 border-emerald-700/40",
    coming_soon: "bg-amber-900/40 text-amber-300 border-amber-700/30",
    sold_out: "bg-red-900/40 text-red-300 border-red-700/30",
    past: "bg-white/5 text-white/30 border-white/10",
  };
  return (
    <span className={`text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full border ${map[status] ?? "bg-white/5 text-white/30 border-white/10"}`}>
      {status.replace("_", " ")}
    </span>
  );
}

export default function AdminSeriesPage() {
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [events, setEvents] = useState<SeriesEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [jsonErrors, setJsonErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!authLoading && !isAdmin) router.replace("/");
  }, [authLoading, isAdmin, router]);

  const fetchEvents = useCallback(() => {
    setLoadingEvents(true);
    fetch(`/api/series/events?seriesId=${SERIES_ID}`)
      .then((r) => r.json())
      .then((data) => setEvents(data.events ?? []))
      .catch(() => setEvents([]))
      .finally(() => setLoadingEvents(false));
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // Auto-generate slug and volume label from volume number
  useEffect(() => {
    const vol = parseInt(form.seriesVolume);
    if (!isNaN(vol) && vol > 0) {
      const padded = String(vol).padStart(2, "0");
      setForm((f) => ({
        ...f,
        seriesVolumeLabel: f.seriesVolumeLabel || `Vol. ${padded}`,
        slug: f.slug || `vol-${padded}`,
      }));
    }
  }, [form.seriesVolume]);

  function setField(key: keyof FormState, value: string | boolean) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validateJson(key: string, val: string): boolean {
    try {
      JSON.parse(val);
      setJsonErrors((e) => { const n = { ...e }; delete n[key]; return n; });
      return true;
    } catch {
      setJsonErrors((e) => ({ ...e, [key]: "Invalid JSON" }));
      return false;
    }
  }

  async function handleSave() {
    setSaveError(null);
    setSaveSuccess(false);

    // Validate required fields
    if (!form.seriesVolume || !form.slug || !form.date || !form.subtitle) {
      setSaveError("Volume, subtitle, date, and slug are required.");
      return;
    }

    // Validate JSON fields
    const jsonFields: Array<[keyof FormState, string]> = [
      ["scheduleJson", "schedule"],
      ["includedJson", "whatsIncluded"],
      ["addOnsJson", "addOns"],
      ["faqsJson", "faqs"],
      ["dressCodeJson", "dressCode"],
    ];
    for (const [key, name] of jsonFields) {
      if (!validateJson(name, form[key] as string)) {
        setSaveError(`Fix the JSON error in "${name}" before saving.`);
        return;
      }
    }

    setSaving(true);
    try {
      const token = user ? await user.getIdToken() : null;
      const res = await fetch("/api/admin/series/create-event", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          seriesId: SERIES_ID,
          seriesVolume: parseInt(form.seriesVolume),
          seriesVolumeLabel: form.seriesVolumeLabel,
          subtitle: form.subtitle,
          tagline: form.tagline,
          description: form.description,
          date: form.date,
          time: form.time,
          location: form.location,
          locationTBA: form.locationTBA,
          capacity: parseInt(form.capacity),
          ageRestriction: form.ageRestriction,
          slug: form.slug,
          ticketTiers: {
            public: { name: "General Admission", price: parseFloat(form.pricePublic) },
            community: { name: "Community Access", price: parseFloat(form.priceCommunity) },
            supporter: { name: "Supporting Members", price: parseFloat(form.priceSupporter) },
          },
          schedule: JSON.parse(form.scheduleJson),
          whatsIncluded: JSON.parse(form.includedJson),
          addOns: JSON.parse(form.addOnsJson),
          faqs: JSON.parse(form.faqsJson),
          dressCode: JSON.parse(form.dressCodeJson),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setSaveError(data.error ?? "Failed to create event."); return; }
      setSaveSuccess(true);
      setForm(EMPTY_FORM);
      setShowForm(false);
      fetchEvents();
    } catch {
      setSaveError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) return <div className="min-h-screen bg-black" />;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <Link href="/admin" className="text-white/30 hover:text-white/60 text-sm transition mb-2 inline-block">
              ← Admin
            </Link>
            <h1 className="text-2xl font-black">Sunset Sessions</h1>
            <p className="text-white/35 text-sm mt-1">Manage the event series · {SERIES_ID}</p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/series/sunset-sessions"
              target="_blank"
              className="text-xs text-white/40 hover:text-white border border-white/10 hover:border-white/25 px-4 py-2 rounded-xl transition"
            >
              View Series Page ↗
            </Link>
            <button
              onClick={() => { setShowForm(true); setSaveError(null); setSaveSuccess(false); }}
              className="text-xs font-bold bg-[#D4AF37] text-black px-5 py-2 rounded-xl hover:bg-[#c9a430] transition"
            >
              + New Session
            </button>
          </div>
        </div>

        {saveSuccess && (
          <div className="mb-6 px-5 py-3 rounded-xl bg-emerald-950/50 border border-emerald-700/40 text-emerald-300 text-sm">
            ✅ Session created successfully. It starts in "coming_soon" status — activate it from Firestore when ready.
          </div>
        )}

        {/* Events list */}
        <div className="mb-12">
          <h2 className="text-sm font-bold text-white/50 tracking-widest uppercase mb-4">All Sessions</h2>
          {loadingEvents ? (
            <div className="space-y-3">
              {[1, 2].map((i) => <div key={i} className="h-16 bg-white/3 rounded-xl animate-pulse" />)}
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl">
              <p className="text-white/30 text-sm">No sessions yet. Create the first one.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((event) => {
                const tiers = event.ticketTiers ?? {};
                const tierPrices = Object.values(tiers).map((t) => t.price);
                const minPrice = tierPrices.length ? Math.min(...tierPrices) : 0;
                return (
                  <div
                    key={event.id}
                    className="flex items-center gap-4 p-4 bg-white/3 border border-white/8 rounded-xl hover:border-white/15 transition"
                  >
                    <div className="w-12 h-12 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/15 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-black text-[#D4AF37]">{String(event.seriesVolume).padStart(2, "0")}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="text-sm font-semibold text-white/85 truncate">{event.subtitle}</h3>
                        <StatusBadge status={event.status} />
                      </div>
                      <p className="text-xs text-white/30">{formatDate(event.date)} · {event.ticketsRemaining}/{event.capacity} spots · From {fmt(minPrice)}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Link
                        href={`/series/sunset-sessions/${event.slug}`}
                        target="_blank"
                        className="text-xs text-white/35 hover:text-white border border-white/10 hover:border-white/25 px-3 py-1.5 rounded-lg transition"
                      >
                        View ↗
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Create form */}
        {showForm && (
          <div className="border border-white/10 rounded-2xl p-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-lg font-bold">Create New Session</h2>
              <button onClick={() => setShowForm(false)} className="text-white/30 hover:text-white transition text-2xl leading-none">×</button>
            </div>

            <div className="space-y-8">
              {/* Basic info */}
              <div>
                <h3 className="text-xs font-bold tracking-widest uppercase text-white/30 mb-4">Basic Info</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Volume Number *" type="number" value={form.seriesVolume} onChange={(v) => setField("seriesVolume", v)} placeholder="2" />
                  <Field label="Volume Label" value={form.seriesVolumeLabel} onChange={(v) => setField("seriesVolumeLabel", v)} placeholder="Vol. 02" />
                  <Field label="Subtitle *" value={form.subtitle} onChange={(v) => setField("subtitle", v)} placeholder="Wine & Jazz" className="sm:col-span-2" />
                  <Field label="Tagline" value={form.tagline} onChange={(v) => setField("tagline", v)} placeholder="Sip. Groove. Connect." className="sm:col-span-2" />
                  <Field label="Description" value={form.description} onChange={(v) => setField("description", v)} placeholder="A premium evening of..." className="sm:col-span-2" textarea />
                  <Field label="URL Slug *" value={form.slug} onChange={(v) => setField("slug", v)} placeholder="vol-02" note="/series/sunset-sessions/vol-02" />
                </div>
              </div>

              {/* Date & Location */}
              <div>
                <h3 className="text-xs font-bold tracking-widest uppercase text-white/30 mb-4">Date & Location</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Date *" type="date" value={form.date} onChange={(v) => setField("date", v)} />
                  <Field label="Time" value={form.time} onChange={(v) => setField("time", v)} placeholder="5:30 PM – 9:00 PM" />
                  <Field label="Location" value={form.location} onChange={(v) => setField("location", v)} placeholder="Premium Rooftop, Winnipeg MB" className="sm:col-span-2" />
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={form.locationTBA} onChange={(e) => setField("locationTBA", e.target.checked)} className="w-4 h-4 rounded" />
                    <span className="text-sm text-white/50">Location TBA (exact address revealed to ticket holders)</span>
                  </label>
                </div>
              </div>

              {/* Capacity & Age */}
              <div>
                <h3 className="text-xs font-bold tracking-widest uppercase text-white/30 mb-4">Capacity</h3>
                <div className="grid sm:grid-cols-3 gap-4">
                  <Field label="Capacity" type="number" value={form.capacity} onChange={(v) => setField("capacity", v)} placeholder="25" />
                  <Field label="Age Restriction" value={form.ageRestriction} onChange={(v) => setField("ageRestriction", v)} placeholder="18+" />
                </div>
              </div>

              {/* Ticket Pricing */}
              <div>
                <h3 className="text-xs font-bold tracking-widest uppercase text-white/30 mb-4">Ticket Pricing (CAD)</h3>
                <div className="grid sm:grid-cols-3 gap-4">
                  <Field label="Public (General Admission)" type="number" value={form.pricePublic} onChange={(v) => setField("pricePublic", v)} placeholder="85" />
                  <Field label="Community Access" type="number" value={form.priceCommunity} onChange={(v) => setField("priceCommunity", v)} placeholder="70" />
                  <Field label="Supporting Members" type="number" value={form.priceSupporter} onChange={(v) => setField("priceSupporter", v)} placeholder="60" />
                </div>
              </div>

              {/* JSON Content */}
              <div>
                <h3 className="text-xs font-bold tracking-widest uppercase text-white/30 mb-4">Event Content (JSON)</h3>
                <div className="space-y-4">
                  <JsonField
                    label="Schedule"
                    value={form.scheduleJson}
                    onChange={(v) => { setField("scheduleJson", v); validateJson("schedule", v); }}
                    error={jsonErrors["schedule"]}
                    note='Array of { time, title, desc }'
                  />
                  <JsonField
                    label="What's Included"
                    value={form.includedJson}
                    onChange={(v) => { setField("includedJson", v); validateJson("whatsIncluded", v); }}
                    error={jsonErrors["whatsIncluded"]}
                    note='Array of { icon, label }'
                  />
                  <JsonField
                    label="Add-Ons"
                    value={form.addOnsJson}
                    onChange={(v) => { setField("addOnsJson", v); validateJson("addOns", v); }}
                    error={jsonErrors["addOns"]}
                    note='Array of strings'
                  />
                  <JsonField
                    label="FAQs"
                    value={form.faqsJson}
                    onChange={(v) => { setField("faqsJson", v); validateJson("faqs", v); }}
                    error={jsonErrors["faqs"]}
                    note='Array of { q, a }'
                  />
                  <JsonField
                    label="Dress Code"
                    value={form.dressCodeJson}
                    onChange={(v) => { setField("dressCodeJson", v); validateJson("dressCode", v); }}
                    error={jsonErrors["dressCode"]}
                    note='{ name, desc, details: [{ label, value }] }'
                  />
                </div>
              </div>

              {/* Save */}
              {saveError && (
                <div className="px-4 py-3 rounded-xl bg-red-950/50 border border-red-700/40 text-red-300 text-sm">
                  {saveError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 bg-[#D4AF37] text-black font-bold py-3.5 rounded-xl hover:bg-[#c9a430] transition disabled:opacity-50 text-sm"
                >
                  {saving ? "Creating..." : "Create Session"}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="px-6 border border-white/10 text-white/50 rounded-xl hover:border-white/25 hover:text-white transition text-sm"
                >
                  Cancel
                </button>
              </div>

              <p className="text-white/20 text-xs">
                New sessions are created in "coming_soon" status with checkout disabled. Activate in Firestore console when ready.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ──

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  note,
  className,
  textarea,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  note?: string;
  className?: string;
  textarea?: boolean;
}) {
  const base =
    "w-full bg-white/5 border border-white/12 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#D4AF37]/40 transition";
  return (
    <div className={className}>
      <label className="block text-xs text-white/40 mb-1.5">{label}</label>
      {textarea ? (
        <textarea
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={base + " resize-none"}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={base}
        />
      )}
      {note && <p className="text-[10px] text-white/20 mt-1">{note}</p>}
    </div>
  );
}

function JsonField({
  label,
  value,
  onChange,
  error,
  note,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  note?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs text-white/40">{label}</label>
        {note && <span className="text-[10px] text-white/20">{note}</span>}
      </div>
      <textarea
        rows={6}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full bg-white/4 border rounded-xl px-4 py-3 text-xs text-white/70 font-mono focus:outline-none transition resize-y ${
          error ? "border-red-700/50 focus:border-red-500/50" : "border-white/10 focus:border-[#D4AF37]/30"
        }`}
        spellCheck={false}
      />
      {error && <p className="text-red-400 text-[10px] mt-1">{error}</p>}
    </div>
  );
}
