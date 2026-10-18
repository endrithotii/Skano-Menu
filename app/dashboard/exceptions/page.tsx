"use client";

// "Open hours & holidays": the weekly opening hours and special days (holidays, events, closures).
// Customers see them under More > Opening hours on the public menu.

import { useEffect, useState } from "react";
import { CalendarX, Clock, Plus, Trash2, Save, Loader2, Copy, Pencil, Coffee, X } from "lucide-react";
import { dayMinutes, dayRanges, rangesText, type Break } from "@/lib/opening-hours";
import toast from "react-hot-toast";
import { useUnsavedChanges } from "@/lib/navigation-guard";

interface Exception { id: string; date: string; label: string; closed: boolean; openTime?: string; closeTime?: string; }

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
type Day = typeof DAYS[number];
/** breaks: closed for a while inside the day (e.g. 12:00 to 16:00), left out when there are none */
type DaySchedule = { open: string; close: string; closed: boolean; breaks?: Break[] };
type Week = Record<Day, DaySchedule>;

const DEFAULT_WEEK: Week = {
  monday: { open: "09:00", close: "22:00", closed: false },
  tuesday: { open: "09:00", close: "22:00", closed: false },
  wednesday: { open: "09:00", close: "22:00", closed: false },
  thursday: { open: "09:00", close: "22:00", closed: false },
  friday: { open: "09:00", close: "23:00", closed: false },
  saturday: { open: "10:00", close: "23:00", closed: false },
  sunday: { open: "10:00", close: "21:00", closed: false },
};

/** Saved hours, or null when none were set yet */
function parseWeek(raw: string | null | undefined): Week | null {
  try {
    const p = JSON.parse(raw || "{}");
    if (!p || typeof p !== "object" || !("monday" in p)) return null;
    const out = { ...DEFAULT_WEEK };
    for (const d of DAYS) {
      const v = p[d];
      if (v && typeof v === "object") {
        const breaks = Array.isArray(v.breaks) ? v.breaks.filter((b: Break) => b && typeof b.from === "string" && typeof b.to === "string").slice(0, 3) : [];
        out[d] = { open: v.open || "09:00", close: v.close || "22:00", closed: !!v.closed, ...(breaks.length ? { breaks } : {}) };
      }
    }
    return out;
  } catch {
    return null;
  }
}

const inputCls = "px-2 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-white";

