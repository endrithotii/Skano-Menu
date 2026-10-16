import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { emailConfigured, sendEmail, simpleHtml } from "@/lib/email";
import { loadReservationSettings, readRequest, requestTable, tablesAt, whenText } from "@/lib/reservations";

// Public: customers reserve a table (/reserve/<restaurant>). See lib/reservations.ts.
// GET                      -> { restaurant, enabled, settings }
// GET ?start=ISO&guests=n  -> also { plan, tables: [{ id, label, seats, minGuests, areaId, areaName, status }] }
// POST { startAt, guests, tableId?, name, email, phone, note?, timeZone } -> { reservation: { status, table, when } }

type Params = { params: Promise<{ id: string }> };

async function find(id: string) {
  return prisma.restaurant.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    select: { id: true, name: true, slug: true, ownerId: true, email: true, phone: true, logo: true, primaryColor: true },
  });
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const r = await find((await params).id);
    if (!r) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    const settings = await loadReservationSettings(r.id);
    const base = { restaurant: { id: r.id, name: r.name, slug: r.slug, phone: r.phone, logo: r.logo, color: r.primaryColor }, enabled: settings.enabled, settings };
    const q = req.nextUrl.searchParams;
    const start = q.get("start") ? Date.parse(q.get("start")!) : NaN;
    if (!settings.enabled || !Number.isFinite(start)) return NextResponse.json(base);
    const guests = Math.max(1, Math.min(30, Math.round(Number(q.get("guests")) || 2)));
    const { plan, tables } = await tablesAt(r.id, new Date(start), guests, settings);
    return NextResponse.json({ ...base, plan, tables: tables.map(({ blockReason: _b, ...t }) => { void _b; return t; }) });
  } catch (error) {
    console.error("[GET reserve]", error);
    return NextResponse.json({ error: "Could not load" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const r = await find((await params).id);
    if (!r) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    const input = readRequest(await req.json().catch(() => null));
    if ("error" in input) return NextResponse.json({ error: input.error }, { status: 400 });
    const result = await requestTable(r.id, input);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status ?? 400 });
    const res = result.reservation;
    const when = whenText(res);
    const table = `${res.tableLabel}${res.areaName ? ` (${res.areaName})` : ""}`;

    if (emailConfigured()) {
      // The customer: we got it. The restaurant: someone is waiting for an answer.
      await sendEmail({
        to: res.email, fromName: r.name, replyTo: r.email,
        subject: `Your reservation request at ${r.name}`,
        text: `Hi ${res.name},\n\nWe got your request for ${when}, ${res.guests} person${res.guests === 1 ? "" : "s"}, table ${table}.\nThe restaurant will confirm it soon. You'll get another email with the answer.\n\n${r.name}`,
        html: simpleHtml(`We got your request`, [`Hi ${res.name},`, `${when}, ${res.guests} person${res.guests === 1 ? "" : "s"}, table ${table}.`, "The restaurant will confirm it soon. You'll get another email with the answer."], r.name),
      });
      const owner = await prisma.user.findFirst({ where: { id: r.ownerId }, select: { email: true } });
      const to = r.email || owner?.email;
      if (to) {
        await sendEmail({
          to, replyTo: res.email, subject: `New reservation request: ${res.name}, ${res.guests} persons`,
          text: `${res.name} asks for ${when}, ${res.guests} persons, table ${table}.\nPhone: ${res.phone}\nEmail: ${res.email}${res.note ? `\nNote: ${res.note}` : ""}\n\nAccept or refuse it on the Reservations page of your dashboard.`,
          html: simpleHtml("New reservation request", [`${res.name} asks for ${when}`, `${res.guests} persons, table ${table}`, `Phone: ${res.phone}`, `Email: ${res.email}`, ...(res.note ? [`Note: ${res.note}`] : []), "Accept or refuse it on the Reservations page of your dashboard."]),
        });
      }
    }
    return NextResponse.json({ reservation: { status: res.status, table: res.tableLabel, area: res.areaName, when, guests: res.guests } }, { status: 201 });
  } catch (error) {
    console.error("[POST reserve]", error);
    return NextResponse.json({ error: "Could not send your request. Please try again." }, { status: 500 });
  }
}
