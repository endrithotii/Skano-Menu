import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { parseJsonField } from "@/lib/utils";

type Params = { params: Promise<{ id: string; itemId: string }> };

async function resolveRestaurant(idOrSlug: string) {
  return prisma.restaurant.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    select: { id: true, ownerId: true },
  });
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: idOrSlug, itemId } = await params;
    const restaurant = await resolveRestaurant(idOrSlug);

    if (!restaurant) {
      return NextResponse.json(
        { error: "Restaurant not found" },
        { status: 404 }
      );
    }

    if (session.role !== "SUPER_ADMIN" && restaurant.ownerId !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify item belongs to this restaurant (via category)
    const item = await prisma.menuItem.findFirst({
      where: { id: itemId },
      include: { category: { select: { restaurantId: true } } },
    });

    if (!item || item.category.restaurantId !== restaurant.id) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const body = await req.json();
    const {
      name,
      description,
      price,
      image,
      allergens,
      tags,
      prepTime,
      isAvailable,
      isFeatured,
      order,
      categoryId,
    } = body;

    // If categoryId is being changed, verify it belongs to the same restaurant
    if (categoryId !== undefined) {
      const cat = await prisma.menuCategory.findFirst({
        where: { id: categoryId, restaurantId: restaurant.id },
      });
      if (!cat) {
        return NextResponse.json(
          { error: "Category not found in this restaurant" },
          { status: 404 }
        );
      }
    }

    const body_extra = await (async () => body)();
    const { spiceLevel, calories, protein, carbs, fat, costPrice, chefNote, variants, isHidden } = body_extra;

    const updated = await (prisma.menuItem.update as Function)({
      where: { id: itemId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price: Number(price) }),
        ...(image !== undefined && { image }),
        ...(allergens !== undefined && {
          allergens: JSON.stringify(Array.isArray(allergens) ? allergens : []),
        }),
        ...(tags !== undefined && {
          tags: JSON.stringify(Array.isArray(tags) ? tags : []),
        }),
        ...(prepTime !== undefined && { prepTime: prepTime !== null ? Number(prepTime) : null }),
        ...(isAvailable !== undefined && { isAvailable: Boolean(isAvailable) }),
        ...(isFeatured !== undefined && { isFeatured: Boolean(isFeatured) }),
        ...(isHidden !== undefined && { isHidden: Boolean(isHidden) }),
        ...(order !== undefined && { order }),
        ...(categoryId !== undefined && { categoryId }),
        ...(spiceLevel !== undefined && { spiceLevel: spiceLevel != null ? Number(spiceLevel) : null }),
        ...(calories !== undefined && { calories: calories != null ? Number(calories) : null }),
        ...(protein !== undefined && { protein: protein != null ? Number(protein) : null }),
        ...(carbs !== undefined && { carbs: carbs != null ? Number(carbs) : null }),
        ...(fat !== undefined && { fat: fat != null ? Number(fat) : null }),
        ...(costPrice !== undefined && { costPrice: costPrice != null ? Number(costPrice) : null }),
        ...(chefNote !== undefined && { chefNote: chefNote ?? null }),
        ...(variants !== undefined && { variants: JSON.stringify(Array.isArray(variants) ? variants : []) }),
      },
    });

    return NextResponse.json({
      item: {
        ...updated,
        allergens: parseJsonField<string[]>(updated.allergens, []),
        tags: parseJsonField<string[]>(updated.tags, []),
      },
    });
  } catch (error) {
    console.error("[PUT /api/restaurants/[id]/items/[itemId]]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: idOrSlug, itemId } = await params;
    const restaurant = await resolveRestaurant(idOrSlug);

    if (!restaurant) {
      return NextResponse.json(
        { error: "Restaurant not found" },
        { status: 404 }
      );
    }

    if (session.role !== "SUPER_ADMIN" && restaurant.ownerId !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const item = await prisma.menuItem.findFirst({
      where: { id: itemId },
      include: { category: { select: { restaurantId: true } } },
    });

    if (!item || item.category.restaurantId !== restaurant.id) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    await prisma.menuItem.delete({ where: { id: itemId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/restaurants/[id]/items/[itemId]]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
