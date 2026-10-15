// Scheduled menus: a saved menu (from the Menu history) shown from a start time, optionally until an end time.
//
// Stored in the MenuSnapshot table (no migration), one row each:
//   data = '{"type":"schedule","menuId":...,"startAt":ISO,"endAt":ISO|null,"appliedAt":ISO|null}'
//
// - With an end time (temporary): while it runs, customers see that menu. When it ends, they automatically
//   see what was active before again, because the restaurant's own menu was never changed.
// - Without an end time: at the start time it simply becomes the active menu (written to the restaurant once).
// Nothing runs in the background: schedules are checked whenever the menu is opened.

import { prisma } from "@/lib/db";
import { listBookMenus, recordLiveMenu } from "@/lib/menu-history";

export const SCHEDULE_DATA_PREFIX = '{"type":"schedule"';
const MAX_SCHEDULES = 100;
/** Finished schedules are kept this long, then removed */
const KEEP_FINISHED_MS = 60 * 24 * 60 * 60 * 1000;

export interface MenuSchedule {
  id: string;
  menuId: string;
  startAt: string;
  endAt: string | null;
  /** Permanent schedules: when it was made the active menu */
  appliedAt: string | null;
  createdAt: string;
}

export type ScheduleStatus = "upcoming" | "running" | "finished";

export function scheduleStatus(s: Pick<MenuSchedule, "startAt" | "endAt" | "appliedAt">, now = Date.now()): ScheduleStatus {
  if (Date.parse(s.startAt) > now) return "upcoming";
  if (s.endAt) return Date.parse(s.endAt) > now ? "running" : "finished";
  return "finished"; // permanent ones are done once they started (the menu is then simply active)
}

interface Row { id: string; data: string; createdAt: Date }

function toSchedule(r: Row): MenuSchedule | null {
  try {
    const d = JSON.parse(r.data);
    if (d?.type !== "schedule" || typeof d.menuId !== "string" || typeof d.startAt !== "string") return null;
    return {
      id: r.id,
      menuId: d.menuId,
      startAt: d.startAt,
      endAt: typeof d.endAt === "string" ? d.endAt : null,
      appliedAt: typeof d.appliedAt === "string" ? d.appliedAt : null,
      createdAt: new Date(r.createdAt).toISOString(),
    };
  } catch {
    return null;
  }
}

const toData = (s: Omit<MenuSchedule, "id" | "createdAt">) =>
  JSON.stringify({ type: "schedule", menuId: s.menuId, startAt: s.startAt, endAt: s.endAt, appliedAt: s.appliedAt });

export async function listSchedules(restaurantId: string): Promise<MenuSchedule[]> {
  const rows: Row[] = await prisma.menuSnapshot.findMany({
    where: { restaurantId, data: { startsWith: SCHEDULE_DATA_PREFIX } },
    orderBy: { createdAt: "desc" },
    take: MAX_SCHEDULES,
    select: { id: true, data: true, createdAt: true },
  });
  const all = rows.map(toSchedule).filter((s): s is MenuSchedule => !!s);
  // Tidy up: old finished schedules
  const old = all.filter((s) => {
    const end = s.endAt ? Date.parse(s.endAt) : s.appliedAt ? Date.parse(s.appliedAt) : NaN;
    return Number.isFinite(end) && Date.now() - end > KEEP_FINISHED_MS;
  });
  if (old.length) await prisma.menuSnapshot.deleteMany({ where: { restaurantId, id: { in: old.map((s) => s.id) } } }).catch(() => {});
  return all.filter((s) => !old.includes(s)).sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
}

export async function createSchedule(restaurantId: string, s: { menuId: string; startAt: string; endAt: string | null }): Promise<string> {
  const row = await prisma.menuSnapshot.create({
    data: { restaurantId, label: "Scheduled menu", data: toData({ ...s, appliedAt: null }) },
  });
  return row.id;
}

export async function updateSchedule(restaurantId: string, id: string, s: { startAt: string; endAt: string | null; menuId: string }) {
  await prisma.menuSnapshot.updateMany({
    where: { restaurantId, id, data: { startsWith: SCHEDULE_DATA_PREFIX } },
    data: { data: toData({ ...s, appliedAt: null }) },
  });
}

export async function deleteSchedule(restaurantId: string, id: string) {
  await prisma.menuSnapshot.deleteMany({ where: { restaurantId, id, data: { startsWith: SCHEDULE_DATA_PREFIX } } });
}

/** Newest version of each saved menu */
async function newestVersions(restaurantId: string): Promise<Map<string, { menuPdfUrl: string; menuPdfName: string | null; title: string }>> {
  const out = new Map<string, { menuPdfUrl: string; menuPdfName: string | null; title: string }>();
  for (const m of await listBookMenus(restaurantId)) {
    out.set(m.menuId, { menuPdfUrl: m.versions[0].menuPdfUrl, menuPdfName: m.versions[0].menuPdfName, title: m.title });
  }
  return out;
}

interface RestaurantLike {
  id: string;
  name?: string | null;
  menuPdfUrl: string | null;
  menuPdfName: string | null;
  primaryMenu: string;
  updatedAt?: Date | null;
}

/**
 * Makes started schedules without an end time the active menu (once each).
 * Returns the restaurant as it is now.
 */
export async function applyDueSchedules<R extends RestaurantLike>(restaurant: R, schedules?: MenuSchedule[]): Promise<R> {
  const list = schedules ?? (await listSchedules(restaurant.id));
  const now = Date.now();
  const due = list.filter((s) => !s.endAt && !s.appliedAt && Date.parse(s.startAt) <= now);
  if (!due.length) return restaurant;
  const versions = await newestVersions(restaurant.id);
  const latest = [...due].sort((a, b) => Date.parse(b.startAt) - Date.parse(a.startAt))[0];
  const v = versions.get(latest.menuId);
  let updated = restaurant;
  if (v) {
    await recordLiveMenu(restaurant);
    await prisma.restaurant.update({ where: { id: restaurant.id }, data: { menuPdfUrl: v.menuPdfUrl, menuPdfName: v.menuPdfName, primaryMenu: "static" } });
    updated = { ...restaurant, menuPdfUrl: v.menuPdfUrl, menuPdfName: v.menuPdfName, primaryMenu: "static" };
  }
  const stamp = new Date().toISOString();
  for (const s of due) {
    await prisma.menuSnapshot.update({ where: { id: s.id }, data: { data: toData({ ...s, appliedAt: stamp }) } }).catch(() => {});
  }
  return updated;
}

/** What customers should see right now: a running temporary schedule, else the restaurant's own menu */
export async function effectiveMenu(restaurant: RestaurantLike): Promise<{
  menuPdfUrl: string | null; menuPdfName: string | null; primaryMenu: string; scheduledUntil: string | null;
}> {
  const schedules = await listSchedules(restaurant.id);
  const current = await applyDueSchedules(restaurant, schedules);
  const now = Date.now();
  const running = schedules
    .filter((s) => s.endAt && Date.parse(s.startAt) <= now && Date.parse(s.endAt) > now)
    .sort((a, b) => Date.parse(b.startAt) - Date.parse(a.startAt));
  if (running.length) {
    const versions = await newestVersions(restaurant.id);
    for (const s of running) {
      const v = versions.get(s.menuId);
      if (v) return { menuPdfUrl: v.menuPdfUrl, menuPdfName: v.menuPdfName, primaryMenu: "static", scheduledUntil: s.endAt };
    }
  }
  return { menuPdfUrl: current.menuPdfUrl, menuPdfName: current.menuPdfName, primaryMenu: current.primaryMenu, scheduledUntil: null };
}
