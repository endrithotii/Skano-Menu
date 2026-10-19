import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/db";
import { loadStaffAccess } from "@/lib/staff-access";
import { notifyNow } from "@/lib/reservation-reminders";
import { KINDS, guestStatus, roomTitle, statusLabel, type OrderItem, type ServiceKind } from "@/lib/room-service-types";
import { addOrder, getOrder, loadRoomSettings, orderToken, orderableDishes, tooManyOrders, updateOrder } from "@/lib/room-service";

// Room service and Table ordering for guests (public). See lib/room-service.ts.
// app/api/restaurants/[id]/room-service and .../table-service both use these.
// GET ?room=<roomId>            -> { enabled, name, mode, steps, welcome, askName, room, dishes, currency }
// GET ?order=<id>&t=<token>     -> { order }   the guest follows their order
// POST { roomId?, room?, guestName, text, items: [{ dishId, qty, note }] } -> { id, token, number }
// POST { action: "feedback", order, t, rating, comment, items: [{ dishId, rating }] }   once, after it was delivered

type Params = { params: Promise<{ id: string }> };
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
const find = async (idOrSlug: string) => prisma.restaurant.findFirst({
  where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
  select: { id: true, ownerId: true, name: true, slug: true, menuPdfUrl: true, primaryMenu: true, currency: true, status: true },
}) as Promise<{ id: string; ownerId: string; name: string; slug: string; menuPdfUrl: string | null; primaryMenu: string; currency: string | null; status: string } | null>;

