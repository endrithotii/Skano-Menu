import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

// GET /api/waiter/session — returns waiter's restaurant info
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== "WAITER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      name: true,
      staffRestaurantId: true,
      staffRestaurant: { select: { id: true, name: true } },
    },
  });

  if (!user?.staffRestaurant) {
    return NextResponse.json({ error: "No restaurant linked" }, { status: 404 });
  }

  return NextResponse.json({
    name: user.name,
    restaurantId: user.staffRestaurant.id,
    restaurantName: user.staffRestaurant.name,
  });
}
