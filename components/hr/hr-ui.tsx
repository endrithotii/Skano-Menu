"use client";

// Pieces shared by My work (staff) and the HR tab: the time off form, balances, status labels, work times.

import { useMemo, useState } from "react";
import { Loader2, X, Plane, Thermometer, CalendarOff } from "lucide-react";
import {
  LEAVE_KINDS, WEEKDAYS_SHORT, dayHours, fmtDays, fmtHours, hasSchedule, leaveAmount, leaveDays, leaveWhen, type Balance, type Leave, type LeaveInput,
  type LeaveKind, type LeaveStatus, type MinUnit, type PersonHr, type WeekSchedule,
} from "@/lib/hr";

export const inputCls = "w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500";
export const btnPrimary = "inline-flex items-center justify-center gap-2 text-sm font-semibold text-white px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 disabled:opacity-50";
export const btnGhost = "inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 px-3 py-2 rounded-xl hover:bg-gray-100 disabled:opacity-50";
export const card = "bg-white rounded-2xl border border-gray-100 shadow-sm";

export const KIND_ICON: Record<LeaveKind, typeof Plane> = { vacation: Plane, sick: Thermometer, unpaid: CalendarOff };

const fTime = (tz: string) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
const fDay = (tz: string) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short" });
export const timeIn = (iso: string, tz: string) => fTime(tz).format(new Date(iso));
export const dayIn = (iso: string, tz: string) => fDay(tz).format(new Date(iso));
export const dayLabel = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

