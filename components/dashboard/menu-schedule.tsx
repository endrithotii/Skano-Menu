"use client";

// Scheduling saved menus (see lib/menu-schedule.ts):
// - useSchedules: the restaurant's scheduled menus
// - ScheduleFields: start / optional end inputs with the explanation of what happens
// - ScheduleDialog: schedule one menu (or change a schedule)
// - ScheduledMenus: the list on the Menu page with Change / Cancel

import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarClock, Loader2, X, Pencil, Trash2, Info } from "lucide-react";
import toast from "react-hot-toast";
import { formatDayTime } from "@/lib/format-date";

export interface ScheduleItem {
  id: string;
  menuId: string;
  title: string | null;
  startAt: string;
  endAt: string | null;
  status: "upcoming" | "running" | "finished";
}

export function useSchedules(restaurantId: string | undefined, onApplied?: () => void) {
  const [items, setItems] = useState<ScheduleItem[] | null>(null);
  const [tick, setTick] = useState(0);
  const pending = useRef<(() => void)[]>([]);
  const appliedRef = useRef(onApplied);
  useEffect(() => { appliedRef.current = onApplied; });
  useEffect(() => {
    if (!restaurantId) return;
    let cancelled = false;
    fetch(`/api/restaurants/${restaurantId}/menu-schedule`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((d) => {
        if (!cancelled) setItems(d?.schedules ?? []);
        if (!cancelled && d?.applied) appliedRef.current?.();
        pending.current.splice(0).forEach((done) => done());
      });
    return () => { cancelled = true; };
  }, [restaurantId, tick]);
  const reload = useCallback(() => new Promise<void>((done) => { pending.current.push(done); setTick((t) => t + 1); }), []);
  return { items, reload };
}

/** Value for <input type="datetime-local"> in the viewer's own time zone */
function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function nextFullHour(offsetHours = 1) {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + offsetHours);
  return d;
}

export interface ScheduleValue { start: string; hasEnd: boolean; end: string }

export function defaultScheduleValue(init?: { startAt: string; endAt: string | null }): ScheduleValue {
  const start = init ? new Date(init.startAt) : nextFullHour();
  const end = init?.endAt ? new Date(init.endAt) : new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: toLocalInput(start), hasEnd: init ? !!init.endAt : true, end: toLocalInput(end) };
}

/** Problem with the chosen times (null = fine) */
export function scheduleProblem(v: ScheduleValue): string | null {
  const s = Date.parse(v.start);
  if (!Number.isFinite(s)) return "Choose when the menu starts.";
  if (!v.hasEnd) return null;
  const e = Date.parse(v.end);
  if (!Number.isFinite(e)) return "Choose when the menu ends, or untick the end time.";
  if (e <= s) return "The end time must be after the start time.";
  if (e <= Date.now()) return "The end time is already over.";
  return null;
}

export const scheduleTimes = (v: ScheduleValue) => ({
  startAt: new Date(v.start).toISOString(),
  endAt: v.hasEnd ? new Date(v.end).toISOString() : null,
});

const inputCls = "w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500";

export function ScheduleFields({ value, onChange, menuTitle, treeLive }: {
  value: ScheduleValue;
  onChange: (v: ScheduleValue) => void;
  menuTitle: string;
  /** The restaurant shows a menu tree right now */
  treeLive?: boolean;
}) {
  const problem = scheduleProblem(value);
  const startTxt = Number.isFinite(Date.parse(value.start)) ? formatDayTime(new Date(value.start)) : "the start time";
  const endTxt = Number.isFinite(Date.parse(value.end)) ? formatDayTime(new Date(value.end)) : "the end time";
  // Time the fields were opened (good enough to say "from now")
  const [openedAt] = useState(() => Date.now());
  const startsNowish = Date.parse(value.start) <= openedAt;
  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-xs font-semibold text-gray-600 mb-1">Starts</span>
          <input id="schedule-start" type="datetime-local" value={value.start} onChange={(e) => onChange({ ...value, start: e.target.value })} className={inputCls} />
        </label>
        <div>
          <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 mb-1 cursor-pointer">
            <input id="schedule-has-end" type="checkbox" checked={value.hasEnd} onChange={(e) => onChange({ ...value, hasEnd: e.target.checked })} className="w-3.5 h-3.5 accent-blue-600" />
            Ends <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <input id="schedule-end" type="datetime-local" value={value.end} disabled={!value.hasEnd}
            onChange={(e) => onChange({ ...value, end: e.target.value })} className={`${inputCls} disabled:opacity-40`} />
        </div>
      </div>
      {problem ? (
        <p className="text-xs font-medium text-red-600">{problem}</p>
      ) : (
        <div className="flex items-start gap-2 rounded-xl bg-blue-50 border border-blue-100 px-3 py-2.5 text-xs text-blue-900">
          <Info className="w-4 h-4 shrink-0 mt-px" />
          <span>
            {value.hasEnd
              ? <>From {startsNowish ? "now" : startTxt} until {endTxt} customers see &quot;{menuTitle}&quot;{treeLive ? " instead of your menu tree" : ""}. When it ends, the menu that was active before it comes back automatically, unless another menu is scheduled for then.</>
              : <>From {startsNowish ? "now" : startTxt}, &quot;{menuTitle}&quot; becomes your active menu{treeLive ? " (instead of your menu tree)" : ""} and stays until you change it. Want it only for a while? Tick Ends and choose an end time.</>}
          </span>
        </div>
      )}
    </div>
  );
}

