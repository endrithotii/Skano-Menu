// Reminders for accepted reservations (server side).
//
//   staff:    a notification in the dashboard for chosen people / roles ("Ardiana's reservation is tomorrow, call to confirm").
//             It opens a window with the reservation: call, then Confirmed / No answer / Cancel the reservation.
//   customer: an email to the customer ("Don't forget your reservation") with a link to cancel it.
//   info:     a notification without a call (e.g. "the customer cancelled with the link").
//
// MenuSnapshot rows (no migration), createdAt = when the reminder goes off (fast "what is due" queries):
//   '{"type":"res-reminder","reservationId":"…", ...}'   (reservationId second: "contains" finds the reminders of one reservation)
//
// Nothing runs on its own on the server, so due reminders are sent by runDueReminders(), called when someone has the
// dashboard open (every minute), on public pages of the restaurant, and by /api/cron/reminders (Vercel cron or an outside pinger).

import crypto from "crypto";
import { prisma } from "@/lib/db";
import { getReservation, saveReservation, type Reservation } from "@/lib/reservations";
import { emailConfigured, sendEmail, simpleHtml } from "@/lib/email";
import { loadStaffAccess } from "@/lib/staff-access";
import { activeRoles } from "@/lib/permissions";
import { beforeLabel, type Recipients, type ReminderSpec } from "@/lib/reminder-specs";

export { BEFORE_OPTIONS, DEFAULT_CUSTOMER_TEXT, DEFAULT_REMINDERS, DEFAULT_STAFF_TEXT, sanitizeRecipients, sanitizeSpec, sanitizeSpecs, type Recipients, type ReminderSpec } from "@/lib/reminder-specs";

const REM = '{"type":"res-reminder"';

export type ReminderKind = "staff" | "customer" | "info";
export type ReminderStatus = "scheduled" | "sent" | "done" | "cancelled" | "skipped";

export interface Reminder {
  id: string;
  reservationId: string;
  kind: ReminderKind;
  /** Minutes before the reservation, or null = at a time the manager chose (`at`) */
  beforeMin: number | null;
  /** When it goes off (ISO) */
  at: string;
  /** The text with {name}, {day}, {time}, ... */
  text: string;
  /** staff / info: who gets the notification */
  to: Recipients;
  status: ReminderStatus;
  /** The text as it was sent (placeholders filled in) */
  shownText: string | null;
  firedAt: string | null;
  /** Staff: answered (Confirmed / No answer / Cancelled / Closed) */
  doneAt: string | null;
  doneBy: string | null;
  result: string | null;
  emailSent: boolean | null;
  emailError: string | null;
  createdBy: string | null;
  madeAt: string;
  /** "No answer, remind me again": a call that is still to do (cancelled when someone confirms) */
  retry?: boolean;
}

/** When a reminder goes off for this reservation */
export function fireTime(spec: Pick<ReminderSpec, "beforeMin" | "at">, r: Pick<Reservation, "startAt">): Date | null {
  if (spec.beforeMin !== null) return new Date(Date.parse(r.startAt) - spec.beforeMin * 60_000);
  return spec.at ? new Date(spec.at) : null;
}

// ── Text ─────────────────────────────────────────────────────────────────────

const ymdIn = (d: Date, tz: string) => new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: tz }).format(d);

/** "today", "tomorrow" or "on Wednesday, 22 October" (in the customer's time zone, seen from `now`) */
export function dayWord(r: Pick<Reservation, "startAt" | "timeZone">, now = new Date()): string {
  const start = new Date(r.startAt);
  const a = Date.parse(ymdIn(now, r.timeZone)), b = Date.parse(ymdIn(start, r.timeZone));
  const days = Math.round((b - a) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `on ${new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: r.timeZone }).format(start)}`;
}

export function fillText(text: string, r: Reservation, restaurantName: string, now = new Date()): string {
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: r.timeZone }).format(new Date(r.startAt));
  const values: Record<string, string> = {
    name: r.name, day: dayWord(r, now), time, guests: String(r.guests), phone: r.phone, email: r.email,
    table: r.tableId ? `table ${r.tableLabel}` : "no table yet", restaurant: restaurantName,
  };
  return text.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m);
}

// ── The cancel link in the customer's email ──────────────────────────────────

