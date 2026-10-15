import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { forbidUnless } from "@/lib/staff-access";
import { logAction } from "@/lib/action-log";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const restaurant = await prisma.restaurant.findFirst({
    where: { OR: [{ id }, { slug: id }] }, select: { id: true, ownerId: true },
  });
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });
  { const denied = await forbidUnless(session, restaurant, "hours.edit"); if (denied) return denied; }

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
    where: { OR: [{ id }, { slug: id }] }, select: { id: true, ownerId: true },
  });
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });
  { const denied = await forbidUnless(session, restaurant, "hours.edit"); if (denied) return denied; }

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
  await logAction(session, restaurant, "holidays.edit", `Added the special day "${label}" on ${date}`, [closed ? "Closed" : `Open ${openTime ?? "?"} to ${closeTime ?? "?"}`]);

  return NextResponse.json({ id: exId }, { status: 201 });
}

// PATCH { id, date, label, closed, openTime?, closeTime? } -> change a special day
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const restaurant = await prisma.restaurant.findFirst({
    where: { OR: [{ id }, { slug: id }] }, select: { id: true, ownerId: true },
  });
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });
  { const denied = await forbidUnless(session, restaurant, "hours.edit"); if (denied) return denied; }

  const { id: exId, date, label, closed, openTime, closeTime } = await req.json() as {
    id: string; date: string; label: string; closed: boolean; openTime?: string; closeTime?: string;
  };
  if (!exId || !date || !label?.trim()) return NextResponse.json({ error: "id, date and label required" }, { status: 400 });
  const rawDb = prisma as unknown as { $queryRawUnsafe: (q: string, ...a: unknown[]) => Promise<{ date: string; label: string; closed: unknown; openTime: string | null; closeTime: string | null }[]> };
  const prev = (await rawDb.$queryRawUnsafe(
    `SELECT "date","label","closed","openTime","closeTime" FROM "OperatingException" WHERE "id" = ? AND "restaurantId" = ?`, exId, restaurant.id,
  ).catch(() => [])).find((x) => x && typeof x.label === "string");

  await (prisma as unknown as { $executeRawUnsafe: (q: string, ...a: unknown[]) => Promise<number> }).$executeRawUnsafe(
    `UPDATE "OperatingException" SET "date" = ?, "label" = ?, "closed" = ?, "openTime" = ?, "closeTime" = ?
     WHERE "id" = ? AND "restaurantId" = ?`,
    date, label.trim(), closed ? 1 : 0, closed ? null : openTime || null, closed ? null : closeTime || null, exId, restaurant.id
  );
  {
    const hours = (c: unknown, o: string | null | undefined, e: string | null | undefined) => (c === true || c === 1 || c === "1" ? "closed" : `open ${o || "?"} to ${e || "?"}`);
    const lines: string[] = [];
    if (prev) {
      if (prev.date !== date) lines.push(`Date: ${prev.date} → ${date}`);
      if (prev.label !== label.trim()) lines.push(`Name: "${prev.label}" → "${label.trim()}"`);
      const a = hours(prev.closed, prev.openTime, prev.closeTime), b = hours(closed, openTime, closeTime);
      if (a !== b) lines.push(`Hours: ${a} → ${b}`);
    } else lines.push(hours(closed, openTime, closeTime));
    if (lines.length) await logAction(session, restaurant, "holidays.edit", `Changed the special day "${label.trim()}" on ${date}`, lines);
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const restaurant = await prisma.restaurant.findFirst({
    where: { OR: [{ id }, { slug: id }] }, select: { id: true, ownerId: true },
  });
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });
  { const denied = await forbidUnless(session, restaurant, "hours.edit"); if (denied) return denied; }

  const { searchParams } = new URL(req.url);
  const exId = searchParams.get("id");
  if (!exId) return NextResponse.json({ error: "id required" }, { status: 400 });

  const raw = prisma as unknown as { $queryRawUnsafe: (q: string, ...a: unknown[]) => Promise<{ date: string; label: string }[]> };
  const gone = await raw.$queryRawUnsafe(
    `SELECT "date","label" FROM "OperatingException" WHERE "id" = ? AND "restaurantId" = ?`, exId, restaurant.id,
  ).catch(() => []);
  await (prisma as any).$executeRawUnsafe(
    `DELETE FROM "OperatingException" WHERE "id" = ? AND "restaurantId" = ?`,
    exId, restaurant.id
  );
  const g = gone.find((x) => x && typeof x.label === "string");
  await logAction(session, restaurant, "holidays.edit", g ? `Removed the special day "${g.label}" on ${g.date}` : "Removed a special day");
  return NextResponse.json({ success: true });
}
