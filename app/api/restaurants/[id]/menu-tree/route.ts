import { NextRequest, NextResponse } from "next/server";
import { feedbackEnabled } from "@/lib/feedback-settings";
import { getSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listBookMenus } from "@/lib/menu-history";
import { archiveTree, deleteTreeArchive, listTreeArchives, loadMenuTree, renameTreeArchive, sanitizeTree, saveMenuTree } from "@/lib/menu-tree";
import { treeMenuIds, treeProblems, type MenuTree } from "@/lib/menu-tree-types";
import { formatDay } from "@/lib/format-date";
import { forbidUnless } from "@/lib/staff-access";
import type { Permission } from "@/lib/permissions";
import { logAction } from "@/lib/action-log";

// The "Menu tree" (start screen -> more screens -> a saved PDF / photo menu).
// GET  (public)  -> { restaurant, tree, menus: { [menuId]: { title, menuPdfUrl } } } for the menus the tree opens
// PUT  (owner)   -> { tree }  save it (refused with { problems } if something is missing).
//                  The tree it replaces is kept in the menu tree history.
// GET ?history=1 (owner)            -> { archives: [{ id, name, savedAt, buttons, tree }] }
// POST { action: "archive", name }  -> keep the current tree in the history (before starting a new one)
// PATCH { archiveId, name }         -> rename a tree in the history
// DELETE ?archiveId=...             -> remove a tree from the history

type Params = { params: Promise<{ id: string }> };

async function findRestaurant(idOrSlug: string) {
  return prisma.restaurant.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    select: { id: true, name: true, slug: true, ownerId: true, socialLinks: true, primaryMenu: true, themeConfig: true },
  });
}

const archiveName = () => `Menu tree - ${formatDay(new Date(), true)}`;

function countButtons(tree: MenuTree): number {
  const walk = (list: MenuTree["children"]): number => list.reduce((n, c) => n + 1 + walk(c.children ?? []), 0);
  return walk(tree.children);
}

async function loadOwned(req: NextRequest, params: Params["params"], need: Permission | Permission[]) {
  const session = await getSessionFromRequest(req);
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { id } = await params;
  const r = await findRestaurant(id);
  if (!r) return { error: NextResponse.json({ error: "Restaurant not found" }, { status: 404 }) };
  { const denied = await forbidUnless(session, r, need); if (denied) return { error: denied }; }
  return { restaurant: r, session };
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    if (req.nextUrl.searchParams.get("history")) {
      const auth = await loadOwned(req, params, ["menu.edit", "menu.live"]);
      if (auth.error) return auth.error;
      const archives = await listTreeArchives(auth.restaurant.id);
      return NextResponse.json({
        archives: archives.map((a) => ({ id: a.id, name: a.name, savedAt: a.savedAt.toISOString(), buttons: countButtons(a.tree), tree: a.tree })),
      });
    }
    const { id } = await params;
    const r = await findRestaurant(id);
    if (!r) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });

    const tree = await loadMenuTree(r.id);
    const wanted = new Set(treeMenuIds(tree));
    const menus: Record<string, { title: string; menuPdfUrl: string }> = {};
    if (wanted.size) {
      for (const m of await listBookMenus(r.id)) {
        if (!wanted.has(m.menuId)) continue;
        // The tree always shows the newest version of each menu
        menus[m.menuId] = { title: m.title, menuPdfUrl: m.versions[0].menuPdfUrl };
      }
    }

    return NextResponse.json({
      restaurant: { name: r.name, slug: r.slug, socialLinks: r.socialLinks, primaryMenu: r.primaryMenu, feedback: feedbackEnabled(r.themeConfig) },
      tree,
      menus,
    });
  } catch (error) {
    console.error("[GET /api/restaurants/[id]/menu-tree]", error);
    return NextResponse.json({ error: "Could not load the menu" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const r = await findRestaurant(id);
    if (!r) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    { const denied = await forbidUnless(session, r, "menu.edit"); if (denied) return denied; }

    const body = await req.json().catch(() => null);
    const tree = sanitizeTree(body?.tree, r.id);
    const menuIds = (await listBookMenus(r.id)).map((m) => m.menuId);
    const problems = treeProblems(tree, menuIds);
    if (problems.length) return NextResponse.json({ error: problems[0], problems }, { status: 400 });

    const old = await loadMenuTree(r.id);
    await saveMenuTree(r.id, tree, archiveName());
    if (JSON.stringify(old) !== JSON.stringify(tree)) {
      await logAction(session, r, "menu.tree", "Changed the menu tree", [`Buttons: ${countButtons(old)} → ${countButtons(tree)}`]);
    }
    return NextResponse.json({ success: true, tree });
  } catch (error) {
    console.error("[PUT /api/restaurants/[id]/menu-tree]", error);
    return NextResponse.json({ error: "Could not save the menu tree" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const auth = await loadOwned(req, params, "menu.edit");
    if (auth.error) return auth.error;
    const body = await req.json().catch(() => null);
    if (body?.action !== "archive") return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    const name = typeof body.name === "string" && body.name.trim() ? body.name : archiveName();
    const archived = await archiveTree(auth.restaurant.id, await loadMenuTree(auth.restaurant.id), name);
    await logAction(auth.session, auth.restaurant, "menu.tree", `Kept the menu tree in the history as "${name}"`);
    return NextResponse.json({ success: true, archived });
  } catch (error) {
    console.error("[POST /api/restaurants/[id]/menu-tree]", error);
    return NextResponse.json({ error: "Could not keep the menu tree" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const auth = await loadOwned(req, params, "menu.edit");
    if (auth.error) return auth.error;
    const body = await req.json().catch(() => null);
    const ok = typeof body?.archiveId === "string" && typeof body?.name === "string"
      && await renameTreeArchive(auth.restaurant.id, body.archiveId, body.name);
    if (!ok) return NextResponse.json({ error: "Could not rename" }, { status: 400 });
    await logAction(auth.session, auth.restaurant, "menu.tree", `Renamed a saved menu tree to "${body.name}"`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PATCH /api/restaurants/[id]/menu-tree]", error);
    return NextResponse.json({ error: "Rename failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const auth = await loadOwned(req, params, "menu.edit");
    if (auth.error) return auth.error;
    const archiveId = req.nextUrl.searchParams.get("archiveId");
    if (!archiveId) return NextResponse.json({ error: "archiveId is required" }, { status: 400 });
    await deleteTreeArchive(auth.restaurant.id, archiveId);
    await logAction(auth.session, auth.restaurant, "menu.tree", "Deleted a saved menu tree from the history");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/restaurants/[id]/menu-tree]", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
