import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const activeRestaurants = await prisma.restaurant.findMany({
      where: { status: "ACTIVE" },
      take: 5,
    });

    const allRestaurants = await prisma.restaurant.findMany({
      take: 5,
    });

    return NextResponse.json({
      activeCount: await prisma.restaurant.count({ where: { status: "ACTIVE" } }),
      totalCount: await prisma.restaurant.count(),
      activeRestaurants: activeRestaurants,
      allRestaurants: allRestaurants,
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      details: error.toString(),
    }, { status: 500 });
  }
}
