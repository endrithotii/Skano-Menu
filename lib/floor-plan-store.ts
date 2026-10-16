// Floor plan & tables (server side): load and save. See lib/floor-plan.ts.

import { prisma } from "@/lib/db";
import { sanitizePlan, type FloorPlan } from "@/lib/floor-plan";

const PREFIX = '{"type":"floor-plan"';

export async function loadFloorPlan(restaurantId: string): Promise<{ plan: FloorPlan; updatedAt: string | null } | null> {
  const row: { id: string; data: string } | null = await prisma.menuSnapshot.findFirst({
    where: { restaurantId, data: { startsWith: PREFIX } }, select: { id: true, data: true },
  });
  if (!row) return null;
  try {
    const d = JSON.parse(row.data);
    return { plan: sanitizePlan(d.plan), updatedAt: typeof d.updatedAt === "string" ? d.updatedAt : null };
  } catch {
    return null;
  }
}

export async function saveFloorPlan(restaurantId: string, plan: FloorPlan) {
  const updatedAt = new Date().toISOString();
  const data = JSON.stringify({ type: "floor-plan", plan, updatedAt });
  const row = await prisma.menuSnapshot.findFirst({ where: { restaurantId, data: { startsWith: PREFIX } }, select: { id: true } });
  if (row) await prisma.menuSnapshot.update({ where: { id: row.id }, data: { data } });
  else await prisma.menuSnapshot.create({ data: { restaurantId, label: "Floor plan", data } });
  return updatedAt;
}