const secret = () => process.env.JWT_SECRET || "skano-menu-dev-secret";
const sign = (id: string) => crypto.createHmac("sha256", secret()).update(`cancel:${id}`).digest("base64url").slice(0, 24);
export const cancelToken = (reservationId: string) => `${reservationId}.${sign(reservationId)}`;
export function readCancelToken(token: string): string | null {
  const i = token.lastIndexOf(".");
  if (i <= 0) return null;
  const id = token.slice(0, i), sig = token.slice(i + 1);
  const want = sign(id);
  return sig.length === want.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want)) ? id : null;
}
export function appUrl(origin?: string | null): string {
  return (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || origin || "https://skano-menu.vercel.app").replace(/\/+$/, "");
}

// ── Saving ───────────────────────────────────────────────────────────────────

interface Row { id: string; data: string; createdAt: Date; restaurantId?: string }
const toData = (m: Omit<Reminder, "id">) => {
  const { reservationId, ...rest } = m;
  return JSON.stringify({ type: "res-reminder", reservationId, ...rest });
};
function parse(row: Row): Reminder | null {
  try {
    const d = JSON.parse(row.data);
    if (d?.type !== "res-reminder") return null;
    const { type: _t, ...rest } = d; void _t;
    return { ...(rest as Omit<Reminder, "id">), id: row.id };
  } catch { return null; }
}

export async function listReminders(restaurantId: string, reservationIds: string[]): Promise<Reminder[]> {
  if (!reservationIds.length) return [];
  const rows: Row[] = await prisma.menuSnapshot.findMany({
    where: { restaurantId, data: { startsWith: REM }, OR: reservationIds.map((id) => ({ data: { contains: `"reservationId":"${id}"` } })) },
    select: { id: true, data: true, createdAt: true }, orderBy: { createdAt: "asc" }, take: 500,
  });
  return rows.map(parse).filter((x): x is Reminder => !!x);
}

async function saveReminder(m: Reminder) {
  const { id, ...rest } = m;
  await prisma.menuSnapshot.update({ where: { id }, data: { data: toData(rest), createdAt: new Date(m.at) } });
}

export async function createReminder(restaurantId: string, m: Omit<Reminder, "id">): Promise<Reminder> {
  const row = await prisma.menuSnapshot.create({ data: { restaurantId, label: "Reservation reminder", data: toData(m), createdAt: new Date(m.at) }, select: { id: true } });
  return { ...m, id: row.id };
}

const blank = (reservationId: string, kind: ReminderKind, at: Date, createdBy: string | null): Omit<Reminder, "id"> => ({
  reservationId, kind, beforeMin: null, at: at.toISOString(), text: "", to: { owner: false, roles: [], users: [] },
  status: "scheduled", shownText: null, firedAt: null, doneAt: null, doneBy: null, result: null, emailSent: null, emailError: null,
  createdBy, madeAt: new Date().toISOString(),
});

export interface ReminderChange { added: Reminder[]; changed: Reminder[]; removed: Reminder[]; tooLate: ReminderSpec[] }

/**
 * The reminders of one reservation become `specs` (the ones still waiting: sent ones stay as they are).
 * A spec with `me` is for the person saving. Reminders whose time has already passed are not saved (tooLate).
 */
export async function setReminders(restaurantId: string, r: Reservation, specs: ReminderSpec[], userId: string | null, now = new Date()): Promise<ReminderChange> {
  const existing = (await listReminders(restaurantId, [r.id])).filter((m) => m.status === "scheduled" && m.kind !== "info");
  const out: ReminderChange = { added: [], changed: [], removed: [], tooLate: [] };
  const keep = new Set<string>();
  for (const s of specs) {
    const at = fireTime(s, r);
    if (!at || at.getTime() <= now.getTime()) { out.tooLate.push(s); continue; }
    let to = s.kind === "staff" ? { ...(s.to ?? { owner: false, roles: [], users: [] }), users: [...new Set([...(s.to?.users ?? []), ...(s.me && userId ? [userId] : [])])] } : { owner: false, roles: [], users: [] };
    // A notification for nobody: the person saving gets it
    if (s.kind === "staff" && !to.owner && !to.roles.length && !to.users.length && userId) to = { ...to, users: [userId] };
    const old = s.id ? existing.find((m) => m.id === s.id) : undefined;
    if (old) {
      keep.add(old.id);
      const next: Reminder = { ...old, kind: s.kind, beforeMin: s.beforeMin, at: at.toISOString(), text: s.text, to };
      if (JSON.stringify(next) !== JSON.stringify(old)) { await saveReminder(next); out.changed.push(next); }
    } else {
      out.added.push(await createReminder(restaurantId, { ...blank(r.id, s.kind, at, userId), beforeMin: s.beforeMin, text: s.text, to }));
    }
  }
  for (const m of existing) {
    if (keep.has(m.id)) continue;
    await saveReminder({ ...m, status: "cancelled" });
    out.removed.push(m);
  }
  return out;
}

