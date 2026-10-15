import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { approveRequest, canGiveStamps, getCard, getRequest, maskKey, normalizeCode } from "@/lib/loyalty";

// The waiter's side of a stamp code (signed-in waiter who may give stamps, or the restaurant owner)
// GET  -> { restaurantName, customer, kind, status, stamps, total, reward, allowed }
// POST -> confirms: adds the stamp / gives the reward -> { stamps, total, kind }

type Params = { params: Promise<{ code: string }> };

async function load(req: NextRequest, params: Params["params"]) {
  const session = await getSessionFromRequest(req);
  if (!session) return { error: NextResponse.json({ error: "Please sign in first." }, { status: 401 }) };
  const code = normalizeCode((await params).code);
  const r = code ? await getRequest(code) : null;
  if (!r) return { error: NextResponse.json({ error: "This code doesn't exist. Check the letters and try again." }, { status: 404 }) };
  const restaurant = await prisma.restaurant.findFirst({
    where: { id: r.restaurantId },
    select: { id: true, name: true, ownerId: true, loyaltyStamps: true, loyaltyReward: true, loyaltyEnabled: true },
  });
  if (!restaurant) return { error: NextResponse.json({ error: "Restaurant not found" }, { status: 404 }) };
  const program = {
    restaurantId: restaurant.id, ownerId: restaurant.ownerId, enabled: !!restaurant.loyaltyEnabled,
    total: Math.min(50, Math.max(2, Number(restaurant.loyaltyStamps) || 10)), reward: restaurant.loyaltyReward || "Free item",
  };
  const allowed = await canGiveStamps(session, program);
  return { session, r, restaurant, program, allowed };
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const x = await load(req, params);
    if ("error" in x) return x.error;
    const card = await getCard(x.r.restaurantId, x.r.key);
    return NextResponse.json({
      restaurantName: x.restaurant.name, customer: maskKey(x.r.key), kind: x.r.kind, status: x.r.status,
      stamps: card?.stamps ?? 0, total: x.program.total, reward: x.program.reward, allowed: x.allowed,
    });
  } catch (error) {
    console.error("[GET /api/stamp/[code]]", error);
    return NextResponse.json({ error: "Could not load the code" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const x = await load(req, params);
    if ("error" in x) return x.error;
    if (!x.allowed) return NextResponse.json({ error: "You are not allowed to give stamps. Ask the manager to allow it." }, { status: 403 });
    if (!x.program.enabled) return NextResponse.json({ error: "The loyalty card is turned off." }, { status: 400 });
    const result = await approveRequest(x.r, x.session.id, x.program);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ stamps: result.card.stamps, total: x.program.total, kind: x.r.kind, reward: x.program.reward });
  } catch (error) {
    console.error("[POST /api/stamp/[code]]", error);
    return NextResponse.json({ error: "Could not confirm. Please try again." }, { status: 500 });
  }
}
