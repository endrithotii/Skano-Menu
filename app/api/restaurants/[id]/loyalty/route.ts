import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

// GET — get or create loyalty card for a device (public, uses deviceId from header)
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const deviceId = req.headers.get("x-device-id");
  if (!deviceId) return NextResponse.json({ error: "device-id required" }, { status: 400 });

  const restaurant = await prisma.restaurant.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    select: { id: true, loyaltyEnabled: true, loyaltyStamps: true, loyaltyReward: true },
  }) as any;
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!restaurant.loyaltyEnabled) return NextResponse.json({ enabled: false });

  const rows = await (prisma as any).$queryRawUnsafe(
    `SELECT * FROM "LoyaltyCard" WHERE "restaurantId" = ? AND "deviceId" = ? LIMIT 1`,
    restaurant.id, deviceId
  ) as any[];

  let card = rows[0];
  if (!card) {
    const cardId = `lc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await (prisma as any).$executeRawUnsafe(
      `INSERT INTO "LoyaltyCard" ("id","restaurantId","deviceId","stamps","totalStamps","rewardLabel","createdAt")
       VALUES (?,?,?,0,?,?,datetime('now'))`,
      cardId, restaurant.id, deviceId, restaurant.loyaltyStamps, restaurant.loyaltyReward
    );
    card = { id: cardId, stamps: 0, totalStamps: restaurant.loyaltyStamps, rewardLabel: restaurant.loyaltyReward, completedAt: null };
  }

  return NextResponse.json({ enabled: true, card });
}

// POST — add a stamp (called when customer visits / scans QR)
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const deviceId = req.headers.get("x-device-id");
  if (!deviceId) return NextResponse.json({ error: "device-id required" }, { status: 400 });

  const restaurant = await prisma.restaurant.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    select: { id: true, loyaltyEnabled: true, loyaltyStamps: true },
  }) as any;
  if (!restaurant?.loyaltyEnabled) return NextResponse.json({ error: "Loyalty not enabled" }, { status: 400 });

  const rows = await (prisma as any).$queryRawUnsafe(
    `SELECT * FROM "LoyaltyCard" WHERE "restaurantId" = ? AND "deviceId" = ? LIMIT 1`,
    restaurant.id, deviceId
  ) as any[];

  if (!rows[0]) return NextResponse.json({ error: "Card not found" }, { status: 404 });
  const card = rows[0];

  const newStamps = Math.min(card.stamps + 1, card.totalStamps);
  const completed = newStamps >= card.totalStamps ? "datetime('now')" : "NULL";
  await (prisma as any).$executeRawUnsafe(
    `UPDATE "LoyaltyCard" SET "stamps" = ?, "completedAt" = ${completed} WHERE "id" = ?`,
    newStamps, card.id
  );

  return NextResponse.json({ stamps: newStamps, totalStamps: card.totalStamps, completed: newStamps >= card.totalStamps });
}

// PUT — manager: configure loyalty program
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const restaurant = await prisma.restaurant.findFirst({
    where: { OR: [{ id }, { slug: id }], ownerId: session.id }, select: { id: true },
  });
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { enabled, stamps, reward } = await req.json() as { enabled?: boolean; stamps?: number; reward?: string };

  await (prisma as any).$executeRawUnsafe(
    `UPDATE "Restaurant" SET "loyaltyEnabled" = ?, "loyaltyStamps" = ?, "loyaltyReward" = ? WHERE "id" = ?`,
    enabled ? 1 : 0, stamps ?? 10, reward ?? "Free item", restaurant.id
  );
  return NextResponse.json({ success: true });
}
