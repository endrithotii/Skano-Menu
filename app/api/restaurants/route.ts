import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { generateSlug, parseJsonField } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const cuisineFilter = searchParams.get("cuisine")?.trim() ?? "";

    const restaurants = await prisma.restaurant.findMany({
      where: {
        status: "ACTIVE",
        ...(search
          ? {
              OR: [
                { name: { contains: search } },
                { description: { contains: search } },
                { address: { contains: search } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        logo: true,
        coverImage: true,
        address: true,
        phone: true,
        email: true,
        website: true,
        cuisine: true,
        status: true,
        templateId: true,
        primaryColor: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    let results = restaurants.map((r) => {
      const cuisineArr = parseJsonField<string[]>(r.cuisine, []);

      return {
        id: r.id,
        name: r.name,
        slug: r.slug,
        description: r.description,
        logo: r.logo,
        coverImage: r.coverImage,
        address: r.address,
        phone: r.phone,
        email: r.email,
        website: r.website,
        cuisine: cuisineArr,
        status: r.status,
        templateId: r.templateId,
        primaryColor: r.primaryColor,
        createdAt: r.createdAt,
      };
    });

    // cuisine filter is done in JS because cuisine is stored as JSON string
    if (cuisineFilter) {
      const lowerFilter = cuisineFilter.toLowerCase();
      results = results.filter((r: (typeof results)[number]) =>
        r.cuisine.some((c: string) => c.toLowerCase().includes(lowerFilter))
      );
    }

    return NextResponse.json({ restaurants: results });
  } catch (error) {
    console.error("[GET /api/restaurants]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.role !== "SUPER_ADMIN" && session.role !== "RESTAURANT_OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const {
      name,
      description,
      address,
      phone,
      email,
      website,
      cuisine,
      templateId,
      primaryColor,
      ownerId,
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Restaurant name is required" },
        { status: 400 }
      );
    }

    // RESTAURANT_OWNER can only create one restaurant for themselves
    let resolvedOwnerId = ownerId;
    if (session.role === "RESTAURANT_OWNER") {
      resolvedOwnerId = session.id;
      const existing = await prisma.restaurant.findFirst({
        where: { ownerId: session.id },
      });
      if (existing) {
        return NextResponse.json(
          { error: "You already have a restaurant" },
          { status: 409 }
        );
      }
    } else {
      // SUPER_ADMIN must supply ownerId
      if (!resolvedOwnerId) {
        return NextResponse.json(
          { error: "ownerId is required" },
          { status: 400 }
        );
      }
    }

    const slug = generateSlug(name);

    const restaurant = await prisma.restaurant.create({
      data: {
        name,
        slug,
        description: description ?? null,
        address: address ?? null,
        phone: phone ?? null,
        email: email ?? null,
        website: website ?? null,
        cuisine: JSON.stringify(Array.isArray(cuisine) ? cuisine : []),
        templateId: templateId ?? "modern",
        primaryColor: primaryColor ?? "#f97316",
        status: session.role === "SUPER_ADMIN" ? "ACTIVE" : "PENDING",
        ownerId: resolvedOwnerId,
      },
    });

    return NextResponse.json({ restaurant }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/restaurants]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
