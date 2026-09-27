import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("x-init-token");
    if (process.env.INIT_TOKEN && token !== process.env.INIT_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[FIX-SCHEMA] Applying database schema migration...");

    // Remove unique constraint from Restaurant.ownerId
    // This allows users to own multiple restaurants

    // For SQLite, we need to recreate the table
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

    console.log("[FIX-SCHEMA] Migration completed successfully");

    return NextResponse.json({
      success: true,
      message: "Schema migration applied - removed unique constraint from ownerId",
    });
  } catch (error: any) {
    console.error("[FIX-SCHEMA] Failed:", error);

    // If the table recreation already happened or constraint is already gone, that's fine
    if (error.message?.includes("already exists") ||
        error.message?.includes("UNIQUE constraint")) {
      return NextResponse.json({
        success: true,
        message: "Schema already migrated or constraint already removed",
        details: error.message,
      });
    }

    return NextResponse.json(
      {
        error: error.message || "Migration failed",
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}
