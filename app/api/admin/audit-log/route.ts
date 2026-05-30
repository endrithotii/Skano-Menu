import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
  const restaurantId = searchParams.get("restaurantId");
  const userId = searchParams.get("userId");
  const action = searchParams.get("action");

  let where = `WHERE 1=1`;
  const args: unknown[] = [];
  if (restaurantId) { where += ` AND "restaurantId" = ?`; args.push(restaurantId); }
  if (userId)       { where += ` AND "userId" = ?`;       args.push(userId); }
  if (action)       { where += ` AND "action" = ?`;       args.push(action); }

  const rows = await (prisma as any).$queryRawUnsafe(
    `SELECT al.*, u."name" as userName, u."email" as userEmail
     FROM "AuditLog" al
     LEFT JOIN "User" u ON al."userId" = u."id"
     ${where}
     ORDER BY al."createdAt" DESC LIMIT ?`,
    ...args, limit
  );

  return NextResponse.json({ logs: rows });
}
