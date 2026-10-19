"use client";

// HR tab, Work times: the weekly work times of each person, plus their own numbers (contract hours, vacation days, ...).

import { useState } from "react";
import { Plus, Trash2, Loader2, Copy } from "lucide-react";
import toast from "react-hot-toast";
import { MIN_UNITS, WEEKDAYS, dayHours, fmtHours, hasSchedule, sanitizeSchedule, type MinUnit, type PersonHr, type WeekSchedule } from "@/lib/hr";
import { btnGhost, btnPrimary, card, inputCls } from "@/components/hr/hr-ui";
import type { Post, Team } from "@/components/hr/hr-types";

function PersonEditor({ team, userId, post, reload }: { team: Team; userId: string; post: Post; reload: () => void }) {
  const start = team.staff.find((s) => s.id === userId)!.person;
  const [p, setP] = useState<PersonHr>(() => ({
    ...start,
    // Nothing set yet: start from Monday to Friday 8 to 16, so it's quick to change
    schedule: hasSchedule(start.schedule) ? start.schedule.map((d) => d.map((s) => ({ ...s }))) : [0, 1, 2, 3, 4, 5, 6].map((i) => (i < 5 ? [{ start: "08:00", end: "16:00" }] : [])),
  }));
  const [busy, setBusy] = useState(false);
  const setDay = (i: number, f: (d: WeekSchedule[number]) => WeekSchedule[number]) => setP((x) => ({ ...x, schedule: x.schedule.map((d, j) => (j === i ? f(d) : d)) }));
  const total = p.schedule.reduce((n, d) => n + dayHours(d), 0);
  const optNum = (v: string) => (v === "" ? null : Number(v));

  async function save() {
    setBusy(true);
    const err = await post({ action: "person", userId, person: { ...p, schedule: sanitizeSchedule(p.schedule) } });
    setBusy(false);
    if (err) toast.error(err); else { toast.success("Saved"); reload(); }
  }

  return (
    <div className="space-y-5">
      <section className={`${card} p-5 space-y-3`} aria-label="Work times">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-gray-900">Work times every week</h3>
          <button type="button" className={btnGhost} onClick={() => setP((x) => ({ ...x, schedule: x.schedule.map((d, i) => (i > 0 && i < 5 ? x.schedule[0].map((s) => ({ ...s })) : d)) }))}>
            <Copy className="w-4 h-4" /> Same as Monday for Tuesday to Friday
          </button>
        </div>
        <ul className="divide-y divide-gray-100">
          {WEEKDAYS.map((name, i) => (
            <li key={name} className="py-2.5 flex flex-col sm:flex-row sm:items-center gap-2" data-day={name}>
              <span className="w-28 text-sm font-medium text-gray-800">{name}</span>
              <div className="flex-1 flex flex-wrap items-center gap-2">
                {p.schedule[i].length === 0 && <span className="text-sm text-gray-400">Day off</span>}
                {p.schedule[i].map((s, j) => (
                  <span key={j} className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 px-2 py-1">
                    <label className="sr-only" htmlFor={`s-${i}-${j}-a`}>{name} start</label>
                    <input id={`s-${i}-${j}-a`} type="time" value={s.start} onChange={(e) => setDay(i, (d) => d.map((x, k) => (k === j ? { ...x, start: e.target.value } : x)))} className="text-sm bg-transparent" />
                    <span className="text-gray-400">to</span>
                    <label className="sr-only" htmlFor={`s-${i}-${j}-b`}>{name} end</label>
                    <input id={`s-${i}-${j}-b`} type="time" value={s.end} onChange={(e) => setDay(i, (d) => d.map((x, k) => (k === j ? { ...x, end: e.target.value } : x)))} className="text-sm bg-transparent" />
                    <button type="button" onClick={() => setDay(i, (d) => d.filter((_, k) => k !== j))} aria-label={`Remove this block on ${name}`} className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                  </span>
                ))}
                {p.schedule[i].length < 4 && (
                  <button type="button" onClick={() => setDay(i, (d) => [...d, d.length ? { start: "17:00", end: "22:00" } : { start: "08:00", end: "16:00" }])} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 px-2 py-1.5 rounded-lg hover:bg-blue-50" data-add-block={name}>
                    <Plus className="w-3.5 h-3.5" /> {p.schedule[i].length ? "Add a break and a second block" : "Add work time"}
                  </button>
                )}
              </div>
              <span className="text-xs text-gray-500 sm:w-20 sm:text-right">{dayHours(p.schedule[i]) ? fmtHours(dayHours(p.schedule[i])) : ""}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-gray-700">Total: <b data-week-total>{fmtHours(total)}</b> a week. A shift past midnight, like 18:00 to 02:00, works too.</p>
      </section>

      <section className={`${card} p-5 grid sm:grid-cols-2 gap-4`} aria-label="Contract and own numbers">
        <div>
          <label htmlFor="p-pos" className="block text-xs font-medium text-gray-700 mb-1">Position</label>
          <input id="p-pos" value={p.position} onChange={(e) => setP({ ...p, position: e.target.value })} maxLength={60} placeholder="For example: Head waiter" className={inputCls} />
        </div>
        <div>
          <label htmlFor="p-start" className="block text-xs font-medium text-gray-700 mb-1">Works here since</label>
          <input id="p-start" type="date" value={p.startDate ?? ""} onChange={(e) => setP({ ...p, startDate: e.target.value || null })} className={inputCls} />
        </div>
        <div>
          <label htmlFor="p-hours" className="block text-xs font-medium text-gray-700 mb-1">Hours a week in the contract <span className="font-normal text-gray-400">(optional)</span></label>
          <input id="p-hours" type="number" min={0} max={100} step={0.5} value={p.weeklyHours ?? ""} onChange={(e) => setP({ ...p, weeklyHours: optNum(e.target.value) })} placeholder={String(total)} className={inputCls} />
        </div>
        <div>
          <label htmlFor="p-min" className="block text-xs font-medium text-gray-700 mb-1">Smallest time off they can ask for</label>
          <select id="p-min" value={p.minUnit ?? ""} onChange={(e) => setP({ ...p, minUnit: (e.target.value || null) as MinUnit | null })} className={inputCls}>
            <option value="">Like the HR rules ({MIN_UNITS.find((u) => u.key === team.settings.rules.minUnit)?.label})</option>
            {MIN_UNITS.map((u) => <option key={u.key} value={u.key}>{u.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="p-vac" className="block text-xs font-medium text-gray-700 mb-1">Vacation days a year</label>
          <input id="p-vac" type="number" min={0} max={365} step={0.5} value={p.vacationDays ?? ""} onChange={(e) => setP({ ...p, vacationDays: optNum(e.target.value) })} placeholder={`${team.settings.rules.vacationDays} (HR rules)`} className={inputCls} />
        </div>
        <div>
          <label htmlFor="p-sick" className="block text-xs font-medium text-gray-700 mb-1">Sick days a year</label>
          <input id="p-sick" type="number" min={0} max={365} step={0.5} value={p.sickDays ?? ""} onChange={(e) => setP({ ...p, sickDays: optNum(e.target.value) })} placeholder={`${team.settings.rules.sickDays} (HR rules)`} className={inputCls} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="p-extra" className="block text-xs font-medium text-gray-700 mb-1">Extra vacation days this year <span className="font-normal text-gray-400">(for example left from last year, or minus)</span></label>
          <input id="p-extra" type="number" min={-365} max={365} step={0.5} value={p.extraVacation || ""} onChange={(e) => setP({ ...p, extraVacation: Number(e.target.value) || 0 })} placeholder="0" className={`${inputCls} sm:max-w-xs`} />
        </div>
      </section>

      <div className="flex justify-end">
        <button type="button" onClick={save} disabled={busy} className={btnPrimary} data-go="save-person">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Save</button>
      </div>
    </div>
  );
}

export function ScheduleTab({ team, post, reload }: { team: Team; post: Post; reload: () => void }) {
  const [userId, setUserId] = useState(team.staff[0]?.id ?? "");
  if (!team.staff.length) return <p className={`${card} p-5 text-sm text-gray-500`}>No staff yet. Add staff on Staff &amp; roles.</p>;
  return (
    <div className="space-y-4">
      <div className="max-w-sm">
        <label htmlFor="sch-user" className="block text-xs font-medium text-gray-700 mb-1">Staff member</label>
        <select id="sch-user" value={userId} onChange={(e) => setUserId(e.target.value)} className={inputCls}>
          {team.staff.map((s) => <option key={s.id} value={s.id}>{s.name}{hasSchedule(s.person.schedule) ? "" : " (no work times yet)"}</option>)}
        </select>
      </div>
      <PersonEditor key={userId} team={team} userId={userId} post={post} reload={reload} />
    </div>
  );
}
