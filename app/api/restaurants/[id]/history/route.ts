import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { STAFF_ROLES, forbidUnless, loadStaffAccess } from "@/lib/staff-access";
import { listActions } from "@/lib/action-log";
import { isActionType } from "@/lib/action-log-types";

// Action history (needs "See the action history"). See lib/action-log.ts.
// GET ?roles=owner,chef&users=<id>,<id>&actions=dish.price,menu.delete&from=ISO&until=ISO&before=ISO
//   -> { entries, more, roles: [{ id, name }], people: [{ id, name, email }] }

type Params = { params: Promise<{ id: string }> };

const list = (v: string | null) => (v ? v.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 50) : []);
const time = (v: string | null) => (v && Number.isFinite(Date.parse(v)) ? new Date(v) : null);

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const r = await prisma.restaurant.findFirst({ where: { OR: [{ id }, { slug: id }] }, select: { id: true, ownerId: true } });
    if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const denied = await forbidUnless(session, r, "history.view");
    if (denied) return denied;

    const q = req.nextUrl.searchParams;
    const { entries, more } = await listActions(r.id, {
      roles: list(q.get("roles")),
      users: list(q.get("users")),
      actions: list(q.get("actions")).filter(isActionType),
      from: time(q.get("from")),
      until: time(q.get("until")),
    }, time(q.get("before")), 50);

    // For the filters: the roles and the people (owner and staff)
    const access = await loadStaffAccess(r.id);
    const owner: { id: string; name: string | null; email: string } | null = await prisma.user.findFirst({ where: { id: r.ownerId }, select: { id: true, name: true, email: true } });
    const staff: { id: string; name: string | null; email: string }[] = await prisma.user.findMany({
      where: { staffRestaurantId: r.id, role: { in: STAFF_ROLES } }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" },
    });
    return NextResponse.json({
      entries, more,
      roles: [{ id: "owner", name: "Owner" }, ...access.roles.map((x) => ({ id: x.id, name: x.name }))],
      people: [...(owner ? [{ id: owner.id, name: owner.name || owner.email, email: owner.email, owner: true }] : []), ...staff.map((u) => ({ id: u.id, name: u.name || u.email, email: u.email }))],
    });
  } catch (error) {
    console.error("[GET /api/restaurants/[id]/history]", error);
    return NextResponse.json({ error: "Could not load the history" }, { status: 500 });
  }
}
