import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { parseJsonField, generateSlug } from "@/lib/utils";
import bcrypt from "bcryptjs";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        restaurant: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            cuisine: true,
            createdAt: true,
          },
        },
      },
    });

    type UserWithRestaurant = (typeof users)[number];
    const result = users.map((u: UserWithRestaurant) => ({
      ...u,
      restaurant: u.restaurant
        ? {
            ...u.restaurant,
            cuisine: parseJsonField<string[]>(u.restaurant.cuisine, []),
          }
        : null,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("[GET /api/admin/users]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/admin/users — super-admin creates a new MANAGER account (+ restaurant)
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { name, email, password, restaurantName } = await req.json() as {
      name: string; email: string; password: string; restaurantName: string;
    };

    if (!name?.trim() || !email?.trim() || !password?.trim() || !restaurantName?.trim()) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (existing) return NextResponse.json({ error: "Email already in use" }, { status: 409 });

    const slug = generateSlug(restaurantName.trim());
    const hashed = await bcrypt.hash(password.trim(), 10);

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: hashed,
        role: "MANAGER",
        restaurant: {
          create: {
            name: restaurantName.trim(),
            slug,
            status: "ACTIVE",
          },
        },
      },
      select: {
        id: true, name: true, email: true, role: true, createdAt: true,
        restaurant: { select: { id: true, name: true, slug: true, status: true } },
      },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/admin/users]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/admin/users/[id] is handled in a separate route file
// PATCH /api/admin/users  — update a user's role or delete
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { userId } = await req.json() as { userId: string };
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

    // Prevent self-deletion
    if (userId === session.id) {
      return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
    }

    await prisma.user.delete({ where: { id: userId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/admin/users]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
