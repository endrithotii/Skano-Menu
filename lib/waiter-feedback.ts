// Feedback about waiters: customers rate a waiter under More on the menu (when the manager turns it on).
// Saved in the MenuSnapshot table (no migration):
//   '{"type":"waiter-feedback-settings","enabled":false,"people":null,"showToWaiters":false}'   one per restaurant
//   '{"type":"waiter-feedback","waiterId":"…","rating":5,"tags":[...],"comment":"…","customerName":"…"}'   one per feedback
// people: null = everyone who has the Waiter role right now, or a list of staff the manager picked.
// Customers only see first names.

import { prisma } from "@/lib/db";
import { activeRoles } from "@/lib/permissions";
import { STAFF_ROLES, loadStaffAccess } from "@/lib/staff-access";

const SETTINGS = '{"type":"waiter-feedback-settings"';
const ITEM = '{"type":"waiter-feedback"';
const ITEM_FOR = (waiterId: string) => `${ITEM},"waiterId":${JSON.stringify(waiterId)}`;

/** Things customers can tap (besides the stars) */
export const WAITER_TAGS = ["Friendly", "Fast", "Helpful", "Knew the menu", "Good advice", "Attentive", "Slow", "Unfriendly", "Forgot something"];
export const GOOD_TAGS = new Set(["Friendly", "Fast", "Helpful", "Knew the menu", "Good advice", "Attentive"]);

export interface WaiterFeedbackSettings {
  enabled: boolean;
  /** null = everyone with the Waiter role */
  people: string[] | null;
  /** Waiters see the feedback about themselves on My work */
  showToWaiters: boolean;
}
export interface WaiterFeedback {
  id: string; waiterId: string; rating: number; tags: string[]; comment: string; customerName: string; createdAt: string;
}

const DEFAULTS: WaiterFeedbackSettings = { enabled: false, people: null, showToWaiters: false };

export function sanitizeWaiterSettings(v: unknown): WaiterFeedbackSettings {
  const s = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const people = Array.isArray(s.people) ? [...new Set(s.people.filter((x): x is string => typeof x === "string" && /^[\w-]{1,60}$/.test(x)))].slice(0, 200) : null;
  return { enabled: s.enabled === true, people, showToWaiters: s.showToWaiters === true };
}

export async function loadWaiterSettings(restaurantId: string): Promise<WaiterFeedbackSettings> {
  const row: { data: string } | null = await prisma.menuSnapshot.findFirst({ where: { restaurantId, data: { startsWith: SETTINGS } }, select: { data: true } });
  if (!row) return { ...DEFAULTS };
  try { return sanitizeWaiterSettings(JSON.parse(row.data)); } catch { return { ...DEFAULTS }; }
}

export async function saveWaiterSettings(restaurantId: string, s: WaiterFeedbackSettings) {
  const data = JSON.stringify({ type: "waiter-feedback-settings", enabled: s.enabled, people: s.people, showToWaiters: s.showToWaiters });
  const row = await prisma.menuSnapshot.findFirst({ where: { restaurantId, data: { startsWith: SETTINGS } }, select: { id: true } });
  if (row) await prisma.menuSnapshot.update({ where: { id: row.id }, data: { data } });
  else await prisma.menuSnapshot.create({ data: { restaurantId, label: "Waiter feedback settings", data } });
}

export interface StaffForFeedback { id: string; name: string; firstName: string; roles: string[]; waiterRole: boolean }

/** All staff accounts, with whether they have the Waiter role now */
export async function staffForFeedback(restaurantId: string): Promise<StaffForFeedback[]> {
  const users: { id: string; name: string | null; email: string }[] = await prisma.user.findMany({
    where: { staffRestaurantId: restaurantId, role: { in: STAFF_ROLES } }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" },
  });
  const access = await loadStaffAccess(restaurantId);
  return users.map((u) => {
    const roles = activeRoles(access, access.members[u.id]);
    const name = (u.name || u.email.split("@")[0]).trim();
    return { id: u.id, name, firstName: name.split(/\s+/)[0], roles: roles.map((r) => r.name), waiterRole: roles.some((r) => r.id === "waiter") };
  });
}

/** Who customers can rate right now */
export function rateable(settings: WaiterFeedbackSettings, staff: StaffForFeedback[]): StaffForFeedback[] {
  return settings.people === null ? staff.filter((s) => s.waiterRole) : staff.filter((s) => settings.people!.includes(s.id));
}

/** What customers see: first names, plus the first letter of the last name when two have the same first name */
export function publicNames(list: StaffForFeedback[]): { id: string; name: string }[] {
  const count = new Map<string, number>();
  for (const s of list) count.set(s.firstName.toLowerCase(), (count.get(s.firstName.toLowerCase()) ?? 0) + 1);
  return list.map((s) => {
    const parts = s.name.split(/\s+/);
    const twin = (count.get(s.firstName.toLowerCase()) ?? 0) > 1 && parts[1];
    return { id: s.id, name: twin ? `${s.firstName} ${parts[1][0]}.` : s.firstName };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

export async function addWaiterFeedback(restaurantId: string, f: Omit<WaiterFeedback, "id" | "createdAt">): Promise<WaiterFeedback> {
  const createdAt = new Date();
  const data = JSON.stringify({ type: "waiter-feedback", waiterId: f.waiterId, rating: f.rating, tags: f.tags, comment: f.comment, customerName: f.customerName });
  const row = await prisma.menuSnapshot.create({ data: { restaurantId, label: "Waiter feedback", data, createdAt } });
  return { ...f, id: row.id, createdAt: createdAt.toISOString() };
}

export async function listWaiterFeedback(restaurantId: string, waiterId?: string): Promise<WaiterFeedback[]> {
  const rows: { id: string; data: string; createdAt: Date }[] = await prisma.menuSnapshot.findMany({
    where: { restaurantId, data: { startsWith: waiterId ? ITEM_FOR(waiterId) : `${ITEM},` } },
    select: { id: true, data: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 2000,
  });
  const out: WaiterFeedback[] = [];
  for (const r of rows) {
    try {
      const d = JSON.parse(r.data);
      out.push({ id: r.id, waiterId: d.waiterId, rating: d.rating, tags: Array.isArray(d.tags) ? d.tags : [], comment: d.comment ?? "", customerName: d.customerName ?? "", createdAt: new Date(r.createdAt).toISOString() });
    } catch { /* skip */ }
  }
  return out;
}

export async function deleteWaiterFeedback(restaurantId: string, id: string) {
  await prisma.menuSnapshot.deleteMany({ where: { id, restaurantId, data: { startsWith: `${ITEM},` } } });
}

/** Simple protection against one phone sending a lot: max 5 per 10 minutes per address and restaurant */
const recent = new Map<string, number[]>();
export function tooMany(key: string, now = Date.now()): boolean {
  const list = (recent.get(key) ?? []).filter((t) => now - t < 10 * 60_000);
  if (list.length >= 5) { recent.set(key, list); return true; }
  list.push(now); recent.set(key, list);
  if (recent.size > 5000) for (const k of [...recent.keys()].slice(0, 1000)) recent.delete(k);
  return false;
}
