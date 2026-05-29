import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

// Helper: send Web Push to all subscribed waiters for a restaurant
async function sendPushToWaiters(
  restaurantId: string,
  payload: { title: string; body: string; url: string; callId: string; tableNumber?: string }
) {
  try {
    const vapidPublic = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
    const vapidEmail = process.env.VAPID_EMAIL || "mailto:admin@skano.menu";

    if (!vapidPublic || !vapidPrivate) return;

    // Lazily import web-push (edge-compatible dynamic import)
    const webpush = (await import("web-push")).default;
    webpush.setVapidDetails(vapidEmail, vapidPublic, vapidPrivate);

    // Fetch all push subscriptions joined with the waiter's assigned tables
    const subs: Array<{
      endpoint: string; p256dh: string; auth: string; assignedTables: string;
    }> = await (prisma as any).$queryRawUnsafe(
      `SELECT wps."endpoint", wps."p256dh", wps."auth", u."assignedTables"
       FROM "WaiterPushSub" wps
       JOIN "User" u ON wps."userId" = u."id"
       WHERE wps."restaurantId" = ?`,
      restaurantId
    );

    if (!subs || subs.length === 0) return;

    // Filter by table assignment: empty assignedTables = all tables; otherwise match
    const tableNum = payload.tableNumber?.trim();
    const filteredSubs = subs.filter((sub) => {
      try {
        const tables: string[] = JSON.parse(sub.assignedTables || "[]");
        if (tables.length === 0) return true; // catch-all waiter
        if (!tableNum) return true; // no specific table → notify everyone
        return tables.includes(tableNum);
      } catch { return true; }
    });

    if (filteredSubs.length === 0) return;

    const payloadStr = JSON.stringify(payload);
    const sendPromises = filteredSubs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payloadStr
        );
      } catch (err: unknown) {
        // Remove stale subscription (410 Gone / 404)
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 410 || status === 404) {
          await (prisma as any).$executeRawUnsafe(
            `DELETE FROM "WaiterPushSub" WHERE "endpoint" = ?`,
            sub.endpoint
          );
        }
      }
    });
    await Promise.allSettled(sendPromises);
  } catch (err) {
    console.error("[sendPushToWaiters]", err);
  }
}

// Customer: POST a waiter call (no auth required — public endpoint)
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const { tableNumber, message } = await req.json() as {
      tableNumber?: string;
      message?: string;
    };

    const restaurant = await prisma.restaurant.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      select: { id: true, name: true },
    });
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    const callId = `wc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await (prisma as any).waiterCall.create({
      data: {
        restaurantId: restaurant.id,
        tableNumber: tableNumber?.trim() || null,
        message: message?.trim() || null,
        status: "pending",
        id: callId,
        createdAt: new Date(),
      },
    });

    // Fire-and-forget Web Push to all subscribed waiters
    const tableLabel = tableNumber?.trim() ? `Table ${tableNumber.trim()}` : "A table";
    const msgLine = message?.trim() ? ` · "${message.trim()}"` : "";
    sendPushToWaiters(restaurant.id, {
      title: `🔔 ${tableLabel} is calling!`,
      body: `${tableLabel} needs assistance${msgLine}`,
      url: "/waiter",
      callId,
      tableNumber: tableNumber?.trim(),
    });

    return NextResponse.json({ success: true, id: callId });
  } catch (error) {
    console.error("[POST waiter-call]", error);
    return NextResponse.json({ error: "Failed to send call" }, { status: 500 });
  }
}

// Waiter or Owner: GET pending calls
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    let restaurantId: string;

    let assignedTables: string[] = [];

    if (session.role === "WAITER") {
      // Waiter can only see calls for their own restaurant
      if (!session.restaurantId) {
        return NextResponse.json({ error: "No restaurant" }, { status: 403 });
      }
      restaurantId = session.restaurantId;

      // Fetch their assigned tables to filter calls
      const waiterUser = await prisma.user.findUnique({
        where: { id: session.id },
        select: { assignedTables: true },
      });
      if (waiterUser) {
        try {
          const raw = (waiterUser as unknown as { assignedTables: string }).assignedTables;
          assignedTables = JSON.parse(raw || "[]");
        } catch { assignedTables = []; }
      }
    } else {
      // Owner or admin
      const restaurant = await prisma.restaurant.findFirst({
        where: { OR: [{ id }, { slug: id }], ownerId: session.id },
        select: { id: true },
      });
      if (!restaurant) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      restaurantId = restaurant.id;
    }

    const allCalls: Array<{
      id: string; tableNumber: string | null; message: string | null;
      status: string; createdAt: string;
    }> = await (prisma as any).waiterCall.findMany({
      where: { restaurantId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // For waiters with specific tables, filter to only show relevant calls
    const calls = (assignedTables.length > 0)
      ? allCalls.filter((c) => {
          if (!c.tableNumber) return true; // no table number = show to everyone
          return assignedTables.includes(c.tableNumber);
        })
      : allCalls;

    return NextResponse.json({ calls });
  } catch (error) {
    console.error("[GET waiter-call]", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// Waiter or Owner: PATCH resolve a call
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { callId } = await req.json() as { callId: string };

    let restaurantId: string;

    if (session.role === "WAITER") {
      if (!session.restaurantId) {
        return NextResponse.json({ error: "No restaurant" }, { status: 403 });
      }
      restaurantId = session.restaurantId;
    } else {
      const restaurant = await prisma.restaurant.findFirst({
        where: { OR: [{ id }, { slug: id }], ownerId: session.id },
        select: { id: true },
      });
      if (!restaurant) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      restaurantId = restaurant.id;
    }

    await (prisma as any).waiterCall.update({
      where: { id: callId, restaurantId },
      data: { status: "resolved" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PATCH waiter-call]", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
