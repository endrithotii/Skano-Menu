// History of uploaded menus (PDF / photo books).
//
// A restaurant has named menus, and each menu has versions:
//   - uploading a new PDF or starting a fresh set of photos creates a new menu
//   - adding / removing / reordering photos of a menu saves a new version of that same menu
// Any version can be made active again.
//
// Stored in the existing MenuSnapshot table (no migration), one row per version:
//   label = menu name
//   data  = '{"type":"book","menuId":...,"title":...,"menuPdfUrl":...,"menuPdfName":...}'
//   createdAt = when this version was saved
// Digital-menu snapshots in the same table store a JSON array, so the "type":"book" prefix keeps them apart.
// Rows written before menus had names have no menuId / title: each becomes its own menu.
//
// Files are only deleted when the version that uses them is deleted and nothing else uses them.

import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { allMenuFileUrls, parseMenuPages } from "@/lib/menu-pages";
import { deleteMenuFile } from "@/lib/menu-files";
import { defaultMenuName } from "@/lib/format-date";

export const BOOK_DATA_PREFIX = '{"type":"book"';
const MAX_ROWS = 200;
const MAX_TITLE = 80;

export interface BookVersion {
  id: string;
  menuId: string;
  title: string;
  menuPdfUrl: string;
  menuPdfName: string | null;
  createdAt: Date;
  /** True for a menu uploaded before history existed: the real upload date is unknown */
  approximateDate: boolean;
}

export interface BookMenu {
  menuId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  /** Newest first */
  versions: BookVersion[];
}

interface SnapshotRow {
  id: string;
  label: string;
  data: string;
  createdAt: Date;
}

interface BookData {
  type: "book";
  menuId?: string;
  title?: string;
  menuPdfUrl: string;
  menuPdfName?: string | null;
  approximateDate?: boolean;
}

export function cleanTitle(raw: unknown): string {
  return typeof raw === "string" ? raw.replace(/\s+/g, " ").trim().slice(0, MAX_TITLE) : "";
}

export function defaultMenuTitle(restaurantName: string | null | undefined, date = new Date()) {
  return defaultMenuName(restaurantName, date, true);
}

export function describeFiles(menuPdfUrl: string, menuPdfName: string | null): string {
  const pages = parseMenuPages(menuPdfUrl);
  if (pages?.kind === "images") return `${pages.urls.length} photo${pages.urls.length === 1 ? "" : "s"}`;
  return menuPdfName || "Menu.pdf";
}

function toVersion(row: SnapshotRow): BookVersion | null {
  try {
    const d = JSON.parse(row.data) as BookData;
    if (d?.type !== "book" || typeof d.menuPdfUrl !== "string") return null;
    return {
      id: row.id,
      menuId: d.menuId || row.id,
      title: cleanTitle(d.title) || row.label || "Menu",
      menuPdfUrl: d.menuPdfUrl,
      menuPdfName: typeof d.menuPdfName === "string" ? d.menuPdfName : null,
      createdAt: new Date(row.createdAt),
      approximateDate: d.approximateDate === true,
    };
  } catch {
    return null;
  }
}

async function loadRows(restaurantId: string): Promise<SnapshotRow[]> {
  return prisma.menuSnapshot.findMany({
    where: { restaurantId, data: { startsWith: BOOK_DATA_PREFIX } },
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
    select: { id: true, label: true, data: true, createdAt: true },
  });
}

export async function listBookVersions(restaurantId: string): Promise<BookVersion[]> {
  return (await loadRows(restaurantId)).map(toVersion).filter((v): v is BookVersion => !!v);
}

export function groupMenus(versions: BookVersion[]): BookMenu[] {
  const byId = new Map<string, BookVersion[]>();
  for (const v of versions) {
    const list = byId.get(v.menuId) ?? [];
    list.push(v);
    byId.set(v.menuId, list);
  }
  return [...byId.entries()].map(([menuId, list]) => {
    list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return {
      menuId,
      title: list[0].title,
      createdAt: list[list.length - 1].createdAt,
      updatedAt: list[0].createdAt,
      versions: list,
    };
  });
}

export async function listBookMenus(restaurantId: string): Promise<BookMenu[]> {
  return groupMenus(await listBookVersions(restaurantId));
}

