import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { CURRENCIES, findDishesSimple, formatPrice, parsePrice, type Dish, type DishDetails, type FoundDish } from "@/lib/dish-details";
import { digitalMenuDishes, getDishDetails, listMenusForDetails, loadDishSettings, sanitizeDishes, saveDishDetails, saveDishSettings } from "@/lib/dish-details";
import { getDesign } from "@/lib/menu-design";
import { accessFor } from "@/lib/staff-access";
import type { Permission } from "@/lib/permissions";
import { logAction } from "@/lib/action-log";

// Ingredients & details (owner or chef of the restaurant). See lib/dish-details.ts
// GET              -> { restaurantName, menus: [...], isOwner, settings: { askEnabled } }
// GET ?key=...     -> { menu, details, designText?, designDishes?, startDishes? }
// PUT { key, dishes, listConfirmed, sourceUrl } -> saves
// PATCH { askEnabled } -> customers can (not) ask about the dishes on the menu
// PATCH { currency }   -> the restaurant's currency (owner only)

type Params = { params: Promise<{ id: string }> };

async function load(req: NextRequest, params: Params["params"], need: Permission[]) {
  const session = await getSessionFromRequest(req);
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { id } = await params;
  const r = await prisma.restaurant.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    select: { id: true, name: true, ownerId: true, menuPdfUrl: true, primaryMenu: true, currency: true },
  });
  if (!r) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  const access = await accessFor(session, r);
  if (!need.some((p) => access.permissions.has(p))) {
    return { error: NextResponse.json({ error: "You don't have access to this. Ask the manager to give you access on Staff & roles." }, { status: 403 }) };
  }
  return { session, restaurant: r, access };
}

const ingredientsText = (d: Dish) => d.ingredients.map((i) => (i.note ? `${i.name} (${i.note})` : i.name)).join(", ") || "none";

type Base = { name: string; section: string; price: number | null };
const nameKey = (n: string) => n.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Action history for a save on Ingredients & details. Only what the person really changed:
 * - compared with the last save (dishes paired by id, then by name)
 * - the first save of a menu is compared with the dishes the platform read from the menu (`baseline`),
 *   so dishes that were already on the menu don't show as "added"
 * Every price change is its own entry.
 */
