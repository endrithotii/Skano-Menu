import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { detailedActiveDishes, loadDishSettings } from "@/lib/dish-details";
import { answerQuestion, understandWithAI } from "@/lib/dish-questions";

// Public: customers ask about the dishes (More > Ask about the dishes). Answers use ONLY the kitchen's details
// (Ingredients & details page), see lib/dish-questions.ts.
// GET                -> { enabled }
// POST { question }  -> { answer }

type Params = { params: Promise<{ id: string }> };

async function load(id: string) {
  return prisma.restaurant.findFirst({ where: { OR: [{ id }, { slug: id }] }, select: { id: true, menuPdfUrl: true, primaryMenu: true, currency: true } });
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const r = await load((await params).id);
    if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { askEnabled } = await loadDishSettings(r.id);
    const { items } = askEnabled ? await detailedActiveDishes(r) : { items: [] };
    return NextResponse.json({ enabled: askEnabled && items.length > 0 });
  } catch (error) {
    console.error("[GET /api/restaurants/[id]/ask]", error);
    return NextResponse.json({ enabled: false });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const r = await load((await params).id);
    if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!(await loadDishSettings(r.id)).askEnabled) return NextResponse.json({ error: "This is turned off." }, { status: 403 });
    const body = await req.json().catch(() => null);
    const question = typeof body?.question === "string" ? body.question.trim().slice(0, 500) : "";
    if (!question) return NextResponse.json({ error: "Please type a question." }, { status: 400 });
    const { items, withoutDetails } = await detailedActiveDishes(r);
    const extra = await understandWithAI(question);
    return NextResponse.json({ answer: answerQuestion(question, items, withoutDetails, extra ?? undefined, r.currency || "€") });
  } catch (error) {
    console.error("[POST /api/restaurants/[id]/ask]", error);
    return NextResponse.json({ error: "Could not answer right now. Please ask the waiter." }, { status: 500 });
  }
}