async function createVersion(
  restaurantId: string,
  v: { menuId: string; title: string; menuPdfUrl: string; menuPdfName: string | null; createdAt?: Date; approximateDate?: boolean },
) {
  const data: BookData = {
    type: "book",
    menuId: v.menuId,
    title: v.title,
    menuPdfUrl: v.menuPdfUrl,
    menuPdfName: v.menuPdfName,
    ...(v.approximateDate ? { approximateDate: true } : {}),
  };
  await prisma.menuSnapshot.create({
    data: {
      restaurantId,
      label: v.title,
      data: JSON.stringify(data),
      ...(v.createdAt ? { createdAt: v.createdAt } : {}),
    },
  });
}

/** Renames a menu (all its versions). */
export async function renameBookMenu(restaurantId: string, menuId: string, title: string): Promise<boolean> {
  const clean = cleanTitle(title);
  if (!clean) return false;
  const rows = await loadRows(restaurantId);
  let changed = false;
  for (const row of rows) {
    const v = toVersion(row);
    if (!v || v.menuId !== menuId) continue;
    const d = JSON.parse(row.data) as BookData;
    d.menuId = menuId;
    d.title = clean;
    await prisma.menuSnapshot.update({ where: { id: row.id }, data: { label: clean, data: JSON.stringify(d) } });
    changed = true;
  }
  return changed;
}

export const newMenuId = () => `menu_${Date.now().toString(36)}_${randomUUID().slice(0, 6)}`;

/**
 * Records the menu being saved.
 * - Same files as an existing version: nothing new (optionally renames that menu)
 * - `basedOn` points at the version it was edited from: new version of that menu
 * - otherwise: a brand-new menu
 * Best-effort: the menu save itself never fails because of the history.
 */
export async function recordSavedMenu(args: {
  restaurantId: string;
  restaurantName: string | null;
  menuPdfUrl: string | null;
  menuPdfName: string | null;
  title?: unknown;
  basedOn?: string | null;
  /** Throw instead of logging (used when saving the history is the whole point of the request) */
  strict?: boolean;
}): Promise<{ menuId: string; created: boolean } | null> {
  const { restaurantId, restaurantName, menuPdfUrl, menuPdfName } = args;
  if (!menuPdfUrl || !parseMenuPages(menuPdfUrl)) return null;
  const title = cleanTitle(args.title);
  try {
    const versions = await listBookVersions(restaurantId);
    const existing = versions.find((v) => v.menuPdfUrl === menuPdfUrl);
    if (existing) {
      if (title && title !== existing.title) await renameBookMenu(restaurantId, existing.menuId, title);
      return { menuId: existing.menuId, created: false };
    }
    const base = args.basedOn ? versions.find((v) => v.menuPdfUrl === args.basedOn) : undefined;
    if (base) {
      if (title && title !== base.title) await renameBookMenu(restaurantId, base.menuId, title);
      await createVersion(restaurantId, { menuId: base.menuId, title: title || base.title, menuPdfUrl, menuPdfName });
      return { menuId: base.menuId, created: true };
    }
    const menuId = newMenuId();
    await createVersion(restaurantId, {
      menuId,
      title: title || defaultMenuTitle(restaurantName),
      menuPdfUrl,
      menuPdfName,
    });
    return { menuId, created: true };
  } catch (err) {
    if (args.strict) throw err;
    console.error("[menu-history] could not record version", err);
    return null;
  }
}

/** Makes sure the live menu is in the history (menus saved before history existed get added, dated by the last update). */
export async function recordLiveMenu(restaurant: {
  id: string;
  name?: string | null;
  menuPdfUrl: string | null;
  menuPdfName: string | null;
  updatedAt?: Date | null;
}): Promise<void> {
  if (!restaurant.menuPdfUrl || !parseMenuPages(restaurant.menuPdfUrl)) return;
  try {
    const versions = await listBookVersions(restaurant.id);
    if (versions.some((v) => v.menuPdfUrl === restaurant.menuPdfUrl)) return;
    const date = restaurant.updatedAt ?? new Date();
    await createVersion(restaurant.id, {
      menuId: newMenuId(),
      title: defaultMenuTitle(restaurant.name, date),
      menuPdfUrl: restaurant.menuPdfUrl,
      menuPdfName: restaurant.menuPdfName,
      createdAt: date,
      approximateDate: true,
    });
  } catch (err) {
    console.error("[menu-history] could not record live menu", err);
  }
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
  if (versions.some((v) => allMenuFileUrls(parseMenuPages(v.menuPdfUrl)).includes(url))) return true;
  // Logo / background photos of the menu tree
  try {
    const { loadMenuTree } = await import("@/lib/menu-tree");
    const { treeImageUrls } = await import("@/lib/menu-tree-types");
    return treeImageUrls(await loadMenuTree(restaurantId)).includes(url);
  } catch {
    return true;
  }
}
