import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const [totalCount, activeCount, pendingCount] = await Promise.all([
      prisma.restaurant.count(),
      prisma.restaurant.count({ where: { status: "ACTIVE" } }),
      prisma.restaurant.count({ where: { status: "PENDING" } }),
    ]);

    // Get list of all restaurants with their status
    const allRestaurants = await prisma.restaurant.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        ownerId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      summary: {
        total: totalCount,
        active: activeCount,
        pending: pendingCount,
      },
      restaurants: allRestaurants,
    });
  } catch (error) {
    console.error("[GET /api/admin/restaurant-count]", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
