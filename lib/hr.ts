// HR: check in / check out, time off, work times, contracts. Shared by the API and the dashboard (no server-only imports).
//
// Days are "YYYY-MM-DD" in the restaurant's time zone. Times of day are "HH:MM". Check-ins are ISO times.
// The year for time off runs January to December.

export type LeaveKind = "vacation" | "sick" | "unpaid";
export type LeaveStatus = "pending" | "approved" | "declined" | "cancelled";
/** The smallest time off someone may ask for */
export type MinUnit = "hour" | "half" | "day";

export const LEAVE_KINDS: { key: LeaveKind; label: string; short: string }[] = [
  { key: "vacation", label: "Vacation", short: "Vacation" },
  { key: "sick", label: "Sick", short: "Sick" },
  { key: "unpaid", label: "Unpaid day off", short: "Unpaid" },
];
export const leaveLabel = (k: LeaveKind) => LEAVE_KINDS.find((x) => x.key === k)?.label ?? k;
/** In a sentence: "asks for vacation", "added sick leave", "cancelled unpaid time off" */
export const leavePhrase = (k: LeaveKind) => (k === "sick" ? "sick leave" : k === "unpaid" ? "unpaid time off" : "vacation");
export const MIN_UNITS: { key: MinUnit; label: string }[] = [
  { key: "hour", label: "1 hour" },
  { key: "half", label: "Half a day" },
  { key: "day", label: "1 day" },
];

/** One block of work in a day. end before start = past midnight */
export interface Shift { start: string; end: string }
/** Monday to Sunday */
export type WeekSchedule = Shift[][];
export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const WEEKDAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export interface HrRules {
  vacationDays: number;
  sickDays: number;
  minUnit: MinUnit;
  /** Vacation and unpaid days must be asked this many days ahead (sick days never) */
  noticeDays: number;
  /** Sick days count right away, HR only gets a notification */
  sickAutoApprove: boolean;
  /** Staff can open their own contract */
  staffSeeOwnDocs: boolean;
}

export interface PersonHr {
  /** null = the restaurant's rule */
  vacationDays: number | null;
  sickDays: number | null;
  minUnit: MinUnit | null;
  /** Extra vacation days this year (e.g. left from last year) */
  extraVacation: number;
  /** Hours per week in the contract (null = what the work times add up to) */
  weeklyHours: number | null;
  position: string;
  startDate: string | null;
  schedule: WeekSchedule;
}

export interface HrSettings {
  timeZone: string;
  rules: HrRules;
  people: Record<string, PersonHr>;
}

export interface TimeEntry {
  id: string;
  userId: string;
  in: string;
  out: string | null;
  note: string;
  /** self = checked in with the button, manual = added or fixed by HR */
  source: "self" | "manual";
  editedBy: string | null;
  editedAt: string | null;
}

export interface Leave {
  id: string;
  userId: string;
  kind: LeaveKind;
  from: string;
  to: string;
  /** Half a day (from = to) */
  half: boolean;
  /** Hours on one day (from = to) */
  startTime: string | null;
  endTime: string | null;
  /** Work days it counts as (0.5 for half a day, hours / that day's hours for hours) */
  days: number;
  hours: number;
  /** Work days per year when it was asked (kept, so later changes to the work times don't change it) */
  byYear?: Record<string, number>;
  reason: string;
  status: LeaveStatus;
  answer: string;
  requestedAt: string;
  /** Who asked (HR can add time off for someone) */
  requestedBy: string;
  decidedBy: string | null;
  decidedAt: string | null;
}

export interface HrDoc {
  id: string;
  userId: string;
  kind: "contract" | "other";
  name: string;
  fileName: string;
  contentType: string;
  size: number;
  validFrom: string | null;
  validUntil: string | null;
  note: string;
  uploadedBy: string;
  uploadedAt: string;
}

export const DEFAULT_RULES: HrRules = { vacationDays: 20, sickDays: 10, minUnit: "day", noticeDays: 0, sickAutoApprove: true, staffSeeOwnDocs: true };
export const emptyWeek = (): WeekSchedule => [[], [], [], [], [], [], []];
export const emptyPerson = (): PersonHr => ({ vacationDays: null, sickDays: null, minUnit: null, extraVacation: 0, weeklyHours: null, position: "", startDate: null, schedule: emptyWeek() });

