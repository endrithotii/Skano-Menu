"use client";

// Room service / Table ordering > Feedback: what guests thought of the food, after their order was delivered.

import { useMemo, useState } from "react";
import { Star, MessageSquare, UtensilsCrossed } from "lucide-react";
import type { RoomOrder } from "@/lib/room-service-types";

const card = "bg-white rounded-2xl border border-gray-100 shadow-sm";
type Filter = "all" | "low" | "mid" | "high";

export function Stars({ n, size = "w-4 h-4" }: { n: number; size?: string }) {
  return (
    <span className="inline-flex" aria-label={`${n} of 5 stars`} role="img">
      {[1, 2, 3, 4, 5].map((i) => <Star key={i} className={`${size} ${i <= Math.round(n) ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} aria-hidden />)}
    </span>
  );
}

const day = (iso: string) => new Date(iso).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function FeedbackTab({ orders, days, setDays, on, canManage, goSettings, kind = "room" }: {
  kind?: "room" | "table";
  orders: RoomOrder[]; days: number; setDays: (d: number) => void; on: boolean; canManage: boolean; goSettings: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const doneWord = kind === "table" ? "served" : "delivered";
  const rated = useMemo(() => orders.filter((o) => o.feedback).sort((a, b) => b.feedback!.at.localeCompare(a.feedback!.at)), [orders]);
  const delivered = orders.filter((o) => o.status === "delivered").length;
  const avg = rated.length ? rated.reduce((n, o) => n + o.feedback!.rating, 0) / rated.length : 0;
  const happy = rated.length ? Math.round((rated.filter((o) => o.feedback!.rating >= 4).length / rated.length) * 100) : 0;

  // Each dish: average of its own stars
  const dishes = useMemo(() => {
    const m = new Map<string, { name: string; sum: number; count: number }>();
    for (const o of rated) for (const it of o.feedback!.items) {
      const x = m.get(it.dishId) ?? { name: it.name, sum: 0, count: 0 };
      x.sum += it.rating; x.count += 1; m.set(it.dishId, x);
    }
    return [...m.values()].map((x) => ({ ...x, avg: x.sum / x.count })).sort((a, b) => b.avg - a.avg || b.count - a.count);
  }, [rated]);

  const list = rated.filter((o) => {
    const r = o.feedback!.rating;
    return filter === "all" || (filter === "low" ? r <= 2 : filter === "mid" ? r === 3 : r >= 4);
  });

  return (
    <div className="space-y-5">
      {!on && (
        <p className="text-sm rounded-xl bg-amber-50 border border-amber-100 text-amber-900 px-3 py-2">
          Food feedback is off, so guests can&apos;t rate their orders. {canManage && <button type="button" onClick={goSettings} className="font-semibold underline">Turn it on</button>}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="fb-days">Time</label>
        <select id="fb-days" value={days} onChange={(e) => setDays(Number(e.target.value))} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
          <option value={1}>Today and yesterday</option><option value={3}>Last 3 days</option><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option>
        </select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-fb-stats>
        <div className={`${card} p-4`}><div className="text-xs font-semibold text-gray-500">Average</div><div className="text-2xl font-bold text-gray-900 mt-1">{rated.length ? avg.toFixed(1) : "–"}</div>{rated.length > 0 && <Stars n={avg} />}</div>
        <div className={`${card} p-4`}><div className="text-xs font-semibold text-gray-500">Ratings</div><div className="text-2xl font-bold text-gray-900 mt-1">{rated.length}</div><div className="text-xs text-gray-500">of {delivered} {doneWord} orders</div></div>
        <div className={`${card} p-4`}><div className="text-xs font-semibold text-gray-500">Happy guests</div><div className="text-2xl font-bold text-gray-900 mt-1">{rated.length ? `${happy}%` : "–"}</div><div className="text-xs text-gray-500">gave 4 or 5 stars</div></div>
        <div className={`${card} p-4`}><div className="text-xs font-semibold text-gray-500">Low ratings</div><div className="text-2xl font-bold text-gray-900 mt-1">{rated.filter((o) => o.feedback!.rating <= 2).length}</div><div className="text-xs text-gray-500">1 or 2 stars</div></div>
      </div>

      {dishes.length > 0 && (
        <section className={`${card} p-5 space-y-3`} aria-label="Dishes">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2"><UtensilsCrossed className="w-4 h-4 text-blue-600" aria-hidden /> Dishes, best rated first</h2>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-gray-500"><th className="font-semibold pb-1.5">Dish</th><th className="font-semibold pb-1.5">Stars</th><th className="font-semibold pb-1.5 text-right">Ratings</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {dishes.map((d) => (
                <tr key={d.name} data-fb-dish={d.name}>
                  <td className="py-2 pr-2 text-gray-900">{d.name}</td>
                  <td className="py-2 pr-2 whitespace-nowrap"><Stars n={d.avg} /> <span className="text-gray-600 ml-1">{d.avg.toFixed(1)}</span></td>
                  <td className="py-2 text-right text-gray-600">{d.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="space-y-3" aria-label="What guests wrote">
        <div className="inline-flex flex-wrap rounded-xl bg-gray-100 p-1 gap-1" role="tablist" aria-label="Which ratings">
          {([["all", "All"], ["low", "1 to 2 stars"], ["mid", "3 stars"], ["high", "4 to 5 stars"]] as [Filter, string][]).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={filter === k} onClick={() => setFilter(k)} data-fb-filter={k}
              className={`text-sm font-semibold rounded-lg px-3 py-1.5 ${filter === k ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-800"}`}>{l}</button>
          ))}
        </div>
        {list.length === 0 ? (
          <div className={`${card} p-8 text-center text-sm text-gray-500`}>
            <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" aria-hidden />
            {rated.length ? "No ratings like this in this time." : `No ratings yet. Guests can rate their food after the order is ${doneWord}.`}
          </div>
        ) : (
          <ul className="space-y-3" data-fb-list>
            {list.map((o) => (
              <li key={o.id} className={`${card} p-4 space-y-2`} data-fb-order={o.number}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Stars n={o.feedback!.rating} size="w-5 h-5" />
                  <span className="text-sm font-bold text-gray-900">{o.room}</span>
                  {o.guestName && <span className="text-sm text-gray-600">{o.guestName}</span>}
                  <span className="text-xs text-gray-500 ml-auto">#{o.number} · {day(o.feedback!.at)}</span>
                </div>
                {o.feedback!.comment && <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">&ldquo;{o.feedback!.comment}&rdquo;</p>}
                {o.feedback!.items.length > 0 && (
                  <ul className="flex flex-wrap gap-2">
                    {o.feedback!.items.map((it) => (
                      <li key={it.dishId} className="text-xs bg-gray-50 border border-gray-100 rounded-full px-2.5 py-1 inline-flex items-center gap-1.5">{it.name} <Stars n={it.rating} size="w-3 h-3" /></li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
