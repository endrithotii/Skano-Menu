import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

// Auto-calculate health score based on restaurant completeness + activity
async function calculateHealthScore(restaurantId: string): Promise<{ score: number; breakdown: Record<string, number> }> {
  const r = await (prisma.restaurant.findUnique as Function)({
    where: { id: restaurantId },
    include: {
      categories: { include: { items: true } },
      feedbacks: { take: 5 },
      scans: { where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
    },
  }) as any;

  if (!r) return { score: 0, breakdown: {} };

  const breakdown: Record<string, number> = {};
  let total = 0;

  // Profile completeness (30 points)
  if (r.name) breakdown.name = 5;
  if (r.description) breakdown.description = 5;
  if (r.address) breakdown.address = 5;
  if (r.phone) breakdown.phone = 5;
  if (r.logo) breakdown.logo = 5;
  if (r.openingHours !== "{}") breakdown.hours = 5;

  // Menu quality (40 points)
  const itemCount = r.categories.reduce((s: number, c: any) => s + c.items.length, 0);
  if (itemCount >= 5)  breakdown.items5 = 10;
  if (itemCount >= 15) breakdown.items15 = 10;
  if (itemCount >= 30) breakdown.items30 = 5;
  const itemsWithImages = r.categories.flatMap((c: any) => c.items).filter((i: any) => i.image).length;
  if (itemsWithImages >= 5) breakdown.images5 = 10;
  if (r.categories.length >= 3) breakdown.categories3 = 5;

  // Activity (20 points)
  if (r.scans.length >= 10)  breakdown.scans10 = 10;
  if (r.scans.length >= 50)  breakdown.scans50 = 5;
  if (r.feedbacks.length >= 3) breakdown.feedbacks3 = 5;

  // Features used (10 points)
  if (r.wifiPassword) breakdown.wifi = 2;
  if (r.bookingUrl) breakdown.booking = 2;
  try { if (JSON.parse(r.socialLinks || "{}").instagram) breakdown.social = 3; } catch { /**/ }
  if (r.announcement) breakdown.announcement = 3;

  for (const v of Object.values(breakdown)) total += v;
  return { score: Math.min(100, total), breakdown };
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId");

  if (restaurantId) {
    const result = await calculateHealthScore(restaurantId);
    return NextResponse.json(result);
  }

  // Calculate for all restaurants
  const restaurants = await prisma.restaurant.findMany({ select: { id: true, name: true, slug: true } });
  const results = await Promise.all(
    restaurants.map(async (r) => {
      const { score } = await calculateHealthScore(r.id);
      return { ...r, healthScore: score };
    })
  );

  return NextResponse.json({ restaurants: results.sort((a, b) => b.healthScore - a.healthScore) });
}

// PATCH — super admin manually sets health score + notes
export async function PATCH(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { restaurantId, healthScore, notes, isVerified } = await req.json() as {
    restaurantId: string; healthScore?: number; notes?: string; isVerified?: boolean;
  };

  await (prisma as any).$executeRawUnsafe(
    `UPDATE "Restaurant" SET
       "healthScore"  = COALESCE(?, "healthScore"),
       "notes"        = COALESCE(?, "notes"),
       "isVerified"   = COALESCE(?, "isVerified")
     WHERE "id" = ?`,
    healthScore ?? null, notes ?? null,
    isVerified !== undefined ? (isVerified ? 1 : 0) : null,
    restaurantId
  );

  return NextResponse.json({ success: true });
}
