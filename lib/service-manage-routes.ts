import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { accessFor } from "@/lib/staff-access";
import { logAction } from "@/lib/action-log";
import { DEFAULT_STYLE, sanitizeStyle, type QrStyle } from "@/lib/qr-style";
import { KINDS, MAX_ROOMS, nextStatus, statusLabel, sanitizeRoomSettings, type OrderStatus, type ServiceKind } from "@/lib/room-service-types";
import { loadFloorPlan } from "@/lib/floor-plan-store";
import { getOrder, listOrders, loadRoomSettings, newRoomId, orderableDishes, saveRoomSettings, updateOrder } from "@/lib/room-service";

// Room service and Table ordering for staff. app/api/restaurants/[id]/room-service/manage and .../table-service/manage use these.
// GET ?days=3 -> { canOrders, canManage, orders, settings, baseStyle, slug, currency, dishCount }
// POST { action: "status", id, status, reason? }                       "Room service orders"
// POST { action: "settings", settings } | "rooms-add" { names } | "room-rename" { id, name } | "room-delete" { id }   "Room service settings"

type Params = { params: Promise<{ id: string }> };
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export function manageRoutes(kind: ServiceKind) {
const K = KINDS[kind];

async function load(req: NextRequest, params: Params["params"]) {
  const session = await getSessionFromRequest(req);
  if (!session) return { error: bad("Unauthorized", 401) };
  const { id } = await params;
  const r: { id: string; ownerId: string; name: string; slug: string; currency: string | null; menuPdfUrl: string | null; primaryMenu: string } | null =
    await prisma.restaurant.findFirst({ where: { OR: [{ id }, { slug: id }] }, select: { id: true, ownerId: true, name: true, slug: true, currency: true, menuPdfUrl: true, primaryMenu: true } });
  if (!r) return { error: bad("Not found", 404) };
  const a = await accessFor(session, r);
  const canOrders = a.permissions.has(K.perm.orders), canManage = a.permissions.has(K.perm.manage);
  if (!canOrders && !canManage) return { error: bad("You don't have access to this. Ask the manager to give you access on Staff & roles.", 403) };
  return { session, r, canOrders, canManage };
}

/** The tables of Floor plan & tables (all areas), in their order. label "" = no number yet */
async function floorTables(restaurantId: string): Promise<{ id: string; label: string; area: string }[]> {
  const f = await loadFloorPlan(restaurantId).catch(() => null);
  const out: { id: string; label: string; area: string }[] = [];
  for (const a of f?.plan.areas ?? []) for (const o of a.objects) {
    if (o.type === "table") out.push({ id: o.id, label: (o.label ?? "").replace(/\s+/g, " ").trim().slice(0, 30), area: a.name });
  }
  return out;
}

async function baseStyle(restaurantId: string): Promise<QrStyle> {
  const row: { data: string } | null = await prisma.menuSnapshot.findFirst({ where: { restaurantId, data: { startsWith: '{"type":"qr-style"' } }, select: { data: true } });
  try { return row ? sanitizeStyle(JSON.parse(row.data).style) : DEFAULT_STYLE; } catch { return DEFAULT_STYLE; }
}

async function GET(req: NextRequest, { params }: Params) {
  try {
    const x = await load(req, params);
    if ("error" in x) return x.error;
    const days = Math.min(90, Math.max(1, Number(req.nextUrl.searchParams.get("days")) || 3));
    const [settings, orders, style, dishes, tables] = await Promise.all([
      loadRoomSettings(x.r.id, kind), x.canOrders ? listOrders(x.r.id, new Date(Date.now() - days * 86400000), kind) : Promise.resolve([]), baseStyle(x.r.id), orderableDishes(x.r),
      kind === "table" ? floorTables(x.r.id) : Promise.resolve([] as { id: string; label: string; area: string }[]),
    ]);
    return NextResponse.json({ canOrders: x.canOrders, canManage: x.canManage, orders, settings, baseStyle: style, name: x.r.name, slug: x.r.slug, currency: x.r.currency || "€", dishCount: dishes.length, floorTables: tables.length, floor: tables });
  } catch (error) {
    console.error(`[GET ${K.api}/manage]`, error);
    return bad(`Could not load ${K.title.toLowerCase()}`, 500);
  }
}

async function POST(req: NextRequest, { params }: Params) {
  try {
    const x = await load(req, params);
    if ("error" in x) return x.error;
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const clip = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");

    if (b.action === "status") {
      if (!x.canOrders) return bad("You don't have access to this.", 403);
      const o = await getOrder(x.r.id, String(b.id ?? ""), kind);
      if (!o) return bad("Not found", 404);
      const to = b.status as OrderStatus;
      if (o.status === "delivered" || o.status === "cancelled") return bad("This order is already closed");
      if (to !== "cancelled" && to !== nextStatus(o.status)) return bad("This order moved on just now. Please reload.", 409);
      const reason = to === "cancelled" ? clip(b.reason, 200) : o.reason;
      const next = { ...o, status: to, reason, history: [...o.history, { status: to, at: new Date().toISOString(), by: x.session.id }] };
      if (!(await updateOrder(x.r.id, next, o.status, kind))) return bad("Someone changed this order just now. Please reload.", 409);
      await logAction(x.session, x.r, K.log.order, `${K.title} #${o.number} (${o.room}): ${statusLabel(kind, to)}`, reason && to === "cancelled" ? [`Reason: ${reason}`] : []);
      const { token: _t, ...out } = next; void _t;
      return NextResponse.json({ order: out });
    }

    if (!x.canManage) return bad("You don't have access to this.", 403);
    const s = await loadRoomSettings(x.r.id, kind);

    if (b.action === "settings") {
      // Rooms are changed with their own actions
      const next = sanitizeRoomSettings({ ...s, ...(b.settings && typeof b.settings === "object" ? b.settings : {}), rooms: s.rooms }, kind);
      await saveRoomSettings(x.r.id, next, kind);
      const lines: string[] = [];
      if (s.enabled !== next.enabled) lines.push(`${K.title}: ${next.enabled ? "on" : "off"}`);
      if (s.mode !== next.mode) lines.push(`Guests order: ${next.mode === "text" ? "by writing" : next.mode === "menu" ? "from the menu" : "by writing or from the menu"}`);
      if (JSON.stringify(s.steps) !== JSON.stringify(next.steps)) lines.push("Changed the steps for guests");
      if (s.welcome !== next.welcome) lines.push("Changed the welcome text");
      if (s.menuView !== next.menuView) lines.push(`Guests see: ${next.menuView === "official" ? "the official menu and the dishes" : "only the dishes"}`);
      if (s.feedback !== next.feedback) lines.push(`Guests can rate the food: ${next.feedback ? "yes" : "no"}`);
      if (s.askName !== next.askName) lines.push(`Guests must write their name: ${next.askName ? "yes" : "no"}`);
      if (JSON.stringify(s.qrStyle) !== JSON.stringify(next.qrStyle) || s.roomLabel !== next.roomLabel || s.roomPrefix !== next.roomPrefix) lines.push(`Changed the look of the ${K.unit} QR codes`);
      if (lines.length) await logAction(x.session, x.r, K.log.settings, lines.length === 1 ? lines[0] : `Changed the ${K.title.toLowerCase()} settings`, lines.length > 1 ? lines : []);
      return NextResponse.json({ settings: next });
    }

    // Tables only: a QR code for each table of the floor plan that has none. A QR code with the same name and no table gets linked.
    if (b.action === "rooms-import" && kind === "table") {
      const floor = (await floorTables(x.r.id)).filter((t) => t.label);
      if (!floor.length) return bad("There are no tables with a number on Floor plan & tables yet.");
      const ids = new Set(floor.map((t) => t.id));
      // A link to a table that is not on the plan anymore doesn't count
      let rooms = s.rooms.map((r) => (r.floorId && !ids.has(r.floorId) ? { id: r.id, name: r.name } : r));
      let added = 0, linked = 0;
      for (const t of floor) {
        if (rooms.some((r) => r.floorId === t.id)) continue;
        const same = rooms.find((r) => !r.floorId && r.name.toLowerCase() === t.label.toLowerCase());
        if (same) { rooms = rooms.map((r) => (r.id === same.id ? { ...r, floorId: t.id } : r)); linked++; continue; }
        if (rooms.some((r) => r.name.toLowerCase() === t.label.toLowerCase())) continue;
        rooms = [...rooms, { id: newRoomId(), name: t.label, floorId: t.id }]; added++;
      }
      if (!added && !linked) return bad("Every table of the floor plan already has a QR code.");
      if (rooms.length > MAX_ROOMS) return bad(`That's more than ${MAX_ROOMS} ${K.units}`);
      const next = { ...s, rooms };
      await saveRoomSettings(x.r.id, next, kind);
      await logAction(x.session, x.r, K.log.units, `QR codes for the floor plan tables: ${added} new${linked ? `, ${linked} linked to their table` : ""}`);
      return NextResponse.json({ settings: next, added, linked, skipped: 0 });
    }

    // Tables only: link a QR code to a table of the floor plan (id null = take the QR code off that table), or make a new one for it
    if ((b.action === "room-link" || b.action === "room-link-new") && kind === "table") {
      const floorId = typeof b.floorId === "string" && /^[\w-]{1,60}$/.test(b.floorId) ? b.floorId : null;
      if (!floorId) return bad("Not found", 404);
      const free = s.rooms.map((r) => (r.floorId === floorId ? { id: r.id, name: r.name } : r));
      let rooms = free, line = "";
      if (b.action === "room-link-new") {
        const name = clip(b.name, 30);
        if (!name) return bad("Give the table a number first");
        const same = s.rooms.find((r) => r.name.toLowerCase() === name.toLowerCase());
        if (same) return bad(`There is already a QR code ${same.name}. Pick it from the list instead.`);
        if (s.rooms.length >= MAX_ROOMS) return bad(`That's more than ${MAX_ROOMS} ${K.units}`);
        rooms = [...free, { id: newRoomId(), name, floorId }];
        line = `New QR code ${name} for a table of the floor plan`;
      } else if (b.id) {
        const room = s.rooms.find((r) => r.id === b.id);
        if (!room) return bad("Not found", 404);
        // One QR code, one table: it leaves the table it had
        rooms = free.map((r) => (r.id === room.id ? { id: r.id, name: r.name, floorId } : r));
        line = `QR code ${room.name} linked to a table of the floor plan`;
      } else {
        const had = s.rooms.find((r) => r.floorId === floorId);
        if (!had) return NextResponse.json({ settings: s });
        line = `QR code ${had.name} taken off its table on the floor plan`;
      }
      const next = { ...s, rooms };
      await saveRoomSettings(x.r.id, next, kind);
      await logAction(x.session, x.r, K.log.units, line);
      return NextResponse.json({ settings: next });
    }

    if (b.action === "rooms-add") {
      const names = (Array.isArray(b.names) ? b.names : []).map((n) => clip(n, 30)).filter(Boolean);
      const have = new Set(s.rooms.map((r) => r.name.toLowerCase()));
      const fresh = [...new Set(names)].filter((n) => !have.has(n.toLowerCase()));
      if (!fresh.length) return bad(names.length ? `These ${K.units} are already there` : `Write a ${K.unit} number or name`);
      if (s.rooms.length + fresh.length > MAX_ROOMS) return bad(`That's more than ${MAX_ROOMS} ${K.units}`);
      const next = { ...s, rooms: [...s.rooms, ...fresh.map((name) => ({ id: newRoomId(), name }))] };
      await saveRoomSettings(x.r.id, next, kind);
      await logAction(x.session, x.r, K.log.units, fresh.length === 1 ? `Added ${K.unit} ${fresh[0]}` : `Added ${fresh.length} ${K.units} (${fresh[0]} to ${fresh[fresh.length - 1]})`);
      return NextResponse.json({ settings: next, added: fresh.length, skipped: names.length - fresh.length });
    }

    if (b.action === "room-rename" || b.action === "room-delete") {
      const room = s.rooms.find((r) => r.id === b.id);
      if (!room) return bad("Not found", 404);
      if (b.action === "room-delete") {
        const next = { ...s, rooms: s.rooms.filter((r) => r.id !== room.id) };
        await saveRoomSettings(x.r.id, next, kind);
        await logAction(x.session, x.r, K.log.units, `Removed ${K.unit} ${room.name}`);
        return NextResponse.json({ settings: next });
      }
      const name = clip(b.name, 30);
      if (!name) return bad(`Write a ${K.unit} number or name`);
      if (s.rooms.some((r) => r.id !== room.id && r.name.toLowerCase() === name.toLowerCase())) return bad(`There is already a ${K.unit} ${name}`);
      const next = { ...s, rooms: s.rooms.map((r) => (r.id === room.id ? { ...r, name } : r)) };
      await saveRoomSettings(x.r.id, next, kind);
      await logAction(x.session, x.r, K.log.units, `Renamed ${K.unit} ${room.name} to ${name}`);
      return NextResponse.json({ settings: next });
    }

    return bad("Unknown action");
  } catch (error) {
    console.error(`[POST ${K.api}/manage]`, error);
    return bad("Could not save. Please try again.", 500);
  }
}

return { GET, POST };
}
