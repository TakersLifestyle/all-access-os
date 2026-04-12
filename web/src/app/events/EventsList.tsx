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
  price: number;
  image?: string;
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
  if (events.length === 0) return <p className="text-white/40">No events yet. Check back soon.</p>;

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {events.map((ev) => (
        <div key={ev.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          {ev.image && (
            <img src={ev.image} alt={ev.title} className="w-full h-48 object-cover" />
          )}
          <div className="p-6 space-y-2">
            <h2 className="text-xl font-semibold">{ev.title}</h2>
            <p className="text-white/50 text-sm">{ev.description}</p>
            <div className="flex items-center justify-between pt-2">
              <div className="text-sm text-white/40">
                <span>{new Date(ev.date).toLocaleDateString()}</span>
                {ev.location && <span> · {ev.location}</span>}
              </div>
              {ev.price > 0 && (
                <span className="text-pink-400 font-semibold">${ev.price}</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