// ── Cleaning what the dashboard sends ────────────────────────────────────────

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY = /^\d{4}-\d\d-\d\d$/;
export const isTime = (v: unknown): v is string => typeof v === "string" && TIME.test(v);
export const isDay = (v: unknown): v is string => typeof v === "string" && DAY.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
const clip = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");
const num = (v: unknown, min: number, max: number, fallback: number) => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n * 2) / 2)) : fallback;
};
const unit = (v: unknown): MinUnit | null => (v === "hour" || v === "half" || v === "day" ? v : null);
export const validZone = (z: unknown): z is string => {
  if (typeof z !== "string" || !z || z.length > 60) return false;
  try { new Intl.DateTimeFormat("en", { timeZone: z }); return true; } catch { return false; }
};

export function sanitizeRules(v: unknown): HrRules {
  const r = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    vacationDays: num(r.vacationDays, 0, 365, DEFAULT_RULES.vacationDays),
    sickDays: num(r.sickDays, 0, 365, DEFAULT_RULES.sickDays),
    minUnit: unit(r.minUnit) ?? DEFAULT_RULES.minUnit,
    noticeDays: Math.round(num(r.noticeDays, 0, 90, DEFAULT_RULES.noticeDays)),
    sickAutoApprove: typeof r.sickAutoApprove === "boolean" ? r.sickAutoApprove : DEFAULT_RULES.sickAutoApprove,
    staffSeeOwnDocs: typeof r.staffSeeOwnDocs === "boolean" ? r.staffSeeOwnDocs : DEFAULT_RULES.staffSeeOwnDocs,
  };
}

export function sanitizeSchedule(v: unknown): WeekSchedule {
  const days = Array.isArray(v) ? v : [];
  return [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const list = Array.isArray(days[i]) ? days[i] : [];
    const out: Shift[] = [];
    for (const s of list.slice(0, 4)) {
      if (!s || typeof s !== "object") continue;
      const { start, end } = s as Shift;
      if (isTime(start) && isTime(end) && start !== end) out.push({ start, end });
    }
    return out.sort((a, b) => a.start.localeCompare(b.start));
  });
}

export function sanitizePerson(v: unknown): PersonHr {
  const p = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const opt = (x: unknown, max: number) => (x === null || x === undefined || x === "" ? null : num(x, 0, max, 0));
  return {
    vacationDays: opt(p.vacationDays, 365),
    sickDays: opt(p.sickDays, 365),
    minUnit: unit(p.minUnit),
    extraVacation: num(p.extraVacation, -365, 365, 0),
    weeklyHours: opt(p.weeklyHours, 100),
    position: clip(p.position, 60),
    startDate: isDay(p.startDate) ? p.startDate : null,
    schedule: sanitizeSchedule(p.schedule),
  };
}

export function sanitizeSettings(v: unknown, fallbackZone = "UTC"): HrSettings {
  const s = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const people: Record<string, PersonHr> = {};
  const raw = s.people && typeof s.people === "object" ? (s.people as Record<string, unknown>) : {};
  for (const [id, p] of Object.entries(raw).slice(0, 500)) if (/^[\w-]{1,60}$/.test(id)) people[id] = sanitizePerson(p);
  return { timeZone: validZone(s.timeZone) ? s.timeZone : fallbackZone, rules: sanitizeRules(s.rules), people };
}

// ── Days and times ───────────────────────────────────────────────────────────

/** "YYYY-MM-DD" of a moment in a time zone */
export function dayKey(at: Date | string | number, timeZone: string): string {
  const d = new Date(at);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
/** 0 = Monday ... 6 = Sunday */
export const weekdayOf = (day: string) => (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7;
export const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000);
export function eachDay(from: string, to: string, max = 400): string[] {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < max; d = addDays(d, 1)) out.push(d);
  return out;
}
/** Monday of the week of a day */
export const weekStart = (day: string) => addDays(day, -weekdayOf(day));
const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
/** Length of a block in hours (past midnight counts) */
export const shiftHours = (s: Shift) => { const m = minutes(s.end) - minutes(s.start); return (m > 0 ? m : m + 1440) / 60; };
export const dayHours = (shifts: Shift[]) => shifts.reduce((n, s) => n + shiftHours(s), 0);
export const weekHours = (w: WeekSchedule) => w.reduce((n, d) => n + dayHours(d), 0);
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Someone's work times. Nothing set yet = Monday to Friday, 8 hours */
export function hasSchedule(w: WeekSchedule) { return w.some((d) => d.length > 0); }
const DEFAULT_DAY: Shift[] = [{ start: "08:00", end: "16:00" }];
export function shiftsOn(person: PersonHr | undefined, day: string): Shift[] {
  const w = person?.schedule;
  if (w && hasSchedule(w)) return w[weekdayOf(day)] ?? [];
  return weekdayOf(day) < 5 ? DEFAULT_DAY : [];
}
export const isWorkDay = (person: PersonHr | undefined, day: string) => shiftsOn(person, day).length > 0;

