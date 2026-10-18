import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { cardStats, loadProgram, loadReceiptPhotos, loadStampWaiters, saveReceiptPhotos, saveStampWaiters } from "@/lib/loyalty";
import { forbidUnless } from "@/lib/staff-access";
import type { Permission } from "@/lib/permissions";
import { logAction } from "@/lib/action-log";

// Loyalty program settings (owner only). Customers use /loyalty-card, waiters /api/stamp/[code].
// GET -> { program: { enabled, total, reward }, stats, stampWaiters: [userId] }
// PUT { enabled?, stamps?, reward?, stampWaiters? }

type Params = { params: Promise<{ id: string }> };

async function loadOwned(req: NextRequest, params: Params["params"], need: Permission | Permission[]) {
  const session = await getSessionFromRequest(req);
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { id } = await params;
  const program = await loadProgram(id);
  if (!program) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  { const denied = await forbidUnless(session, { id: program.restaurantId, ownerId: program.ownerId }, need); if (denied) return { error: denied }; }
  return { program, session };
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const auth = await loadOwned(req, params, "loyalty.settings");
    if (auth.error) return auth.error;
    const p = auth.program;
    return NextResponse.json({
      program: { enabled: p.enabled, total: p.total, reward: p.reward },
      stats: await cardStats(p.restaurantId),
      stampWaiters: await loadStampWaiters(p.restaurantId),
      receiptPhotos: await loadReceiptPhotos(p.restaurantId),
    });
  } catch (error) {
    console.error("[GET /api/restaurants/[id]/loyalty]", error);
    return NextResponse.json({ error: "Could not load the loyalty program" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const auth = await loadOwned(req, params, "loyalty.settings");
    if (auth.error) return auth.error;
    const p = auth.program;
    const body = await req.json().catch(() => null) as { enabled?: boolean; stamps?: number; reward?: string; stampWaiters?: unknown; receiptPhotos?: boolean } | null;
    if (!body) return NextResponse.json({ error: "Nothing to save" }, { status: 400 });

    const data: Record<string, unknown> = {};
    if (typeof body.enabled === "boolean") data.loyaltyEnabled = body.enabled;
    if (body.stamps !== undefined) {
      const n = Math.round(Number(body.stamps));
      if (!Number.isFinite(n) || n < 2 || n > 50) return NextResponse.json({ error: "Stamps needed must be between 2 and 50." }, { status: 400 });
      data.loyaltyStamps = n;
    }
    if (typeof body.reward === "string") data.loyaltyReward = body.reward.trim().slice(0, 80) || "Free item";
    if (Object.keys(data).length) await prisma.restaurant.update({ where: { id: p.restaurantId }, data });

    if (Array.isArray(body.stampWaiters)) {
      // Only this restaurant's waiters
      const waiters = await prisma.user.findMany({ where: { staffRestaurantId: p.restaurantId, role: "WAITER" }, select: { id: true } });
      const valid = new Set(waiters.map((w: { id: string }) => w.id));
      await saveStampWaiters(p.restaurantId, body.stampWaiters.filter((x): x is string => typeof x === "string" && valid.has(x)));
    }
    const changes: string[] = [];
    if (typeof body.receiptPhotos === "boolean") {
      const before = await loadReceiptPhotos(p.restaurantId);
      if (before !== body.receiptPhotos) {
        await saveReceiptPhotos(p.restaurantId, body.receiptPhotos);
        changes.push(body.receiptPhotos ? "Customers can send a photo of their receipt now" : "Customers can't send receipt photos anymore");
      }
    }
    if (data.loyaltyEnabled !== undefined && data.loyaltyEnabled !== p.enabled) changes.push(data.loyaltyEnabled ? "Turned the loyalty card on" : "Turned the loyalty card off");
    if (data.loyaltyStamps !== undefined && data.loyaltyStamps !== p.total) changes.push(`Stamps needed: ${p.total} → ${data.loyaltyStamps}`);
    if (data.loyaltyReward !== undefined && data.loyaltyReward !== p.reward) changes.push(`Reward: "${p.reward}" → "${data.loyaltyReward}"`);
    if (changes.length) await logAction(auth.session, { id: p.restaurantId, ownerId: p.ownerId }, "loyalty.settings", changes.length === 1 ? changes[0] : "Changed the loyalty card", changes.length === 1 ? [] : changes);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PUT /api/restaurants/[id]/loyalty]", error);
    return NextResponse.json({ error: "Could not save the loyalty program" }, { status: 500 });
  }
}
