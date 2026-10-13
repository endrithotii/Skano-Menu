// History of uploaded menus (PDF / photo books).
//
// Every book menu that gets saved is kept as a version, so the restaurant can go back and make an
// older one active again. Versions are stored in the existing MenuSnapshot table (no migration):
//   label = display name, data = '{"type":"book","menuPdfUrl":...,"menuPdfName":...}', createdAt = upload date.
// Digital-menu snapshots in the same table store a JSON array, so the "type":"book" prefix keeps them apart.
//
// Files of a version are only deleted when the version itself is deleted and nothing else uses them.

import { prisma } from "@/lib/db";
import { allMenuFileUrls, parseMenuPages } from "@/lib/menu-pages";
import { deleteMenuFile } from "@/lib/menu-files";

export const BOOK_DATA_PREFIX = '{"type":"book"';
const MAX_VERSIONS = 50;

export interface BookVersion {
  id: string;
  label: string;
  menuPdfUrl: string;
  menuPdfName: string | null;
  createdAt: Date;
  /** True for a menu that was uploaded before history existed: the real upload date is unknown */
  approximateDate: boolean;
}

interface SnapshotRow {
  id: string;
  label: string;
  data: string;
  createdAt: Date;
}

function toVersion(row: SnapshotRow): BookVersion | null {
  try {
    const d = JSON.parse(row.data);
    if (d?.type !== "book" || typeof d.menuPdfUrl !== "string") return null;
    return {
      id: row.id,
      label: row.label,
      menuPdfUrl: d.menuPdfUrl,
      menuPdfName: typeof d.menuPdfName === "string" ? d.menuPdfName : null,
      createdAt: new Date(row.createdAt),
      approximateDate: d.approximateDate === true,
    };
  } catch {
    return null;
  }
}

export function bookVersionLabel(menuPdfUrl: string, menuPdfName: string | null): string {
  const pages = parseMenuPages(menuPdfUrl);
  if (pages?.kind === "images") return `${pages.urls.length} photo${pages.urls.length === 1 ? "" : "s"}`;
  return menuPdfName || "Menu.pdf";
}

export async function listBookVersions(restaurantId: string): Promise<BookVersion[]> {
  const rows: SnapshotRow[] = await prisma.menuSnapshot.findMany({
    where: { restaurantId, data: { startsWith: BOOK_DATA_PREFIX } },
    orderBy: { createdAt: "desc" },
    take: MAX_VERSIONS,
    select: { id: true, label: true, data: true, createdAt: true },
  });
  return rows.map(toVersion).filter((v): v is BookVersion => !!v);
}

/** Adds a version for this menu unless the exact same menu is already in the history. */
export async function recordBookVersion(
  restaurantId: string,
  menuPdfUrl: string | null,
  menuPdfName: string | null,
  opts: { createdAt?: Date; approximateDate?: boolean } = {},
): Promise<void> {
  if (!menuPdfUrl || !parseMenuPages(menuPdfUrl)) return;
  // History is best-effort: saving the menu itself must never fail because of it
  try {
    const existing = await listBookVersions(restaurantId);
    if (existing.some((v) => v.menuPdfUrl === menuPdfUrl)) return;
    await prisma.menuSnapshot.create({
      data: {
        restaurantId,
        label: bookVersionLabel(menuPdfUrl, menuPdfName),
        data: JSON.stringify({ type: "book", menuPdfUrl, menuPdfName, ...(opts.approximateDate ? { approximateDate: true } : {}) }),
        ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
      },
    });
  } catch (err) {
    console.error("[menu-history] could not record version", err);
  }
}

/** Makes sure the live menu has a version (menus saved before history existed get one, dated by the last update). */
export async function recordLiveMenu(restaurant: { id: string; menuPdfUrl: string | null; menuPdfName: string | null; updatedAt?: Date | null }) {
  await recordBookVersion(restaurant.id, restaurant.menuPdfUrl, restaurant.menuPdfName, {
    createdAt: restaurant.updatedAt ?? undefined,
    approximateDate: true,
  });
}

/** Deletes files that are not used by the live menu or by any version in the history. */
export async function deleteUnreferencedFiles(
  restaurantId: string,
  liveMenuPdfUrl: string | null,
  candidates: string[],
): Promise<void> {
  if (!candidates.length) return;
  const keep = new Set(allMenuFileUrls(parseMenuPages(liveMenuPdfUrl)));
  let versions: BookVersion[];
  try {
    versions = await listBookVersions(restaurantId);
  } catch {
    return; // can't tell what's still used, so keep everything
  }
  for (const v of versions) {
    for (const u of allMenuFileUrls(parseMenuPages(v.menuPdfUrl))) keep.add(u);
  }
  await Promise.all([...new Set(candidates)].filter((u) => !keep.has(u)).map((u) => deleteMenuFile(u)));
}

/** Is this file part of the live menu or of any saved version? */
export async function isFileInUse(restaurantId: string, liveMenuPdfUrl: string | null, url: string): Promise<boolean> {
  if (allMenuFileUrls(parseMenuPages(liveMenuPdfUrl)).includes(url)) return true;
  let versions: BookVersion[];
  try {
    versions = await listBookVersions(restaurantId);
  } catch {
    return true; // when unsure, treat it as used (never delete)
  }
  return versions.some((v) => allMenuFileUrls(parseMenuPages(v.menuPdfUrl)).includes(url));
}