/** Rules for one person (their own numbers, else the restaurant's) */
export function rulesFor(settings: HrSettings, userId: string) {
  const p = settings.people[userId];
  return {
    vacationDays: (p?.vacationDays ?? settings.rules.vacationDays) + (p?.extraVacation ?? 0),
    sickDays: p?.sickDays ?? settings.rules.sickDays,
    minUnit: p?.minUnit ?? settings.rules.minUnit,
  };
}

/** How much a time off request counts, per year: { 2026: 3, 2027: 1 } */
export function leaveDaysByYear(person: PersonHr | undefined, l: Pick<Leave, "from" | "to" | "half" | "startTime" | "endTime">): Record<string, number> {
  const out: Record<string, number> = {};
  if (l.startTime && l.endTime) {
    const hours = shiftHours({ start: l.startTime, end: l.endTime });
    const planned = dayHours(shiftsOn(person, l.from)) || 8;
    out[l.from.slice(0, 4)] = round2(Math.min(1, hours / planned));
    return out;
  }
  if (l.half) { out[l.from.slice(0, 4)] = 0.5; return out; }
  for (const d of eachDay(l.from, l.to)) if (isWorkDay(person, d)) out[d.slice(0, 4)] = (out[d.slice(0, 4)] ?? 0) + 1;
  return out;
}
export const leaveDays = (person: PersonHr | undefined, l: Parameters<typeof leaveDaysByYear>[1]) =>
  round2(Object.values(leaveDaysByYear(person, l)).reduce((a, b) => a + b, 0));
export const leaveHours = (person: PersonHr | undefined, l: Pick<Leave, "from" | "to" | "half" | "startTime" | "endTime">) => {
  if (l.startTime && l.endTime) return round2(shiftHours({ start: l.startTime, end: l.endTime }));
  if (l.half) return round2((dayHours(shiftsOn(person, l.from)) || 8) / 2);
  return round2(eachDay(l.from, l.to).reduce((n, d) => n + dayHours(shiftsOn(person, d)), 0));
};

export interface Balance { kind: LeaveKind; allowed: number | null; used: number; pending: number; left: number | null }

/** Vacation and sick days for one person in one year */
export function balances(settings: HrSettings, userId: string, leaves: Leave[], year: string): Balance[] {
  const r = rulesFor(settings, userId);
  const person = settings.people[userId];
  const sum = (kind: LeaveKind, status: LeaveStatus) => round2(leaves
    .filter((l) => l.userId === userId && l.kind === kind && l.status === status)
    .reduce((n, l) => n + ((l.byYear ?? leaveDaysByYear(person, l))[year] ?? 0), 0));
  return LEAVE_KINDS.map(({ key }) => {
    const allowed = key === "vacation" ? r.vacationDays : key === "sick" ? r.sickDays : null;
    const used = sum(key, "approved"), pending = sum(key, "pending");
    return { kind: key, allowed, used, pending, left: allowed === null ? null : round2(allowed - used - pending) };
  });
}

/** Approved time off on a day (for the calendar and the planned hours) */
export function leaveOn(leaves: Leave[], userId: string, day: string): Leave | null {
  return leaves.find((l) => l.userId === userId && l.status === "approved" && l.from <= day && l.to >= day) ?? null;
}

/** Hours someone should work between two days (time off taken out) */
export function plannedHours(settings: HrSettings, userId: string, leaves: Leave[], from: string, to: string): number {
  const person = settings.people[userId];
  let total = 0;
  for (const d of eachDay(from, to)) {
    const h = dayHours(shiftsOn(person, d));
    if (!h) continue;
    const l = leaveOn(leaves, userId, d);
    if (!l) total += h;
    else if (l.startTime && l.endTime) total += Math.max(0, h - shiftHours({ start: l.startTime, end: l.endTime }));
    else if (l.half) total += h / 2;
  }
  return round2(total);
}

/** Hours of one check-in (still open = until now) */
export const entryHours = (e: Pick<TimeEntry, "in" | "out">, now = Date.now()) =>
  Math.max(0, ((e.out ? Date.parse(e.out) : now) - Date.parse(e.in)) / 3600000);

/** Hours worked between two days (by the day of the check-in) */
export function workedHours(entries: TimeEntry[], userId: string, from: string, to: string, timeZone: string, now = Date.now()): number {
  return round2(entries.filter((e) => e.userId === userId).reduce((n, e) => {
    const d = dayKey(e.in, timeZone);
    return d >= from && d <= to ? n + entryHours(e, now) : n;
  }, 0));
}

