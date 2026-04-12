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
  price: string;
  memberPrice: string;
  image: string;
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

export default function EventsList() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDocs(query(collection(db, "events"), orderBy("date", "asc")))
      .then((snap) => {
        setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Event)));
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-white/40">Loading events...</p>;
  if (events.length === 0) return (
    <div className="text-center py-20 space-y-2">
      <p className="text-4xl">🎉</p>
      <p className="text-white/60 font-medium">Events dropping soon.</p>
      <p className="text-white/30 text-sm">Stay tuned — something big is coming.</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {events.map((ev) => (
        <div key={ev.id} className="bg-white/5 border border-white/10 hover:border-white/20 rounded-2xl overflow-hidden transition group">
          {/* Banner image */}
          {ev.image && (
            <div className="w-full h-56 overflow-hidden">
              <img
                src={ev.image}
                alt={ev.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </div>
          )}

          <div className="p-6 space-y-4">
            {/* Title + Pricing */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <h2 className="text-2xl font-bold">{ev.title}</h2>
              <div className="flex flex-col items-end gap-1 shrink-0">
                {ev.memberPrice ? (
                  <>
                    <span className="bg-pink-600 text-white text-sm font-bold px-3 py-1 rounded-full">
                      Members: ${ev.memberPrice}
                    </span>
                    {ev.price && (
                      <span className="text-white/40 text-xs line-through">${ev.price} general</span>
                    )}
                  </>
                ) : ev.price ? (
                  <>
                    <span className="bg-pink-600 text-white text-sm font-bold px-3 py-1 rounded-full">
                      Members: FREE
                    </span>
                    <span className="text-white/40 text-xs line-through">${ev.price} general</span>
                  </>
                ) : null}
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
