// Server-side storage for the "Menu tree" (see lib/menu-tree-types.ts).
// Stored as one row in the existing MenuSnapshot table (no migration): data = '{"type":"tree","tree":{...}}'.

import { prisma } from "@/lib/db";
import { isOwnMenuUpload } from "@/lib/menu-files";
import {
  TREE_LIMITS, emptyTree, newNodeId, uniqueSlug, slugify,
  type MenuTree, type TreeBackground, type TreeNode,
} from "@/lib/menu-tree-types";

export const TREE_DATA_PREFIX = '{"type":"tree"';

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

export async function saveMenuTree(restaurantId: string, tree: MenuTree): Promise<void> {
  const data = JSON.stringify({ type: "tree", tree });
  const row = await findRow(restaurantId);
  if (row) await prisma.menuSnapshot.update({ where: { id: row.id }, data: { data, label: "Menu tree" } });
  else await prisma.menuSnapshot.create({ data: { restaurantId, label: "Menu tree", data } });
}
