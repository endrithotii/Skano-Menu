// HR (server side): saved in the MenuSnapshot table (no migration), like the other features.
//   '{"type":"hr-settings", ...}'                         one per restaurant: rules, time zone, work times per person
//   '{"type":"hr-entry","userId":"…", ...}'               one per check-in, createdAt = the check-in time
//   '{"type":"hr-leave","userId":"…", ...}'               one per time off request, createdAt = when it was asked
//   '{"type":"hr-doc","userId":"…", ...,"file":{…}}'      one per contract or document (the file itself is in private storage)
// type and userId come first: lists filter with "starts with".

import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { sanitizeSettings, type HrDoc, type HrSettings, type Leave, type TimeEntry } from "@/lib/hr";

const SETTINGS = '{"type":"hr-settings"';
const ENTRY = '{"type":"hr-entry"';
const LEAVE = '{"type":"hr-leave"';
const DOC = '{"type":"hr-doc"';
const who = (prefix: string, userId?: string) => (userId ? `${prefix},"userId":${JSON.stringify(userId)}` : prefix);

interface Row { id: string; data: string; createdAt?: Date }
const parse = <T,>(r: Row): (T & { id: string }) | null => { try { return { ...JSON.parse(r.data), id: r.id }; } catch { return null; } };
const strip = <T extends { id: string }>(x: T) => { const { id: _id, ...rest } = x; void _id; return rest; };

// ── Settings ─────────────────────────────────────────────────────────────────

export async function loadHrSettings(restaurantId: string, fallbackZone = "UTC"): Promise<HrSettings> {
  const row: Row | null = await prisma.menuSnapshot.findFirst({ where: { restaurantId, data: { startsWith: SETTINGS } }, select: { id: true, data: true } });
  if (!row) return sanitizeSettings({}, fallbackZone);
  try { return sanitizeSettings(JSON.parse(row.data), fallbackZone); } catch { return sanitizeSettings({}, fallbackZone); }
}

export async function saveHrSettings(restaurantId: string, s: HrSettings) {
  const data = JSON.stringify({ type: "hr-settings", timeZone: s.timeZone, rules: s.rules, people: s.people });
  const row = await prisma.menuSnapshot.findFirst({ where: { restaurantId, data: { startsWith: SETTINGS } }, select: { id: true } });
  if (row) await prisma.menuSnapshot.update({ where: { id: row.id }, data: { data } });
  else await prisma.menuSnapshot.create({ data: { restaurantId, label: "HR settings", data } });
}

// ── Check-ins ────────────────────────────────────────────────────────────────

const entryData = (e: Omit<TimeEntry, "id">) => JSON.stringify({ type: "hr-entry", userId: e.userId, in: e.in, out: e.out, note: e.note, source: e.source, editedBy: e.editedBy, editedAt: e.editedAt });

/** Check-ins that started between two moments (one person or everyone) */
export async function listEntries(restaurantId: string, from: Date, to: Date, userId?: string): Promise<TimeEntry[]> {
  const rows: Row[] = await prisma.menuSnapshot.findMany({
    where: { restaurantId, data: { startsWith: who(ENTRY, userId) }, createdAt: { gte: from, lte: to } },
    select: { id: true, data: true }, orderBy: { createdAt: "asc" }, take: 5000,
  });
  return rows.map((r) => parse<TimeEntry>(r)).filter((e): e is TimeEntry => !!e);
}

/** The check-in that is still open (not checked out), if any */
export async function openEntry(restaurantId: string, userId: string): Promise<TimeEntry | null> {
  const rows: Row[] = await prisma.menuSnapshot.findMany({
    where: { restaurantId, data: { startsWith: who(ENTRY, userId) } },
    select: { id: true, data: true }, orderBy: { createdAt: "desc" }, take: 5,
  });
  return rows.map((r) => parse<TimeEntry>(r)).find((e): e is TimeEntry => !!e && !e.out) ?? null;
}

/** Everyone who is checked in right now */
export async function openEntries(restaurantId: string): Promise<TimeEntry[]> {
  const since = new Date(Date.now() - 3 * 86400000);
  return (await listEntries(restaurantId, since, new Date())).filter((e) => !e.out);
}

export async function getEntry(restaurantId: string, id: string): Promise<TimeEntry | null> {
  const row: Row | null = await prisma.menuSnapshot.findFirst({ where: { id, restaurantId, data: { startsWith: ENTRY } }, select: { id: true, data: true } });
  return row ? parse<TimeEntry>(row) : null;
}

export async function addEntry(restaurantId: string, e: Omit<TimeEntry, "id">): Promise<TimeEntry> {
  const row = await prisma.menuSnapshot.create({ data: { restaurantId, label: "Check-in", data: entryData(e), createdAt: new Date(e.in) } });
  return { ...e, id: row.id };
}

export async function saveEntry(restaurantId: string, e: TimeEntry) {
  await prisma.menuSnapshot.updateMany({ where: { id: e.id, restaurantId }, data: { data: entryData(strip(e)), createdAt: new Date(e.in) } });
}

