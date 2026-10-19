"use client";

// Room service > Orders: what guests sent, newest first. Staff move each order one step on, or cancel it with a reason the guest sees.

import { useState } from "react";
import { BedDouble, HandPlatter, Clock, Loader2, X, ChevronRight, StickyNote } from "lucide-react";
import { Stars } from "@/components/room-service/feedback-tab";
import { KINDS, nextStatus, statusLabel, type OrderStatus, type RoomOrder, type ServiceKind } from "@/lib/room-service-types";

const card = "bg-white rounded-2xl border border-gray-100 shadow-sm";
const PILL: Record<OrderStatus, string> = {
  new: "bg-red-100 text-red-700", accepted: "bg-blue-100 text-blue-700", preparing: "bg-amber-100 text-amber-800",
  "on-the-way": "bg-indigo-100 text-indigo-700", delivered: "bg-green-100 text-green-700", cancelled: "bg-gray-100 text-gray-600",
};
const ACTION: Partial<Record<OrderStatus, string>> = { accepted: "Accept", preparing: "Start preparing", "on-the-way": "On the way", delivered: "Delivered" };
type Filter = "open" | "done" | "all";
const open = (o: RoomOrder) => o.status !== "delivered" && o.status !== "cancelled";

function ago(iso: string, now: number) {
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const d = new Date(iso);
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return new Date(now).toDateString() === d.toDateString() ? time : `${d.toLocaleDateString([], { day: "numeric", month: "short" })}, ${time}`;
}
const money = (n: number, cur: string) => `${n.toFixed(2)} ${cur}`;

