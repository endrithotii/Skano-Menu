import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { generateSlug } from "@/lib/utils";
import bcrypt from "bcryptjs";

// GET — all restaurants this manager can access
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owned = await prisma.restaurant.findMany({
    where: { ownerId: session.id },
    select: { id: true, name: true, slug: true, status: true, templateId: true, primaryColor: true, logo: true, address: true },
  });

  const managedRows = await (prisma as any).$queryRawUnsafe(`
    SELECT r."id", r."name", r."slug", r."status", r."templateId", r."primaryColor", r."logo", r."address", rm."role"
    FROM "RestaurantManager" rm
    JOIN "Restaurant" r ON rm."restaurantId" = r."id"
    WHERE rm."userId" = ?
  `, session.id) as any[];

  return NextResponse.json({
    restaurants: [
      ...owned.map((r: any) => ({ ...r, accessType: "owner" })),
      ...managedRows.map((r: any) => ({ ...r, accessType: r.role })),
    ],
  });
}

// POST — create a new restaurant (for multi-location managers)
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check they already own at least one restaurant (prevents abuse)
  const existingCount = await prisma.restaurant.count({ where: { ownerId: session.id } });
  if (existingCount >= 10) {
    return NextResponse.json({ error: "Maximum 10 restaurants per account" }, { status: 400 });
  }

  const { name, description, address } = await req.json() as {
    name: string; description?: string; address?: string;
  };
  if (!name?.trim()) return NextResponse.json({ error: "Restaurant name required" }, { status: 400 });

  const slug = await generateSlug(name);

  // For multi-location: create a new user account tied to this restaurant OR reuse owner
  // We use a raw INSERT to bypass the @unique ownerId constraint at the Prisma level
  const restaurantId = `rest_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  // Create a "shadow" owner user for the secondary restaurant
  const shadowEmail = `shadow_${restaurantId}@skano.internal`;
  const shadowPassword = await bcrypt.hash(Math.random().toString(36), 8);
  const shadowUserId = `shadow_${restaurantId}`;

  await (prisma as any).$executeRawUnsafe(`
    INSERT INTO "User" ("id","email","password","name","role","assignedTables","createdAt","updatedAt")
    VALUES (?,?,?,?,?,?,datetime('now'),datetime('now'))
  `, shadowUserId, shadowEmail, shadowPassword, session.name ?? "Manager", "MANAGER", "[]");

  await (prisma as any).$executeRawUnsafe(`
    INSERT INTO "Restaurant" (
      "id","name","slug","status","ownerId","cuisine","promotions","customTags","themeConfig",
      "tableMap","sections","loyaltyEnabled","loyaltyStamps","loyaltyReward","planTier","isVerified",
      "openingHours","socialLinks","primaryColor","templateId","primaryMenu","createdAt","updatedAt"
    ) VALUES (?,?,?,'ACTIVE',?,?,?,?,?,?,?,0,10,'Free item','free',0,?,?,?,?,?,datetime('now'),datetime('now'))
  `,
    restaurantId, name.trim(), slug, shadowUserId,
    "[]", "[]", "[]", "{}",
    "[]", "[]",
    "{}", "{}", "#f97316", "modern", "dynamic"
  );

  if (description?.trim()) {
    await (prisma as any).$executeRawUnsafe(
      `UPDATE "Restaurant" SET "description" = ? WHERE "id" = ?`,
      description.trim(), restaurantId
    );
  }
  if (address?.trim()) {
    await (prisma as any).$executeRawUnsafe(
      `UPDATE "Restaurant" SET "address" = ? WHERE "id" = ?`,
      address.trim(), restaurantId
    );
  }

  // Grant access via RestaurantManager
  const rmId = `rm_${Date.now()}`;
  await (prisma as any).$executeRawUnsafe(`
    INSERT INTO "RestaurantManager" ("id","userId","restaurantId","role","createdAt")
    VALUES (?,?,?,?,datetime('now'))
    ON CONFLICT("userId","restaurantId") DO NOTHING
  `, rmId, session.id, restaurantId, "owner");

  return NextResponse.json({ id: restaurantId, slug, name: name.trim() }, { status: 201 });
}
