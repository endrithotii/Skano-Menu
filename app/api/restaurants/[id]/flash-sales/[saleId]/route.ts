import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

type Params = { params: Promise<{ id: string; saleId: string }> };

// PATCH — toggle or update a flash sale
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, saleId } = await params;
  const restaurant = await prisma.restaurant.findFirst({
    where: { OR: [{ id }, { slug: id }], ownerId: session.id }, select: { id: true },
  });
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json() as Record<string, unknown>;

  if (body.isActive !== undefined) {
    await (prisma as any).$executeRawUnsafe(
      `UPDATE "FlashSale" SET "isActive" = ? WHERE "id" = ? AND "restaurantId" = ?`,
      body.isActive ? 1 : 0, saleId, restaurant.id
    );
  }
  return NextResponse.json({ success: true });
}

// DELETE — remove a flash sale
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, saleId } = await params;
  const restaurant = await prisma.restaurant.findFirst({
    where: { OR: [{ id }, { slug: id }], ownerId: session.id }, select: { id: true },
  });
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await (prisma as any).$executeRawUnsafe(
    `DELETE FROM "FlashSale" WHERE "id" = ? AND "restaurantId" = ?`,
    saleId, restaurant.id
  );
  return NextResponse.json({ success: true });
}
