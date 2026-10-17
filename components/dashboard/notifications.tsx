"use client";

// Notifications in the dashboard (reservation reminders). Checks every minute.
// A new one opens its window right away: call the customer, then Confirmed / No answer / Cancel the reservation.

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Phone, Mail, Users, Check, X, Loader2, PhoneOff, CalendarX, Clock, Armchair, BellRing } from "lucide-react";
import toast from "react-hot-toast";

interface Note {
  id: string; kind: "staff" | "info"; text: string; at: string;
  reservation: {
    id: string; status: string; startAt: string; endAt: string; guests: number; name: string; phone: string; email: string; note: string;
    table: string | null; call: { result: "confirmed" | "no-answer"; at: string; by: string | null; note: string } | null; cancelledBy: string | null;
  };
}

const fDay = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" });
const fTime = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });
const fShort = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const OPENED_KEY = "skano.notifications.opened";

function readOpened(): string[] {
  try { const v = JSON.parse(localStorage.getItem(OPENED_KEY) ?? "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}
function markOpened(id: string) {
  try { localStorage.setItem(OPENED_KEY, JSON.stringify([...readOpened().filter((x) => x !== id), id].slice(-200))); } catch { /* private window */ }
}

export function NotificationBell({ restaurantId }: { restaurantId: string }) {
  const [list, setList] = useState<Note[]>([]);
  const [menu, setMenu] = useState(false);
  const [open, setOpen] = useState<Note | null>(null);
  const openRef = useRef<Note | null>(null);
  useEffect(() => { openRef.current = open; }, [open]);

  const load = useCallback(async () => {
    const d = await fetch(`/api/restaurants/${restaurantId}/notifications`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (!d) return;
    const items: Note[] = d.notifications ?? [];
    setList(items);
    // A new one: open its window (once per notification in this browser)
    if (!openRef.current) {
      const seen = readOpened();
      const fresh = items.find((n) => !seen.includes(n.id));
      if (fresh) { markOpened(fresh.id); setOpen(fresh); }
    }
  }, [restaurantId]);

  useEffect(() => {
    void Promise.resolve().then(load);
    const t = setInterval(() => void load(), 60_000);
    const focus = () => void load();
    window.addEventListener("focus", focus);
    return () => { clearInterval(t); window.removeEventListener("focus", focus); };
  }, [load]);

  return (
    <div className="relative">
      <button type="button" onClick={() => setMenu((v) => !v)} aria-label={`Notifications${list.length ? ` (${list.length})` : ""}`} id="notifications"
        className="relative p-2 rounded-xl text-gray-500 hover:text-gray-800 hover:bg-gray-100">
        <Bell className="w-5 h-5" />
        {list.length > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center" data-count>{list.length}</span>}
      </button>
      {menu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
          <div className="absolute right-0 mt-2 z-50 w-[min(22rem,calc(100vw-2rem))] bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden" data-notification-list>
            <div className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-900">Notifications</div>
            {!list.length ? (
              <p className="px-4 py-6 text-sm text-gray-500 text-center">Nothing new. Reservation reminders show up here.</p>
            ) : (
              <ul className="max-h-96 overflow-y-auto divide-y divide-gray-50">
                {list.map((n) => (
                  <li key={n.id}>
                    <button type="button" onClick={() => { setMenu(false); markOpened(n.id); setOpen(n); }} className="w-full text-left px-4 py-3 hover:bg-gray-50 flex gap-3" data-notification={n.reservation.name}>
                      <span className={`mt-0.5 w-8 h-8 shrink-0 rounded-full flex items-center justify-center ${n.kind === "info" ? "bg-gray-100 text-gray-600" : "bg-amber-100 text-amber-700"}`}>
                        {n.kind === "info" ? <CalendarX className="w-4 h-4" /> : <BellRing className="w-4 h-4" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm text-gray-900 leading-snug">{n.text}</span>
                        <span className="block text-[11px] text-gray-400 mt-0.5">{fShort.format(new Date(n.at))}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
      {open && <CallDialog n={open} restaurantId={restaurantId} onClose={() => setOpen(null)} onDone={() => { setOpen(null); void load(); }} />}
    </div>
  );
}

/** The window of one notification: the reservation, call, and what the customer said */
function CallDialog({ n, restaurantId, onClose, onDone }: { n: Note; restaurantId: string; onClose: () => void; onDone: () => void }) {
  const r = n.reservation;
  const [note, setNote] = useState("");
  const [again, setAgain] = useState(60);
  const [cancelling, setCancelling] = useState(false);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const happens = r.status === "accepted" && Date.parse(r.startAt) > now;

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [busy, onClose]);

  async function send(action: "confirmed" | "no-answer" | "cancel" | "close") {
    setBusy(action);
    const body = { id: n.id, action, note, ...(action === "no-answer" && again ? { againMin: again } : {}), ...(action === "cancel" ? { message, email } : {}) };
    const res = await fetch(`/api/restaurants/${restaurantId}/notifications`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const d = await res?.json().catch(() => null);
    setBusy(null);
    if (!res?.ok) { toast.error(d?.error ?? "Could not save"); return; }
    if (action === "confirmed") toast.success(`${r.name}'s reservation is confirmed`);
    if (action === "no-answer") toast(again ? `Saved. You'll be reminded again in ${again < 60 ? `${again} minutes` : `${again / 60} hour${again === 60 ? "" : "s"}`}` : "Saved as no answer", { icon: "📞" });
    if (action === "cancel") {
      if (d.emailSent === false) toast(`Cancelled. No email was sent (${d.emailError ?? "email isn't set up"})`, { icon: "⚠️", duration: 7000 });
      else toast.success(d.emailSent ? `Cancelled. Email sent to ${r.email}` : "Cancelled");
    }
    onDone();
  }

  const btn = "inline-flex items-center justify-center gap-1.5 text-sm font-semibold rounded-xl px-3.5 py-2.5 disabled:opacity-50";
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 sm:p-4" onClick={() => !busy && onClose()} role="dialog" aria-modal="true" aria-label="Reservation reminder" data-call-dialog>
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <span className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center ${n.kind === "info" ? "bg-gray-100 text-gray-600" : "bg-amber-100 text-amber-700"}`}>
              {n.kind === "info" ? <CalendarX className="w-5 h-5" /> : <BellRing className="w-5 h-5" />}
            </span>
            <p className="flex-1 text-[15px] font-semibold text-gray-900 leading-snug" data-text>{n.text}</p>
            <button type="button" onClick={onClose} disabled={!!busy} aria-label="Close" className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"><X className="w-5 h-5" /></button>
          </div>

          <div className="rounded-2xl bg-gray-50 px-4 py-3 space-y-1.5 text-sm text-gray-700">
            <div className="font-semibold text-gray-900">{r.name}</div>
            <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-gray-400" /> {fDay.format(new Date(r.startAt))}, {fTime.format(new Date(r.startAt))}</div>
            <div className="flex items-center gap-4 flex-wrap">
              <span className="inline-flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-gray-400" /> {r.guests} person{r.guests === 1 ? "" : "s"}</span>
              <span className="inline-flex items-center gap-1.5"><Armchair className="w-3.5 h-3.5 text-gray-400" /> {r.table ? `Table ${r.table}` : "No table yet"}</span>
            </div>
            <a href={`mailto:${r.email}`} className="flex items-center gap-1.5 text-blue-600 break-all"><Mail className="w-3.5 h-3.5" /> {r.email}</a>
            {r.note && <p className="text-gray-600">&quot;{r.note}&quot;</p>}
            {r.call && <p className="text-xs text-gray-500">Last call {fShort.format(new Date(r.call.at))}{r.call.by ? ` by ${r.call.by}` : ""}: {r.call.result === "confirmed" ? "confirmed" : "no answer"}{r.call.note ? ` ("${r.call.note}")` : ""}</p>}
          </div>

          {n.kind === "info" || !happens ? (
            <>
              {n.kind !== "info" && <p className="text-sm text-gray-600">{r.status === "cancelled" ? "This reservation was already cancelled." : r.status !== "accepted" ? `This reservation is ${r.status}.` : "The time of this reservation has passed."}</p>}
              <div className="flex justify-end">
                <button type="button" onClick={() => send("close")} disabled={!!busy} data-go="close" className={`${btn} text-white bg-gray-900 hover:bg-gray-800`}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} OK</button>
              </div>
            </>
          ) : (
            <>
              <a href={`tel:${r.phone}`} className={`${btn} w-full text-white bg-blue-600 hover:bg-blue-700 py-3 text-base`} data-call><Phone className="w-5 h-5" /> Call {r.phone}</a>
              <label className="block">
                <span className="block text-xs font-semibold text-gray-500 mb-1">Note (optional)</span>
                <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="e.g. They come 15 minutes later" data-note
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" />
              </label>

              {!cancelling ? (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-gray-500">What did they say?</div>
                  <button type="button" onClick={() => send("confirmed")} disabled={!!busy} data-go="confirmed" className={`${btn} w-full text-white bg-green-600 hover:bg-green-700`}>
                    {busy === "confirmed" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} They&apos;re coming (confirmed)
                  </button>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => send("no-answer")} disabled={!!busy} data-go="no-answer" className={`${btn} flex-1 text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100`}>
                      {busy === "no-answer" ? <Loader2 className="w-4 h-4 animate-spin" /> : <PhoneOff className="w-4 h-4" />} No answer
                    </button>
                    <select value={again} onChange={(e) => setAgain(Number(e.target.value))} aria-label="Remind me again" data-again
                      className="text-sm border border-gray-200 rounded-xl px-2 py-2 bg-white text-gray-700">
                      <option value={0}>Don&apos;t remind again</option>
                      <option value={30}>Remind again in 30 min</option>
                      <option value={60}>Remind again in 1 hour</option>
                      <option value={120}>Remind again in 2 hours</option>
                      <option value={180}>Remind again in 3 hours</option>
                    </select>
                  </div>
                  <button type="button" onClick={() => setCancelling(true)} disabled={!!busy} data-go="cancel-start" className={`${btn} w-full text-red-600 border border-red-200 hover:bg-red-50`}>
                    <CalendarX className="w-4 h-4" /> They can&apos;t come, cancel the reservation
                  </button>
                  <button type="button" onClick={onClose} disabled={!!busy} className="w-full text-sm font-medium text-gray-500 hover:text-gray-800 py-1.5">Later (it stays under the bell)</button>
                </div>
              ) : (
                <div className="space-y-3 rounded-2xl border border-red-100 bg-red-50/40 p-3">
                  <div className="text-sm font-semibold text-gray-900">Cancel {r.name}&apos;s reservation?</div>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} className="w-4 h-4" data-email /> Send them an email that it&apos;s cancelled
                  </label>
                  {email && (
                    <label className="block">
                      <span className="block text-xs font-semibold text-gray-500 mb-1">Do you want to add a message to the email? (optional)</span>
                      <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} maxLength={500} placeholder="e.g. Thanks for letting us know, see you another time!" data-message
                        className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                    </label>
                  )}
                  <div className="flex gap-2 justify-end">
                    <button type="button" onClick={() => setCancelling(false)} disabled={!!busy} className="text-sm font-semibold text-gray-600 px-3 py-2 rounded-xl hover:bg-gray-100">Back</button>
                    <button type="button" onClick={() => send("cancel")} disabled={!!busy} data-go="cancel" className={`${btn} text-white bg-red-600 hover:bg-red-700`}>
                      {busy === "cancel" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarX className="w-4 h-4" />} {email ? "Cancel and send email" : "Cancel the reservation"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
