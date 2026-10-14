import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deleteDesign, getDesign, listDesigns, renameDesign, sanitizeDesign, saveDesign, type StoredDesign } from "@/lib/menu-design";
import { cleanTitle, listBookMenus, listBookVersions, recordLiveMenu, recordSavedMenu, renameBookMenu } from "@/lib/menu-history";
import { isOwnMenuUpload } from "@/lib/menu-files";
import { serializeMenuPages } from "@/lib/menu-pages";
import { formatDay } from "@/lib/format-date";

// Menus made in "Design your digital Menu" (owner only).
// GET                 -> { designs: [...] } (list, last changed first)
// GET ?id=...         -> { design }
// PUT { id?, name, design, pageImages, makeActive? }
//                     -> saves the design and its page pictures as a menu in the Menu history
//                        (first save = new menu, later saves = new versions of that menu)
//                        makeActive: it becomes the menu customers see (PDF / Photos menu type)
// PATCH { id, name }  -> renames the design and its menu in the Menu history
// DELETE ?id=...      -> deletes the design (the menu in the history stays)

type Params = { params: Promise<{ id: string }> };

async function loadAuthorized(req: NextRequest, params: Params["params"]) {
  const session = await getSessionFromRequest(req);
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { id } = await params;
  const r = await prisma.restaurant.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    select: { id: true, name: true, ownerId: true, menuPdfUrl: true, menuPdfName: true, primaryMenu: true, updatedAt: true },
  });
  if (!r) return { error: NextResponse.json({ error: "Restaurant not found" }, { status: 404 }) };
  if (session.role !== "SUPER_ADMIN" && r.ownerId !== session.id) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { restaurant: r };
}

const toJson = (d: StoredDesign) => ({
  id: d.id,
  name: d.name,
  design: d.design,
  menuId: d.menuId,
  createdAt: d.createdAt.toISOString(),
  updatedAt: d.updatedAt.toISOString(),
});

/** Names stay unique: a second menu called "Dinner" becomes "Dinner (1)", the next one "Dinner (2)" ...
 *  (the design itself and its own menu don't count) */
