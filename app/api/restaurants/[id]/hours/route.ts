import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Public: the restaurant's weekly opening hours (Settings) and its special days (Holiday Hours)
// GET -> { hours: { monday: { open, close, closed }, ... } | null, exceptions: [{ date, label, closed, openTime, closeTime }] }

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const r = await prisma.restaurant.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      select: { id: true, openingHours: true },
    });
    if (!r) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });

    let hours: Record<string, { open?: string; close?: string; closed?: boolean }> | null = null;
    try {
      const h = JSON.parse(r.openingHours || "{}");
      if (h && typeof h === "object" && Object.keys(h).length) hours = h;
    } catch { /* no hours */ }

    // Special days from yesterday on (the viewer's "today" can be a day off from the server's)
    let exceptions: { date: string; label: string; closed: boolean; openTime: string | null; closeTime: string | null }[] = [];
    try {
      const from = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
      const rows = await (prisma as unknown as { $queryRawUnsafe: (q: string, ...a: unknown[]) => Promise<Record<string, unknown>[]> }).$queryRawUnsafe(
        `SELECT "date","label","closed","openTime","closeTime" FROM "OperatingException" WHERE "restaurantId" = ? AND "date" >= ? ORDER BY "date" ASC LIMIT 30`,
        r.id, from,
      );
      exceptions = rows.map((x) => ({
        date: String(x.date),
        label: String(x.label ?? ""),
        closed: x.closed === 1 || x.closed === true || x.closed === "1",
        openTime: (x.openTime as string | null) ?? null,
        closeTime: (x.closeTime as string | null) ?? null,
      }));
    } catch { /* table missing: no special days */ }

    return NextResponse.json({ hours, exceptions });
  } catch (error) {
    console.error("[GET /api/restaurants/[id]/hours]", error);
    return NextResponse.json({ error: "Could not load the opening hours" }, { status: 500 });
  }
}
