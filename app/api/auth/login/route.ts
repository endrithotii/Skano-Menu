import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { sessionCookieOptions, signToken } from "@/lib/auth";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const { email, password, remember: rememberRaw } = await req.json();
    // "Keep me signed in" is on unless the user unticked it
    const remember = rememberRaw !== false;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      // include staffRestaurantId for WAITER role redirect
    });
    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // For waiters: use their staffRestaurantId; for owners: use their first owned restaurant
    let restaurantId: string | undefined;
    if (user.role === "WAITER") {
      restaurantId = (user as any).staffRestaurantId ?? undefined;
    } else {
      const restaurant = await prisma.restaurant.findFirst({ where: { ownerId: user.id } });
      restaurantId = restaurant?.id;
    }

    const token = await signToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      restaurantId,
      remember,
    });

    const cookieStore = await cookies();
    cookieStore.set("token", token, sessionCookieOptions(remember));

    // Routing: WAITER → /waiter, SUPER_ADMIN → /admin, MANAGER (& legacy RESTAURANT_OWNER) → /dashboard
    const redirect = user.role === "WAITER" ? "/waiter"
      : user.role === "SUPER_ADMIN" ? "/admin"
      : "/dashboard";

    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      restaurantId,
      redirect,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
