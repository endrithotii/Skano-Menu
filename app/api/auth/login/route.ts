import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { sessionCookieOptions, signToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { STAFF_ROLES } from "@/lib/staff-access";
import { logAction } from "@/lib/action-log";

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
    if (STAFF_ROLES.includes(user.role)) {
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

    // Action history: sign-ins of the owner and the staff of a restaurant
    if (restaurantId) {
      const r = await prisma.restaurant.findFirst({ where: { id: restaurantId }, select: { id: true, ownerId: true } });
      if (r) await logAction({ id: user.id, role: user.role, name: user.name, email: user.email }, r, "auth.login", "Signed in");
    }

    const cookieStore = await cookies();
    cookieStore.set("token", token, sessionCookieOptions(remember));

    // Routing: SUPER_ADMIN → /admin, MANAGER (& legacy RESTAURANT_OWNER) → /dashboard.
    // Staff (waiters, chefs, HR...) → Check in / out, so they can check in right away. Their other pages are in the sidebar.
    const redirect = user.role === "SUPER_ADMIN" ? "/admin" : STAFF_ROLES.includes(user.role) ? "/dashboard/check-in" : "/dashboard";

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
