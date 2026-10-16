"use client";

// "More" button on the public menu with Ask about the dishes, Announcements, Loyalty stamp card, Opening hours and Leave feedback.
// Leave feedback opens a small form: stars, a comment and an optional name. Saved feedback shows on the Customer Feedback page.

import { useCallback, useEffect, useState } from "react";
import { Star, MessageSquare, X, Loader2, CheckCircle2, Clock, MoreHorizontal, Stamp, Megaphone, MessageCircleQuestion, Wifi, CalendarCheck } from "lucide-react";
import { WifiPassword } from "@/components/wifi-password";
import { LoyaltySheet } from "@/components/loyalty-sheet";
import { AskSheet } from "@/components/ask-sheet";
import { loadAnnouncements, type PublicAnnouncement } from "@/components/announcement-notice";

import { nextDays, openNow, type HoursData } from "@/lib/opening-hours";

/**
 * "More" button on the public menu: opens a small menu with
 * - Leave feedback (when the restaurant collects feedback)
 * - Opening hours (when the restaurant added them): today and the next 7 days
 */
export function MoreButton({ restaurant, feedback = true }: {
  /** Restaurant id or slug */
  restaurant: string;
  /** Show Leave feedback */
  feedback?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [sheet, setSheet] = useState<"feedback" | "hours" | "loyalty" | "news" | "ask" | "wifi" | null>(null);
  // Customers can ask about the dishes (on for the restaurant, and the kitchen added details)
  const [askOn, setAskOn] = useState(false);
  // Announcements that disappear or can be closed: readable again here
  const [news, setNews] = useState<PublicAnnouncement[]>([]);
  const [data, setData] = useState<HoursData | null>(null);
  // The button shows once we know whether there are opening hours (so the menu is complete when opened)
  const [loaded, setLoaded] = useState(false);
  const close = useCallback(() => setSheet(null), []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/restaurants/${encodeURIComponent(restaurant)}/hours`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d) setData(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoaded(true); });
    fetch(`/api/restaurants/${encodeURIComponent(restaurant)}/ask`).then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d?.enabled) setAskOn(true); }).catch(() => {});
    loadAnnouncements(restaurant).then((list) => { if (!cancelled) setNews(list.filter((a) => a.display !== "fixed")); });
    return () => { cancelled = true; };
  }, [restaurant]);

  const hasHours = !!data?.hours;
  const items = [
    askOn && { key: "ask" as const, label: "Ask about the dishes", icon: <MessageCircleQuestion className="w-4 h-4 text-blue-600" /> },
    news.length > 0 && { key: "news" as const, label: news.length > 1 ? `Announcements (${news.length})` : "Announcement", icon: <Megaphone className="w-4 h-4 text-amber-600" /> },
    data?.loyalty && { key: "loyalty" as const, label: "Loyalty stamp card", icon: <Stamp className="w-4 h-4 text-blue-600" /> },
    hasHours && { key: "hours" as const, label: "Opening hours", icon: <Clock className="w-4 h-4 text-blue-600" /> },
    data?.wifi && { key: "wifi" as const, label: "Wi-Fi password", icon: <Wifi className="w-4 h-4 text-blue-600" /> },
    data?.reserve && { key: "reserve" as const, label: "Reserve a table", icon: <CalendarCheck className="w-4 h-4 text-emerald-600" /> },
    feedback && { key: "feedback" as const, label: "Leave feedback", icon: <MessageSquare className="w-4 h-4 text-blue-600" /> },
  ].filter((x): x is { key: "ask" | "news" | "loyalty" | "hours" | "wifi" | "reserve" | "feedback"; label: string; icon: React.ReactElement } => !!x);
  if (!loaded || !items.length) return null;

  return (
    <>
      {!sheet && (
        <div className="fixed z-40 bottom-12 right-3 sm:right-5 flex flex-col items-end gap-2">
          {menuOpen && (
            <>
              <div className="fixed inset-0 -z-10" onClick={() => setMenuOpen(false)} />
              <div role="menu" aria-label="More" className="w-52 rounded-2xl bg-white text-gray-900 shadow-[0_10px_40px_rgba(0,0,0,0.35)] ring-1 ring-black/5 overflow-hidden">
                {items.map((it, n) => (
                  <button key={it.key} type="button" role="menuitem" onClick={() => {
                    setMenuOpen(false);
                    // Reserving is its own page
                    if (it.key === "reserve") { window.location.href = `/reserve/${encodeURIComponent(restaurant)}`; return; }
                    setSheet(it.key);
                  }}
                    className={`w-full flex items-center gap-2.5 px-4 py-3 text-sm font-semibold hover:bg-gray-50 text-left ${n ? "border-t border-gray-100" : ""}`}>
                    {it.icon} {it.label}
                  </button>
                ))}
              </div>
            </>
          )}
          <button type="button" onClick={() => setMenuOpen((o) => !o)} aria-expanded={menuOpen} aria-haspopup="menu"
            className="inline-flex items-center gap-2 rounded-full bg-white text-gray-900 text-sm font-semibold pl-3.5 pr-4 py-2.5 shadow-[0_6px_24px_rgba(0,0,0,0.35)] ring-1 ring-black/5 hover:bg-gray-50 active:scale-95 transition">
            {menuOpen ? <X className="w-4 h-4 text-blue-600" /> : <MoreHorizontal className="w-4 h-4 text-blue-600" />} More
          </button>
        </div>
      )}
      {sheet === "feedback" && <FeedbackSheet restaurant={restaurant} onClose={close} />}
      {sheet === "hours" && data && <HoursSheet data={data} onClose={close} />}
      {sheet === "loyalty" && <LoyaltySheet restaurant={restaurant} onClose={close} />}
      {sheet === "news" && <NewsSheet items={news} onClose={close} />}
      {sheet === "wifi" && data?.wifi && <WifiSheet password={data.wifi} onClose={close} />}
      {sheet === "ask" && <AskSheet restaurant={restaurant} onClose={close} />}
    </>
  );
}

function WifiSheet({ password, onClose }: { password: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[3000] flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
      <div role="dialog" aria-modal="true" aria-label="Wi-Fi password" onClick={(e) => e.stopPropagation()}
        className="relative w-full sm:max-w-md bg-white text-gray-900 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100">
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-bold flex items-center gap-2"><Wifi className="w-5 h-5 text-blue-600" /> Wi-Fi password</h2>
        <p className="text-sm text-gray-500 mt-1 mb-4">Connect to the restaurant&apos;s Wi-Fi with this password.</p>
        <WifiPassword password={password} />
      </div>
    </div>
  );
}

function NewsSheet({ items, onClose }: { items: PublicAnnouncement[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[3000] flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
      <div role="dialog" aria-modal="true" aria-label="Announcements" onClick={(e) => e.stopPropagation()}
        className="relative w-full sm:max-w-md bg-white text-gray-900 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 max-h-[88vh] overflow-y-auto">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100">
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-bold flex items-center gap-2"><Megaphone className="w-5 h-5 text-amber-600" /> {items.length > 1 ? "Announcements" : "Announcement"}</h2>
        <ul className="mt-4 space-y-2.5">
          {items.map((a) => (
            <li key={a.id} className="rounded-2xl bg-amber-50 border border-amber-100 px-4 py-3 text-sm leading-snug whitespace-pre-line break-words">{a.message}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function HoursSheet({ data, onClose }: { data: HoursData; onClose: () => void }) {
  const [now] = useState(() => new Date());
  const days = nextDays(data, now);
  const isOpen = openNow(data, now);
  const fmt = new Intl.DateTimeFormat(undefined, { weekday: "long" });
  const fmtDate = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });
  return (
    <div className="fixed inset-0 z-[3000] flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
      <div role="dialog" aria-modal="true" aria-label="Opening hours" onClick={(e) => e.stopPropagation()}
        className="relative w-full sm:max-w-md bg-white text-gray-900 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 max-h-[88vh] overflow-y-auto">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100">
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-bold flex items-center gap-2"><Clock className="w-5 h-5 text-blue-600" /> Opening hours</h2>
        <div className={`inline-flex items-center gap-1.5 mt-2 text-xs font-semibold px-2.5 py-1 rounded-full ${isOpen ? "bg-green-100 text-green-800" : "bg-red-50 text-red-700"}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? "bg-green-500" : "bg-red-500"}`} /> {isOpen ? "Open now" : "Closed now"}
        </div>
        <ul className="mt-4 divide-y divide-gray-100">
          {days.map((d, i) => (
            <li key={i} className={`flex items-center justify-between gap-3 py-2.5 ${i === 0 ? "font-semibold" : ""}`}>
              <div className="min-w-0">
                <div className="text-sm">
                  {i === 0 ? "Today" : i === 1 ? "Tomorrow" : fmt.format(d.date)}
                  <span className="text-gray-400 font-normal"> · {fmtDate.format(d.date)}</span>
                </div>
                {d.label && <div className="text-xs text-amber-700 font-medium">{d.label}</div>}
              </div>
              <div className={`text-sm shrink-0 ${d.closed ? "text-red-600" : "text-gray-900"}`}>
                {d.closed ? "Closed" : `${d.open} – ${d.close}`}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function FeedbackSheet({ restaurant, onClose }: { restaurant: string; onClose: () => void }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // After "Thank you!": wait 3 seconds, then fade out over 1 second and close
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (!done) return;
    const fade = setTimeout(() => setClosing(true), 3000);
    const close = setTimeout(onClose, 4000);
    return () => { clearTimeout(fade); clearTimeout(close); };
  }, [done, onClose]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!rating || busy) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/restaurants/${encodeURIComponent(restaurant)}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, comment: comment.trim() || null, customerName: name.trim() || null }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) { setError("Could not send it. Please try again."); return; }
    setDone(true);
  }

  return (
    <div className={`fixed inset-0 z-[3000] flex items-end sm:items-center justify-center transition-opacity duration-1000 ease-in-out ${closing ? "opacity-0 pointer-events-none" : "opacity-100"}`}
      onClick={() => !busy && onClose()}>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
      <div role="dialog" aria-modal="true" aria-label="Leave feedback" onClick={(e) => e.stopPropagation()}
        className="relative w-full sm:max-w-md bg-white text-gray-900 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 max-h-[88vh] overflow-y-auto">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100">
          <X className="w-5 h-5" />
        </button>
        {done ? (
          <div className="py-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <div className="text-lg font-bold">Thank you!</div>
            <p className="text-sm text-gray-500 mt-1">Your feedback was sent to the restaurant.</p>
            <button type="button" onClick={onClose} className="mt-5 text-sm font-semibold text-white bg-gray-900 rounded-xl px-5 py-2.5">Back to the menu</button>
          </div>
        ) : (
          <form onSubmit={send} className="space-y-4">
            <div>
              <h2 className="text-lg font-bold">Leave feedback</h2>
              <p className="text-sm text-gray-500">How was your visit? The restaurant reads every message.</p>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-700 mb-1.5">Your rating</div>
              <div className="flex gap-1" role="radiogroup" aria-label="Rating">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button key={s} type="button" role="radio" aria-checked={rating === s} aria-label={`${s} star${s === 1 ? "" : "s"}`}
                    onClick={() => setRating(s)} className="p-1 transition-transform hover:scale-110">
                    <Star className={`w-8 h-8 ${s <= rating ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />
                  </button>
                ))}
              </div>
            </div>
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1.5">Comment <span className="font-normal text-gray-400">(optional)</span></span>
              <textarea id="feedback-comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={3} maxLength={1000}
                placeholder="What did you like? What could be better?"
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 resize-none" />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1.5">Your name <span className="font-normal text-gray-400">(optional)</span></span>
              <input id="feedback-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={!rating || busy}
              className="w-full inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-gray-900 hover:bg-black rounded-xl py-3 disabled:opacity-40">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} {rating ? "Send feedback" : "Choose a rating to send"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
