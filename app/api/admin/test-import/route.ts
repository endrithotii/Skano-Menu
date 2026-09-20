import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sqlContent } = body;

    if (!sqlContent) {
      return NextResponse.json({ error: "sqlContent required" }, { status: 400 });
    }

    // Simple test - just confirm we received the SQL
    const lines = sqlContent.split('\n').length;

    return NextResponse.json({
      success: true,
      message: "Test endpoint working",
      sqlFileLines: lines,
      sqlSize: sqlContent.length,
    });
  } catch (error) {
    console.error("[POST /api/admin/test-import]", error);
    return NextResponse.json(
      { error: "Request failed", details: String(error) },
      { status: 500 }
    );
  }
}
