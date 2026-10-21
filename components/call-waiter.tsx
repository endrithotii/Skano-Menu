"use client";

// "Call the waiter" on the public menu. Only shows when the menu was opened from a table's own
// QR code (…/r/<slug>?table=5), so the waiter knows where to go. The table is kept for the visit
// (this browser tab), so it still works after opening a submenu of a menu tree.

import { useEffect, useRef, useState } from "react";
import { BellRing, CheckCircle2, Loader2, X } from "lucide-react";

const REASONS = ["Ready to order", "The bill, please", "Something else"] as const;
// After a call, the button rests a moment so one tap doesn't turn into five calls
const COOLDOWN_MS = 60_000;

const storageKey = (restaurant: string) => `skano-table:${restaurant}`;

/** The table this visit is at: from ?table= in the link, or remembered from earlier in this tab */
export function useTableNumber(restaurant: string | null | undefined): string | null {
  const [table, setTable] = useState<string | null>(null);
  useEffect(() => {
    if (!restaurant) return;
    let t: string | null = null;
    try {
      const fromLink = new URLSearchParams(window.location.search).get("table")?.trim().slice(0, 20);
      if (fromLink) {
        sessionStorage.setItem(storageKey(restaurant), fromLink);
        t = fromLink;
      } else {
        t = sessionStorage.getItem(storageKey(restaurant));
      }
    } catch { /* storage blocked: only the link counts */ }
    // Read after mount: the URL and storage only exist in the browser
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (t) setTable(t);
  }, [restaurant]);
  return table;
}

/** Floating button (bottom left, the More button sits bottom right) and its sheet */
export function CallWaiterButton({ restaurant }: {
  /** Restaurant id or slug */
  restaurant: string;
}) {
  const table = useTableNumber(restaurant);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number] | null>(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  // Just called: the waiter is on the way (for a minute)
  const [resting, setResting] = useState(false);
  const [error, setError] = useState(false);
  const restTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (restTimer.current) clearTimeout(restTimer.current); }, []);

  if (!table) return null;

  async function send() {
    setSending(true);
    setError(false);
    const message = [reason !== "Something else" ? reason : null, note.trim() || null].filter(Boolean).join(" · ") || null;
    try {
      const res = await fetch(`/api/restaurants/${encodeURIComponent(restaurant)}/waiter-call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableNumber: table, message }),
      });
      if (!res.ok) throw new Error("call");
      setResting(true);
      if (restTimer.current) clearTimeout(restTimer.current);
      restTimer.current = setTimeout(() => setResting(false), COOLDOWN_MS);
      setReason(null);
      setNote("");
    } catch {
      setError(true);
    }
    setSending(false);
  }

  function close() {
    setOpen(false);
    setError(false);
  }

  return (
    <>
      {!open && (
        <button type="button" onClick={() => setOpen(true)} data-call-waiter
          className="fixed z-40 bottom-12 left-3 sm:left-5 inline-flex items-center gap-2 rounded-full bg-white text-gray-900 text-sm font-semibold pl-3.5 pr-4 py-2.5 shadow-[0_6px_24px_rgba(0,0,0,0.35)] ring-1 ring-black/5 hover:bg-gray-50 active:scale-95 transition">
          <BellRing className="w-4 h-4 text-blue-600" /> {resting ? "Waiter called" : "Call the waiter"}
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[3000] flex items-end sm:items-center justify-center" onClick={close}>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          <div role="dialog" aria-modal="true" aria-label="Call the waiter" onClick={(e) => e.stopPropagation()}
            className="relative w-full sm:max-w-md bg-white text-gray-900 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 max-h-[88vh] overflow-y-auto">
            <button type="button" onClick={close} aria-label="Close" className="absolute right-3 top-3 w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-bold flex items-center gap-2"><BellRing className="w-5 h-5 text-blue-600" /> Call the waiter</h2>
            <p className="text-sm text-gray-500 mt-1">Table {table}</p>

            {resting ? (
              <div className="mt-5 flex flex-col items-center text-center py-4">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
                <p className="mt-2 font-semibold">The waiter is on the way</p>
                <p className="text-sm text-gray-500 mt-1">You can call again in a minute if nobody came.</p>
                <button type="button" onClick={close} className="mt-5 w-full py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold">OK</button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="text-sm font-semibold">What do you need? <span className="font-normal text-gray-400">(optional)</span></div>
                <div className="flex flex-wrap gap-2">
                  {REASONS.map((r) => (
                    <button key={r} type="button" aria-pressed={reason === r} onClick={() => setReason(reason === r ? null : r)}
                      className={`text-sm font-medium px-3.5 py-2 rounded-full border ${reason === r ? "border-blue-600 bg-blue-50 text-blue-800" : "border-gray-200 text-gray-700 hover:border-gray-300"}`}>
                      {r}
                    </button>
                  ))}
                </div>
                {reason === "Something else" && (
                  <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={150} autoFocus
                    placeholder="e.g. some napkins please"
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" />
                )}
                {error && <p className="text-sm text-red-600">That didn&apos;t go through. Check your internet and try again.</p>}
                <button type="button" onClick={send} disabled={sending}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-60">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <BellRing className="w-4 h-4" />} Call the waiter
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
