"use client";

// "Leave feedback" button on the public menu (when the restaurant has feedback turned on).
// Opens a small form: stars, a comment and an optional name. Saved feedback shows on the Customer Feedback page.

import { useState } from "react";
import { Star, MessageSquare, X, Loader2, CheckCircle2 } from "lucide-react";

export function FeedbackButton({ restaurant, className = "" }: {
  /** Restaurant id or slug */
  restaurant: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {!open && (
        <button type="button" onClick={() => setOpen(true)}
          className={`fixed z-40 bottom-12 right-3 sm:right-5 inline-flex items-center gap-2 rounded-full bg-white text-gray-900 text-sm font-semibold pl-3.5 pr-4 py-2.5 shadow-[0_6px_24px_rgba(0,0,0,0.35)] ring-1 ring-black/5 hover:bg-gray-50 active:scale-95 transition ${className}`}>
          <MessageSquare className="w-4 h-4 text-blue-600" /> Leave feedback
        </button>
      )}
      {open && <FeedbackSheet restaurant={restaurant} onClose={() => setOpen(false)} />}
    </>
  );
}

function FeedbackSheet({ restaurant, onClose }: { restaurant: string; onClose: () => void }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={() => !busy && onClose()}>
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
