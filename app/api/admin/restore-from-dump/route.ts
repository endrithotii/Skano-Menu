import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("x-init-token");
    if (process.env.INIT_TOKEN && token !== process.env.INIT_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get SQL dump content from request body
    const body = await request.text();

    if (!body || body.length < 100) {
      return NextResponse.json({
        error: "Invalid request - SQL dump content required",
        instructions: "Send the SQL dump file content as raw request body"
      }, { status: 400 });
    }

    console.log("[RESTORE-FROM-DUMP] Starting database restoration...");
    console.log(`[RESTORE-FROM-DUMP] SQL dump size: ${body.length} bytes`);

    // Extract INSERT statements for users and menus
    const usersData: any[] = [];
    const menusData: any[] = [];

    // Find all INSERT INTO statements - handle multi-line VALUES
    const insertPattern = /INSERT INTO `(users|menus)`[^V]*VALUES\s*([\s\S]*?);\s*(?=--|INSERT|$)/g;
    let match;

    while ((match = insertPattern.exec(body)) !== null) {
      const tableName = match[1];
      const valuesBlock = match[2];

      // Extract individual rows: (val1, val2, ...)
      const rowPattern = /\(([^)]+)\)/g;
      let rowMatch;

      while ((rowMatch = rowPattern.exec(valuesBlock)) !== null) {
        const rowStr = rowMatch[1];

        // Split by comma but respect quoted strings
        const parts: string[] = [];
        let current = '';
        let inQuotes = false;
        let quoteChar = '';

        for (let i = 0; i < rowStr.length; i++) {
          const char = rowStr[i];
          const prevChar = i > 0 ? rowStr[i - 1] : '';

          if ((char === "'" || char === '"') && prevChar !== '\\') {
            if (!inQuotes) {
              inQuotes = true;
              quoteChar = char;
            } else if (char === quoteChar) {
              inQuotes = false;
            }
            current += char;
          } else if (char === ',' && !inQuotes) {
            parts.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        if (current) {
          parts.push(current.trim());
        }

        // Clean up parts - remove quotes
        const cleanParts = parts.map(s => {
          if ((s.startsWith("'") && s.endsWith("'")) ||
              (s.startsWith('"') && s.endsWith('"'))) {
            return s.slice(1, -1);
          }
          return s;
        });

        if (tableName === 'users' && cleanParts.length >= 4) {
          usersData.push({
            id: parseInt(cleanParts[0]),
            name: cleanParts[1],
            email: cleanParts[2],
            password: cleanParts[3]
          });
        } else if (tableName === 'menus' && cleanParts.length >= 6) {
          menusData.push({
            id: parseInt(cleanParts[0]),
            created_at: cleanParts[1],
            updated_at: cleanParts[2],
            owner: parseInt(cleanParts[3]),
            active: cleanParts[4] === 'NULL' ? null : parseInt(cleanParts[4]),
            title: cleanParts[5] === 'NULL' ? null : cleanParts[5]
          });
        }
      }
    }

    console.log(`[RESTORE-FROM-DUMP] Extracted ${usersData.length} users and ${menusData.length} menus from dump`);

    // Now migrate data from old schema to new Prisma schema
    console.log("[RESTORE-FROM-DUMP] Starting data migration...");

    // 1. Migrate users from extracted data
    let usersImported = 0;
    try {
      for (const oldUser of usersData) {
        const exists = await prisma.user.findFirst({
          where: { email: oldUser.email },
        }).catch(() => null);

        if (!exists) {
          await prisma.user.create({
            data: {
              id: `prod-user-${oldUser.id}`,
              email: oldUser.email || `user${oldUser.id}@imported.local`,
              name: oldUser.name || `User ${oldUser.id}`,
              password: "imported_prod_user",
              role: "RESTAURANT_OWNER",
            },
          }).catch(err => {
            console.log(`[RESTORE-FROM-DUMP] Skipped user ${oldUser.id}: ${err.message}`);
          });
          usersImported++;
        }
      }
      console.log(`[RESTORE-FROM-DUMP] Imported ${usersImported} users`);
    } catch (err: any) {
      console.log(`[RESTORE-FROM-DUMP] User migration: ${err.message}`);
    }

    // 2. Migrate menus/restaurants from extracted data
    let restaurantsImported = 0;
    try {
      for (const oldMenu of menusData) {
        const slug = (oldMenu.title || `restaurant-${oldMenu.id}`)
          .toLowerCase()
          .trim()
          .replace(/[^\w\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-");

        const exists = await prisma.restaurant.findUnique({
          where: { slug },
        }).catch(() => null);

        if (!exists) {
          // Find the owner user
          const ownerUser = await prisma.user.findFirst({
            where: { id: `prod-user-${oldMenu.owner}` },
          }).catch(() => null);

          if (ownerUser) {
            await prisma.restaurant.create({
              data: {
                name: oldMenu.title || `Restaurant ${oldMenu.id}`,
                slug,
                description: oldMenu.title || "",
                status: oldMenu.active === 1 ? "ACTIVE" : "PENDING",
                ownerId: ownerUser.id,
                email: "info@skano.menu",
                cuisine: JSON.stringify([]),
                logo: "",
                coverImage: "",
                address: "Imported",
                phone: "Not specified",
                website: "",
              },
            }).catch(err => {
              console.log(`[RESTORE-FROM-DUMP] Skipped menu ${oldMenu.id}: ${err.message}`);
            });
            restaurantsImported++;
          }
        }
      }
      console.log(`[RESTORE-FROM-DUMP] Imported ${restaurantsImported} restaurants`);
    } catch (err: any) {
      console.log(`[RESTORE-FROM-DUMP] Restaurant migration: ${err.message}`);
    }

    // Get final counts
    const finalUsers = await prisma.user.count();
    const finalRestaurants = await prisma.restaurant.count();
    const activeRestaurants = await prisma.restaurant.count({
      where: { status: "ACTIVE" }
    });

    console.log(`[RESTORE-FROM-DUMP] Final: ${finalUsers} users, ${finalRestaurants} restaurants (${activeRestaurants} active)`);

    return NextResponse.json({
      success: true,
      message: "Database restoration and migration completed",
      extraction: {
        usersExtracted: usersData.length,
        menusExtracted: menusData.length,
      },
      dataMigration: {
        usersImported,
        restaurantsImported,
      },
      finalCounts: {
        users: finalUsers,
        restaurants: finalRestaurants,
        active: activeRestaurants,
        pending: finalRestaurants - activeRestaurants,
      },
    });
  } catch (error: any) {
    console.error("[RESTORE-FROM-DUMP] Failed:", error);

    return NextResponse.json(
      {
        error: error.message || "Restoration failed",
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}