const STATUS: Record<LeaveStatus, { label: string; cls: string }> = {
  pending: { label: "Waiting", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  approved: { label: "Approved", cls: "bg-green-50 text-green-800 border-green-200" },
  declined: { label: "Declined", cls: "bg-red-50 text-red-700 border-red-200" },
  cancelled: { label: "Cancelled", cls: "bg-gray-50 text-gray-600 border-gray-200" },
};
export function StatusPill({ status }: { status: LeaveStatus }) {
  const s = STATUS[status];
  return <span className={`text-[11px] font-semibold rounded-full border px-2 py-0.5 ${s.cls}`} data-status={status}>{s.label}</span>;
}

export function BalanceCards({ balances }: { balances: Balance[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {balances.map((b) => {
        const k = LEAVE_KINDS.find((x) => x.key === b.kind)!;
        const Icon = KIND_ICON[b.kind];
        return (
          <div key={b.kind} className={`${card} p-4`} data-balance={b.kind}>
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900"><Icon className="w-4 h-4 text-blue-600" aria-hidden /> {k.label}</div>
            {b.allowed === null ? (
              <p className="mt-2 text-2xl font-bold text-gray-900">{fmtDays(b.used)}<span className="text-sm font-medium text-gray-500"> taken</span></p>
            ) : (
              <p className="mt-2 text-2xl font-bold text-gray-900">{fmtDays(Math.max(0, b.left ?? 0))}<span className="text-sm font-medium text-gray-500"> left of {b.allowed}</span></p>
            )}
            <p className="text-xs text-gray-500 mt-0.5">{fmtDays(b.used)} taken{b.pending ? `, ${fmtDays(b.pending)} waiting for an answer` : ""}</p>
          </div>
        );
      })}
    </div>
  );
}

/** The work times of a week, read only */
export function WeekView({ schedule, weeklyHours }: { schedule: WeekSchedule; weeklyHours?: number | null }) {
  const set = hasSchedule(schedule);
  const total = schedule.reduce((n, d) => n + dayHours(d), 0);
  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5 text-center">
        {WEEKDAYS_SHORT.map((d, i) => {
          const shifts = set ? schedule[i] : i < 5 ? [{ start: "08:00", end: "16:00" }] : [];
          return (
            <div key={d} className={`rounded-xl border px-1 py-2 ${shifts.length ? "border-blue-100 bg-blue-50/60" : "border-gray-100 bg-gray-50"}`}>
              <div className="text-[11px] font-semibold text-gray-500">{d}</div>
              {shifts.length ? shifts.map((s, j) => <div key={j} className="text-[11px] sm:text-xs font-medium text-gray-800 leading-tight mt-1">{s.start}<br />{s.end}</div>) : <div className="text-[11px] text-gray-400 mt-1">Off</div>}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-gray-500 mt-2">
        {set ? `${fmtHours(total)} a week` : "No work times set yet. Monday to Friday, 8:00 to 16:00 is used until HR sets them."}
        {weeklyHours ? ` · Contract: ${fmtHours(weeklyHours)} a week` : ""}
      </p>
    </div>
  );
}

type Length = "days" | "half" | "hours";

/** Asking for time off (staff) or adding it for someone (HR, with a staff picker) */
export function TimeOffDialog({ title, person, minUnit, noticeDays, today, staff, onSubmit, onClose, hrMode = false }: {
  title: string;
  /** Work times of the person (null: chosen with the staff picker) */
  person: PersonHr | ((userId: string) => PersonHr | undefined) | undefined;
  minUnit: MinUnit | ((userId: string) => MinUnit);
  noticeDays: number;
  today: string;
  staff?: { id: string; name: string }[];
  onSubmit: (input: LeaveInput & { userId?: string }) => Promise<string | null>;
  onClose: () => void;
  hrMode?: boolean;
}) {
  const [userId, setUserId] = useState(staff?.[0]?.id ?? "");
  const [kind, setKind] = useState<LeaveKind>("vacation");
  const [length, setLength] = useState<Length>("days");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("12:00");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unit = typeof minUnit === "function" ? minUnit(userId) : minUnit;
  const p = typeof person === "function" ? person(userId) : person;
  // HR can always add any length, staff only what the rules allow
  const lengths: { key: Length; label: string }[] = [
    { key: "days", label: "Whole days" },
    ...(hrMode || unit !== "day" ? [{ key: "half" as Length, label: "Half a day" }] : []),
    ...(hrMode || unit === "hour" ? [{ key: "hours" as Length, label: "Some hours" }] : []),
  ];
  const len = lengths.some((l) => l.key === length) ? length : "days";
  const input: LeaveInput = {
    kind, from, to: len === "days" ? (to < from ? from : to) : from, half: len === "half",
    startTime: len === "hours" ? startTime : null, endTime: len === "hours" ? endTime : null, reason,
  };
  const counts = useMemo(() => (from ? leaveDays(p, input) : 0), [p, input.kind, input.from, input.to, input.half, input.startTime, input.endTime]); // eslint-disable-line react-hooks/exhaustive-deps
  const minDay = hrMode || kind === "sick" ? undefined : today;

  async function send() {
    setBusy(true); setError(null);
    const err = await onSubmit({ ...input, ...(staff ? { userId } : {}) });
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 sm:p-4" onClick={() => !busy && onClose()} role="dialog" aria-modal="true" aria-label={title} data-timeoff-dialog>
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-2 -m-2 rounded-lg text-gray-500 hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          {staff && (
            <div>
              <label htmlFor="to-user" className="block text-xs font-medium text-gray-700 mb-1">Staff member</label>
              <select id="to-user" value={userId} onChange={(e) => setUserId(e.target.value)} className={inputCls}>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          <fieldset>
            <legend className="block text-xs font-medium text-gray-700 mb-1.5">What kind</legend>
            <div className="grid grid-cols-3 gap-2">
              {LEAVE_KINDS.map((k) => {
                const Icon = KIND_ICON[k.key];
                return (
                  <button key={k.key} type="button" onClick={() => setKind(k.key)} aria-pressed={kind === k.key} data-kind={k.key}
                    className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-semibold ${kind === k.key ? "border-blue-500 bg-blue-50 text-blue-800" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}>
                    <Icon className="w-4 h-4" aria-hidden /> {k.short}
                  </button>
                );
              })}
            </div>
          </fieldset>
          {lengths.length > 1 && (
            <fieldset>
              <legend className="block text-xs font-medium text-gray-700 mb-1.5">How long</legend>
              <div className="flex flex-wrap gap-2">
                {lengths.map((l) => (
                  <button key={l.key} type="button" onClick={() => setLength(l.key)} aria-pressed={len === l.key} data-length={l.key}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${len === l.key ? "border-blue-500 bg-blue-50 text-blue-800" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}>{l.label}</button>
                ))}
              </div>
            </fieldset>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className={len === "days" ? "" : "col-span-2"}>
              <label htmlFor="to-from" className="block text-xs font-medium text-gray-700 mb-1">{len === "days" ? "First day" : "Day"}</label>
              <input id="to-from" type="date" value={from} min={minDay} onChange={(e) => { setFrom(e.target.value); if (to < e.target.value) setTo(e.target.value); }} className={inputCls} />
            </div>
            {len === "days" && (
              <div>
                <label htmlFor="to-to" className="block text-xs font-medium text-gray-700 mb-1">Last day</label>
                <input id="to-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={inputCls} />
              </div>
            )}
            {len === "hours" && (
              <>
                <div>
                  <label htmlFor="to-start" className="block text-xs font-medium text-gray-700 mb-1">From</label>
                  <input id="to-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label htmlFor="to-end" className="block text-xs font-medium text-gray-700 mb-1">Until</label>
                  <input id="to-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputCls} />
                </div>
              </>
            )}
          </div>
          <div>
            <label htmlFor="to-reason" className="block text-xs font-medium text-gray-700 mb-1">Note <span className="font-normal text-gray-400">(optional)</span></label>
            <textarea id="to-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} rows={2} className={inputCls}
              placeholder={kind === "sick" ? "For example: flu, back on Thursday" : "For example: family wedding"} />
          </div>
          <div className="rounded-xl bg-gray-50 px-3 py-2.5 text-sm text-gray-700" data-counts>
            {from ? <>This counts as <b>{len === "hours" ? `${fmtHours(Math.max(0, (Date.parse(`2000-01-01T${endTime}:00Z`) - Date.parse(`2000-01-01T${startTime}:00Z`)) / 3600000))} (${fmtDays(counts)})` : fmtDays(counts)}</b>{counts === 0 ? " (no work days in these dates)" : ""}: {leaveWhen(input)}.</> : "Pick a day."}
            {!hrMode && kind !== "sick" && noticeDays > 0 && <span className="block text-xs text-gray-500 mt-1">Ask at least {noticeDays} {noticeDays === 1 ? "day" : "days"} ahead.</span>}
            {!hrMode && kind === "sick" && <span className="block text-xs text-gray-500 mt-1">Sick days can also be today or the last days.</span>}
            {!hrMode && unit !== "hour" && <span className="block text-xs text-gray-500 mt-1">The smallest time off here is {unit === "half" ? "half a day" : "1 day"}.</span>}
          </div>
          {error && <p className="text-sm text-red-600" role="alert" data-error>{error}</p>}
        </div>
        <div className="flex justify-end gap-2 px-5 pb-5">
          <button type="button" onClick={onClose} className={btnGhost} disabled={busy}>Cancel</button>
          <button type="button" onClick={send} disabled={busy || !from || (staff && !userId)} className={btnPrimary} data-go="send">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} {hrMode ? "Add time off" : kind === "sick" ? "Report sick" : "Send request"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** One time off line (used in lists) */
export function LeaveLine({ l, who, right }: { l: Leave; who?: string; right?: React.ReactNode }) {
  const Icon = KIND_ICON[l.kind];
  const k = LEAVE_KINDS.find((x) => x.key === l.kind)!;
  return (
    <div className="flex items-start gap-3" data-leave={l.id}>
      <span className="mt-0.5 w-8 h-8 shrink-0 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center"><Icon className="w-4 h-4" aria-hidden /></span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {who && <span className="text-sm font-semibold text-gray-900">{who}</span>}
          <span className="text-sm text-gray-800">{k.label}: {leaveWhen(l)}</span>
          <StatusPill status={l.status} />
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{leaveAmount(l)}{l.startTime ? ` (${fmtDays(l.days)})` : ""}{l.reason ? ` · "${l.reason}"` : ""}{l.answer ? ` · Answer: "${l.answer}"` : ""}</p>
      </div>
      {right}
    </div>
  );
}