async function uniqueName(restaurantId: string, wanted: string, self: StoredDesign | null) {
  const taken = new Set([
    ...(await listBookMenus(restaurantId)).filter((m) => m.menuId !== self?.menuId).map((m) => m.title.toLowerCase()),
    ...(await listDesigns(restaurantId)).filter((d) => d.id !== self?.id).map((d) => d.name.toLowerCase()),
  ]);
  let name = wanted;
  for (let n = 1; taken.has(name.toLowerCase()); n++) name = cleanTitle(`${wanted.slice(0, 74)} (${n})`);
  return name;
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const auth = await loadAuthorized(req, params);
    if (auth.error) return auth.error;
    const id = req.nextUrl.searchParams.get("id");
    if (id) {
      const d = await getDesign(auth.restaurant.id, id);
      if (!d) return NextResponse.json({ error: "Design not found" }, { status: 404 });
      const r = auth.restaurant;
      const isLive = r.primaryMenu === "static" && !!d.menuId
        && (await listBookVersions(r.id)).some((v) => v.menuId === d.menuId && v.menuPdfUrl === r.menuPdfUrl);
      return NextResponse.json({ design: toJson(d), isLive, primaryMenu: r.primaryMenu });
    }
    const designs = await listDesigns(auth.restaurant.id);
    return NextResponse.json({
      primaryMenu: auth.restaurant.primaryMenu,
      designs: designs.map((d) => ({
        id: d.id, name: d.name, menuId: d.menuId, pages: d.design.pages.length,
        createdAt: d.createdAt.toISOString(), updatedAt: d.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("[GET /api/restaurants/[id]/menu-design]", error);
    return NextResponse.json({ error: "Could not load your designs" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const auth = await loadAuthorized(req, params);
    if (auth.error) return auth.error;
    const r = auth.restaurant;
    const body = await req.json().catch(() => null);

    const design = sanitizeDesign(body?.design, r.id);
    delete design.pageImages; // the pictures live in the Menu history
    if (!design.pages.length) return NextResponse.json({ error: "The design needs at least one page." }, { status: 400 });

    const pageImages: unknown = body?.pageImages;
    if (!Array.isArray(pageImages) || pageImages.length !== design.pages.length
      || pageImages.some((u) => typeof u !== "string" || !isOwnMenuUpload(u, r.id))) {
      return NextResponse.json({ error: "The page pictures are missing. Please try again." }, { status: 400 });
    }

    const existing = typeof body?.id === "string" && body.id ? await getDesign(r.id, body.id) : null;
    if (body?.id && !existing) return NextResponse.json({ error: "This design no longer exists" }, { status: 404 });

    const wanted = cleanTitle(body?.name) || `Digital Menu - ${formatDay(new Date(), true)}`;
    // Names stay unique: a second menu called "Dinner" is saved as "Dinner (1)", the next one "Dinner (2)" ...
    // (saving the same design again keeps its own name)
    const name = await uniqueName(r.id, wanted, existing);
    const menuPdfUrl = serializeMenuPages({
      kind: "images", urls: pageImages as string[], ...(design.display === "scroll" ? { display: "scroll" as const } : {}),
    });

    // Saving again = new version of the same menu (based on its newest version, if it still exists)
    let basedOn: string | null = null;
    if (existing?.menuId) {
      const versions = (await listBookVersions(r.id))
        .filter((v) => v.menuId === existing.menuId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      basedOn = versions[0]?.menuPdfUrl ?? null;
    }
    const recorded = await recordSavedMenu({
      restaurantId: r.id, restaurantName: r.name, menuPdfUrl,
      menuPdfName: `${pageImages.length} page${pageImages.length === 1 ? "" : "s"}`,
      title: name, basedOn, strict: true,
    });

    // "Make this the active menu": customers see it when they scan the QR code (as the PDF / Photos menu)
    const menuPdfName = `${pageImages.length} page${pageImages.length === 1 ? "" : "s"}`;
    const makeActive = body?.makeActive === true;
    if (makeActive) {
      await recordLiveMenu(r); // keep the menu that was live in the history
      await prisma.restaurant.update({ where: { id: r.id }, data: { menuPdfUrl, menuPdfName, primaryMenu: "static" } });
    }

    const id = await saveDesign(r.id, { id: existing?.id, name, design, menuId: recorded?.menuId ?? null, menuPdfUrl });
    const saved = await getDesign(r.id, id);
    return NextResponse.json({ success: true, design: saved ? toJson(saved) : null, menuId: recorded?.menuId ?? null, liveUpdated: makeActive, renamed: name !== wanted });
  } catch (error) {
    console.error("[PUT /api/restaurants/[id]/menu-design]", error);
    return NextResponse.json({ error: "Could not save the design" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const auth = await loadAuthorized(req, params);
    if (auth.error) return auth.error;
    const r = auth.restaurant;
    const body = await req.json().catch(() => null);
    const wanted = cleanTitle(body?.name);
    if (!wanted) return NextResponse.json({ error: "Please enter a name" }, { status: 400 });
    const existing = typeof body?.id === "string" ? await getDesign(r.id, body.id) : null;
    if (!existing) return NextResponse.json({ error: "This design no longer exists" }, { status: 404 });
    const name = await uniqueName(r.id, wanted, existing);
    await renameDesign(r.id, existing.id, name);
    if (existing.menuId) await renameBookMenu(r.id, existing.menuId, name);
    return NextResponse.json({ success: true, name, renamed: name !== wanted });
  } catch (error) {
    console.error("[PATCH /api/restaurants/[id]/menu-design]", error);
    return NextResponse.json({ error: "Rename failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const auth = await loadAuthorized(req, params);
    if (auth.error) return auth.error;
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    await deleteDesign(auth.restaurant.id, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/restaurants/[id]/menu-design]", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
