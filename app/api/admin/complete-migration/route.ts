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

    console.log("[COMPLETE-MIGRATION] Starting migration...");

    // Step 1: Try to apply schema fix (remove unique constraint)
    console.log("[COMPLETE-MIGRATION] Applying schema fix...");
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE "Restaurant_new" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "name" TEXT NOT NULL,
          "slug" TEXT NOT NULL UNIQUE,
          "description" TEXT,
          "logo" TEXT,
          "coverImage" TEXT,
          "address" TEXT,
          "phone" TEXT,
          "email" TEXT,
          "website" TEXT,
          "cuisine" TEXT NOT NULL DEFAULT '[]',
          "status" TEXT NOT NULL DEFAULT 'PENDING',
          "templateId" TEXT NOT NULL DEFAULT 'modern',
          "primaryColor" TEXT NOT NULL DEFAULT '#f97316',
          "menuPdfUrl" TEXT,
          "menuPdfName" TEXT,
          "primaryMenu" TEXT NOT NULL DEFAULT 'dynamic',
          "openingHours" TEXT NOT NULL DEFAULT '{}',
          "announcement" TEXT,
          "socialLinks" TEXT NOT NULL DEFAULT '{}',
          "wifiPassword" TEXT,
          "bookingUrl" TEXT,
          "currency" TEXT NOT NULL DEFAULT '€',
          "promotions" TEXT NOT NULL DEFAULT '[]',
          "customTags" TEXT NOT NULL DEFAULT '[]',
          "themeConfig" TEXT NOT NULL DEFAULT '{}',
          "metaTitle" TEXT,
          "metaDescription" TEXT,
          "googleAnalyticsId" TEXT,
          "googlePlaceId" TEXT,
          "loyaltyEnabled" BOOLEAN NOT NULL DEFAULT 0,
          "loyaltyStamps" INTEGER NOT NULL DEFAULT 10,
          "loyaltyReward" TEXT NOT NULL DEFAULT 'Free item',
          "tableMap" TEXT NOT NULL DEFAULT '[]',
          "sections" TEXT NOT NULL DEFAULT '[]',
          "flashSales" TEXT NOT NULL DEFAULT '[]',
          "planTier" TEXT NOT NULL DEFAULT 'free',
          "isVerified" BOOLEAN NOT NULL DEFAULT 0,
          "healthScore" INTEGER,
          "notes" TEXT,
          "ownerId" TEXT NOT NULL,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL,
          CONSTRAINT "Restaurant_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE
        )
      `);

      await prisma.$executeRawUnsafe(
        `INSERT INTO "Restaurant_new" SELECT * FROM "Restaurant"`
      );

      await prisma.$executeRawUnsafe(`DROP TABLE "Restaurant"`);

      await prisma.$executeRawUnsafe(
        `ALTER TABLE "Restaurant_new" RENAME TO "Restaurant"`
      );
      console.log("[COMPLETE-MIGRATION] Schema fix applied");
    } catch (schemaError: any) {
      console.log("[COMPLETE-MIGRATION] Schema already fixed or already migrated");
    }

    // Step 2: Add missing restaurants
    console.log("[COMPLETE-MIGRATION] Adding missing restaurants...");

    // Get all existing restaurants to identify owner UUIDs
    const existingRestaurants = await prisma.restaurant.findMany({
      select: { ownerId: true, name: true },
    });

    // Build map of owner patterns to UUIDs
    const ownerPatterns: Record<number, { pattern: string; uuid?: string }> = {
      80: { pattern: "Hotel" },
      398: { pattern: "Furra|Embelsirat|Pije|Buket|Food|Desserts|Drinks|Breads" },
      114: { pattern: "La Carte" },
      252: { pattern: "Galaxy" },
    };

    // Find owner UUIDs by matching existing restaurant names
    for (const [oldId, info] of Object.entries(ownerPatterns)) {
      const regex = new RegExp(info.pattern, "i");
      const matching = existingRestaurants.find((r) => regex.test(r.name));
      if (matching) {
        ownerPatterns[parseInt(oldId)].uuid = matching.ownerId;
      }
    }

    const userMap: Record<number, string> = {};
    for (const [oldId, info] of Object.entries(ownerPatterns)) {
      if (info.uuid) {
        userMap[parseInt(oldId)] = info.uuid;
      }
    }

    console.log(`[COMPLETE-MIGRATION] Found ${Object.keys(userMap).length} owner UUIDs`);

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
          `[COMPLETE-MIGRATION] Skipping menu ${restaurant.menuId} (${restaurant.title}) - already exists`
        );
        skipped++;
        continue;
      }

      // Get the owner's UUID from the map
      const ownerUuid = userMap[restaurant.ownerId];

      if (!ownerUuid) {
        console.log(
          `[COMPLETE-MIGRATION] Skipping menu ${restaurant.menuId} (${restaurant.title}) - owner ${restaurant.ownerId} not found in map`
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
        `[COMPLETE-MIGRATION] Created menu ${restaurant.menuId} (${restaurant.title})`
      );
      created++;
    }

    console.log(
      `[COMPLETE-MIGRATION] Complete: ${created} created, ${skipped} skipped`
    );

    return NextResponse.json({
      success: true,
      message: "Migration completed successfully",
      schemaFixed: true,
      restaurantsAdded: {
        created,
        skipped,
      },
    });
  } catch (error: any) {
    console.error("[COMPLETE-MIGRATION] Failed:", error);
    return NextResponse.json(
      {
        error: error.message || "Migration failed",
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}
