"use client";

// Announcements on the public menu (set on the Announcement Banner page). Each one is shown the way the manager chose:
// - "fixed": always on screen at the top, can't be closed
// - "auto":  slides in, disappears by itself after some seconds (1 second fade)
// - "close": slides in and stays until the customer closes it (closed ones stay closed during this visit)
// "auto" and "close" ones can be read again under More > Announcements.

import { useEffect, useRef, useState } from "react";
import { Megaphone, X } from "lucide-react";

export interface PublicAnnouncement { id: string; message: string; display: "fixed" | "auto" | "close"; seconds: number }

// One request per page, shared by the notice and the More menu
const cache = new Map<string, Promise<PublicAnnouncement[]>>();
export function loadAnnouncements(restaurant: string): Promise<PublicAnnouncement[]> {
  let p = cache.get(restaurant);
  if (!p) {
    p = fetch(`/api/restaurants/${encodeURIComponent(restaurant)}/announcements?public=1`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => (Array.isArray(d?.announcements) ? d.announcements : []))
      .catch(() => []);
    cache.set(restaurant, p);
  }
  return p;
}

const KEY = "skano.announcements.closed";
const readClosed = (): string[] => {
  try { return JSON.parse(sessionStorage.getItem(KEY) || "[]"); } catch { return []; }
};
const closedKey = (restaurant: string, a: PublicAnnouncement) => `${restaurant}:${a.id}:${a.message}`;

function Card({ a, onClose, className = "", style }: { a: PublicAnnouncement; onClose?: () => void; className?: string; style?: React.CSSProperties }) {
  return (
    <div role="status" style={style}
      className={`w-full max-w-md flex items-start gap-3 rounded-2xl bg-white text-gray-900 shadow-[0_10px_40px_rgba(0,0,0,0.35)] ring-1 ring-black/5 px-4 py-3 ${className}`}>
      <span className="w-8 h-8 shrink-0 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center"><Megaphone className="w-4 h-4" /></span>
      <p className={`flex-1 text-sm leading-snug pt-1.5 whitespace-pre-line break-words ${onClose ? "" : "pb-1"}`}>{a.message}</p>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Close announcement" className="shrink-0 -mr-1 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

/** A notice that slides in, and fades out over 1 second when it goes */
function Floating({ a, index, onGone, closable }: { a: PublicAnnouncement; index: number; onGone: () => void; closable: boolean }) {
  const [phase, setPhase] = useState<"in" | "shown" | "out">("in");
  // The latest onGone, so re-renders don't restart the timers
  const goneRef = useRef(onGone);
  useEffect(() => { goneRef.current = onGone; });
  // Position when it first showed (others closing must not restart its timer)
  const [delay] = useState(() => 400 + index * 120);
  useEffect(() => {
    const timers = [setTimeout(() => setPhase("shown"), delay)];
    if (a.display === "auto") {
      timers.push(setTimeout(() => setPhase("out"), delay + a.seconds * 1000));
      timers.push(setTimeout(() => goneRef.current(), delay + a.seconds * 1000 + 1000));
    }
    return () => timers.forEach(clearTimeout);
  }, [a, delay]);
  const close = () => { setPhase("out"); setTimeout(() => goneRef.current(), 1000); };
  return (
    <Card a={a} onClose={closable ? close : undefined}
      className={`pointer-events-auto transition-all duration-1000 ease-in-out ${phase === "shown" ? "translate-y-0 opacity-100" : phase === "in" ? "-translate-y-6 opacity-0" : "-translate-y-3 opacity-0"}`} />
  );
}

export function AnnouncementNotice({ restaurant, inline = false }: {
  restaurant: string;
  /** Put "fixed" announcements in the page flow (above the menu) instead of over it */
  inline?: boolean;
}) {
  const [items, setItems] = useState<PublicAnnouncement[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadAnnouncements(restaurant).then((list) => {
      if (cancelled) return;
      const closed = readClosed();
      setItems(list.filter((a) => a.display === "fixed" || !closed.includes(closedKey(restaurant, a))));
    });
    return () => { cancelled = true; };
  }, [restaurant]);

  function gone(a: PublicAnnouncement) {
    // Closed by the customer, or timed out: not again during this visit (still under More)
    try { sessionStorage.setItem(KEY, JSON.stringify([...readClosed(), closedKey(restaurant, a)])); } catch { /* private mode */ }
    setItems((list) => list.filter((x) => x.id !== a.id));
  }

  const fixed = items.filter((a) => a.display === "fixed");
  const floating = items.filter((a) => a.display !== "fixed");
  if (!items.length) return null;

  return (
    <>
      {inline && fixed.length > 0 && (
        <div className="flex flex-col items-center gap-2 px-3 pt-3">
          {fixed.map((a) => <Card key={a.id} a={a} className="shadow-md" />)}
        </div>
      )}
      {(floating.length > 0 || (!inline && fixed.length > 0)) && (
        <div className="fixed inset-x-0 top-0 z-[45] flex flex-col items-center gap-2 px-3 pt-3 pointer-events-none" aria-live="polite">
          {!inline && fixed.map((a) => <Card key={a.id} a={a} className="pointer-events-auto" />)}
          {floating.map((a, i) => (
            <Floating key={a.id} a={a} index={i} closable={a.display === "close"} onGone={() => gone(a)} />
          ))}
        </div>
      )}
    </>
  );
}