export default function OpenHoursPage() {
  const [restaurantId, setRestaurantId] = useState("");
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: "", label: "", closed: true, openTime: "", closeTime: "" });
  // The special day being changed (null = adding a new one)
  const [editingId, setEditingId] = useState<string | null>(null);
  // Weekly hours: what is saved (null = never set) and what is being edited
  const [savedWeek, setSavedWeek] = useState<Week | null>(null);
  const [week, setWeek] = useState<Week>(DEFAULT_WEEK);
  const [savingWeek, setSavingWeek] = useState(false);

  const weekDirty = JSON.stringify(week) !== JSON.stringify(savedWeek ?? null);
  useUnsavedChanges(!loading && weekDirty && !!savedWeek, "Your opening hours aren't saved yet. Leave without saving?");

  useEffect(() => {
    (async () => {
      const s = await fetch("/api/dashboard/stats").then(r => r.json());
      setRestaurantId(s.restaurantId);
      const [d, r] = await Promise.all([
        fetch(`/api/restaurants/${s.restaurantId}/exceptions`).then(r => r.json()).catch(() => ({})),
        fetch(`/api/restaurants/${s.restaurantId}`).then(r => r.json()).catch(() => ({})),
      ]);
      setExceptions(d.exceptions ?? []);
      const w = parseWeek(r?.restaurant?.openingHours);
      setSavedWeek(w);
      setWeek(w ?? DEFAULT_WEEK);
      setLoading(false);
    })();
  }, []);

  async function load() {
    const d = await fetch(`/api/restaurants/${restaurantId}/exceptions`).then(r => r.json());
    setExceptions(d.exceptions ?? []);
  }

  function setDay(day: Day, patch: Partial<DaySchedule>) {
    setWeek((w) => ({ ...w, [day]: { ...w[day], ...patch } }));
  }

  /** A new break in the middle of the day (12:00 to 16:00 when it fits) */
  function addBreak(day: Day) {
    const d = week[day];
    const [[a, b]] = dayMinutes(d.open, d.close).length ? dayMinutes(d.open, d.close) : [[540, 1320]];
    const hm = (n: number) => `${String(Math.floor((n % 1440) / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
    const from = a <= 720 && b >= 960 ? 720 : Math.round((a + (b - a) / 3) / 30) * 30;
    const to = a <= 720 && b >= 960 ? 960 : Math.round((a + ((b - a) * 2) / 3) / 30) * 30;
    setDay(day, { breaks: [...(d.breaks ?? []), { from: hm(from), to: hm(to) }].slice(0, 3) });
  }
  function setBreak(day: Day, i: number, patch: Partial<Break> | null) {
    const list = (week[day].breaks ?? []).map((b, j) => (j === i ? (patch ? { ...b, ...patch } : null) : b)).filter((b): b is Break => !!b);
    setWeek((w) => { const next = { ...w[day] }; if (list.length) next.breaks = list; else delete next.breaks; return { ...w, [day]: next }; });
  }

  function copyMondayToAll() {
    setWeek((w) => Object.fromEntries(DAYS.map((d) => [d, { ...w.monday }])) as Week);
  }

  async function saveWeek() {
    if (savingWeek) return;
    setSavingWeek(true);
    const res = await fetch(`/api/restaurants/${restaurantId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ openingHours: JSON.stringify(week) }),
    }).catch(() => null);
    setSavingWeek(false);
    if (!res?.ok) { toast.error("Could not save the opening hours"); return; }
    setSavedWeek(week);
    toast.success("Opening hours saved. Customers see them now.");
  }

  const emptyForm = { date: "", label: "", closed: true, openTime: "", closeTime: "" };

  function openNew() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm((v) => !v || editingId !== null);
  }

  function openEdit(ex: Exception) {
    setEditingId(ex.id);
    setForm({ date: ex.date, label: ex.label, closed: ex.closed, openTime: ex.openTime ?? "", closeTime: ex.closeTime ?? "" });
    setShowForm(true);
    setTimeout(() => document.getElementById("special-day-form")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/restaurants/${restaurantId}/exceptions`, {
      method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingId ? { id: editingId, ...form } : form),
    }).catch(() => null);
    if (res?.ok) {
      toast.success(editingId ? "Special day saved" : "Special day added");
      closeForm();
      load();
    } else toast.error(editingId ? "Could not save it" : "Could not add it");
  }

  async function remove(id: string) {
    if (!confirm("Remove this special day?")) return;
    await fetch(`/api/restaurants/${restaurantId}/exceptions?id=${id}`, { method: "DELETE" });
    setExceptions(e => e.filter(x => x.id !== id));
    toast.success("Removed");
  }

  if (loading) return <div className="p-6 flex justify-center h-64 items-center"><div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" /></div>;

  const todayIso = new Date().toISOString().slice(0, 10);
  const upcoming = exceptions.filter(e => e.date >= todayIso).sort((a, b) => a.date.localeCompare(b.date));
  const past = exceptions.filter(e => e.date < todayIso).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="p-4 lg:p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Clock className="w-6 h-6 text-blue-500" /> Open hours &amp; holidays</h1>
        <p className="text-sm text-gray-500 mt-1">Customers see these on your menu under More, then Opening hours</p>
      </div>

      {/* ── Weekly hours ── */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Clock className="w-4 h-4 text-blue-500" /> Opening hours</h2>
            <p className="text-xs text-gray-500 mt-1">
              {savedWeek ? "Your normal hours for every week." : "Not set yet. Set your hours and press Save, then customers can see them."}
            </p>
          </div>
          <button type="button" onClick={copyMondayToAll}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-blue-700 px-2.5 py-1.5 rounded-lg border border-gray-200 hover:border-blue-300 bg-white">
            <Copy className="w-3.5 h-3.5" /> Use Monday&apos;s hours for every day
          </button>
        </div>
        <div className="space-y-2">
          {DAYS.map((day) => {
            const s = week[day];
            return (
              <div key={day} className={`flex items-center gap-3 py-2 px-3 rounded-xl flex-wrap ${s.closed ? "bg-gray-50" : "bg-blue-50/40"}`}>
                <span className="w-24 text-sm font-medium text-gray-700 capitalize">{day}</span>
                {s.closed ? (
                  <span className="flex-1 text-xs text-gray-400">Closed all day</span>
                ) : (
                  <div className="flex items-center gap-2 flex-1">
                    <input type="time" aria-label={`${day} opens`} value={s.open} onChange={(e) => setDay(day, { open: e.target.value })} className={inputCls} />
                    <span className="text-gray-400 text-xs">to</span>
                    <input type="time" aria-label={`${day} closes`} value={s.close} onChange={(e) => setDay(day, { close: e.target.value })} className={inputCls} />
                  </div>
                )}
                <label className="flex items-center gap-1.5 ml-auto shrink-0">
                  <input type="checkbox" id={`closed-${day}`} checked={s.closed} onChange={(e) => setDay(day, { closed: e.target.checked })} className="rounded accent-blue-500" />
                  <span className="text-xs text-gray-500">Closed</span>
                </label>
                {!s.closed && (
                  <div className="basis-full pl-0 sm:pl-[6.75rem] space-y-1.5" data-breaks={day}>
                    {(s.breaks ?? []).map((b, i) => {
                      // A break must be inside the opening hours, else it does nothing
                      const inside = dayMinutes(s.open, s.close, [b]).length !== 1 || dayRanges(s.open, s.close, [b])[0].open !== s.open || dayRanges(s.open, s.close, [b])[0].close !== s.close;
                      return (
                        <div key={i} className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-800"><Coffee className="w-3.5 h-3.5" /> Break</span>
                          <input type="time" aria-label={`${day} break ${i + 1} starts`} value={b.from} onChange={(e) => setBreak(day, i, { from: e.target.value })} className={inputCls} />
                          <span className="text-gray-400 text-xs">to</span>
                          <input type="time" aria-label={`${day} break ${i + 1} ends`} value={b.to} onChange={(e) => setBreak(day, i, { to: e.target.value })} className={inputCls} />
                          <button type="button" onClick={() => setBreak(day, i, null)} aria-label="Remove this break" className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><X className="w-3.5 h-3.5" /></button>
                          {!inside && <span className="text-[11px] text-amber-700">This break is outside the opening hours.</span>}
                        </div>
                      );
                    })}
                    <div className="flex items-center gap-3 flex-wrap">
                      {(s.breaks ?? []).length < 3 && (
                        <button type="button" onClick={() => addBreak(day)} data-add-break={day} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"><Plus className="w-3.5 h-3.5" /> Add a break</button>
                      )}
                      {!!s.breaks?.length && <span className="text-[11px] text-gray-500" data-day-summary={day}>Open {rangesText(dayRanges(s.open, s.close, s.breaks), " and ")}</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-gray-500">Open past midnight? Just set the closing time after midnight, for example 18:00 to 02:00. Closed for a while in the day, like 12:00 to 16:00? Add a break: customers see both times and can&apos;t reserve during the break.</p>
        <div className="flex items-center justify-end gap-3">
          {weekDirty && savedWeek && <span className="text-xs font-medium text-amber-700">Not saved yet</span>}
          <button type="button" onClick={saveWeek} disabled={savingWeek || (!weekDirty && !!savedWeek)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-xl shadow-sm disabled:opacity-40">
            {savingWeek ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save opening hours
          </button>
        </div>
      </section>

      {/* ── Special days ── */}
      <section className="space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-semibold text-gray-900 flex items-center gap-2"><CalendarX className="w-4 h-4 text-blue-500" /> Holidays and special days</h2>
            <p className="text-xs text-gray-500 mt-1">On these dates customers see these hours instead of the normal ones</p>
          </div>
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Add special day
          </button>
        </div>

        {showForm && (
          <form id="special-day-form" onSubmit={create} className={`bg-white rounded-2xl border shadow-sm p-5 space-y-4 ${editingId ? "border-blue-200 ring-2 ring-blue-100" : "border-gray-100"}`}>
            <h3 className="font-semibold text-gray-900">{editingId ? `Edit "${exceptions.find((x) => x.id === editingId)?.label ?? "special day"}"` : "New special day"}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Date *</label>
                <input required type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
                <input required value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="e.g. Christmas Day" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="closed" checked={form.closed} onChange={e => setForm({ ...form, closed: e.target.checked })} className="w-4 h-4 accent-blue-500" />
              <label htmlFor="closed" className="text-sm font-medium text-gray-700">Closed all day</label>
            </div>
            {!form.closed && (
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Opens at</label>
                  <input type="time" required value={form.openTime} onChange={e => setForm({ ...form, openTime: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                </div>
                <div><label className="block text-xs font-medium text-gray-700 mb-1">Closes at</label>
                  <input type="time" required value={form.closeTime} onChange={e => setForm({ ...form, closeTime: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button type="submit" className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-xl">{editingId ? "Save changes" : "Add special day"}</button>
              <button type="button" onClick={closeForm} className="px-4 py-2.5 border border-gray-200 text-sm text-gray-600 rounded-xl hover:bg-gray-50">Cancel</button>
            </div>
          </form>
        )}

        {exceptions.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-10 text-center">
            <CalendarX className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="font-medium text-gray-500">No special days yet</p>
            <p className="text-sm text-gray-400 mt-1">Add holidays, closures or days with different hours</p>
          </div>
        ) : (
          <div className="space-y-4">
            {upcoming.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Upcoming</p>
                <div className="space-y-2">{upcoming.map(ex => (
                  <div key={ex.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl flex flex-col items-center justify-center bg-red-50 flex-shrink-0">
                      <span className="text-[10px] font-bold text-red-500 uppercase">{new Date(ex.date + "T12:00:00").toLocaleString("en", { month: "short" })}</span>
                      <span className="text-lg font-black text-red-600">{new Date(ex.date + "T12:00:00").getDate()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{ex.label}</p>
                      <p className="text-xs text-gray-400">{ex.closed ? "Closed all day" : `${ex.openTime} – ${ex.closeTime}`}</p>
                    </div>
                    <button onClick={() => openEdit(ex)} aria-label={`Edit ${ex.label}`} className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:border-blue-300 hover:text-blue-700"><Pencil className="w-3.5 h-3.5" /> Edit</button>
                    <button onClick={() => remove(ex.id)} aria-label={`Remove ${ex.label}`} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}</div>
              </div>
            )}
            {past.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Past</p>
                <div className="space-y-2 opacity-50">{past.slice(0, 3).map(ex => (
                  <div key={ex.id} className="bg-white rounded-2xl border border-gray-100 p-3 flex items-center gap-3">
                    <div className="flex-1"><p className="text-sm font-medium text-gray-600">{ex.label}</p><p className="text-xs text-gray-400">{ex.date} · {ex.closed ? "Closed" : `${ex.openTime}–${ex.closeTime}`}</p></div>
                    <button onClick={() => openEdit(ex)} aria-label={`Edit ${ex.label}`} className="p-1 rounded text-gray-400 hover:text-blue-600"><Pencil className="w-3 h-3" /></button>
                    <button onClick={() => remove(ex.id)} aria-label={`Remove ${ex.label}`} className="p-1 rounded text-gray-300 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                  </div>
                ))}</div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
