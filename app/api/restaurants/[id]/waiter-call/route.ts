import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

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
      select: { id: true },
    });
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    const call = await (prisma as any).waiterCall.create({
      data: {
        restaurantId: restaurant.id,
        tableNumber: tableNumber?.trim() || null,
        message: message?.trim() || null,
        status: "pending",
        id: `wc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, id: call.id });
  } catch (error) {
    console.error("[POST waiter-call]", error);
    return NextResponse.json({ error: "Failed to send call" }, { status: 500 });
  }
}

// Dashboard: GET pending calls (auth required)
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const restaurant = await prisma.restaurant.findFirst({
      where: { OR: [{ id }, { slug: id }], ownerId: session.id },
      select: { id: true },
    });
    if (!restaurant) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const calls = await (prisma as any).waiterCall.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ calls });
  } catch (error) {
    console.error("[GET waiter-call]", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// Dashboard: PATCH resolve a call
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { callId } = await req.json() as { callId: string };

    const restaurant = await prisma.restaurant.findFirst({
      where: { OR: [{ id }, { slug: id }], ownerId: session.id },
      select: { id: true },
    });
    if (!restaurant) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await (prisma as any).waiterCall.update({
      where: { id: callId },
      data: { status: "resolved" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PATCH waiter-call]", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
