import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const results: any = {
      status: "ok",
      timestamp: new Date().toISOString(),
    };

    // Try to count restaurants
    try {
      const count = await prisma.restaurant.count();
      results.restaurants = { count, accessible: true };
    } catch (err: any) {
      results.restaurants = {
        accessible: false,
        error: err.message
      };
    }

    // Try to list tables
    try {
      const tables = await prisma.$queryRawUnsafe<any[]>(
        `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
      );
      results.tables = tables.map(t => t.name);
    } catch (err: any) {
      results.tables = { error: err.message };
    }

    // Try to get Restaurant table info
    try {
      const columns = await prisma.$queryRawUnsafe<any[]>(
        `PRAGMA table_info("Restaurant")`
      );
      results.restaurantSchema = {
        columnCount: columns.length,
        columns: columns.map(c => ({
          name: c.name,
          type: c.type,
          notnull: c.notnull,
          pk: c.pk,
        })),
      };
    } catch (err: any) {
      results.restaurantSchema = { error: err.message };
    }

    return NextResponse.json(results);
  } catch (error: any) {
    return NextResponse.json({
      status: "error",
      timestamp: new Date().toISOString(),
      error: error.message,
    }, { status: 500 });
  }
}
