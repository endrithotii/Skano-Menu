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
