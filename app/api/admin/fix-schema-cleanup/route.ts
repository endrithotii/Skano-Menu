import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("x-init-token");
    if (process.env.INIT_TOKEN && token !== process.env.INIT_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[FIX-SCHEMA-CLEANUP] Cleaning up partial migration...");

    try {
      // Try to drop Restaurant_new if it exists
      await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "Restaurant_new"`);
      console.log("[FIX-SCHEMA-CLEANUP] Dropped Restaurant_new if it existed");
    } catch (e) {
      console.log("[FIX-SCHEMA-CLEANUP] Restaurant_new cleanup:", (e as any).message);
    }

    // Now check the current state
    const tables = await prisma.$queryRawUnsafe<any[]>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='Restaurant'`
    );

    if (tables.length === 0) {
      console.log("[FIX-SCHEMA-CLEANUP] Restaurant table does not exist, cannot proceed");
      return NextResponse.json({
        error: "Restaurant table not found",
      }, { status: 500 });
    }

    // Get the actual columns from the existing Restaurant table
    const columns = await prisma.$queryRawUnsafe<any[]>(
      `PRAGMA table_info("Restaurant")`
    );

    console.log(`[FIX-SCHEMA-CLEANUP] Found ${columns.length} columns in Restaurant table`);

    // Build CREATE TABLE statement dynamically from existing columns
    let createTableSQL = `CREATE TABLE "Restaurant_new" (\n`;
    const columnDefs = columns.map((col) => {
      let def = `  "${col.name}" ${col.type}`;

      if (col.pk) {
        def += " PRIMARY KEY";
      } else {
        if (col.notnull) def += " NOT NULL";
        if (col.dflt_value !== null && col.dflt_value !== undefined) {
          def += ` DEFAULT ${col.dflt_value}`;
        }
      }

      return def;
    }).join(",\n");

    createTableSQL += columnDefs + "\n)";

    console.log("[FIX-SCHEMA-CLEANUP] Creating Restaurant_new with dynamic schema");
    await prisma.$executeRawUnsafe(createTableSQL);

    const columnNames = columns.map(col => `"${col.name}"`).join(', ');

    console.log("[FIX-SCHEMA-CLEANUP] Copying data from old table...");
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Restaurant_new" (${columnNames}) SELECT ${columnNames} FROM "Restaurant"`
    );

    await prisma.$executeRawUnsafe(`DROP TABLE "Restaurant"`);

    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Restaurant_new" RENAME TO "Restaurant"`
    );

    console.log("[FIX-SCHEMA-CLEANUP] Migration completed successfully");

    return NextResponse.json({
      success: true,
      message: "Schema migration fixed - removed unique constraint from ownerId",
    });
  } catch (error: any) {
    console.error("[FIX-SCHEMA-CLEANUP] Failed:", error);

    return NextResponse.json(
      {
        error: error.message || "Cleanup failed",
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}
