import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest, sessionCookieOptions, signToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { logAction } from "@/lib/action-log";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        restaurants: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            logo: true,
            primaryColor: true,
            templateId: true,
          },
          take: 1,
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const primaryRestaurant = user.restaurants[0] ?? null;

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
        restaurantId: primaryRestaurant?.id ?? null,
        restaurant: primaryRestaurant,
      },
    });

    // Keep active users signed in: renew the login once it's more than an hour old
    // (a "remember me" login then lasts 30 days from the last visit, a short one 12 hours)
    const ageSeconds = Math.floor(Date.now() / 1000) - (session.iat ?? 0);
    if (ageSeconds > 60 * 60) {
      const token = await signToken({
        id: user.id, email: user.email, name: user.name, role: user.role,
        restaurantId: session.restaurantId, remember: session.remember !== false,
      });
      response.cookies.set("token", token, sessionCookieOptions(session.remember !== false));
    }
    return response;
  } catch (error) {
    console.error("[GET /api/auth/me]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Change your own account: name, email, password. Email and password need the current password.
// PATCH { name?, email?, newPassword?, currentPassword? } -> { user }
export async function PATCH(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const user: { id: string; email: string; name: string; role: string; password: string; staffRestaurantId: string | null } | null =
      await prisma.user.findUnique({ where: { id: session.id }, select: { id: true, email: true, name: true, role: true, password: true, staffRestaurantId: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const name = typeof b.name === "string" ? b.name.replace(/\s+/g, " ").trim().slice(0, 80) : user.name;
    const email = typeof b.email === "string" ? b.email.trim().slice(0, 120) : user.email;
    const newPassword = typeof b.newPassword === "string" ? b.newPassword : "";
    if (!name) return NextResponse.json({ error: "Write your name" }, { status: 400 });
    if (email !== user.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "This email doesn't look right" }, { status: 400 });
    if (newPassword && newPassword.length < 8) return NextResponse.json({ error: "The new password needs at least 8 characters" }, { status: 400 });
    if (newPassword && newPassword.length > 200) return NextResponse.json({ error: "The new password is too long" }, { status: 400 });

    const emailChanged = email.toLowerCase() !== user.email.toLowerCase() || email !== user.email;
    if (emailChanged || newPassword) {
      const ok = typeof b.currentPassword === "string" && b.currentPassword && await bcrypt.compare(b.currentPassword, user.password);
      if (!ok) return NextResponse.json({ error: "Your current password is not right", field: "currentPassword" }, { status: 403 });
    }
    if (emailChanged) {
      const taken = await prisma.user.findFirst({ where: { email, NOT: { id: user.id } }, select: { id: true } });
      if (taken) return NextResponse.json({ error: "Another account already uses this email", field: "email" }, { status: 409 });
    }
    if (name === user.name && !emailChanged && !newPassword) return NextResponse.json({ user: { name, email, role: user.role } });

    await prisma.user.update({ where: { id: user.id }, data: { name, email, ...(newPassword ? { password: await bcrypt.hash(newPassword, 10) } : {}) } });

    // Action history of the restaurant
    const lines = [name !== user.name ? `Name: ${user.name} → ${name}` : "", emailChanged ? `Email: ${user.email} → ${email}` : "", newPassword ? "Changed the password" : ""].filter(Boolean);
    const rid = session.restaurantId ?? user.staffRestaurantId;
    if (rid) {
      const r = await prisma.restaurant.findFirst({ where: { id: rid }, select: { id: true, ownerId: true } });
      if (r) await logAction({ id: user.id, role: user.role, name, email }, r, "auth.account", lines.length === 1 ? lines[0] : "Changed their account", lines.length > 1 ? lines : []).catch(() => {});
    }

    // The login keeps the new name and email
    const res = NextResponse.json({ user: { name, email, role: user.role } });
    const token = await signToken({ id: user.id, email, name, role: user.role, restaurantId: session.restaurantId, remember: session.remember !== false });
    res.cookies.set("token", token, sessionCookieOptions(session.remember !== false));
    return res;
  } catch (error) {
    console.error("[PATCH /api/auth/me]", error);
    return NextResponse.json({ error: "Could not save. Please try again." }, { status: 500 });
  }
}
