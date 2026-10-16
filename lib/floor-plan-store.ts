// Floor plan & tables (server side): load and save, with scheduled changes. See lib/floor-plan.ts.

import { prisma } from "@/lib/db";
import { planAt, sanitizePlan, sanitizeSchedules, type FloorPlan, type ScheduledPlan } from "@/lib/floor-plan";

const PREFIX = '{"type":"floor-plan"';

export interface StoredFloor { plan: FloorPlan; schedules: ScheduledPlan[]; updatedAt: string | null }

export async function loadFloorPlan(restaurantId: string): Promise<StoredFloor | null> {
  const row: { id: string; data: string } | null = await prisma.menuSnapshot.findFirst({
    where: { restaurantId, data: { startsWith: PREFIX } }, select: { id: true, data: true },
  });
  if (!row) return null;
  try {
    const d = JSON.parse(row.data);
    return { plan: sanitizePlan(d.plan), schedules: sanitizeSchedules(d.schedules), updatedAt: typeof d.updatedAt === "string" ? d.updatedAt : null };
  } catch {
    return null;
  }
}

export async function saveFloor(restaurantId: string, plan: FloorPlan, schedules: ScheduledPlan[]) {
  const updatedAt = new Date().toISOString();
  const data = JSON.stringify({ type: "floor-plan", plan, schedules, updatedAt });
  const row = await prisma.menuSnapshot.findFirst({ where: { restaurantId, data: { startsWith: PREFIX } }, select: { id: true } });
  if (row) await prisma.menuSnapshot.update({ where: { id: row.id }, data: { data } });
  else await prisma.menuSnapshot.create({ data: { restaurantId, label: "Floor plan", data } });
  return updatedAt;
}

/** The plan customers see at a moment (a scheduled change counts from its start) */
export async function floorPlanAt(restaurantId: string, at: Date): Promise<{ plan: FloorPlan; scheduleId: string | null } | null> {
  const f = await loadFloorPlan(restaurantId);
  return f ? planAt(f.plan, f.schedules, at) : null;
}