export async function deleteEntry(restaurantId: string, id: string) {
  await prisma.menuSnapshot.deleteMany({ where: { id, restaurantId, data: { startsWith: ENTRY } } });
}

// ── Time off ─────────────────────────────────────────────────────────────────

const leaveData = (l: Omit<Leave, "id">) => JSON.stringify({ type: "hr-leave", ...l });

export async function listLeaves(restaurantId: string, userId?: string): Promise<Leave[]> {
  const rows: Row[] = await prisma.menuSnapshot.findMany({
    where: { restaurantId, data: { startsWith: who(LEAVE, userId) } },
    select: { id: true, data: true }, orderBy: { createdAt: "desc" }, take: 3000,
  });
  return rows.map((r) => parse<Leave>(r)).filter((l): l is Leave => !!l).map((l) => { const { type: _t, ...rest } = l as Leave & { type?: string }; void _t; return rest; });
}

export async function getLeave(restaurantId: string, id: string): Promise<Leave | null> {
  const row: Row | null = await prisma.menuSnapshot.findFirst({ where: { id, restaurantId, data: { startsWith: LEAVE } }, select: { id: true, data: true } });
  if (!row) return null;
  const l = parse<Leave>(row);
  if (!l) return null;
  const { type: _t, ...rest } = l as Leave & { type?: string }; void _t;
  return rest;
}

export async function addLeave(restaurantId: string, l: Omit<Leave, "id">): Promise<Leave> {
  const row = await prisma.menuSnapshot.create({ data: { restaurantId, label: "Time off", data: leaveData(l), createdAt: new Date(l.requestedAt) } });
  return { ...l, id: row.id };
}

/** Saves a change, only if the request is still in the status we read (two people answering at once) */
export async function updateLeave(restaurantId: string, l: Leave, expectedStatus: Leave["status"]): Promise<boolean> {
  const before = await getLeave(restaurantId, l.id);
  if (!before || before.status !== expectedStatus) return false;
  const res = await prisma.menuSnapshot.updateMany({
    where: { id: l.id, restaurantId, data: leaveData(strip(before)) },
    data: { data: leaveData(strip(l)) },
  });
  return res.count === 1;
}

export async function deleteLeave(restaurantId: string, id: string) {
  await prisma.menuSnapshot.deleteMany({ where: { id, restaurantId, data: { startsWith: LEAVE } } });
}

// ── Documents ────────────────────────────────────────────────────────────────

export interface StoredFile { key: string; access: "private" | "public" | "local" }
type DocRow = HrDoc & { file: StoredFile };

export async function listDocs(restaurantId: string, userId?: string): Promise<HrDoc[]> {
  const rows: Row[] = await prisma.menuSnapshot.findMany({
    where: { restaurantId, data: { startsWith: who(DOC, userId) } },
    select: { id: true, data: true }, orderBy: { createdAt: "desc" }, take: 2000,
  });
  // The storage address never leaves the server
  return rows.map((r) => parse<DocRow>(r)).filter((d): d is DocRow => !!d).map((d) => {
    const { file: _f, type: _t, ...rest } = d as DocRow & { type?: string }; void _f; void _t;
    return rest;
  });
}

export async function getDoc(restaurantId: string, id: string): Promise<DocRow | null> {
  const row: Row | null = await prisma.menuSnapshot.findFirst({ where: { id, restaurantId, data: { startsWith: DOC } }, select: { id: true, data: true } });
  return row ? parse<DocRow>(row) : null;
}

const docData = (d: Omit<HrDoc, "id">, file: StoredFile) => JSON.stringify({
  type: "hr-doc", userId: d.userId, kind: d.kind, name: d.name, fileName: d.fileName, contentType: d.contentType, size: d.size,
  validFrom: d.validFrom, validUntil: d.validUntil, note: d.note, uploadedBy: d.uploadedBy, uploadedByName: d.uploadedByName ?? "", uploadedAt: d.uploadedAt,
  archived: !!d.archived, replacedBy: d.replacedBy ?? null, archivedAt: d.archivedAt ?? null, file,
});

export async function addDoc(restaurantId: string, d: Omit<HrDoc, "id">, file: StoredFile): Promise<HrDoc> {
  const row = await prisma.menuSnapshot.create({ data: { restaurantId, label: "Staff document", data: docData(d, file) } });
  return { ...d, id: row.id };
}

/** Saves changes to a document (dates, history). The file stays the same. */
export async function updateDoc(restaurantId: string, d: HrDoc & { file: StoredFile }) {
  const { id, file, ...rest } = d;
  await prisma.menuSnapshot.updateMany({ where: { id, restaurantId, data: { startsWith: DOC } }, data: { data: docData(rest, file) } });
}

export async function deleteDoc(restaurantId: string, id: string) {
  await prisma.menuSnapshot.deleteMany({ where: { id, restaurantId, data: { startsWith: DOC } } });
}

export const newFileKey = (restaurantId: string, ext: string) => `hr/${restaurantId}/${Date.now()}-${randomUUID()}${ext}`;
