import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { parseJsonField } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Counts come from the database, so the list stays fast however many scans there are
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [restaurants, recentScans, ratings] = await Promise.all([
      prisma.restaurant.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          owner: { select: { id: true, name: true, email: true, createdAt: true } },
          categories: { select: { _count: { select: { items: true } } } },
          _count: { select: { scans: true, feedbacks: true, categories: true } },
        },
      }),
      prisma.menuScan.groupBy({ by: ["restaurantId"], where: { createdAt: { gte: thirtyDaysAgo } }, _count: { _all: true } }),
      prisma.feedback.groupBy({ by: ["restaurantId"], _avg: { rating: true } }),
    ]);
    const recentBy = new Map<string, number>(recentScans.map((x: { restaurantId: string; _count: { _all: number } }) => [x.restaurantId, x._count._all]));
    const ratingBy = new Map<string, number | null>(ratings.map((x: { restaurantId: string; _avg: { rating: number | null } }) => [x.restaurantId, x._avg.rating]));

    type RestaurantRow = (typeof restaurants)[number];
    const result = restaurants.map((r: RestaurantRow) => {
      const avgRating = ratingBy.get(r.id) ?? null;
      return {
        id: r.id,
        name: r.name,
        slug: r.slug,
        description: r.description,
        logo: r.logo,
        address: r.address,
        phone: r.phone,
        email: r.email,
        website: r.website,
        cuisine: parseJsonField<string[]>(r.cuisine, []),
        status: r.status,
        templateId: r.templateId,
        primaryColor: r.primaryColor,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        owner: r.owner ?? { id: "", name: "(no owner)", email: "", createdAt: null },
        stats: {
          totalScans: r._count.scans,
          recentScanCount: recentBy.get(r.id) ?? 0,
          totalFeedbacks: r._count.feedbacks,
          avgRating: avgRating !== null ? Math.round(avgRating * 10) / 10 : null,
          totalItems: r.categories.reduce((n: number, c: { _count: { items: number } }) => n + c._count.items, 0),
          categoriesCount: r._count.categories,
        },
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[GET /api/admin/restaurants]", error);
    return NextResponse.json(
      { error: `Could not load the restaurants: ${error instanceof Error ? error.message : String(error)}`.slice(0, 300) },
      { status: 500 }
    );
  }
}
