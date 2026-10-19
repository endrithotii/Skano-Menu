import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { accessFor, loadStaffAccess, STAFF_ROLES, type Access } from "@/lib/staff-access";
import { activeRoles } from "@/lib/permissions";
import { logAction } from "@/lib/action-log";
import { notifyNow } from "@/lib/reservation-reminders";
import { emailConfigured, sendEmail, simpleHtml } from "@/lib/email";
import {
  FORGOT_HOURS, addDays, balances, checkOwnRequest, dayKey, emptyPerson, entryHours, fmtHours, isDay, leaveDays, leaveDaysByYear, leaveHours,
  leaveAmount, leavePhrase, leaveWhen, plannedHours, readLeaveInput, rulesFor, sanitizePerson, sanitizeRules, validZone, weekStart, workedHours,
  type HrSettings, type Leave, type TimeEntry,
} from "@/lib/hr";
import {
  addEntry, addLeave, deleteEntry, getEntry, getLeave, listEntries, listLeaves, loadHrSettings, openEntries, openEntry, saveEntry,
  saveHrSettings, updateLeave,
} from "@/lib/hr-store";

// HR (see lib/hr.ts). Staff do their own things, "HR: hours, time off and work times" (hr.manage) does everyone's.
// GET ?scope=me                      -> my check-in, hours, work times, time off and balances      (any staff member)
// GET ?scope=team&from=&to=          -> everyone's hours, time off, balances, rules, work times     (hr.manage; hr.documents: the staff list)
// POST { action, ... }
//   checkin { note? } | checkout { note? } | request { kind, from, to, half, startTime, endTime, reason } | cancel { id }   (staff, for themselves)
//   decide { id, approve, answer } | add-leave { userId, ...request } | remove-leave { id }
//   add-entry { userId, in, out, note } | edit-entry { id, in, out, note } | delete-entry { id } | checkout-for { userId }
//   rules { rules, timeZone } | person { userId, person }                                                         (hr.manage)
// Every request may send tz (the browser's time zone), used until HR saves the rules.

type Params = { params: Promise<{ id: string }> };
type Restaurant = { id: string; ownerId: string; name: string };
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

async function load(req: NextRequest, params: Params["params"]) {
  const session = await getSessionFromRequest(req);
  if (!session) return { error: bad("Unauthorized", 401) };
  const { id } = await params;
  const restaurant: Restaurant | null = await prisma.restaurant.findFirst({ where: { OR: [{ id }, { slug: id }] }, select: { id: true, ownerId: true, name: true } });
  if (!restaurant) return { error: bad("Not found", 404) };
  const access = await accessFor(session, restaurant);
  if (!access.owner && !access.staff) return { error: bad("Forbidden", 403) };
  return { session, restaurant, access };
}

const canManage = (a: Access) => a.permissions.has("hr.manage");

/** Staff accounts of the restaurant, with the roles they have now */
async function staffList(restaurantId: string) {
  const users: { id: string; name: string | null; email: string; role: string }[] = await prisma.user.findMany({
    where: { staffRestaurantId: restaurantId, role: { in: STAFF_ROLES } }, select: { id: true, name: true, email: true, role: true }, orderBy: { name: "asc" },
  });
  const access = await loadStaffAccess(restaurantId);
  return users.map((u) => ({ id: u.id, name: u.name || u.email, email: u.email, roles: activeRoles(access, access.members[u.id]).map((r) => r.name) }));
}

/** Everyone who should hear about time off: the owner, roles with hr.manage, people allowed hr.manage */
async function hrRecipients(restaurantId: string) {
  const access = await loadStaffAccess(restaurantId);
  const roles = access.roles.filter((r) => r.all || r.permissions.includes("hr.manage")).map((r) => r.id);
  const users = Object.entries(access.members).filter(([, m]) => m.rules.some((x) => x.permission === "hr.manage" && x.allow)).map(([id]) => id);
  return { owner: true, roles, users };
}

const nameOf = async (userId: string) => {
  const u: { name: string | null; email: string } | null = await prisma.user.findFirst({ where: { id: userId }, select: { name: true, email: true } });
  return u?.name || u?.email || "Someone";
};
const isStaffOf = async (restaurantId: string, userId: unknown) =>
  typeof userId === "string" && !!(await prisma.user.findFirst({ where: { id: userId, staffRestaurantId: restaurantId }, select: { id: true } }));

const timeText = (iso: string, tz: string) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const zoneFrom = (req: NextRequest, body?: Record<string, unknown>) => {
  const z = body?.tz ?? req.nextUrl.searchParams.get("tz");
  return validZone(z) ? z : "UTC";
};

