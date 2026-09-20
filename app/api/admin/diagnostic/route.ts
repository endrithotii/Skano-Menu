import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  return NextResponse.json({
    DATABASE_URL: process.env.DATABASE_URL ? "✓ Set" : "✗ Missing",
    DATABASE_AUTH_TOKEN: process.env.DATABASE_AUTH_TOKEN ? "✓ Set" : "✗ Missing",
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
    INIT_TOKEN: process.env.INIT_TOKEN ? "✓ Set" : "✗ Missing",
  });
}