async function logDishChanges(session: { id: string; role: string }, r: { id: string; ownerId: string; currency?: string | null }, menuTitle: string,
  before: DishDetails | null, dishes: Dish[], listConfirmed: boolean, baseline: Base[] | null) {
  const cur = r.currency || "€";
  const price = (n: number | null | undefined) => (n === null || n === undefined ? "no price" : formatPrice(n, cur));
  const list: string[] = [];
  const details: string[] = [];
  const prices: { name: string; from: number | null; to: number | null }[] = [];

  if (!before) {
    // First save: compare with what was read from the menu
    const base = new Map((baseline ?? []).map((b) => [nameKey(b.name), b]));
    const seen = new Set<string>();
    for (const d of dishes) {
      const b = base.get(nameKey(d.name));
      if (!b) { if (baseline) list.push(`Added the dish "${d.name}"${d.price !== null ? ` (${price(d.price)})` : ""}, it was not read from the menu`); continue; }
      seen.add(nameKey(d.name));
      if ((b.price ?? null) !== (d.price ?? null)) prices.push({ name: d.name, from: b.price ?? null, to: d.price ?? null });
      if (nameKey(b.section) !== nameKey(d.section)) list.push(`"${d.name}": section "${b.section || "none"}" → "${d.section || "none"}"`);
    }
    for (const b of baseline ?? []) if (!seen.has(nameKey(b.name))) list.push(`Removed "${b.name}" (it was read from the menu)`);
    const head = `Saved the dish list of "${menuTitle}" for the first time (${dishes.length} dish${dishes.length === 1 ? "" : "es"})`;
    await logAction(session, r, "dish.list", head, [
      baseline ? `${baseline.length} dish${baseline.length === 1 ? " was" : "es were"} read from the menu` : "The dishes were typed in by hand",
      ...list,
      ...prices.map((p) => `"${p.name}": price ${price(p.from)} → ${price(p.to)}`),
      ...(baseline && !list.length && !prices.length ? ["The dishes and prices are the same as read from the menu"] : []),
      ...(listConfirmed ? ["Checked the list of dishes"] : []),
    ]);
    for (const p of prices.slice(0, 30)) {
      await logAction(session, r, "dish.price", `Changed the price of "${p.name}" from ${price(p.from)} to ${price(p.to)}`, [`Menu: ${menuTitle}`, "Before: the price read from the menu"]);
    }
    return;
  }

  // Pair with the last save: same id, or else the same name (e.g. after "Read the menu again")
  const oldById = new Map(before.dishes.map((d) => [d.id, d]));
  const used = new Set<string>();
  const pairs: { o: Dish | null; d: Dish }[] = dishes.map((d) => {
    const o = oldById.get(d.id);
    if (o) used.add(o.id);
    return { o: o ?? null, d };
  });
  for (const p of pairs) {
    if (p.o) continue;
    const o = before.dishes.find((x) => !used.has(x.id) && nameKey(x.name) === nameKey(p.d.name));
    if (o) { used.add(o.id); p.o = o; }
  }
  for (const { o, d } of pairs) {
    if (!o) { list.push(`Added the dish "${d.name}"${d.price !== null ? ` (${price(d.price)})` : ""}`); continue; }
    if (o.name !== d.name) list.push(`Renamed "${o.name}" to "${d.name}"`);
    if (nameKey(o.section) !== nameKey(d.section)) list.push(`"${d.name}": section "${o.section || "none"}" → "${d.section || "none"}"`);
    if ((o.price ?? null) !== (d.price ?? null)) prices.push({ name: d.name, from: o.price ?? null, to: d.price ?? null });
    if (ingredientsText(o) !== ingredientsText(d)) details.push(`${d.name}: ingredients ${ingredientsText(o)} → ${ingredientsText(d)}`);
    if ((o.note || "") !== (d.note || "")) details.push(`${d.name}: note "${o.note || "none"}" → "${d.note || "none"}"`);
    if ((o.prepMinutes ?? null) !== (d.prepMinutes ?? null)) details.push(`${d.name}: serving time ${o.prepMinutes ?? "none"} → ${d.prepMinutes ?? "none"} min`);
  }
  for (const o of before.dishes) if (!used.has(o.id)) list.push(`Removed the dish "${o.name}"`);
  if (listConfirmed && !before.listConfirmed) list.push("Checked the list of dishes");

  for (const p of prices.slice(0, 30)) {
    await logAction(session, r, "dish.price", `Changed the price of "${p.name}" from ${price(p.from)} to ${price(p.to)}`, [`Menu: ${menuTitle}`]);
  }
  if (list.length) await logAction(session, r, "dish.list", list.length === 1 ? `${list[0]} on "${menuTitle}"` : `Changed the dishes of "${menuTitle}"`, list.length === 1 ? [] : list);
  if (details.length) {
    const names = new Set(details.map((l) => l.split(":")[0]));
    await logAction(session, r, "dish.details", details.length === 1 ? `Changed ${details[0]}` : `Changed the details of ${names.size === 1 ? `"${[...names][0]}"` : `${names.size} dishes`} on "${menuTitle}"`,
      details.length === 1 ? [`Menu: ${menuTitle}`] : details);
  }
}

/** The dishes the platform reads from the menu by itself (designs and the digital menu), to compare a first save with */
async function serverBaseline(restaurantId: string, menu: { kind: string; designId: string | null }): Promise<Base[] | null> {
  if (menu.kind === "digital") return (await digitalMenuDishes(restaurantId)).map((d) => ({ name: d.name, section: d.section, price: d.price }));
  if (menu.kind === "design" && menu.designId) {
    const d = await getDesign(restaurantId, menu.designId);
    if (!d) return null;
    const text = designText(d.design as unknown as Parameters<typeof designText>[0]);
    return designDishes(d.design as unknown as Parameters<typeof designDishes>[0], findDishesSimple(text)).map((f) => ({ name: f.name, section: f.section, price: f.price ?? null }));
  }
  return null;
}

/** The list the browser read from a PDF or photo menu (only used for the history) */
function clientBaseline(v: unknown): Base[] | null {
  if (!Array.isArray(v)) return null;
  return v.slice(0, 300).map((x) => {
    const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
    return { name: typeof o.name === "string" ? o.name.slice(0, 80) : "", section: typeof o.section === "string" ? o.section.slice(0, 60) : "", price: parsePrice(o.price) };
  }).filter((b) => b.name.trim());
}

