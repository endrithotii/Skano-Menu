// What the HR tab loads from /api/restaurants/[id]/hr?scope=team
import type { Balance, HrSettings, Leave, PersonHr, TimeEntry } from "@/lib/hr";

export interface StaffRow {
  id: string; name: string; email: string; roles: string[];
  person: PersonHr;
  hours: { worked: number; planned: number; diff: number };
  balances: Balance[];
  open: TimeEntry | null;
}

export interface Team {
  manage: boolean; timeZone: string; today: string; from: string; to: string;
  settings: HrSettings; staff: StaffRow[]; entries: TimeEntry[]; leaves: Leave[]; forgot: string[];
}

/** Sends one HR action; returns the error text or null */
export type Post = (body: Record<string, unknown>) => Promise<string | null>;

export const browserZone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return "UTC"; } };

/** <input type="datetime-local"> value of an ISO time, in this browser's time */
export const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
export const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);
