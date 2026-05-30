import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

// GET — list all restaurants accessible by this manager (owned + managed)
export async function GET(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Primary owned restaurant
  const owned = await prisma.restaurant.findMany({
    where: { ownerId: session.id },
    select: { id: true, name: true, slug: true, status: true, templateId: true, primaryColor: true },
  });

  // Also managed (via RestaurantManager table)
  const managed = await (prisma as any).$queryRawUnsafe(`
    SELECT r."id", r."name", r."slug", r."status", r."templateId", r."primaryColor", rm."role"
    FROM "RestaurantManager" rm
    JOIN "Restaurant" r ON rm."restaurantId" = r."id"
    WHERE rm."userId" = ?
  `, session.id) as any[];

  return NextResponse.json({
    owned: owned.map(r => ({ ...r, accessType: "owner" })),
    managed: managed.map(r => ({ ...r, accessType: r.role })),
    all: [
      ...owned.map(r => ({ ...r, accessType: "owner" })),
      ...managed.map(r => ({ ...r, accessType: r.role })),
    ],
  });
}
