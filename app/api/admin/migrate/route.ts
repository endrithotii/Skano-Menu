import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

// One-time migration endpoint — adds new columns for Phase 2 features.
// Protected: only SUPER_ADMIN can call this.
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  return NextResponse.json({ results });
}