export function ScheduleDialog({ restaurantId, menuId, menuTitle, existing, treeLive, onClose, onSaved }: {
  restaurantId: string;
  menuId: string;
  menuTitle: string;
  /** Change this schedule instead of making a new one */
  existing?: ScheduleItem | null;
  treeLive?: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [value, setValue] = useState<ScheduleValue>(() => defaultScheduleValue(existing ?? undefined));
  const [busy, setBusy] = useState(false);
  const problem = scheduleProblem(value);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || problem) return;
    setBusy(true);
    const res = await fetch(`/api/restaurants/${restaurantId}/menu-schedule`, {
      method: existing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...(existing ? { id: existing.id } : { menuId }), ...scheduleTimes(value) }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const d = await res?.json().catch(() => null);
      toast.error(d?.error ?? "Could not save the schedule.");
      return;
    }
    toast.success(existing ? "Schedule changed" : `"${menuTitle}" is scheduled`);
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => !busy && onClose()}>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
      <form role="dialog" aria-modal="true" aria-label="Schedule menu" onSubmit={submit} onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === "Escape" && !busy) onClose(); }}
        className="relative z-10 w-full max-w-lg bg-white rounded-2xl shadow-2xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><CalendarClock className="w-5 h-5 text-blue-600" /> {existing ? "Change schedule" : "Schedule menu"}</h2>
            <p className="text-sm text-gray-500">&quot;{menuTitle}&quot;</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        <ScheduleFields value={value} onChange={setValue} menuTitle={menuTitle} treeLive={treeLive} />
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="text-sm font-medium text-gray-600 px-4 py-2 rounded-xl hover:bg-gray-100 disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={busy || !!problem}
            className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl text-white bg-gradient-to-r from-blue-500 to-indigo-500 disabled:opacity-50">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarClock className="w-4 h-4" />} {existing ? "Save" : "Schedule"}
          </button>
        </div>
      </form>
    </div>
  );
}

/** Upcoming and running schedules, with Change / Cancel */
export function ScheduledMenus({ restaurantId, items, reload, treeLive }: {
  restaurantId: string;
  items: ScheduleItem[] | null;
  reload: () => Promise<void>;
  treeLive?: boolean;
}) {
  const [editing, setEditing] = useState<ScheduleItem | null>(null);
  const shown = (items ?? []).filter((s) => s.status !== "finished");
  if (!items || !shown.length) return null;

  async function cancel(s: ScheduleItem) {
    if (!window.confirm(`Cancel the schedule of "${s.title ?? "this menu"}"?${s.status === "running" ? " Customers will see your normal menu again right away." : ""}`)) return;
    const r = await fetch(`/api/restaurants/${restaurantId}/menu-schedule?id=${encodeURIComponent(s.id)}`, { method: "DELETE" }).catch(() => null);
    if (!r?.ok) { toast.error("Could not cancel the schedule."); return; }
    toast.success("Schedule cancelled");
    await reload();
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-1">
        <CalendarClock className="w-4 h-4 text-blue-600" />
        <span className="font-semibold text-gray-900">Scheduled menus</span>
      </div>
      <p className="text-xs text-gray-500 mb-3">When a menu with an end time finishes, the menu that was active before comes back automatically, unless another one is scheduled.</p>
      <ul className="divide-y divide-gray-100">
        {shown.map((s) => (
          <li key={s.id} className="flex items-center gap-3 py-2.5 flex-wrap">
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${s.status === "running" ? "bg-green-100 text-green-800 border-green-200" : "bg-amber-50 text-amber-800 border-amber-200"}`}>
              {s.status === "running" ? "Showing now" : "Upcoming"}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-gray-900 truncate">{s.title ?? "Deleted menu"}</div>
              <div className="text-xs text-gray-500">
                {s.status === "running" ? "Since" : "From"} {formatDayTime(s.startAt)}
                {s.endAt ? ` until ${formatDayTime(s.endAt)}` : ", then it stays active"}
              </div>
            </div>
            <button type="button" onClick={() => setEditing(s)} className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-blue-700 px-2 py-1.5 rounded-lg hover:bg-blue-50">
              <Pencil className="w-3.5 h-3.5" /> Change
            </button>
            <button type="button" onClick={() => cancel(s)} className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-red-600 px-2 py-1.5 rounded-lg hover:bg-red-50">
              <Trash2 className="w-3.5 h-3.5" /> Cancel
            </button>
          </li>
        ))}
      </ul>
      {editing && (
        <ScheduleDialog restaurantId={restaurantId} menuId={editing.menuId} menuTitle={editing.title ?? "Menu"} existing={editing} treeLive={treeLive}
          onClose={() => setEditing(null)} onSaved={() => { reload(); }} />
      )}
    </div>
  );
}
