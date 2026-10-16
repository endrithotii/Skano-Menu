import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { forbidUnless } from "@/lib/staff-access";
import { logAction } from "@/lib/action-log";
import { emailConfigured, sendEmail, simpleHtml } from "@/lib/email";
import {
  bestTable, getReservation, listReservations, loadReservationSettings, sanitizeSettings, saveReservation, saveReservationSettings, tableText, tablesAt, whenText,
  type Reservation,
} from "@/lib/reservations";

// Reservations (needs "Reservations"). See lib/reservations.ts.
// GET ?view=requests|upcoming|history[&from=ISO&until=ISO] -> { reservations, counts, settings, emailReady }
// GET ?tablesFor=<reservation id> -> { tables: [...status at that time], suggested } (to choose a table when accepting)
// PATCH { id, action: "accept" | "refuse" | "cancel", message?, tableId? } -> answers, and emails the customer
// PATCH { id, action: "table", tableId, notify?, message? } -> another table for an accepted reservation (email only with notify)
//   accept: tableId = the table (it must be free then), null = no specific table, missing = keep the requested one
// PUT { settings } -> reservation settings

type Params = { params: Promise<{ id: string }> };

async function load(req: NextRequest, params: Params["params"]) {
  const session = await getSessionFromRequest(req);
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { id } = await params;
  const r = await prisma.restaurant.findFirst({ where: { OR: [{ id }, { slug: id }] }, select: { id: true, ownerId: true, name: true, email: true, phone: true } });
  if (!r) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  const denied = await forbidUnless(session, r, "reservations.manage");
  if (denied) return { error: denied };
  return { session, restaurant: r };
}

