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

    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        restaurant: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            cuisine: true,
            createdAt: true,
          },
        },
      },
    });

    type UserWithRestaurant = (typeof users)[number];
    const result = users.map((u: UserWithRestaurant) => ({
      ...u,
      restaurant: u.restaurant
        ? {
            ...u.restaurant,
            cuisine: parseJsonField<string[]>(u.restaurant.cuisine, []),
          }
        : null,
    }));

    return NextResponse.json({ users: result });
  } catch (error) {
    console.error("[GET /api/admin/users]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
