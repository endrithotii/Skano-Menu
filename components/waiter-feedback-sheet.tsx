"use client";

// More > Rate your waiter: the customer picks their waiter (first names), gives stars, taps what was good or not,
// and can write a comment. Only when the manager turned it on (Customer Feedback page).

import { useEffect, useState } from "react";
import { X, Star, Loader2, CheckCircle2 } from "lucide-react";

export interface WaiterChoice { id: string; name: string }

export function WaiterFeedbackSheet({ restaurant, waiters, tags, onClose }: { restaurant: string; waiters: WaiterChoice[]; tags: string[]; onClose: () => void }) {
  const [waiterId, setWaiterId] = useState(waiters.length === 1 ? waiters[0].id : "");
  const [rating, setRating] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (!done) return;
    const fade = setTimeout(() => setClosing(true), 3000);
    const close = setTimeout(onClose, 4000);
    return () => { clearTimeout(fade); clearTimeout(close); };
  }, [done, onClose]);

  const waiter = waiters.find((w) => w.id === waiterId);
  const toggle = (t: string) => setPicked((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!rating || !waiterId || busy) return;
    setBusy(true); setError(null);
    const res = await fetch(`/api/restaurants/${encodeURIComponent(restaurant)}/waiter-feedback`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ waiterId, rating, tags: picked, comment: comment.trim(), customerName: name.trim() }),
    }).catch(() => null);
    const d = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) { setError(d?.error ?? "Could not send it. Please try again."); return; }
    setDone(true);
  }

  return (
    <div className={`fixed inset-0 z-[3000] flex items-end sm:items-center justify-center transition-opacity duration-1000 ease-in-out ${closing ? "opacity-0 pointer-events-none" : "opacity-100"}`}
      onClick={() => !busy && onClose()}>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
      <div role="dialog" aria-modal="true" aria-label="Rate your waiter" onClick={(e) => e.stopPropagation()} data-waiter-sheet
        className="relative w-full sm:max-w-md bg-white text-gray-900 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 max-h-[88vh] overflow-y-auto">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100">
          <X className="w-5 h-5" />
        </button>
        {done ? (
          <div className="py-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <div className="text-lg font-bold">Thank you!</div>
            <p className="text-sm text-gray-500 mt-1">Your feedback about {waiter?.name} was sent to the restaurant.</p>
            <button type="button" onClick={onClose} className="mt-5 text-sm font-semibold text-white bg-gray-900 rounded-xl px-5 py-2.5">Back to the menu</button>
          </div>
        ) : (
          <form onSubmit={send} className="space-y-4">
            <div>
              <h2 className="text-lg font-bold">Rate your waiter</h2>
              <p className="text-sm text-gray-500">Tell the restaurant how your service was.</p>
            </div>
            <fieldset>
              <legend className="text-sm font-medium text-gray-700 mb-1.5">Who served you?</legend>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {waiters.map((w) => (
                  <button key={w.id} type="button" onClick={() => setWaiterId(w.id)} aria-pressed={waiterId === w.id} data-waiter={w.name}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold text-left ${waiterId === w.id ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 text-gray-800 hover:bg-gray-50"}`}>
                    <span className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${waiterId === w.id ? "bg-white/20" : "bg-gray-100 text-gray-600"}`}>{w.name.charAt(0).toUpperCase()}</span>
                    <span className="truncate">{w.name}</span>
                  </button>
                ))}
              </div>
            </fieldset>
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
            <fieldset>
              <legend className="text-sm font-medium text-gray-700 mb-1.5">Anything to add? <span className="font-normal text-gray-400">(tap all that fit)</span></legend>
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <button key={t} type="button" onClick={() => toggle(t)} aria-pressed={picked.includes(t)} data-tag={t}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${picked.includes(t) ? "border-amber-400 bg-amber-50 text-amber-900" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}>{t}</button>
                ))}
              </div>
            </fieldset>
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1.5">Comment <span className="font-normal text-gray-400">(optional)</span></span>
              <textarea id="waiter-comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={3} maxLength={1000}
                placeholder={waiter ? `What was good about ${waiter.name}? What could be better?` : "What was good? What could be better?"}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 resize-none" />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1.5">Your name <span className="font-normal text-gray-400">(optional)</span></span>
              <input id="waiter-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" />
            </label>
            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
            <button type="submit" disabled={!rating || !waiterId || busy} data-go="send-waiter"
              className="w-full inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-gray-900 hover:bg-black rounded-xl py-3 disabled:opacity-40">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} {!waiterId ? "Pick your waiter" : rating ? "Send feedback" : "Choose a rating to send"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
