import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

// POST /api/waiter/push-subscribe  — save a push subscription for the logged-in waiter
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || session.role !== "WAITER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { endpoint, keys } = await req.json() as {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    };

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }

    const restaurantId = session.restaurantId;
    if (!restaurantId) {
      return NextResponse.json({ error: "No restaurant associated" }, { status: 400 });
    }

    // Upsert by endpoint
    await (prisma as any).$executeRawUnsafe(`
      INSERT INTO "WaiterPushSub" ("id", "restaurantId", "userId", "endpoint", "p256dh", "auth", "createdAt")
      VALUES (lower(hex(randomblob(8))), ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT("endpoint") DO UPDATE SET
        "restaurantId" = excluded."restaurantId",
        "userId" = excluded."userId",
        "p256dh" = excluded."p256dh",
        "auth" = excluded."auth"
    `, restaurantId, session.id, endpoint, keys.p256dh, keys.auth);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[push-subscribe POST]", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// DELETE /api/waiter/push-subscribe  — remove push subscription for the logged-in waiter
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session || session.role !== "WAITER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { endpoint } = await req.json() as { endpoint: string };
    if (!endpoint) {
      return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
    }

    await (prisma as any).$executeRawUnsafe(
      `DELETE FROM "WaiterPushSub" WHERE "endpoint" = ? AND "userId" = ?`,
      endpoint, session.id
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[push-subscribe DELETE]", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