type DesignEl = { type: string; text?: string; name?: string; description?: string; price?: string; x: number; y: number; w: number; h: number; hidden?: boolean };

/**
 * The dishes of a designed menu: every "Menu item" element (name, description, price) is a dish, under the
 * heading above it in the same column. Text boxes written like "Omelette 4.50" are found too.
 */
function designDishes(design: { pages: { elements: DesignEl[] }[] }, fromText: FoundDish[]): FoundDish[] {
  const out: (FoundDish & { order: [number, number, number, number] })[] = [];
  const looksLikeHeading = (e: DesignEl) => {
    const t = (e.text ?? "").trim();
    return t.length >= 2 && t.length <= 40 && !t.includes("\n") && !/\d/.test(t);
  };
  for (const page of design.pages) {
    const visible = page.elements.filter((e) => !e.hidden);
    const headings = visible.filter((e) => e.type === "text" && looksLikeHeading(e));
    const items = visible.filter((e) => e.type === "item" && (e.name ?? "").trim());
    const headingOf = (el: DesignEl) => headings
      .filter((h) => h !== el && h.y + h.h / 2 <= el.y + 2 && h.x < el.x + el.w && h.x + h.w > el.x)
      .sort((a, b) => b.y - a.y)[0];
    const pageNo = design.pages.indexOf(page);
    // Dishes written in plain text boxes: place them under their heading too
    for (const f of fromText) {
      const box = visible.find((e) => e.type === "text" && (e.text ?? "").toLowerCase().includes(f.name.toLowerCase()));
      if (!box || out.some((o) => o.name.toLowerCase() === f.name.toLowerCase())) continue;
      const h = headingOf(box);
      const sec = h ? (h.text ?? "").trim() : f.section;
      out.push({ ...f, section: sec ? sec.charAt(0) + sec.slice(1).toLowerCase() : "", order: [pageNo, h?.y ?? -1, h?.x ?? box.x, box.y] });
    }
    for (const it of items) {
      const above = headingOf(it);
      const section = above ? (above.text ?? "").trim() : "";
      const desc = (it.description ?? "").replace(/\s+/g, " ").trim();
      out.push({
        name: (it.name ?? "").trim().slice(0, 80),
        section: section ? section.charAt(0) + section.slice(1).toLowerCase() : "",
        menuText: desc.slice(0, 300),
        price: parsePrice(it.price ?? ""),
        ingredients: desc ? desc.split(/,| and | e | me /i).map((x) => x.trim()).filter((x) => x && x.length < 40) : [],
        // Reading order: page, then heading (top, then left column first), then down the column
        order: [pageNo, above?.y ?? -1, above?.x ?? it.x, it.y],
      });
    }
  }
  // Dishes in text boxes that weren't found on any page stay at the end
  const rest = fromText.filter((f) => !out.some((o) => o.name.toLowerCase() === f.name.toLowerCase()));
  out.sort((a, b) => a.order[0] - b.order[0] || a.order[1] - b.order[1] || a.order[2] - b.order[2] || a.order[3] - b.order[3]);
  return [...out.map((d) => ({ name: d.name, section: d.section, menuText: d.menuText, ingredients: d.ingredients, price: d.price ?? null })), ...rest];
}

