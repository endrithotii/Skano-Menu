import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { forbidUnless } from "@/lib/staff-access";
import { logAction } from "@/lib/action-log";

type Params = { params: Promise<{ id: string; feedbackId: string }> };

// POST — manager replies to a feedback
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, feedbackId } = await params;
  const restaurant = await prisma.restaurant.findFirst({
    where: { OR: [{ id }, { slug: id }] }, select: { id: true, ownerId: true },
  });
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });
  { const denied = await forbidUnless(session, restaurant, "feedback.manage"); if (denied) return denied; }

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
  const f = feedback as unknown as { customerName?: string | null; rating?: number };
  await logAction(session, restaurant, "feedback.reply", `Answered the feedback of ${f.customerName || "a customer"}${f.rating ? ` (${f.rating} stars)` : ""}`, [`"${reply.trim()}"`]);

  return NextResponse.json({ success: true });
}

// DELETE — remove reply
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, feedbackId } = await params;
  const restaurant = await prisma.restaurant.findFirst({
    where: { OR: [{ id }, { slug: id }] }, select: { id: true, ownerId: true },
  });
  if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });
  { const denied = await forbidUnless(session, restaurant, "feedback.manage"); if (denied) return denied; }

  await (prisma as any).$executeRawUnsafe(
    `DELETE FROM "FeedbackReply" WHERE "feedbackId" = ?`, feedbackId
  );
  await logAction(session, restaurant, "feedback.reply", "Removed the answer to a feedback");
  return NextResponse.json({ success: true });
}
