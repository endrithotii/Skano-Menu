import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { forbidUnless } from "@/lib/staff-access";
import { logAction } from "@/lib/action-log";

type Params = { params: Promise<{ id: string }> };

// GET — list snapshots
export async function GET(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const restaurant = await prisma.restaurant.findFirst({
    where: { OR: [{ id }, { slug: id }] }, select: { id: true, ownerId: true },
  });
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });
  { const denied = await forbidUnless(session, restaurant, "menu.edit"); if (denied) return denied; }

  const rows = await (prisma as any).$queryRawUnsafe(
    `SELECT "id","label","createdAt" FROM "MenuSnapshot" WHERE "restaurantId" = ? AND "data" NOT LIKE ? ORDER BY "createdAt" DESC LIMIT 20`,
    restaurant.id, '{"type":%' // book versions and the menu tree live in the same table (lib/menu-history.ts, lib/menu-tree.ts)
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
    where: { OR: [{ id }, { slug: id }] },
    include: {
      categories: { orderBy: { order: "asc" }, include: { items: { orderBy: { order: "asc" } } } },
    },
  });
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });
  { const denied = await forbidUnless(session, restaurant, "menu.edit"); if (denied) return denied; }

  const snapshotId = `snap_${Date.now()}`;
  const snapshotLabel = label?.trim() || `Snapshot ${new Date().toLocaleDateString()}`;
  await (prisma as any).$executeRawUnsafe(
    `INSERT INTO "MenuSnapshot" ("id","restaurantId","label","data","createdAt") VALUES (?,?,?,?,datetime('now'))`,
    snapshotId, restaurant.id, snapshotLabel, JSON.stringify(restaurant.categories)
  );

  await logAction(session, restaurant, "digital.edit", `Saved a snapshot of the digital menu: "${snapshotLabel}"`);
  return NextResponse.json({ id: snapshotId, label: snapshotLabel }, { status: 201 });
}

// DELETE — remove a snapshot by id (query param)
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const restaurant = await prisma.restaurant.findFirst({
    where: { OR: [{ id }, { slug: id }] }, select: { id: true, ownerId: true },
  });
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });
  { const denied = await forbidUnless(session, restaurant, "menu.edit"); if (denied) return denied; }

  const { searchParams } = new URL(req.url);
  const snapshotId = searchParams.get("snapshotId");
  if (!snapshotId) return NextResponse.json({ error: "snapshotId required" }, { status: 400 });

  await (prisma as any).$executeRawUnsafe(
    `DELETE FROM "MenuSnapshot" WHERE "id" = ? AND "restaurantId" = ? AND "data" NOT LIKE ?`,
    snapshotId, restaurant.id, '{"type":%'
  );
  await logAction(session, restaurant, "digital.edit", "Deleted a snapshot of the digital menu");
  return NextResponse.json({ success: true });
}
