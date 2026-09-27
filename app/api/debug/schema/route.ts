import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const tables = await prisma.$queryRawUnsafe<any[]>(
      `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
    );

    const restaurantTableInfo = await prisma.$queryRawUnsafe<any[]>(
      `PRAGMA table_info("Restaurant")`
    ).catch(() => null);

    const restaurantNewTableInfo = await prisma.$queryRawUnsafe<any[]>(
      `PRAGMA table_info("Restaurant_new")`
    ).catch(() => null);

    const restaurantCount = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*) as count FROM "Restaurant"`
    ).catch(() => ({ error: "Table does not exist" }));

    const restaurantNewCount = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*) as count FROM "Restaurant_new"`
    ).catch(() => ({ error: "Table does not exist" }));

    return NextResponse.json({
      tables,
      restaurantTable: {
        exists: restaurantTableInfo !== null,
        columns: restaurantTableInfo?.length ?? 0,
        info: restaurantTableInfo,
      },
      restaurantNewTable: {
        exists: restaurantNewTableInfo !== null,
        columns: restaurantNewTableInfo?.length ?? 0,
        info: restaurantNewTableInfo,
      },
      counts: {
        restaurant: restaurantCount,
        restaurantNew: restaurantNewCount,
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      details: error.toString(),
      stack: error.stack,
    }, { status: 500 });
  }
}
