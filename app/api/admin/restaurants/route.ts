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

    const restaurants = await prisma.restaurant.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
          },
        },
        categories: {
          include: {
            items: { select: { id: true } },
          },
        },
        scans: { select: { id: true, createdAt: true } },
        feedbacks: { select: { id: true, rating: true } },
      },
    });

    type RestaurantRow = (typeof restaurants)[number];
    const result = restaurants.map((r: RestaurantRow) => {
      const cuisineArr = parseJsonField<string[]>(r.cuisine, []);
      const totalScans = r.scans.length;
      const totalFeedbacks = r.feedbacks.length;
      const avgRating =
        totalFeedbacks > 0
          ? r.feedbacks.reduce(
              (acc: number, f: { rating: number }) => acc + f.rating,
              0
            ) / totalFeedbacks
          : null;
      type CategoryRow = (typeof r.categories)[number];
      const totalItems = r.categories.reduce(
        (acc: number, cat: CategoryRow) => acc + cat.items.length,
        0
      );
      const categoriesCount = r.categories.length;

      // Scans last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      type ScanRow = (typeof r.scans)[number];
      const recentScanCount = r.scans.filter(
        (s: ScanRow) => s.createdAt >= thirtyDaysAgo
      ).length;

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
        cuisine: cuisineArr,
        status: r.status,
        templateId: r.templateId,
        primaryColor: r.primaryColor,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        owner: r.owner,
        stats: {
          totalScans,
          recentScanCount,
          totalFeedbacks,
          avgRating: avgRating !== null ? Math.round(avgRating * 10) / 10 : null,
          totalItems,
          categoriesCount,
        },
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[GET /api/admin/restaurants]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
