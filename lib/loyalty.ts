// Loyalty stamp cards.
//
// A customer's card is found by their email or phone number. To get a stamp, the customer asks for one on the
// menu (More > Loyalty stamp card): that makes a short code + QR code. A waiter who is allowed to give stamps
// (or the manager) scans it and confirms, then the stamp is added. When the card is full the customer gets the
// reward; the waiter confirms that the same way and the card starts again.
//
// Everything is stored in the MenuSnapshot table (no migration needed), one row each:
//   '{"type":"loyalty-card","key":"email:ana@x.com","stamps":3,"rewards":1,...}'
//   '{"type":"stamp-request","code":"K7P2QX","restaurantId":...,"key":...,"kind":"stamp"|"reward",...}'
//   '{"type":"loyalty-settings","stampWaiters":["userId",...]}'
// The program itself (on/off, stamps needed, reward) is in the Restaurant columns loyaltyEnabled/Stamps/Reward.

import { prisma } from "@/lib/db";

const CARD_PREFIX = '{"type":"loyalty-card"';
const REQUEST_PREFIX = '{"type":"stamp-request"';
const SETTINGS_PREFIX = '{"type":"loyalty-settings"';
/** A stamp code can be used for this long */
export const REQUEST_TTL_MS = 15 * 60 * 1000;

interface Row { id: string; data: string; createdAt: Date }

// ── Contact (email or phone) ───────────────────────────────────────────────

export interface Contact { key: string; masked: string }

/** "Ana@Mail.com " -> email:ana@mail.com, "+383 44 123 456" / "00383..." -> phone:38344123456. null if neither. */
export function parseContact(raw: unknown): Contact | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  if (!v || v.length > 120) return null;
  if (v.includes("@")) {
    const email = v.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return null;
    const [user, domain] = email.split("@");
    const shown = user.length <= 2 ? user[0] + "*" : user.slice(0, 2) + "*".repeat(Math.min(5, user.length - 2));
    return { key: `email:${email}`, masked: `${shown}@${domain}` };
  }
  if (!/^\+?[\d\s()./-]{6,}$/.test(v)) return null;
  let digits = v.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length < 6 || digits.length > 15) return null;
  return { key: `phone:${digits}`, masked: `${"•".repeat(Math.max(0, digits.length - 3))}${digits.slice(-3)}` };
}

/** Masked contact from a stored key (for the waiter screen) */
export function maskKey(key: string): string {
  const raw = key.startsWith("email:") ? key.slice(6) : key.startsWith("phone:") ? `+${key.slice(6)}` : key;
  return parseContact(raw)?.masked ?? "a customer";
}

// ── Program ────────────────────────────────────────────────────────────────

export interface Program { enabled: boolean; total: number; reward: string }

export async function loadProgram(idOrSlug: string): Promise<(Program & { restaurantId: string; name: string; slug: string; ownerId: string }) | null> {
  const r = await prisma.restaurant.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    select: { id: true, name: true, slug: true, ownerId: true, loyaltyEnabled: true, loyaltyStamps: true, loyaltyReward: true },
  });
  if (!r) return null;
  return {
    restaurantId: r.id, name: r.name, slug: r.slug, ownerId: r.ownerId,
    enabled: !!r.loyaltyEnabled,
    total: Math.min(50, Math.max(2, Number(r.loyaltyStamps) || 10)),
    reward: r.loyaltyReward || "Free item",
  };
}

// ── Cards ──────────────────────────────────────────────────────────────────

export interface Card {
  key: string;
  stamps: number;
  /** Rewards already given */
  rewards: number;
  lastStampAt: string | null;
  createdAt: string;
}

const cardData = (c: Card) =>
  // "key" right after "type", so a card can be found with a startsWith lookup
  JSON.stringify({ type: "loyalty-card", key: c.key, stamps: c.stamps, rewards: c.rewards, lastStampAt: c.lastStampAt, createdAt: c.createdAt });

