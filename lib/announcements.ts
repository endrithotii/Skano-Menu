// Announcements: a message customers see as a notification at the top when they open the menu.
// Each one shows from a start time (now or scheduled) until an optional end time.
//
// Stored in the MenuSnapshot table (no migration), one row each:
//   '{"type":"announcement","message":"...","startAt":ISO,"endAt":ISO|null,"display":"close","seconds":10}'
// display: "fixed" = always on screen, "auto" = disappears after `seconds` (1 second fade),
//          "close" = stays until the customer closes it. "auto" and "close" are also listed in the More menu.
// The old single text (Restaurant.announcement, from Settings) is moved in here the first time the
// Announcements page is opened, so it keeps showing.

import { prisma } from "@/lib/db";

const PREFIX = '{"type":"announcement"';
export const MAX_MESSAGE = 280;

export type AnnouncementDisplay = "fixed" | "auto" | "close";
export const DEFAULT_SECONDS = 10;
export const clampSeconds = (n: unknown) => Math.min(60, Math.max(3, Math.round(Number(n)) || DEFAULT_SECONDS));
export const toDisplay = (v: unknown): AnnouncementDisplay => (v === "fixed" || v === "auto" ? v : "close");
const KEEP_PAST_MS = 180 * 24 * 60 * 60 * 1000;

export interface Announcement {
  id: string;
  message: string;
  startAt: string;
  endAt: string | null;
  display: AnnouncementDisplay;
  /** "auto": seconds on screen */
  seconds: number;
  createdAt: string;
}

export type AnnouncementStatus = "active" | "upcoming" | "ended";

export function announcementStatus(a: Pick<Announcement, "startAt" | "endAt">, now = Date.now()): AnnouncementStatus {
  if (Date.parse(a.startAt) > now) return "upcoming";
  if (a.endAt && Date.parse(a.endAt) <= now) return "ended";
  return "active";
}

interface Row { id: string; data: string; createdAt: Date }

const toData = (a: Omit<Announcement, "id" | "createdAt">) =>
  JSON.stringify({ type: "announcement", message: a.message, startAt: a.startAt, endAt: a.endAt, display: a.display, seconds: a.seconds });

function parse(r: Row): Announcement | null {
  try {
    const d = JSON.parse(r.data);
    if (d?.type !== "announcement" || typeof d.message !== "string" || typeof d.startAt !== "string") return null;
    return {
      id: r.id, message: d.message, startAt: d.startAt, endAt: typeof d.endAt === "string" ? d.endAt : null,
      display: toDisplay(d.display), seconds: clampSeconds(d.seconds ?? DEFAULT_SECONDS), createdAt: new Date(r.createdAt).toISOString(),
    };
  } catch {
    return null;
  }
}

export async function listAnnouncements(restaurantId: string): Promise<Announcement[]> {
  const rows: Row[] = await prisma.menuSnapshot.findMany({
    where: { restaurantId, data: { startsWith: PREFIX } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, data: true, createdAt: true },
  });
  const all = rows.map(parse).filter((a): a is Announcement => !!a);
  // Tidy up: long-ended ones
  const old = all.filter((a) => a.endAt && Date.now() - Date.parse(a.endAt) > KEEP_PAST_MS);
  if (old.length) await prisma.menuSnapshot.deleteMany({ where: { restaurantId, id: { in: old.map((a) => a.id) } } }).catch(() => {});
  return all.filter((a) => !old.includes(a)).sort((a, b) => Date.parse(b.startAt) - Date.parse(a.startAt));
}

/** What customers see right now (newest first) */
export async function activeAnnouncements(restaurantId: string): Promise<Announcement[]> {
  return (await listAnnouncements(restaurantId)).filter((a) => announcementStatus(a) === "active").slice(0, 3);
}

export async function createAnnouncement(restaurantId: string, a: Omit<Announcement, "id" | "createdAt">): Promise<string> {
  const row = await prisma.menuSnapshot.create({ data: { restaurantId, label: "Announcement", data: toData(a) } });
  return row.id;
}

export async function updateAnnouncement(restaurantId: string, id: string, a: Omit<Announcement, "id" | "createdAt">) {
  await prisma.menuSnapshot.updateMany({ where: { restaurantId, id, data: { startsWith: PREFIX } }, data: { data: toData(a) } });
}

export async function deleteAnnouncement(restaurantId: string, id: string) {
  await prisma.menuSnapshot.deleteMany({ where: { restaurantId, id, data: { startsWith: PREFIX } } });
}

/** Moves the old Settings text in (once) */
export async function migrateLegacyAnnouncement(restaurant: { id: string; announcement: string | null }) {
  const text = restaurant.announcement?.trim();
  if (!text) return;
  await createAnnouncement(restaurant.id, { message: text.slice(0, MAX_MESSAGE), startAt: new Date().toISOString(), endAt: null, display: "close", seconds: DEFAULT_SECONDS });
  await prisma.restaurant.update({ where: { id: restaurant.id }, data: { announcement: null } });
}
