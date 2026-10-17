import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { can } from "@/lib/staff-access";
import { logAction } from "@/lib/action-log";
import { sendEmail, simpleHtml } from "@/lib/email";
import { getReservation, saveReservation, tableText, whenText } from "@/lib/reservations";
import {
  closeReminders, dropRetries, finishReminder, getReminder, isFor, openNotifications, runDueReminders, saveCall, snoozeReminder, viewerFor,
} from "@/lib/reservation-reminders";

// Notifications in the dashboard (reservation reminders for this person, see lib/reservation-reminders.ts).
// GET  -> { notifications: [{ id, kind, text, at, reservation }] }   (also sends reminders that are due)
// POST { id, action: "confirmed" | "no-answer" | "cancel" | "close", note?, againMin?, message?, email? }
//   confirmed / no-answer: the result of the call (no-answer with againMin: the same reminder again later)
//   cancel: the customer can't come, the reservation is cancelled (email only with email: true)

type Params = { params: Promise<{ id: string }> };

async function load(req: NextRequest, params: Params["params"]) {
  const session = await getSessionFromRequest(req);
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { id } = await params;
  const r = await prisma.restaurant.findFirst({ where: { OR: [{ id }, { slug: id }] }, select: { id: true, ownerId: true, name: true, email: true, phone: true } });
  if (!r) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  // The owner or one of its staff
  if (session.role !== "SUPER_ADMIN" && session.id !== r.ownerId) {
    const staff = await prisma.user.findFirst({ where: { id: session.id, staffRestaurantId: r.id }, select: { id: true } });
    if (!staff) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session, restaurant: r, viewer: await viewerFor(r, session.id, session.role === "SUPER_ADMIN") };
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const x = await load(req, params);
    if ("error" in x) return x.error;
    // Reminders that are due go out now (this runs every minute while someone has the dashboard open)
    await runDueReminders(x.restaurant.id, req.nextUrl.origin);
    const list = await openNotifications(x.restaurant.id, x.viewer);
    const out = [];
    for (const m of list.slice(0, 30)) {
      const r = await getReservation(x.restaurant.id, m.reservationId);
      if (!r) continue;
      out.push({
        id: m.id, kind: m.kind, text: m.shownText ?? m.text, at: m.firedAt ?? m.at,
        reservation: {
          id: r.id, status: r.status, startAt: r.startAt, endAt: r.endAt, guests: r.guests, name: r.name, phone: r.phone, email: r.email, note: r.note,
          table: r.tableId ? `${r.tableLabel}${r.areaName ? ` (${r.areaName})` : ""}` : null, call: r.call ?? null, cancelledBy: r.cancelledBy ?? null,
        },
      });
    }
    return NextResponse.json({ notifications: out });
  } catch (error) {
    console.error("[GET notifications]", error);
    return NextResponse.json({ error: "Could not load the notifications" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const x = await load(req, params);
    if ("error" in x) return x.error;
    const body = await req.json().catch(() => null);
    const action = body?.action;
    if (!["confirmed", "no-answer", "cancel", "close"].includes(action)) return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    const m = typeof body?.id === "string" ? await getReminder(x.restaurant.id, body.id) : null;
    if (!m || m.kind === "customer") return NextResponse.json({ error: "That notification was not found." }, { status: 404 });
    // The people it was sent to, or anyone who manages reservations
    if (!isFor(m, x.viewer) && !(await can(x.session, x.restaurant, "reservations.manage"))) {
      return NextResponse.json({ error: "This notification isn't for you." }, { status: 403 });
    }
    if (m.doneAt) return NextResponse.json({ error: "Someone already answered this notification." }, { status: 409 });
    const r = await getReservation(x.restaurant.id, m.reservationId);
    const user = await prisma.user.findFirst({ where: { id: x.session.id }, select: { name: true, email: true } });
    const by = user?.name || user?.email || null;
    const note = typeof body?.note === "string" ? body.note.replace(/\s+/g, " ").trim().slice(0, 300) : "";
    const head = r ? `${r.name}'s reservation: {{t:${r.startAt}}}, ${r.guests} persons` : "a reservation";

    if (action === "close" || !r) {
      await finishReminder(m, "closed", by);
      return NextResponse.json({ success: true });
    }

    if (action === "confirmed" || action === "no-answer") {
      await saveCall(x.restaurant.id, r, action, by, note);
      const again = typeof body?.againMin === "number" && [15, 30, 60, 120, 180].includes(body.againMin) ? body.againMin : null;
      if (action === "no-answer" && again && Date.now() + again * 60_000 < Date.parse(r.startAt)) await snoozeReminder(x.restaurant.id, m, again, by);
      else await finishReminder(m, action === "confirmed" ? "confirmed" : "no answer", by);
      if (action === "confirmed") await dropRetries(x.restaurant.id, r.id);
      await logAction(x.session, x.restaurant, "reservation.call",
        `${action === "confirmed" ? "Called and confirmed" : "Called, no answer:"} ${head}`,
        [...(note ? [`Note: "${note}"`] : []), ...(action === "no-answer" && again ? [`Reminded again in ${again} minutes`] : [])]);
      return NextResponse.json({ success: true });
    }

    // cancel: the customer can't come
    if (r.status !== "accepted") return NextResponse.json({ error: `This reservation is already ${r.status}.` }, { status: 400 });
    const message = typeof body?.message === "string" ? body.message.replace(/\s+/g, " ").trim().slice(0, 500) : "";
    r.status = "cancelled"; r.decidedAt = new Date().toISOString(); r.decidedBy = by; r.message = message;
    r.call = { result: "confirmed", at: new Date().toISOString(), by, note: note || "can't come" };
    let sent: { sent: boolean; error?: string } | null = null;
    if (body?.email === true) {
      const name = x.restaurant.name;
      const lines = [`Hi ${r.name},`, `As we talked about, your reservation for ${whenText(r)} (${r.guests} person${r.guests === 1 ? "" : "s"}, ${tableText(r)}) is cancelled.`, ...(message ? [message] : []), "You're welcome to reserve another time."];
      sent = await sendEmail({ to: r.email, fromName: name, replyTo: x.restaurant.email, subject: `Your reservation at ${name} was cancelled`, text: `${lines.join("\n\n")}\n\n${name}`, html: simpleHtml("Your reservation was cancelled", lines, name) });
      r.emailSent = sent.sent;
    }
    await saveReservation(x.restaurant.id, r);
    await finishReminder(m, "cancelled the reservation", by);
    await closeReminders(x.restaurant.id, r.id, "reservation cancelled", by);
    await logAction(x.session, x.restaurant, "reservation.cancel", `Cancelled the reservation of ${r.name} after a call: {{t:${r.startAt}}}, ${r.guests} persons`,
      [...(note ? [`Note: "${note}"`] : []), ...(message ? [`Message: "${message}"`] : []), sent ? (sent.sent ? `Email sent to ${r.email}` : `No email sent (${sent.error})`) : "No email sent (not asked)"]);
    return NextResponse.json({ success: true, emailSent: sent?.sent ?? null, emailError: sent?.error ?? null });
  } catch (error) {
    console.error("[POST notifications]", error);
    return NextResponse.json({ error: "Could not save" }, { status: 500 });
  }
}
