import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { forbidUnless } from "@/lib/staff-access";
import { logAction } from "@/lib/action-log";
import { DEFAULT_STYLE, PRESETS, sanitizeStyle, type QrStyle } from "@/lib/qr-style";

// The look of the QR codes (needs "QR codes"). One MenuSnapshot row: '{"type":"qr-style","style":{...}}'
// GET -> { style }   PUT { style } -> { style }

type Params = { params: Promise<{ id: string }> };
const PREFIX = '{"type":"qr-style"';

async function load(req: NextRequest, params: Params["params"]) {
  const session = await getSessionFromRequest(req);
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { id } = await params;
  const r = await prisma.restaurant.findFirst({ where: { OR: [{ id }, { slug: id }] }, select: { id: true, ownerId: true } });
  if (!r) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  const denied = await forbidUnless(session, r, "qr.view");
  if (denied) return { error: denied };
  return { session, restaurant: r };
}

async function read(restaurantId: string): Promise<{ id: string | null; style: QrStyle }> {
  const row: { id: string; data: string } | null = await prisma.menuSnapshot.findFirst({ where: { restaurantId, data: { startsWith: PREFIX } }, select: { id: true, data: true } });
  try { return { id: row?.id ?? null, style: row ? sanitizeStyle(JSON.parse(row.data).style) : DEFAULT_STYLE }; } catch { return { id: row?.id ?? null, style: DEFAULT_STYLE }; }
}

export async function GET(req: NextRequest, { params }: Params) {
  const x = await load(req, params);
  if ("error" in x) return x.error;
  return NextResponse.json({ style: (await read(x.restaurant.id)).style });
}

const NAMES: Record<string, string> = { square: "squares", rounded: "rounded", dots: "dots", soft: "soft", circle: "circles", none: "no frame", label: "a text under it", card: "a frame with a text" };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const x = await load(req, params);
    if ("error" in x) return x.error;
    const body = await req.json().catch(() => null);
    const style = sanitizeStyle(body?.style);
    const before = await read(x.restaurant.id);
    const data = JSON.stringify({ type: "qr-style", style });
    if (before.id) await prisma.menuSnapshot.update({ where: { id: before.id }, data: { data } });
    else await prisma.menuSnapshot.create({ data: { restaurantId: x.restaurant.id, label: "QR code style", data } });
    const b = before.style, lines: string[] = [];
    const preset = PRESETS.find((p) => JSON.stringify(p.style) === JSON.stringify(style));
    if (b.modules !== style.modules) lines.push(`Shape: ${NAMES[b.modules]} → ${NAMES[style.modules]}`);
    if (b.eyes !== style.eyes) lines.push(`Corners: ${NAMES[b.eyes]} → ${NAMES[style.eyes]}`);
    if (b.color !== style.color) lines.push(`Color: ${b.color} → ${style.color}`);
    if (b.color2 !== style.color2) lines.push(`Gradient to: ${b.color2 ?? "none"} → ${style.color2 ?? "none"}`);
    if (b.eyeColor !== style.eyeColor) lines.push(`Corner color: ${b.eyeColor ?? "same as the code"} → ${style.eyeColor ?? "same as the code"}`);
    if (b.background !== style.background) lines.push(`Background: ${b.background} → ${style.background}`);
    if (b.frame !== style.frame) lines.push(`Frame: ${NAMES[b.frame]} → ${NAMES[style.frame]}`);
    if (b.frameText !== style.frameText) lines.push(`Frame text: "${b.frameText || "default"}" → "${style.frameText || "default"}"`);
    if (lines.length) await logAction(x.session, x.restaurant, "qr.style", preset ? `Changed the QR code style to "${preset.name}"` : "Changed the QR code style", lines);
    return NextResponse.json({ style });
  } catch (error) {
    console.error("[PUT qr-style]", error);
    return NextResponse.json({ error: "Could not save" }, { status: 500 });
  }
}
