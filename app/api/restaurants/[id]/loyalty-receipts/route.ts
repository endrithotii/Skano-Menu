import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { forbidUnless } from "@/lib/staff-access";
import { logAction } from "@/lib/action-log";
import { addStamp, loadProgram, loadReceiptPhotos, parseContact } from "@/lib/loyalty";
import { addReceipt, decideReceipt, getReceipt, receiptQueue, receiptsOf, saveReceipt } from "@/lib/loyalty-receipts";
import { IMAGE_TYPES, MAX_IMAGE, saveImageFile } from "@/lib/image-files";

// Receipt photos for loyalty stamps (see lib/loyalty-receipts.ts).
// Customers (no account):
//   POST form { file, contact }          -> sends a photo of the receipt
//   GET ?contact=...                     -> { receipts: [{ status, sentAt, reason, stampsAfter }] }
// Staff with "Confirm loyalty stamps":
//   GET ?queue=1                         -> { waiting, recent, total }
//   PATCH { id, action: "approve" | "decline", reason? }

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const program = await loadProgram(id);
    if (!program) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const q = req.nextUrl.searchParams;
    if (q.get("queue")) {
      const session = await getSessionFromRequest(req);
      if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const denied = await forbidUnless(session, { id: program.restaurantId, ownerId: program.ownerId }, "loyalty.stamp");
      if (denied) return denied;
      const { waiting, recent } = await receiptQueue(program.restaurantId);
      return NextResponse.json({ waiting, recent, total: program.total, enabled: program.enabled && await loadReceiptPhotos(program.restaurantId) });
    }
    const contact = parseContact(q.get("contact"));
    if (!contact) return NextResponse.json({ receipts: [] });
    const list = await receiptsOf(program.restaurantId, contact.key, 5);
    return NextResponse.json({ receipts: list.map((r) => ({ status: r.status, sentAt: r.sentAt, reason: r.reason, stampsAfter: r.stampsAfter })) });
  } catch (error) {
    console.error("[GET loyalty-receipts]", error);
    return NextResponse.json({ error: "Could not load" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const program = await loadProgram(id);
    if (!program) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!program.enabled || !(await loadReceiptPhotos(program.restaurantId))) return NextResponse.json({ error: "This restaurant doesn't take receipt photos. Please ask the waiter." }, { status: 400 });
    const form = await req.formData();
    const contact = parseContact(form.get("contact"));
    if (!contact) return NextResponse.json({ error: "Enter a valid email address or phone number." }, { status: 400 });
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Please add the photo of your receipt." }, { status: 400 });
    if (!IMAGE_TYPES.includes(file.type)) return NextResponse.json({ error: "Please send a JPG, PNG or WEBP photo." }, { status: 400 });
    if (file.size > MAX_IMAGE) return NextResponse.json({ error: "This photo is too big. Please try again." }, { status: 400 });
    // The photo is only saved when the customer may send one now
    const check = await receiptsOf(program.restaurantId, contact.key, 20);
    if (check.some((r) => r.status === "waiting")) return NextResponse.json({ error: "Your last receipt is still being checked. You get the stamp as soon as it is." }, { status: 400 });
    const url = await saveImageFile(file, "receipts", program.restaurantId);
    const made = await addReceipt(program.restaurantId, contact.key, contact.masked, url);
    if ("error" in made) return NextResponse.json({ error: made.error }, { status: 400 });
    return NextResponse.json({ success: true, sentAt: made.receipt.sentAt });
  } catch (error) {
    console.error("[POST loyalty-receipts]", error);
    return NextResponse.json({ error: "Could not send the photo. Please try again." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const program = await loadProgram(id);
    if (!program) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const ref = { id: program.restaurantId, ownerId: program.ownerId };
    const denied = await forbidUnless(session, ref, "loyalty.stamp");
    if (denied) return denied;
    const body = await req.json().catch(() => null);
    const r = typeof body?.id === "string" ? await getReceipt(program.restaurantId, body.id) : null;
    if (!r) return NextResponse.json({ error: "That receipt was not found." }, { status: 404 });
    if (r.status !== "waiting") return NextResponse.json({ error: "Someone already checked this receipt." }, { status: 409 });
    const user = await prisma.user.findFirst({ where: { id: session.id }, select: { name: true, email: true } });
    const by = user?.name || user?.email || null;
    const reason = typeof body?.reason === "string" ? body.reason.replace(/\s+/g, " ").trim().slice(0, 200) : "";

    if (body?.action === "decline") {
      if (!(await decideReceipt(program.restaurantId, r, { status: "declined", decidedBy: by, reason, stampsAfter: null }))) return NextResponse.json({ error: "Someone already checked this receipt." }, { status: 409 });
      await logAction(session, ref, "loyalty.stamp", `Declined a receipt photo from ${r.masked}`, reason ? [`Reason: "${reason}"`] : []);
      return NextResponse.json({ success: true });
    }
    if (body?.action !== "approve") return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    // Claim it first, then give the stamp: two people can't both give it
    if (!(await decideReceipt(program.restaurantId, r, { status: "approved", decidedBy: by, reason: "", stampsAfter: null }))) return NextResponse.json({ error: "Someone already checked this receipt." }, { status: 409 });
    const claimed = await getReceipt(program.restaurantId, r.id);
    const res = await addStamp(program.restaurantId, r.key, program.total);
    if ("error" in res) {
      if (claimed) await saveReceipt({ ...claimed, status: "waiting", decidedAt: null, decidedBy: null });
      return NextResponse.json({ error: res.error }, { status: 400 });
    }
    if (claimed) await saveReceipt({ ...claimed, stampsAfter: res.card.stamps });
    await logAction(session, ref, "loyalty.stamp", `Gave a stamp for a receipt photo to ${r.masked}: ${res.card.stamps} of ${program.total}`, [`Photo sent {{t:${r.sentAt}}}`]);
    return NextResponse.json({ success: true, stamps: res.card.stamps, total: program.total });
  } catch (error) {
    console.error("[PATCH loyalty-receipts]", error);
    return NextResponse.json({ error: "Could not save" }, { status: 500 });
  }
}
