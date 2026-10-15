import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listBookMenus } from "@/lib/menu-history";
import { applyDueSchedules, createSchedule, deleteSchedule, listSchedules, scheduleStatus, updateSchedule } from "@/lib/menu-schedule";
import { forbidUnless } from "@/lib/staff-access";
import type { Permission } from "@/lib/permissions";

// Scheduled menus (owner only). See lib/menu-schedule.ts.
// GET                                  -> { schedules: [...with title and status], now }
// POST   { menuId, startAt, endAt? }   -> schedule a saved menu (times are ISO strings, endAt optional)
// PATCH  { id, startAt, endAt? }       -> change the times
// DELETE ?id=...                       -> cancel

type Params = { params: Promise<{ id: string }> };

async function loadOwned(req: NextRequest, params: Params["params"], need: Permission | Permission[]) {
  const session = await getSessionFromRequest(req);
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { id } = await params;
  const r = await prisma.restaurant.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    select: { id: true, name: true, ownerId: true, menuPdfUrl: true, menuPdfName: true, primaryMenu: true, updatedAt: true },
  });
  if (!r) return { error: NextResponse.json({ error: "Restaurant not found" }, { status: 404 }) };
  { const denied = await forbidUnless(session, r, need); if (denied) return { error: denied }; }
  return { restaurant: r };
}

/** Checks the times: start is a valid date, the optional end is after the start and still to come */
function readTimes(body: Record<string, unknown> | null): { startAt: string; endAt: string | null } | { error: string } {
  const start = typeof body?.startAt === "string" ? Date.parse(body.startAt) : NaN;
  if (!Number.isFinite(start)) return { error: "Please choose when the menu starts." };
  const endRaw = body?.endAt;
  if (endRaw === null || endRaw === undefined || endRaw === "") return { startAt: new Date(start).toISOString(), endAt: null };
  const end = typeof endRaw === "string" ? Date.parse(endRaw) : NaN;
  if (!Number.isFinite(end)) return { error: "The end time is not valid." };
  if (end <= start) return { error: "The end time must be after the start time." };
  if (end <= Date.now()) return { error: "The end time is already over." };
  return { startAt: new Date(start).toISOString(), endAt: new Date(end).toISOString() };
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const auth = await loadOwned(req, params, ["schedule.manage", "menu.edit", "menu.live"]);
    if (auth.error) return auth.error;
    const r = auth.restaurant;
    const schedules = await listSchedules(r.id);
    const now = await applyDueSchedules(r, schedules);
    const titles = new Map((await listBookMenus(r.id)).map((m) => [m.menuId, m.title]));
    // Read again: applying marks schedules as done
    const fresh = await listSchedules(r.id);
    return NextResponse.json({
      now: new Date().toISOString(),
      liveMenuPdfUrl: now.menuPdfUrl,
      // A schedule just made a menu active (the page should reload what's live)
      applied: now !== r,
      schedules: fresh.map((s) => ({ ...s, title: titles.get(s.menuId) ?? null, status: scheduleStatus(s) })),
    });
  } catch (error) {
    console.error("[GET /api/restaurants/[id]/menu-schedule]", error);
    return NextResponse.json({ error: "Could not load the scheduled menus" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const auth = await loadOwned(req, params, "schedule.manage");
    if (auth.error) return auth.error;
    const body = await req.json().catch(() => null);
    const menuId = typeof body?.menuId === "string" ? body.menuId : "";
    if (!(await listBookMenus(auth.restaurant.id)).some((m) => m.menuId === menuId)) {
      return NextResponse.json({ error: "That menu was not found." }, { status: 404 });
    }
    const times = readTimes(body);
    if ("error" in times) return NextResponse.json({ error: times.error }, { status: 400 });
    const id = await createSchedule(auth.restaurant.id, { menuId, ...times });
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("[POST /api/restaurants/[id]/menu-schedule]", error);
    return NextResponse.json({ error: "Could not schedule the menu" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const auth = await loadOwned(req, params, "schedule.manage");
    if (auth.error) return auth.error;
    const body = await req.json().catch(() => null);
    const existing = (await listSchedules(auth.restaurant.id)).find((s) => s.id === body?.id);
    if (!existing) return NextResponse.json({ error: "That schedule was not found." }, { status: 404 });
    const times = readTimes(body);
    if ("error" in times) return NextResponse.json({ error: times.error }, { status: 400 });
    await updateSchedule(auth.restaurant.id, existing.id, { menuId: existing.menuId, ...times });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PATCH /api/restaurants/[id]/menu-schedule]", error);
    return NextResponse.json({ error: "Could not change the schedule" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const auth = await loadOwned(req, params, "schedule.manage");
    if (auth.error) return auth.error;
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    await deleteSchedule(auth.restaurant.id, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/restaurants/[id]/menu-schedule]", error);
    return NextResponse.json({ error: "Could not cancel the schedule" }, { status: 500 });
  }
}
