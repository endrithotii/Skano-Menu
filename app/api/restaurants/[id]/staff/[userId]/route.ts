import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

type Params = { params: Promise<{ id: string; userId: string }> };

// DELETE /api/restaurants/[id]/staff/[userId] — remove a waiter
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, userId } = await params;
  const restaurant = await prisma.restaurant.findFirst({
    where: { OR: [{ id }, { slug: id }], ownerId: session.id },
    select: { id: true },
  });
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Make sure the user is actually a waiter of this restaurant
  const waiter = await prisma.user.findFirst({
    where: { id: userId, staffRestaurantId: restaurant.id, role: "WAITER" },
  });
  if (!waiter) return NextResponse.json({ error: "Waiter not found" }, { status: 404 });

  await prisma.user.delete({ where: { id: userId } });
  return NextResponse.json({ success: true });
}

// PATCH /api/restaurants/[id]/staff/[userId] — update waiter name/password
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, userId } = await params;
  const restaurant = await prisma.restaurant.findFirst({
    where: { OR: [{ id }, { slug: id }], ownerId: session.id },
    select: { id: true },
  });
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const waiter = await prisma.user.findFirst({
    where: { id: userId, staffRestaurantId: restaurant.id, role: "WAITER" },
  });
  if (!waiter) return NextResponse.json({ error: "Waiter not found" }, { status: 404 });

  const { name, password, assignedTables } = await req.json() as {
    name?: string; password?: string; assignedTables?: string[];
  };
  const updateData: Record<string, string> = {};
  if (name?.trim()) updateData.name = name.trim();
  if (password && password.length >= 6) {
    const bcrypt = await import("bcryptjs");
    updateData.password = await bcrypt.hash(password, 10);
  }
  if (Array.isArray(assignedTables)) {
    updateData.assignedTables = JSON.stringify(assignedTables.map(String));
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const updated = await (prisma.user.update as Function)({
    where: { id: userId },
    data: updateData,
    select: { id: true, name: true, email: true, assignedTables: true },
  });

  let tables: string[] = [];
  try { tables = JSON.parse(updated.assignedTables || "[]"); } catch { tables = []; }

  return NextResponse.json({ waiter: { ...updated, assignedTables: tables } });
}