/** The text of a designed menu, in reading order (boxes on the same row joined) */
function designText(design: { pages: { elements: { type: string; text?: string; x: number; y: number; h: number; hidden?: boolean }[] }[] }): string {
  const lines: string[] = [];
  for (const page of design.pages) {
    const els = page.elements.filter((e) => e.type === "text" && e.text?.trim() && !e.hidden).sort((a, b) => a.y - b.y || a.x - b.x);
    let row: typeof els = [];
    const flush = () => { if (row.length) lines.push(row.sort((a, b) => a.x - b.x).map((e) => e.text!.trim()).join("  ")); row = []; };
    for (const e of els) {
      if (row.length && Math.abs(e.y - row[0].y) > Math.max(6, row[0].h * 0.5)) flush();
      // A box with several lines stays several lines
      if (e.text!.includes("\n")) { flush(); lines.push(...e.text!.split("\n")); continue; }
      row.push(e);
    }
    flush();
  }
  return lines.join("\n");
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const x = await load(req, params, ["details.edit", "details.ask"]);
    if ("error" in x) return x.error;
    const r = x.restaurant;
    const menus = await listMenusForDetails(r);
    const key = req.nextUrl.searchParams.get("key");
    if (!key) {
      return NextResponse.json({
        restaurantName: r.name, menus,
        // What this person may change on the page
        canEdit: x.access.permissions.has("details.edit"),
        canToggleAsk: x.access.permissions.has("details.ask"),
        canChangeCurrency: x.access.permissions.has("settings.edit"),
        settings: { ...(await loadDishSettings(r.id)), currency: r.currency || "€" },
        currencies: CURRENCIES,
      });
    }
    const menu = menus.find((m) => m.key === key);
    if (!menu) return NextResponse.json({ error: "That menu was not found." }, { status: 404 });
    const details = await getDishDetails(r.id, key);
    let text: string | undefined;
    let fromDesign: FoundDish[] | undefined;
    if (menu.kind === "design" && menu.designId) {
      const d = await getDesign(r.id, menu.designId);
      if (d) {
        text = designText(d.design as unknown as Parameters<typeof designText>[0]);
        // Menu items of the design, plus dishes written in plain text boxes ("Omelette 4.50")
        fromDesign = designDishes(d.design as unknown as Parameters<typeof designDishes>[0], findDishesSimple(text));
      }
    }
    const startDishes = menu.kind === "digital" && !details ? await digitalMenuDishes(r.id) : undefined;
    return NextResponse.json({ menu, details, designText: text, designDishes: fromDesign, startDishes });
  } catch (error) {
    console.error("[GET /api/restaurants/[id]/dish-details]", error);
    return NextResponse.json({ error: "Could not load" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const x = await load(req, params, ["details.edit"]);
    if ("error" in x) return x.error;
    const body = await req.json().catch(() => null);
    const key = typeof body?.key === "string" ? body.key : "";
    const menus = await listMenusForDetails(x.restaurant);
    if (!menus.some((m) => m.key === key)) return NextResponse.json({ error: "That menu was not found." }, { status: 404 });
    const dishes = sanitizeDishes(body?.dishes);
    const before = await getDishDetails(x.restaurant.id, key);
    await saveDishDetails(x.restaurant.id, {
      key, dishes, listConfirmed: body?.listConfirmed === true,
      sourceUrl: typeof body?.sourceUrl === "string" ? body.sourceUrl : null,
      updatedAt: new Date().toISOString(), updatedBy: x.session.name ?? x.session.email ?? null,
    });
    const menu = menus.find((m) => m.key === key)!;
    const baseline = before ? null : (await serverBaseline(x.restaurant.id, menu)) ?? clientBaseline(body?.baseline);
    await logDishChanges(x.session, x.restaurant, menu.title, before, dishes, body?.listConfirmed === true, baseline);
    return NextResponse.json({ success: true, dishes });
  } catch (error) {
    console.error("[PUT /api/restaurants/[id]/dish-details]", error);
    return NextResponse.json({ error: "Could not save" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const x = await load(req, params, ["details.ask", "settings.edit"]);
    if ("error" in x) return x.error;
    const body = await req.json().catch(() => null);
    if (typeof body?.currency === "string") {
      if (!x.access.permissions.has("settings.edit")) return NextResponse.json({ error: "You don't have access to change the currency." }, { status: 403 });
      const currency = body.currency.trim();
      if (!CURRENCIES.some((c) => c.value === currency)) return NextResponse.json({ error: "Unknown currency" }, { status: 400 });
      await prisma.restaurant.update({ where: { id: x.restaurant.id }, data: { currency } });
      if (currency !== (x.restaurant.currency || "€")) await logAction(x.session, x.restaurant, "currency.change", `Changed the currency from ${x.restaurant.currency || "€"} to ${currency}`);
      return NextResponse.json({ success: true, currency });
    }
    if (typeof body?.askEnabled !== "boolean") return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
    if (!x.access.permissions.has("details.ask")) return NextResponse.json({ error: "You don't have access to turn this on or off." }, { status: 403 });
    const was = (await loadDishSettings(x.restaurant.id)).askEnabled;
    await saveDishSettings(x.restaurant.id, { askEnabled: body.askEnabled });
    if (was !== body.askEnabled) await logAction(x.session, x.restaurant, "ask.toggle", body.askEnabled ? "Turned \"Ask about the dishes\" on" : "Turned \"Ask about the dishes\" off");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PATCH /api/restaurants/[id]/dish-details]", error);
    return NextResponse.json({ error: "Could not save" }, { status: 500 });
  }
}
