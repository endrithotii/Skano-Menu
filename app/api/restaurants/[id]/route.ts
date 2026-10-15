import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { parseJsonField } from "@/lib/utils";
import { effectiveMenu } from "@/lib/menu-schedule";
import { activeAnnouncements } from "@/lib/announcements";
import { accessFor } from "@/lib/staff-access";
import type { Permission } from "@/lib/permissions";

/** Which permission each restaurant field needs (see lib/permissions.ts) */
const FIELD_PERMISSION: Record<string, Permission> = {
  name: "settings.edit", description: "settings.edit", address: "settings.edit", phone: "settings.edit", email: "settings.edit",
  website: "settings.edit", cuisine: "settings.edit", wifiPassword: "settings.edit", bookingUrl: "settings.edit", currency: "settings.edit",
  templateId: "settings.edit", primaryColor: "settings.edit", promotions: "settings.edit",
  openingHours: "hours.edit", announcement: "announcements.manage", socialLinks: "social.edit", primaryMenu: "menu.live",
  themeConfig: "feedback.manage",
  metaTitle: "seo.manage", metaDescription: "seo.manage", googleAnalyticsId: "seo.manage", googlePlaceId: "seo.manage",
};

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

    // The public menu page (?view=public) shows a scheduled menu while it runs (lib/menu-schedule.ts)
    let live: Awaited<ReturnType<typeof effectiveMenu>> | null = null;
    let announcementNow: string | null | undefined;
    if (req.nextUrl.searchParams.get("view") === "public") {
      live = await effectiveMenu(restaurant).catch((err) => { console.error("[schedule]", err); return null; });
      // Announcements page: what shows now (the old Settings text until it is moved in)
      const ann = await activeAnnouncements(restaurant.id).catch(() => []);
      if (ann.length) announcementNow = ann.map((a) => a.message).join("\n\n");
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
        ...(announcementNow ? { announcement: announcementNow } : {}),
        ...(live ? { menuPdfUrl: live.menuPdfUrl, menuPdfName: live.menuPdfName, primaryMenu: live.primaryMenu, scheduledUntil: live.scheduledUntil } : {}),
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

    const body = await req.json();
    // Each field belongs to a page, and needs that page's permission (the owner can change everything)
    {
      const access = await accessFor(session, restaurant);
      const missing = Object.keys(body ?? {}).filter((k) => FIELD_PERMISSION[k] && !access.permissions.has(FIELD_PERMISSION[k]));
      if (missing.length) {
        return NextResponse.json({ error: "You don't have access to change this. Ask the manager to give you access on Staff & roles." }, { status: 403 });
      }
    }
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
      metaTitle, metaDescription, googleAnalyticsId, googlePlaceId,
    } = body;

    const updated = await (prisma.restaurant.update as Function)({
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
        ...((primaryMenu === "static" || primaryMenu === "dynamic" || primaryMenu === "tree") && { primaryMenu }),
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
        ...(metaTitle !== undefined && { metaTitle: metaTitle || null }),
        ...(metaDescription !== undefined && { metaDescription: metaDescription || null }),
        ...(googleAnalyticsId !== undefined && { googleAnalyticsId: googleAnalyticsId || null }),
        ...(googlePlaceId !== undefined && { googlePlaceId: googlePlaceId || null }),
      },
    });

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
