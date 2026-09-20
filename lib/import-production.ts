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

    console.log("[IMPORT] Checking if users exist...");
    const existingUsers = await prisma.user.count();

    if (existingUsers > 0) {
      console.log(`[IMPORT] Database already has ${existingUsers} users, skipping import`);
      await prisma.$disconnect();
      return;
    }

    console.log("[IMPORT] Importing production users...");

    for (const user of PRODUCTION_USERS) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      await prisma.user.create({
        data: {
          email: user.email,
          password: hashedPassword,
          name: user.name,
          role: user.role,
        },
      });
      console.log(`[IMPORT] ✓ Created user: ${user.email}`);
    }

    console.log("[IMPORT] ✅ Production users imported successfully");
    await prisma.$disconnect();
  } catch (error) {
    console.error("[IMPORT] ❌ Failed to import users:", error);
    process.exit(1);
  }
}

importProductionUsers().catch(console.error);
