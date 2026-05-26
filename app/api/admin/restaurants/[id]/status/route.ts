import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { parseJsonField } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

const VALID_STATUSES = ["ACTIVE", "PENDING", "SUSPENDED"] as const;
type Status = (typeof VALID_STATUSES)[number];

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const restaurant = await prisma.restaurant.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });

    if (!restaurant) {
      return NextResponse.json(
        { error: "Restaurant not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { status } = body;

    if (!status || !VALID_STATUSES.includes(status as Status)) {
      return NextResponse.json(
        {
          error: `status must be one of: ${VALID_STATUSES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const updated = await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { status: status as string },
    });

    return NextResponse.json({
      restaurant: {
        ...updated,
        cuisine: parseJsonField<string[]>(updated.cuisine, []),
      },
    });
  } catch (error) {
    console.error("[PUT /api/admin/restaurants/[id]/status]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
