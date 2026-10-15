import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { canEditDetails, digitalMenuDishes, getDishDetails, listMenusForDetails, sanitizeDishes, saveDishDetails } from "@/lib/dish-details";
import { getDesign } from "@/lib/menu-design";

// Ingredients & details (owner or chef of the restaurant). See lib/dish-details.ts
// GET              -> { restaurantName, menus: [...], isOwner }
// GET ?key=...     -> { menu, details, designText?, startDishes? }
// PUT { key, dishes, listConfirmed, sourceUrl } -> saves

type Params = { params: Promise<{ id: string }> };

async function load(req: NextRequest, params: Params["params"]) {
  const session = await getSessionFromRequest(req);
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { id } = await params;
  const r = await prisma.restaurant.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    select: { id: true, name: true, ownerId: true, menuPdfUrl: true, primaryMenu: true },
  });
  if (!r) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  if (!(await canEditDetails(session, r))) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { session, restaurant: r };
}

/** The text of a designed menu, in reading order (boxes on the same row joined) */
function designText(design: { pages: { elements: { type: string; text?: string; x: number; y: number; h: number; hidden?: boolean }[] }[] }): string {
  const lines: string[] = [];
  for (const page of design.pages) {
    const els = page.elements.filter((e) => e.type === "text" && e.text?.trim() && !e.hidden).sort((a, b) => a.y - b.y || a.x - b.x);
    let row: typeof els = [];
    const flush = () => { if (row.length) lines.push(row.sort((a, b) => a.x - b.x).map((e) => e.text!.trim()).join("  ")); row = []; };
    for (const e of els) {
      if (row.length && Math.abs(e.y - row[0].y) > Math.max(6, row[0].h * 0.5)) flush();
      // A box with several lines stays several lines
      if (e.text!.includes("\n")) { flush(); lines.push(...e.text!.split("\n")); continue; }
      row.push(e);
    }
    flush();
  }
  return lines.join("\n");
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const x = await load(req, params);
    if ("error" in x) return x.error;
    const r = x.restaurant;
    const menus = await listMenusForDetails(r);
    const key = req.nextUrl.searchParams.get("key");
    if (!key) {
      return NextResponse.json({ restaurantName: r.name, menus, isOwner: x.session.id === r.ownerId || x.session.role === "SUPER_ADMIN" });
    }
    const menu = menus.find((m) => m.key === key);
    if (!menu) return NextResponse.json({ error: "That menu was not found." }, { status: 404 });
    const details = await getDishDetails(r.id, key);
    let text: string | undefined;
    if (menu.kind === "design" && menu.designId) {
      const d = await getDesign(r.id, menu.designId);
      if (d) text = designText(d.design as unknown as Parameters<typeof designText>[0]);
    }
    const startDishes = menu.kind === "digital" && !details ? await digitalMenuDishes(r.id) : undefined;
    return NextResponse.json({ menu, details, designText: text, startDishes });
  } catch (error) {
    console.error("[GET /api/restaurants/[id]/dish-details]", error);
    return NextResponse.json({ error: "Could not load" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const x = await load(req, params);
    if ("error" in x) return x.error;
    const body = await req.json().catch(() => null);
    const key = typeof body?.key === "string" ? body.key : "";
    const menus = await listMenusForDetails(x.restaurant);
    if (!menus.some((m) => m.key === key)) return NextResponse.json({ error: "That menu was not found." }, { status: 404 });
    const dishes = sanitizeDishes(body?.dishes);
    await saveDishDetails(x.restaurant.id, {
      key, dishes, listConfirmed: body?.listConfirmed === true,
      sourceUrl: typeof body?.sourceUrl === "string" ? body.sourceUrl : null,
      updatedAt: new Date().toISOString(), updatedBy: x.session.name ?? x.session.email ?? null,
    });
    return NextResponse.json({ success: true, dishes });
  } catch (error) {
    console.error("[PUT /api/restaurants/[id]/dish-details]", error);
    return NextResponse.json({ error: "Could not save" }, { status: 500 });
  }
}