const time = (v: string | null) => (v && Number.isFinite(Date.parse(v)) ? new Date(v) : undefined);

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const x = await load(req, params);
    if ("error" in x) return x.error;
    const q = req.nextUrl.searchParams;
    const settings = await loadReservationSettings(x.restaurant.id);
    const forId = q.get("tablesFor");
    if (forId) {
      const r = await getReservation(x.restaurant.id, forId);
      if (!r) return NextResponse.json({ error: "That reservation was not found." }, { status: 404 });
      const minutes = Math.round((Date.parse(r.endAt) - Date.parse(r.startAt)) / 60_000);
      const { tables } = await tablesAt(x.restaurant.id, new Date(r.startAt), r.guests, { ...settings, durationMin: minutes }, r.id);
      const requested = tables.find((t) => t.id === r.tableId && t.status === "free");
      return NextResponse.json({ tables, suggested: requested?.id ?? bestTable(tables)?.id ?? null });
    }
    const now = Date.now();
    const all = await listReservations(x.restaurant.id, { from: time(q.get("from")) ?? new Date(now - 60 * 86_400_000), until: time(q.get("until")) }, 2000);
    const isRequest = (r: Reservation) => r.status === "pending" && Date.parse(r.startAt) > now - 2 * 3_600_000;
    const isUpcoming = (r: Reservation) => r.status === "accepted" && Date.parse(r.endAt) > now;
    const view = q.get("view") ?? "requests";
    const list = view === "upcoming" ? all.filter(isUpcoming) : view === "history" ? all.filter((r) => !isRequest(r) && !isUpcoming(r)).reverse() : all.filter(isRequest);
    return NextResponse.json({
      reservations: list,
      counts: { requests: all.filter(isRequest).length, upcoming: all.filter(isUpcoming).length },
      settings, emailReady: emailConfigured(),
    });
  } catch (error) {
    console.error("[GET reservations]", error);
    return NextResponse.json({ error: "Could not load the reservations" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const x = await load(req, params);
    if ("error" in x) return x.error;
    const body = await req.json().catch(() => null);
    const action = body?.action;
    if (action !== "accept" && action !== "refuse" && action !== "cancel" && action !== "table") return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    const r = typeof body?.id === "string" ? await getReservation(x.restaurant.id, body.id) : null;
    if (!r) return NextResponse.json({ error: "That reservation was not found." }, { status: 404 });
    if ((action === "accept" || action === "refuse") && r.status !== "pending") return NextResponse.json({ error: "This reservation was already answered." }, { status: 400 });
    if (action === "cancel" && r.status !== "accepted") return NextResponse.json({ error: "Only accepted reservations can be cancelled." }, { status: 400 });
    if (action === "table" && r.status !== "accepted") return NextResponse.json({ error: "Only accepted reservations can get another table." }, { status: 400 });
    const message = typeof body?.message === "string" ? body.message.replace(/\s+/g, " ").trim().slice(0, 500) : "";

    const tableBefore = r.tableId ? `table ${r.tableLabel}` : "no table";
    if (action === "accept" || action === "table") {
      // The table the manager chose (or the requested one): nobody else got it for that time in the meantime
      const settings = await loadReservationSettings(x.restaurant.id);
      const { tables } = await tablesAt(x.restaurant.id, new Date(r.startAt), r.guests, { ...settings, durationMin: Math.round((Date.parse(r.endAt) - Date.parse(r.startAt)) / 60_000) }, r.id);
      const wanted: string | null = body && "tableId" in body ? (typeof body.tableId === "string" && body.tableId ? body.tableId : null) : r.tableId;
      if (wanted) {
        const t = tables.find((v) => v.id === wanted);
        if (!t) return NextResponse.json({ error: "That table isn't on the floor plan at that time." }, { status: 400 });
        if (t.status === "taken" || t.status === "blocked") {
          return NextResponse.json({ error: t.status === "taken" ? `Table ${t.label} already has a reservation at that time.` : `Table ${t.label} is blocked at that time.` }, { status: 409 });
        }
        r.tableId = t.id; r.tableLabel = t.label; r.areaName = t.areaName;
      } else {
        r.tableId = null; r.tableLabel = ""; r.areaName = "";
      }
    }
    const tableAfter = r.tableId ? `table ${r.tableLabel}` : "no table";

    if (action === "table") {
      if (tableAfter === tableBefore) return NextResponse.json({ success: true, reservation: r, emailSent: null, emailError: null });
      let sent: { sent: boolean; error?: string } | null = null;
      if (body?.notify === true) {
        const name = x.restaurant.name;
        const lines = [`Hi ${r.name},`, `Your reservation for ${whenText(r)} (${r.guests} person${r.guests === 1 ? "" : "s"}) is still on. Your table is now ${tableText(r)}.`, ...(message ? [message] : []), "See you soon!"];
        sent = await sendEmail({ to: r.email, fromName: name, replyTo: x.restaurant.email, subject: `Your table at ${name}`, text: `${lines.join("\n\n")}\n\n${name}`, html: simpleHtml("Your table changed", lines, name) });
      }
      await saveReservation(x.restaurant.id, r);
      await logAction(x.session, x.restaurant, "reservation.table",
        `Changed the table of ${r.name}'s reservation: {{t:${r.startAt}}}, ${r.guests} persons`,
        [`Table: ${tableBefore} → ${r.tableId ? `table ${r.tableLabel}${r.areaName ? ` (${r.areaName})` : ""}` : "no specific table"}`,
          ...(sent && message ? [`Message: "${message}"`] : []), sent ? (sent.sent ? `Email sent to ${r.email}` : `No email sent (${sent.error})`) : "No email sent (not asked)"]);
      return NextResponse.json({ success: true, reservation: r, emailSent: sent?.sent ?? null, emailError: sent?.error ?? null });
    }

    const user = await prisma.user.findFirst({ where: { id: x.session.id }, select: { name: true, email: true } });
    r.status = action === "accept" ? "accepted" : action === "refuse" ? "refused" : "cancelled";
    r.decidedAt = new Date().toISOString();
    r.decidedBy = user?.name || user?.email || null;
    r.message = message;

    // The email to the customer
    const name = x.restaurant.name, when = whenText(r);
    const table = tableText(r);
    const contact = x.restaurant.phone ? `If your plans change, please call us: ${x.restaurant.phone}.` : "If your plans change, please let us know.";
    const mail = action === "accept"
      ? { subject: `Your table at ${name} is confirmed`, title: "Your table is confirmed",
          lines: [`Hi ${r.name},`, `Your reservation is confirmed: ${when}, ${r.guests} person${r.guests === 1 ? "" : "s"}, ${table}.`, ...(message ? [message] : []), contact, "See you soon!"] }
      : action === "refuse"
        ? { subject: `About your reservation request at ${name}`, title: "We can't take this reservation",
            lines: [`Hi ${r.name},`, `Sorry, we can't take your reservation for ${when} (${r.guests} person${r.guests === 1 ? "" : "s"}).`, ...(message ? [message] : []), "You're welcome to try another day or time."] }
        : { subject: `Your reservation at ${name} was cancelled`, title: "Your reservation was cancelled",
            lines: [`Hi ${r.name},`, `Your reservation for ${when} (${r.guests} person${r.guests === 1 ? "" : "s"}) was cancelled.`, ...(message ? [message] : []), "Sorry for the trouble. You're welcome to reserve another time."] };
    const sent = await sendEmail({ to: r.email, fromName: name, replyTo: x.restaurant.email, subject: mail.subject, text: `${mail.lines.join("\n\n")}\n\n${name}`, html: simpleHtml(mail.title, mail.lines, name) });
    r.emailSent = sent.sent;
    await saveReservation(x.restaurant.id, r);

    const verb = action === "accept" ? "Accepted" : action === "refuse" ? "Refused" : "Cancelled";
    await logAction(x.session, x.restaurant, action === "accept" ? "reservation.accept" : action === "refuse" ? "reservation.refuse" : "reservation.cancel",
      `${verb} the reservation of ${r.name}: {{t:${r.startAt}}}, ${r.guests} persons, ${r.tableId ? `table ${r.tableLabel}${r.areaName ? ` (${r.areaName})` : ""}` : "no specific table"}`,
      [...(action === "accept" && tableBefore !== tableAfter ? [`Table: ${tableBefore} → ${r.tableId ? `table ${r.tableLabel}${r.areaName ? ` (${r.areaName})` : ""}` : "no specific table"}`] : []),
        ...(message ? [`Message: "${message}"`] : []), sent.sent ? `Email sent to ${r.email}` : `No email sent (${sent.error})`]);
    return NextResponse.json({ success: true, reservation: r, emailSent: sent.sent, emailError: sent.error ?? null });
  } catch (error) {
    console.error("[PATCH reservations]", error);
    return NextResponse.json({ error: "Could not save" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const x = await load(req, params);
    if ("error" in x) return x.error;
    const body = await req.json().catch(() => null);
    const before = await loadReservationSettings(x.restaurant.id);
    const next = sanitizeSettings(body?.settings);
    await saveReservationSettings(x.restaurant.id, next);
    const labels: Record<string, string> = { enabled: "Online reservations", durationMin: "Table kept for (minutes)", stepMin: "Times every (minutes)", daysAhead: "Days ahead", noticeMin: "At least (minutes) before", customerPicksTable: "Who chooses the table" };
    const lines = (Object.keys(labels) as (keyof typeof next)[]).filter((k) => before[k] !== next[k])
      .map((k) => (k === "enabled" ? `Online reservations: ${next.enabled ? "on" : "off"}`
        : k === "customerPicksTable" ? `Who chooses the table: ${next.customerPicksTable ? "customers pick it on the floor plan" : "customers fill in the form, the restaurant picks the table"}`
        : `${labels[k]}: ${before[k]} → ${next[k]}`));
    if (lines.length) await logAction(x.session, x.restaurant, "reservation.settings", lines.length === 1 ? `Changed the reservation settings: ${lines[0]}` : "Changed the reservation settings", lines.length === 1 ? [] : lines);
    return NextResponse.json({ success: true, settings: next });
  } catch (error) {
    console.error("[PUT reservations]", error);
    return NextResponse.json({ error: "Could not save" }, { status: 500 });
  }
}
