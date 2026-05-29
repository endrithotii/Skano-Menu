import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

type Params = { params: Promise<{ id: string; userId: string }> };

function isSuperAdmin(session: Awaited<ReturnType<typeof getSessionFromRequest>>) {
  return session?.role === "SUPER_ADMIN";
}

// PATCH /api/admin/restaurants/[id]/waiters/[userId]  — update name / password / tables
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session || !isSuperAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, userId } = await params;

  const waiter = await prisma.user.findFirst({
    where: { id: userId, staffRestaurantId: id, role: "WAITER" },
  });
  if (!waiter) return NextResponse.json({ error: "Waiter not found" }, { status: 404 });

  const { name, password, assignedTables } = await req.json() as {
    name?: string; password?: string; assignedTables?: string[];
  };

  const updateData: Record<string, unknown> = {};
  if (name?.trim()) updateData.name = name.trim();
  if (password && password.length >= 6) {
    const bcrypt = await import("bcryptjs");
    updateData.password = await bcrypt.hash(password, 10);
  }
  if (Array.isArray(assignedTables)) {
    const tables = assignedTables.map((t) => t.toString().trim()).filter(Boolean);
    updateData.assignedTables = JSON.stringify(tables);
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: updateData as Parameters<typeof prisma.user.update>[0]["data"],
    select: { id: true, name: true, email: true, assignedTables: true },
  });

  let tables: string[] = [];
  try { tables = JSON.parse((updated as unknown as { assignedTables: string }).assignedTables || "[]"); }
  catch { tables = []; }

  return NextResponse.json({ waiter: { ...updated, assignedTables: tables } });
}

// DELETE /api/admin/restaurants/[id]/waiters/[userId]  — remove waiter
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session || !isSuperAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, userId } = await params;

  const waiter = await prisma.user.findFirst({
    where: { id: userId, staffRestaurantId: id, role: "WAITER" },
  });
  if (!waiter) return NextResponse.json({ error: "Waiter not found" }, { status: 404 });

  // Also remove their push subscriptions
  await (prisma as any).$executeRawUnsafe(
    `DELETE FROM "WaiterPushSub" WHERE "userId" = ?`,
    userId
  );
  await prisma.user.delete({ where: { id: userId } });

  return NextResponse.json({ success: true });
}