const cardPrefix = (key: string) => `${CARD_PREFIX},"key":${JSON.stringify(key)},`;

async function findCardRow(restaurantId: string, key: string): Promise<{ id: string; card: Card } | null> {
  const row: Row | null = await prisma.menuSnapshot.findFirst({
    where: { restaurantId, data: { startsWith: cardPrefix(key) } },
    select: { id: true, data: true, createdAt: true },
  });
  if (!row) return null;
  try {
    const d = JSON.parse(row.data);
    return { id: row.id, card: { key, stamps: Number(d.stamps) || 0, rewards: Number(d.rewards) || 0, lastStampAt: d.lastStampAt ?? null, createdAt: d.createdAt ?? new Date(row.createdAt).toISOString() } };
  } catch {
    return null;
  }
}

export async function getCard(restaurantId: string, key: string): Promise<Card | null> {
  return (await findCardRow(restaurantId, key))?.card ?? null;
}

async function saveCard(restaurantId: string, card: Card) {
  const found = await findCardRow(restaurantId, card.key);
  if (found) await prisma.menuSnapshot.update({ where: { id: found.id }, data: { data: cardData(card) } });
  else await prisma.menuSnapshot.create({ data: { restaurantId, label: "Loyalty card", data: cardData(card) } });
}

export async function cardStats(restaurantId: string) {
  const rows: Row[] = await prisma.menuSnapshot.findMany({
    where: { restaurantId, data: { startsWith: CARD_PREFIX } },
    select: { id: true, data: true, createdAt: true },
  });
  let stamps = 0, rewards = 0;
  for (const r of rows) {
    try { const d = JSON.parse(r.data); stamps += Number(d.stamps) || 0; rewards += Number(d.rewards) || 0; } catch { /* skip */ }
  }
  return { cards: rows.length, stampsOnCards: stamps, rewardsGiven: rewards };
}

// ── Waiters who may give stamps ────────────────────────────────────────────

