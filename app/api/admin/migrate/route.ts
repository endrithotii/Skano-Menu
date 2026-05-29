import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

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

  return NextResponse.json({ results });
}
