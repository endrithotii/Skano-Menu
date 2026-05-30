import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const restaurant = await prisma.restaurant.findFirst({
    where: { OR: [{ id }, { slug: id }], ownerId: session.id }, select: { id: true },
  });
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const rid = restaurant.id;

  // Run all queries in parallel
  const [
    scansByDay, scansByHour, scansByDevice,
    topSearchTerms, feedbackStats, itemViewStats,
  ] = await Promise.all([
    // Scans by day (last 30 days)
    (prisma as any).$queryRawUnsafe(`
      SELECT strftime('%Y-%m-%d', "createdAt") as day, COUNT(*) as count
      FROM "MenuScan" WHERE "restaurantId" = ?
        AND "createdAt" >= datetime('now', '-30 days')
      GROUP BY day ORDER BY day ASC
    `, rid),

    // Scans by hour of day
    (prisma as any).$queryRawUnsafe(`
      SELECT strftime('%H', "createdAt") as hour, COUNT(*) as count
      FROM "MenuScan" WHERE "restaurantId" = ?
        AND "createdAt" >= datetime('now', '-30 days')
      GROUP BY hour ORDER BY hour ASC
    `, rid),

    // Scans by device
    (prisma as any).$queryRawUnsafe(`
      SELECT "deviceType", COUNT(*) as count
      FROM "MenuScan" WHERE "restaurantId" = ?
        AND "createdAt" >= datetime('now', '-30 days')
      GROUP BY "deviceType"
    `, rid),

    // Top search terms
    (prisma as any).$queryRawUnsafe(`
      SELECT "term", "count", "lastSearchedAt"
      FROM "SearchTerm" WHERE "restaurantId" = ?
      ORDER BY "count" DESC LIMIT 20
    `, rid),

    // Feedback stats
    (prisma as any).$queryRawUnsafe(`
      SELECT
        COUNT(*) as total,
        AVG("rating") as avgRating,
        SUM(CASE WHEN "rating" = 5 THEN 1 ELSE 0 END) as fiveStar,
        SUM(CASE WHEN "rating" = 4 THEN 1 ELSE 0 END) as fourStar,
        SUM(CASE WHEN "rating" = 3 THEN 1 ELSE 0 END) as threeStar,
        SUM(CASE WHEN "rating" <= 2 THEN 1 ELSE 0 END) as lowStar
      FROM "Feedback" WHERE "restaurantId" = ?
    `, rid),

    // Item view counts (top 10 most viewed)
    (prisma as any).$queryRawUnsafe(`
      SELECT mi."id", mi."name", mi."viewCount", mi."price",
             COUNT(f."id") as feedbackCount, AVG(f."rating") as avgRating
      FROM "MenuItem" mi
      JOIN "MenuCategory" mc ON mi."categoryId" = mc."id"
      LEFT JOIN "Feedback" f ON f."menuItemId" = mi."id"
      WHERE mc."restaurantId" = ?
      GROUP BY mi."id"
      ORDER BY mi."viewCount" DESC LIMIT 10
    `, rid),
  ]);

  // Total scans
  const totalScans = await prisma.menuScan.count({ where: { restaurantId: rid } });
  const thisMonthScans = await prisma.menuScan.count({
    where: { restaurantId: rid, createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
  });
  const lastMonthScans = await prisma.menuScan.count({
    where: {
      restaurantId: rid,
      createdAt: {
        gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
    },
  });

  return NextResponse.json({
    totalScans,
    thisMonthScans,
    lastMonthScans,
    growthPercent: lastMonthScans > 0 ? Math.round(((thisMonthScans - lastMonthScans) / lastMonthScans) * 100) : null,
    scansByDay,
    scansByHour,
    scansByDevice,
    topSearchTerms,
    feedbackStats: (feedbackStats as any[])[0] ?? {},
    itemViewStats,
  });
}