export function guestRoutes(kind: ServiceKind) {
const K = KINDS[kind];

async function GET(req: NextRequest, { params }: Params) {
  try {
    const r = await find((await params).id);
    if (!r) return bad("Not found", 404);
    const q = req.nextUrl.searchParams;

    if (q.get("order")) {
      const o = await getOrder(r.id, q.get("order")!, kind);
      if (!o || orderToken(o.id, o.token) !== q.get("t")) return bad("Order not found", 404);
      const s = await loadRoomSettings(r.id, kind);
      return NextResponse.json({ order: {
        number: o.number, room: o.room, guestName: o.guestName, text: o.text, items: o.items, total: o.total, status: o.status,
        statusLabel: statusLabel(kind, o.status), statusText: guestStatus(kind, o.status), reason: o.reason, createdAt: o.createdAt, history: o.history.map(({ status, at }) => ({ status, at })),
        feedback: o.feedback, canRate: s.feedback && o.status === "delivered" && !o.feedback,
      }, currency: r.currency || "€", name: r.name });
    }

    const s = await loadRoomSettings(r.id, kind);
    if (!s.enabled) return NextResponse.json({ enabled: false, name: r.name });
    const room = q.get("room") ? s.rooms.find((x) => x.id === q.get("room")) ?? null : null;
    const dishes = s.mode === "text" ? [] : await orderableDishes(r);
    // No dishes in Ingredients & details yet: guests write their order
    const mode = s.mode !== "text" && dishes.length === 0 ? "text" : s.mode;
    return NextResponse.json({
      enabled: true, name: r.name, mode, steps: s.steps, welcome: s.welcome, askName: s.askName,
      room, roomUnknown: !!q.get("room") && !room, prefix: s.roomPrefix, dishes: mode === "text" ? [] : dishes, currency: r.currency || "€",
      // The official menu: the same page customers open with the restaurant's QR code
      menuUrl: s.menuView === "official" ? `/r/${encodeURIComponent(r.slug)}` : null,
    });
  } catch (error) {
    console.error(`[GET ${K.api}]`, error);
    return bad("Could not load", 500);
  }
}

async function POST(req: NextRequest, { params }: Params) {
  try {
    const r = await find((await params).id);
    if (!r) return bad("Not found", 404);
    const s = await loadRoomSettings(r.id, kind);
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const clip = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");

    if (b.action === "feedback") {
      if (!s.feedback) return bad("Feedback is turned off.", 403);
      const o = await getOrder(r.id, String(b.order ?? ""), kind);
      if (!o || orderToken(o.id, o.token) !== b.t) return bad("Order not found", 404);
      if (o.status !== "delivered") return bad("You can rate the food after it's delivered.");
      if (o.feedback) return bad("You already rated this order. Thank you!", 409);
      const star = (v: unknown) => { const n = Math.round(Number(v)); return n >= 1 && n <= 5 ? n : 0; };
      const rating = star(b.rating);
      if (!rating) return bad("Pick 1 to 5 stars");
      const items: { dishId: string; name: string; rating: number }[] = [];
      for (const raw of Array.isArray(b.items) ? b.items.slice(0, 50) : []) {
        const it = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
        const dish = o.items.find((x) => x.dishId === it.dishId);
        const n = star(it.rating);
        if (dish && n && !items.some((x) => x.dishId === dish.dishId)) items.push({ dishId: dish.dishId, name: dish.name, rating: n });
      }
      const feedback = { rating, comment: typeof b.comment === "string" ? b.comment.trim().slice(0, 500) : "", items, at: new Date().toISOString() };
      if (!(await updateOrder(r.id, { ...o, feedback }, "delivered", kind))) return bad("Could not save. Please try again.", 409);
      after(async () => {
        const access = await loadStaffAccess(r.id);
        const roles = access.roles.filter((x) => x.all || x.permissions.includes(K.perm.orders)).map((x) => x.id);
        const users = Object.entries(access.members).filter(([, m]) => m.rules.some((x) => x.permission === K.perm.orders && x.allow)).map(([id]) => id);
        await notifyNow(r.id, "", `${K.title} #${o.number} (${o.room}) rated the food ${rating}/5${feedback.comment ? `: "${feedback.comment.slice(0, 80)}"` : "."}`, { owner: true, roles, users }, `${K.dashboard}?tab=feedback`).catch((e) => console.error("[room-service] notify", e));
      });
      return NextResponse.json({ feedback });
    }

    if (!s.enabled) return bad(K.closed, 403);

    const roomObj = typeof b.roomId === "string" ? s.rooms.find((x) => x.id === b.roomId) ?? null : null;
    const typed = clip(b.room, 80);
    // A number the guest wrote gets the same "Table " / "Room " as the codes. A name stays as it is.
    const room = roomObj ? roomTitle(s.roomPrefix, roomObj.name) : /^\d{1,5}[a-z]?$/i.test(typed) ? roomTitle(s.roomPrefix, typed) : typed;
    if (!room) return bad(K.askError);
    const guestName = clip(b.guestName, 80);
    if (s.askName && !guestName) return bad("Write your name");
    const text = s.mode === "menu" ? "" : (typeof b.text === "string" ? b.text.trim().slice(0, 1000) : "");

    // Dishes: names and prices come from the menu, never from the phone
    const items: OrderItem[] = [];
    if (s.mode !== "text" && Array.isArray(b.items) && b.items.length) {
      const dishes = await orderableDishes(r);
      for (const raw of b.items.slice(0, 50)) {
        const it = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
        const d = dishes.find((x) => x.id === it.dishId);
        const qty = Math.round(Number(it.qty));
        if (!d || !Number.isFinite(qty) || qty < 1) continue;
        const existing = items.find((x) => x.dishId === d.id && x.note === clip(it.note, 120));
        if (existing) existing.qty = Math.min(20, existing.qty + qty);
        else items.push({ dishId: d.id, name: d.name, qty: Math.min(20, qty), price: d.price, note: clip(it.note, 120) });
      }
    }
    if (!items.length && !text) return bad(s.mode === "menu" ? "Pick at least one dish" : "Write what you'd like, or pick a dish");
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
    if (tooManyOrders(`${kind}|${r.id}|${ip}`)) return bad("You sent a lot of orders just now. Please try again in a few minutes.", 429);

    const total = items.length && items.every((i) => i.price !== null) ? Math.round(items.reduce((n, i) => n + (i.price ?? 0) * i.qty, 0) * 100) / 100 : null;
    const o = await addOrder(r.id, { roomId: roomObj?.id ?? null, room, guestName, text, items, total }, kind);

    // The bell for the owner and everyone who handles room service orders
    after(async () => {
      const access = await loadStaffAccess(r.id);
      const roles = access.roles.filter((x) => x.all || x.permissions.includes(K.perm.orders)).map((x) => x.id);
      const users = Object.entries(access.members).filter(([, m]) => m.rules.some((x) => x.permission === K.perm.orders && x.allow)).map(([id]) => id);
      const what = items.length ? `${items.reduce((n, i) => n + i.qty, 0)} ${items.length === 1 && items[0].qty === 1 ? "dish" : "dishes"}` : "a written order";
      await notifyNow(r.id, "", `${K.title} #${o.number}: ${room}${guestName ? ` (${guestName})` : ""}, ${what}.`, { owner: true, roles, users }, K.dashboard).catch((e) => console.error("[room-service] notify", e));
    });
    return NextResponse.json({ id: o.id, token: o.token, number: o.number }, { status: 201 });
  } catch (error) {
    console.error(`[POST ${K.api}]`, error);
    return bad("Could not send the order. Please try again.", 500);
  }
}

return { GET, POST };
}
