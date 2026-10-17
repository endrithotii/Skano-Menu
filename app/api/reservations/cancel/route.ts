import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logCustomerAction } from "@/lib/action-log";
import { emailConfigured, sendEmail, simpleHtml } from "@/lib/email";
import { loadStaffAccess } from "@/lib/staff-access";
import { getReservation, saveReservation, tableText, whenText } from "@/lib/reservations";
import { closeReminders, listReminders, notifyNow, readCancelToken } from "@/lib/reservation-reminders";

// The customer cancels with the link in the reminder email (no account). The token is signed, nobody can guess it.
// GET ?token=... -> { restaurant, when, guests, table, status }
// POST { token } -> cancels, tells the restaurant (dashboard notification + email)

async function find(token: unknown) {
  const id = typeof token === "string" ? readCancelToken(token) : null;
  if (!id) return null;
  const row: { restaurantId: string } | null = await prisma.menuSnapshot.findFirst({ where: { id }, select: { restaurantId: true } });
  if (!row) return null;
  const r = await getReservation(row.restaurantId, id);
  const restaurant = await prisma.restaurant.findFirst({ where: { id: row.restaurantId }, select: { id: true, ownerId: true, name: true, slug: true, email: true, phone: true } });
  return r && restaurant ? { r, restaurant } : null;
}

const view = (r: NonNullable<Awaited<ReturnType<typeof find>>>) => ({
  restaurant: { name: r.restaurant.name, phone: r.restaurant.phone, slug: r.restaurant.slug },
  name: r.r.name, when: whenText(r.r), guests: r.r.guests, table: r.r.tableId ? tableText(r.r) : null,
  status: r.r.status, past: Date.parse(r.r.startAt) < Date.now(),
});

export async function GET(req: NextRequest) {
  const f = await find(req.nextUrl.searchParams.get("token"));
  if (!f) return NextResponse.json({ error: "This link isn't valid." }, { status: 404 });
  return NextResponse.json(view(f));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const f = await find(body?.token);
    if (!f) return NextResponse.json({ error: "This link isn't valid." }, { status: 404 });
    const { r, restaurant } = f;
    if (r.status === "cancelled") return NextResponse.json(view(f));
    if (r.status !== "accepted") return NextResponse.json({ error: "This reservation can't be cancelled anymore." }, { status: 400 });
    if (Date.parse(r.startAt) < Date.now()) return NextResponse.json({ error: "The time of this reservation has already passed." }, { status: 400 });

    r.status = "cancelled"; r.cancelledBy = "customer"; r.decidedAt = new Date().toISOString(); r.decidedBy = `${r.name} (customer)`;
    await saveReservation(restaurant.id, r);
    await closeReminders(restaurant.id, r.id, "the customer cancelled", null);

    // Tell the restaurant: the owner, everyone a reminder was for, and roles that manage reservations
    const access = await loadStaffAccess(restaurant.id);
    const reminders = await listReminders(restaurant.id, [r.id]);
    const text = `${r.name} cancelled the reservation for ${whenText(r)} (${r.guests} persons, ${r.tableId ? `table ${r.tableLabel}` : "no table"}) with the link in the reminder email.`;
    await notifyNow(restaurant.id, r.id, text, {
      owner: true,
      roles: access.roles.filter((x) => x.all || x.permissions.includes("reservations.manage")).map((x) => x.id),
      users: [...new Set(reminders.flatMap((m) => m.to.users))],
    });
    if (restaurant.email && emailConfigured()) {
      await sendEmail({
        to: restaurant.email, subject: `Cancelled: ${r.name}, ${r.guests} persons`,
        text: `${text}\nThe table is free again.\nPhone: ${r.phone}\nEmail: ${r.email}`,
        html: simpleHtml("A reservation was cancelled", [text, "The table is free again.", `Phone: ${r.phone}`, `Email: ${r.email}`]),
      });
    }
    await logCustomerAction(restaurant, "reservation.customer-cancel", r.name, `${r.name} cancelled the reservation with the email link: {{t:${r.startAt}}}, ${r.guests} persons`);
    return NextResponse.json(view({ r, restaurant }));
  } catch (error) {
    console.error("[POST reservations/cancel]", error);
    return NextResponse.json({ error: "Could not cancel. Please try again or call the restaurant." }, { status: 500 });
  }
}