/** Hours of each person between two days */
function hoursFor(settings: HrSettings, entries: TimeEntry[], leaves: Leave[], userId: string, from: string, to: string) {
  const worked = workedHours(entries, userId, from, to, settings.timeZone);
  const planned = plannedHours(settings, userId, leaves, from, to);
  return { worked, planned, diff: Math.round((worked - planned) * 100) / 100 };
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const x = await load(req, params);
    if ("error" in x) return x.error;
    const { restaurant, session, access } = x;
    const settings = await loadHrSettings(restaurant.id, zoneFrom(req));
    const tz = settings.timeZone;
    const today = dayKey(new Date(), tz);
    const scope = req.nextUrl.searchParams.get("scope");

    if (scope === "me") {
      if (!access.staff) return NextResponse.json({ staff: false });
      const monthStart = `${today.slice(0, 7)}-01`;
      const since = new Date(Date.parse(`${addDays(monthStart, -40)}T00:00:00Z`));
      const [entries, leaves, open] = await Promise.all([
        listEntries(restaurant.id, since, new Date(), session.id), listLeaves(restaurant.id, session.id), openEntry(restaurant.id, session.id),
      ]);
      const wk = weekStart(today);
      const r = rulesFor(settings, session.id);
      return NextResponse.json({
        staff: true, timeZone: tz, today,
        open, entries: entries.slice(-120).reverse(),
        leaves,
        balances: balances(settings, session.id, leaves, today.slice(0, 4)),
        person: settings.people[session.id] ?? emptyPerson(),
        rules: { ...r, noticeDays: settings.rules.noticeDays, sickAutoApprove: settings.rules.sickAutoApprove },
        week: { from: wk, to: addDays(wk, 6), ...hoursFor(settings, entries, leaves, session.id, wk, addDays(wk, 6)) },
        month: { from: monthStart, to: today, ...hoursFor(settings, entries, leaves, session.id, monthStart, today) },
        canSeeDocs: settings.rules.staffSeeOwnDocs,
      });
    }

    // The HR tab
    const manage = canManage(access);
    if (!manage && !access.permissions.has("hr.documents")) return bad("You don't have access to this. Ask the manager to give you access on Staff & roles.", 403);
    const staff = await staffList(restaurant.id);
    if (!manage) return NextResponse.json({ manage: false, staff, timeZone: tz, today });

    const qFrom = req.nextUrl.searchParams.get("from"), qTo = req.nextUrl.searchParams.get("to");
    const from = isDay(qFrom) ? qFrom : weekStart(today);
    const to = isDay(qTo) && qTo >= from ? qTo : addDays(from, 6);
    // A bit wider than the days asked, then filtered by the day in the restaurant's time zone
    const [entries, leaves, open] = await Promise.all([
      listEntries(restaurant.id, new Date(Date.parse(`${from}T00:00:00Z`) - 86400000), new Date(Date.parse(`${to}T23:59:59Z`) + 86400000)),
      listLeaves(restaurant.id),
      openEntries(restaurant.id),
    ]);
    const inRange = entries.filter((e) => { const d = dayKey(e.in, tz); return d >= from && d <= to; });
    const year = to.slice(0, 4);
    return NextResponse.json({
      manage: true, timeZone: tz, today, from, to, settings,
      staff: staff.map((s) => ({
        ...s,
        person: settings.people[s.id] ?? emptyPerson(),
        hours: hoursFor(settings, entries, leaves, s.id, from, to),
        balances: balances(settings, s.id, leaves, year),
        open: open.find((e) => e.userId === s.id) ?? null,
      })),
      entries: inRange.reverse(),
      leaves,
      forgot: open.filter((e) => entryHours(e) > FORGOT_HOURS).map((e) => e.userId),
    });
  } catch (error) {
    console.error("[GET /hr]", error);
    return bad("Could not load HR", 500);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const x = await load(req, params);
    if ("error" in x) return x.error;
    const { restaurant, session, access } = x;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const settings = await loadHrSettings(restaurant.id, zoneFrom(req, body));
    const tz = settings.timeZone;
    const today = dayKey(new Date(), tz);
    const now = new Date().toISOString();
    const action = String(body.action ?? "");
    const note = typeof body.note === "string" ? body.note.replace(/\s+/g, " ").trim().slice(0, 200) : "";

    // ── Staff, for themselves ──
    if (["checkin", "checkout", "request", "cancel"].includes(action)) {
      if (!access.staff) return bad("Only staff accounts can do this. The owner isn't counted as staff.", 403);

      if (action === "checkin") {
        const open = await openEntry(restaurant.id, session.id);
        if (open) return bad(`You're already checked in since ${timeText(open.in, tz)}`, 409);
        const e = await addEntry(restaurant.id, { userId: session.id, in: now, out: null, note, source: "self", editedBy: null, editedAt: null });
        await logAction(session, restaurant, "hr.check", "Checked in");
        return NextResponse.json({ entry: e });
      }
      if (action === "checkout") {
        const open = await openEntry(restaurant.id, session.id);
        if (!open) return bad("You're not checked in", 409);
        const e: TimeEntry = { ...open, out: now, note: [open.note, note].filter(Boolean).join(" · ").slice(0, 200) };
        await saveEntry(restaurant.id, e);
        await logAction(session, restaurant, "hr.check", `Checked out after ${fmtHours(entryHours(e))}`);
        return NextResponse.json({ entry: e });
      }
      if (action === "request") {
        const input = readLeaveInput(body);
        if (typeof input === "string") return bad(input);
        const mine = await listLeaves(restaurant.id, session.id);
        const problem = checkOwnRequest(settings, session.id, input, mine, today);
        if (problem) return bad(problem);
        const person = settings.people[session.id];
        const auto = input.kind === "sick" && settings.rules.sickAutoApprove;
        const l = await addLeave(restaurant.id, {
          userId: session.id, ...input, days: leaveDays(person, input), hours: leaveHours(person, input), byYear: leaveDaysByYear(person, input),
          status: auto ? "approved" : "pending", answer: "", requestedAt: now, requestedBy: session.id,
          decidedBy: null, decidedAt: auto ? now : null,
        });
        const who = await nameOf(session.id);
        const what = `${leavePhrase(l.kind)} ${leaveWhen(l)} (${leaveAmount(l)})`;
        await logAction(session, restaurant, "hr.request", auto ? `Reported sick: ${leaveWhen(l)}` : `Asked for ${what}`, l.reason ? [`Reason: ${l.reason}`] : []);
        const to = await hrRecipients(restaurant.id);
        after(() => notifyNow(restaurant.id, "", auto ? `${who} is sick: ${leaveWhen(l)} (${leaveAmount(l)}).` : `${who} asks for ${what}.`, to, "/dashboard/hr?tab=timeoff").catch((e) => console.error("[hr] notify", e)));
        return NextResponse.json({ leave: l });
      }
      if (action === "cancel") {
        const l = await getLeave(restaurant.id, String(body.id ?? ""));
        if (!l || l.userId !== session.id) return bad("Not found", 404);
        if (l.status === "approved" && l.to < today) return bad("This time off is already over");
        if (l.status !== "pending" && l.status !== "approved") return bad("This request is already closed");
        const ok = await updateLeave(restaurant.id, { ...l, status: "cancelled", decidedBy: session.id, decidedAt: now }, l.status);
        if (!ok) return bad("Someone answered this request just now. Please reload.", 409);
        await logAction(session, restaurant, "hr.request", `Cancelled ${leavePhrase(l.kind)} ${leaveWhen(l)}`);
        if (l.status === "approved") {
          const to = await hrRecipients(restaurant.id);
          const who = await nameOf(session.id);
          after(() => notifyNow(restaurant.id, "", `${who} cancelled approved ${leavePhrase(l.kind)} ${leaveWhen(l)}.`, to, "/dashboard/hr?tab=timeoff").catch(() => null));
        }
        return NextResponse.json({ ok: true });
      }
    }

    // ── HR ──
    if (!canManage(access)) return bad("You don't have access to this. Ask the manager to give you access on Staff & roles.", 403);

    if (action === "decide") {
      const l = await getLeave(restaurant.id, String(body.id ?? ""));
      if (!l) return bad("Not found", 404);
      if (l.status !== "pending") return bad("This request was already answered", 409);
      const approve = body.approve === true;
      const answer = typeof body.answer === "string" ? body.answer.replace(/\s+/g, " ").trim().slice(0, 300) : "";
      const next: Leave = { ...l, status: approve ? "approved" : "declined", answer, decidedBy: session.id, decidedAt: now };
      if (!(await updateLeave(restaurant.id, next, "pending"))) return bad("Someone answered this request just now. Please reload.", 409);
      const who = await nameOf(l.userId);
      const text = `Your ${leavePhrase(l.kind)} ${leaveWhen(l)} was ${approve ? "approved" : "declined"}.${answer ? ` "${answer}"` : ""}`;
      await logAction(session, restaurant, "hr.decide", `${approve ? "Approved" : "Declined"} ${who}'s ${leavePhrase(l.kind)} ${leaveWhen(l)}`, answer ? [`Note: ${answer}`] : []);
      const user: { email: string; name: string | null } | null = await prisma.user.findFirst({ where: { id: l.userId }, select: { email: true, name: true } });
      after(async () => {
        await notifyNow(restaurant.id, "", text, { owner: false, roles: [], users: [l.userId] }, "/dashboard/my-work").catch(() => null);
        if (user?.email && emailConfigured()) {
          await sendEmail({
            to: user.email, subject: `${restaurant.name}: time off ${approve ? "approved" : "declined"}`,
            text: `Hi ${user.name || ""},\n\n${text}\n\n${restaurant.name}`,
            html: simpleHtml(`Time off ${approve ? "approved" : "declined"}`, [`Hi ${user.name || ""},`, text], restaurant.name),
          }).catch((e) => console.error("[hr] email", e));
        }
      });
      return NextResponse.json({ leave: next });
    }

    if (action === "add-leave") {
      if (!(await isStaffOf(restaurant.id, body.userId))) return bad("Pick a staff member");
      const userId = body.userId as string;
      const input = readLeaveInput(body);
      if (typeof input === "string") return bad(input);
      const person = settings.people[userId];
      const days = leaveDays(person, input);
      if (!days) return bad("There are no work days in these dates. Set the work times first, or pick other days.");
      const clash = (await listLeaves(restaurant.id, userId)).find((l) => (l.status === "approved" || l.status === "pending") && l.from <= input.to && l.to >= input.from);
      if (clash) return bad(`There is already time off on ${leaveWhen(clash)} (${clash.status === "pending" ? "waiting for an answer" : "approved"})`);
      const l = await addLeave(restaurant.id, {
        userId, ...input, days, hours: leaveHours(person, input), byYear: leaveDaysByYear(person, input), status: "approved", answer: "",
        requestedAt: now, requestedBy: session.id, decidedBy: session.id, decidedAt: now,
      });
      const who = await nameOf(userId);
      await logAction(session, restaurant, "hr.leave", `Added ${leavePhrase(l.kind)} for ${who}: ${leaveWhen(l)} (${leaveAmount(l)})`, l.reason ? [`Reason: ${l.reason}`] : []);
      after(() => notifyNow(restaurant.id, "", `HR added ${leavePhrase(l.kind)} for you: ${leaveWhen(l)}.`, { owner: false, roles: [], users: [userId] }, "/dashboard/my-work").catch(() => null));
      return NextResponse.json({ leave: l });
    }

    if (action === "remove-leave") {
      const l = await getLeave(restaurant.id, String(body.id ?? ""));
      if (!l) return bad("Not found", 404);
      if (l.status !== "approved" && l.status !== "pending") return bad("This time off is already closed");
      const ok = await updateLeave(restaurant.id, { ...l, status: "cancelled", answer: l.answer || "Removed by HR", decidedBy: session.id, decidedAt: now }, l.status);
      if (!ok) return bad("This request changed just now. Please reload.", 409);
      const who = await nameOf(l.userId);
      await logAction(session, restaurant, "hr.leave", `Removed ${who}'s ${leavePhrase(l.kind)} ${leaveWhen(l)}`);
      after(() => notifyNow(restaurant.id, "", `HR removed your ${leavePhrase(l.kind)} ${leaveWhen(l)}.`, { owner: false, roles: [], users: [l.userId] }, "/dashboard/my-work").catch(() => null));
      return NextResponse.json({ ok: true });
    }

    if (action === "add-entry" || action === "edit-entry") {
      const inAt = typeof body.in === "string" ? Date.parse(body.in) : NaN;
      const outAt = body.out === null || body.out === "" || body.out === undefined ? null : typeof body.out === "string" ? Date.parse(body.out) : NaN;
      if (!Number.isFinite(inAt)) return bad("Pick when they started");
      if (outAt !== null && !Number.isFinite(outAt)) return bad("Pick when they finished");
      if (inAt > Date.now() + 5 * 60000) return bad("The start is in the future");
      if (outAt !== null && outAt <= inAt) return bad("The end must be after the start");
      if (outAt !== null && outAt - inAt > 24 * 3600000) return bad("That's more than 24 hours. Add two separate days.");
      const inIso = new Date(inAt).toISOString(), outIso = outAt === null ? null : new Date(outAt).toISOString();
      if (action === "add-entry") {
        if (!(await isStaffOf(restaurant.id, body.userId))) return bad("Pick a staff member");
        const userId = body.userId as string;
        if (outIso === null && (await openEntry(restaurant.id, userId))) return bad("They're already checked in. Add an end time.");
        const e = await addEntry(restaurant.id, { userId, in: inIso, out: outIso, note, source: "manual", editedBy: session.id, editedAt: now });
        await logAction(session, restaurant, "hr.hours", `Added hours for ${await nameOf(userId)}: ${timeText(inIso, tz)} to ${outIso ? timeText(outIso, tz) : "now"}`, note ? [`Note: ${note}`] : []);
        return NextResponse.json({ entry: e });
      }
      const before = await getEntry(restaurant.id, String(body.id ?? ""));
      if (!before) return bad("Not found", 404);
      const e: TimeEntry = { ...before, in: inIso, out: outIso, note, source: "manual", editedBy: session.id, editedAt: now };
      await saveEntry(restaurant.id, e);
      await logAction(session, restaurant, "hr.hours", `Fixed hours of ${await nameOf(e.userId)}`, [
        `Before: ${timeText(before.in, tz)} to ${before.out ? timeText(before.out, tz) : "still checked in"}`,
        `After: ${timeText(inIso, tz)} to ${outIso ? timeText(outIso, tz) : "still checked in"}`,
      ]);
      return NextResponse.json({ entry: e });
    }

    if (action === "delete-entry") {
      const e = await getEntry(restaurant.id, String(body.id ?? ""));
      if (!e) return bad("Not found", 404);
      await deleteEntry(restaurant.id, e.id);
      await logAction(session, restaurant, "hr.hours", `Deleted hours of ${await nameOf(e.userId)}: ${timeText(e.in, tz)} to ${e.out ? timeText(e.out, tz) : "still checked in"}`);
      return NextResponse.json({ ok: true });
    }

    if (action === "checkout-for") {
      if (!(await isStaffOf(restaurant.id, body.userId))) return bad("Pick a staff member");
      const open = await openEntry(restaurant.id, body.userId as string);
      if (!open) return bad("They're not checked in", 409);
      const at = typeof body.at === "string" && Number.isFinite(Date.parse(body.at)) ? new Date(body.at).toISOString() : now;
      if (Date.parse(at) <= Date.parse(open.in)) return bad("The end must be after the check-in");
      const e: TimeEntry = { ...open, out: at, source: "manual", editedBy: session.id, editedAt: now };
      await saveEntry(restaurant.id, e);
      await logAction(session, restaurant, "hr.hours", `Checked out ${await nameOf(open.userId)} at ${timeText(at, tz)}`);
      return NextResponse.json({ entry: e });
    }

    if (action === "rules") {
      const rules = sanitizeRules(body.rules);
      const next: HrSettings = { ...settings, rules, timeZone: validZone(body.timeZone) ? body.timeZone : settings.timeZone };
      await saveHrSettings(restaurant.id, next);
      const b = settings.rules, lines: string[] = [];
      if (b.vacationDays !== rules.vacationDays) lines.push(`Vacation days: ${b.vacationDays} → ${rules.vacationDays}`);
      if (b.sickDays !== rules.sickDays) lines.push(`Sick days: ${b.sickDays} → ${rules.sickDays}`);
      if (b.minUnit !== rules.minUnit) lines.push(`Smallest time off: ${b.minUnit} → ${rules.minUnit}`);
      if (b.noticeDays !== rules.noticeDays) lines.push(`Ask ahead: ${b.noticeDays} → ${rules.noticeDays} days`);
      if (b.sickAutoApprove !== rules.sickAutoApprove) lines.push(`Sick days count right away: ${rules.sickAutoApprove ? "yes" : "no"}`);
      if (b.staffSeeOwnDocs !== rules.staffSeeOwnDocs) lines.push(`Staff see their own contract: ${rules.staffSeeOwnDocs ? "yes" : "no"}`);
      if (settings.timeZone !== next.timeZone) lines.push(`Time zone: ${settings.timeZone} → ${next.timeZone}`);
      await logAction(session, restaurant, "hr.rules", "Changed the HR rules", lines);
      return NextResponse.json({ settings: next });
    }

    if (action === "person") {
      if (!(await isStaffOf(restaurant.id, body.userId))) return bad("Pick a staff member");
      const userId = body.userId as string;
      const person = sanitizePerson(body.person);
      const next: HrSettings = { ...settings, people: { ...settings.people, [userId]: person } };
      await saveHrSettings(restaurant.id, next);
      await logAction(session, restaurant, "hr.schedule", `Changed the work times and days of ${await nameOf(userId)}`);
      return NextResponse.json({ person });
    }

    return bad("Unknown action");
  } catch (error) {
    console.error("[POST /hr]", error);
    return bad("Could not save. Please try again.", 500);
  }
}
