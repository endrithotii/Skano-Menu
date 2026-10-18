import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { dishesWithPhotos } from "@/lib/dish-details";

// Public: the dishes with photos on the menus customers can see now (More > Photos of the dishes).
// GET -> { dishes: [{ name, section, menu, price, ingredients, photos }], currency }

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const r = await prisma.restaurant.findFirst({ where: { OR: [{ id }, { slug: id }] }, select: { id: true, menuPdfUrl: true, primaryMenu: true, currency: true } });
    if (!r) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    const list = await dishesWithPhotos(r);
    return NextResponse.json({
      currency: r.currency || "€",
      dishes: list.slice(0, 200).map(({ dish, menu }) => ({
        name: dish.name, section: dish.section, menu, price: dish.price,
        ingredients: dish.ingredients.map((g) => g.name).join(", "), photos: dish.photos,
      })),
    });
  } catch (error) {
    console.error("[GET dish-photos]", error);
    return NextResponse.json({ dishes: [] });
  }
}
