import { NextRequest, NextResponse } from "next/server";
import { prisma as db } from "@/lib/db";

// POST /api/restaurants/[id]/search-track
// Public endpoint — no auth required, logs a search term for analytics
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { term } = await req.json();
    if (!term || typeof term !== "string" || term.trim().length < 2) {
      return NextResponse.json({ ok: false });
    }
    const normalized = term.trim().toLowerCase().slice(0, 80);

    // Upsert into SearchTerm table (count + 1 if exists, else insert)
    await db.$executeRawUnsafe(`
      INSERT INTO SearchTerm (id, restaurantId, term, count, lastSearchedAt)
      VALUES (lower(hex(randomblob(8))), ?, ?, 1, datetime('now'))
      ON CONFLICT(restaurantId, term) DO UPDATE SET
        count = count + 1,
        lastSearchedAt = datetime('now')
    `, id, normalized);

    return NextResponse.json({ ok: true });
  } catch {
    // Fail silently — search tracking is non-critical
    return NextResponse.json({ ok: false });
  }
}

// GET /api/restaurants/[id]/search-track
// Auth required — returns top search terms
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);

    const terms = await db.$queryRawUnsafe(`
      SELECT term, count, lastSearchedAt
      FROM SearchTerm
      WHERE restaurantId = ?
      ORDER BY count DESC
      LIMIT ?
    `, id, limit) as { term: string; count: number; lastSearchedAt: string }[];

    return NextResponse.json({ terms });
  } catch {
    return NextResponse.json({ terms: [] });
  }
}
