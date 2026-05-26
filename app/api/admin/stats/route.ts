import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Aggregate counts
    const [
      totalRestaurants,
      activeRestaurants,
      pendingRestaurants,
      totalUsers,
      totalScans,
      totalFeedbacks,
    ] = await Promise.all([
      prisma.restaurant.count(),
      prisma.restaurant.count({ where: { status: "ACTIVE" } }),
      prisma.restaurant.count({ where: { status: "PENDING" } }),
      prisma.user.count(),
      prisma.menuScan.count(),
      prisma.feedback.count(),
    ]);

    // Scans last 7 days — fetch and aggregate in JS (SQLite limitation)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const recentScans = await prisma.menuScan.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true },
    });

    // Build a map of date -> count for last 7 days
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

    // Top restaurants by total scan count
    const restaurants = await prisma.restaurant.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        scans: { select: { id: true } },
      },
    });

    type RestaurantWithScans = (typeof restaurants)[number];
    const topRestaurants = restaurants
      .map((r: RestaurantWithScans) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        status: r.status,
        _count: { scans: r.scans.length },
        avgRating: 0,
      }))
      .sort(
        (a: { _count: { scans: number } }, b: { _count: { scans: number } }) =>
          b._count.scans - a._count.scans
      )
      .slice(0, 10);

    return NextResponse.json({
      totalRestaurants,
      activeRestaurants,
      pendingRestaurants,
      totalUsers,
      totalScans,
      totalFeedbacks,
      scansLast7Days,
      topRestaurants,
    });
  } catch (error) {
    console.error("[GET /api/admin/stats]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
