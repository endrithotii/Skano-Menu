import { NextRequest, NextResponse } from "next/server";
import { createRequest, getCard, getRequest, loadProgram, normalizeCode, parseContact, REQUEST_TTL_MS } from "@/lib/loyalty";

// Public: the customer's loyalty stamp card (More > Loyalty stamp card on the menu)
// GET ?contact=email-or-phone   -> { enabled, total, reward, masked, stamps, rewards }
// GET ?request=CODE             -> { status, kind, stamps, total } (to see when the waiter confirmed)
// POST { contact, kind }        -> { code, expiresAt } kind "stamp" (ask for a stamp) or "reward" (card is full)

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const program = await loadProgram(id);
    if (!program) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    if (!program.enabled) return NextResponse.json({ enabled: false });

    const code = normalizeCode(req.nextUrl.searchParams.get("request"));
    if (code) {
      const r = await getRequest(code);
      if (!r || r.restaurantId !== program.restaurantId) return NextResponse.json({ error: "Code not found" }, { status: 404 });
      const card = await getCard(program.restaurantId, r.key);
      return NextResponse.json({ status: r.status, kind: r.kind, stamps: card?.stamps ?? 0, rewards: card?.rewards ?? 0, total: program.total });
    }

    const contact = parseContact(req.nextUrl.searchParams.get("contact"));
    if (!contact) return NextResponse.json({ error: "Enter a valid email address or phone number." }, { status: 400 });
    const card = await getCard(program.restaurantId, contact.key);
    return NextResponse.json({
      enabled: true, total: program.total, reward: program.reward, masked: contact.masked,
      stamps: card?.stamps ?? 0, rewards: card?.rewards ?? 0,
    });
  } catch (error) {
    console.error("[GET /api/restaurants/[id]/loyalty-card]", error);
    return NextResponse.json({ error: "Could not load the card" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const program = await loadProgram(id);
    if (!program) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    if (!program.enabled) return NextResponse.json({ error: "This restaurant has no loyalty card right now." }, { status: 400 });
    const body = await req.json().catch(() => null);
    const contact = parseContact(body?.contact);
    if (!contact) return NextResponse.json({ error: "Enter a valid email address or phone number." }, { status: 400 });
    const kind = body?.kind === "reward" ? "reward" : "stamp";
    const card = await getCard(program.restaurantId, contact.key);
    const stamps = card?.stamps ?? 0;
    if (kind === "stamp" && stamps >= program.total) return NextResponse.json({ error: "Your card is full. Get your reward first." }, { status: 400 });
    if (kind === "reward" && stamps < program.total) return NextResponse.json({ error: "Your card isn't full yet." }, { status: 400 });
    const r = await createRequest(program.restaurantId, contact.key, kind);
    return NextResponse.json({ code: r.code, kind, expiresAt: new Date(Date.parse(r.createdAt) + REQUEST_TTL_MS).toISOString() });
  } catch (error) {
    console.error("[POST /api/restaurants/[id]/loyalty-card]", error);
    return NextResponse.json({ error: "Could not make a code. Please try again." }, { status: 500 });
  }
}
