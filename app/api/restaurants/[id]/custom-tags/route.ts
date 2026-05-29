import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

function parseTagsField(raw: unknown): string[] {
  try { return JSON.parse(raw as string) as string[]; }
  catch { return []; }
}

async function getRestaurantForManager(id: string, session: NonNullable<Awaited<ReturnType<typeof getSessionFromRequest>>>) {
  return prisma.restaurant.findFirst({
    where: { id, ownerId: session.id },
    select: { id: true, customTags: true },
  });
}

// GET /api/restaurants/[id]/custom-tags  — returns the restaurant's saved tag library
export async function GET(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const restaurant = await getRestaurantForManager(id, session);
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const tags = parseTagsField((restaurant as unknown as { customTags: string }).customTags);
  return NextResponse.json({ tags });
}

// POST /api/restaurants/[id]/custom-tags  — add a tag to the library
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { tag } = await req.json() as { tag: string };
  if (!tag?.trim()) return NextResponse.json({ error: "tag required" }, { status: 400 });

  const restaurant = await getRestaurantForManager(id, session);
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const normalised = tag.trim().toLowerCase();
  const existing = parseTagsField((restaurant as unknown as { customTags: string }).customTags);

  if (existing.includes(normalised)) {
    return NextResponse.json({ tags: existing }); // already there, idempotent
  }

  const updated = [...existing, normalised];
  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: { customTags: JSON.stringify(updated) } as Parameters<typeof prisma.restaurant.update>[0]["data"],
  });

  return NextResponse.json({ tags: updated });
}

// DELETE /api/restaurants/[id]/custom-tags  — remove a tag from the library
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { tag } = await req.json() as { tag: string };
  if (!tag?.trim()) return NextResponse.json({ error: "tag required" }, { status: 400 });

  const restaurant = await getRestaurantForManager(id, session);
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const existing = parseTagsField((restaurant as unknown as { customTags: string }).customTags);
  const updated = existing.filter((t) => t !== tag.trim().toLowerCase());

  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: { customTags: JSON.stringify(updated) } as Parameters<typeof prisma.restaurant.update>[0]["data"],
  });

  return NextResponse.json({ tags: updated });
}
