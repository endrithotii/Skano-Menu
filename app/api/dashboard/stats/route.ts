import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Resolve the restaurant for this owner
    let restaurantId = session.restaurantId;

    if (!restaurantId) {
      // Fallback: look up from DB
      const restaurant = await prisma.restaurant.findUnique({
        where: { ownerId: session.id },
        select: { id: true },
      });
      if (!restaurant) {
        return NextResponse.json(
          { error: "No restaurant found for this user" },
          { status: 404 }
        );
      }
      restaurantId = restaurant.id;
    }

    // Total scans
    const totalScans = await prisma.menuScan.count({
      where: { restaurantId },
    });

    // Scans last 7 days — aggregate in JS
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const recentScans = await prisma.menuScan.findMany({
      where: { restaurantId, createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true },
    });

    const scansByDate: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      scansByDate[key] = 0;
    }
    for (const scan of recentScans) {
      const key = scan.createdAt.toISOString().slice(0, 10);
      if (key in scansByDate) {
        scansByDate[key]++;
      }
    }
    const scansLast7Days = Object.entries(scansByDate).map(([date, count]) => ({
      date,
      count,
    }));

    // Feedback stats
    const feedbacks = await prisma.feedback.findMany({
      where: { restaurantId },
      select: { rating: true },
    });
    const totalFeedbacks = feedbacks.length;
    const avgRating =
      totalFeedbacks > 0
        ? feedbacks.reduce((acc: number, f: { rating: number }) => acc + f.rating, 0) /
          totalFeedbacks
        : null;

    // Total items across all categories
    const categories = await prisma.menuCategory.findMany({
      where: { restaurantId },
      select: {
        id: true,
        items: { select: { id: true } },
      },
    });
    type CategoryWithItems = (typeof categories)[number];
    const totalItems = categories.reduce(
      (acc: number, cat: CategoryWithItems) => acc + cat.items.length,
      0
    );

    // Popular items — top 5 items by feedback count
    const categoryIds = categories.map((c: CategoryWithItems) => c.id);
    const items = await prisma.menuItem.findMany({
      where: { categoryId: { in: categoryIds } },
      select: {
        id: true,
        name: true,
        price: true,
        feedbacks: { select: { rating: true } },
        category: { select: { id: true, name: true } },
      },
    });

    type ItemWithFeedbacks = (typeof items)[number];
    const popularItems = items
      .map((item: ItemWithFeedbacks) => {
        const feedbackCount = item.feedbacks.length;
        const itemAvgRating =
          feedbackCount > 0
            ? item.feedbacks.reduce(
                (acc: number, f: { rating: number }) => acc + f.rating,
                0
              ) / feedbackCount
            : null;
        return {
          id: item.id,
          name: item.name,
          price: item.price,
          category: item.category,
          feedbackCount,
          _count: { feedbacks: feedbackCount },
          avgRating:
            itemAvgRating !== null
              ? Math.round(itemAvgRating * 10) / 10
              : null,
        };
      })
      .sort(
        (a: { feedbackCount: number }, b: { feedbackCount: number }) =>
          b.feedbackCount - a.feedbackCount
      )
      .slice(0, 5);

    const restaurantData = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true, name: true, status: true, slug: true, menuPdfUrl: true, menuPdfName: true },
    });

    return NextResponse.json({
      restaurantId,
      restaurant: restaurantData,
      totalScans,
      scansLast7Days,
      totalFeedbacks,
      avgRating: avgRating !== null ? Math.round(avgRating * 10) / 10 : null,
      totalItems,
      popularItems,
    });
  } catch (error) {
    console.error("[GET /api/dashboard/stats]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
