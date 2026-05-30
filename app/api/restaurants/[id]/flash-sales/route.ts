import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

async function getRestaurant(id: string, session: { id: string }) {
  return prisma.restaurant.findFirst({
    where: { OR: [{ id }, { slug: id }], ownerId: session.id },
    select: { id: true },
  });
}

function parseRow(row: Record<string, unknown>) {
  return {
    ...row,
    itemIds: (() => { try { return JSON.parse(row.itemIds as string || "[]"); } catch { return []; } })(),
    isActive: row.isActive === 1 || row.isActive === true,
  };
}

// GET — list all flash sales for a restaurant
export async function GET(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const restaurant = await getRestaurant(id, session);
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = await (prisma as any).$queryRawUnsafe(
    `SELECT * FROM "FlashSale" WHERE "restaurantId" = ? ORDER BY "createdAt" DESC`,
    restaurant.id
  ) as Record<string, unknown>[];

  return NextResponse.json({ flashSales: rows.map(parseRow) });
}

// POST — create a flash sale
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const restaurant = await getRestaurant(id, session);
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { title, discountType, discountValue, itemIds, startsAt, endsAt } =
    await req.json() as {
      title: string; discountType: string; discountValue: number;
      itemIds: string[]; startsAt: string; endsAt: string;
    };

  if (!title || !discountValue || !startsAt || !endsAt) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const saleId = `fs_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  await (prisma as any).$executeRawUnsafe(
    `INSERT INTO "FlashSale" ("id","restaurantId","title","discountType","discountValue","itemIds","startsAt","endsAt","isActive","createdAt")
     VALUES (?,?,?,?,?,?,?,?,1,datetime('now'))`,
    saleId, restaurant.id, title, discountType || "percent", discountValue,
    JSON.stringify(Array.isArray(itemIds) ? itemIds : []), startsAt, endsAt
  );

  return NextResponse.json({ id: saleId }, { status: 201 });
}
