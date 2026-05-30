import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const restaurant = await prisma.restaurant.findFirst({
    where: { OR: [{ id }, { slug: id }], ownerId: session.id }, select: { id: true },
  });
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = await (prisma as any).$queryRawUnsafe(
    `SELECT * FROM "OperatingException" WHERE "restaurantId" = ? ORDER BY "date" ASC`,
    restaurant.id
  ) as any[];

  return NextResponse.json({ exceptions: rows.map(r => ({ ...r, closed: r.closed === 1 || r.closed === true })) });
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const restaurant = await prisma.restaurant.findFirst({
    where: { OR: [{ id }, { slug: id }], ownerId: session.id }, select: { id: true },
  });
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { date, label, closed, openTime, closeTime } = await req.json() as {
    date: string; label: string; closed: boolean; openTime?: string; closeTime?: string;
  };

  if (!date || !label) return NextResponse.json({ error: "date and label required" }, { status: 400 });

  const exId = `exc_${Date.now()}`;
  await (prisma as any).$executeRawUnsafe(
    `INSERT INTO "OperatingException" ("id","restaurantId","date","label","closed","openTime","closeTime","createdAt")
     VALUES (?,?,?,?,?,?,?,datetime('now'))
     ON CONFLICT("id") DO NOTHING`,
    exId, restaurant.id, date, label, closed ? 1 : 0, openTime ?? null, closeTime ?? null
  );

  return NextResponse.json({ id: exId }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const restaurant = await prisma.restaurant.findFirst({
    where: { OR: [{ id }, { slug: id }], ownerId: session.id }, select: { id: true },
  });
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const exId = searchParams.get("id");
  if (!exId) return NextResponse.json({ error: "id required" }, { status: 400 });

  await (prisma as any).$executeRawUnsafe(
    `DELETE FROM "OperatingException" WHERE "id" = ? AND "restaurantId" = ?`,
    exId, restaurant.id
  );
  return NextResponse.json({ success: true });
}
