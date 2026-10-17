// Table reservations (server side).
// Customers ask for a table (/reserve/<restaurant>), the manager accepts or refuses on the Reservations page,
// and the customer gets an email. A pending request already holds the table, so two people can't ask for it.
//
// MenuSnapshot rows (no migration):
//   '{"type":"reservation", ...}'          one per reservation, createdAt = the reservation's start (fast date filters)
//   '{"type":"table-block", ...}'          tables that can't be reserved for a time
//   '{"type":"reservation-settings", ...}' how long a table is kept, how far ahead, ...

import { prisma } from "@/lib/db";
import { floorPlanAt } from "@/lib/floor-plan-store";
import type { FloorObject, FloorPlan } from "@/lib/floor-plan";
import { DEFAULT_REMINDERS, sanitizeSpecs, type ReminderSpec } from "@/lib/reminder-specs";

const RES = '{"type":"reservation"';
const BLOCK = '{"type":"table-block"';
const SETTINGS = '{"type":"reservation-settings"';

// ── Settings ─────────────────────────────────────────────────────────────────

export interface ReservationSettings {
  enabled: boolean;
  /** How long a table is kept for one reservation */
  durationMin: number;
  /** Times customers can pick: every 15 / 30 / 60 minutes */
  stepMin: number;
  /** How many days ahead customers can reserve */
  daysAhead: number;
  /** At least this many minutes before the time */
  noticeMin: number;
  /** true: customers pick their table on the floor plan. false: they only fill in the form, the manager picks the table */
  customerPicksTable: boolean;
  /** Reminders suggested when accepting a reservation (the manager can change them there) */
  reminders: ReminderSpec[];
}
export const DEFAULT_SETTINGS: ReservationSettings = { enabled: true, durationMin: 120, stepMin: 30, daysAhead: 30, noticeMin: 60, customerPicksTable: true, reminders: DEFAULT_REMINDERS };

const pick = <T extends number>(v: unknown, allowed: T[], d: T): T => (allowed.includes(v as T) ? (v as T) : d);
export function sanitizeSettings(v: unknown): ReservationSettings {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    enabled: o.enabled !== false,
    durationMin: pick(o.durationMin, [60, 90, 120, 150, 180, 240], 120),
    stepMin: pick(o.stepMin, [15, 30, 60], 30),
    daysAhead: pick(o.daysAhead, [7, 14, 30, 60, 90, 180], 30),
    noticeMin: pick(o.noticeMin, [0, 30, 60, 120, 240, 1440], 60),
    customerPicksTable: o.customerPicksTable !== false,
    // Saved before reminders existed: the default ones
    reminders: Array.isArray(o.reminders) ? sanitizeSpecs(o.reminders, true) : DEFAULT_REMINDERS,
  };
}

export async function loadReservationSettings(restaurantId: string): Promise<ReservationSettings> {
  const row: { data: string } | null = await prisma.menuSnapshot.findFirst({ where: { restaurantId, data: { startsWith: SETTINGS } }, select: { data: true } });
  try { return row ? sanitizeSettings(JSON.parse(row.data)) : DEFAULT_SETTINGS; } catch { return DEFAULT_SETTINGS; }
}
export async function saveReservationSettings(restaurantId: string, s: ReservationSettings) {
  const data = JSON.stringify({ type: "reservation-settings", ...s });
  const row = await prisma.menuSnapshot.findFirst({ where: { restaurantId, data: { startsWith: SETTINGS } }, select: { id: true } });
  if (row) await prisma.menuSnapshot.update({ where: { id: row.id }, data: { data } });
  else await prisma.menuSnapshot.create({ data: { restaurantId, label: "Reservation settings", data } });
}

// ── Reservations ─────────────────────────────────────────────────────────────

