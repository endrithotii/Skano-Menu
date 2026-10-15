// Action history (server side): every change anyone makes, with who did it and the roles they had then.
//
// One row per action in the MenuSnapshot table (no migration), its createdAt is the time of the action:
//   '{"type":"action-log","action":"dish.price","userId":"…","roleKeys":"|chef|waiter|","userName":…,"roles":[…],"summary":…,"details":[…]}'
// The order of the first keys matters: filters use "starts with" for the action and "contains" for the person and roles.

import { prisma } from "@/lib/db";
import { activeRoles } from "@/lib/permissions";
import { loadStaffAccess } from "@/lib/staff-access";
import { isActionType, type ActionEntry, type ActionType } from "@/lib/action-log-types";

const PREFIX = '{"type":"action-log"';

type Session = { id: string; role: string; name?: string; email?: string } | null;
type RestaurantRef = { id: string; ownerId: string };

/** The roles someone has right now, for the record */
async function rolesOf(session: NonNullable<Session>, restaurant: RestaurantRef): Promise<{ id: string; name: string }[]> {
  if (session.id === restaurant.ownerId) return [{ id: "owner", name: "Owner" }];
  if (session.role === "SUPER_ADMIN") return [{ id: "admin", name: "Platform admin" }];
  const access = await loadStaffAccess(restaurant.id);
  return activeRoles(access, access.members[session.id]).map((r) => ({ id: r.id, name: r.name }));
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * Saves one action. Never throws: a failing history must not stop the change itself.
 * summary: one sentence ("Changed the price of Omelette from €4 to €5"), details: extra lines (optional).
 */
export async function logAction(session: Session, restaurant: RestaurantRef, action: ActionType, summary: string, details: string[] = []) {
  if (!session) return;
  try {
    const user: { name: string | null; email: string } | null = await prisma.user.findFirst({ where: { id: session.id }, select: { name: true, email: true } });
    const roles = await rolesOf(session, restaurant);
    const data = JSON.stringify({
      type: "action-log", action, userId: session.id, roleKeys: `|${roles.map((r) => r.id).join("|")}|`,
      userName: user?.name ?? session.name ?? "", userEmail: user?.email ?? session.email ?? "",
      roles, summary: clip(summary, 300), details: details.slice(0, 40).map((d) => clip(d, 300)),
    });
    await prisma.menuSnapshot.create({ data: { restaurantId: restaurant.id, label: "Action", data, createdAt: new Date() } });
  } catch (error) {
    console.error("[action-log] could not save", action, error);
  }
}

export interface ActionFilter {
  roles?: string[];
  users?: string[];
  actions?: ActionType[];
  from?: Date | null;
  until?: Date | null;
}

const esc = (s: string) => s.replace(/[^\w-]/g, "");

/** Newest first. `before`: continue after this time (the "at" of the last entry shown) */
export async function listActions(restaurantId: string, f: ActionFilter, before: Date | null, limit = 50): Promise<{ entries: ActionEntry[]; more: boolean }> {
  const and: Record<string, unknown>[] = [];
  if (f.actions?.length) and.push({ OR: f.actions.map((a) => ({ data: { startsWith: `${PREFIX},"action":"${a}",` } })) });
  else and.push({ data: { startsWith: PREFIX } });
  if (f.users?.length) and.push({ OR: f.users.map((u) => ({ data: { contains: `"userId":"${esc(u)}",` } })) });
  if (f.roles?.length) and.push({ OR: f.roles.map((r) => ({ data: { contains: `|${esc(r)}|` } })) });
  const createdAt: Record<string, Date> = {};
  if (f.from) createdAt.gte = f.from;
  if (f.until) createdAt.lte = f.until;
  if (before) createdAt.lt = before;
  const rows: { id: string; data: string; createdAt: Date }[] = await prisma.menuSnapshot.findMany({
    where: { restaurantId, AND: and, ...(Object.keys(createdAt).length ? { createdAt } : {}) },
    select: { id: true, data: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
  });
  const entries: ActionEntry[] = [];
  for (const r of rows.slice(0, limit)) {
    try {
      const d = JSON.parse(r.data);
      if (d?.type !== "action-log" || !isActionType(d.action)) continue;
      entries.push({
        id: r.id, at: new Date(r.createdAt).toISOString(), action: d.action, userId: String(d.userId ?? ""),
        userName: String(d.userName ?? ""), userEmail: String(d.userEmail ?? ""),
        roles: Array.isArray(d.roles) ? d.roles : [], summary: String(d.summary ?? ""), details: Array.isArray(d.details) ? d.details.map(String) : [],
      });
    } catch { /* skip a broken row */ }
  }
  return { entries, more: rows.length > limit };
}
