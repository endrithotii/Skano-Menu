import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest, sessionCookieOptions, signToken } from "@/lib/auth";
import { prisma } from "@/lib/db";

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
