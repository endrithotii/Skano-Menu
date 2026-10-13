// "Menu tree": a start screen with buttons, where each button opens either another screen with buttons
// or one of the restaurant's saved PDF / photo menus (from the menu history).
// Shared by the dashboard editor, the public pages and the API (no server-only imports here).

export interface TreeBackground {
  url: string;
  /** Focal point in % (0-100) for wide screens (desktop, landscape) */
  x: number;
  y: number;
  /** Focal point in % (0-100) for tall screens (phones) */
  mx: number;
  my: number;
}

export interface TreeNode {
  id: string;
  /** Button text */
  label: string;
  /** Part of the link, e.g. "menu-shqip" in /r/aroma/menu-shqip */
  slug: string;
  kind: "submenu" | "menu";
  /** kind "submenu": text shown under the logo on its screen */
  subtitle?: string;
  /** kind "submenu": own background photo (otherwise the parent's / default is used) */
  background?: TreeBackground | null;
  /** kind "submenu": its buttons */
  children?: TreeNode[];
  /** kind "menu": the saved menu (menuId from the history) it opens */
  menuId?: string | null;
}

export interface MenuTree {
  version: 1;
  /** Text under the logo on the start screen */
  subtitle?: string;
  logo?: string | null;
  /** Default background for every screen */
  background?: TreeBackground | null;
  children: TreeNode[];
}

export const TREE_LIMITS = { depth: 6, perLevel: 30, nodes: 300, label: 60, subtitle: 140 };

export const emptyTree = (): MenuTree => ({ version: 1, subtitle: "", logo: null, background: null, children: [] });

export function slugify(text: string): string {
  const s = text
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // ë -> e, ç -> c
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return s || "menu";
}

/** Makes `base` unique among `taken` by adding -2, -3... */
export function uniqueSlug(base: string, taken: string[]): string {
  const clean = slugify(base);
  if (!taken.includes(clean)) return clean;
  for (let i = 2; i < 1000; i++) if (!taken.includes(`${clean}-${i}`)) return `${clean}-${i}`;
  return `${clean}-${Date.now()}`;
}

export const newNodeId = () => `n_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Finds the node for a list of slugs. Returns the chain from the top (empty = start screen), or null. */
export function resolvePath(tree: MenuTree, path: string[]): TreeNode[] | null {
  const chain: TreeNode[] = [];
  let level = tree.children;
  for (const part of path) {
    const node = level.find((n) => n.slug === part);
    if (!node) return null;
    chain.push(node);
    if (node.kind === "menu") return chain.length === path.length ? chain : null;
    level = node.children ?? [];
  }
  return chain;
}

/** Background for a screen: its own, else the closest parent's, else the default */
export function effectiveBackground(tree: MenuTree, chain: TreeNode[]): TreeBackground | null {
  for (let i = chain.length - 1; i >= 0; i--) {
    const bg = chain[i].kind === "submenu" ? chain[i].background : null;
    if (bg?.url) return bg;
  }
  return tree.background?.url ? tree.background : null;
}

export function walkNodes(nodes: TreeNode[], fn: (n: TreeNode, depth: number) => void, depth = 1) {
  for (const n of nodes) {
    fn(n, depth);
    if (n.kind === "submenu" && n.children) walkNodes(n.children, fn, depth + 1);
  }
}

export function treeMenuIds(tree: MenuTree): string[] {
  const ids: string[] = [];
  walkNodes(tree.children, (n) => { if (n.kind === "menu" && n.menuId) ids.push(n.menuId); });
  return [...new Set(ids)];
}

export function treeImageUrls(tree: MenuTree): string[] {
  const urls: string[] = [];
  if (tree.logo) urls.push(tree.logo);
  if (tree.background?.url) urls.push(tree.background.url);
  walkNodes(tree.children, (n) => { if (n.kind === "submenu" && n.background?.url) urls.push(n.background.url); });
  return urls;
}

/** Problems to fix before the tree can be saved (shown in the editor and checked by the API). */
export function treeProblems(tree: MenuTree, menuIds?: string[]): string[] {
  const problems: string[] = [];
  if (!tree.children.length) problems.push("Add at least one button to the start screen.");
  let count = 0;
  const check = (nodes: TreeNode[], where: string, depth: number) => {
    if (nodes.length > TREE_LIMITS.perLevel) problems.push(`${where}: at most ${TREE_LIMITS.perLevel} buttons per screen.`);
    const slugs = new Set<string>();
    for (const n of nodes) {
      count++;
      const name = n.label.trim() || "(no name)";
      if (!n.label.trim()) problems.push(`${where}: a button has no name.`);
      if (slugs.has(n.slug)) problems.push(`${where}: two buttons use the link "${n.slug}".`);
      slugs.add(n.slug);
      if (n.kind === "menu") {
        if (!n.menuId) problems.push(`"${name}" doesn't open a menu yet. Pick one.`);
        else if (menuIds && !menuIds.includes(n.menuId)) problems.push(`"${name}" opens a menu that was deleted. Pick another one.`);
      } else {
        if (depth >= TREE_LIMITS.depth) problems.push(`"${name}" is too deep (max ${TREE_LIMITS.depth} levels).`);
        if (!n.children?.length) problems.push(`"${name}" has no buttons inside yet.`);
        check(n.children ?? [], `"${name}"`, depth + 1);
      }
    }
  };
  check(tree.children, "Start screen", 1);
  if (count > TREE_LIMITS.nodes) problems.push(`At most ${TREE_LIMITS.nodes} buttons in total.`);
  return [...new Set(problems)];
}
