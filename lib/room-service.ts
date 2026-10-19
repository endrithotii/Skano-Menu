// Room service (server side). Saved in the MenuSnapshot table (no migration):
//   '{"type":"room-service-settings", ...}'   one per restaurant: on / off, how guests order, the steps, the rooms, the QR style
//   '{"type":"room-order","number":12, ...}'  one per order (createdAt = when it was sent)
// The guest gets a secret token with the order, to follow it on their phone without an account.

import { createHmac, randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { getDishDetails, listMenusForDetails } from "@/lib/dish-details";
import { sanitizeRoomSettings, type RoomOrder, type RoomServiceSettings } from "@/lib/room-service-types";

const SETTINGS = '{"type":"room-service-settings"';
const ORDER = '{"type":"room-order"';

export async function loadRoomSettings(restaurantId: string): Promise<RoomServiceSettings> {
  const row: { data: string } | null = await prisma.menuSnapshot.findFirst({ where: { restaurantId, data: { startsWith: SETTINGS } }, select: { data: true } });
  if (!row) return sanitizeRoomSettings({});
  try { return sanitizeRoomSettings(JSON.parse(row.data)); } catch { return sanitizeRoomSettings({}); }
}

export async function saveRoomSettings(restaurantId: string, s: RoomServiceSettings) {
  const data = JSON.stringify({ type: "room-service-settings", ...s });
  const row = await prisma.menuSnapshot.findFirst({ where: { restaurantId, data: { startsWith: SETTINGS } }, select: { id: true } });
  if (row) await prisma.menuSnapshot.update({ where: { id: row.id }, data: { data } });
  else await prisma.menuSnapshot.create({ data: { restaurantId, label: "Room service settings", data } });
}

/** A new room id: short and hard to guess (it's in the room's QR code) */
export const newRoomId = () => randomBytes(6).toString("hex");

// ── Dishes guests can pick (Ingredients & details of the menus customers can see now) ──

export interface OrderDish { id: string; name: string; section: string; price: number | null }

export async function orderableDishes(restaurant: { id: string; menuPdfUrl: string | null; primaryMenu: string }): Promise<OrderDish[]> {
  const out: OrderDish[] = [];
  const seen = new Set<string>();
  for (const m of (await listMenusForDetails(restaurant)).filter((x) => x.active.length)) {
    const d = await getDishDetails(restaurant.id, m.key);
    for (const dish of d?.dishes ?? []) {
      if (!dish.name.trim() || seen.has(dish.id)) continue;
      seen.add(dish.id);
      out.push({ id: dish.id, name: dish.name, section: dish.section || m.title, price: dish.price });
    }
  }
  return out.slice(0, 400);
}

// ── Orders ───────────────────────────────────────────────────────────────────

type Stored = Omit<RoomOrder, "id"> & { token: string };
const orderData = (o: Stored) => JSON.stringify({ type: "room-order", ...o });

const secret = () => process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || "skano-room-service";
/** The guest's key to follow their order */
export const orderToken = (orderId: string, salt: string) => createHmac("sha256", secret()).update(`${orderId}.${salt}`).digest("hex").slice(0, 24);

function parse(row: { id: string; data: string }): (RoomOrder & { token: string }) | null {
  try {
    const d = JSON.parse(row.data);
    return { id: row.id, number: d.number, roomId: d.roomId ?? null, room: d.room ?? "", guestName: d.guestName ?? "", text: d.text ?? "", items: Array.isArray(d.items) ? d.items : [],
      total: d.total ?? null, status: d.status, reason: d.reason ?? "", history: Array.isArray(d.history) ? d.history : [], createdAt: d.createdAt, token: d.token ?? "" };
  } catch { return null; }
}

export async function addOrder(restaurantId: string, o: Omit<RoomOrder, "id" | "number" | "createdAt" | "history" | "status" | "reason">): Promise<RoomOrder & { token: string }> {
  const last: { data: string } | null = await prisma.menuSnapshot.findFirst({ where: { restaurantId, data: { startsWith: ORDER } }, select: { data: true }, orderBy: { createdAt: "desc" } });
  let number = 1;
  try { if (last) number = (JSON.parse(last.data).number ?? 0) + 1; } catch { /* first */ }
  const now = new Date();
  const salt = randomBytes(8).toString("hex");
  const stored: Stored = { ...o, number, status: "new", reason: "", history: [{ status: "new", at: now.toISOString(), by: null }], createdAt: now.toISOString(), token: salt };
  const row = await prisma.menuSnapshot.create({ data: { restaurantId, label: "Room service order", data: orderData(stored), createdAt: now } });
  return { ...stored, id: row.id, token: orderToken(row.id, salt) };
}

export async function listOrders(restaurantId: string, since: Date): Promise<RoomOrder[]> {
  const rows: { id: string; data: string }[] = await prisma.menuSnapshot.findMany({
    where: { restaurantId, data: { startsWith: ORDER }, createdAt: { gte: since } }, select: { id: true, data: true }, orderBy: { createdAt: "desc" }, take: 500,
  });
  return rows.map(parse).filter((o): o is RoomOrder & { token: string } => !!o).map(({ token: _t, ...o }) => { void _t; return o; });
}

export async function getOrder(restaurantId: string, id: string): Promise<(RoomOrder & { token: string }) | null> {
  const row: { id: string; data: string } | null = await prisma.menuSnapshot.findFirst({ where: { id, restaurantId, data: { startsWith: ORDER } }, select: { id: true, data: true } });
  return row ? parse(row) : null;
}

/** Saves a new status, only if nobody changed it in the meantime */
export async function updateOrder(restaurantId: string, o: RoomOrder & { token: string }, expected: RoomOrder["status"]): Promise<boolean> {
  const row: { id: string; data: string } | null = await prisma.menuSnapshot.findFirst({ where: { id: o.id, restaurantId, data: { startsWith: ORDER } }, select: { id: true, data: true } });
  if (!row) return false;
  const now = parse(row);
  if (!now || now.status !== expected) return false;
  const { id: _i, ...rest } = o; void _i;
  const res = await prisma.menuSnapshot.updateMany({ where: { id: o.id, restaurantId, data: row.data }, data: { data: orderData(rest) } });
  return res.count === 1;
}

/** Simple protection against one phone sending a lot: max 6 orders per 10 minutes per address and restaurant */
const recent = new Map<string, number[]>();
export function tooManyOrders(key: string, now = Date.now()): boolean {
  const list = (recent.get(key) ?? []).filter((t) => now - t < 10 * 60_000);
  if (list.length >= 6) { recent.set(key, list); return true; }
  list.push(now); recent.set(key, list);
  if (recent.size > 5000) for (const k of [...recent.keys()].slice(0, 1000)) recent.delete(k);
  return false;
}
