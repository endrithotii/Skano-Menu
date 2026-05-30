import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

// GET — list snapshots
export async function GET(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const restaurant = await prisma.restaurant.findFirst({
    where: { OR: [{ id }, { slug: id }], ownerId: session.id }, select: { id: true },
  });
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = await (prisma as any).$queryRawUnsafe(
    `SELECT "id","label","createdAt" FROM "MenuSnapshot" WHERE "restaurantId" = ? ORDER BY "createdAt" DESC LIMIT 20`,
    restaurant.id
  );
  return NextResponse.json({ snapshots: rows });
}

// POST — save a snapshot of the current menu
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { label } = await req.json() as { label?: string };

  const restaurant = await prisma.restaurant.findFirst({
    where: { OR: [{ id }, { slug: id }], ownerId: session.id },
    include: {
      categories: { orderBy: { order: "asc" }, include: { items: { orderBy: { order: "asc" } } } },
    },
  });
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const snapshotId = `snap_${Date.now()}`;
  const snapshotLabel = label?.trim() || `Snapshot ${new Date().toLocaleDateString()}`;
  await (prisma as any).$executeRawUnsafe(
    `INSERT INTO "MenuSnapshot" ("id","restaurantId","label","data","createdAt") VALUES (?,?,?,?,datetime('now'))`,
    snapshotId, restaurant.id, snapshotLabel, JSON.stringify(restaurant.categories)
  );

  return NextResponse.json({ id: snapshotId, label: snapshotLabel }, { status: 201 });
}

// DELETE — remove a snapshot by id (query param)
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const restaurant = await prisma.restaurant.findFirst({
    where: { OR: [{ id }, { slug: id }], ownerId: session.id }, select: { id: true },
  });
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const snapshotId = searchParams.get("snapshotId");
  if (!snapshotId) return NextResponse.json({ error: "snapshotId required" }, { status: 400 });

  await (prisma as any).$executeRawUnsafe(
    `DELETE FROM "MenuSnapshot" WHERE "id" = ? AND "restaurantId" = ?`,
    snapshotId, restaurant.id
  );
  return NextResponse.json({ success: true });
}
