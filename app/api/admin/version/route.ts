import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    version: "2.1",
    timestamp: new Date().toISOString(),
    message: "SQL import endpoint updated",
  });
}
