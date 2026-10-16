import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { forbidUnless } from "@/lib/staff-access";
import { logAction } from "@/lib/action-log";
import { loadFloorPlan } from "@/lib/floor-plan-store";
import { createBlock, deleteBlock, listBlocks } from "@/lib/reservations";

// Blocked tables (needs "Reservations"): tables customers can't reserve for a time.
// GET -> { blocks, tables: [{ id, label, seats, areaName }] }   (tables of the normal and the scheduled plans)
// POST { tableIds: [...] | "all", from, until, reason? }
// DELETE ?id=...

type Params = { params: Promise<{ id: string }> };

async function load(req: NextRequest, params: Params["params"]) {
  const session = await getSessionFromRequest(req);
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { id } = await params;
  const r = await prisma.restaurant.findFirst({ where: { OR: [{ id }, { slug: id }] }, select: { id: true, ownerId: true } });
  if (!r) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  const denied = await forbidUnless(session, r, "reservations.manage");
  if (denied) return { error: denied };
  return { session, restaurant: r };
}

async function allTables(restaurantId: string) {
  const f = await loadFloorPlan(restaurantId);
  const seen = new Map<string, { id: string; label: string; seats: number; areaName: string }>();
  for (const plan of f ? [f.plan, ...f.schedules.map((s) => s.plan)] : []) {
    for (const a of plan.areas) for (const o of a.objects) if (o.type === "table" && !seen.has(o.id)) seen.set(o.id, { id: o.id, label: o.label || "Table", seats: o.seats ?? 1, areaName: a.name });
  }
  return [...seen.values()];
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const x = await load(req, params);
    if ("error" in x) return x.error;
    return NextResponse.json({ blocks: await listBlocks(x.restaurant.id), tables: await allTables(x.restaurant.id) });
  } catch (error) {
    console.error("[GET table-blocks]", error);
    return NextResponse.json({ error: "Could not load" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const x = await load(req, params);
    if ("error" in x) return x.error;
    const body = await req.json().catch(() => null);
    const from = typeof body?.from === "string" ? Date.parse(body.from) : NaN, until = typeof body?.until === "string" ? Date.parse(body.until) : NaN;
    if (!Number.isFinite(from) || !Number.isFinite(until)) return NextResponse.json({ error: "Please choose from when until when." }, { status: 400 });
    if (until <= from) return NextResponse.json({ error: "The end must be after the start." }, { status: 400 });
    const tables = await allTables(x.restaurant.id);
    const ids = body?.tableIds === "all" ? "all" : Array.isArray(body?.tableIds) ? body.tableIds.filter((i: unknown) => typeof i === "string" && tables.some((t) => t.id === i)) : [];
    if (ids !== "all" && !ids.length) return NextResponse.json({ error: "Please choose the tables." }, { status: 400 });
    const labels = ids === "all" ? ["All tables"] : tables.filter((t) => ids.includes(t.id)).map((t) => t.label);
    const user = await prisma.user.findFirst({ where: { id: x.session.id }, select: { name: true, email: true } });
    const reason = typeof body?.reason === "string" ? body.reason.replace(/\s+/g, " ").trim().slice(0, 120) : "";
    const block = await createBlock(x.restaurant.id, { tableIds: ids, labels, from: new Date(from).toISOString(), until: new Date(until).toISOString(), reason, by: user?.name || user?.email || null });
    await logAction(x.session, x.restaurant, "reservation.block", `Blocked ${ids === "all" ? "all tables" : `table${labels.length === 1 ? "" : "s"} ${labels.join(", ")}`} for reservations`,
      [`From {{t:${block.from}}}`, `Until {{t:${block.until}}}`, ...(reason ? [`Reason: ${reason}`] : [])]);
    return NextResponse.json({ success: true, block }, { status: 201 });
  } catch (error) {
    console.error("[POST table-blocks]", error);
    return NextResponse.json({ error: "Could not block the tables" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const x = await load(req, params);
    if ("error" in x) return x.error;
    const id = req.nextUrl.searchParams.get("id") ?? "";
    const b = (await listBlocks(x.restaurant.id)).find((v) => v.id === id);
    if (!b) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await deleteBlock(x.restaurant.id, id);
    await logAction(x.session, x.restaurant, "reservation.block", `Unblocked ${b.tableIds === "all" ? "all tables" : `table${b.labels.length === 1 ? "" : "s"} ${b.labels.join(", ")}`}`, [`It was from {{t:${b.from}}} until {{t:${b.until}}}`]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE table-blocks]", error);
    return NextResponse.json({ error: "Could not unblock" }, { status: 500 });
  }
}
