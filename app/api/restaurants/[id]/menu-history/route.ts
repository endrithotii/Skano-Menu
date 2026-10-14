import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MAX_MENU_PAGES, allMenuFileUrls, parseMenuPages, serializeMenuPages } from "@/lib/menu-pages";
import { isOwnMenuUpload } from "@/lib/menu-files";
import {
  cleanTitle, defaultMenuTitle, deleteUnreferencedFiles, describeFiles, listBookMenus, listBookVersions,
  recordLiveMenu, recordSavedMenu, renameBookMenu,
} from "@/lib/menu-history";
import { loadMenuTree } from "@/lib/menu-tree";
import { treeMenuIds } from "@/lib/menu-tree-types";

// History of uploaded (PDF / photo) menus. Each menu has a name and one or more versions.
// GET                         -> menus with their versions (newest version first) and which one is live
// POST   { basedOn?, menuPdfUrl, menuPdfName?, title? }
//                             -> basedOn set: save an edited copy of a version as a new version of the same menu
//                                no basedOn:  create a new menu
//                                Either way WITHOUT changing what customers see
// PATCH  { menuId, title }    -> rename a menu
// DELETE ?versionId=...       -> delete one version (not the live one)
// DELETE ?menuId=...          -> delete a whole menu (not if it contains the live version)
// Making a version active is done by saving it as the menu (PUT /upload-menu), like any other change.

type Params = { params: Promise<{ id: string }> };

async function loadAuthorized(req: NextRequest, params: Params["params"]) {
  const session = await getSessionFromRequest(req);
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { id: idOrSlug } = await params;
  const restaurant = await prisma.restaurant.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    select: { id: true, name: true, ownerId: true, menuPdfUrl: true, menuPdfName: true, primaryMenu: true, updatedAt: true },
  });
  if (!restaurant) return { error: NextResponse.json({ error: "Restaurant not found" }, { status: 404 }) };
  if (session.role !== "SUPER_ADMIN" && restaurant.ownerId !== session.id) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { restaurant };
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const auth = await loadAuthorized(req, params);
    if (auth.error) return auth.error;
    const r = auth.restaurant;

    // Menus saved before history existed get added the first time the list is opened
    await recordLiveMenu(r);
    const menus = await listBookMenus(r.id);

    return NextResponse.json({
      liveMenuPdfUrl: r.menuPdfUrl,
      primaryMenu: r.primaryMenu,
      defaultTitle: defaultMenuTitle(r.name),
      menus: menus.map((m) => ({
        menuId: m.menuId,
        title: m.title,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
        isLive: m.versions.some((v) => v.menuPdfUrl === r.menuPdfUrl),
        versions: m.versions.map((v, i) => {
          const pages = parseMenuPages(v.menuPdfUrl);
          return {
            id: v.id,
            number: m.versions.length - i, // 1 = first upload
            files: describeFiles(v.menuPdfUrl, v.menuPdfName),
            menuPdfUrl: v.menuPdfUrl,
            menuPdfName: v.menuPdfName,
            kind: pages?.kind === "pdf" ? "pdf" : "photos",
            pageCount: pages?.kind === "images" ? pages.urls.length : null,
            thumbnail: pages?.kind === "images" ? pages.urls[0] : null,
            createdAt: v.createdAt.toISOString(),
            approximateDate: v.approximateDate,
            isLive: v.menuPdfUrl === r.menuPdfUrl,
          };
        }),
      })),
    });
  } catch (error) {
    console.error("[GET /api/restaurants/[id]/menu-history]", error);
    return NextResponse.json({ error: "Could not load history" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const auth = await loadAuthorized(req, params);
    if (auth.error) return auth.error;
    const r = auth.restaurant;

    const body = await req.json().catch(() => null);
    const basedOn = typeof body?.basedOn === "string" && body.basedOn ? body.basedOn : null;
    const raw: unknown = body?.menuPdfUrl;
    const next = typeof raw === "string" ? parseMenuPages(raw) : null;
    if (!next) return NextResponse.json({ error: "Nothing to save" }, { status: 400 });

    const versions = await listBookVersions(r.id);
    const base = basedOn ? versions.find((v) => v.menuPdfUrl === basedOn) : null;
    if (basedOn && !base) return NextResponse.json({ error: "The version you edited no longer exists" }, { status: 404 });

    const urls = allMenuFileUrls(next);
    if (urls.length > MAX_MENU_PAGES) {
      return NextResponse.json({ error: `A menu can have at most ${MAX_MENU_PAGES} pages.` }, { status: 400 });
    }
    if (urls.some((u) => !isOwnMenuUpload(u, r.id))) {
      return NextResponse.json({ error: "Menu contains a file that was not uploaded here" }, { status: 400 });
    }

    const menuPdfUrl = serializeMenuPages(next)!;
    const menuPdfName = next.kind === "pdf"
      ? (typeof body.menuPdfName === "string" && body.menuPdfName ? body.menuPdfName : "Menu.pdf")
      : `${next.urls.length} photo${next.urls.length === 1 ? "" : "s"}`;

    const result = await recordSavedMenu({
      restaurantId: r.id,
      restaurantName: r.name,
      menuPdfUrl,
      menuPdfName,
      title: body.title,
      basedOn,
      strict: true,
    });
    return NextResponse.json({ success: true, created: result?.created ?? false, menuId: result?.menuId ?? base?.menuId ?? null });
  } catch (error) {
    console.error("[POST /api/restaurants/[id]/menu-history]", error);
    return NextResponse.json({ error: "Could not save this version" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const auth = await loadAuthorized(req, params);
    if (auth.error) return auth.error;
    const body = await req.json().catch(() => null);
    const menuId = typeof body?.menuId === "string" ? body.menuId : "";
    const title = cleanTitle(body?.title);
    if (!menuId || !title) return NextResponse.json({ error: "A menu and a name are required" }, { status: 400 });
    const ok = await renameBookMenu(auth.restaurant.id, menuId, title);
    if (!ok) return NextResponse.json({ error: "Menu not found" }, { status: 404 });
    return NextResponse.json({ success: true, title });
  } catch (error) {
    console.error("[PATCH /api/restaurants/[id]/menu-history]", error);
    return NextResponse.json({ error: "Rename failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const auth = await loadAuthorized(req, params);
    if (auth.error) return auth.error;
    const r = auth.restaurant;

    const versionId = req.nextUrl.searchParams.get("versionId");
    const menuId = req.nextUrl.searchParams.get("menuId");
    if (!versionId && !menuId) return NextResponse.json({ error: "versionId or menuId is required" }, { status: 400 });

    const menus = await listBookMenus(r.id);
    const versions = menuId
      ? menus.find((m) => m.menuId === menuId)?.versions ?? []
      : menus.flatMap((m) => m.versions).filter((v) => v.id === versionId);
    if (!versions.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (versions.some((v) => v.menuPdfUrl === r.menuPdfUrl)) {
      return NextResponse.json({ error: "This is the menu customers see right now. Make another one active first." }, { status: 400 });
    }
    if (menuId && treeMenuIds(await loadMenuTree(r.id)).includes(menuId)) {
      return NextResponse.json({ error: "This menu is used in your menu tree. Remove it from the tree first." }, { status: 400 });
    }

    await prisma.menuSnapshot.deleteMany({ where: { restaurantId: r.id, id: { in: versions.map((v) => v.id) } } });
    await deleteUnreferencedFiles(r.id, r.menuPdfUrl, versions.flatMap((v) => allMenuFileUrls(parseMenuPages(v.menuPdfUrl))));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/restaurants/[id]/menu-history]", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