export async function loadStampWaiters(restaurantId: string): Promise<string[]> {
  const row: Row | null = await prisma.menuSnapshot.findFirst({
    where: { restaurantId, data: { startsWith: SETTINGS_PREFIX } },
    select: { id: true, data: true, createdAt: true },
  });
  try {
    const ids = row ? JSON.parse(row.data).stampWaiters : [];
    return Array.isArray(ids) ? ids.filter((x: unknown): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function saveStampWaiters(restaurantId: string, ids: string[]) {
  const data = JSON.stringify({ type: "loyalty-settings", stampWaiters: [...new Set(ids)] });
  const row = await prisma.menuSnapshot.findFirst({ where: { restaurantId, data: { startsWith: SETTINGS_PREFIX } }, select: { id: true } });
  if (row) await prisma.menuSnapshot.update({ where: { id: row.id }, data: { data } });
  else await prisma.menuSnapshot.create({ data: { restaurantId, label: "Loyalty settings", data } });
}

/** May this signed-in user confirm stamps for this restaurant? The owner always may, waiters when allowed */
export async function canGiveStamps(session: { id: string; role: string } | null, program: { restaurantId: string; ownerId: string }): Promise<boolean> {
  if (!session) return false;
  if (session.role === "SUPER_ADMIN" || session.id === program.ownerId) return true;
  if (session.role !== "WAITER") return false;
  const user = await prisma.user.findFirst({ where: { id: session.id, role: "WAITER", staffRestaurantId: program.restaurantId }, select: { id: true } });
  if (!user) return false;
  return (await loadStampWaiters(program.restaurantId)).includes(session.id);
}

// ── Stamp requests (the code the waiter scans) ─────────────────────────────

export type RequestKind = "stamp" | "reward";
export type RequestStatus = "pending" | "approved" | "expired";

export interface StampRequest {
  rowId: string;
  code: string;
  restaurantId: string;
  key: string;
  kind: RequestKind;
  status: RequestStatus;
  createdAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
}

// No 0/O, 1/I/L: easy to read out and type
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
}

const requestData = (r: Omit<StampRequest, "rowId">) =>
  JSON.stringify({ type: "stamp-request", code: r.code, restaurantId: r.restaurantId, key: r.key, kind: r.kind, status: r.status, createdAt: r.createdAt, approvedAt: r.approvedAt, approvedBy: r.approvedBy });

export function normalizeCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const c = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[A-Z0-9]{6}$/.test(c) ? c : null;
}

export async function getRequest(code: string): Promise<StampRequest | null> {
  const row: Row | null = await prisma.menuSnapshot.findFirst({
    where: { data: { startsWith: `${REQUEST_PREFIX},"code":${JSON.stringify(code)},` } },
    select: { id: true, data: true, createdAt: true },
  });
  if (!row) return null;
  try {
    const d = JSON.parse(row.data);
    const expired = d.status === "pending" && Date.now() - Date.parse(d.createdAt) > REQUEST_TTL_MS;
    return {
      rowId: row.id, code: d.code, restaurantId: d.restaurantId, key: d.key, kind: d.kind === "reward" ? "reward" : "stamp",
      status: expired ? "expired" : d.status, createdAt: d.createdAt, approvedAt: d.approvedAt ?? null, approvedBy: d.approvedBy ?? null,
    };
  } catch {
    return null;
  }
}

export async function createRequest(restaurantId: string, key: string, kind: RequestKind): Promise<StampRequest> {
  // Tidy up: this customer's older open codes and codes that ran out long ago
  const old: Row[] = await prisma.menuSnapshot.findMany({
    where: { restaurantId, data: { startsWith: REQUEST_PREFIX } },
    select: { id: true, data: true, createdAt: true },
  });
  const drop = old.filter((r) => {
    try {
      const d = JSON.parse(r.data);
      return (d.key === key && d.status === "pending") || Date.now() - Date.parse(d.createdAt) > 24 * 60 * 60 * 1000;
    } catch { return true; }
  }).map((r) => r.id);
  if (drop.length) await prisma.menuSnapshot.deleteMany({ where: { restaurantId, id: { in: drop } } }).catch(() => {});

  let code = newCode();
  for (let i = 0; i < 5 && (await getRequest(code)); i++) code = newCode();
  const req = { code, restaurantId, key, kind, status: "pending" as const, createdAt: new Date().toISOString(), approvedAt: null, approvedBy: null };
  const row = await prisma.menuSnapshot.create({ data: { restaurantId, label: "Stamp request", data: requestData(req) } });
  return { ...req, rowId: row.id };
}

/**
 * Confirms a request: adds the stamp, or gives the reward (the card starts again).
 * Returns the card afterwards, or an error text.
 */
export async function approveRequest(req: StampRequest, approverId: string, program: Program): Promise<{ card: Card } | { error: string }> {
  if (req.status === "approved") return { error: "This code was already used." };
  if (req.status === "expired") return { error: "This code ran out. Ask the customer to make a new one." };
  const card = (await getCard(req.restaurantId, req.key)) ?? { key: req.key, stamps: 0, rewards: 0, lastStampAt: null, createdAt: new Date().toISOString() };
  if (req.kind === "reward") {
    if (card.stamps < program.total) return { error: "This card isn't full yet." };
    card.stamps = 0;
    card.rewards += 1;
  } else {
    if (card.stamps >= program.total) return { error: "This card is already full. The customer can get the reward first." };
    card.stamps += 1;
    card.lastStampAt = new Date().toISOString();
  }
  await saveCard(req.restaurantId, card);
  const now = new Date().toISOString();
  await prisma.menuSnapshot.update({
    where: { id: req.rowId },
    data: { data: requestData({ ...req, status: "approved", approvedAt: now, approvedBy: approverId }) },
  });
  return { card };
}