export function OrdersTab({ orders, currency, days, setDays, setStatus, now, kind = "room" }: {
  kind?: ServiceKind;
  orders: RoomOrder[]; currency: string; days: number; setDays: (d: number) => void;
  setStatus: (o: RoomOrder, to: OrderStatus, reason?: string) => Promise<boolean>; now: number;
}) {
  const K = KINDS[kind];
  const Icon = kind === "table" ? HandPlatter : BedDouble;
  const [filter, setFilter] = useState<Filter>("open");
  const [busy, setBusy] = useState<string | null>(null);
  const [cancel, setCancel] = useState<{ id: string; reason: string } | null>(null);
  const [q, setQ] = useState("");

  const counts = { open: orders.filter(open).length, done: orders.filter((o) => !open(o)).length, all: orders.length };
  const list = orders
    .filter((o) => (filter === "open" ? open(o) : filter === "done" ? !open(o) : true))
    .filter((o) => !q.trim() || `${o.room} ${o.guestName} #${o.number}`.toLowerCase().includes(q.trim().toLowerCase()));
  // Open orders: oldest first, so the one waiting longest is on top
  if (filter === "open") list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  async function move(o: RoomOrder, to: OrderStatus, reason?: string) {
    setBusy(o.id);
    const ok = await setStatus(o, to, reason);
    setBusy(null);
    if (ok) setCancel(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl bg-gray-100 p-1 gap-1" role="tablist" aria-label="Which orders">
          {([["open", "Open"], ["done", "Done"], ["all", "All"]] as [Filter, string][]).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={filter === k} onClick={() => setFilter(k)} data-filter={k}
              className={`text-sm font-semibold rounded-lg px-3 py-1.5 ${filter === k ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-800"}`}>
              {l} <span className="text-gray-400 font-medium">{counts[k]}</span>
            </button>
          ))}
        </div>
        <label className="sr-only" htmlFor="rs-days">Time</label>
        <select id="rs-days" value={days} onChange={(e) => setDays(Number(e.target.value))} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
          <option value={1}>Today and yesterday</option><option value={3}>Last 3 days</option><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option>
        </select>
        <label className="sr-only" htmlFor="rs-q">Find</label>
        <input id="rs-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`${K.Unit}, name or #`} className="flex-1 min-w-[10rem] sm:max-w-xs text-sm border border-gray-200 rounded-xl px-3 py-2" />
      </div>

      {list.length === 0 ? (
        <div className={`${card} p-8 text-center text-sm text-gray-500`}>
          <Icon className="w-8 h-8 text-gray-300 mx-auto mb-2" aria-hidden />
          {filter === "open" ? "No open orders. New ones show up here by themselves, and you get a notification." : "No orders in this time."}
        </div>
      ) : (
        <ul className="space-y-3" data-orders>
          {list.map((o) => {
            const next = nextStatus(o.status);
            return (
              <li key={o.id} className={`${card} p-4 space-y-3 ${o.status === "new" ? "ring-2 ring-red-200" : ""}`} data-order={o.number} data-status={o.status}>
                <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-gray-400">#{o.number}</span>
                      <span className="text-base font-bold text-gray-900">{o.room}</span>
                      {o.guestName && <span className="text-sm text-gray-600">{o.guestName}</span>}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><Clock className="w-3.5 h-3.5" aria-hidden /> {ago(o.createdAt, now)}</div>
                  </div>
                  <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${PILL[o.status]}`}>{statusLabel(kind, o.status)}</span>
                </div>
                {o.items.length > 0 && (
                  <ul className="text-sm divide-y divide-gray-100 border border-gray-100 rounded-xl">
                    {o.items.map((it, i) => (
                      <li key={i} className="px-3 py-2 flex gap-2">
                        <span className="font-bold text-gray-900 w-7 shrink-0">{it.qty}×</span>
                        <span className="flex-1 min-w-0">
                          <span className="text-gray-900">{it.name}</span>
                          {it.note && <span className="block text-xs text-amber-800">Note: {it.note}</span>}
                        </span>
                        {it.price !== null && <span className="text-gray-500 shrink-0">{money(it.price * it.qty, currency)}</span>}
                      </li>
                    ))}
                    {o.total !== null && <li className="px-3 py-2 flex justify-between font-semibold text-gray-900"><span>Total</span><span>{money(o.total, currency)}</span></li>}
                  </ul>
                )}
                {o.text && (
                  <p className="text-sm text-gray-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 whitespace-pre-wrap flex gap-2">
                    <StickyNote className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden /><span className="min-w-0 break-words">{o.text}</span>
                  </p>
                )}
                {o.feedback && (
                  <p className="text-sm flex flex-wrap items-center gap-2" data-order-feedback><Stars n={o.feedback.rating} /> <span className="text-gray-700 min-w-0 break-words">{o.feedback.comment || "Rated the food"}</span></p>
                )}
                {o.status === "cancelled" && o.reason && <p className="text-sm text-gray-600">Reason: {o.reason}</p>}
                {open(o) && (cancel?.id === o.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="sr-only" htmlFor={`why-${o.id}`}>Why (the guest sees it)</label>
                    <input id={`why-${o.id}`} autoFocus value={cancel.reason} maxLength={200} onChange={(e) => setCancel({ id: o.id, reason: e.target.value })}
                      placeholder="Why? The guest sees it. For example: The kitchen is closed" className="flex-1 min-w-[12rem] text-sm border border-gray-200 rounded-xl px-3 py-2" />
                    <button type="button" disabled={busy === o.id} onClick={() => move(o, "cancelled", cancel.reason)} className="text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl px-3.5 py-2 disabled:opacity-50" data-go="cancel-yes">Cancel the order</button>
                    <button type="button" onClick={() => setCancel(null)} className="text-sm font-semibold text-gray-600 px-2 py-2">Back</button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    {next && (
                      <button type="button" disabled={busy === o.id} onClick={() => move(o, next)} data-go="next"
                        className="inline-flex items-center gap-1 text-sm font-semibold text-white bg-gray-900 hover:bg-black rounded-xl px-4 py-2 disabled:opacity-50">
                        {busy === o.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />} {next === "delivered" ? statusLabel(kind, next) : ACTION[next]}
                      </button>
                    )}
                    <button type="button" onClick={() => setCancel({ id: o.id, reason: "" })} className="inline-flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-red-700 rounded-xl px-3 py-2" data-go="cancel"><X className="w-4 h-4" /> Cancel</button>
                  </div>
                ))}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
