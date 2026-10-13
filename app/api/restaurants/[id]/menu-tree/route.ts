import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listBookMenus } from "@/lib/menu-history";
import { loadMenuTree, sanitizeTree, saveMenuTree } from "@/lib/menu-tree";
import { treeMenuIds, treeProblems } from "@/lib/menu-tree-types";

// The "Menu tree" (start screen -> more screens -> a saved PDF / photo menu).
// GET  (public)  -> { restaurant, tree, menus: { [menuId]: { title, menuPdfUrl } } } for the menus the tree opens
// PUT  (owner)   -> { tree }  save it (refused with { problems } if something is missing)

type Params = { params: Promise<{ id: string }> };

async function findRestaurant(idOrSlug: string) {
  return prisma.restaurant.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    select: { id: true, name: true, slug: true, ownerId: true, socialLinks: true, primaryMenu: true },
  });
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
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
      restaurant: { name: r.name, slug: r.slug, socialLinks: r.socialLinks, primaryMenu: r.primaryMenu },
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
    if (session.role !== "SUPER_ADMIN" && r.ownerId !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const tree = sanitizeTree(body?.tree, r.id);
    const menuIds = (await listBookMenus(r.id)).map((m) => m.menuId);
    const problems = treeProblems(tree, menuIds);
    if (problems.length) return NextResponse.json({ error: problems[0], problems }, { status: 400 });

    await saveMenuTree(r.id, tree);
    return NextResponse.json({ success: true, tree });
  } catch (error) {
    console.error("[PUT /api/restaurants/[id]/menu-tree]", error);
    return NextResponse.json({ error: "Could not save the menu tree" }, { status: 500 });
  }
}
