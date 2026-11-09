// Profile photos (server side): each person can add a small round photo of themselves.
//
// Saved in the MenuSnapshot table (no migration), like the other features. One row per person and restaurant:
//   '{"type":"user-photo","userId":"…","url":"https://…"}'
// An owner of several restaurants gets a row in each, so their photo shows wherever they work.
// type and userId come first: lookups use "starts with".

import { prisma } from "@/lib/db";

const PREFIX = '{"type":"user-photo"';
const ofUser = (userId: string) => `${PREFIX},"userId":${JSON.stringify(userId)}`;

interface Row { id: string; data: string }

/** The restaurants a person belongs to: the ones they own, and the one they work at */
export async function restaurantsOf(userId: string): Promise<string[]> {
  const owned: { id: string }[] = await prisma.restaurant.findMany({ where: { ownerId: userId }, select: { id: true } });
  const user: { staffRestaurantId: string | null } | null = await prisma.user.findFirst({ where: { id: userId }, select: { staffRestaurantId: true } });
  const ids = owned.map((r) => r.id);
  if (user?.staffRestaurantId && !ids.includes(user.staffRestaurantId)) ids.push(user.staffRestaurantId);
  return ids;
}

/** The restaurant the dashboard shows for this person (same order as /api/dashboard/access) */
export async function mainRestaurantOf(userId: string): Promise<string | null> {
  const owned: { id: string } | null = await prisma.restaurant.findFirst({ where: { ownerId: userId }, select: { id: true } });
  if (owned) return owned.id;
  const user: { staffRestaurantId: string | null } | null = await prisma.user.findFirst({ where: { id: userId }, select: { staffRestaurantId: true } });
  return user?.staffRestaurantId ?? null;
}

/** Everyone's photo at one restaurant: { userId: url } */
export async function loadPhotos(restaurantId: string): Promise<Record<string, string>> {
  const rows: Row[] = await prisma.menuSnapshot.findMany({ where: { restaurantId, data: { startsWith: PREFIX } }, select: { id: true, data: true }, take: 2000 });
  const out: Record<string, string> = {};
  for (const r of rows) {
    try {
      const d = JSON.parse(r.data);
      if (typeof d.userId === "string" && typeof d.url === "string" && d.url) out[d.userId] = d.url;
    } catch { /* skip a broken row */ }
  }
  return out;
}

/** This person's photo (from any of their restaurants), or null */
export async function photoOf(userId: string): Promise<string | null> {
  const row: Row | null = await prisma.menuSnapshot.findFirst({ where: { data: { startsWith: ofUser(userId) } }, select: { id: true, data: true } });
  if (!row) return null;
  try { const d = JSON.parse(row.data); return typeof d.url === "string" && d.url ? d.url : null; } catch { return null; }
}

/** Sets (url) or removes (null) the photo in every restaurant of the person. Returns the old url, to delete the old file. */
export async function setPhoto(userId: string, url: string | null): Promise<string | null> {
  const old = await photoOf(userId);
  const restaurants = await restaurantsOf(userId);
  const data = url ? JSON.stringify({ type: "user-photo", userId, url }) : null;
  for (const restaurantId of restaurants) {
    const rows: Row[] = await prisma.menuSnapshot.findMany({ where: { restaurantId, data: { startsWith: ofUser(userId) } }, select: { id: true, data: true } });
    if (!data) {
      if (rows.length) await prisma.menuSnapshot.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
      continue;
    }
    if (rows.length) {
      await prisma.menuSnapshot.update({ where: { id: rows[0].id }, data: { data } });
      if (rows.length > 1) await prisma.menuSnapshot.deleteMany({ where: { id: { in: rows.slice(1).map((r) => r.id) } } });
    } else {
      await prisma.menuSnapshot.create({ data: { restaurantId, label: "Profile photo", data } });
    }
  }
  return old;
}
