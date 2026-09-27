import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    // Skip token verification if INIT_TOKEN is not set (for development/testing)
    const token = request.headers.get("x-init-token");
    if (process.env.INIT_TOKEN && token !== process.env.INIT_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[RESET] Starting restaurant reset...");

    const deletedCount = await prisma.restaurant.deleteMany({});

    console.log(`[RESET] Deleted ${deletedCount.count} restaurants`);

    return NextResponse.json({
      success: true,
      message: "All restaurants deleted successfully",
      deletedCount: deletedCount.count,
      nextStep: "Run POST /api/admin/initialize with your SQL file to re-import all restaurants",
    });
  } catch (error: any) {
    console.error("[RESET] Failed:", error);
    return NextResponse.json(
      {
        error: error.message || "Reset failed",
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}
