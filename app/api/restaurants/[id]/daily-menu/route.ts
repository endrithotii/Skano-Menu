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

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") ?? undefined;

    const dailyMenus = await prisma.dailyMenu.findMany({
      where: {
        restaurantId: restaurant.id,
        ...(date ? { date } : {}),
      },
      orderBy: { date: "desc" },
    });

    type DailyMenuRecord = (typeof dailyMenus)[number];
    const result = dailyMenus.map((dm: DailyMenuRecord) => ({
      ...dm,
      items: parseJsonField<unknown[]>(dm.items, []),
    }));

    return NextResponse.json({ dailyMenus: result });
  } catch (error) {
    console.error("[GET /api/restaurants/[id]/daily-menu]", error);
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

    if (session.role !== "SUPER_ADMIN" && restaurant.ownerId !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { title, description, items, isActive, date } = body;

    const targetDate =
      date ?? new Date().toISOString().slice(0, 10);

    // Check if a daily menu already exists for this date — upsert logic
    const existing = await prisma.dailyMenu.findFirst({
      where: { restaurantId: restaurant.id, date: targetDate },
    });

    let dailyMenu;
    if (existing) {
      dailyMenu = await prisma.dailyMenu.update({
        where: { id: existing.id },
        data: {
          ...(title !== undefined && { title }),
          ...(description !== undefined && { description }),
          ...(items !== undefined && {
            items: JSON.stringify(Array.isArray(items) ? items : []),
          }),
          ...(isActive !== undefined && { isActive: Boolean(isActive) }),
        },
      });
    } else {
      dailyMenu = await prisma.dailyMenu.create({
        data: {
          date: targetDate,
          title: title ?? null,
          description: description ?? null,
          items: JSON.stringify(Array.isArray(items) ? items : []),
          isActive: isActive !== undefined ? Boolean(isActive) : true,
          restaurantId: restaurant.id,
        },
      });
    }

    return NextResponse.json({
      dailyMenu: {
        ...dailyMenu,
        items: parseJsonField<unknown[]>(dailyMenu.items, []),
      },
    });
  } catch (error) {
    console.error("[POST /api/restaurants/[id]/daily-menu]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
