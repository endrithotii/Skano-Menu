import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import bcrypt from "bcryptjs";

const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL!,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});
const prisma = new PrismaClient({ adapter } as any);

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

function extractTableData(sqlContent: string, tableName: string): any[] {
  const regex = new RegExp(
    `INSERT INTO \\\`${tableName}\\\` \\(([^)]+)\\) VALUES\\s+([^;]+);`,
    "gi"
  );

  const matches = [...sqlContent.matchAll(regex)];
  const results: any[] = [];

  for (const match of matches) {
    const columns = match[1]
      .split(",")
      .map((c) => c.trim().replace(/\`/g, ""));
    const valuesStr = match[2];
    const valueGroups = valuesStr.match(
      /\(([^)]+(?:[^)]*\([^)]*\)[^)]*)*)\)/g
    ) || [];

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

export async function POST(request: Request) {
  try {
    const { sqlContent } = await request.json();

    if (!sqlContent) {
      return Response.json(
        { error: "SQL content required" },
        { status: 400 }
      );
    }

    const users = extractTableData(sqlContent, "users");
    console.log(`Found ${users.length} users, importing...`);

    let imported = 0;
    for (const user of users.slice(0, 50)) {
      try {
        await prisma.user.upsert({
          where: { email: user.email || `user${user.id}@skano.menu` },
          update: {},
          create: {
            email: user.email || `user${user.id}@skano.menu`,
            password:
              user.password ||
              (await bcrypt.hash(`user${user.id}123`, 10)),
            name: user.name || `User ${user.id}`,
            role:
              user.role === "admin" || user.role === "1"
                ? "SUPER_ADMIN"
                : "MANAGER",
          },
        });
        imported++;
      } catch (e) {
        console.error(`Failed to import user ${user.email}:`, e);
      }
    }

    return Response.json({
      success: true,
      imported,
      total: users.length,
      message: `Imported ${imported} users from production database`,
    });
  } catch (error: any) {
    console.error("Import failed:", error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
