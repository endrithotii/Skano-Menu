import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { accessFor } from "@/lib/staff-access";
import { logAction } from "@/lib/action-log";
import { addDays, allCategories, categoryName, contractState, dayKey, isDay, sanitizeCategories, type HrDoc } from "@/lib/hr";
import { addDoc, deleteDoc, getDoc, listDocs, loadHrSettings, saveHrSettings, updateDoc } from "@/lib/hr-store";
import { randomUUID } from "crypto";
import { DOC_TYPES, MAX_DOC, deleteDocFile, saveDocFile } from "@/lib/hr-files";

// Staff documents (private, see lib/hr-files.ts): contracts, and categories HR makes (like "Birth certificate").
// GET  ?userId=          -> { docs, categories }   "Staff documents" (hr.documents): everyone's. Staff: their own (if the rules allow it)
// POST form { userId, kind, name, validFrom, validUntil, note, file, replaces }   (hr.documents)
//   replaces=1 (contracts): the current contract moves to the contract history, ending the day before the new one starts
// PATCH { id, action: "archive" | "restore" | "dates" | "edit", validFrom?, validUntil?, name?, kind?, note? }  (hr.documents)
// PATCH { action: "category-add", name } | { action: "category-rename", categoryId, name } | { action: "category-delete", categoryId }
// DELETE { id }                                                                   (hr.documents)
// Nothing is ever deleted on its own: older contracts stay in the history.
// Opening a file: /api/restaurants/[id]/hr/documents/[docId]

type Params = { params: Promise<{ id: string }> };
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

