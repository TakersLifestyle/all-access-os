"use client";

import { useEffect, useState, useCallback } from "react";
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
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
  } catch { return dateStr; }
}

function UrgencyBar({ capacity, remaining }: { capacity: number; remaining: number }) {
  if (!capacity) return null;
  const filled = capacity - remaining;
  const pct = Math.min(Math.round((filled / capacity) * 100), 100);
  const isCritical = remaining <= 5;
  const isLow = remaining <= Math.ceil(capacity * 0.25);

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-xs">
        {isCritical ? (
          <span className="text-red-400 font-bold animate-pulse">🔥 Only {remaining} spot{remaining !== 1 ? "s" : ""} left!</span>
        ) : isLow ? (
          <span className="text-amber-400 font-semibold">⚡ {remaining} spots remaining — filling fast</span>
        ) : (
          <span className="text-white/40">{remaining} of {capacity} spots open</span>
        )}
        <span className="text-white/20 tabular-nums">{pct}% filled</span>
      </div>
      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${isCritical ? "bg-red-500" : isLow ? "bg-amber-500" : "bg-emerald-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

const MAX_QTY = 5;

function EventCard({ ev, isMember, uid, userEmail }: {
  ev: Event;
  isMember: boolean;
  uid?: string;
  userEmail?: string;
}) {
  const isSoldOut = ev.status === "sold_out" || ev.ticketsRemaining === 0;
  const isCritical = !isSoldOut && ev.capacity > 0 && ev.ticketsRemaining <= 5;
  const isLow = !isSoldOut && ev.capacity > 0 && ev.ticketsRemaining <= Math.ceil(ev.capacity * 0.25);

  const memberPrice = Number(ev.memberPrice) || 0;
  const generalPrice = Number(ev.generalPrice) || 0;

  // Members pay memberPrice if available, everyone else pays generalPrice
  const displayPrice = isMember && memberPrice > 0 ? memberPrice : generalPrice;
  const savings = isMember && memberPrice > 0 && generalPrice > 0 ? generalPrice - memberPrice : 0;

  const [qty, setQty] = useState(1);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const maxQty = Math.min(MAX_QTY, ev.ticketsRemaining || MAX_QTY);
  const totalPrice = displayPrice * qty;

  const handleGetTickets = useCallback(async () => {
    // Clear previous error and lock button immediately
    setCheckoutError(null);
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/event-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: ev.id,
          quantity: qty,
          uid: uid ?? null,
          userEmail: userEmail ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Surface the exact server error message — server now returns meaningful errors
        throw new Error(data.error ?? "Checkout failed. Please try again.");
      }
      if (data.url) {
        window.location.href = data.url;
        // Don't reset loading — page is navigating
        return;
      }
      throw new Error("No redirect URL returned. Please try again.");
    } catch (e: unknown) {
      setCheckoutError(e instanceof Error ? e.message : String(e));
      // Re-enable button on failure so user can retry cleanly
      setCheckoutLoading(false);
    }
  }, [ev.id, qty, uid, userEmail]);

  return (
    <div className={`rounded-2xl overflow-hidden transition-all duration-300 group ${
      isSoldOut
        ? "border border-white/5 bg-white/[0.02] opacity-50"
        : isCritical
        ? "border border-red-500/30 bg-white/5 shadow-[0_0_30px_rgba(239,68,68,0.08)]"
        : "border border-white/10 bg-white/5 hover:border-white/25 hover:shadow-[0_0_40px_rgba(236,72,153,0.06)]"
    }`}>

      {/* Banner image */}
      {ev.imageUrl && (
        <div className="relative w-full h-60 overflow-hidden">
          <img
            src={ev.imageUrl}
            alt={ev.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          {/* Status badges — top left */}
          <div className="absolute top-4 left-4 flex gap-2 flex-wrap">
            {isSoldOut && (
              <span className="bg-red-900/90 backdrop-blur-sm border border-red-500/50 text-red-200 text-xs font-bold px-3 py-1.5 rounded-full">
                SOLD OUT
              </span>
            )}
            {isCritical && (
              <span className="bg-red-900/90 backdrop-blur-sm border border-red-500/50 text-red-200 text-xs font-bold px-3 py-1.5 rounded-full animate-pulse">
                🔥 {ev.ticketsRemaining} Left
              </span>
            )}
            {!isCritical && isLow && (
              <span className="bg-amber-900/90 backdrop-blur-sm border border-amber-500/40 text-amber-200 text-xs font-bold px-3 py-1.5 rounded-full animate-pulse">
                ⚡ Limited Spots
              </span>
            )}
          </div>

          {/* Pricing — bottom right of image */}
          <div className="absolute bottom-4 right-4 text-right">
            {isMember && savings > 0 ? (
              <>
                <div className="bg-pink-600 text-white text-sm font-bold px-4 py-2 rounded-xl shadow-lg shadow-pink-900/50">
                  Members ${memberPrice}
                </div>
                <div className="text-white/50 text-xs mt-1 line-through">${generalPrice} public</div>
              </>
            ) : generalPrice > 0 ? (
              <div className="bg-white/15 backdrop-blur-sm text-white text-sm font-bold px-4 py-2 rounded-xl border border-white/20">
                From ${generalPrice}
              </div>
            ) : null}
          </div>
        </div>
      )}

      <div className="p-6 space-y-4">
        {/* No image — inline pricing */}
        {!ev.imageUrl && (
          <div className="flex justify-between items-start gap-3 flex-wrap">
            <div className="flex gap-2 flex-wrap">
              {isCritical && (
                <span className="bg-red-900/60 border border-red-500/40 text-red-300 text-xs font-bold px-3 py-1.5 rounded-full animate-pulse">
                  🔥 {ev.ticketsRemaining} Left
                </span>
              )}
              {!isCritical && isLow && (
                <span className="bg-amber-900/60 border border-amber-500/40 text-amber-300 text-xs font-bold px-3 py-1.5 rounded-full animate-pulse">
                  ⚡ Limited
                </span>
              )}
            </div>
            {generalPrice > 0 && (
              <span className="bg-white/10 border border-white/15 text-white text-sm font-bold px-3 py-1.5 rounded-xl">
                {isMember && memberPrice > 0 ? `Members $${memberPrice}` : `$${generalPrice}`}
              </span>
            )}
          </div>
        )}

        {/* Title */}
        <h2 className="text-xl md:text-2xl font-bold leading-tight">{ev.title}</h2>

        {/* Date + Location */}
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-white/50">
          {ev.date && (
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 shrink-0 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
              {formatDate(ev.date)}
            </span>
          )}
          {ev.location && (
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 shrink-0 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              {ev.location}
            </span>
          )}
        </div>

        {/* Member savings callout (non-members only) */}
        {!isMember && memberPrice > 0 && generalPrice > 0 && (
          <div className="flex items-center gap-2 bg-pink-950/30 border border-pink-500/20 rounded-xl px-4 py-2.5">
            <svg className="w-4 h-4 text-pink-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
            </svg>
            <span className="text-pink-300 text-sm">
              Members save <span className="font-bold">${generalPrice - memberPrice}</span> on this event — <a href="/" className="underline hover:text-pink-200 transition">join for $25/mo</a>
            </span>
          </div>
        )}

        {/* Capacity bar */}
        {ev.capacity > 0 && !isSoldOut && (
          <UrgencyBar capacity={ev.capacity} remaining={ev.ticketsRemaining ?? ev.capacity} />
        )}

        {/* Description */}
        {ev.description && (
          <p className="text-white/45 text-sm leading-relaxed border-t border-white/5 pt-4">
            {ev.description}
          </p>
        )}

        {/* Action section */}
        <div className="pt-1 space-y-3">
          {isSoldOut ? (
            <div className="w-full text-center py-3 rounded-xl border border-white/10 text-white/25 text-sm font-medium cursor-not-allowed">
              Sold Out
            </div>
          ) : (
            <>
              {/* Quantity selector */}
              <div className="flex items-center justify-between bg-black/30 border border-white/10 rounded-xl px-4 py-3 gap-3">
                <span className="text-sm text-white/50 shrink-0">Qty</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    disabled={qty <= 1}
                    className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 disabled:opacity-20 text-white font-bold text-xl flex items-center justify-center transition select-none"
                    aria-label="Decrease"
                  >−</button>
                  <span className="w-8 text-center font-bold text-lg tabular-nums">{qty}</span>
                  <button
                    onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                    disabled={qty >= maxQty}
                    className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 disabled:opacity-20 text-white font-bold text-xl flex items-center justify-center transition select-none"
                    aria-label="Increase"
                  >+</button>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-white font-bold text-lg tabular-nums">${totalPrice.toFixed(2)}</div>
                  {qty > 1 && <div className="text-white/30 text-xs">${displayPrice} × {qty}</div>}
                </div>
              </div>

              {/* CTA */}
              <button
                onClick={handleGetTickets}
                disabled={checkoutLoading}
                className="w-full bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 active:from-pink-700 active:to-rose-700 disabled:opacity-50 disabled:cursor-not-allowed py-4 rounded-xl font-bold text-base transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-pink-900/30 hover:shadow-pink-900/50 hover:-translate-y-0.5"
              >
                {checkoutLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Redirecting…</span>
                  </>
                ) : (
                  <>
                    <span>Get Tickets — ${totalPrice.toFixed(2)}</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7"/>
                    </svg>
                  </>
                )}
              </button>

              {checkoutError && (
                <div className="bg-red-950/40 border border-red-800/50 rounded-lg px-3 py-2.5 space-y-1.5">
                  <p className="text-red-400 text-xs flex items-start gap-2">
                    <span className="shrink-0 mt-0.5">⚠</span>
                    <span>{checkoutError}</span>
                  </p>
                  <button
                    onClick={() => { setCheckoutError(null); handleGetTickets(); }}
                    className="text-red-300 text-xs underline hover:text-red-200 transition pl-5"
                  >
                    Try again →
                  </button>
                </div>
              )}

              <p className="text-center text-white/20 text-xs flex items-center justify-center gap-1.5">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                </svg>
                Secure checkout via Stripe
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Toast({ type, message, onClose }: { type: "success" | "cancel"; message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border text-sm font-medium ${
      type === "success" ? "bg-green-950 border-green-700/50 text-green-300" : "bg-white/10 border-white/20 text-white/60"
    }`}>
      <span>{type === "success" ? "✅" : "↩️"}</span>
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 opacity-50 hover:opacity-100 transition text-lg leading-none">×</button>
    </div>
  );
}

export default function EventsList() {
  const { user, isActive, isAdmin, loading: authLoading } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "cancel"; message: string } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const order = params.get("order");
    if (order === "success") {
      setToast({ type: "success", message: "Payment confirmed! Check your email for ticket details." });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (order === "cancel") {
      setToast({ type: "cancel", message: "Checkout cancelled — your spot is still available." });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
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
        <div key={i} className="bg-white/5 border border-white/10 rounded-2xl h-80 animate-pulse" />
      ))}
    </div>
  );

  if (error) return (
    <div className="text-center py-16">
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

  const isMember = isActive || isAdmin;

  return (
    <>
      <div className="space-y-6">
        {events.map((ev) => (
          <EventCard
            key={ev.id}
            ev={ev}
            isMember={isMember}
            uid={user?.uid}
            userEmail={user?.email ?? undefined}
          />
        ))}
      </div>
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </>
  );
}
