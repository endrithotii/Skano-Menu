import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { parseJsonField } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

async function resolveRestaurant(idOrSlug: string) {
  return prisma.restaurant.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    select: { id: true, ownerId: true },
  });
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id: idOrSlug } = await params;
    const restaurant = await resolveRestaurant(idOrSlug);

    if (!restaurant) {
      return NextResponse.json(
        { error: "Restaurant not found" },
        { status: 404 }
      );
    }

    const categories = await prisma.menuCategory.findMany({
      where: { restaurantId: restaurant.id },
      select: { id: true },
    });

    type CategoryRow = (typeof categories)[number];
    const categoryIds = categories.map((c: CategoryRow) => c.id);

    const items = await prisma.menuItem.findMany({
      where: { categoryId: { in: categoryIds } },
      orderBy: { order: "asc" },
      include: {
        category: {
          select: { id: true, name: true },
        },
      },
    });

    type ItemRow = (typeof items)[number];
    const result = items.map((item: ItemRow) => ({
      ...item,
      allergens: parseJsonField<string[]>(item.allergens, []),
      tags: parseJsonField<string[]>(item.tags, []),
    }));

    return NextResponse.json({ items: result });
  } catch (error) {
    console.error("[GET /api/restaurants/[id]/items]", error);
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
    const restaurant = await resolveRestaurant(idOrSlug);

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
    const {
      name, description, price, image, allergens, tags, prepTime,
      isAvailable, isFeatured, order, categoryId,
      // New fields
      spiceLevel, calories, protein, carbs, fat, costPrice, chefNote, variants, isHidden,
    } = body;

    if (!name || price === undefined || !categoryId) {
      return NextResponse.json(
        { error: "name, price, and categoryId are required" },
        { status: 400 }
      );
    }

    // Verify category belongs to this restaurant
    const category = await prisma.menuCategory.findFirst({
      where: { id: categoryId, restaurantId: restaurant.id },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Category not found in this restaurant" },
        { status: 404 }
      );
    }

    const item = await (prisma.menuItem.create as Function)({
      data: {
        name,
        description: description ?? null,
        price: Number(price),
        image: image ?? null,
        allergens: JSON.stringify(Array.isArray(allergens) ? allergens : []),
        tags: JSON.stringify(Array.isArray(tags) ? tags : []),
        prepTime: prepTime != null ? Number(prepTime) : null,
        isAvailable: isAvailable !== undefined ? Boolean(isAvailable) : true,
        isFeatured: isFeatured !== undefined ? Boolean(isFeatured) : false,
        isHidden: isHidden ?? false,
        order: order ?? 0,
        categoryId,
        spiceLevel: spiceLevel != null ? Number(spiceLevel) : null,
        calories: calories != null ? Number(calories) : null,
        protein: protein != null ? Number(protein) : null,
        carbs: carbs != null ? Number(carbs) : null,
        fat: fat != null ? Number(fat) : null,
        costPrice: costPrice != null ? Number(costPrice) : null,
        chefNote: chefNote ?? null,
        variants: JSON.stringify(Array.isArray(variants) ? variants : []),
      },
    });

    return NextResponse.json(
      {
        item: {
          ...item,
          allergens: parseJsonField<string[]>(item.allergens, []),
          tags: parseJsonField<string[]>(item.tags, []),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/restaurants/[id]/items]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
