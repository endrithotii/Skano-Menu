import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import bcrypt from "bcryptjs";

type Params = { params: Promise<{ id: string }> };

function isSuperAdmin(session: Awaited<ReturnType<typeof getSessionFromRequest>>) {
  return session?.role === "SUPER_ADMIN";
}

// GET /api/admin/restaurants/[id]/waiters  — list all waiters for this restaurant
export async function GET(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session || !isSuperAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const staff: Array<{
    id: string; name: string; email: string;
    assignedTables: string; createdAt: Date;
  }> = await (prisma as any).$queryRawUnsafe(
    `SELECT id, name, email, assignedTables, createdAt
     FROM "User"
     WHERE staffRestaurantId = ? AND role = 'WAITER'
     ORDER BY createdAt ASC`,
    restaurant.id
  );

  return NextResponse.json({
    restaurant: { id: restaurant.id, name: restaurant.name },
    staff: staff.map((w) => ({
      ...w,
      assignedTables: (() => {
        try { return JSON.parse(w.assignedTables || "[]"); }
        catch { return []; }
      })(),
    })),
  });
}

// POST /api/admin/restaurants/[id]/waiters  — create a new waiter
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session || !isSuperAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { name, email, password, assignedTables } = await req.json() as {
    name: string; email: string; password: string; assignedTables?: string[];
  };

  if (!name?.trim() || !email?.trim() || !password?.trim()) {
    return NextResponse.json({ error: "Name, email and password required" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (existing) return NextResponse.json({ error: "Email already in use" }, { status: 409 });

  const tables = Array.isArray(assignedTables)
    ? assignedTables.map((t) => t.toString().trim()).filter(Boolean)
    : [];

  const hashed = await bcrypt.hash(password, 10);
  const waiter = await prisma.user.create({
    data: {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: hashed,
      role: "WAITER",
      staffRestaurantId: restaurant.id,
      assignedTables: JSON.stringify(tables),
    } as Parameters<typeof prisma.user.create>[0]["data"],
    select: { id: true, name: true, email: true, createdAt: true },
  });

  return NextResponse.json({ waiter: { ...waiter, assignedTables: tables } }, { status: 201 });
}
