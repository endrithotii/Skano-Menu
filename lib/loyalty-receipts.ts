// Loyalty: a photo of the receipt instead of waiting for a waiter (optional, Loyalty Cards > settings).
// The customer sends the photo from More > Loyalty stamp card, staff who may give stamps look at it later
// (Loyalty Cards page, waiter page) and give the stamp or decline it.
//
// One MenuSnapshot row per photo: '{"type":"stamp-receipt","key":"email:ana@x.com","status":"waiting"|"approved"|"declined",...}'

import { prisma } from "@/lib/db";

const PREFIX = '{"type":"stamp-receipt"';

export type ReceiptStatus = "waiting" | "approved" | "declined";
export interface Receipt {
  id: string;
  key: string;
  masked: string;
  photo: string;
  status: ReceiptStatus;
  sentAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  /** Why it was declined (shown to the customer) */
  reason: string;
  /** The stamps on the card right after it was given */
  stampsAfter: number | null;
}

interface Row { id: string; data: string; createdAt: Date }
const toData = (r: Omit<Receipt, "id">) => JSON.stringify({ type: "stamp-receipt", key: r.key, masked: r.masked, photo: r.photo, status: r.status, sentAt: r.sentAt, decidedAt: r.decidedAt, decidedBy: r.decidedBy, reason: r.reason, stampsAfter: r.stampsAfter });
function parse(row: Row): Receipt | null {
  try {
    const d = JSON.parse(row.data);
    if (d?.type !== "stamp-receipt") return null;
    return { id: row.id, key: d.key, masked: d.masked ?? "", photo: d.photo, status: d.status, sentAt: d.sentAt, decidedAt: d.decidedAt ?? null, decidedBy: d.decidedBy ?? null, reason: d.reason ?? "", stampsAfter: d.stampsAfter ?? null };
  } catch { return null; }
}

const keyPrefix = (key: string) => `${PREFIX},"key":${JSON.stringify(key)},`;

/** This customer's photos, newest first */
export async function receiptsOf(restaurantId: string, key: string, take = 10): Promise<Receipt[]> {
  const rows: Row[] = await prisma.menuSnapshot.findMany({ where: { restaurantId, data: { startsWith: keyPrefix(key) } }, select: { id: true, data: true, createdAt: true }, orderBy: { createdAt: "desc" }, take });
  return rows.map(parse).filter((x): x is Receipt => !!x);
}

/** For staff: the photos still to check (oldest first), and the last ones checked */
export async function receiptQueue(restaurantId: string): Promise<{ waiting: Receipt[]; recent: Receipt[] }> {
  const rows: Row[] = await prisma.menuSnapshot.findMany({
    where: { restaurantId, data: { startsWith: PREFIX }, createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } },
    select: { id: true, data: true, createdAt: true }, orderBy: { createdAt: "asc" }, take: 500,
  });
  const all = rows.map(parse).filter((x): x is Receipt => !!x);
  return {
    waiting: all.filter((r) => r.status === "waiting"),
    recent: all.filter((r) => r.status !== "waiting").sort((a, b) => Date.parse(b.decidedAt ?? b.sentAt) - Date.parse(a.decidedAt ?? a.sentAt)).slice(0, 20),
  };
}

/** A new photo. One waiting at a time per customer, and at most 5 a day. */
export async function addReceipt(restaurantId: string, key: string, masked: string, photo: string): Promise<{ receipt: Receipt } | { error: string }> {
  const mine = await receiptsOf(restaurantId, key, 20);
  if (mine.some((r) => r.status === "waiting")) return { error: "Your last receipt is still being checked. You get the stamp as soon as it is." };
  if (mine.filter((r) => Date.now() - Date.parse(r.sentAt) < 86_400_000).length >= 5) return { error: "You sent 5 receipts today. Please ask the waiter for more stamps." };
  const r: Omit<Receipt, "id"> = { key, masked, photo, status: "waiting", sentAt: new Date().toISOString(), decidedAt: null, decidedBy: null, reason: "", stampsAfter: null };
  const row = await prisma.menuSnapshot.create({ data: { restaurantId, label: "Receipt photo", data: toData(r) }, select: { id: true } });
  return { receipt: { ...r, id: row.id } };
}

export async function getReceipt(restaurantId: string, id: string): Promise<Receipt | null> {
  const row: Row | null = await prisma.menuSnapshot.findFirst({ where: { restaurantId, id, data: { startsWith: PREFIX } }, select: { id: true, data: true, createdAt: true } });
  return row ? parse(row) : null;
}

/** Saves the answer. Only changes a photo that is still waiting (two people can't both give the stamp). */
export async function decideReceipt(restaurantId: string, r: Receipt, patch: Pick<Receipt, "status" | "decidedBy" | "reason" | "stampsAfter">): Promise<boolean> {
  const row: Row | null = await prisma.menuSnapshot.findFirst({ where: { restaurantId, id: r.id }, select: { id: true, data: true, createdAt: true } });
  if (!row) return false;
  const { id: _i, ...rest } = r; void _i;
  const won = await prisma.menuSnapshot.updateMany({ where: { id: r.id, data: row.data }, data: { data: toData({ ...rest, ...patch, decidedAt: new Date().toISOString() }) } });
  return !!won?.count;
}

/** Plain save (after a claim with decideReceipt) */
export async function saveReceipt(r: Receipt) {
  const { id, ...rest } = r;
  await prisma.menuSnapshot.update({ where: { id }, data: { data: toData(rest) } });
}
