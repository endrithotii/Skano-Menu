// Staff & roles (server side): who may do what for a restaurant. See lib/permissions.ts.
//
// Stored in the MenuSnapshot table (no migration), one record per restaurant:
//   '{"type":"staff-access","roles":[...],"members":{"<userId>":{ roleId, from, until, rules }}}'
// Staff accounts are users with staffRestaurantId = the restaurant (role WAITER, CHEF or STAFF).
// The owner (and a super admin) can always do everything.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  ALL_PERMISSIONS, BUILTIN_ROLES, effectivePermissions, emptyMember, sanitizeMember, sanitizeRoles,
  type Member, type Permission, type StaffAccess,
} from "@/lib/permissions";

const PREFIX = '{"type":"staff-access"';
const LOYALTY_SETTINGS = '{"type":"loyalty-settings"';

export const STAFF_ROLES = ["WAITER", "CHEF", "STAFF"];

interface Row { id: string; data: string }

/** Older accounts from before Staff & roles: waiters who could confirm stamps -> Waiter, chefs -> Chef */
async function defaults(restaurantId: string): Promise<StaffAccess> {
  const users: { id: string; role: string }[] = await prisma.user.findMany({
    where: { staffRestaurantId: restaurantId }, select: { id: true, role: true },
  });
  let stampers: string[] = [];
  try {
    const row: Row | null = await prisma.menuSnapshot.findFirst({ where: { restaurantId, data: { startsWith: LOYALTY_SETTINGS } }, select: { id: true, data: true } });
    const ids = row ? JSON.parse(row.data).stampWaiters : [];
    stampers = Array.isArray(ids) ? ids : [];
  } catch { /* none */ }
  const members: Record<string, Member> = {};
  for (const u of users) {
    if (u.role === "CHEF") members[u.id] = { ...emptyMember(), roleId: "chef" };
    else if (u.role === "WAITER") members[u.id] = { ...emptyMember(), roleId: stampers.includes(u.id) ? "waiter" : null };
  }
  return { roles: BUILTIN_ROLES.map((r) => ({ ...r, permissions: [...r.permissions] })), members };
}

export async function loadStaffAccess(restaurantId: string): Promise<StaffAccess> {
  const row: Row | null = await prisma.menuSnapshot.findFirst({
    where: { restaurantId, data: { startsWith: PREFIX } }, select: { id: true, data: true },
  });
  if (!row) return defaults(restaurantId);
  try {
    const d = JSON.parse(row.data);
    const roles = sanitizeRoles(d.roles);
    const members: Record<string, Member> = {};
    for (const [id, m] of Object.entries(d.members ?? {})) if (/^[\w-]{1,60}$/.test(id)) members[id] = sanitizeMember(m, roles);
    return { roles, members };
  } catch {
    return defaults(restaurantId);
  }
}

export async function saveStaffAccess(restaurantId: string, access: StaffAccess) {
  const data = JSON.stringify({ type: "staff-access", roles: access.roles, members: access.members });
  const row = await prisma.menuSnapshot.findFirst({ where: { restaurantId, data: { startsWith: PREFIX } }, select: { id: true } });
  if (row) await prisma.menuSnapshot.update({ where: { id: row.id }, data: { data } });
  else await prisma.menuSnapshot.create({ data: { restaurantId, label: "Staff and roles", data } });
}

type Session = { id: string; role: string } | null;
type RestaurantRef = { id: string; ownerId: string };

export interface Access {
  /** Owner or super admin: everything, always */
  owner: boolean;
  /** A staff account of this restaurant */
  staff: boolean;
  permissions: Set<Permission>;
}

/** What this signed-in user may do for this restaurant right now */
export async function accessFor(session: Session, restaurant: RestaurantRef, now = new Date()): Promise<Access> {
  if (!session) return { owner: false, staff: false, permissions: new Set() };
  if (session.role === "SUPER_ADMIN" || session.id === restaurant.ownerId) {
    return { owner: true, staff: false, permissions: new Set(ALL_PERMISSIONS) };
  }
  const user = await prisma.user.findFirst({ where: { id: session.id, staffRestaurantId: restaurant.id }, select: { id: true } });
  if (!user) return { owner: false, staff: false, permissions: new Set() };
  const access = await loadStaffAccess(restaurant.id);
  return { owner: false, staff: true, permissions: effectivePermissions(access, access.members[session.id], now) };
}

/** Allowed if the user has at least one of the actions */
export async function can(session: Session, restaurant: RestaurantRef, need: Permission | Permission[]): Promise<boolean> {
  const a = await accessFor(session, restaurant);
  return (Array.isArray(need) ? need : [need]).some((p) => a.permissions.has(p));
}

/** For API routes: null when allowed, otherwise the 403 response to return */
export async function forbidUnless(session: Session, restaurant: RestaurantRef, need: Permission | Permission[]): Promise<NextResponse | null> {
  if (await can(session, restaurant, need)) return null;
  return NextResponse.json({ error: "You don't have access to this. Ask the manager to give you access on Staff & roles." }, { status: 403 });
}
