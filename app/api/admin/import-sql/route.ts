import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import fs from "fs";
import path from "path";

// Import SQL database directly from file content

// Parse SQL INSERT statement into data
function parseSqlInsert(sqlLine: string): Record<string, any> {
  const data: Record<string, any> = {};

  // Extract column names: INSERT INTO `table` (`col1`, `col2`) VALUES
  const columnMatch = sqlLine.match(/\(`([^`]+)`(?:,\s*`([^`]+)`)*\)/);
  if (!columnMatch) return data;

  const columns = sqlLine.match(/`[^`]+`/g)?.map(c => c.slice(1, -1)) || [];

  // Extract values: VALUES (...), (...), ...
  const valuesMatch = sqlLine.match(/VALUES\s+(.*?)(?:;|$)/i);
  if (!valuesMatch) return data;

  const valuesStr = valuesMatch[1];
  const valueGroups = valuesStr.match(/\([^)]+\)/g) || [];

  if (valueGroups.length === 0) return data;

  const firstGroup = (valueGroups[0] || '').slice(1, -1); // Remove parentheses
  const values = firstGroup.split(/,\s*(?=(?:[^']*'[^']*')*[^']*$)/); // Split by comma, respecting quotes

  values.forEach((val, i) => {
    if (i < columns.length) {
      let cleanVal = val.trim();

      // Handle NULL
      if (cleanVal === 'NULL') {
        data[columns[i]] = null;
      }
      // Handle quoted strings
      else if ((cleanVal.startsWith("'") && cleanVal.endsWith("'")) ||
               (cleanVal.startsWith('"') && cleanVal.endsWith('"'))) {
        data[columns[i]] = cleanVal.slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, "\\");
      }
      // Handle numbers
      else if (!isNaN(Number(cleanVal))) {
        data[columns[i]] = Number(cleanVal);
      }
      // Handle booleans
      else if (cleanVal === 'true' || cleanVal === 'false') {
        data[columns[i]] = cleanVal === 'true';
      }
      else {
        data[columns[i]] = cleanVal;
      }
    }
  });

  return data;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export async function GET(request: NextRequest) {
  return Response.json({
    message: "POST with sqlContent to import complete database",
    example: "POST with body: { sqlContent: 'entire SQL file content' }",
  });
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("x-init-token");
    if (process.env.INIT_TOKEN && token !== process.env.INIT_TOKEN) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sqlContent } = await request.json();

    if (!sqlContent) {
      return Response.json(
        { error: "sqlContent required in body" },
        { status: 400 }
      );
    }

    const adapter = new PrismaLibSql({
      url: process.env.DATABASE_URL!,
      authToken: process.env.DATABASE_AUTH_TOKEN,
    });
    const prisma = new PrismaClient({ adapter } as any);

    console.log("[SQL_IMPORT] Starting complete database import...");

    let usersCreated = 0;
    let restaurantsCreated = 0;
    const errors: string[] = [];
    const userMap: Record<number, string> = {}; // Map old ID to new ID

    // Parse users
    const userLines = sqlContent.match(/INSERT INTO `users`[^;]+;/gi) || [];

    for (const line of userLines) {
      const valueMatches = line.match(/VALUES\s+(.*?)(?:;|$)/i);
      if (!valueMatches) continue;

      const valuesStr = valueMatches[1];
      const valueGroups = valuesStr.match(/\([^)]+\)/g) || [];

      for (const group of valueGroups) {
        try {
          // Parse individual row
          const cleanGroup = group.slice(1, -1);
          const parts = cleanGroup.match(/'[^']*'|"[^"]*"|NULL|\d+/g) || [];

          if (parts.length < 6) continue; // Skip if not enough columns

          const oldId = parseInt(parts[0]);
          const name = parts[1].slice(1, -1);
          const email = parts[2].slice(1, -1);
          const password = parts[4].slice(1, -1);
          const businessName = parts[8]?.slice(1, -1) || '';

          const existing = await prisma.user.findUnique({
            where: { email },
          });

          if (existing) {
            userMap[oldId] = existing.id;
            continue;
          }

          const created = await prisma.user.create({
            data: {
              email,
              password, // Use hashed password from production
              name: name || businessName,
              role: "MANAGER",
            },
          });

          userMap[oldId] = created.id;
          usersCreated++;
          console.log(`[IMPORT] Created user: ${email}`);
        } catch (e: any) {
          errors.push(`User row: ${e.message}`);
        }
      }
    }

    // Parse menus (restaurants)
    const menuLines = sqlContent.match(/INSERT INTO `menus`[^;]+;/gi) || [];

    for (const line of menuLines) {
      const valueMatches = line.match(/VALUES\s+(.*?)(?:;|$)/i);
      if (!valueMatches) continue;

      const valuesStr = valueMatches[1];
      const valueGroups = valuesStr.match(/\([^)]+\)/g) || [];

      for (const group of valueGroups) {
        try {
          const cleanGroup = group.slice(1, -1);
          const parts = cleanGroup.match(/'[^']*'|"[^"]*"|NULL|\d+/g) || [];

          if (parts.length < 4) continue;

          const oldMenuId = parseInt(parts[0]);
          const createdAt = parts[1]?.slice(1, -1) || new Date().toISOString();
          const updatedAt = parts[2]?.slice(1, -1) || new Date().toISOString();
          const oldOwnerId = parseInt(parts[3]);
          const active = parts[4] === '1' || parts[4] === 'true';
          const title = parts[5]?.slice(1, -1) || `Menu ${oldMenuId}`;

          // Skip if owner not found
          const ownerId = userMap[oldOwnerId];
          if (!ownerId) continue;

          // Check if already exists
          const slug = generateSlug(title);
          const existing = await prisma.restaurant.findUnique({
            where: { slug },
          });

          if (existing) {
            console.log(`[IMPORT] Restaurant already exists: ${title}`);
            continue;
          }

          const created = await prisma.restaurant.create({
            data: {
              name: title,
              slug: slug,
              description: title,
              status: active ? "ACTIVE" : "PENDING",
              ownerId: ownerId,
              email: "info@skano.menu",
              cuisine: JSON.stringify([]),
              logo: "",
              coverImage: "",
              address: "Address not specified",
              phone: "Not specified",
              website: "",
            },
          });

          restaurantsCreated++;
          console.log(`[IMPORT] Created restaurant: ${title}`);
        } catch (e: any) {
          errors.push(`Restaurant: ${e.message}`);
        }
      }
    }

    await prisma.$disconnect();

    console.log(`[SQL_IMPORT] ✅ Completed. Users: ${usersCreated}, Restaurants: ${restaurantsCreated}`);

    return Response.json({
      success: true,
      message: "Database imported from SQL",
      stats: {
        usersCreated,
        restaurantsCreated,
        totalUsersImported: Object.keys(userMap).length,
      },
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined, // Return first 10 errors
    });
  } catch (error: any) {
    console.error("[SQL_IMPORT] Error:", error);
    return Response.json(
      {
        error: "Import failed",
        message: error.message,
      },
      { status: 500 }
    );
  }
}
