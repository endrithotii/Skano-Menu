"use client";

// Customer Feedback page, feedback about waiters:
//   WaiterFeedbackSettings (Settings tab): on / off, who customers can rate, waiters see their own
//   WaiterFeedbackResults  (Feedbacks tab): one time filter, charts comparing the waiters, the ranking and every feedback

import { useCallback, useEffect, useMemo, useState } from "react";
import { Star, Trash2, UserRoundCheck, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { WaiterCharts } from "@/components/dashboard/waiter-feedback-charts";

interface StaffRow { id: string; name: string; firstName: string; roles: string[]; waiterRole: boolean }
interface Item { id: string; waiterId: string; rating: number; tags: string[]; comment: string; customerName: string; createdAt: string }
export interface WaiterData { settings: { enabled: boolean; people: string[] | null; showToWaiters: boolean }; staff: StaffRow[]; rateable: string[]; feedback: Item[] }

const GOOD = new Set(["Friendly", "Fast", "Helpful", "Knew the menu", "Good advice", "Attentive"]);
const fDate = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Loads and saves the waiter feedback (shared by both tabs) */
export function useWaiterFeedback(restaurantId: string) {
  const [data, setData] = useState<WaiterData | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const d = await fetch(`/api/restaurants/${restaurantId}/waiter-feedback?scope=manage`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (d) setData(d);
  }, [restaurantId]);
  useEffect(() => { if (restaurantId) void Promise.resolve().then(load); }, [load, restaurantId]);

  async function save(change: Partial<WaiterData["settings"]>, ok?: string) {
    // Shows the change right away, the server answer follows
    setData((d) => (d ? { ...d, settings: { ...d.settings, ...change } } : d));
    setBusy(true);
    const res = await fetch(`/api/restaurants/${restaurantId}/waiter-feedback`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(change) }).catch(() => null);
    const d = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) { toast.error(d?.error ?? "Could not save"); void load(); return; }
    if (ok) toast.success(ok);
    void load();
  }
  async function remove(id: string) {
    if (!confirm("Delete this feedback? Use this for rude or wrong messages.")) return;
    const res = await fetch(`/api/restaurants/${restaurantId}/waiter-feedback`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => null);
    if (!res?.ok) { toast.error("Could not delete"); return; }
    toast.success("Deleted"); void load();
  }
  return { data, busy, save, remove, reload: load };
}

function Stars({ n }: { n: number }) {
  return <span className="inline-flex gap-0.5" aria-label={`${n.toFixed(1)} of 5 stars`}>{[1, 2, 3, 4, 5].map((i) => <Star key={i} className={`w-4 h-4 ${i <= Math.round(n) ? "fill-amber-400 text-amber-400" : "text-gray-200"}`} aria-hidden />)}</span>;
}

