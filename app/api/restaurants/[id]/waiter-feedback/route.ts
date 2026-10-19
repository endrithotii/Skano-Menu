import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { accessFor } from "@/lib/staff-access";
import { logAction } from "@/lib/action-log";
import {
  WAITER_TAGS, addWaiterFeedback, deleteWaiterFeedback, listWaiterFeedback, loadWaiterSettings, publicNames, rateable,
  sanitizeWaiterSettings, saveWaiterSettings, staffForFeedback, tooMany,
} from "@/lib/waiter-feedback";

// Feedback about waiters (see lib/waiter-feedback.ts).
// GET                 -> { enabled, waiters: [{ id, name }], tags }                 public, for More > Rate your waiter
// GET ?scope=manage   -> { settings, staff, feedback }                               "Customer feedback" (feedback.manage)
// GET ?scope=mine     -> { enabled, feedback }                                       a staff member: feedback about themselves (if allowed)
// POST { waiterId, rating, tags, comment, customerName }                             public
// PATCH { enabled?, people?, showToWaiters? }                                        feedback.manage
// DELETE { id }                                                                      feedback.manage

type Params = { params: Promise<{ id: string }> };
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
const find = async (idOrSlug: string) => prisma.restaurant.findFirst({ where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] }, select: { id: true, ownerId: true } }) as Promise<{ id: string; ownerId: string } | null>;

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const r = await find((await params).id);
    if (!r) return bad("Not found", 404);
    const settings = await loadWaiterSettings(r.id);
    const scope = req.nextUrl.searchParams.get("scope");

    if (scope === "manage" || scope === "mine") {
      const session = await getSessionFromRequest(req);
      if (!session) return bad("Unauthorized", 401);
      const access = await accessFor(session, r);
      if (scope === "manage") {
        if (!access.permissions.has("feedback.manage")) return bad("You don't have access to this. Ask the manager to give you access on Staff & roles.", 403);
        const [staff, feedback] = await Promise.all([staffForFeedback(r.id), listWaiterFeedback(r.id)]);
        return NextResponse.json({ settings, staff, rateable: rateable(settings, staff).map((s) => s.id), feedback, tags: WAITER_TAGS });
      }
      if (!access.staff || !settings.showToWaiters) return NextResponse.json({ enabled: false, feedback: [] });
      // Without the customer's name: the waiter sees what was said, not who said it
      const mine = (await listWaiterFeedback(r.id, session.id)).map(({ customerName: _n, ...f }) => { void _n; return f; });
      return NextResponse.json({ enabled: true, feedback: mine });
    }

    if (!settings.enabled) return NextResponse.json({ enabled: false, waiters: [], tags: WAITER_TAGS });
    const waiters = publicNames(rateable(settings, await staffForFeedback(r.id)));
    return NextResponse.json({ enabled: waiters.length > 0, waiters, tags: WAITER_TAGS });
  } catch (error) {
    console.error("[GET /waiter-feedback]", error);
    return bad("Could not load", 500);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const r = await find((await params).id);
    if (!r) return bad("Not found", 404);
    const settings = await loadWaiterSettings(r.id);
    if (!settings.enabled) return bad("This restaurant doesn't collect feedback about waiters right now.", 403);
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const list = rateable(settings, await staffForFeedback(r.id));
    if (typeof b.waiterId !== "string" || !list.some((s) => s.id === b.waiterId)) return bad("Pick your waiter");
    const rating = Number(b.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return bad("Choose 1 to 5 stars");
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
    if (tooMany(`${r.id}|${ip}`)) return bad("You sent a lot of feedback just now. Please try again in a few minutes.", 429);
    const clip = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");
    const tags = Array.isArray(b.tags) ? [...new Set(b.tags.filter((t): t is string => typeof t === "string" && WAITER_TAGS.includes(t)))] : [];
    const f = await addWaiterFeedback(r.id, { waiterId: b.waiterId, rating, tags, comment: clip(b.comment, 1000), customerName: clip(b.customerName, 80) });
    return NextResponse.json({ ok: true, id: f.id }, { status: 201 });
  } catch (error) {
    console.error("[POST /waiter-feedback]", error);
    return bad("Could not send it. Please try again.", 500);
  }
}

async function manager(req: NextRequest, params: Params["params"]) {
  const session = await getSessionFromRequest(req);
  if (!session) return { error: bad("Unauthorized", 401) };
  const r = await find((await params).id);
  if (!r) return { error: bad("Not found", 404) };
  const access = await accessFor(session, r);
  if (!access.permissions.has("feedback.manage")) return { error: bad("You don't have access to this.", 403) };
  return { session, r };
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const x = await manager(req, params);
    if ("error" in x) return x.error;
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const before = await loadWaiterSettings(x.r.id);
    const next = sanitizeWaiterSettings({ ...before, ...b });
    // Only staff of this restaurant can be picked
    if (next.people) { const ids = new Set((await staffForFeedback(x.r.id)).map((s) => s.id)); next.people = next.people.filter((id) => ids.has(id)); }
    await saveWaiterSettings(x.r.id, next);
    const lines: string[] = [];
    if (before.enabled !== next.enabled) lines.push(`Customers can rate waiters: ${next.enabled ? "on" : "off"}`);
    if (JSON.stringify(before.people) !== JSON.stringify(next.people)) lines.push(next.people === null ? "Who can be rated: everyone with the Waiter role" : `Who can be rated: ${next.people.length} chosen staff`);
    if (before.showToWaiters !== next.showToWaiters) lines.push(`Waiters see feedback about themselves: ${next.showToWaiters ? "yes" : "no"}`);
    if (lines.length) await logAction(x.session, x.r, "feedback.waiters", lines.length === 1 ? lines[0] : "Changed feedback about waiters", lines.length > 1 ? lines : []);
    return NextResponse.json({ settings: next });
  } catch (error) {
    console.error("[PATCH /waiter-feedback]", error);
    return bad("Could not save. Please try again.", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const x = await manager(req, params);
    if ("error" in x) return x.error;
    const { id } = (await req.json().catch(() => ({}))) as { id?: string };
    if (!id) return bad("Not found", 404);
    await deleteWaiterFeedback(x.r.id, id);
    await logAction(x.session, x.r, "feedback.waiters", "Deleted a feedback about a waiter");
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE /waiter-feedback]", error);
    return bad("Could not delete. Please try again.", 500);
  }
}
