"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";

interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  location: string;
  generalPrice: number;
  memberPrice: number;
  capacity: number;
  ticketsRemaining: number;
  isMembersOnly: boolean;
  status: string;
  imageUrl: string;
}

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  try {
    return new Date(dateStr + "T12:00:00").toLocaleDateString("en-CA", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch { return dateStr; }
}

function UrgencyBar({ capacity, remaining }: { capacity: number; remaining: number }) {
  if (!capacity) return null;
  const filled = capacity - remaining;
  const pct = Math.min(Math.round((filled / capacity) * 100), 100);
  const isLow = remaining <= Math.ceil(capacity * 0.25);
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className={isLow ? "text-red-400 font-semibold animate-pulse" : "text-white/40"}>
          {isLow ? `⚡ Only ${remaining} spots left!` : `${remaining} of ${capacity} spots remaining`}
        </span>
        <span className="text-white/30">{pct}% filled</span>
      </div>
      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pct > 80 ? "bg-red-500" : pct > 50 ? "bg-amber-500" : "bg-green-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function EventCard({ ev, isActive }: { ev: Event; isActive: boolean }) {
  const isSoldOut = ev.status === "sold_out" || ev.ticketsRemaining === 0;
  const isLow = ev.capacity > 0 && ev.ticketsRemaining <= Math.ceil(ev.capacity * 0.25) && !isSoldOut;

  return (
    <div className={`border rounded-2xl overflow-hidden transition group ${
      isSoldOut ? "border-white/5 bg-white/[0.02] opacity-60" : "border-white/10 bg-white/5 hover:border-white/20"
    }`}>
      {/* Banner image */}
      {ev.imageUrl && (
        <div className="relative w-full h-56 overflow-hidden">
          <img
            src={ev.imageUrl}
            alt={ev.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          {/* Overlay badges */}
          <div className="absolute top-4 left-4 flex gap-2 flex-wrap">
            {ev.isMembersOnly && (
              <span className="bg-black/70 backdrop-blur border border-pink-500/40 text-pink-300 text-xs font-semibold px-3 py-1 rounded-full">
                Members Only
              </span>
            )}
            {isSoldOut && (
              <span className="bg-red-900/80 backdrop-blur border border-red-500/40 text-red-300 text-xs font-semibold px-3 py-1 rounded-full">
                SOLD OUT
              </span>
            )}
            {isLow && (
              <span className="bg-amber-900/80 backdrop-blur border border-amber-500/40 text-amber-300 text-xs font-semibold px-3 py-1 rounded-full animate-pulse">
                ⚡ Limited Spots
              </span>
            )}
          </div>
        </div>
      )}

      <div className="p-6 space-y-4">
        {/* No image — show badges inline */}
        {!ev.imageUrl && (
          <div className="flex gap-2 flex-wrap">
            {ev.isMembersOnly && (
              <span className="bg-pink-600/20 border border-pink-500/30 text-pink-300 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                Members Only
              </span>
            )}
            {isLow && (
              <span className="bg-amber-600/20 border border-amber-500/30 text-amber-300 text-xs font-semibold px-2.5 py-0.5 rounded-full animate-pulse">
                ⚡ Limited Spots
              </span>
            )}
          </div>
        )}

        {/* Title + Pricing */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <h2 className="text-2xl font-bold leading-tight flex-1">{ev.title}</h2>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {ev.memberPrice > 0 ? (
              <>
                <span className="bg-pink-600 text-white text-sm font-bold px-3 py-1.5 rounded-full whitespace-nowrap">
                  Members: ${ev.memberPrice}
                </span>
                {ev.generalPrice > 0 ? (
                  <span className="text-white/30 text-xs line-through">${ev.generalPrice} general</span>
                ) : (
                  <span className="text-white/30 text-xs">Members only — not public</span>
                )}
              </>
            ) : (
              <>
                <span className="bg-pink-600 text-white text-sm font-bold px-3 py-1.5 rounded-full">
                  Members: FREE
                </span>
                {ev.generalPrice > 0 && (
                  <span className="text-white/30 text-xs line-through">${ev.generalPrice} general</span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Date + Location */}
        <div className="flex flex-wrap gap-4 text-sm text-white/50">
          {ev.date && (
            <span className="flex items-center gap-1.5">
              <span>📅</span> {formatDate(ev.date)}
            </span>
          )}
          {ev.location && (
            <span className="flex items-center gap-1.5">
              <span>📍</span> {ev.location}
            </span>
          )}
        </div>

        {/* Capacity bar */}
        {ev.capacity > 0 && !isSoldOut && (
          <UrgencyBar capacity={ev.capacity} remaining={ev.ticketsRemaining ?? ev.capacity} />
        )}

        {/* Description */}
        {ev.description && (
          <p className="text-white/50 text-sm leading-relaxed border-t border-white/5 pt-4">
            {ev.description}
          </p>
        )}

        {/* Action button */}
        <div className="pt-2">
          {isSoldOut ? (
            <div className="w-full text-center py-3 rounded-xl border border-white/10 text-white/30 text-sm font-medium">
              Sold Out
            </div>
          ) : isActive ? (
            <button className="w-full bg-pink-600 hover:bg-pink-500 py-3 rounded-xl font-bold text-sm transition">
              {ev.isMembersOnly ? "Access Event →" : "Get Tickets →"}
            </button>
          ) : (
            <a
              href="/"
              className="block w-full text-center bg-white/10 hover:bg-white/15 border border-white/20 py-3 rounded-xl font-semibold text-sm transition text-white/70 hover:text-white"
            >
              {ev.isMembersOnly ? "Subscribe to Access →" : "Get Tickets →"}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function EventsList() {
  const { isActive, isAdmin, loading: authLoading } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (authLoading) return; // Wait for auth before querying

    getDocs(query(collection(db, "events"), orderBy("date", "asc")))
      .then((snap) => {
        const all = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Event))
          .filter((ev) => ev.status !== "draft");
        setEvents(all);
      })
      .catch((err) => {
        console.error("Events fetch failed:", err.code, err.message);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [authLoading]);

  if (loading || authLoading) return (
    <div className="space-y-6">
      {[1, 2].map((i) => (
        <div key={i} className="bg-white/5 border border-white/10 rounded-2xl h-72 animate-pulse" />
      ))}
    </div>
  );

  if (error) return (
    <div className="text-center py-16 space-y-2">
      <p className="text-white/40">Couldn&apos;t load events. Please refresh.</p>
    </div>
  );

  if (events.length === 0) return (
    <div className="text-center py-24 space-y-3">
      <p className="text-5xl">🎉</p>
      <p className="text-white font-semibold text-lg">Events dropping soon.</p>
      <p className="text-white/30 text-sm">Stay tuned — something big is coming.</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {events.map((ev) => (
        <EventCard key={ev.id} ev={ev} isActive={isActive || isAdmin} />
      ))}
    </div>
  );
}
