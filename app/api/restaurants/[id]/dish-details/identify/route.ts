import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { canEditDetails, findDishesSimple, findDishesWithAI } from "@/lib/dish-details";

// POST { text } -> { dishes: [{ name, section, menuText, ingredients }], method: "ai" | "simple" }
// Finds the dishes in the text of a menu (read from the PDF, the photos or the design in the browser).

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const r = await prisma.restaurant.findFirst({ where: { OR: [{ id }, { slug: id }] }, select: { id: true, ownerId: true } });
    if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!(await canEditDetails(session, r))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const body = await req.json().catch(() => null);
    const text = typeof body?.text === "string" ? body.text.slice(0, 20000) : "";
    if (!text.trim()) return NextResponse.json({ dishes: [], method: "simple" });
    const ai = await findDishesWithAI(text);
    if (ai && ai.length) return NextResponse.json({ dishes: ai, method: "ai" });
    return NextResponse.json({ dishes: findDishesSimple(text), method: "simple" });
  } catch (error) {
    console.error("[POST /api/restaurants/[id]/dish-details/identify]", error);
    return NextResponse.json({ error: "Could not read the menu" }, { status: 500 });
  }
}
