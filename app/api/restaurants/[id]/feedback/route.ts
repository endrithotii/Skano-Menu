import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

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

    // Auth required for restaurant owner to see their feedbacks
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      session.role !== "SUPER_ADMIN" &&
      restaurant.ownerId !== session.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 100);
    const offset = Number(searchParams.get("offset") ?? "0");

    const feedbacks = await prisma.feedback.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        menuItem: {
          select: { id: true, name: true },
        },
      },
    });

    const total = await prisma.feedback.count({
      where: { restaurantId: restaurant.id },
    });

    return NextResponse.json({ feedbacks, total });
  } catch (error) {
    console.error("[GET /api/restaurants/[id]/feedback]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id: idOrSlug } = await params;
    const restaurant = await resolveRestaurant(idOrSlug);

    if (!restaurant) {
      return NextResponse.json(
        { error: "Restaurant not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { rating, comment, customerName, menuItemId } = body;

    if (rating === undefined || rating === null) {
      return NextResponse.json(
        { error: "rating is required" },
        { status: 400 }
      );
    }

    const numRating = Number(rating);
    if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
      return NextResponse.json(
        { error: "rating must be an integer between 1 and 5" },
        { status: 400 }
      );
    }

    // If menuItemId is provided, verify it belongs to this restaurant
    if (menuItemId) {
      const item = await prisma.menuItem.findFirst({
        where: { id: menuItemId },
        include: { category: { select: { restaurantId: true } } },
      });
      if (!item || item.category.restaurantId !== restaurant.id) {
        return NextResponse.json(
          { error: "Menu item not found in this restaurant" },
          { status: 404 }
        );
      }
    }

    const feedback = await prisma.feedback.create({
      data: {
        rating: numRating,
        comment: comment ?? null,
        customerName: customerName ?? null,
        menuItemId: menuItemId ?? null,
        restaurantId: restaurant.id,
      },
      include: {
        menuItem: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({ feedback }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/restaurants/[id]/feedback]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
