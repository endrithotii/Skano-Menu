import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("x-init-token");
    if (process.env.INIT_TOKEN && token !== process.env.INIT_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[INIT-DATABASE] Starting database initialization...");

    // 1. Create User table if it doesn't exist
    const userTableExists = await prisma.$queryRawUnsafe<any[]>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='User'`
    );

    console.log(`[INIT-DATABASE] User table exists: ${userTableExists.length > 0}`);

    if (userTableExists.length === 0) {
      console.log("[INIT-DATABASE] Creating User table...");

      await prisma.$executeRawUnsafe(`
        CREATE TABLE "User" (
          "id" text NOT NULL PRIMARY KEY,
          "email" text NOT NULL UNIQUE,
          "password" text NOT NULL,
          "name" text NOT NULL,
          "role" text NOT NULL DEFAULT 'MANAGER',
          "staffRestaurantId" text,
          "assignedTables" text NOT NULL DEFAULT '[]',
          "createdAt" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY ("staffRestaurantId") REFERENCES "Restaurant" ("id") ON DELETE SET NULL
        )
      `);

      console.log("[INIT-DATABASE] User table created successfully");
      await prisma.$executeRawUnsafe(`CREATE INDEX "User_email_key" ON "User"("email")`);
      await prisma.$executeRawUnsafe(`CREATE INDEX "User_staffRestaurantId_idx" ON "User"("staffRestaurantId")`);
    }

    // 2. Check if Restaurant table exists
    const tableExists = await prisma.$queryRawUnsafe<any[]>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='Restaurant'`
    );

    console.log(`[INIT-DATABASE] Restaurant table exists: ${tableExists.length > 0}`);

    if (tableExists.length === 0) {
      console.log("[INIT-DATABASE] Creating Restaurant table from Prisma schema...");

      // Use prisma to generate the schema
      await prisma.$executeRawUnsafe(`
        CREATE TABLE "Restaurant" (
          "id" text NOT NULL PRIMARY KEY,
          "name" text NOT NULL,
          "slug" text NOT NULL UNIQUE,
          "description" text,
          "logo" text,
          "coverImage" text,
          "address" text,
          "phone" text,
          "email" text,
          "website" text,
          "cuisine" text NOT NULL DEFAULT '[]',
          "status" text NOT NULL DEFAULT 'PENDING',
          "templateId" text NOT NULL DEFAULT 'modern',
          "primaryColor" text NOT NULL DEFAULT '#f97316',
          "menuPdfUrl" text,
          "menuPdfName" text,
          "primaryMenu" text NOT NULL DEFAULT 'dynamic',
          "openingHours" text NOT NULL DEFAULT '{}',
          "announcement" text,
          "socialLinks" text NOT NULL DEFAULT '{}',
          "wifiPassword" text,
          "bookingUrl" text,
          "currency" text NOT NULL DEFAULT '€',
          "promotions" text NOT NULL DEFAULT '[]',
          "customTags" text NOT NULL DEFAULT '[]',
          "themeConfig" text NOT NULL DEFAULT '{}',
          "metaTitle" text,
          "metaDescription" text,
          "googleAnalyticsId" text,
          "googlePlaceId" text,
          "loyaltyEnabled" integer NOT NULL DEFAULT 0,
          "loyaltyStamps" integer NOT NULL DEFAULT 10,
          "loyaltyReward" text NOT NULL DEFAULT 'Free item',
          "tableMap" text NOT NULL DEFAULT '[]',
          "sections" text NOT NULL DEFAULT '[]',
          "flashSales" text NOT NULL DEFAULT '[]',
          "planTier" text NOT NULL DEFAULT 'free',
          "isVerified" integer NOT NULL DEFAULT 0,
          "healthScore" integer,
          "notes" text,
          "ownerId" text NOT NULL,
          "createdAt" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE
        )
      `);

      console.log("[INIT-DATABASE] Restaurant table created successfully");

      // Create indexes
      await prisma.$executeRawUnsafe(`CREATE INDEX "Restaurant_slug_key" ON "Restaurant"("slug")`);
      await prisma.$executeRawUnsafe(`CREATE INDEX "Restaurant_ownerId_idx" ON "Restaurant"("ownerId")`);
      await prisma.$executeRawUnsafe(`CREATE INDEX "Restaurant_status_idx" ON "Restaurant"("status")`);
      console.log("[INIT-DATABASE] Indexes created");
    } else {
      console.log("[INIT-DATABASE] Restaurant table exists, checking schema...");

      // Check the actual columns
      const columns = await prisma.$queryRawUnsafe<any[]>(
        `PRAGMA table_info("Restaurant")`
      );

      console.log(`[INIT-DATABASE] Found ${columns.length} columns`);
      console.log("[INIT-DATABASE] Columns:", columns.map(c => c.name).join(", "));

      // Check if ownerId has a unique constraint (this would be the old schema)
      const uniqueConstraints = await prisma.$queryRawUnsafe<any[]>(
        `PRAGMA index_list("Restaurant")`
      );

      const hasUniqueOwnerId = uniqueConstraints.some(idx => idx.unique && idx.name?.includes("ownerId"));

      if (hasUniqueOwnerId) {
        console.log("[INIT-DATABASE] Found unique constraint on ownerId, removing it...");

        // Recreate table without unique constraint
        const createTableSQL = `CREATE TABLE "Restaurant_new" (
          "id" text NOT NULL PRIMARY KEY,
          "name" text NOT NULL,
          "slug" text NOT NULL UNIQUE,
          "description" text,
          "logo" text,
          "coverImage" text,
          "address" text,
          "phone" text,
          "email" text,
          "website" text,
          "cuisine" text NOT NULL DEFAULT '[]',
          "status" text NOT NULL DEFAULT 'PENDING',
          "templateId" text NOT NULL DEFAULT 'modern',
          "primaryColor" text NOT NULL DEFAULT '#f97316',
          "menuPdfUrl" text,
          "menuPdfName" text,
          "primaryMenu" text NOT NULL DEFAULT 'dynamic',
          "openingHours" text NOT NULL DEFAULT '{}',
          "announcement" text,
          "socialLinks" text NOT NULL DEFAULT '{}',
          "wifiPassword" text,
          "bookingUrl" text,
          "currency" text NOT NULL DEFAULT '€',
          "promotions" text NOT NULL DEFAULT '[]',
          "customTags" text NOT NULL DEFAULT '[]',
          "themeConfig" text NOT NULL DEFAULT '{}',
          "metaTitle" text,
          "metaDescription" text,
          "googleAnalyticsId" text,
          "googlePlaceId" text,
          "loyaltyEnabled" integer NOT NULL DEFAULT 0,
          "loyaltyStamps" integer NOT NULL DEFAULT 10,
          "loyaltyReward" text NOT NULL DEFAULT 'Free item',
          "tableMap" text NOT NULL DEFAULT '[]',
          "sections" text NOT NULL DEFAULT '[]',
          "flashSales" text NOT NULL DEFAULT '[]',
          "planTier" text NOT NULL DEFAULT 'free',
          "isVerified" integer NOT NULL DEFAULT 0,
          "healthScore" integer,
          "notes" text,
          "ownerId" text NOT NULL,
          "createdAt" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE
        )`;

        await prisma.$executeRawUnsafe(createTableSQL);

        const columnNames = columns.map(col => `"${col.name}"`).join(', ');
        await prisma.$executeRawUnsafe(
          `INSERT INTO "Restaurant_new" (${columnNames}) SELECT ${columnNames} FROM "Restaurant"`
        );

        await prisma.$executeRawUnsafe(`DROP TABLE "Restaurant"`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "Restaurant_new" RENAME TO "Restaurant"`);

        console.log("[INIT-DATABASE] Schema migration completed");
      } else {
        console.log("[INIT-DATABASE] Table schema looks correct");
      }
    }

    // 4. Verify the tables are now accessible
    const finalRestaurantCount = await prisma.restaurant.count().catch((err: any) => {
      console.error("[INIT-DATABASE] Could not count restaurants after init:", err);
      return -1;
    });

    const finalUserCount = await prisma.user.count().catch((err: any) => {
      console.error("[INIT-DATABASE] Could not count users after init:", err);
      return -1;
    });

    console.log(`[INIT-DATABASE] Final counts: ${finalUserCount} users, ${finalRestaurantCount} restaurants`);

    return NextResponse.json({
      success: true,
      message: "Database initialization completed",
      userCount: finalUserCount,
      restaurantCount: finalRestaurantCount,
    });
  } catch (error: any) {
    console.error("[INIT-DATABASE] Failed:", error);

    return NextResponse.json(
      {
        error: error.message || "Initialization failed",
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}