export type ReservationStatus = "pending" | "accepted" | "refused" | "cancelled";
export interface Reservation {
  id: string;
  status: ReservationStatus;
  startAt: string;
  endAt: string;
  guests: number;
  /** null = no table yet: the manager picks one when accepting (or "no specific table") */
  tableId: string | null;
  tableLabel: string;
  areaName: string;
  name: string;
  email: string;
  phone: string;
  note: string;
  /** The customer's time zone (to write the time in emails as they picked it) */
  timeZone: string;
  requestedAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  /** Message to the customer with the answer */
  message: string;
  emailSent: boolean | null;
  /** The last call to the customer (from a reminder): confirmed or no answer */
  call?: { result: "confirmed" | "no-answer"; at: string; by: string | null; note: string } | null;
  /** Who cancelled: the restaurant (missing) or the customer with the link in the reminder email */
  cancelledBy?: "customer" | null;
}

interface Row { id: string; data: string; createdAt: Date }
const toData = (r: Omit<Reservation, "id">) => JSON.stringify({ type: "reservation", ...r });
function parse(row: Row): Reservation | null {
  try {
    const d = JSON.parse(row.data);
    if (d?.type !== "reservation") return null;
    const { type: _t, ...rest } = d; void _t;
    return { ...(rest as Omit<Reservation, "id">), id: row.id };
  } catch { return null; }
}

export async function listReservations(restaurantId: string, f: { from?: Date; until?: Date; status?: ReservationStatus[] } = {}, take = 300): Promise<Reservation[]> {
  const createdAt: Record<string, Date> = {};
  if (f.from) createdAt.gte = f.from;
  if (f.until) createdAt.lte = f.until;
  const rows: Row[] = await prisma.menuSnapshot.findMany({
    where: { restaurantId, data: { startsWith: RES }, ...(Object.keys(createdAt).length ? { createdAt } : {}) },
    select: { id: true, data: true, createdAt: true }, orderBy: { createdAt: "asc" }, take,
  });
  return rows.map(parse).filter((r): r is Reservation => !!r && (!f.status || f.status.includes(r.status)));
}

export async function getReservation(restaurantId: string, id: string): Promise<Reservation | null> {
  const row: Row | null = await prisma.menuSnapshot.findFirst({ where: { restaurantId, id, data: { startsWith: RES } }, select: { id: true, data: true, createdAt: true } });
  return row ? parse(row) : null;
}

export async function saveReservation(restaurantId: string, r: Reservation) {
  const { id, ...rest } = r;
  await prisma.menuSnapshot.update({ where: { id }, data: { data: toData(rest) } });
  void restaurantId;
}

async function createReservation(restaurantId: string, r: Omit<Reservation, "id">): Promise<Reservation> {
  const row = await prisma.menuSnapshot.create({ data: { restaurantId, label: "Reservation", data: toData(r), createdAt: new Date(r.startAt) }, select: { id: true } });
  return { ...r, id: row.id };
}

// ── Blocked tables ───────────────────────────────────────────────────────────

export interface TableBlock { id: string; tableIds: string[] | "all"; labels: string[]; from: string; until: string; reason: string; by: string | null }

export async function listBlocks(restaurantId: string): Promise<TableBlock[]> {
  const rows: Row[] = await prisma.menuSnapshot.findMany({ where: { restaurantId, data: { startsWith: BLOCK } }, select: { id: true, data: true, createdAt: true }, orderBy: { createdAt: "asc" } });
  const out: TableBlock[] = [];
  const old: string[] = [];
  for (const r of rows) {
    try {
      const d = JSON.parse(r.data);
      // Blocks that ended more than 30 days ago are cleaned up
      if (Date.parse(d.until) < Date.now() - 30 * 86_400_000) { old.push(r.id); continue; }
      out.push({ id: r.id, tableIds: d.tableIds === "all" ? "all" : Array.isArray(d.tableIds) ? d.tableIds : [], labels: Array.isArray(d.labels) ? d.labels : [], from: d.from, until: d.until, reason: d.reason ?? "", by: d.by ?? null });
    } catch { /* skip */ }
  }
  if (old.length) await prisma.menuSnapshot.deleteMany({ where: { restaurantId, id: { in: old } } }).catch(() => {});
  return out;
}

