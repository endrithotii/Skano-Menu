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

    // Split SQL into individual statements and filter valid ones
    const statements = body
      .split(';')
      .map(s => s.trim())
      .filter(s =>
        s.length > 0 &&
        !s.startsWith('--') &&
        !s.startsWith('/*') &&
        !s.startsWith('SET') &&
        !s.startsWith('/*!') &&
        !s.includes('DEFAULT CHARSET')
      );

    console.log(`[RESTORE-FROM-DUMP] Found ${statements.length} SQL statements`);

    let executed = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Execute each statement
    for (const statement of statements) {
      try {
        await prisma.$executeRawUnsafe(statement);
        executed++;
      } catch (err: any) {
        skipped++;
        if (skipped <= 10) { // Log first 10 errors
          console.log(`[RESTORE-FROM-DUMP] Skipped (might already exist): ${statement.substring(0, 80)}`);
          console.log(`  Error: ${err.message}`);
        }
      }
    }

    console.log(`[RESTORE-FROM-DUMP] Execution: ${executed} statements executed, ${skipped} skipped`);

    // Now migrate data from old schema to new Prisma schema
    console.log("[RESTORE-FROM-DUMP] Starting data migration...");

    // 1. Migrate users from old to new schema
    let usersImported = 0;
    try {
      const oldUsers = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, name, email FROM users LIMIT 1000`
      );

      for (const oldUser of oldUsers) {
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

    // 2. Migrate menus/restaurants from old to new schema
    let restaurantsImported = 0;
    try {
      const oldMenus = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, title, owner, active FROM menus LIMIT 1000`
      );

      for (const oldMenu of oldMenus) {
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
                description: oldMenu.title,
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
      sqlImport: {
        statementsExecuted: executed,
        statementsSkipped: skipped,
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