/** The reservation was cancelled or refused: waiting reminders won't go off, open notifications close */
export async function closeReminders(restaurantId: string, reservationId: string, why: string, by: string | null) {
  for (const m of await listReminders(restaurantId, [reservationId])) {
    if (m.status === "scheduled") await saveReminder({ ...m, status: "cancelled" });
    else if (m.status === "sent" && m.kind !== "customer" && !m.doneAt) await saveReminder({ ...m, status: "done", doneAt: new Date().toISOString(), doneBy: by, result: why });
  }
}

/** A notification for the owner that isn't about a reservation (e.g. "Your restaurant was approved") */
export async function notifyOwner(restaurantId: string, text: string) {
  await notifyNow(restaurantId, "", text, { owner: true, roles: [], users: [] });
}

/** A notification right now (e.g. "the customer cancelled") */
export async function notifyNow(restaurantId: string, reservationId: string, text: string, to: Recipients) {
  const now = new Date();
  await createReminder(restaurantId, { ...blank(reservationId, "info", now, null), text, shownText: text, to, status: "sent", firedAt: now.toISOString() });
}

// ── Sending what is due ──────────────────────────────────────────────────────

const lastRun = new Map<string, number>();

/**
 * Sends the reminders that are due (all restaurants when restaurantId is null).
 * Each reminder is claimed first (the row only changes if nobody else changed it), so two runs never send it twice.
 */
export async function runDueReminders(restaurantId: string | null, origin?: string | null, now = new Date()): Promise<{ sent: number }> {
  const key = restaurantId ?? "*";
  if (now.getTime() - (lastRun.get(key) ?? 0) < 20_000) return { sent: 0 };
  lastRun.set(key, now.getTime());
  let sent = 0;
  try {
    const rows: Row[] = await prisma.menuSnapshot.findMany({
      where: { ...(restaurantId ? { restaurantId } : {}), data: { startsWith: REM }, createdAt: { lte: now, gte: new Date(now.getTime() - 14 * 86_400_000) } },
      select: { id: true, data: true, createdAt: true, restaurantId: true }, orderBy: { createdAt: "asc" }, take: 200,
    });
    for (const row of rows) {
      const m = parse(row);
      if (!m || m.status !== "scheduled" || !row.restaurantId) continue;
      const claimed: Reminder = { ...m, status: "sent", firedAt: now.toISOString() };
      const { id: _i, ...rest } = claimed; void _i;
      const won = await prisma.menuSnapshot.updateMany({ where: { id: m.id, data: row.data }, data: { data: toData(rest) } });
      if (!won?.count) continue;
      const res = await getReservation(row.restaurantId, m.reservationId);
      const restaurant = await prisma.restaurant.findFirst({ where: { id: row.restaurantId }, select: { name: true, email: true, phone: true } });
      // Only for reservations that still happen
      if (!res || res.status !== "accepted" || Date.parse(res.startAt) < now.getTime() || !restaurant || (m.kind === "customer" && !res.email)) {
        await saveReminder({ ...claimed, status: "skipped", result: !res ? "reservation deleted" : res.status !== "accepted" ? `reservation ${res.status}` : !restaurant ? "restaurant deleted" : m.kind === "customer" && !res.email ? "the customer has no email" : "the reservation time has passed" });
        continue;
      }
      const text = fillText(m.text, res, restaurant.name, now);
      if (m.kind === "customer") {
        const link = `${appUrl(origin)}/reserve/cancel/${encodeURIComponent(cancelToken(res.id))}`;
        const contact = restaurant.phone ? `Questions? Call us: ${restaurant.phone}.` : "";
        const lines = [`Hi ${res.name},`, text, ...(res.tableId ? [`Your table: ${res.tableLabel}${res.areaName ? ` (${res.areaName})` : ""}.`] : []), ...(contact ? [contact] : [])];
        const mail = emailConfigured()
          ? await sendEmail({
              to: res.email, fromName: restaurant.name, replyTo: restaurant.email, subject: `Reminder: your reservation at ${restaurant.name}`,
              text: `${lines.join("\n\n")}\n\nCan't come anymore? Please cancel here, so someone else can have the table:\n${link}\n\n${restaurant.name}`,
              html: simpleHtml("See you soon", lines, restaurant.name, { label: "Cancel my reservation", href: link, note: "Can't come anymore? Please cancel, so someone else can have the table." }),
            })
          : { sent: false, error: "email isn't set up" };
        await saveReminder({ ...claimed, shownText: text, emailSent: mail.sent, emailError: mail.error ?? null });
      } else {
        await saveReminder({ ...claimed, shownText: text });
      }
      sent++;
    }
  } catch (error) {
    console.error("[reminders] could not run", error);
  }
  return { sent };
}

