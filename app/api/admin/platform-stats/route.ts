import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [
    totalRestaurants, activeRestaurants, pendingRestaurants,
    totalManagers, totalWaiters,
    totalScans, scansThisMonth, scansLastMonth,
    totalFeedbacks, avgRating,
    topRestaurants, recentRestaurants,
    scansByDay, planBreakdown,
  ] = await Promise.all([
    prisma.restaurant.count(),
    prisma.restaurant.count({ where: { status: "ACTIVE" } }),
    prisma.restaurant.count({ where: { status: "PENDING" } }),
    prisma.user.count({ where: { role: "MANAGER" } }),
    prisma.user.count({ where: { role: "WAITER" } }),
    prisma.menuScan.count(),
    prisma.menuScan.count({ where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } }),
    prisma.menuScan.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
          lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.feedback.count(),
    (prisma as any).$queryRawUnsafe(`SELECT AVG("rating") as avg FROM "Feedback"`),

    // Top restaurants by scan count
    (prisma as any).$queryRawUnsafe(`
      SELECT r."id", r."name", r."slug", r."status", r."planTier",
             COUNT(ms."id") as scanCount
      FROM "Restaurant" r
      LEFT JOIN "MenuScan" ms ON ms."restaurantId" = r."id"
      GROUP BY r."id" ORDER BY scanCount DESC LIMIT 10
    `),

    // Recently registered restaurants
    prisma.restaurant.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, name: true, slug: true, status: true, createdAt: true, planTier: true },
    }),

    // Global scans by day (last 30 days)
    (prisma as any).$queryRawUnsafe(`
      SELECT strftime('%Y-%m-%d', "createdAt") as day, COUNT(*) as count
      FROM "MenuScan"
      WHERE "createdAt" >= datetime('now', '-30 days')
      GROUP BY day ORDER BY day ASC
    `),

    // Plan tier breakdown
    (prisma as any).$queryRawUnsafe(`
      SELECT COALESCE("planTier", 'free') as tier, COUNT(*) as count
      FROM "Restaurant" GROUP BY tier
    `),
  ]);

  const growthPercent = scansLastMonth > 0
    ? Math.round(((scansThisMonth - scansLastMonth) / scansLastMonth) * 100)
    : null;

  return NextResponse.json({
    restaurants: { total: totalRestaurants, active: activeRestaurants, pending: pendingRestaurants },
    users: { managers: totalManagers, waiters: totalWaiters },
    scans: { total: totalScans, thisMonth: scansThisMonth, lastMonth: scansLastMonth, growthPercent },
    feedback: { total: totalFeedbacks, avgRating: (avgRating as any[])[0]?.avg ?? null },
    topRestaurants,
    recentRestaurants,
    scansByDay,
    planBreakdown,
  });
}
