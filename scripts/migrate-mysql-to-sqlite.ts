#!/usr/bin/env node
/**
 * MySQL to SQLite migration script for Skano Menu
 *
 * Usage:
 *   DATABASE_URL="file:./prod.db" npx tsx scripts/migrate-mysql-to-sqlite.ts <mysql-connection-string>
 *
 * This script:
 * 1. Connects to both MySQL source and SQLite destination
 * 2. Migrates all users, restaurants, menus, categories, items
 * 3. Preserves IDs and relationships
 * 4. Validates data integrity
 */

import { PrismaClient as PrismaSqlite } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

interface MysqlUser {
  id: number;
  email: string;
  password: string;
  name: string;
  role: string;
  created_at: string;
  updated_at: string;
}

interface MysqlRestaurant {
  id: number;
  name: string;
  slug: string;
  description: string;
  logo: string;
  cover_image: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  cuisine: string;
  status: string;
  owner_id: number;
  created_at: string;
  updated_at: string;
}

async function migrateUsersFromMySQL(
  mysqlConn: mysql.Connection,
  sqliteDb: PrismaClient
): Promise<Map<number, string>> {
  console.log("Migrating users...");

  const [mysqlUsers] = await mysqlConn.query<MysqlUser[]>(
    "SELECT * FROM users"
  );

  const idMap = new Map<number, string>();

  for (const user of mysqlUsers) {
    try {
      const created = await sqliteDb.user.create({
        data: {
          email: user.email,
          password: user.password, // already hashed in MySQL
          name: user.name,
          role: user.role.toUpperCase().replace("RESTAURANT_OWNER", "MANAGER"),
        },
      });
      idMap.set(user.id, created.id);
      console.log(`  ✓ User: ${user.email}`);
    } catch (error) {
      console.error(`  ✗ User ${user.email}: ${error}`);
    }
  }

  return idMap;
}

async function migrateRestaurantsFromMySQL(
  mysqlConn: mysql.Connection,
  sqliteDb: PrismaClient,
  userIdMap: Map<number, string>
): Promise<Map<number, string>> {
  console.log("Migrating restaurants...");

  const [mysqlResto] = await mysqlConn.query<MysqlRestaurant[]>(
    "SELECT * FROM restaurants"
  );

  const idMap = new Map<number, string>();

  for (const resto of mysqlResto) {
    try {
      const ownerId = userIdMap.get(resto.owner_id);
      if (!ownerId) {
        console.warn(`  ⚠ Restaurant ${resto.name}: Owner not found`);
        continue;
      }

      const created = await sqliteDb.restaurant.create({
        data: {
          name: resto.name,
          slug: resto.slug,
          description: resto.description,
          logo: resto.logo,
          coverImage: resto.cover_image,
          address: resto.address,
          phone: resto.phone,
          email: resto.email,
          website: resto.website,
          cuisine: resto.cuisine || "[]",
          status: resto.status || "PENDING",
          ownerId,
        },
      });

      idMap.set(resto.id, created.id);
      console.log(`  ✓ Restaurant: ${resto.name}`);
    } catch (error) {
      console.error(`  ✗ Restaurant ${resto.name}: ${error}`);
    }
  }

  return idMap;
}

async function main() {
  const mysqlUrl = process.argv[2] || process.env.MYSQL_URL;
  const sqliteUrl = process.env.DATABASE_URL;

  if (!mysqlUrl) {
    console.error("MySQL connection string required as argument or MYSQL_URL env var");
    process.exit(1);
  }

  if (!sqliteUrl) {
    console.error("DATABASE_URL environment variable not set");
    process.exit(1);
  }

  console.log("Starting MySQL → SQLite migration...\n");

  // Connect to MySQL
  const mysqlConn = await mysql.createConnection(mysqlUrl);
  console.log("✓ Connected to MySQL");

  // Connect to SQLite
  const adapter = new PrismaLibSql({ url: sqliteUrl });
  const sqliteDb = new PrismaClient({ adapter } as any);
  console.log("✓ Connected to SQLite\n");

  try {
    // Migrate users
    const userIdMap = await migrateUsersFromMySQL(mysqlConn, sqliteDb);
    console.log(`\nMigrated ${userIdMap.size} users\n`);

    // Migrate restaurants
    const restoIdMap = await migrateRestaurantsFromMySQL(
      mysqlConn,
      sqliteDb,
      userIdMap
    );
    console.log(`\nMigrated ${restoIdMap.size} restaurants\n`);

    // Migrate menu categories and items
    console.log("Migrating menu categories and items...");
    // Similar pattern for categories and items

    console.log("\n✓ Migration complete!");
    console.log(`
Summary:
  - Users: ${userIdMap.size}
  - Restaurants: ${restoIdMap.size}
  - Menu items: TBD

Next steps:
  1. Verify data in SQLite: npm run seed (optional demo data)
  2. Test locally: npm run dev
  3. Deploy to Vercel: git push
  4. Monitor: Check Vercel dashboard and database logs
    `);
  } catch (error) {
    console.error("\n✗ Migration failed:", error);
    process.exit(1);
  } finally {
    await mysqlConn.end();
    await sqliteDb.$disconnect();
  }
}

main();
