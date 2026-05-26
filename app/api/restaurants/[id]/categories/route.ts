import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { parseJsonField } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

async function resolveRestaurantId(idOrSlug: string): Promise<string | null> {
  const r = await prisma.restaurant.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    select: { id: true, ownerId: true },
  });
  return r ? r.id : null;
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id: idOrSlug } = await params;
    const restaurantId = await resolveRestaurantId(idOrSlug);

    if (!restaurantId) {
      return NextResponse.json(
        { error: "Restaurant not found" },
        { status: 404 }
      );
    }

    const categories = await prisma.menuCategory.findMany({
      where: { restaurantId },
      orderBy: { order: "asc" },
      include: {
        items: {
          orderBy: { order: "asc" },
        },
      },
    });

    type CategoryRow = (typeof categories)[number];
    type ItemRow = CategoryRow["items"][number];
    const result = categories.map((cat: CategoryRow) => ({
      ...cat,
      items: cat.items.map((item: ItemRow) => ({
        ...item,
        allergens: parseJsonField<string[]>(item.allergens, []),
        tags: parseJsonField<string[]>(item.tags, []),
      })),
    }));

    return NextResponse.json({ categories: result });
  } catch (error) {
    console.error("[GET /api/restaurants/[id]/categories]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: idOrSlug } = await params;

    const restaurant = await prisma.restaurant.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      select: { id: true, ownerId: true },
    });

    if (!restaurant) {
      return NextResponse.json(
        { error: "Restaurant not found" },
        { status: 404 }
      );
    }

    if (
      session.role !== "SUPER_ADMIN" &&
      restaurant.ownerId !== session.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { name, description, icon, order } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Category name is required" },
        { status: 400 }
      );
    }

    const category = await prisma.menuCategory.create({
      data: {
        name,
        description: description ?? null,
        icon: icon ?? null,
        order: order ?? 0,
        restaurantId: restaurant.id,
      },
    });

    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/restaurants/[id]/categories]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