function Switch({ on, onClick, label, id, disabled }: { on: boolean; onClick: () => void; label: string; id: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} id={id} onClick={onClick} disabled={disabled}
      className={`relative w-14 h-8 shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? "bg-blue-600" : "bg-gray-300"}`}>
      <span className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${on ? "translate-x-6" : ""}`} />
    </button>
  );
}

export function WaiterFeedbackSettings({ wf }: { wf: ReturnType<typeof useWaiterFeedback> }) {
  const { data, busy, save } = wf;
  if (!data) return <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-sm text-gray-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>;
  const s = data.settings;
  const waiterRole = data.staff.filter((x) => x.waiterRole);
  return (
    <section className={`rounded-2xl border p-4 sm:p-5 space-y-4 ${s.enabled ? "bg-white border-gray-100 shadow-sm" : "bg-gray-50 border-gray-200"}`} aria-label="Feedback about waiters" data-waiter-panel>
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-[14rem]">
          <div className="font-semibold text-gray-900 flex items-center gap-2"><UserRoundCheck className="w-4 h-4 text-blue-600" aria-hidden /> Feedback about waiters</div>
          <p className="text-sm text-gray-500 mt-0.5">
            {s.enabled
              ? data.rateable.length ? `On. Customers find Rate your waiter under More, and can rate ${data.rateable.length} ${data.rateable.length === 1 ? "person" : "people"}.` : "On, but nobody can be rated yet. Give someone the Waiter role, or pick people below."
              : "Off. Customers can't rate waiters. Feedback you already got stays on the Feedbacks tab."}
          </p>
        </div>
        <Switch on={s.enabled} id="waiter-feedback-switch" label="Customers can rate waiters" disabled={busy} onClick={() => save({ enabled: !s.enabled }, s.enabled ? "Turned off" : "Turned on. Customers see it under More.")} />
      </div>
      {s.enabled && (
        <div className="grid gap-4 border-t border-gray-100 pt-4">
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-gray-900 mb-1">Who customers can rate</legend>
            <label className="flex items-start gap-2.5 text-sm text-gray-800 cursor-pointer">
              <input type="radio" name="wf-who" checked={s.people === null} onChange={() => save({ people: null })} className="mt-0.5 accent-blue-600" />
              <span>Everyone with the Waiter role <span className="text-gray-500">({waiterRole.length ? waiterRole.map((x) => x.name).join(", ") : "nobody yet"})</span></span>
            </label>
            <label className="flex items-start gap-2.5 text-sm text-gray-800 cursor-pointer">
              <input type="radio" name="wf-who" checked={s.people !== null} onChange={() => save({ people: waiterRole.map((x) => x.id) })} className="mt-0.5 accent-blue-600" data-go="pick-people" />
              <span>Only the staff I pick</span>
            </label>
            {s.people !== null && (
              <div className="ml-7 grid sm:grid-cols-2 gap-1.5" data-people>
                {data.staff.length === 0 ? <p className="text-sm text-gray-500">No staff yet. Add staff on Staff &amp; roles.</p> : data.staff.map((x) => (
                  <label key={x.id} className="flex items-center gap-2 text-sm text-gray-800 rounded-lg px-2 py-1.5 hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={s.people!.includes(x.id)} disabled={busy} className="accent-blue-600"
                      onChange={(e) => save({ people: e.target.checked ? [...s.people!, x.id] : s.people!.filter((id) => id !== x.id) })} />
                    {x.name} <span className="text-xs text-gray-400">{x.roles.join(", ") || "No role"}</span>
                  </label>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-500">Customers only see the first name.</p>
          </fieldset>
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="waiter-see-own" className="text-sm text-gray-800">Waiters see the feedback about themselves <span className="block text-xs text-gray-500">On their My work page, without customer names. They don&apos;t see the others&apos;.</span></label>
            <Switch on={s.showToWaiters} id="waiter-see-own" label="Waiters see the feedback about themselves" disabled={busy} onClick={() => save({ showToWaiters: !s.showToWaiters })} />
          </div>
        </div>
      )}
    </section>
  );
}

type Range = "30" | "90" | "year" | "all";
const RANGES: { key: Range; label: string }[] = [{ key: "30", label: "Last 30 days" }, { key: "90", label: "Last 90 days" }, { key: "year", label: "This year" }, { key: "all", label: "All time" }];

export function WaiterFeedbackResults({ wf, onOpenSettings }: { wf: ReturnType<typeof useWaiterFeedback>; onOpenSettings: () => void }) {
  const { data, remove } = wf;
  const [range, setRange] = useState<Range>("all");
  const [waiter, setWaiter] = useState("");
  const [stars, setStars] = useState<number | null>(null);
  const [now] = useState(() => Date.now());

  const nameOf = useCallback((id: string) => data?.staff.find((s) => s.id === id)?.name ?? "Former staff member", [data]);
  const inRange = useMemo(() => {
    if (!data) return [];
    const since = range === "30" ? now - 30 * 86400000 : range === "90" ? now - 90 * 86400000 : range === "year" ? new Date(new Date(now).getFullYear(), 0, 1).getTime() : 0;
    return data.feedback.filter((f) => Date.parse(f.createdAt) >= since);
  }, [data, range, now]);
  const waiters = useMemo(() => {
    if (!data) return [];
    const ids = [...new Set([...data.rateable, ...data.feedback.map((f) => f.waiterId)])];
    return ids.map((id) => ({ id, name: nameOf(id) }));
  }, [data, nameOf]);
  const ranking = useMemo(() => waiters.map((w) => {
    const mine = inRange.filter((f) => f.waiterId === w.id);
    const counts = new Map<string, number>();
    for (const f of mine) for (const t of f.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    return { ...w, count: mine.length, avg: mine.length ? mine.reduce((n, f) => n + f.rating, 0) / mine.length : 0, top: [...counts].sort((a, b) => b[1] - a[1]).slice(0, 3), rateable: !!data?.rateable.includes(w.id) };
  }).sort((a, b) => b.avg - a.avg || b.count - a.count || a.name.localeCompare(b.name)), [waiters, inRange, data]);

  if (!data) return <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-sm text-gray-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>;
  if (!data.feedback.length) return (
    <div className="bg-white rounded-2xl p-10 text-center border border-gray-100 shadow-sm space-y-2">
      <UserRoundCheck className="w-10 h-10 text-gray-200 mx-auto" aria-hidden />
      <p className="font-semibold text-gray-700">No feedback about waiters yet</p>
      <p className="text-sm text-gray-500">{data.settings.enabled ? "Customers can rate their waiter under More. Their feedback shows up here." : "It's off. Turn it on in Settings so customers can rate their waiter."}</p>
      {!data.settings.enabled && <button type="button" onClick={onOpenSettings} className="text-sm font-semibold text-blue-700 hover:underline">Open Settings</button>}
    </div>
  );
  const list = inRange.filter((f) => (!waiter || f.waiterId === waiter) && (stars === null || f.rating === stars));
  const total = inRange.length, avg = total ? inRange.reduce((n, f) => n + f.rating, 0) / total : 0;

  return (
    <div className="space-y-4" data-waiter-results>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap rounded-xl border border-gray-200 bg-white p-1" role="group" aria-label="Time">
          {RANGES.map((r) => (
            <button key={r.key} type="button" onClick={() => setRange(r.key)} aria-pressed={range === r.key} data-range={r.key}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${range === r.key ? "bg-gray-900 text-white" : "text-gray-600"}`}>{r.label}</button>
          ))}
        </div>
        <span className="flex-1" />
        <span className="text-sm text-gray-600" data-wf-summary>{total} {total === 1 ? "feedback" : "feedbacks"}{total ? <> · <b className="text-gray-900">{avg.toFixed(1)}</b> stars on average</> : null}</span>
      </div>

      <WaiterCharts items={inRange} waiters={waiters} />

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <h3 className="px-5 pt-4 font-semibold text-gray-900">Waiters by rating</h3>
        <ul className="divide-y divide-gray-100 mt-2" data-ranking>
          {ranking.map((w, i) => (
            <li key={w.id}>
              <button type="button" onClick={() => setWaiter(waiter === w.id ? "" : w.id)} aria-pressed={waiter === w.id}
                className={`w-full flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-left hover:bg-gray-50 ${waiter === w.id ? "bg-blue-50/60" : ""}`} data-rank-row={w.name}>
                <span className="w-6 text-sm font-semibold text-gray-400">{w.count ? `${i + 1}.` : ""}</span>
                <span className="flex-1 min-w-32 text-sm font-semibold text-gray-900">{w.name}{!w.rateable && <span className="ml-2 text-xs font-normal text-gray-400">can&apos;t be rated now</span>}</span>
                {w.count ? <><Stars n={w.avg} /><span className="text-sm font-semibold text-gray-900 w-10">{w.avg.toFixed(1)}</span></> : <span className="text-sm text-gray-400">No feedback in this time</span>}
                <span className="text-xs text-gray-500 w-24">{w.count} {w.count === 1 ? "feedback" : "feedbacks"}</span>
                <span className="basis-full sm:basis-auto flex flex-wrap gap-1 pl-10 sm:pl-0">
                  {w.top.map(([t, n]) => <span key={t} className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${GOOD.has(t) ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{t} ×{n}</span>)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <label htmlFor="wf-waiter" className="sr-only">Waiter</label>
          <select id="wf-waiter" value={waiter} onChange={(e) => setWaiter(e.target.value)} className="text-sm border border-gray-200 rounded-xl px-2.5 py-1.5 bg-white">
            <option value="">All waiters</option>
            {ranking.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          {[null, 5, 4, 3, 2, 1].map((r) => (
            <button key={r ?? "all"} type="button" onClick={() => setStars(r)} aria-pressed={stars === r}
              className={`px-3 py-1.5 rounded-full text-sm font-medium ${stars === r ? "bg-blue-500 text-white" : "bg-white border border-gray-200 text-gray-700 hover:border-blue-300"}`}>{r === null ? "All" : `${r}★`}</button>
          ))}
          <span className="text-sm text-gray-500" data-wf-count>{list.length} shown</span>
        </div>
        {list.length === 0 ? <p className="text-sm text-gray-500">No feedback with this filter.</p> : (
          <ul className="space-y-2">
            {list.slice(0, 200).map((f) => (
              <li key={f.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4" data-wf-item>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold text-gray-900">{nameOf(f.waiterId)}</span><Stars n={f.rating} /></div>
                    {f.tags.length > 0 && <div className="flex flex-wrap gap-1">{f.tags.map((t) => <span key={t} className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${GOOD.has(t) ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{t}</span>)}</div>}
                    {f.comment && <p className="text-sm text-gray-700">{f.comment}</p>}
                    <p className="text-xs text-gray-400">{f.customerName || "Anonymous"} · {fDate.format(new Date(f.createdAt))}</p>
                  </div>
                  <button type="button" onClick={() => remove(f.id)} aria-label="Delete this feedback" className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
