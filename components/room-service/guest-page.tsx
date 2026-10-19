"use client";

// The page a guest sees after scanning a room service or table ordering QR code: the steps, the order form (writing and / or dishes),
// and then the live status of their order. No account: the phone keeps the order's secret key.

import { useCallback, useEffect, useMemo, useState } from "react";
import { BedDouble, Check, Loader2, Minus, Plus, Search, StickyNote, ChevronLeft, X, Star, BookOpen, HandPlatter } from "lucide-react";
import { KINDS, STATUS_FLOW, roomTitle, statusLabel, type ServiceKind, type OrderFeedback, type OrderItem, type OrderMode, type OrderStatus } from "@/lib/room-service-types";

interface Dish { id: string; name: string; section: string; price: number | null }
interface Info {
  enabled: boolean; name: string; mode?: OrderMode; steps?: string[]; welcome?: string; askName?: boolean;
  room?: { id: string; name: string } | null; roomUnknown?: boolean; prefix?: string; dishes?: Dish[]; currency?: string; menuUrl?: string | null;
}
interface GuestOrder {
  number: number; room: string; guestName: string; text: string; items: OrderItem[]; total: number | null;
  status: OrderStatus; statusLabel: string; statusText: string; reason: string; createdAt: string;
  feedback: OrderFeedback | null; canRate: boolean;
}
interface Saved { id: string; t: string; at: number }

const STEP_NAME: Record<string, string> = { new: "Sent", accepted: "Accepted", preparing: "Preparing", "on-the-way": "On the way" };
const money = (n: number, cur: string) => `${n.toFixed(2)} ${cur}`;
const key = (slug: string) => `skano.${slug}`;
function readSaved(slug: string): Saved[] {
  try { const v = JSON.parse(localStorage.getItem(key(slug)) || "[]"); return Array.isArray(v) ? v.filter((x) => x && typeof x.id === "string" && typeof x.t === "string") : []; } catch { return []; }
}
function writeSaved(slug: string, list: Saved[]) {
  try { localStorage.setItem(key(slug), JSON.stringify(list.slice(0, 10))); } catch { /* private mode: the page still works */ }
}

function StarPick({ value, onChange, label, size = "w-9 h-9" }: { value: number; onChange: (n: number) => void; label: string; size?: string }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} ${n === 1 ? "star" : "stars"}`} onClick={() => onChange(value === n ? 0 : n)} data-star={n}>
          <Star className={`${size} ${n <= value ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} aria-hidden />
        </button>
      ))}
    </div>
  );
}
const WORDS = ["", "Bad", "Not good", "Okay", "Good", "Excellent"];

/** After delivery: stars for the whole order, optional stars for each dish, and a comment */
function RateFood({ order, api, saved, onDone }: { order: GuestOrder; api: string; saved: Saved; onDone: (f: OrderFeedback) => void }) {
  const [rating, setRating] = useState(0);
  const [dish, setDish] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const dishes = order.items.filter((it, i, all) => all.findIndex((x) => x.dishId === it.dishId) === i);
  async function send() {
    if (!rating) { setErr("Pick 1 to 5 stars for your order."); return; }
    setBusy(true); setErr("");
    const res = await fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      action: "feedback", order: saved.id, t: saved.t, rating, comment, items: Object.entries(dish).filter(([, n]) => n > 0).map(([dishId, n]) => ({ dishId, rating: n })),
    }) }).catch(() => null);
    const d = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) { setErr(d?.error || "Could not send. Please try again."); return; }
    onDone(d.feedback);
  }
  return (
    <section className="bg-white rounded-2xl border border-amber-200 shadow-sm p-5 space-y-4" aria-label="Rate your food" data-rate>
      <div>
        <h2 className="font-bold text-gray-900">How was your food?</h2>
        <p className="text-sm text-gray-600 mt-0.5">It takes a few seconds and helps the kitchen.</p>
      </div>
      <div className="space-y-1">
        <StarPick value={rating} onChange={(n) => { setRating(n); setErr(""); }} label="Stars for your order" />
        <p className="text-sm font-semibold text-gray-700 h-5">{WORDS[rating]}</p>
      </div>
      {dishes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500">Each dish (optional)</p>
          <ul className="divide-y divide-gray-100 border border-gray-100 rounded-xl">
            {dishes.map((it) => (
              <li key={it.dishId} className="flex items-center gap-2 px-3 py-2" data-rate-dish={it.name}>
                <span className="flex-1 min-w-0 text-sm text-gray-900">{it.name}</span>
                <StarPick value={dish[it.dishId] ?? 0} onChange={(n) => setDish((x) => ({ ...x, [it.dishId]: n }))} label={`Stars for ${it.name}`} size="w-6 h-6" />
              </li>
            ))}
          </ul>
        </div>
      )}
      <label className="block">
        <span className="block text-xs font-semibold text-gray-500 mb-1">Anything to tell the kitchen? (optional)</span>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} rows={3} id="rate-comment" placeholder="For example: The pizza was cold" className="w-full text-base border border-gray-200 rounded-xl px-3 py-2.5 resize-y" />
      </label>
      {err && <p className="text-sm text-red-700" role="alert">{err}</p>}
      <button type="button" disabled={busy} onClick={send} data-go="send-rating" className="w-full inline-flex items-center justify-center gap-2 text-base font-semibold text-white bg-gray-900 rounded-xl px-4 py-3 disabled:opacity-60">
        {busy && <Loader2 className="w-5 h-5 animate-spin" />} Send
      </button>
    </section>
  );
}

