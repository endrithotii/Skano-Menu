import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { forbidUnless } from "@/lib/staff-access";
import { logAction } from "@/lib/action-log";
import { loadFloorPlan, saveFloor } from "@/lib/floor-plan-store";
import { LIMITS, planStats, sanitizePlan, type FloorObject, type FloorPlan } from "@/lib/floor-plan";

// Floor plan & tables (needs "Floor plan and tables"). See lib/floor-plan.ts.
// GET -> { plan | null, schedules, updatedAt }
// PUT { plan, scheduleId? }, POST/PATCH/DELETE scheduled changes (see below)

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
  speaker: ["speaker", "speakers"], stairs: ["stairs", "stairs"], ramp: ["wheelchair ramp", "wheelchair ramps"], lift: ["lift", "lifts"],
};

/** "2 photos and 1 360° photo" */
const photoCount = (p: { kind: string }[] | undefined) => {
  const n = (p ?? []).filter((x) => x.kind === "photo").length, m = (p ?? []).filter((x) => x.kind === "360").length;
  return [n ? `${n} photo${n === 1 ? "" : "s"}` : "", m ? `${m} 360° photo${m === 1 ? "" : "s"}` : ""].filter(Boolean).join(" and ") || "none";
};
const samePhotos = (a: { url: string }[] | undefined, b: { url: string }[] | undefined) => JSON.stringify((a ?? []).map((x) => x.url)) === JSON.stringify((b ?? []).map((x) => x.url));
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
    if (!samePhotos(o.photos, a.photos)) out.push(`"${a.name}" photos: ${photoCount(o.photos)} → ${photoCount(a.photos)}`);
  }
  for (const o of before?.areas ?? []) if (!after.areas.some((a) => a.id === o.id)) out.push(`Deleted the area "${o.name}" (${o.objects.filter((x) => x.type === "table").length} tables)`);

  const where = (plan: FloorPlan | null) => new Map((plan?.areas ?? []).flatMap((a) => a.objects.map((x) => [x.id, { o: x, area: a.name }] as const)));
  const was = where(before), now = where(after);
  for (const [id, { o, area }] of now) {
    const b = was.get(id);
    if (o.type === "table") {
      if (!b) { out.push(`Added ${tableName(o)} in "${area}": ${o.seats} seats, ${SHAPES[o.shape ?? "square"]}${o.accessible ? ", wheelchair accessible" : ""}${o.photos?.length ? `, ${photoCount(o.photos)}` : ""}`); continue; }
      const t = b.o, name = tableName(o);
      if ((t.label ?? "") !== (o.label ?? "")) out.push(`Renamed ${tableName(t)} to ${o.label ? o.label : "no number"}`);
      if (t.seats !== o.seats) out.push(`${name}: ${t.seats} → ${o.seats} seats`);
      if (t.shape !== o.shape) out.push(`${name}: ${SHAPES[t.shape ?? "square"]} → ${SHAPES[o.shape ?? "square"]}`);
      if (b.area !== area) out.push(`${name}: moved from "${b.area}" to "${area}"`);
      else if (Math.hypot(t.x - o.x, t.y - o.y) >= 0.05 || t.rotation !== o.rotation) out.push(`${name}: moved`);
      if (t.w !== o.w || t.h !== o.h) out.push(`${name}: size ${t.w} x ${t.h} m → ${o.w} x ${o.h} m`);
      if ((t.reservable !== false) !== (o.reservable !== false)) out.push(`${name}: ${o.reservable === false ? "can't be reserved now" : "can be reserved now"}`);
      if ((t.minGuests ?? 1) !== (o.minGuests ?? 1)) out.push(`${name}: reserved for at least ${t.minGuests ?? 1} → ${o.minGuests ?? 1} persons`);
      if (!!t.accessible !== !!o.accessible) out.push(`${name}: ${o.accessible ? "wheelchair accessible now" : "not marked wheelchair accessible anymore"}`);
      if (!samePhotos(t.photos, o.photos)) out.push(`${name} view photos: ${photoCount(t.photos)} → ${photoCount(o.photos)}`);
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

const tz = (iso: string | null) => (iso ? `{{t:${iso}}}` : "no end");

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const x = await load(req, params);
    if ("error" in x) return x.error;
    const saved = await loadFloorPlan(x.restaurant.id);
    return NextResponse.json({ plan: saved?.plan ?? null, schedules: saved?.schedules ?? [], updatedAt: saved?.updatedAt ?? null });
  } catch (error) {
    console.error("[GET floor-plan]", error);
    return NextResponse.json({ error: "Could not load the floor plan" }, { status: 500 });
  }
}

/** Start and end from the dashboard (ISO), end optional and after the start */
function readTimes(body: Record<string, unknown> | null): { startAt: string; endAt: string | null } | { error: string } {
  const start = typeof body?.startAt === "string" ? Date.parse(body.startAt) : NaN;
  if (!Number.isFinite(start)) return { error: "Please choose when the change starts." };
  const endRaw = body?.endAt;
  if (endRaw === null || endRaw === undefined || endRaw === "") return { startAt: new Date(start).toISOString(), endAt: null };
  const end = typeof endRaw === "string" ? Date.parse(endRaw) : NaN;
  if (!Number.isFinite(end) || end <= start) return { error: "The end must be after the start." };
  return { startAt: new Date(start).toISOString(), endAt: new Date(end).toISOString() };
}

