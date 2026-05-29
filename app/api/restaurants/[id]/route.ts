import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { parseJsonField } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

async function findRestaurant(idOrSlug: string) {
  // Try as ID first, then as slug
  const byId = await prisma.restaurant.findUnique({
    where: { id: idOrSlug },
  });
  if (byId) return byId;
  return prisma.restaurant.findUnique({ where: { slug: idOrSlug } });
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id: idOrSlug } = await params;

    const restaurant = await prisma.restaurant.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
      include: {
        categories: {
          orderBy: { order: "asc" },
          include: {
            items: {
              orderBy: { order: "asc" },
            },
          },
        },
        feedbacks: {
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            menuItem: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!restaurant) {
      return NextResponse.json(
        { error: "Restaurant not found" },
        { status: 404 }
      );
    }

    // Get today's daily menu
    const today = new Date().toISOString().slice(0, 10);
    const dailyMenu = await prisma.dailyMenu.findFirst({
      where: { restaurantId: restaurant.id, date: today, isActive: true },
    });

    // Record a scan
    const userAgent = req.headers.get("user-agent") ?? undefined;
    const deviceType = userAgent
      ? /mobile|android|iphone|ipad/i.test(userAgent)
        ? "mobile"
        : "desktop"
      : "unknown";

    await prisma.menuScan.create({
      data: {
        restaurantId: restaurant.id,
        userAgent: userAgent ?? null,
        deviceType,
      },
    });

    // Parse JSON fields
    const cuisineArr = parseJsonField<string[]>(restaurant.cuisine, []);

    type CategoryRow = (typeof restaurant.categories)[number];
    type ItemRow = CategoryRow["items"][number];
    const categoriesWithParsed = restaurant.categories.map((cat: CategoryRow) => ({
      ...cat,
      items: cat.items.map((item: ItemRow) => ({
        ...item,
        allergens: parseJsonField<string[]>(item.allergens, []),
        tags: parseJsonField<string[]>(item.tags, []),
      })),
    }));

    return NextResponse.json({
      restaurant: {
        ...restaurant,
        cuisine: cuisineArr,
        categories: categoriesWithParsed,
        dailyMenu: dailyMenu
          ? {
              ...dailyMenu,
              items: parseJsonField<unknown[]>(dailyMenu.items, []),
            }
          : null,
      },
    });
  } catch (error) {
    console.error("[GET /api/restaurants/[id]]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: idOrSlug } = await params;
    const restaurant = await findRestaurant(idOrSlug);

    if (!restaurant) {
      return NextResponse.json(
        { error: "Restaurant not found" },
        { status: 404 }
      );
    }

    // Only SUPER_ADMIN or the restaurant owner may update
    if (
      session.role !== "SUPER_ADMIN" &&
      restaurant.ownerId !== session.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const {
      name,
      description,
      address,
      phone,
      email,
      website,
      cuisine,
      templateId,
      primaryColor,
      primaryMenu,
      openingHours,
      announcement,
      socialLinks,
      wifiPassword,
      bookingUrl,
      currency,
      promotions,
      themeConfig,
    } = body;

    const updated = await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(address !== undefined && { address }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(website !== undefined && { website }),
        ...(cuisine !== undefined && {
          cuisine: JSON.stringify(Array.isArray(cuisine) ? cuisine : []),
        }),
        ...(templateId !== undefined && { templateId }),
        ...(primaryColor !== undefined && { primaryColor }),
        ...(primaryMenu !== undefined && { primaryMenu }),
        ...(openingHours !== undefined && {
          openingHours: typeof openingHours === "string" ? openingHours : JSON.stringify(openingHours),
        }),
        ...(announcement !== undefined && { announcement: announcement || null }),
        ...(socialLinks !== undefined && {
          socialLinks: typeof socialLinks === "string" ? socialLinks : JSON.stringify(socialLinks),
        }),
        ...(wifiPassword !== undefined && { wifiPassword: wifiPassword || null }),
        ...(bookingUrl !== undefined && { bookingUrl: bookingUrl || null }),
        ...(currency !== undefined && { currency: currency || "€" }),
        ...(promotions !== undefined && {
          promotions: Array.isArray(promotions) ? JSON.stringify(promotions) : (promotions || "[]"),
        }),
        ...(themeConfig !== undefined && {
          themeConfig: typeof themeConfig === "string" ? themeConfig : JSON.stringify(themeConfig),
        }),
      },
    } as Parameters<typeof prisma.restaurant.update>[0]);

    return NextResponse.json({
      restaurant: {
        ...updated,
        cuisine: parseJsonField<string[]>(updated.cuisine, []),
      },
    });
  } catch (error) {
    console.error("[PUT /api/restaurants/[id]]", error);
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

    if (session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: idOrSlug } = await params;
    const restaurant = await findRestaurant(idOrSlug);

    if (!restaurant) {
      return NextResponse.json(
        { error: "Restaurant not found" },
        { status: 404 }
      );
    }

    await prisma.restaurant.delete({ where: { id: restaurant.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/restaurants/[id]]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