export async function createBlock(restaurantId: string, b: Omit<TableBlock, "id">): Promise<TableBlock> {
  const row = await prisma.menuSnapshot.create({ data: { restaurantId, label: "Table block", data: JSON.stringify({ type: "table-block", ...b }), createdAt: new Date(b.from) }, select: { id: true } });
  return { ...b, id: row.id };
}
export async function deleteBlock(restaurantId: string, id: string) {
  await prisma.menuSnapshot.deleteMany({ where: { restaurantId, id, data: { startsWith: BLOCK } } });
}

// ── Availability ─────────────────────────────────────────────────────────────

export type TableStatus = "free" | "taken" | "blocked" | "too-small" | "too-few" | "not-reservable";
export interface TableInfo { id: string; label: string; seats: number; minGuests: number; areaId: string; areaName: string; status: TableStatus; blockReason?: string }

const overlaps = (a1: number, a2: number, b1: number, b2: number) => a1 < b2 && b1 < a2;

/** Every table of the plan that counts at `start`, and whether it can be reserved for `guests` people */
export async function tablesAt(restaurantId: string, start: Date, guests: number, settings: ReservationSettings, ignoreReservationId?: string): Promise<{ plan: FloorPlan | null; tables: TableInfo[] }> {
  const found = await floorPlanAt(restaurantId, start);
  if (!found) return { plan: null, tables: [] };
  const s = start.getTime(), e = s + settings.durationMin * 60_000;
  // Reservations that started up to a day before can still overlap
  const near = await listReservations(restaurantId, { from: new Date(s - 86_400_000), until: new Date(e), status: ["pending", "accepted"] });
  const blocks = (await listBlocks(restaurantId)).filter((b) => overlaps(s, e, Date.parse(b.from), Date.parse(b.until)));
  const tables: TableInfo[] = [];
  for (const area of found.plan.areas) {
    for (const o of area.objects.filter((x): x is FloorObject => x.type === "table")) {
      const seats = o.seats ?? 1, min = Math.min(seats, o.minGuests ?? 1);
      const block = blocks.find((b) => b.tableIds === "all" || b.tableIds.includes(o.id));
      const taken = near.some((r) => r.id !== ignoreReservationId && r.tableId === o.id && overlaps(s, e, Date.parse(r.startAt), Date.parse(r.endAt)));
      const status: TableStatus = o.reservable === false ? "not-reservable" : block ? "blocked" : taken ? "taken" : guests > seats ? "too-small" : guests < min ? "too-few" : "free";
      tables.push({ id: o.id, label: o.label || "Table", seats, minGuests: min, areaId: area.id, areaName: area.name, status, ...(block?.reason ? { blockReason: block.reason } : {}) });
    }
  }
  return { plan: found.plan, tables };
}

/** The best free table for a group: the smallest that fits */
export function bestTable(tables: TableInfo[]): TableInfo | null {
  return tables.filter((t) => t.status === "free").sort((a, b) => a.seats - b.seats || a.label.localeCompare(b.label, undefined, { numeric: true }))[0] ?? null;
}

// ── Asking for a table ───────────────────────────────────────────────────────

export interface RequestInput { startAt: string; guests: number; tableId: string | null; name: string; email: string; phone: string; note: string; timeZone: string }

const validZone = (z: string) => { try { new Intl.DateTimeFormat("en", { timeZone: z }); return true; } catch { return false; } };

export function readRequest(body: unknown): RequestInput | { error: string } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const start = typeof b.startAt === "string" ? Date.parse(b.startAt) : NaN;
  if (!Number.isFinite(start)) return { error: "Please choose a day and a time." };
  const guests = Math.round(Number(b.guests));
  if (!Number.isFinite(guests) || guests < 1 || guests > 30) return { error: "Please choose how many persons you are." };
  const name = typeof b.name === "string" ? b.name.replace(/\s+/g, " ").trim().slice(0, 80) : "";
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase().slice(0, 120) : "";
  const phone = typeof b.phone === "string" ? b.phone.replace(/[^\d+\s()-]/g, "").trim().slice(0, 30) : "";
  if (name.length < 2) return { error: "Please write your name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { error: "Please write a valid email address. The answer is sent there." };
  if (phone.replace(/\D/g, "").length < 6) return { error: "Please write your phone number." };
  const zone = typeof b.timeZone === "string" && validZone(b.timeZone) ? b.timeZone : "UTC";
  return {
    startAt: new Date(start).toISOString(), guests, tableId: typeof b.tableId === "string" && b.tableId ? b.tableId : null,
    name, email, phone, note: typeof b.note === "string" ? b.note.replace(/\s+/g, " ").trim().slice(0, 300) : "", timeZone: zone,
  };
}

