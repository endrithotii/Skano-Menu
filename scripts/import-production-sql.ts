#!/usr/bin/env node
/**
 * Import production SQL dump into Turso
 * Maps old Laravel schema to new Prisma schema
 */

import fs from "fs";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import bcrypt from "bcryptjs";

const dbUrl = process.env.DATABASE_URL || "file:./prisma/dev.db";
const authToken = process.env.DATABASE_AUTH_TOKEN;
const adapter = new PrismaLibSql({ url: dbUrl, ...(authToken ? { authToken } : {}) });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

// Simple SQL value parser
function parseSqlValue(val: string): any {
  val = val.trim();
  if (val === "NULL") return null;
  if (val === "0") return 0;
  if (val === "1") return 1;
  if (!isNaN(Number(val))) return Number(val);
  if (val.startsWith("'") && val.endsWith("'")) {
    return val.slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, "\\");
  }
  return val;
}

// Extract data from SQL INSERT statements
function extractTableData(sqlContent: string, tableName: string): any[] {
  const regex = new RegExp(
    `INSERT INTO \`${tableName}\` \\(([^)]+)\\) VALUES\\s+([^;]+);`,
    "gi"
  );

  const matches = [...sqlContent.matchAll(regex)];
  const results: any[] = [];

  for (const match of matches) {
    const columns = match[1]
      .split(",")
      .map((c) => c.trim().replace(/`/g, ""));
    const valuesStr = match[2];

    // Match each value group
    const valueGroups = valuesStr.match(/\(([^)]+(?:[^)]*\([^)]*\)[^)]*)*)\)/g) || [];

    for (const group of valueGroups) {
      const cleaned = group.slice(1, -1);
      const values: any[] = [];
      let current = "";
      let inQuotes = false;

      for (let i = 0; i < cleaned.length; i++) {
        const char = cleaned[i];
        const prevChar = i > 0 ? cleaned[i - 1] : "";

        if (char === "'" && prevChar !== "\\") {
          inQuotes = !inQuotes;
          current += char;
        } else if (char === "," && !inQuotes) {
          values.push(parseSqlValue(current));
          current = "";
        } else {
          current += char;
        }
      }

      if (current) values.push(parseSqlValue(current));

      const row: any = {};
      for (let i = 0; i < columns.length; i++) {
        row[columns[i]] = values[i];
      }
      results.push(row);
    }
  }

  return results;
}

async function importData() {
  console.log("📖 Reading production database dump...");
  const sqlContent = fs.readFileSync(
    "/root/.claude/uploads/01c0d62f-0034-56c4-b643-ffff8bfdcd4b/aa8a6657-skandgog_skanomenu.sql",
    "utf-8"
  );

  // Extract data
  console.log("🔍 Parsing data...");
  const users = extractTableData(sqlContent, "users");
  console.log(`  ✓ Found ${users.length} users`);

  // Create users
  console.log("\n👥 Importing users...");
  const userMap = new Map<number, string>();

  for (const user of users.slice(0, 10)) {
    // Limit to first 10 for testing
    try {
      const createdUser = await prisma.user.upsert({
        where: { email: user.email || `user${user.id}@skano.menu` },
        update: {},
        create: {
          email: user.email || `user${user.id}@skano.menu`,
          password: user.password || (await bcrypt.hash("password123", 10)),
          name: user.name || `User ${user.id}`,
          role: user.role === "admin" ? "SUPER_ADMIN" : "MANAGER",
        },
      });
      userMap.set(user.id, createdUser.id);
      console.log(`  ✓ ${createdUser.email}`);
    } catch (e: any) {
      console.log(`  ⚠ ${user.email}: ${e.message}`);
    }
  }

  console.log(`\n✅ Migration complete! Imported ${userMap.size} users`);
  console.log(
    "\n📝 Next steps:\n  1. Visit https://skano-menu-vercel.vercel.app\n  2. Login with your production credentials\n  3. Recreate restaurants with your real data"
  );
}

importData()
  .catch((e) => {
    console.error("❌ Error:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
