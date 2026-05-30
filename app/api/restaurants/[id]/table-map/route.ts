import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

// GET — fetch table map + sections
export async function GET(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const restaurant = await (prisma.restaurant.findFirst as Function)({
    where: { OR: [{ id }, { slug: id }], ownerId: session.id },
    select: { id: true, tableMap: true, sections: true },
  }) as any;
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let tables = []; let sections = [];
  try { tables = JSON.parse(restaurant.tableMap || "[]"); } catch { /**/ }
  try { sections = JSON.parse(restaurant.sections || "[]"); } catch { /**/ }

  return NextResponse.json({ tables, sections });
}

// PUT — save table map + sections
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const restaurant = await prisma.restaurant.findFirst({
    where: { OR: [{ id }, { slug: id }], ownerId: session.id }, select: { id: true },
  });
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { tables, sections } = await req.json() as { tables: unknown[]; sections: string[] };

  await (prisma as any).$executeRawUnsafe(
    `UPDATE "Restaurant" SET "tableMap" = ?, "sections" = ? WHERE "id" = ?`,
    JSON.stringify(Array.isArray(tables) ? tables : []),
    JSON.stringify(Array.isArray(sections) ? sections : []),
    restaurant.id
  );

  return NextResponse.json({ success: true });
}
