import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { accessFor } from "@/lib/staff-access";
import { logAction } from "@/lib/action-log";
import { isDay } from "@/lib/hr";
import { addDoc, deleteDoc, getDoc, listDocs, loadHrSettings } from "@/lib/hr-store";
import { DOC_TYPES, MAX_DOC, deleteDocFile, saveDocFile } from "@/lib/hr-files";

// Contracts and staff documents (private, see lib/hr-files.ts).
// GET  ?userId=          -> { docs }   "Contracts and staff documents" (hr.documents): everyone's. Staff: their own (if the rules allow it)
// POST form { userId, kind, name, validFrom, validUntil, note, file }   (hr.documents)
// DELETE { id }                                                          (hr.documents)
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
    if (x.access.permissions.has("hr.documents")) return NextResponse.json({ docs: await listDocs(x.restaurant.id, userId) });
    const settings = await loadHrSettings(x.restaurant.id);
    if (!x.access.staff || !settings.rules.staffSeeOwnDocs) return NextResponse.json({ docs: [] });
    return NextResponse.json({ docs: await listDocs(x.restaurant.id, x.session.id) });
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
    const kind = form.get("kind") === "other" ? "other" : "contract";
    const clip = (v: FormDataEntryValue | null, n: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");
    const fileName = clip(file.name, 120) || "document";
    const name = clip(form.get("name"), 80) || (kind === "contract" ? "Contract" : fileName);
    const validFrom = form.get("validFrom"), validUntil = form.get("validUntil");
    const stored = await saveDocFile(file, x.restaurant.id);
    const doc = await addDoc(x.restaurant.id, {
      userId, kind, name, fileName, contentType: file.type, size: file.size,
      validFrom: isDay(validFrom) ? validFrom : null, validUntil: isDay(validUntil) ? validUntil : null,
      note: clip(form.get("note"), 300), uploadedBy: x.session.id, uploadedAt: new Date().toISOString(),
    }, stored);
    await logAction(x.session, x.restaurant, "hr.document", `Uploaded "${name}" for ${await nameOf(userId)}`, [`File: ${fileName}`]);
    return NextResponse.json({ doc });
  } catch (error) {
    console.error("[POST /hr/documents]", error);
    return bad(error instanceof Error && error.message.includes("BLOB_READ_WRITE_TOKEN") ? error.message : "The upload didn't work. Please try again.", 500);
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
