import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// The 22 missing restaurants with their data
const MISSING_RESTAURANTS = [
  { menuId: 123, title: "Menu A LA CARTE  - ENG", ownerId: 80, active: false },
  { menuId: 145, title: "Shqip - Menu Mengjesi nga Hoteli", ownerId: 80, active: false },
  { menuId: 146, title: "English - Hotel Breakfast Menu", ownerId: 80, active: false },
  { menuId: 147, title: "Business Lunch Menu - AL", ownerId: 80, active: false },
  { menuId: 155, title: "Business Lunch Menu - EN", ownerId: 80, active: false },
  { menuId: 189, title: "MENU GJITHEPERFSHIRESE", ownerId: 80, active: false },
  { menuId: 229, title: "Menu e pijeve", ownerId: 80, active: false },
  { menuId: 292, title: "Restaurant Galaxy - Menu Digjitale", ownerId: 252, active: true },
  { menuId: 322, title: "A La Carte - Menu - English", ownerId: 114, active: false },
  { menuId: 328, title: "Shqip - Menu e Pijeve", ownerId: 114, active: false },
  { menuId: 345, title: "Embelsirat - Shqip", ownerId: 398, active: false },
  { menuId: 346, title: "Pije - Shqip", ownerId: 398, active: false },
  { menuId: 347, title: "Buket - Shqip", ownerId: 398, active: false },
  { menuId: 348, title: "Food - English", ownerId: 398, active: false },
  { menuId: 349, title: "Desserts - English", ownerId: 398, active: false },
  { menuId: 350, title: "Drinks - English", ownerId: 398, active: false },
  { menuId: 351, title: "Breads - English", ownerId: 398, active: false },
  { menuId: 352, title: "A La Carte- Shqip", ownerId: 80, active: false },
  { menuId: 353, title: "A La Carte February Shqip", ownerId: 80, active: false },
  { menuId: 362, title: "Verat Menu", ownerId: 80, active: false },
  { menuId: 363, title: "Menu e mengjesit - GOK", ownerId: 80, active: false },
  { menuId: 365, title: "Breakfast Menu - GOK", ownerId: 80, active: false },
];

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("x-init-token");
    if (process.env.INIT_TOKEN && token !== process.env.INIT_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[ADD-MISSING] Starting to add missing restaurants...");

    // Build map of user IDs to UUIDs for the owners
    const users = await prisma.user.findMany({
      where: {
        id: {
          in: [80, 114, 252, 398].map(String),
        },
      },
      select: { id: true },
    });

    const userMap: Record<string, string> = {};
    users.forEach((user) => {
      userMap[user.id] = user.id;
    });

    console.log(`[ADD-MISSING] Found ${users.length} users`);

    let created = 0;
    let skipped = 0;

    for (const restaurant of MISSING_RESTAURANTS) {
      const slug = restaurant.title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");

      // Check if already exists
      const existing = await prisma.restaurant.findUnique({
        where: { slug },
      });

      if (existing) {
        console.log(
          `[ADD-MISSING] Skipping menu ${restaurant.menuId} (${restaurant.title}) - already exists`
        );
        skipped++;
        continue;
      }

      // Get the owner's UUID from the map
      const ownerUuid = userMap[String(restaurant.ownerId)];

      if (!ownerUuid) {
        console.log(
          `[ADD-MISSING] Skipping menu ${restaurant.menuId} (${restaurant.title}) - owner ${restaurant.ownerId} not found`
        );
        skipped++;
        continue;
      }

      // Create the restaurant
      await prisma.restaurant.create({
        data: {
          name: restaurant.title,
          slug,
          description: restaurant.title,
          status: restaurant.active ? "ACTIVE" : "PENDING",
          ownerId: ownerUuid,
          email: "info@skano.menu",
          cuisine: JSON.stringify([]),
          logo: "",
          coverImage: "",
          address: "Address not specified",
          phone: "Not specified",
          website: "",
        },
      });

      console.log(
        `[ADD-MISSING] Created menu ${restaurant.menuId} (${restaurant.title})`
      );
      created++;
    }

    console.log(
      `[ADD-MISSING] Complete: ${created} created, ${skipped} skipped`
    );

    return NextResponse.json({
      success: true,
      message: "Missing restaurants added",
      created,
      skipped,
    });
  } catch (error: any) {
    console.error("[ADD-MISSING] Failed:", error);
    return NextResponse.json(
      {
        error: error.message || "Failed to add missing restaurants",
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}
