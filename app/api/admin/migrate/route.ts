import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import bcrypt from "bcryptjs";

// One-time migration endpoint — adds new columns for Phase 2 features.
// Protected: SUPER_ADMIN session OR the MIGRATE_SECRET env var header.
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-migrate-secret");
  const expectedSecret = process.env.MIGRATE_SECRET;

  if (secret && expectedSecret && secret === expectedSecret) {
    // Secret-key bypass — valid
  } else {
    const session = await getSessionFromRequest(req);
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const results: string[] = [];

  async function run(label: string, sql: string) {
    try {
      await prisma.$executeRawUnsafe(sql);
      results.push(`✅ ${label}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("duplicate column") || msg.includes("already exists")) {
        results.push(`⏭️  ${label} (already exists)`);
      } else {
        results.push(`❌ ${label}: ${msg}`);
      }
    }
  }

  // MenuCategory: add schedule column
  await run(
    "MenuCategory.schedule",
    `ALTER TABLE "MenuCategory" ADD COLUMN "schedule" TEXT`
  );

  // Restaurant: add promotions column
  await run(
    "Restaurant.promotions",
    `ALTER TABLE "Restaurant" ADD COLUMN "promotions" TEXT NOT NULL DEFAULT '[]'`
  );

  // WaiterCall table
  await run(
    "WaiterCall table",
    `CREATE TABLE IF NOT EXISTS "WaiterCall" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "restaurantId" TEXT NOT NULL,
      "tableNumber" TEXT,
      "message" TEXT,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "WaiterCall_restaurantId_fkey"
        FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    )`
  );

  // User: add staffRestaurantId for WAITER role
  await run(
    "User.staffRestaurantId",
    `ALTER TABLE "User" ADD COLUMN "staffRestaurantId" TEXT REFERENCES "Restaurant"("id") ON DELETE CASCADE`
  );

  // SearchTerm table for search analytics
  await run(
    "SearchTerm table",
    `CREATE TABLE IF NOT EXISTS "SearchTerm" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "restaurantId" TEXT NOT NULL,
      "term" TEXT NOT NULL,
      "count" INTEGER NOT NULL DEFAULT 1,
      "lastSearchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE("restaurantId", "term"),
      CONSTRAINT "SearchTerm_restaurantId_fkey"
        FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    )`
  );

  // WaiterPushSub table for Web Push subscriptions
  await run(
    "WaiterPushSub table",
    `CREATE TABLE IF NOT EXISTS "WaiterPushSub" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "restaurantId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "endpoint" TEXT NOT NULL UNIQUE,
      "p256dh" TEXT NOT NULL,
      "auth" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "WaiterPushSub_restaurantId_fkey"
        FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    )`
  );

  // Restaurant: add customTags column for manager's tag library
  await run(
    "Restaurant.customTags",
    `ALTER TABLE "Restaurant" ADD COLUMN "customTags" TEXT NOT NULL DEFAULT '[]'`
  );

  // Restaurant: add themeConfig column for full menu customization
  await run(
    "Restaurant.themeConfig",
    `ALTER TABLE "Restaurant" ADD COLUMN "themeConfig" TEXT NOT NULL DEFAULT '{}'`
  );

  // ── Wave 2: 200-feature expansion ────────────────────────────────────────────

  // MenuItem: new fields
  await run("MenuItem.images",      `ALTER TABLE "MenuItem" ADD COLUMN "images"     TEXT NOT NULL DEFAULT '[]'`);
  await run("MenuItem.isHidden",    `ALTER TABLE "MenuItem" ADD COLUMN "isHidden"   INTEGER NOT NULL DEFAULT 0`);
  await run("MenuItem.spiceLevel",  `ALTER TABLE "MenuItem" ADD COLUMN "spiceLevel" INTEGER`);
  await run("MenuItem.calories",    `ALTER TABLE "MenuItem" ADD COLUMN "calories"   INTEGER`);
  await run("MenuItem.protein",     `ALTER TABLE "MenuItem" ADD COLUMN "protein"    REAL`);
  await run("MenuItem.carbs",       `ALTER TABLE "MenuItem" ADD COLUMN "carbs"      REAL`);
  await run("MenuItem.fat",         `ALTER TABLE "MenuItem" ADD COLUMN "fat"        REAL`);
  await run("MenuItem.costPrice",   `ALTER TABLE "MenuItem" ADD COLUMN "costPrice"  REAL`);
  await run("MenuItem.chefNote",    `ALTER TABLE "MenuItem" ADD COLUMN "chefNote"   TEXT`);
  await run("MenuItem.variants",    `ALTER TABLE "MenuItem" ADD COLUMN "variants"   TEXT NOT NULL DEFAULT '[]'`);
  await run("MenuItem.viewCount",   `ALTER TABLE "MenuItem" ADD COLUMN "viewCount"  INTEGER NOT NULL DEFAULT 0`);

  // Restaurant: new fields
  await run("Restaurant.metaTitle",         `ALTER TABLE "Restaurant" ADD COLUMN "metaTitle"         TEXT`);
  await run("Restaurant.metaDescription",   `ALTER TABLE "Restaurant" ADD COLUMN "metaDescription"   TEXT`);
  await run("Restaurant.googleAnalyticsId", `ALTER TABLE "Restaurant" ADD COLUMN "googleAnalyticsId" TEXT`);
  await run("Restaurant.googlePlaceId",     `ALTER TABLE "Restaurant" ADD COLUMN "googlePlaceId"     TEXT`);
  await run("Restaurant.loyaltyEnabled",    `ALTER TABLE "Restaurant" ADD COLUMN "loyaltyEnabled"    INTEGER NOT NULL DEFAULT 0`);
  await run("Restaurant.loyaltyStamps",     `ALTER TABLE "Restaurant" ADD COLUMN "loyaltyStamps"     INTEGER NOT NULL DEFAULT 10`);
  await run("Restaurant.loyaltyReward",     `ALTER TABLE "Restaurant" ADD COLUMN "loyaltyReward"     TEXT NOT NULL DEFAULT 'Free item'`);
  await run("Restaurant.tableMap",          `ALTER TABLE "Restaurant" ADD COLUMN "tableMap"          TEXT NOT NULL DEFAULT '[]'`);
  await run("Restaurant.sections",          `ALTER TABLE "Restaurant" ADD COLUMN "sections"          TEXT NOT NULL DEFAULT '[]'`);
  await run("Restaurant.planTier",          `ALTER TABLE "Restaurant" ADD COLUMN "planTier"          TEXT NOT NULL DEFAULT 'free'`);
  await run("Restaurant.isVerified",        `ALTER TABLE "Restaurant" ADD COLUMN "isVerified"        INTEGER NOT NULL DEFAULT 0`);
  await run("Restaurant.healthScore",       `ALTER TABLE "Restaurant" ADD COLUMN "healthScore"       INTEGER`);
  await run("Restaurant.notes",             `ALTER TABLE "Restaurant" ADD COLUMN "notes"             TEXT`);

  // MenuSnapshot table
  await run("MenuSnapshot table", `CREATE TABLE IF NOT EXISTS "MenuSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurantId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);

  // FlashSale table
  await run("FlashSale table", `CREATE TABLE IF NOT EXISTS "FlashSale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "discountType" TEXT NOT NULL DEFAULT 'percent',
    "discountValue" REAL NOT NULL,
    "itemIds" TEXT NOT NULL DEFAULT '[]',
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "isActive" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FlashSale_restaurantId_fkey"
      FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE
  )`);

  // LoyaltyCard table
  await run("LoyaltyCard table", `CREATE TABLE IF NOT EXISTS "LoyaltyCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurantId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "stamps" INTEGER NOT NULL DEFAULT 0,
    "totalStamps" INTEGER NOT NULL DEFAULT 10,
    "rewardLabel" TEXT NOT NULL DEFAULT 'Free item',
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("restaurantId","deviceId"),
    CONSTRAINT "LoyaltyCard_restaurantId_fkey"
      FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE
  )`);

  // FeedbackReply table
  await run("FeedbackReply table", `CREATE TABLE IF NOT EXISTS "FeedbackReply" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "feedbackId" TEXT NOT NULL UNIQUE,
    "reply" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);

  // AuditLog table
  await run("AuditLog table", `CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "restaurantId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "detail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);

  // OperatingException table
  await run("OperatingException table", `CREATE TABLE IF NOT EXISTS "OperatingException" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurantId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "closed" INTEGER NOT NULL DEFAULT 1,
    "openTime" TEXT,
    "closeTime" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OperatingException_restaurantId_fkey"
      FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE
  )`);

  // RestaurantManager table (multi-location access)
  await run("RestaurantManager table", `CREATE TABLE IF NOT EXISTS "RestaurantManager" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'manager',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("userId","restaurantId"),
    CONSTRAINT "RestaurantManager_restaurantId_fkey"
      FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE
  )`);

  // Rename RESTAURANT_OWNER → MANAGER for all existing users
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "User" SET "role" = 'MANAGER' WHERE "role" = 'RESTAURANT_OWNER'`
    );
    results.push("✅ Renamed RESTAURANT_OWNER → MANAGER");
  } catch (e: unknown) {
    results.push(`❌ Rename role: ${e instanceof Error ? e.message : String(e)}`);
  }

  // User: add assignedTables column for table-specific notifications
  await run(
    "User.assignedTables",
    `ALTER TABLE "User" ADD COLUMN "assignedTables" TEXT NOT NULL DEFAULT '[]'`
  );

  // ── Seed demo waiter accounts for bella-vista-prishtina ──────────────────
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { slug: "bella-vista-prishtina" },
      select: { id: true },
    });
    if (restaurant) {
      const demoWaiters = [
        {
          id: "waiter_demo_1",
          email: "marco@bella-vista.ks",
          name: "Marco Rossi",
          assignedTables: JSON.stringify(["1","2","3","4","5"]),
          password: "waiter123",
        },
        {
          id: "waiter_demo_2",
          email: "elisa@bella-vista.ks",
          name: "Elisa Bianchi",
          assignedTables: JSON.stringify(["6","7","8","9","10"]),
          password: "waiter123",
        },
        {
          id: "waiter_demo_3",
          email: "ardit@bella-vista.ks",
          name: "Ardit Berisha",
          assignedTables: JSON.stringify([]),
          password: "waiter123",
        },
      ];
      let seeded = 0;
      for (const w of demoWaiters) {
        const existing = await prisma.user.findUnique({ where: { email: w.email } });
        if (!existing) {
          const hashed = await bcrypt.hash(w.password, 10);
          await prisma.user.create({
            data: {
              id: w.id,
              email: w.email,
              name: w.name,
              password: hashed,
              role: "WAITER",
              staffRestaurantId: restaurant.id,
              assignedTables: w.assignedTables,
            } as Parameters<typeof prisma.user.create>[0]["data"],
          });
          seeded++;
        }
      }
      results.push(seeded > 0
        ? `✅ Seeded ${seeded} demo waiter(s) for Bella Vista`
        : `⏭️  Demo waiters already exist`
      );
    } else {
      results.push(`⏭️  bella-vista restaurant not found — skip waiter seed`);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    results.push(`❌ Seed demo waiters: ${msg}`);
  }

  return NextResponse.json({ results });
}
