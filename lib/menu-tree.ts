// Server-side storage for the "Menu tree" (see lib/menu-tree-types.ts).
// Stored as one row in the existing MenuSnapshot table (no migration): data = '{"type":"tree","tree":{...}}'.
// Older trees are kept in the "menu tree history": one row each, data = '{"type":"oldtree","name":...,"tree":{...}}'.

import { prisma } from "@/lib/db";
import { isOwnMenuUpload } from "@/lib/menu-files";
import {
  TREE_LIMITS, emptyTree, newNodeId, uniqueSlug, slugify,
  type MenuTree, type TreeBackground, type TreeNode,
} from "@/lib/menu-tree-types";

export const TREE_DATA_PREFIX = '{"type":"tree"';
// (must not start with TREE_DATA_PREFIX)
export const TREE_ARCHIVE_PREFIX = '{"type":"oldtree"';
const MAX_ARCHIVES = 30;

const clampPct = (v: unknown, fallback = 50) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n * 10) / 10)) : fallback;
};
const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

function cleanImageUrl(v: unknown, restaurantId: string): string | null {
  return typeof v === "string" && isOwnMenuUpload(v, restaurantId) ? v : null;
}

function cleanBackground(v: unknown, restaurantId: string): TreeBackground | null {
  if (!v || typeof v !== "object") return null;
  const b = v as Record<string, unknown>;
  const url = cleanImageUrl(b.url, restaurantId);
  if (!url) return null;
  return { url, x: clampPct(b.x), y: clampPct(b.y), mx: clampPct(b.mx), my: clampPct(b.my) };
}

/** Turns untrusted input into a valid tree (unknown fields dropped, slugs made unique, limits applied). */
export function sanitizeTree(input: unknown, restaurantId: string): MenuTree {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  let total = 0;
  const cleanNodes = (list: unknown, depth: number): TreeNode[] => {
    if (!Array.isArray(list) || depth > TREE_LIMITS.depth) return [];
    const out: TreeNode[] = [];
    const taken: string[] = [];
    for (const item of list.slice(0, TREE_LIMITS.perLevel)) {
      if (!item || typeof item !== "object" || total >= TREE_LIMITS.nodes) continue;
      const n = item as Record<string, unknown>;
      total++;
      const label = text(n.label, TREE_LIMITS.label);
      const slug = uniqueSlug(typeof n.slug === "string" && n.slug ? slugify(n.slug) : label, taken);
      taken.push(slug);
      const id = typeof n.id === "string" && /^[\w-]{1,40}$/.test(n.id) ? n.id : newNodeId();
      if (n.kind === "menu") {
        out.push({ id, label, slug, kind: "menu", menuId: typeof n.menuId === "string" ? n.menuId.slice(0, 60) : null });
      } else {
        out.push({
          id, label, slug, kind: "submenu",
          subtitle: text(n.subtitle, TREE_LIMITS.subtitle),
          background: cleanBackground(n.background, restaurantId),
          children: cleanNodes(n.children, depth + 1),
        });
      }
    }
    return out;
  };
  return {
    version: 1,
    subtitle: text(raw.subtitle, TREE_LIMITS.subtitle),
    logo: cleanImageUrl(raw.logo, restaurantId),
    background: cleanBackground(raw.background, restaurantId),
    children: cleanNodes(raw.children, 1),
  };
}

async function findRow(restaurantId: string) {
  const rows: { id: string; data: string }[] = await prisma.menuSnapshot.findMany({
    where: { restaurantId, data: { startsWith: TREE_DATA_PREFIX } },
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { id: true, data: true },
  });
  return rows[0] ?? null;
}

export async function loadMenuTree(restaurantId: string): Promise<MenuTree> {
  const row = await findRow(restaurantId);
  if (!row) return emptyTree();
  try {
    const parsed = JSON.parse(row.data);
    return sanitizeTree(parsed?.tree, restaurantId);
  } catch {
    return emptyTree();
  }
}

export interface TreeArchive { id: string; name: string; savedAt: Date; tree: MenuTree }

export async function listTreeArchives(restaurantId: string): Promise<TreeArchive[]> {
  const rows: { id: string; label: string; data: string; createdAt: Date }[] = await prisma.menuSnapshot.findMany({
    where: { restaurantId, data: { startsWith: TREE_ARCHIVE_PREFIX } },
    orderBy: { createdAt: "desc" },
    take: MAX_ARCHIVES + 10,
    select: { id: true, label: true, data: true, createdAt: true },
  });
  const out: TreeArchive[] = [];
  for (const r of rows) {
    try {
      const d = JSON.parse(r.data);
      out.push({ id: r.id, name: (typeof d.name === "string" && d.name) || r.label, savedAt: new Date(r.createdAt), tree: sanitizeTree(d.tree, restaurantId) });
    } catch { /* skip broken rows */ }
  }
  return out;
}

/** Keeps a copy of a tree in the history (not if it's empty or the same as the newest copy) */
export async function archiveTree(restaurantId: string, tree: MenuTree, name: string, renameIfSame = true): Promise<boolean> {
  if (!tree.children.length) return false;
  const archives = await listTreeArchives(restaurantId);
  if (archives[0] && JSON.stringify(archives[0].tree) === JSON.stringify(tree)) {
    // Same tree: only give it the new name
    if (renameIfSame && name && name !== archives[0].name) await renameTreeArchive(restaurantId, archives[0].id, name);
    return false;
  }
  const clean = text(name, 80) || "Menu tree";
  await prisma.menuSnapshot.create({ data: { restaurantId, label: clean, data: JSON.stringify({ type: "oldtree", name: clean, tree }) } });
  // Only the newest copies are kept
  const extra = archives.slice(MAX_ARCHIVES - 1).map((a) => a.id);
  if (extra.length) await prisma.menuSnapshot.deleteMany({ where: { restaurantId, id: { in: extra } } });
  return true;
}

export async function renameTreeArchive(restaurantId: string, id: string, name: string): Promise<boolean> {
  const clean = text(name, 80);
  const a = (await listTreeArchives(restaurantId)).find((x) => x.id === id);
  if (!a || !clean) return false;
  await prisma.menuSnapshot.update({ where: { id }, data: { label: clean, data: JSON.stringify({ type: "oldtree", name: clean, tree: a.tree }) } });
  return true;
}

export async function deleteTreeArchive(restaurantId: string, id: string): Promise<void> {
  await prisma.menuSnapshot.deleteMany({ where: { restaurantId, id, data: { startsWith: TREE_ARCHIVE_PREFIX } } });
}

/** Saves the tree; the tree it replaces is kept in the history first */
export async function saveMenuTree(restaurantId: string, tree: MenuTree, previousName?: string): Promise<void> {
  const previous = await loadMenuTree(restaurantId);
  if (previous.children.length && JSON.stringify(previous) !== JSON.stringify(tree)) {
    await archiveTree(restaurantId, previous, previousName ?? "Menu tree", false).catch((err) => console.error("[menu-tree] archive failed", err));
  }
  const data = JSON.stringify({ type: "tree", tree });
  const row = await findRow(restaurantId);
  if (row) await prisma.menuSnapshot.update({ where: { id: row.id }, data: { data, label: "Menu tree" } });
  else await prisma.menuSnapshot.create({ data: { restaurantId, label: "Menu tree", data } });
}
