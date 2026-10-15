"use client";

// Announcement notification at the top of the public menu (set on the Announcements page).
// Slides in when the menu opens. Closing it hides it until the customer opens the menu again (new visit).

import { useEffect, useState } from "react";
import { Megaphone, X } from "lucide-react";

interface Item { id: string; message: string }

const KEY = "skano.announcements.closed";
const readClosed = (): string[] => {
  try { return JSON.parse(sessionStorage.getItem(KEY) || "[]"); } catch { return []; }
};

export function AnnouncementNotice({ restaurant }: { restaurant: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/restaurants/${encodeURIComponent(restaurant)}/announcements?public=1`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.announcements) return;
        const closed = readClosed();
        setItems((d.announcements as Item[]).filter((a) => !closed.includes(`${restaurant}:${a.id}:${a.message}`)));
        setTimeout(() => { if (!cancelled) setShown(true); }, 400);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [restaurant]);

  function close(a: Item) {
    try { sessionStorage.setItem(KEY, JSON.stringify([...readClosed(), `${restaurant}:${a.id}:${a.message}`])); } catch { /* private mode */ }
    setItems((list) => list.filter((x) => x.id !== a.id));
  }

  if (!items.length) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-[45] flex flex-col items-center gap-2 px-3 pt-3 pointer-events-none" aria-live="polite">
      {items.map((a, i) => (
        <div key={a.id} role="status"
          style={{ transitionDelay: `${i * 120}ms` }}
          className={`pointer-events-auto w-full max-w-md flex items-start gap-3 rounded-2xl bg-white text-gray-900 shadow-[0_10px_40px_rgba(0,0,0,0.35)] ring-1 ring-black/5 px-4 py-3 transition-all duration-500 ease-out ${shown ? "translate-y-0 opacity-100" : "-translate-y-6 opacity-0"}`}>
          <span className="w-8 h-8 shrink-0 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center"><Megaphone className="w-4 h-4" /></span>
          <p className="flex-1 text-sm leading-snug pt-1.5 whitespace-pre-line break-words">{a.message}</p>
          <button type="button" onClick={() => close(a)} aria-label="Close announcement" className="shrink-0 -mr-1 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
