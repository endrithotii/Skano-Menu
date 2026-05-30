import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

// POST /api/restaurants/[id]/clone-item  body: { itemId }
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { itemId } = await req.json() as { itemId: string };

  const restaurant = await prisma.restaurant.findFirst({
    where: { OR: [{ id }, { slug: id }], ownerId: session.id },
    select: { id: true },
  });
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const original = await prisma.menuItem.findFirst({
    where: { id: itemId, category: { restaurantId: restaurant.id } },
  });
  if (!original) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  // Clone with modified name
  const cloned = await (prisma.menuItem.create as Function)({
    data: {
      name: `${(original as any).name} (Copy)`,
      description: (original as any).description,
      price: (original as any).price,
      image: (original as any).image,
      images: (original as any).images ?? "[]",
      allergens: (original as any).allergens,
      tags: (original as any).tags,
      prepTime: (original as any).prepTime,
      isAvailable: (original as any).isAvailable,
      isFeatured: false,
      isHidden: (original as any).isHidden ?? false,
      order: ((original as any).order ?? 0) + 1,
      spiceLevel: (original as any).spiceLevel,
      calories: (original as any).calories,
      protein: (original as any).protein,
      carbs: (original as any).carbs,
      fat: (original as any).fat,
      costPrice: (original as any).costPrice,
      chefNote: (original as any).chefNote,
      variants: (original as any).variants ?? "[]",
      categoryId: (original as any).categoryId,
    },
  });

  return NextResponse.json({ item: cloned }, { status: 201 });
}
