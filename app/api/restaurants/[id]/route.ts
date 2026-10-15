import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { parseJsonField } from "@/lib/utils";
import { effectiveMenu } from "@/lib/menu-schedule";
import { activeAnnouncements } from "@/lib/announcements";
import { accessFor } from "@/lib/staff-access";
import type { Permission } from "@/lib/permissions";
import { logAction } from "@/lib/action-log";
import { feedbackEnabled } from "@/lib/feedback-settings";

const SETTINGS_LABELS: Record<string, string> = {
  name: "Name", description: "Description", address: "Address", phone: "Phone", email: "Email", website: "Website",
  cuisine: "Cuisine types", bookingUrl: "Booking link", templateId: "Template", primaryColor: "Brand color", promotions: "Promotions",
};
const SEO_LABELS: Record<string, string> = { metaTitle: "Page title", metaDescription: "Page description", googleAnalyticsId: "Google Analytics ID", googlePlaceId: "Google place ID" };
const MENU_TYPES: Record<string, string> = { dynamic: "the digital menu", static: "the PDF or photos menu", tree: "the menu tree" };
const show = (v: unknown) => {
  const t = typeof v === "string" ? v : Array.isArray(v) ? v.join(", ") : v === null || v === undefined ? "" : JSON.stringify(v);
  return t.trim() ? `"${t.length > 80 ? `${t.slice(0, 79)}…` : t}"` : "empty";
};
const asText = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v ?? null));
const parse = (v: unknown): Record<string, unknown> => {
  try { const o = typeof v === "string" ? JSON.parse(v || "{}") : v; return o && typeof o === "object" ? o as Record<string, unknown> : {}; } catch { return {}; }
};
const dayHours = (d: unknown) => {
  const x = (d ?? {}) as { open?: string; close?: string; closed?: boolean };
  return !d || x.closed || !x.open || !x.close ? "closed" : `${x.open} to ${x.close}`;
};

/** Action history for a restaurant update: only what really changed, per page */
async function logRestaurantChanges(session: { id: string; role: string }, before: Record<string, unknown> & { id: string; ownerId: string }, body: Record<string, unknown>) {
  const changed = (k: string, norm: (v: unknown) => string = asText) => body[k] !== undefined && norm(body[k]) !== norm(before[k]);
  const list = (v: unknown) => { try { return typeof v === "string" ? JSON.parse(v || "[]") : v ?? []; } catch { return []; } };
  const settings = Object.keys(SETTINGS_LABELS).filter((k) => changed(k, k === "cuisine" ? (v) => asText(list(v)) : asText));
  const lines = settings.map((k) => `${SETTINGS_LABELS[k]}: ${show(k === "cuisine" ? list(before[k]) : before[k])} → ${show(k === "cuisine" ? list(body[k]) : body[k])}`);
  if (changed("wifiPassword")) lines.push("Changed the Wi-Fi password");
  if (lines.length) await logAction(session, before, "settings.edit", lines.length === 1 ? `Changed the restaurant settings: ${lines[0]}` : "Changed the restaurant settings", lines.length === 1 ? [] : lines);
  if (changed("currency")) await logAction(session, before, "currency.change", `Changed the currency from ${before.currency || "€"} to ${body.currency || "€"}`);
  if (changed("openingHours")) {
    const a = parse(before.openingHours), b = parse(body.openingHours);
    const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    const diff = days.filter((d) => dayHours(a[d]) !== dayHours(b[d])).map((d) => `${d[0].toUpperCase()}${d.slice(1)}: ${dayHours(a[d])} → ${dayHours(b[d])}`);
    await logAction(session, before, "hours.edit", "Changed the weekly opening hours", diff);
  }
  if (changed("socialLinks")) {
    const a = parse(before.socialLinks), b = parse(body.socialLinks);
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => asText(a[k]) !== asText(b[k]));
    await logAction(session, before, "social.edit", "Changed social media", keys.map((k) => (k === "hidden" ? "Changed which ones customers see" : `${k}: ${show(a[k])} → ${show(b[k])}`)));
  }
  if (changed("primaryMenu")) await logAction(session, before, "menu.type", `Changed what customers see to ${MENU_TYPES[String(body.primaryMenu)] ?? body.primaryMenu}`, [`Before: ${MENU_TYPES[String(before.primaryMenu)] ?? before.primaryMenu}`]);
  if (body.themeConfig !== undefined && feedbackEnabled(asText(body.themeConfig)) !== feedbackEnabled(before.themeConfig as string)) {
    await logAction(session, before, "feedback.toggle", feedbackEnabled(asText(body.themeConfig)) ? "Turned customer feedback on" : "Turned customer feedback off");
  }
  const seo = Object.keys(SEO_LABELS).filter((k) => changed(k));
  if (seo.length) await logAction(session, before, "seo.edit", "Changed SEO settings", seo.map((k) => `${SEO_LABELS[k]}: ${show(before[k])} → ${show(body[k])}`));
}

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

    await logRestaurantChanges(session, restaurant as unknown as Record<string, unknown> & { id: string; ownerId: string }, body);

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
