import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loadMenuDesign, sanitizeDesign, saveMenuDesign } from "@/lib/menu-design";

// The restaurant's designed menu (Digital menu tab).
// GET  (public) -> { restaurant: { name, slug, socialLinks }, design | null }
// PUT  (owner)  -> { design }

type Params = { params: Promise<{ id: string }> };

async function findRestaurant(idOrSlug: string) {
  return prisma.restaurant.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    select: { id: true, name: true, slug: true, ownerId: true, socialLinks: true },
  });
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const r = await findRestaurant(id);
    if (!r) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    return NextResponse.json({
      restaurant: { name: r.name, slug: r.slug, socialLinks: r.socialLinks },
      design: await loadMenuDesign(r.id),
    });
  } catch (error) {
    console.error("[GET /api/restaurants/[id]/menu-design]", error);
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
    const design = sanitizeDesign(body?.design, r.id);
    if (!design.pages.length) return NextResponse.json({ error: "The design needs at least one page." }, { status: 400 });
    await saveMenuDesign(r.id, design);
    return NextResponse.json({ success: true, design });
  } catch (error) {
    console.error("[PUT /api/restaurants/[id]/menu-design]", error);
    return NextResponse.json({ error: "Could not save the design" }, { status: 500 });
  }
}