// ── Notifications in the dashboard ───────────────────────────────────────────

export interface Viewer { id: string; owner: boolean; roleIds: string[] }

export async function viewerFor(restaurant: { id: string; ownerId: string }, userId: string, isAdmin = false): Promise<Viewer> {
  if (isAdmin || userId === restaurant.ownerId) return { id: userId, owner: true, roleIds: [] };
  const access = await loadStaffAccess(restaurant.id);
  return { id: userId, owner: false, roleIds: activeRoles(access, access.members[userId]).map((r) => r.id) };
}

export const isFor = (m: Pick<Reminder, "to">, v: Viewer) =>
  (m.to.owner && v.owner) || m.to.users.includes(v.id) || m.to.roles.some((r) => v.roleIds.includes(r));

/** Open notifications for this person (staff reminders that went off and nobody answered yet) */
export async function openNotifications(restaurantId: string, v: Viewer, now = new Date()): Promise<Reminder[]> {
  const rows: Row[] = await prisma.menuSnapshot.findMany({
    where: { restaurantId, data: { startsWith: REM }, createdAt: { lte: now, gte: new Date(now.getTime() - 30 * 86_400_000) } },
    select: { id: true, data: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 200,
  });
  return rows.map(parse).filter((m): m is Reminder => !!m && m.kind !== "customer" && m.status === "sent" && !m.doneAt && isFor(m, v));
}

export async function getReminder(restaurantId: string, id: string): Promise<Reminder | null> {
  const row: Row | null = await prisma.menuSnapshot.findFirst({ where: { restaurantId, id, data: { startsWith: REM } }, select: { id: true, data: true, createdAt: true } });
  return row ? parse(row) : null;
}

export async function finishReminder(m: Reminder, result: string, by: string | null) {
  await saveReminder({ ...m, status: "done", doneAt: new Date().toISOString(), doneBy: by, result });
}

/** "No answer, remind me again in 1 hour": the same reminder once more */
export async function snoozeReminder(restaurantId: string, m: Reminder, minutes: number, by: string | null): Promise<Reminder> {
  await finishReminder(m, `no answer, reminded again in ${minutes} min`, by);
  return createReminder(restaurantId, { ...blank(m.reservationId, "staff", new Date(Date.now() + minutes * 60_000), by), text: m.text, to: m.to, retry: true });
}

/** Someone reached the customer: the "call again" reminders aren't needed anymore */
export async function dropRetries(restaurantId: string, reservationId: string) {
  for (const m of await listReminders(restaurantId, [reservationId])) {
    if (m.retry && m.status === "scheduled") await saveReminder({ ...m, status: "cancelled" });
  }
}

/** Keeps the reservation in step: the result of the call */
export async function saveCall(restaurantId: string, r: Reservation, result: "confirmed" | "no-answer", by: string | null, note: string) {
  r.call = { result, at: new Date().toISOString(), by, note };
  await saveReservation(restaurantId, r);
}

/** "1 day before", "2 hours before", "on 22 Oct at 18:00" */
export function whenLabel(m: Pick<Reminder, "beforeMin" | "at">, timeZone?: string): string {
  if (m.beforeMin !== null) return `${beforeLabel(m.beforeMin)} before`;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, ...(timeZone ? { timeZone } : {}) }).format(new Date(m.at));
}
