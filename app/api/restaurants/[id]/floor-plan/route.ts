import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { forbidUnless } from "@/lib/staff-access";
import { logAction } from "@/lib/action-log";
import { loadFloorPlan, saveFloorPlan } from "@/lib/floor-plan-store";
import { LIMITS, planStats, sanitizePlan, type FloorObject, type FloorPlan } from "@/lib/floor-plan";

// Floor plan & tables (needs "Floor plan and tables"). See lib/floor-plan.ts.
// GET -> { plan | null, updatedAt }
// PUT { plan } -> saves it

type Params = { params: Promise<{ id: string }> };

async function load(req: NextRequest, params: Params["params"]) {
  const session = await getSessionFromRequest(req);
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { id } = await params;
  const r = await prisma.restaurant.findFirst({ where: { OR: [{ id }, { slug: id }] }, select: { id: true, ownerId: true } });
  if (!r) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  const denied = await forbidUnless(session, r, "floor.edit");
  if (denied) return { error: denied };
  return { session, restaurant: r };
}

const NAMES: Record<string, [string, string]> = {
  wall: ["wall", "walls"], window: ["window", "windows"], door: ["door", "doors"], plant: ["plant", "plants"], room: ["room", "rooms"],
  text: ["text", "texts"], bar: ["bar counter", "bar counters"], pillar: ["pillar", "pillars"],
};
const tableName = (o: FloorObject) => (o.label ? `Table ${o.label}` : "A table without a number");
const SHAPES = { round: "round", square: "square", rect: "long" } as const;

/** What changed, as lines for the action history: tables one by one, the rest counted */
function changes(before: FloorPlan | null, after: FloorPlan): string[] {
  const out: string[] = [];
  const oldAreas = new Map((before?.areas ?? []).map((a) => [a.id, a]));
  for (const a of after.areas) {
    const o = oldAreas.get(a.id);
    if (!o) { out.push(`Added the area "${a.name}" (${a.width} x ${a.height} m)`); continue; }
    if (o.name !== a.name) out.push(`Renamed the area "${o.name}" to "${a.name}"`);
    if (o.width !== a.width || o.height !== a.height) out.push(`"${a.name}": size ${o.width} x ${o.height} m → ${a.width} x ${a.height} m`);
  }
  for (const o of before?.areas ?? []) if (!after.areas.some((a) => a.id === o.id)) out.push(`Deleted the area "${o.name}" (${o.objects.filter((x) => x.type === "table").length} tables)`);

  const where = (plan: FloorPlan | null) => new Map((plan?.areas ?? []).flatMap((a) => a.objects.map((x) => [x.id, { o: x, area: a.name }] as const)));
  const was = where(before), now = where(after);
  for (const [id, { o, area }] of now) {
    const b = was.get(id);
    if (o.type === "table") {
      if (!b) { out.push(`Added ${tableName(o)} in "${area}": ${o.seats} seats, ${SHAPES[o.shape ?? "square"]}`); continue; }
      const t = b.o, name = tableName(o);
      if ((t.label ?? "") !== (o.label ?? "")) out.push(`Renamed ${tableName(t)} to ${o.label ? o.label : "no number"}`);
      if (t.seats !== o.seats) out.push(`${name}: ${t.seats} → ${o.seats} seats`);
      if (t.shape !== o.shape) out.push(`${name}: ${SHAPES[t.shape ?? "square"]} → ${SHAPES[o.shape ?? "square"]}`);
      if (b.area !== area) out.push(`${name}: moved from "${b.area}" to "${area}"`);
      else if (Math.hypot(t.x - o.x, t.y - o.y) >= 0.05 || t.rotation !== o.rotation) out.push(`${name}: moved`);
      if (t.w !== o.w || t.h !== o.h) out.push(`${name}: size ${t.w} x ${t.h} m → ${o.w} x ${o.h} m`);
    } else if (o.type === "room" || o.type === "text") {
      if (b && (b.o.label ?? "") !== (o.label ?? "")) out.push(`${o.type === "room" ? "Room" : "Text"} "${b.o.label ?? ""}" renamed to "${o.label ?? ""}"`);
      else if (!b) out.push(`Added the ${o.type === "room" ? "room" : "text"} "${o.label ?? ""}" in "${area}"`);
    }
  }
  for (const [id, { o, area }] of was) {
    if (now.has(id)) continue;
    if (o.type === "table") out.push(`Removed ${tableName(o)} from "${area}" (${o.seats} seats)`);
    else if (o.type === "room" || o.type === "text") out.push(`Removed the ${o.type === "room" ? "room" : "text"} "${o.label ?? ""}" from "${area}"`);
  }
  // Walls, windows, doors...: counted per kind
  for (const type of Object.keys(NAMES)) {
    if (type === "room" || type === "text") continue;
    const added = [...now].filter(([id, v]) => v.o.type === type && !was.has(id)).length;
    const removed = [...was].filter(([id, v]) => v.o.type === type && !now.has(id)).length;
    const changed = [...now].filter(([id, v]) => {
      const b = was.get(id);
      return v.o.type === type && b && (b.o.x !== v.o.x || b.o.y !== v.o.y || b.o.w !== v.o.w || b.o.h !== v.o.h || b.o.rotation !== v.o.rotation || (b.o.label ?? "") !== (v.o.label ?? ""));
    }).length;
    const [one, many] = NAMES[type];
    if (added) out.push(`Added ${added} ${added === 1 ? one : many}`);
    if (removed) out.push(`Removed ${removed} ${removed === 1 ? one : many}`);
    if (changed) out.push(`Moved or changed ${changed} ${changed === 1 ? one : many}`);
  }
  return out;
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const x = await load(req, params);
    if ("error" in x) return x.error;
    const saved = await loadFloorPlan(x.restaurant.id);
    return NextResponse.json({ plan: saved?.plan ?? null, updatedAt: saved?.updatedAt ?? null });
  } catch (error) {
    console.error("[GET floor-plan]", error);
    return NextResponse.json({ error: "Could not load the floor plan" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const x = await load(req, params);
    if ("error" in x) return x.error;
    const body = await req.json().catch(() => null);
    const plan = sanitizePlan(body?.plan);
    if (!plan.areas.length) return NextResponse.json({ error: "The plan needs at least one area." }, { status: 400 });
    if (plan.areas.some((a) => a.objects.length >= LIMITS.objects)) return NextResponse.json({ error: `An area can have at most ${LIMITS.objects} things.` }, { status: 400 });
    const before = (await loadFloorPlan(x.restaurant.id))?.plan ?? null;
    const updatedAt = await saveFloorPlan(x.restaurant.id, plan);
    const lines = changes(before, plan);
    if (lines.length) {
      const s = planStats(plan);
      await logAction(x.session, x.restaurant, "floor.edit",
        `${before ? "Changed" : "Made"} the floor plan: ${s.tables} table${s.tables === 1 ? "" : "s"}, ${s.seats} seats`, lines);
    }
    return NextResponse.json({ success: true, plan, updatedAt });
  } catch (error) {
    console.error("[PUT floor-plan]", error);
    return NextResponse.json({ error: "Could not save the floor plan" }, { status: 500 });
  }
}
