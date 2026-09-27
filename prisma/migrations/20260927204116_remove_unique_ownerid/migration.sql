-- Remove the unique constraint from Restaurant.ownerId to allow multiple restaurants per owner
-- SQLite doesn't support dropping constraints, so we recreate the table without the constraint

-- Create new table with same schema but without the unique constraint on ownerId
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
);

-- Copy data from old table to new table
INSERT INTO "Restaurant_new" SELECT * FROM "Restaurant";

-- Drop old table
DROP TABLE "Restaurant";

-- Rename new table to original name
ALTER TABLE "Restaurant_new" RENAME TO "Restaurant";