// PUT { plan, scheduleId? } -> saves the normal plan, or the plan of a scheduled change
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const x = await load(req, params);
    if ("error" in x) return x.error;
    const body = await req.json().catch(() => null);
    const plan = sanitizePlan(body?.plan);
    if (!plan.areas.length) return NextResponse.json({ error: "The plan needs at least one area." }, { status: 400 });
    if (plan.areas.some((a) => a.objects.length >= LIMITS.objects)) return NextResponse.json({ error: `An area can have at most ${LIMITS.objects} things.` }, { status: 400 });
    const saved = await loadFloorPlan(x.restaurant.id);
    const scheduleId = typeof body?.scheduleId === "string" ? body.scheduleId : null;
    const schedules = saved?.schedules ?? [];
    let before: FloorPlan | null;
    let base = saved?.plan ?? null;
    let label = "the floor plan";
    if (scheduleId) {
      const s = schedules.find((v) => v.id === scheduleId);
      if (!s || !base) return NextResponse.json({ error: "That scheduled change was not found." }, { status: 404 });
      before = s.plan; s.plan = plan; label = `the scheduled plan "${s.name}"`;
    } else {
      before = base; base = plan;
    }
    const updatedAt = await saveFloor(x.restaurant.id, base!, schedules);
    const lines = changes(before, plan);
    if (lines.length) {
      const st = planStats(plan);
      await logAction(x.session, x.restaurant, "floor.edit",
        `${before ? "Changed" : "Made"} ${label}: ${st.tables} table${st.tables === 1 ? "" : "s"}, ${st.seats} seats`, lines);
    }
    return NextResponse.json({ success: true, plan, schedules, updatedAt });
  } catch (error) {
    console.error("[PUT floor-plan]", error);
    return NextResponse.json({ error: "Could not save the floor plan" }, { status: 500 });
  }
}

// POST { name, startAt, endAt?, plan } -> schedule a change of the floor plan
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const x = await load(req, params);
    if ("error" in x) return x.error;
    const body = await req.json().catch(() => null);
    const saved = await loadFloorPlan(x.restaurant.id);
    if (!saved) return NextResponse.json({ error: "Save your floor plan first." }, { status: 400 });
    const times = readTimes(body);
    if ("error" in times) return NextResponse.json({ error: times.error }, { status: 400 });
    if (saved.schedules.length >= 20) return NextResponse.json({ error: "You can have at most 20 scheduled changes." }, { status: 400 });
    const plan = sanitizePlan(body?.plan);
    if (!plan.areas.length) return NextResponse.json({ error: "The plan needs at least one area." }, { status: 400 });
    const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim().slice(0, 60) : "Scheduled plan";
    const s = { id: `s_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name, ...times, plan };
    const schedules = [...saved.schedules, s];
    await saveFloor(x.restaurant.id, saved.plan, schedules);
    await logAction(x.session, x.restaurant, "floor.schedule", `Scheduled a change of the floor plan: "${name}"`, [`From ${tz(times.startAt)}`, `Until ${tz(times.endAt)}`]);
    return NextResponse.json({ success: true, schedule: s, schedules });
  } catch (error) {
    console.error("[POST floor-plan]", error);
    return NextResponse.json({ error: "Could not schedule the change" }, { status: 500 });
  }
}

// PATCH { id, name, startAt, endAt? } -> change the name or the times of a scheduled change
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const x = await load(req, params);
    if ("error" in x) return x.error;
    const body = await req.json().catch(() => null);
    const saved = await loadFloorPlan(x.restaurant.id);
    const s = saved?.schedules.find((v) => v.id === body?.id);
    if (!saved || !s) return NextResponse.json({ error: "That scheduled change was not found." }, { status: 404 });
    const times = readTimes(body);
    if ("error" in times) return NextResponse.json({ error: times.error }, { status: 400 });
    const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim().slice(0, 60) : s.name;
    const lines: string[] = [];
    if (name !== s.name) lines.push(`Name: "${s.name}" → "${name}"`);
    if (times.startAt !== s.startAt) lines.push(`Start: ${tz(s.startAt)} → ${tz(times.startAt)}`);
    if (times.endAt !== s.endAt) lines.push(`End: ${tz(s.endAt)} → ${tz(times.endAt)}`);
    Object.assign(s, { name, ...times });
    await saveFloor(x.restaurant.id, saved.plan, saved.schedules);
    if (lines.length) await logAction(x.session, x.restaurant, "floor.schedule", `Changed the scheduled plan "${name}"`, lines);
    return NextResponse.json({ success: true, schedules: saved.schedules });
  } catch (error) {
    console.error("[PATCH floor-plan]", error);
    return NextResponse.json({ error: "Could not change the schedule" }, { status: 500 });
  }
}

// DELETE ?scheduleId=... -> remove a scheduled change
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const x = await load(req, params);
    if ("error" in x) return x.error;
    const id = req.nextUrl.searchParams.get("scheduleId");
    const saved = await loadFloorPlan(x.restaurant.id);
    const s = saved?.schedules.find((v) => v.id === id);
    if (!saved || !s) return NextResponse.json({ error: "That scheduled change was not found." }, { status: 404 });
    const schedules = saved.schedules.filter((v) => v.id !== id);
    await saveFloor(x.restaurant.id, saved.plan, schedules);
    await logAction(x.session, x.restaurant, "floor.schedule", `Deleted the scheduled plan "${s.name}"`, [`It was from ${tz(s.startAt)} until ${tz(s.endAt)}`]);
    return NextResponse.json({ success: true, schedules });
  } catch (error) {
    console.error("[DELETE floor-plan]", error);
    return NextResponse.json({ error: "Could not delete" }, { status: 500 });
  }
}
