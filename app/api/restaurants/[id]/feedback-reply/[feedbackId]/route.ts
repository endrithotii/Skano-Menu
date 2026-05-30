import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";

type Params = { params: Promise<{ id: string; feedbackId: string }> };

// POST — manager replies to a feedback
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, feedbackId } = await params;
  const restaurant = await prisma.restaurant.findFirst({
    where: { OR: [{ id }, { slug: id }], ownerId: session.id }, select: { id: true },
  });
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Verify feedback belongs to this restaurant
  const feedback = await prisma.feedback.findFirst({ where: { id: feedbackId, restaurantId: restaurant.id } });
  if (!feedback) return NextResponse.json({ error: "Feedback not found" }, { status: 404 });

  const { reply } = await req.json() as { reply: string };
  if (!reply?.trim()) return NextResponse.json({ error: "Reply text required" }, { status: 400 });

  const replyId = `rep_${Date.now()}`;
  await (prisma as any).$executeRawUnsafe(
    `INSERT INTO "FeedbackReply" ("id","feedbackId","reply","createdAt") VALUES (?,?,?,datetime('now'))
     ON CONFLICT("feedbackId") DO UPDATE SET "reply" = excluded."reply"`,
    replyId, feedbackId, reply.trim()
  );

  return NextResponse.json({ success: true });
}

// DELETE — remove reply
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, feedbackId } = await params;
  const restaurant = await prisma.restaurant.findFirst({
    where: { OR: [{ id }, { slug: id }], ownerId: session.id }, select: { id: true },
  });
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await (prisma as any).$executeRawUnsafe(
    `DELETE FROM "FeedbackReply" WHERE "feedbackId" = ?`, feedbackId
  );
  return NextResponse.json({ success: true });
}
