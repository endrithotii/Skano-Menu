import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import {
  MAX_MESSAGE, activeAnnouncements, announcementStatus, createAnnouncement, deleteAnnouncement,
  listAnnouncements, migrateLegacyAnnouncement, updateAnnouncement,
} from "@/lib/announcements";

// Announcements (see lib/announcements.ts)
// GET ?public=1                         -> { announcements: [{ id, message }] } what customers see now (no sign-in)
// GET                                   -> { announcements: [...with status] } (owner)
// POST   { message, startAt?, endAt? }  -> new one (no startAt = now)
// PATCH  { id, message, startAt?, endAt? }
// DELETE ?id=...

type Params = { params: Promise<{ id: string }> };

async function findRestaurant(id: string) {
  return prisma.restaurant.findFirst({ where: { OR: [{ id }, { slug: id }] }, select: { id: true, ownerId: true, announcement: true } });
}

async function loadOwned(req: NextRequest, params: Params["params"]) {
  const session = await getSessionFromRequest(req);
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const r = await findRestaurant((await params).id);
  if (!r) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  if (session.role !== "SUPER_ADMIN" && r.ownerId !== session.id) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { restaurant: r };
}

/** Checks the text and times */
function read(body: Record<string, unknown> | null): { message: string; startAt: string; endAt: string | null } | { error: string } {
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) return { error: "Please write the announcement." };
  if (message.length > MAX_MESSAGE) return { error: `The announcement can be at most ${MAX_MESSAGE} characters.` };
  const start = typeof body?.startAt === "string" && body.startAt ? Date.parse(body.startAt) : Date.now();
  if (!Number.isFinite(start)) return { error: "The start time is not valid." };
  let endAt: string | null = null;
  if (typeof body?.endAt === "string" && body.endAt) {
    const end = Date.parse(body.endAt);
    if (!Number.isFinite(end)) return { error: "The end time is not valid." };
    if (end <= start) return { error: "The end time must be after the start time." };
    endAt = new Date(end).toISOString();
  }
  return { message, startAt: new Date(start).toISOString(), endAt };
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    if (req.nextUrl.searchParams.get("public")) {
      const r = await findRestaurant((await params).id);
      if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const list = await activeAnnouncements(r.id);
      // Not moved in yet: the old Settings text still shows
      const items = list.map((a) => ({ id: a.id, message: a.message }));
      if (!items.length && r.announcement?.trim()) items.push({ id: "legacy", message: r.announcement.trim() });
      return NextResponse.json({ announcements: items });
    }
    const auth = await loadOwned(req, params);
    if (auth.error) return auth.error;
    await migrateLegacyAnnouncement(auth.restaurant).catch((e) => console.error("[announcements] migrate", e));
    const list = await listAnnouncements(auth.restaurant.id);
    return NextResponse.json({ now: new Date().toISOString(), announcements: list.map((a) => ({ ...a, status: announcementStatus(a) })) });
  } catch (error) {
    console.error("[GET /api/restaurants/[id]/announcements]", error);
    return NextResponse.json({ error: "Could not load the announcements" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const auth = await loadOwned(req, params);
    if (auth.error) return auth.error;
    const v = read(await req.json().catch(() => null));
    if ("error" in v) return NextResponse.json({ error: v.error }, { status: 400 });
    const id = await createAnnouncement(auth.restaurant.id, v);
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("[POST /api/restaurants/[id]/announcements]", error);
    return NextResponse.json({ error: "Could not save the announcement" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const auth = await loadOwned(req, params);
    if (auth.error) return auth.error;
    const body = await req.json().catch(() => null);
    const existing = (await listAnnouncements(auth.restaurant.id)).find((a) => a.id === body?.id);
    if (!existing) return NextResponse.json({ error: "That announcement was not found." }, { status: 404 });
    const v = read(body);
    if ("error" in v) return NextResponse.json({ error: v.error }, { status: 400 });
    await updateAnnouncement(auth.restaurant.id, existing.id, v);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PATCH /api/restaurants/[id]/announcements]", error);
    return NextResponse.json({ error: "Could not save the announcement" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const auth = await loadOwned(req, params);
    if (auth.error) return auth.error;
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    await deleteAnnouncement(auth.restaurant.id, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/restaurants/[id]/announcements]", error);
    return NextResponse.json({ error: "Could not delete the announcement" }, { status: 500 });
  }
}