async function load(req: NextRequest, params: Params["params"]) {
  const session = await getSessionFromRequest(req);
  if (!session) return { error: bad("Unauthorized", 401) };
  const { id } = await params;
  const restaurant: { id: string; ownerId: string } | null = await prisma.restaurant.findFirst({ where: { OR: [{ id }, { slug: id }] }, select: { id: true, ownerId: true } });
  if (!restaurant) return { error: bad("Not found", 404) };
  const access = await accessFor(session, restaurant);
  if (!access.owner && !access.staff) return { error: bad("Forbidden", 403) };
  return { session, restaurant, access };
}
const nameOf = async (userId: string) => {
  const u: { name: string | null; email: string } | null = await prisma.user.findFirst({ where: { id: userId }, select: { name: true, email: true } });
  return u?.name || u?.email || "someone";
};

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const x = await load(req, params);
    if ("error" in x) return x.error;
    const userId = req.nextUrl.searchParams.get("userId") ?? undefined;
    const settings = await loadHrSettings(x.restaurant.id);
    const categories = allCategories(settings.docCategories);
    if (x.access.permissions.has("hr.documents")) return NextResponse.json({ docs: await listDocs(x.restaurant.id, userId), categories });
    if (!x.access.staff || !settings.rules.staffSeeOwnDocs) return NextResponse.json({ docs: [], categories });
    return NextResponse.json({ docs: await listDocs(x.restaurant.id, x.session.id), categories });
  } catch (error) {
    console.error("[GET /hr/documents]", error);
    return bad("Could not load the documents", 500);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const x = await load(req, params);
    if ("error" in x) return x.error;
    if (!x.access.permissions.has("hr.documents")) return bad("You don't have access to this. Ask the manager to give you access on Staff & roles.", 403);
    const form = await req.formData();
    const userId = String(form.get("userId") ?? "");
    const staff = await prisma.user.findFirst({ where: { id: userId, staffRestaurantId: x.restaurant.id }, select: { id: true } });
    if (!staff) return bad("Pick a staff member");
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return bad("Choose a file");
    if (!DOC_TYPES[file.type]) return bad("Please use a PDF, a photo (JPG, PNG, WEBP) or a Word file.");
    if (file.size > MAX_DOC) return bad("This file is too big (more than 4 MB). Please make it smaller, for example by scanning in black and white.");
    const settings = await loadHrSettings(x.restaurant.id);
    const wanted = String(form.get("kind") ?? "contract");
    const kind = allCategories(settings.docCategories).some((c) => c.id === wanted) ? wanted : "other";
    const clip = (v: FormDataEntryValue | null, n: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");
    const fileName = clip(file.name, 120) || "document";
    const name = clip(form.get("name"), 80) || (kind === "other" ? fileName : categoryName(kind, settings.docCategories));
    const validFrom = form.get("validFrom"), validUntil = form.get("validUntil");
    const from = isDay(validFrom) ? validFrom : null, until = isDay(validUntil) ? validUntil : null;
    if (from && until && until < from) return bad("Valid until is before valid from");
    const stored = await saveDocFile(file, x.restaurant.id);
    const now = new Date().toISOString();
    const doc = await addDoc(x.restaurant.id, {
      userId, kind, name, fileName, contentType: file.type, size: file.size, validFrom: from, validUntil: until,
      note: clip(form.get("note"), 300), uploadedBy: x.session.id, uploadedByName: await nameOf(x.session.id), uploadedAt: now,
    }, stored);
    const who = await nameOf(userId);
    const details = [`File: ${fileName}`];
    // A new contract replaces the one that counts now (and one that was going to start): those go to the history
    if (kind === "contract" && form.get("replaces") === "1") {
      const tz = settings.timeZone;
      const today = dayKey(new Date(), tz);
      const ends = addDays(from ?? today, -1);
      for (const old of await listDocs(x.restaurant.id, userId)) {
        if (old.id === doc.id || old.kind !== "contract" || contractState(old, today) === "history") continue;
        const full = await getDoc(x.restaurant.id, old.id);
        if (!full) continue;
        const endsAt = full.validUntil && full.validUntil < ends ? full.validUntil : (full.validFrom && ends < full.validFrom ? full.validUntil : ends);
        // Still running until its end date: it stays the current contract until then, and moves to the history on its own
        const stillRuns = !!endsAt && endsAt >= today;
        await updateDoc(x.restaurant.id, { ...full, archived: !stillRuns, replacedBy: doc.id, archivedAt: stillRuns ? null : now, validUntil: endsAt });
        details.push(stillRuns ? `"${full.name}" ends ${endsAt}, then moves to the contract history` : `"${full.name}" moved to the contract history${endsAt ? ` (ended ${endsAt})` : ""}`);
      }
    }
    await logAction(x.session, x.restaurant, "hr.document", `Uploaded "${name}" for ${who}`, details);
    return NextResponse.json({ doc });
  } catch (error) {
    console.error("[POST /hr/documents]", error);
    return bad(error instanceof Error && error.message.includes("BLOB_READ_WRITE_TOKEN") ? error.message : "The upload didn't work. Please try again.", 500);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const x = await load(req, params);
    if ("error" in x) return x.error;
    if (!x.access.permissions.has("hr.documents")) return bad("You don't have access to this.", 403);
    const b = (await req.json().catch(() => ({}))) as { id?: string; action?: string; validFrom?: unknown; validUntil?: unknown; name?: unknown; kind?: unknown; note?: unknown; categoryId?: unknown };
    const clean = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");

    // ── Categories ──
    if (b.action?.startsWith("category-")) {
      const settings = await loadHrSettings(x.restaurant.id);
      const cats = settings.docCategories;
      const name = clean(b.name, 40);
      const taken = (n: string, except?: string) => allCategories(cats).find((c) => c.id !== except && c.name.toLowerCase() === n.toLowerCase());
      let next = cats, summary = "";
      if (b.action === "category-add") {
        if (!name) return bad("Type a name for the category");
        { const t = taken(name); if (t) return bad(`There is already a category "${t.name}"`); }
        if (cats.length >= 50) return bad("That's the most categories you can have (50)");
        next = [...cats, { id: `c-${randomUUID().slice(0, 12)}`, name }];
        summary = `Made the document category "${name}"`;
      } else if (b.action === "category-rename") {
        const c = cats.find((c) => c.id === b.categoryId);
        if (!c) return bad("Only categories you made can be renamed", 404);
        if (!name) return bad("Type a name for the category");
        { const t = taken(name, c.id); if (t) return bad(`There is already a category "${t.name}"`); }
        next = cats.map((x) => (x.id === c.id ? { ...x, name } : x));
        summary = `Renamed the document category "${c.name}" to "${name}"`;
      } else if (b.action === "category-delete") {
        const c = cats.find((c) => c.id === b.categoryId);
        if (!c) return bad("Only categories you made can be deleted", 404);
        const used = (await listDocs(x.restaurant.id)).filter((d) => d.kind === c.id).length;
        if (used) return bad(`${used} ${used === 1 ? "document is" : "documents are"} in "${c.name}". Move ${used === 1 ? "it" : "them"} to another category first.`);
        next = cats.filter((x) => x.id !== c.id);
        summary = `Deleted the document category "${c.name}"`;
      } else return bad("Unknown action");
      await saveHrSettings(x.restaurant.id, { ...settings, docCategories: sanitizeCategories(next) });
      await logAction(x.session, x.restaurant, "hr.document", summary);
      return NextResponse.json({ categories: allCategories(sanitizeCategories(next)) });
    }

    const doc = b.id ? await getDoc(x.restaurant.id, b.id) : null;
    if (!doc) return bad("Not found", 404);
    const who = await nameOf(doc.userId);
    let next: typeof doc, summary: string;
    if (b.action === "archive") {
      next = { ...doc, archived: true, archivedAt: new Date().toISOString() };
      summary = `Moved "${doc.name}" of ${who} to the contract history`;
    } else if (b.action === "restore") {
      next = { ...doc, archived: false, replacedBy: null, archivedAt: null };
      summary = `Brought "${doc.name}" of ${who} back from the contract history`;
    } else if (b.action === "dates") {
      const from = b.validFrom === null || b.validFrom === "" ? null : isDay(b.validFrom) ? b.validFrom : undefined;
      const until = b.validUntil === null || b.validUntil === "" ? null : isDay(b.validUntil) ? b.validUntil : undefined;
      if (from === undefined || until === undefined) return bad("Pick valid dates");
      if (from && until && until < from) return bad("Valid until is before valid from");
      next = { ...doc, validFrom: from, validUntil: until };
      summary = `Changed the dates of "${doc.name}" of ${who}: ${from ?? "…"} to ${until ?? "no end"}`;
    } else if (b.action === "edit") {
      const settings = await loadHrSettings(x.restaurant.id);
      const kind = typeof b.kind === "string" && allCategories(settings.docCategories).some((c) => c.id === b.kind) ? b.kind : doc.kind;
      const name = clean(b.name, 80) || doc.name;
      const from = b.validFrom === undefined ? doc.validFrom : b.validFrom === null || b.validFrom === "" ? null : isDay(b.validFrom) ? b.validFrom : undefined;
      const until = b.validUntil === undefined ? doc.validUntil : b.validUntil === null || b.validUntil === "" ? null : isDay(b.validUntil) ? b.validUntil : undefined;
      if (from === undefined || until === undefined) return bad("Pick valid dates");
      if (from && until && until < from) return bad("Valid until is before valid from");
      next = { ...doc, name, kind, validFrom: from, validUntil: until, note: b.note === undefined ? doc.note : clean(b.note, 300) };
      const lines = [
        doc.name !== name && `Name: "${doc.name}" → "${name}"`,
        doc.kind !== kind && `Category: ${categoryName(doc.kind, settings.docCategories)} → ${categoryName(kind, settings.docCategories)}`,
        (doc.validFrom !== from || doc.validUntil !== until) && `Dates: ${doc.validFrom ?? "…"} to ${doc.validUntil ?? "no end"} → ${from ?? "…"} to ${until ?? "no end"}`,
        doc.note !== next.note && "Changed the note",
      ].filter(Boolean) as string[];
      await updateDoc(x.restaurant.id, next);
      await logAction(x.session, x.restaurant, "hr.document", `Changed "${name}" of ${who}`, lines);
      const { file: _ff, ...edited } = next as HrDoc & { file?: unknown }; void _ff;
      return NextResponse.json({ doc: edited });
    } else return bad("Unknown action");
    await updateDoc(x.restaurant.id, next);
    await logAction(x.session, x.restaurant, "hr.document", summary);
    const { file: _f, ...out } = next as HrDoc & { file?: unknown }; void _f;
    return NextResponse.json({ doc: out });
  } catch (error) {
    console.error("[PATCH /hr/documents]", error);
    return bad("Could not save. Please try again.", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const x = await load(req, params);
    if ("error" in x) return x.error;
    if (!x.access.permissions.has("hr.documents")) return bad("You don't have access to this.", 403);
    const { id } = (await req.json().catch(() => ({}))) as { id?: string };
    const doc = id ? await getDoc(x.restaurant.id, id) : null;
    if (!doc) return bad("Not found", 404);
    await deleteDoc(x.restaurant.id, doc.id);
    await deleteDocFile(doc.file);
    await logAction(x.session, x.restaurant, "hr.document", `Deleted "${doc.name}" of ${await nameOf(doc.userId)}`, [`File: ${doc.fileName}`]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE /hr/documents]", error);
    return bad("Could not delete. Please try again.", 500);
  }
}
