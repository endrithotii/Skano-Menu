import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

const PRODUCTION_USERS = [
  {
    email: "admin@skano.menu",
    password: "admin123",
    name: "System Admin",
    role: "SUPER_ADMIN",
  },
  {
    email: "resto@skano.menu",
    password: "owner123",
    name: "Arben Krasniqi",
    role: "MANAGER",
  },
  {
    email: "cafe@skano.menu",
    password: "owner123",
    name: "Blerim Hoxha",
    role: "MANAGER",
  },
];

export async function importProductionUsers() {
  try {
    const adapter = new PrismaLibSql({
      url: process.env.DATABASE_URL!,
      authToken: process.env.DATABASE_AUTH_TOKEN,
    });
    const prisma = new PrismaClient({ adapter } as any);

    console.log("[IMPORT] Checking if data exists...");
    const existingUsers = await prisma.user.count();

    if (existingUsers > 0) {
      console.log(`[IMPORT] Database already has ${existingUsers} users, skipping import`);
      await prisma.$disconnect();
      return;
    }

    console.log("[IMPORT] Importing production data...");

    const createdUsers: Record<string, string> = {};

    for (const user of PRODUCTION_USERS) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      const created = await prisma.user.create({
        data: {
          email: user.email,
          password: hashedPassword,
          name: user.name,
          role: user.role,
        },
      });
      createdUsers[user.email] = created.id;
      console.log(`[IMPORT] ✓ Created user: ${user.email}`);
    }

    // Create demo restaurants for managers
    const restaurants = [
      {
        name: "Arben's Restaurant",
        slug: "arbens-restaurant",
        description: "Traditional Albanian cuisine",
        cuisine: JSON.stringify(["Albanian", "Mediterranean"]),
        ownerId: createdUsers["resto@skano.menu"],
      },
      {
        name: "Blerim's Cafe",
        slug: "blems-cafe",
        description: "Cozy cafe with fresh coffee",
        cuisine: JSON.stringify(["Cafe", "Desserts"]),
        ownerId: createdUsers["cafe@skano.menu"],
      },
    ];

    for (const resto of restaurants) {
      await prisma.restaurant.create({
        data: {
          name: resto.name,
          slug: resto.slug,
          description: resto.description,
          cuisine: resto.cuisine,
          ownerId: resto.ownerId,
          status: "ACTIVE",
          logo: "",
          coverImage: "",
          address: "Sample Address",
          phone: "+1234567890",
          email: "restaurant@skano.menu",
          website: "",
        },
      });
      console.log(`[IMPORT] ✓ Created restaurant: ${resto.name}`);
    }

    console.log("[IMPORT] ✅ Production data imported successfully");
    await prisma.$disconnect();
  } catch (error) {
    console.error("[IMPORT] ❌ Failed to import data:", error);
    process.exit(1);
  }
}

importProductionUsers().catch(console.error);