export async function requestTable(restaurantId: string, input: RequestInput): Promise<{ reservation: Reservation } | { error: string; status?: number }> {
  const settings = await loadReservationSettings(restaurantId);
  if (!settings.enabled) return { error: "This restaurant doesn't take reservations online right now.", status: 403 };
  const start = new Date(input.startAt), now = Date.now();
  if (start.getTime() < now + settings.noticeMin * 60_000) return { error: settings.noticeMin ? `Please choose a time at least ${settings.noticeMin >= 60 ? `${settings.noticeMin / 60} hour${settings.noticeMin === 60 ? "" : "s"}` : `${settings.noticeMin} minutes`} from now.` : "That time has passed." };
  if (start.getTime() > now + settings.daysAhead * 86_400_000) return { error: `Reservations are possible up to ${settings.daysAhead} days ahead.` };
  // Not too many open requests from one email
  const open = (await listReservations(restaurantId, { from: new Date(now - 86_400_000), status: ["pending"] })).filter((r) => r.email === input.email);
  if (open.length >= 3) return { error: "You already have 3 requests waiting for an answer. Please wait for the restaurant to answer." };

  // Which table: the one the customer picked, else the best free one. No free table (or the manager picks
  // the tables): the request is sent without a table and the manager finds a place when accepting.
  let table: TableInfo | null = null;
  if (settings.customerPicksTable) {
    const { tables } = await tablesAt(restaurantId, start, input.guests, settings);
    table = input.tableId ? tables.find((t) => t.id === input.tableId) ?? null : bestTable(tables);
    if (input.tableId && !table) return { error: "That table isn't there at this time. Please pick another one." };
  }
  if (table && table.status !== "free") {
    const why: Record<TableStatus, string> = {
      free: "", taken: "That table was just reserved by someone else. Please pick another one.", blocked: "That table can't be reserved at this time.",
      "too-small": `That table has ${table.seats} seats.`, "too-few": `That table is reserved for at least ${table.minGuests} persons.`, "not-reservable": "That table can't be reserved online.",
    };
    return { error: why[table.status] };
  }
  const reservation = await createReservation(restaurantId, {
    status: "pending", startAt: start.toISOString(), endAt: new Date(start.getTime() + settings.durationMin * 60_000).toISOString(),
    guests: input.guests, tableId: table?.id ?? null, tableLabel: table?.label ?? "", areaName: table?.areaName ?? "",
    name: input.name, email: input.email, phone: input.phone, note: input.note, timeZone: input.timeZone,
    requestedAt: new Date().toISOString(), decidedAt: null, decidedBy: null, message: "", emailSent: null,
  });
  return { reservation };
}

/** "table T3 (Main hall)" or a sentence when there is no table (yet) */
export function tableText(r: Pick<Reservation, "tableId" | "tableLabel" | "areaName">, pending = false): string {
  if (!r.tableId) return pending ? "the restaurant chooses your table" : "we'll have a table ready for you";
  return `table ${r.tableLabel}${r.areaName ? ` (${r.areaName})` : ""}`;
}

/** "Friday 17 October 2026 at 19:30" in the customer's own time zone */
export function whenText(r: Pick<Reservation, "startAt" | "timeZone">): string {
  const d = new Date(r.startAt);
  const day = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: r.timeZone }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: r.timeZone }).format(d);
  return `${day} at ${time}`;
}
