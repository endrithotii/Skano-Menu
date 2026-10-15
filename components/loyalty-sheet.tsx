"use client";

// Customer's loyalty stamp card (public menu > More > Loyalty stamp card).
// 1. The customer types their email or phone number and sees their stamps.
// 2. "Add a stamp" makes a code + QR code. The waiter scans it (or types the code) and confirms.
// 3. This screen checks every few seconds and shows the new stamp as soon as the waiter confirmed.
// A full card shows the reward; "Get my reward" works the same way and the card starts again.

import { useCallback, useEffect, useRef, useState } from "react";
import { Stamp, X, Loader2, Gift, Check, RefreshCw, PartyPopper } from "lucide-react";
import QRCode from "qrcode";

interface CardInfo { total: number; reward: string; masked: string; stamps: number; rewards: number }
interface Pending { code: string; kind: "stamp" | "reward"; expiresAt: string; qr: string | null }

const storageKey = (restaurant: string) => `skano.loyalty.${restaurant}`;
const readSaved = (restaurant: string) => {
  try { return localStorage.getItem(storageKey(restaurant)) ?? ""; } catch { return ""; }
};

export function LoyaltySheet({ restaurant, onClose }: { restaurant: string; onClose: () => void }) {
  const api = `/api/restaurants/${encodeURIComponent(restaurant)}/loyalty-card`;
  const [contact, setContact] = useState(() => readSaved(restaurant));
  const [card, setCard] = useState<CardInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [expired, setExpired] = useState(false);
  const [done, setDone] = useState<null | "stamp" | "reward">(null);
  const triedSaved = useRef(false);

  const lookup = useCallback(async (value: string, quiet = false) => {
    const v = value.trim();
    if (!v) return;
    setBusy(true);
    if (!quiet) setError(null);
    const res = await fetch(`${api}?contact=${encodeURIComponent(v)}`).catch(() => null);
    const d = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok || !d || d.enabled === false) {
      if (!quiet) setError(d?.error ?? (d?.enabled === false ? "This restaurant has no loyalty card right now." : "Could not load your card. Please try again."));
      return;
    }
    setCard(d);
    try { localStorage.setItem(storageKey(restaurant), v); } catch { /* private mode */ }
  }, [api, restaurant]);

  // Came back with a saved email / phone: show the card straight away
  useEffect(() => {
    if (triedSaved.current) return;
    triedSaved.current = true;
    const saved = readSaved(restaurant);
    if (saved) void Promise.resolve().then(() => lookup(saved, true));
  }, [restaurant, lookup]);

  // Waiting for the waiter: check every 2.5 seconds
  useEffect(() => {
    if (!pending) return;
    let stop = false;
    const tick = async () => {
      const d = await fetch(`${api}?request=${pending.code}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (stop || !d) return;
      if (d.status === "approved") {
        setPending(null);
        setDone(pending.kind);
        setCard((c) => (c ? { ...c, stamps: d.stamps, rewards: d.rewards } : c));
      } else if (d.status === "expired") {
        setPending(null);
        setExpired(true);
      }
    };
    const t = setInterval(tick, 2500);
    return () => { stop = true; clearInterval(t); };
  }, [pending, api]);

  async function ask(kind: "stamp" | "reward") {
    if (!card || busy) return;
    setBusy(true);
    setError(null);
    setExpired(false);
    setDone(null);
    const res = await fetch(api, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contact: contact.trim(), kind }),
    }).catch(() => null);
    const d = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok || !d?.code) { setError(d?.error ?? "Could not make a code. Please try again."); return; }
    const url = `${location.origin}/stamp/${d.code}`;
    const qr = await QRCode.toDataURL(url, { margin: 1, width: 360, errorCorrectionLevel: "M" }).catch(() => null);
    setPending({ code: d.code, kind, expiresAt: d.expiresAt, qr });
  }

  function useAnother() {
    setCard(null);
    setPending(null);
    setDone(null);
    setExpired(false);
    setContact("");
    try { localStorage.removeItem(storageKey(restaurant)); } catch { /* private mode */ }
  }

  const full = !!card && card.stamps >= card.total;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={() => !busy && onClose()}>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
      <div role="dialog" aria-modal="true" aria-label="Loyalty stamp card" onClick={(e) => e.stopPropagation()}
        className="relative w-full sm:max-w-md bg-white text-gray-900 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 max-h-[90vh] overflow-y-auto">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100">
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-bold flex items-center gap-2"><Stamp className="w-5 h-5 text-blue-600" /> Loyalty stamp card</h2>

        {!card ? (
          <form onSubmit={(e) => { e.preventDefault(); void lookup(contact); }} className="mt-3 space-y-3">
            <p className="text-sm text-gray-500">Type your email or phone number to see your stamps. New here? This starts your card.</p>
            <input id="loyalty-contact" value={contact} onChange={(e) => setContact(e.target.value)} autoComplete="email" inputMode="email"
              placeholder="Email or phone number"
              className="w-full text-base border border-gray-200 rounded-xl px-3 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={!contact.trim() || busy}
              className="w-full inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-gray-900 hover:bg-black rounded-xl py-3 disabled:opacity-40">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Show my stamps
            </button>
          </form>
        ) : (
          <div className="mt-3 space-y-4">
            <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-white/75">{card.masked}</div>
                {card.rewards > 0 && <div className="text-[11px] font-semibold bg-white/15 rounded-full px-2 py-0.5">{card.rewards} reward{card.rewards === 1 ? "" : "s"} so far</div>}
              </div>
              <div className="text-3xl font-black mt-1">{card.stamps} <span className="text-lg font-semibold text-white/70">of {card.total}</span></div>
              <div className="text-sm text-white/85">{full ? `Your reward is ready: ${card.reward}` : `${card.total - card.stamps} more for: ${card.reward}`}</div>
              <div className="mt-3 grid grid-cols-5 gap-2" aria-label={`${card.stamps} of ${card.total} stamps`}>
                {Array.from({ length: card.total }).map((_, i) => (
                  <div key={i} className={`aspect-square rounded-full flex items-center justify-center border-2 ${i < card.stamps ? "bg-white border-white text-blue-600" : "border-white/35"}`}>
                    {i < card.stamps ? <Check className="w-4 h-4" strokeWidth={3} /> : i === card.total - 1 ? <Gift className="w-4 h-4 text-white/60" /> : null}
                  </div>
                ))}
              </div>
            </div>

            {done && (
              <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-3 py-2.5 text-sm text-green-800">
                <PartyPopper className="w-4 h-4 shrink-0" />
                {done === "stamp" ? (full ? "Stamp added. Your card is full, enjoy your reward!" : "Stamp added. Thank you!") : "Enjoy your reward! Your new card starts now."}
              </div>
            )}

            {pending ? (
              <div className="rounded-2xl border-2 border-blue-200 bg-blue-50/50 p-4 text-center">
                <div className="text-sm font-semibold text-gray-900">{pending.kind === "reward" ? "Show this to the waiter to get your reward" : "Call the waiter to add your stamp"}</div>
                <p className="text-xs text-gray-500 mt-0.5">The waiter scans this code with their phone, or types it on their waiter page.</p>
                {pending.qr && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pending.qr} alt={`Code ${pending.code}`} className="mx-auto mt-3 w-48 h-48 rounded-lg bg-white p-1" />
                )}
                <div className="mt-2 font-mono text-2xl font-black tracking-[0.3em] text-gray-900" aria-label="Code">{pending.code}</div>
                <div className="mt-2 inline-flex items-center gap-2 text-xs text-gray-500"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Waiting for the waiter…</div>
                <div><button type="button" onClick={() => setPending(null)} className="mt-2 text-xs font-medium text-gray-500 underline">Cancel</button></div>
              </div>
            ) : (
              <>
                {expired && <p className="text-sm text-amber-700">That code ran out. Make a new one when the waiter is at your table.</p>}
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button type="button" onClick={() => ask(full ? "reward" : "stamp")} disabled={busy}
                  className={`w-full inline-flex items-center justify-center gap-2 text-sm font-semibold text-white rounded-xl py-3 disabled:opacity-40 ${full ? "bg-green-600 hover:bg-green-700" : "bg-gray-900 hover:bg-black"}`}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : full ? <Gift className="w-4 h-4" /> : <Stamp className="w-4 h-4" />}
                  {full ? "Get my reward" : "Add a stamp"}
                </button>
                <p className="text-xs text-gray-500 text-center">{full ? "The waiter confirms it, then your card starts again." : "A waiter confirms every stamp, so ask when you order or pay."}</p>
              </>
            )}

            <div className="flex items-center justify-between text-xs">
              <button type="button" onClick={useAnother} className="text-gray-500 underline">Not you? Use another email or phone</button>
              {!pending && (
                <button type="button" onClick={() => lookup(contact)} className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-800">
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
