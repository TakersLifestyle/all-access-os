"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";

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
  } catch {
    return dateStr;
  }
}

function UrgencyBar({ capacity, remaining }: { capacity: number; remaining: number }) {
  if (!capacity) return null;
  const pct = Math.round(((capacity - remaining) / capacity) * 100);
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
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

export default function EventsList() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDocs(query(collection(db, "events"), orderBy("date", "asc")))
      .then((snap) => {
        setEvents(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() } as Event))
            .filter((ev) => ev.status !== "draft")
        );
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="space-y-6">
      {[1, 2].map((i) => (
        <div key={i} className="bg-white/5 border border-white/10 rounded-2xl h-64 animate-pulse" />
      ))}
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
        <div
          key={ev.id}
          className={`border rounded-2xl overflow-hidden transition group ${
            ev.status === "sold_out"
              ? "border-white/5 bg-white/[0.02] opacity-70"
              : "border-white/10 bg-white/5 hover:border-white/20"
          }`}
        >
          {/* Banner */}
          {ev.imageUrl && (
            <div className="relative w-full h-60 overflow-hidden">
              <img
                src={ev.imageUrl}
                alt={ev.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
              {/* Overlay tags */}
              <div className="absolute top-4 left-4 flex gap-2 flex-wrap">
                {ev.isMembersOnly && (
                  <span className="bg-black/70 backdrop-blur border border-pink-500/40 text-pink-300 text-xs font-semibold px-3 py-1 rounded-full">
                    Members Only
                  </span>
                )}
                {ev.status === "sold_out" && (
                  <span className="bg-red-900/80 backdrop-blur border border-red-500/40 text-red-300 text-xs font-semibold px-3 py-1 rounded-full">
                    SOLD OUT
                  </span>
                )}
                {ev.ticketsRemaining > 0 && ev.capacity > 0 && ev.ticketsRemaining <= Math.ceil(ev.capacity * 0.25) && ev.status !== "sold_out" && (
                  <span className="bg-amber-900/80 backdrop-blur border border-amber-500/40 text-amber-300 text-xs font-semibold px-3 py-1 rounded-full animate-pulse">
                    ⚡ Limited Spots
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="p-6 space-y-4">
            {/* Title + Price */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                {!ev.imageUrl && (
                  <div className="flex gap-2 flex-wrap mb-2">
                    {ev.isMembersOnly && (
                      <span className="bg-pink-600/20 border border-pink-500/30 text-pink-300 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                        Members Only
                      </span>
                    )}
                    {ev.ticketsRemaining > 0 && ev.capacity > 0 && ev.ticketsRemaining <= Math.ceil(ev.capacity * 0.25) && (
                      <span className="bg-amber-600/20 border border-amber-500/30 text-amber-300 text-xs font-semibold px-2.5 py-0.5 rounded-full animate-pulse">
                        ⚡ Limited Spots
                      </span>
                    )}
                  </div>
                )}
                <h2 className="text-2xl font-bold leading-tight">{ev.title}</h2>
              </div>

              {/* Pricing block */}
              <div className="flex flex-col items-end gap-1 shrink-0">
                {ev.memberPrice > 0 ? (
                  <>
                    <span className="bg-pink-600 text-white text-sm font-bold px-4 py-1.5 rounded-full">
                      Members: ${ev.memberPrice}
                    </span>
                    {ev.generalPrice > 0 ? (
                      <span className="text-white/30 text-xs line-through">${ev.generalPrice} general</span>
                    ) : (
                      <span className="text-white/30 text-xs">Not available to general public</span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="bg-pink-600 text-white text-sm font-bold px-4 py-1.5 rounded-full">
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

            {/* Urgency bar */}
            {ev.capacity > 0 && ev.status !== "sold_out" && (
              <UrgencyBar capacity={ev.capacity} remaining={ev.ticketsRemaining ?? ev.capacity} />
            )}

            {/* Description */}
            {ev.description && (
              <p className="text-white/50 text-sm leading-relaxed border-t border-white/5 pt-4">
                {ev.description}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
