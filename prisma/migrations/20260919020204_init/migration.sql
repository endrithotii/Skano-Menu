-- AlterTable
ALTER TABLE "MenuCategory" ADD COLUMN "schedule" TEXT;

-- CreateTable
CREATE TABLE "MenuSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurantId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "FlashSale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "discountType" TEXT NOT NULL DEFAULT 'percent',
    "discountValue" REAL NOT NULL,
    "itemIds" TEXT NOT NULL DEFAULT '[]',
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "LoyaltyCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurantId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "stamps" INTEGER NOT NULL DEFAULT 0,
    "totalStamps" INTEGER NOT NULL DEFAULT 10,
    "rewardLabel" TEXT NOT NULL DEFAULT 'Free item',
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "FeedbackReply" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "feedbackId" TEXT NOT NULL,
    "reply" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "restaurantId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "detail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "OperatingException" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurantId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "closed" BOOLEAN NOT NULL DEFAULT true,
    "openTime" TEXT,
    "closeTime" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RestaurantManager" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'manager',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RestaurantManager_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WaiterCall" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurantId" TEXT NOT NULL,
    "tableNumber" TEXT,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WaiterCall_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SearchTerm" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurantId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "lastSearchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SearchTerm_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WaiterPushSub" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MenuItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" REAL NOT NULL,
    "image" TEXT,
    "images" TEXT NOT NULL DEFAULT '[]',
    "allergens" TEXT NOT NULL DEFAULT '[]',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "prepTime" INTEGER,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "spiceLevel" INTEGER,
    "calories" INTEGER,
    "protein" REAL,
    "carbs" REAL,
    "fat" REAL,
    "costPrice" REAL,
    "chefNote" TEXT,
    "variants" TEXT NOT NULL DEFAULT '[]',
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "categoryId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MenuItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MenuCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MenuItem" ("allergens", "categoryId", "createdAt", "description", "id", "image", "isAvailable", "isFeatured", "name", "order", "price", "tags", "updatedAt") SELECT "allergens", "categoryId", "createdAt", "description", "id", "image", "isAvailable", "isFeatured", "name", "order", "price", "tags", "updatedAt" FROM "MenuItem";
DROP TABLE "MenuItem";
ALTER TABLE "new_MenuItem" RENAME TO "MenuItem";
CREATE TABLE "new_Restaurant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
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
    "loyaltyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "loyaltyStamps" INTEGER NOT NULL DEFAULT 10,
    "loyaltyReward" TEXT NOT NULL DEFAULT 'Free item',
    "tableMap" TEXT NOT NULL DEFAULT '[]',
    "sections" TEXT NOT NULL DEFAULT '[]',
    "flashSales" TEXT NOT NULL DEFAULT '[]',
    "planTier" TEXT NOT NULL DEFAULT 'free',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "healthScore" INTEGER,
    "notes" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Restaurant_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Restaurant" ("address", "coverImage", "createdAt", "cuisine", "description", "email", "id", "logo", "name", "ownerId", "phone", "primaryColor", "slug", "status", "templateId", "updatedAt", "website") SELECT "address", "coverImage", "createdAt", "cuisine", "description", "email", "id", "logo", "name", "ownerId", "phone", "primaryColor", "slug", "status", "templateId", "updatedAt", "website" FROM "Restaurant";
DROP TABLE "Restaurant";
ALTER TABLE "new_Restaurant" RENAME TO "Restaurant";
CREATE UNIQUE INDEX "Restaurant_slug_key" ON "Restaurant"("slug");
CREATE UNIQUE INDEX "Restaurant_ownerId_key" ON "Restaurant"("ownerId");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MANAGER',
    "staffRestaurantId" TEXT,
    "assignedTables" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_staffRestaurantId_fkey" FOREIGN KEY ("staffRestaurantId") REFERENCES "Restaurant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_User" ("createdAt", "email", "id", "name", "password", "role", "updatedAt") SELECT "createdAt", "email", "id", "name", "password", "role", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyCard_restaurantId_deviceId_key" ON "LoyaltyCard"("restaurantId", "deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "FeedbackReply_feedbackId_key" ON "FeedbackReply"("feedbackId");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantManager_userId_restaurantId_key" ON "RestaurantManager"("userId", "restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "SearchTerm_restaurantId_term_key" ON "SearchTerm"("restaurantId", "term");

-- CreateIndex
CREATE UNIQUE INDEX "WaiterPushSub_endpoint_key" ON "WaiterPushSub"("endpoint");