function Status({ order, currency, onBack, api, saved, onRated, kind }: { order: GuestOrder; currency: string; onBack: () => void; api: string; saved: Saved; onRated: (f: OrderFeedback) => void; kind: ServiceKind }) {
  const at = STATUS_FLOW.indexOf(order.status);
  const done = order.status === "delivered" || order.status === "cancelled";
  return (
    <div className="space-y-4" data-guest-status={order.status}>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-gray-500">Order #{order.number} · {order.room}</p>
            <h2 className="text-lg font-bold text-gray-900 mt-0.5">{order.statusText}</h2>
          </div>
          {!done && <Loader2 className="w-5 h-5 text-blue-600 animate-spin shrink-0" aria-label="Waiting for the next step" />}
        </div>
        {order.status === "cancelled" ? (
          <p className="text-sm rounded-xl bg-red-50 text-red-800 px-3 py-2">{order.reason ? `Reason: ${order.reason}` : KINDS[kind].help}</p>
        ) : (
          <ol className="grid grid-cols-5 gap-1" aria-label="Steps of your order">
            {STATUS_FLOW.map((s, i) => (
              <li key={s} className="flex flex-col items-center gap-1 text-center">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i <= at ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-400"}`} aria-hidden>{i < at || order.status === "delivered" ? <Check className="w-4 h-4" /> : i + 1}</span>
                <span className={`text-[11px] leading-tight ${i <= at ? "text-gray-900 font-semibold" : "text-gray-400"}`}>{STEP_NAME[s] ?? statusLabel(kind, s)}</span>
              </li>
            ))}
          </ol>
        )}
        {(order.items.length > 0 || order.text) && (
          <div className="border-t border-gray-100 pt-3 space-y-2 text-sm">
            {order.items.map((it, i) => (
              <div key={i} className="flex gap-2"><span className="font-bold w-7 shrink-0">{it.qty}×</span><span className="flex-1 min-w-0">{it.name}{it.note && <span className="block text-xs text-gray-500">{it.note}</span>}</span>{it.price !== null && <span className="text-gray-500">{money(it.price * it.qty, currency)}</span>}</div>
            ))}
            {order.total !== null && <div className="flex justify-between font-semibold border-t border-gray-100 pt-2"><span>Total</span><span>{money(order.total, currency)}</span></div>}
            {order.text && <p className="text-gray-700 whitespace-pre-wrap break-words bg-gray-50 rounded-xl px-3 py-2">{order.text}</p>}
          </div>
        )}
      </div>
      {order.canRate && <RateFood order={order} api={api} saved={saved} onDone={onRated} />}
      {order.feedback && (
        <p className="text-sm text-center text-gray-700 bg-white rounded-2xl border border-gray-100 px-4 py-3 flex items-center justify-center gap-2" data-rated>
          <span className="inline-flex">{[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`w-4 h-4 ${n <= order.feedback!.rating ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} aria-hidden />)}</span>
          Thank you for your feedback!
        </p>
      )}
      {!done && <p className="text-xs text-center text-gray-500">This page updates by itself. You can close it and scan the code again later.</p>}
      <button type="button" onClick={onBack} className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl px-4 py-3" data-go="order-more">
        <ChevronLeft className="w-4 h-4" /> Order something else
      </button>
    </div>
  );
}

export function RoomGuestPage({ slug, roomId, kind = "room" }: { slug: string; roomId: string | null; kind?: ServiceKind }) {
  const K = KINDS[kind];
  // Orders sent from this phone: "skano.room.<slug>" and "skano.table.<slug>"
  const store = `${kind}.${slug}`;
  const [info, setInfo] = useState<Info | null>(null);
  const [failed, setFailed] = useState("");
  const [room, setRoom] = useState("");
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [cart, setCart] = useState<Record<string, { qty: number; note: string }>>({});
  const [noteOpen, setNoteOpen] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [view, setView] = useState<Saved | null>(null);
  const [order, setOrder] = useState<GuestOrder | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  // While the menu is open it covers the whole screen: the page behind doesn't scroll
  useEffect(() => {
    if (!menuOpen) return;
    const html = document.documentElement, old = html.style.overflow;
    html.style.overflow = "hidden";
    return () => { html.style.overflow = old; };
  }, [menuOpen]);
  const [mine, setMine] = useState<(GuestOrder & { saved: Saved })[]>([]);
  const api = `/api/restaurants/${encodeURIComponent(slug)}/${K.api}`;

  useEffect(() => {
    void fetch(`${api}${roomId ? `?room=${encodeURIComponent(roomId)}` : ""}`).then(async (r) => {
      const d = await r.json().catch(() => null);
      if (!r.ok || !d) { setFailed(r.status === 404 ? "This QR code is not valid." : "Could not load. Please try again."); return; }
      setInfo(d);
    }).catch(() => setFailed("No connection. Please try again."));
  }, [api, roomId]);

  // Orders sent from this phone in the last day, to see them again
  const loadMine = useCallback(async () => {
    const list = readSaved(store).filter((s) => Date.now() - s.at < 86400000);
    const out: (GuestOrder & { saved: Saved })[] = [];
    for (const s of list) {
      const d = await fetch(`${api}?order=${s.id}&t=${s.t}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (d?.order) out.push({ ...d.order, saved: s });
    }
    setMine(out);
  }, [api, store]);
  useEffect(() => { void Promise.resolve().then(loadMine); }, [loadMine]);

  // The order being followed: ask again every 10 seconds until it's delivered or cancelled
  useEffect(() => {
    if (!view) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const d = await fetch(`${api}?order=${view.id}&t=${view.t}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (stop) return;
      if (d?.order) setOrder(d.order);
      if (!d?.order || (d.order.status !== "delivered" && d.order.status !== "cancelled")) timer = setTimeout(tick, 10000);
    };
    void tick();
    return () => { stop = true; clearTimeout(timer); };
  }, [view, api]);

  const dishes = useMemo(() => info?.dishes ?? [], [info]);
  const sections = useMemo(() => {
    const t = q.trim().toLowerCase();
    const map = new Map<string, Dish[]>();
    for (const d of dishes) if (!t || d.name.toLowerCase().includes(t) || d.section.toLowerCase().includes(t)) map.set(d.section, [...(map.get(d.section) ?? []), d]);
    return [...map.entries()];
  }, [dishes, q]);
  const cur = info?.currency ?? "€";
  const picked = Object.entries(cart).filter(([, v]) => v.qty > 0);
  const count = picked.reduce((n, [, v]) => n + v.qty, 0);
  const total = picked.every(([id]) => dishes.find((d) => d.id === id)?.price !== null)
    ? picked.reduce((n, [id, v]) => n + (dishes.find((d) => d.id === id)?.price ?? 0) * v.qty, 0) : null;
  const setQty = (id: string, d: number) => setCart((c) => {
    const qty = Math.max(0, Math.min(20, (c[id]?.qty ?? 0) + d));
    return { ...c, [id]: { qty, note: c[id]?.note ?? "" } };
  });

  async function submit() {
    if (!info) return;
    setSendError("");
    if (!info.room && !room.trim()) { setSendError(K.askError); return; }
    if (info.askName && !name.trim()) { setSendError("Write your name and surname."); return; }
    if (!count && !text.trim()) { setSendError(info.mode === "menu" ? "Pick at least one dish." : "Write what you'd like, or pick a dish."); return; }
    setSending(true);
    const res = await fetch(api, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: info.room?.id ?? null, room: room.trim(), guestName: name.trim(), text: text.trim(), items: picked.map(([dishId, v]) => ({ dishId, qty: v.qty, note: v.note })) }),
    }).catch(() => null);
    const d = await res?.json().catch(() => null);
    setSending(false);
    if (!res?.ok) { setSendError(d?.error || "Could not send. Please try again."); return; }
    const s: Saved = { id: d.id, t: d.token, at: new Date().getTime() };
    writeSaved(store, [s, ...readSaved(store)]);
    setCart({}); setText(""); setOrder(null); setView(s);
    window.scrollTo({ top: 0 });
  }

  const shell = (body: React.ReactNode) => (
    <main className="min-h-dvh bg-gray-50 text-gray-900">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-5 pb-32">
        <header className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">{kind === "table" ? <HandPlatter className="w-5 h-5" aria-hidden /> : <BedDouble className="w-5 h-5" aria-hidden />}</span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-500">{K.title}</p>
            <h1 className="text-lg font-bold truncate">{info?.name ?? " "}</h1>
          </div>
        </header>
        {body}
      </div>
    </main>
  );

  if (failed) return shell(<p className="rounded-2xl bg-white border border-gray-100 p-5 text-sm text-gray-700" role="alert">{failed}</p>);
  if (!info) return shell(<div className="flex items-center gap-2 text-gray-500 text-sm"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>);
  if (view) return shell(order ? <Status kind={kind} order={order} currency={cur} api={api} saved={view} onRated={(f) => setOrder({ ...order, feedback: f, canRate: false })} onBack={() => { setView(null); void loadMine(); }} /> : <div className="flex items-center gap-2 text-gray-500 text-sm"><Loader2 className="w-5 h-5 animate-spin" /> Sending…</div>);
  if (!info.enabled) return shell(<p className="rounded-2xl bg-white border border-gray-100 p-5 text-sm text-gray-700" data-closed>{K.closed}</p>);

  // Orders still on the way, and delivered ones the guest can still rate
  const open = mine.filter((o) => (o.status !== "delivered" && o.status !== "cancelled") || o.canRate);
  return shell(
    <>
      {open.length > 0 && (
        <section className="space-y-2" aria-label="Your orders">
          {open.map((o) => (
            <button key={o.saved.id} type="button" onClick={() => { setOrder(o); setView(o.saved); }} className="w-full text-left bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 flex items-center gap-3" data-my-order>
              {o.canRate ? <Star className="w-4 h-4 text-amber-500 fill-amber-400 shrink-0" aria-hidden /> : <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" aria-hidden />}
              <span className="flex-1 min-w-0 text-sm"><span className="font-semibold">Order #{o.number}: {o.statusLabel}</span><span className="block text-xs text-gray-600">{o.canRate ? "Tap to rate your food" : "Tap to follow it"}</span></span>
            </button>
          ))}
        </section>
      )}

      {(info.welcome || (info.steps?.length ?? 0) > 0) && (
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3" aria-label="How to order" data-guest-steps>
          {info.welcome && <p className="text-sm font-semibold text-gray-900">{info.welcome}</p>}
          {(info.steps?.length ?? 0) > 0 && (
            <ol className="space-y-2.5">
              {info.steps!.map((s, i) => (
                <li key={i} className="flex gap-3 text-sm text-gray-700">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0" aria-hidden>{i + 1}</span>
                  <span className="pt-0.5">{s}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3" aria-label="Who is ordering">
        {info.room ? (
          <div className="flex items-center gap-2 text-sm" data-room-locked><span className="text-gray-500">{K.locked}</span><span className="font-bold text-gray-900">{roomTitle(info.prefix ?? "", info.room.name)}</span></div>
        ) : (
          <label className="block">
            <span className="block text-sm font-semibold text-gray-800 mb-1">{K.askLabel}</span>
            {info.roomUnknown && <span className="block text-xs text-amber-800 mb-1">We couldn&apos;t find the {K.unit} of this code. Please write it.</span>}
            <input value={room} onChange={(e) => setRoom(e.target.value)} maxLength={80} autoComplete="off" placeholder={K.askPlaceholder} id="guest-room" className="w-full text-base border border-gray-200 rounded-xl px-3 py-3" />
          </label>
        )}
        {info.askName && (
          <label className="block">
            <span className="block text-sm font-semibold text-gray-800 mb-1">Your name and surname</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" id="guest-name" className="w-full text-base border border-gray-200 rounded-xl px-3 py-3" />
          </label>
        )}
      </section>

      {info.menuUrl && (
        <button type="button" onClick={() => setMenuOpen(true)} data-go="see-menu"
          className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 text-left hover:border-blue-200">
          <span className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><BookOpen className="w-5 h-5" aria-hidden /></span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-semibold text-gray-900">See the menu</span>
            <span className="block text-xs text-gray-600">{info.mode === "text" ? "Look at the menu, then write what you'd like below." : "Look at the full menu, then pick your dishes below."}</span>
          </span>
          <ChevronLeft className="w-4 h-4 text-gray-400 rotate-180" aria-hidden />
        </button>
      )}
      {menuOpen && info.menuUrl && (
        <div className="fixed inset-0 z-[100] h-dvh bg-white flex flex-col" role="dialog" aria-modal="true" aria-label="The menu" data-menu-sheet>
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-200 bg-white">
            <button type="button" onClick={() => setMenuOpen(false)} className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 rounded-xl px-2 py-2" data-go="close-menu"><ChevronLeft className="w-4 h-4" /> Back to my order</button>
            <span className="ml-auto text-sm font-semibold text-gray-900 truncate">{info.name}</span>
          </div>
          <iframe src={info.menuUrl} title={`The menu of ${info.name}`} className="flex-1 min-h-0 w-full border-0 block" />
        </div>
      )}

      {info.mode !== "text" && dishes.length > 0 && (
        <section className="space-y-3" aria-label="Menu" data-guest-menu>
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden />
            <label className="sr-only" htmlFor="guest-q">Find a dish</label>
            <input id="guest-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a dish" className="w-full text-base bg-white border border-gray-200 rounded-xl pl-9 pr-3 py-2.5" />
          </div>
          {sections.length === 0 && <p className="text-sm text-gray-500 px-1">No dish with that name.</p>}
          {sections.map(([sec, list]) => (
            <div key={sec} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500 px-4 pt-3 pb-1">{sec}</h2>
              <ul className="divide-y divide-gray-100">
                {list.map((d) => {
                  const c = cart[d.id];
                  return (
                    <li key={d.id} className="px-4 py-3 space-y-2" data-dish={d.name}>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-gray-900">{d.name}</div>
                          {d.price !== null && <div className="text-xs text-gray-500">{money(d.price, cur)}</div>}
                        </div>
                        {c?.qty ? (
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => setQty(d.id, -1)} aria-label={`One less ${d.name}`} className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center"><Minus className="w-4 h-4" /></button>
                            <span className="w-6 text-center font-bold" aria-live="polite">{c.qty}</span>
                            <button type="button" onClick={() => setQty(d.id, 1)} aria-label={`One more ${d.name}`} className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center"><Plus className="w-4 h-4" /></button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => setQty(d.id, 1)} aria-label={`Add ${d.name}`} className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 border border-blue-200 rounded-full px-3 py-1.5" data-go="add-dish"><Plus className="w-4 h-4" /> Add</button>
                        )}
                      </div>
                      {c?.qty ? (noteOpen === d.id || c.note ? (
                        <div className="flex items-center gap-2">
                          <label className="sr-only" htmlFor={`note-${d.id}`}>Note for {d.name}</label>
                          <input id={`note-${d.id}`} value={c.note} maxLength={120} autoFocus={noteOpen === d.id} onChange={(e) => setCart((x) => ({ ...x, [d.id]: { ...x[d.id], note: e.target.value } }))} placeholder="For example: no onions" className="flex-1 min-w-0 text-sm border border-gray-200 rounded-lg px-2.5 py-1.5" />
                          <button type="button" aria-label="Remove the note" onClick={() => { setCart((x) => ({ ...x, [d.id]: { ...x[d.id], note: "" } })); setNoteOpen(null); }} className="p-1 text-gray-400"><X className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setNoteOpen(d.id)} className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500"><StickyNote className="w-3.5 h-3.5" /> Add a note</button>
                      )) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      )}

      {info.mode !== "menu" && (
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5" aria-label="Write your order">
          <label className="block">
            <span className="block text-sm font-semibold text-gray-800 mb-1">{info.mode === "both" && dishes.length ? "Anything else? (optional)" : "What would you like?"}</span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} rows={4} id="guest-text"
              placeholder={info.mode === "both" && dishes.length ? "For example: extra napkins, please." : "For example: Two cappuccinos and a club sandwich, please."}
              className="w-full text-base border border-gray-200 rounded-xl px-3 py-3 resize-y" />
          </label>
        </section>
      )}

      <div className={`fixed inset-x-0 bottom-0 z-40 bg-white/95 backdrop-blur border-t border-gray-200 ${menuOpen ? "hidden" : ""}`} data-send-bar>
        <div className="max-w-lg mx-auto px-4 py-3 space-y-2">
          {sendError && <p className="text-sm text-red-700" role="alert">{sendError}</p>}
          <button type="button" disabled={sending} onClick={submit} data-go="send-order"
            className="w-full inline-flex items-center justify-center gap-2 text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl px-4 py-3.5 disabled:opacity-60">
            {sending && <Loader2 className="w-5 h-5 animate-spin" />}
            Send the order{count > 0 && ` · ${count} ${count === 1 ? "dish" : "dishes"}`}{count > 0 && total !== null && ` · ${money(total, cur)}`}
          </button>
        </div>
      </div>
    </>
  );
}
