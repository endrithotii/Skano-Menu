import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { accessFor, loadStaffAccess } from "@/lib/staff-access";

// What the signed-in person may do in the dashboard (Staff & roles)
// GET -> { restaurantId, owner, staff, permissions: [...], roleName }
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findFirst({ where: { id: session.id }, select: { staffRestaurantId: true } });
  const r = (await prisma.restaurant.findFirst({ where: { ownerId: session.id }, select: { id: true, ownerId: true } }))
    ?? (user?.staffRestaurantId ? await prisma.restaurant.findFirst({ where: { id: user.staffRestaurantId }, select: { id: true, ownerId: true } }) : null);
  if (!r) return NextResponse.json({ restaurantId: null, owner: false, staff: false, permissions: [] });
  const a = await accessFor(session, r);
  let roleName: string | null = null;
  if (a.staff) {
    const access = await loadStaffAccess(r.id);
    roleName = access.roles.find((x) => x.id === access.members[session.id]?.roleId)?.name ?? null;
  }
  return NextResponse.json({ restaurantId: r.id, owner: a.owner, staff: a.staff, permissions: [...a.permissions], roleName });
}
