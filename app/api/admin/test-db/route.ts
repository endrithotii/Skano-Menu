import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

export async function GET(request: NextRequest) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: "DATABASE_URL not set" },
        { status: 500 }
      );
    }

    const adapter = new PrismaLibSql({
      url: process.env.DATABASE_URL,
      authToken: process.env.DATABASE_AUTH_TOKEN,
    });
    const prisma = new PrismaClient({ adapter } as any);

    // Try to connect and query
    const userCount = await prisma.user.count();
    const restaurantCount = await prisma.restaurant.count();

    await prisma.$disconnect();

    return NextResponse.json({
      status: "✓ Connected",
      userCount,
      restaurantCount,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Database connection failed",
        message: error.message,
      },
      { status: 500 }
    );
  }
}