/** Still checked in after this long = probably forgot to check out */
export const FORGOT_HOURS = 14;

/** "7.5 h" / "7 h 30 min" */
export function fmtHours(h: number): string {
  const total = Math.round(h * 60);
  const hh = Math.floor(Math.abs(total) / 60), mm = Math.abs(total) % 60;
  const sign = total < 0 ? "-" : "";
  return mm ? `${sign}${hh} h ${mm} min` : `${sign}${hh} h`;
}
/** "1 day" / "2.5 days" / "17.75 days" */
export const fmtDays = (n: number) => `${Math.round(n * 100) / 100} ${n === 1 ? "day" : "days"}`;
/** How long a time off is: "2 h" for hours, "half a day", else days */
export const leaveAmount = (l: Pick<Leave, "startTime" | "endTime" | "half" | "days" | "hours">) =>
  l.startTime && l.endTime ? fmtHours(l.hours) : l.half ? "half a day" : fmtDays(l.days);

// ── Checking a time off request ──────────────────────────────────────────────

export interface LeaveInput { kind: LeaveKind; from: string; to: string; half: boolean; startTime: string | null; endTime: string | null; reason: string }

export function readLeaveInput(v: unknown): LeaveInput | string {
  const b = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const kind = LEAVE_KINDS.some((k) => k.key === b.kind) ? (b.kind as LeaveKind) : null;
  if (!kind) return "Pick vacation, sick or unpaid day off";
  if (!isDay(b.from)) return "Pick the first day";
  const to = isDay(b.to) ? b.to : b.from;
  if (to < b.from) return "The last day is before the first day";
  if (daysBetween(b.from, to) > 366) return "That's more than a year";
  const hours = isTime(b.startTime) && isTime(b.endTime);
  if ((hours || b.half === true) && to !== b.from) return "Half a day or hours can only be on one day";
  if (hours && minutes(b.endTime as string) <= minutes(b.startTime as string)) return "The end time must be after the start time";
  return { kind, from: b.from, to, half: !hours && b.half === true, startTime: hours ? (b.startTime as string) : null, endTime: hours ? (b.endTime as string) : null, reason: clip(b.reason, 300) };
}

/** Problems with a request someone makes for themselves (HR can always add time off) */
export function checkOwnRequest(settings: HrSettings, userId: string, input: LeaveInput, existing: Leave[], today: string): string | null {
  const { minUnit } = rulesFor(settings, userId);
  const person = settings.people[userId];
  if (input.startTime && minUnit !== "hour") return `Time off in hours isn't possible here. The smallest time off is ${minUnit === "half" ? "half a day" : "1 day"}.`;
  if (input.startTime && shiftHours({ start: input.startTime, end: input.endTime! }) < 1) return "The smallest time off is 1 hour";
  if (input.half && minUnit === "day") return "Half days aren't possible here. The smallest time off is 1 day.";
  if (input.kind !== "sick") {
    const notice = settings.rules.noticeDays;
    if (input.from < today) return "The first day is in the past";
    if (notice > 0 && daysBetween(today, input.from) < notice) return `Please ask at least ${notice} ${notice === 1 ? "day" : "days"} ahead`;
  } else if (daysBetween(input.from, today) > 14) return "That's more than 2 weeks ago. Ask HR to add it.";
  if (leaveDays(person, input) === 0) return "There are no work days in these dates";
  const clash = existing.find((l) => l.userId === userId && (l.status === "pending" || l.status === "approved") && l.from <= input.to && l.to >= input.from);
  if (clash) return `You already have time off on ${leaveWhen(clash)} (${clash.status === "pending" ? "waiting for an answer" : "approved"})`;
  if (input.kind === "vacation") {
    const left = balances(settings, userId, existing, input.from.slice(0, 4)).find((b) => b.kind === "vacation")?.left ?? 0;
    const need = leaveDaysByYear(person, input)[input.from.slice(0, 4)] ?? 0;
    if (need > left) return `You have ${fmtDays(Math.max(0, left))} of vacation left this year, this needs ${fmtDays(need)}`;
  }
  return null;
}

/** "12 Oct" / "12 to 14 Oct" / "12 Oct, 10:00 to 12:00" */
export function leaveWhen(l: Pick<Leave, "from" | "to" | "half" | "startTime" | "endTime">): string {
  const f = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  if (l.startTime && l.endTime) return `${f(l.from)}, ${l.startTime} to ${l.endTime}`;
  if (l.half) return `${f(l.from)}, half a day`;
  return l.from === l.to ? f(l.from) : `${f(l.from)} to ${f(l.to)}`;
}
