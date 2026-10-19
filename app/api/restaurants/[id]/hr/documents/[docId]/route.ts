import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { accessFor } from "@/lib/staff-access";
import { getDoc, loadHrSettings } from "@/lib/hr-store";
import { readDocFile } from "@/lib/hr-files";

// Opens one staff document. Only for "Staff documents" (hr.documents),
// or the person it belongs to when the HR rules let staff see their own contract.
// ?download=1: saves it instead of opening it.

type Params = { params: Promise<{ id: string; docId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id, docId } = await params;
    const restaurant: { id: string; ownerId: string } | null = await prisma.restaurant.findFirst({ where: { OR: [{ id }, { slug: id }] }, select: { id: true, ownerId: true } });
    if (!restaurant) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const doc = await getDoc(restaurant.id, docId);
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const access = await accessFor(session, restaurant);
    let allowed = access.permissions.has("hr.documents");
    if (!allowed && access.staff && doc.userId === session.id) allowed = (await loadHrSettings(restaurant.id)).rules.staffSeeOwnDocs;
    if (!allowed) return NextResponse.json({ error: "You don't have access to this document." }, { status: 403 });

    const body = await readDocFile(doc.file);
    if (!body) return NextResponse.json({ error: "The file could not be found." }, { status: 404 });
    // PDFs and photos open in the browser, Word files are always saved
    const inline = req.nextUrl.searchParams.get("download") !== "1" && (doc.contentType === "application/pdf" || doc.contentType.startsWith("image/"));
    const safeName = doc.fileName.replace(/[^\w.\- ]+/g, "_");
    const out: BodyInit = Buffer.isBuffer(body) ? new Uint8Array(body) : (body as ReadableStream<Uint8Array<ArrayBuffer>>);
    return new NextResponse(out, {
      headers: {
        "Content-Type": doc.contentType,
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[GET /hr/documents/[docId]]", error);
    return NextResponse.json({ error: "Could not open the document" }, { status: 500 });
  }
}
