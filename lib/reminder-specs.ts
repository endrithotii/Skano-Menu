// Reservation reminders: the parts the dashboard and the server share (no server imports). See lib/reservation-reminders.ts.

export interface Recipients { owner: boolean; roles: string[]; users: string[] }

/** What the dashboard sends for one reminder */
export interface ReminderSpec {
  id?: string;
  kind: "staff" | "customer";
  beforeMin: number | null;
  at?: string | null;
  text: string;
  to?: Recipients;
  /** Settings only: the person who accepts the reservation gets it */
  me?: boolean;
}

export const BEFORE_OPTIONS = [30, 60, 120, 180, 360, 720, 1440, 2880, 4320, 10080];
export const DEFAULT_STAFF_TEXT = "{name}'s reservation is {day} at {time} ({guests} persons). Call {phone} to confirm.";
export const DEFAULT_CUSTOMER_TEXT = "Don't forget, you have a reservation at {restaurant} {day} at {time} for {guests} persons.";
export const DEFAULT_REMINDERS: ReminderSpec[] = [
  { kind: "staff", beforeMin: 1440, text: DEFAULT_STAFF_TEXT, me: true, to: { owner: false, roles: [], users: [] } },
  { kind: "customer", beforeMin: 1440, text: DEFAULT_CUSTOMER_TEXT },
];

const ids = (v: unknown, n = 30) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && /^[\w-]{1,60}$/.test(x)))].slice(0, n) : []);
export function sanitizeRecipients(v: unknown): Recipients {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return { owner: o.owner === true, roles: ids(o.roles), users: ids(o.users) };
}

export function sanitizeSpec(v: unknown, settings = false): ReminderSpec | null {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const kind = o.kind === "customer" ? "customer" : o.kind === "staff" ? "staff" : null;
  if (!kind) return null;
  const beforeMin = typeof o.beforeMin === "number" && BEFORE_OPTIONS.includes(o.beforeMin) ? o.beforeMin : null;
  const at = typeof o.at === "string" && Number.isFinite(Date.parse(o.at)) ? new Date(o.at).toISOString() : null;
  // Settings only have "before" times, a chosen date belongs to one reservation
  if (beforeMin === null && (settings || !at)) return null;
  const text = typeof o.text === "string" ? o.text.replace(/\r/g, "").trim().slice(0, 500) : "";
  return {
    ...(typeof o.id === "string" && /^[\w-]{1,60}$/.test(o.id) ? { id: o.id } : {}),
    kind, beforeMin, at: beforeMin === null ? at : null,
    text: text || (kind === "staff" ? DEFAULT_STAFF_TEXT : DEFAULT_CUSTOMER_TEXT),
    ...(kind === "staff" ? { to: sanitizeRecipients(o.to), ...(o.me === true ? { me: true } : {}) } : {}),
  };
}

export function sanitizeSpecs(v: unknown, settings = false): ReminderSpec[] {
  return (Array.isArray(v) ? v : []).slice(0, 10).map((x) => sanitizeSpec(x, settings)).filter((x): x is ReminderSpec => !!x);
}

/** "1 day", "2 hours", "30 minutes" */
export function beforeLabel(min: number): string {
  if (min % 1440 === 0) { const d = min / 1440; return d === 7 ? "1 week" : `${d} day${d === 1 ? "" : "s"}`; }
  if (min % 60 === 0) { const h = min / 60; return `${h} hour${h === 1 ? "" : "s"}`; }
  return `${min} minutes`;
}
