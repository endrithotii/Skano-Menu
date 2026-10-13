import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { allMenuFileUrls, parseMenuPages } from "@/lib/menu-pages";
import { deleteUnreferencedFiles, listBookVersions, recordLiveMenu } from "@/lib/menu-history";

// History of uploaded (PDF / photo) menus.
// GET                    -> versions, newest first, with which one is live
// DELETE ?versionId=...  -> delete a version that is not live (and its files, if nothing else uses them)
// Making a version active is done by saving it as the menu (PUT /upload-menu), like any other change.

type Params = { params: Promise<{ id: string }> };

async function loadAuthorized(req: NextRequest, params: Params["params"]) {
  const session = await getSessionFromRequest(req);
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { id: idOrSlug } = await params;
  const restaurant = await prisma.restaurant.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    select: { id: true, ownerId: true, menuPdfUrl: true, menuPdfName: true, primaryMenu: true, updatedAt: true },
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
    const versions = await listBookVersions(r.id);

    return NextResponse.json({
      liveMenuPdfUrl: r.menuPdfUrl,
      primaryMenu: r.primaryMenu,
      versions: versions.map((v) => {
        const pages = parseMenuPages(v.menuPdfUrl);
        return {
          id: v.id,
          label: v.label,
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
    });
  } catch (error) {
    console.error("[GET /api/restaurants/[id]/menu-history]", error);
    return NextResponse.json({ error: "Could not load history" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const auth = await loadAuthorized(req, params);
    if (auth.error) return auth.error;
    const r = auth.restaurant;

    const versionId = req.nextUrl.searchParams.get("versionId");
    if (!versionId) return NextResponse.json({ error: "versionId is required" }, { status: 400 });

    const version = (await listBookVersions(r.id)).find((v) => v.id === versionId);
    if (!version) return NextResponse.json({ error: "Version not found" }, { status: 404 });
    if (version.menuPdfUrl === r.menuPdfUrl) {
      return NextResponse.json({ error: "This is the menu customers see right now. Make another version active first." }, { status: 400 });
    }

    await prisma.menuSnapshot.deleteMany({ where: { id: version.id, restaurantId: r.id } });
    await deleteUnreferencedFiles(r.id, r.menuPdfUrl, allMenuFileUrls(parseMenuPages(version.menuPdfUrl)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/restaurants/[id]/menu-history]", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
