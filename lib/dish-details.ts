// Ingredients & details: for every dish of a menu, what it is made of, with a comment per ingredient
// ("eggs", "oil: olive oil", "cheese: cottage cheese").
//
// One record per menu, in the MenuSnapshot table (no migration):
//   '{"type":"dish-details","key":"menu:<menuId>" | "digital","dishes":[...],"listConfirmed":true,...}'
// "menu:<menuId>" = a PDF / photo / designed menu from the Menu history, "digital" = the old categories & items menu.

import { prisma } from "@/lib/db";
import { listBookMenus, type BookMenu } from "@/lib/menu-history";
import { listDesigns, type StoredDesign } from "@/lib/menu-design";
import { loadMenuTree } from "@/lib/menu-tree";
import { treeMenuIds, type MenuTree } from "@/lib/menu-tree-types";
import { listSchedules, scheduleStatus, type MenuSchedule } from "@/lib/menu-schedule";
import { parseMenuPages } from "@/lib/menu-pages";
import { can } from "@/lib/staff-access";

const PREFIX = '{"type":"dish-details"';
export const LIMITS = { dishes: 300, ingredients: 40, name: 80, note: 200, section: 60 };

export interface Ingredient { name: string; note: string }
export interface Dish {
  id: string;
  name: string;
  section: string;
  /** The text next to the dish on the menu (helps the chef), read only */
  menuText: string;
  ingredients: Ingredient[];
  /** Anything else about the dish */
  note: string;
  /** Minutes from ordering until it is served (null = not given) */
  prepMinutes: number | null;
  /** Price in the restaurant's currency (null = not given) */
  price: number | null;
  /** The chef went through this dish */
  done: boolean;
  /** Photos of the dish (customers see them under More) */
  photos: string[];
}

export const MAX_DISH_PHOTOS = 4;
const photoUrl = (u: unknown) => typeof u === "string" && /^(https:\/\/|\/uploads\/)[^\s"'<>]{1,500}$/.test(u.trim());

export interface DishDetails {
  key: string;
  dishes: Dish[];
  /** The chef checked the list of dishes (step 1) */
  listConfirmed: boolean;
  /** The menu version the list was made from (to notice a newer version) */
  sourceUrl: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

const clip = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");
/**
 * A price written on a menu or typed by the chef: "4.50", "4,50 €", "€12", "1.200 Lek", "1 200".
 * A separator followed by exactly 3 digits is a thousands separator, otherwise it is the decimal point.
 */
export function parsePrice(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 && v <= 1_000_000 ? Math.round(v * 100) / 100 : null;
  if (typeof v !== "string") return null;
  // "1.200" / "1 200,50" (groups of 3) or a plain "4.50" / "12,5" / "9"
  const all = v.match(/\d{1,3}(?:[ .,]\d{3})+(?:[.,]\d{1,2})?(?!\d)|\d+(?:[.,]\d{1,2})?(?!\d)/g);
  if (!all) return null;
  const t = all[all.length - 1];
  const dec = t.match(/[.,](\d{1,2})$/);
  const whole = (dec ? t.slice(0, -dec[0].length) : t).replace(/[ .,]/g, "");
  const n = Number(dec ? `${whole}.${dec[1]}` : whole);
  return Number.isFinite(n) && n >= 0 && n <= 1_000_000 ? Math.round(n * 100) / 100 : null;
}

const newId = () => `d_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export function sanitizeDishes(input: unknown): Dish[] {
  if (!Array.isArray(input)) return [];
  const out: Dish[] = [];
  for (const raw of input.slice(0, LIMITS.dishes)) {
    if (!raw || typeof raw !== "object") continue;
    const d = raw as Record<string, unknown>;
    const name = clip(d.name, LIMITS.name);
    if (!name) continue;
    const ingredients: Ingredient[] = Array.isArray(d.ingredients)
      ? d.ingredients.slice(0, LIMITS.ingredients).map((i) => {
          const o = (i && typeof i === "object" ? i : {}) as Record<string, unknown>;
          return { name: clip(o.name, LIMITS.name), note: clip(o.note, LIMITS.note) };
        }).filter((i) => i.name)
      : [];
    out.push({
      id: typeof d.id === "string" && /^[\w-]{1,40}$/.test(d.id) ? d.id : newId(),
      name,
      section: clip(d.section, LIMITS.section),
      menuText: clip(d.menuText, 300),
      ingredients,
      note: clip(d.note, 500),
      prepMinutes: Number.isFinite(Number(d.prepMinutes)) && Number(d.prepMinutes) >= 1 && d.prepMinutes !== null && d.prepMinutes !== ""
        ? Math.min(600, Math.round(Number(d.prepMinutes))) : null,
      price: d.price === "" || d.price === null || d.price === undefined ? null : parsePrice(d.price),
      done: d.done === true,
      photos: Array.isArray(d.photos) ? [...new Set(d.photos.filter(photoUrl).map((u) => (u as string).trim()))].slice(0, MAX_DISH_PHOTOS) : [],
    });
  }
  return out;
}

const keyPrefix = (key: string) => `${PREFIX},"key":${JSON.stringify(key)},`;
const toData = (d: DishDetails) => JSON.stringify({
  type: "dish-details", key: d.key, dishes: d.dishes, listConfirmed: d.listConfirmed,
  sourceUrl: d.sourceUrl, updatedAt: d.updatedAt, updatedBy: d.updatedBy,
});

interface Row { id: string; data: string; createdAt: Date }

function parseRow(row: Row): DishDetails | null {
  try {
    const d = JSON.parse(row.data);
    if (d?.type !== "dish-details" || typeof d.key !== "string") return null;
    return {
      key: d.key, dishes: sanitizeDishes(d.dishes), listConfirmed: d.listConfirmed === true,
      sourceUrl: typeof d.sourceUrl === "string" ? d.sourceUrl : null,
      updatedAt: typeof d.updatedAt === "string" ? d.updatedAt : null,
      updatedBy: typeof d.updatedBy === "string" ? d.updatedBy : null,
    };
  } catch {
    return null;
  }
}

export async function getDishDetails(restaurantId: string, key: string): Promise<DishDetails | null> {
  const row: Row | null = await prisma.menuSnapshot.findFirst({
    where: { restaurantId, data: { startsWith: keyPrefix(key) } },
    select: { id: true, data: true, createdAt: true },
  });
  return row ? parseRow(row) : null;
}

export async function saveDishDetails(restaurantId: string, d: DishDetails) {
  const row = await prisma.menuSnapshot.findFirst({ where: { restaurantId, data: { startsWith: keyPrefix(d.key) } }, select: { id: true } });
  if (row) await prisma.menuSnapshot.update({ where: { id: row.id }, data: { data: toData(d) } });
  else await prisma.menuSnapshot.create({ data: { restaurantId, label: "Dish details", data: toData(d) } });
}

async function allDishDetails(restaurantId: string): Promise<Map<string, DishDetails>> {
  const rows: Row[] = await prisma.menuSnapshot.findMany({
    where: { restaurantId, data: { startsWith: PREFIX } },
    select: { id: true, data: true, createdAt: true },
  });
  const map = new Map<string, DishDetails>();
  for (const r of rows) { const d = parseRow(r); if (d) map.set(d.key, d); }
  return map;
}

// ── Which menus ─────────────────────────────────────────────────────────────

export type MenuKind = "pdf" | "photos" | "design" | "digital";

export interface MenuEntry {
  key: string;
  title: string;
  kind: MenuKind;
  /** Why it counts as active: "live", "tree", "scheduled" (empty = not active) */
  active: ("live" | "tree" | "scheduled")[];
  /** Newest version (PDF / photos) */
  menuPdfUrl: string | null;
  designId: string | null;
  dishes: number;
  done: number;
  listConfirmed: boolean;
  /** The menu has a newer version than the one the dish list was made from */
  changedSince: boolean;
}

export async function listMenusForDetails(restaurant: { id: string; menuPdfUrl: string | null; primaryMenu: string }): Promise<MenuEntry[]> {
  const menus: BookMenu[] = await listBookMenus(restaurant.id);
  const designs: StoredDesign[] = await listDesigns(restaurant.id).catch(() => []);
  const details = await allDishDetails(restaurant.id);
  const tree: MenuTree | null = await loadMenuTree(restaurant.id).catch(() => null);
  const schedules: MenuSchedule[] = await listSchedules(restaurant.id).catch(() => []);
  const digitalCount: number = await prisma.menuItem.count({ where: { category: { restaurantId: restaurant.id } } }).catch(() => 0);
  const designOf = new Map(designs.filter((d) => d.menuId).map((d) => [d.menuId as string, d.id]));
  const inTree = new Set(restaurant.primaryMenu === "tree" && tree ? treeMenuIds(tree) : []);
  const running = new Set(schedules.filter((s) => scheduleStatus(s) === "running").map((s) => s.menuId));

  const entries: MenuEntry[] = menus.map((m) => {
    const key = `menu:${m.menuId}`;
    const d = details.get(key);
    const newest = m.versions[0]?.menuPdfUrl ?? null;
    const pages = parseMenuPages(newest);
    const active: MenuEntry["active"] = [];
    if (restaurant.primaryMenu === "static" && m.versions.some((v) => v.menuPdfUrl === restaurant.menuPdfUrl)) active.push("live");
    if (inTree.has(m.menuId)) active.push("tree");
    if (running.has(m.menuId)) active.push("scheduled");
    return {
      key, title: m.title,
      kind: designOf.has(m.menuId) ? "design" : pages?.kind === "pdf" ? "pdf" : "photos",
      active, menuPdfUrl: newest, designId: designOf.get(m.menuId) ?? null,
      dishes: d?.dishes.length ?? 0, done: d?.dishes.filter((x) => x.done).length ?? 0,
      listConfirmed: !!d?.listConfirmed,
      changedSince: !!d?.sourceUrl && !!newest && d.sourceUrl !== newest,
    };
  });

  if (digitalCount > 0) {
    const d = details.get("digital");
    entries.unshift({
      key: "digital", title: "Digital menu (categories and items)", kind: "digital",
      active: restaurant.primaryMenu === "dynamic" ? ["live"] : [], menuPdfUrl: null, designId: null,
      dishes: d?.dishes.length ?? 0, done: d?.dishes.filter((x) => x.done).length ?? 0,
      listConfirmed: !!d?.listConfirmed, changedSince: false,
    });
  }
  // Active ones first
  return entries.sort((a, b) => Number(b.active.length > 0) - Number(a.active.length > 0));
}

/** The old digital menu's dishes, as a starting list */
export async function digitalMenuDishes(restaurantId: string): Promise<Dish[]> {
  const cats = await prisma.menuCategory.findMany({
    where: { restaurantId },
    orderBy: { order: "asc" },
    include: { items: { orderBy: { order: "asc" } } },
  });
  const out: Dish[] = [];
  for (const c of cats as { name: string; items: { name: string; description: string | null; price: number | null }[] }[]) {
    for (const it of c.items) {
      out.push({ id: newId(), name: clip(it.name, LIMITS.name), section: clip(c.name, LIMITS.section), menuText: clip(it.description, 300), ingredients: [], note: "", prepMinutes: null, price: parsePrice(it.price), done: false, photos: [] });
    }
  }
  return out.filter((d) => d.name).slice(0, LIMITS.dishes);
}

/** Who may edit: anyone allowed "Add ingredients and details" on Staff & roles (the owner always) */
export async function canEditDetails(session: { id: string; role: string } | null, restaurant: { id: string; ownerId: string }): Promise<boolean> {
  return can(session, restaurant, "details.edit");
}

// ── Finding the dishes in menu text ─────────────────────────────────────────

export interface FoundDish { name: string; section: string; menuText: string; ingredients: string[]; price?: number | null }

const PRICE = /(?:€|\$|£|₺|lek|all|eur|chf|den|din)?\s*(?:\d{1,3}(?:[ .,]\d{3})+(?:[.,]\d{1,2})?|\d{1,5}(?:[.,]\d{1,2})?)\s*(?:€|\$|£|₺|lek[eë]?|all|eur|chf|den|din|\.-)?\s*$/i;

/**
 * Without AI: a line that ends with a price is a dish, a short line in capitals (or without a price,
 * followed by dishes) is a section, a line right after a dish is its description.
 */
export function findDishesSimple(text: string): FoundDish[] {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const out: FoundDish[] = [];
  let section = "";
  let last: FoundDish | null = null;
  for (const line of lines) {
    const priced = PRICE.test(line) && /[a-zA-ZÀ-ž]{3}/.test(line);
    if (priced) {
      const price = parsePrice(line.match(PRICE)?.[0] ?? "");
      let name = line.replace(PRICE, "").replace(/[.\s·_-]{2,}$/, "").replace(/[.:·-]+$/, "").trim();
      let desc = "";
      const split = name.match(/^(.{3,60}?)\s+[-–—:]\s+(.+)$/);
      if (split) { name = split[1]; desc = split[2]; }
      if (name.length < 2 || name.length > LIMITS.name) { last = null; continue; }
      last = { name, section, price, menuText: desc, ingredients: desc ? desc.split(/,| and | e | me /i).map((s) => s.trim()).filter((s) => s && s.length < 40) : [] };
      out.push(last);
    } else if (line.length <= 40 && (line === line.toUpperCase() || !last) && /[a-zA-ZÀ-ž]{3}/.test(line)) {
      section = line.charAt(0) + line.slice(1).toLowerCase();
      last = null;
    } else if (last && !last.menuText && line.length < 200) {
      last.menuText = line;
      last.ingredients = line.split(/,| and | e | me /i).map((s) => s.trim()).filter((s) => s && s.length < 40);
    } else {
      last = null;
    }
  }
  return out.slice(0, LIMITS.dishes);
}

/** With AI (Groq, if set up): reads the menu text and returns the dishes. null = not available / failed */
export async function findDishesWithAI(text: string): Promise<FoundDish[] | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key || !text.trim()) return null;
  const prompt = `You read a restaurant menu (text taken from a PDF or a photo, so it can be messy, with prices and odd line breaks).
List every dish or drink on it. For each one give:
- "name": the dish name as written on the menu (fix only obvious OCR mistakes)
- "section": the menu section it is under (e.g. "Breakfast", "Pizza", "Drinks"), or "" if none
- "menuText": the description written next to it on the menu, or ""
- "ingredients": only ingredients the menu text itself mentions for that dish (do not guess), as short words, or []
- "price": the price written next to it as a number (e.g. 4.5), or null if there is none
Leave out opening hours, addresses, slogans and section titles. Keep the order of the menu.
Answer with JSON only, like: {"dishes":[{"name":"Omelette","section":"Breakfast","menuText":"eggs, cheese, ham","ingredients":["eggs","cheese","ham"],"price":4.5}]}

MENU TEXT:
${text.slice(0, 14000)}`;
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 6000,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const parsed = JSON.parse(data?.choices?.[0]?.message?.content ?? "{}");
    if (!Array.isArray(parsed?.dishes)) return null;
    return parsed.dishes.slice(0, LIMITS.dishes).map((d: Record<string, unknown>) => ({
      name: clip(d.name, LIMITS.name),
      section: clip(d.section, LIMITS.section),
      menuText: clip(d.menuText, 300),
      ingredients: Array.isArray(d.ingredients) ? d.ingredients.map((i) => clip(i, LIMITS.name)).filter(Boolean).slice(0, LIMITS.ingredients) : [],
      price: parsePrice(d.price),
    })).filter((d: FoundDish) => d.name);
  } catch {
    return null;
  }
}

export function toDishes(found: FoundDish[]): Dish[] {
  return found.map((f) => ({
    id: newId(), name: f.name, section: f.section, menuText: f.menuText,
    ingredients: f.ingredients.map((n) => ({ name: n, note: "" })), note: "", prepMinutes: null, price: f.price ?? null, done: false, photos: [],
  }));
}

// ── Currency ────────────────────────────────────────────────────────────────

/** Currencies to pick from (stored as Restaurant.currency, the symbol or short name) */
export const CURRENCIES: { value: string; label: string }[] = [
  { value: "€", label: "Euro (€)" },
  { value: "Lek", label: "Albanian lek (Lek)" },
  { value: "$", label: "US dollar ($)" },
  { value: "£", label: "British pound (£)" },
  { value: "CHF", label: "Swiss franc (CHF)" },
  { value: "den", label: "Macedonian denar (den)" },
  { value: "din", label: "Serbian dinar (din)" },
  { value: "₺", label: "Turkish lira (₺)" },
];

/** "€12.50", "1200 Lek", "CHF 9" */
export function formatPrice(n: number, currency: string): string {
  const v = Number.isInteger(n) ? String(n) : n.toFixed(2);
  if (/^[A-Za-z]/.test(currency)) return currency === "CHF" ? `CHF ${v}` : `${v} ${currency}`;
  return `${currency}${v}`;
}

// ── Settings ────────────────────────────────────────────────────────────────

const SETTINGS_PREFIX = '{"type":"dish-settings"';

/** "Ask about the dishes" on the public menu (on unless turned off) */
export async function loadDishSettings(restaurantId: string): Promise<{ askEnabled: boolean }> {
  const row: Row | null = await prisma.menuSnapshot.findFirst({
    where: { restaurantId, data: { startsWith: SETTINGS_PREFIX } },
    select: { id: true, data: true, createdAt: true },
  });
  try { return { askEnabled: row ? JSON.parse(row.data).askEnabled !== false : true }; } catch { return { askEnabled: true }; }
}

export async function saveDishSettings(restaurantId: string, v: { askEnabled: boolean }) {
  const data = JSON.stringify({ type: "dish-settings", askEnabled: v.askEnabled });
  const row = await prisma.menuSnapshot.findFirst({ where: { restaurantId, data: { startsWith: SETTINGS_PREFIX } }, select: { id: true } });
  if (row) await prisma.menuSnapshot.update({ where: { id: row.id }, data: { data } });
  else await prisma.menuSnapshot.create({ data: { restaurantId, label: "Dish settings", data } });
}

/** Dishes with photos on the menus customers can see now (More > Photos of the dishes) */
export async function dishesWithPhotos(restaurant: { id: string; menuPdfUrl: string | null; primaryMenu: string }): Promise<{ dish: Dish; menu: string }[]> {
  const out: { dish: Dish; menu: string }[] = [];
  for (const m of (await listMenusForDetails(restaurant)).filter((x) => x.active.length)) {
    const d = await getDishDetails(restaurant.id, m.key);
    for (const dish of d?.dishes ?? []) if (dish.photos.length) out.push({ dish, menu: m.title });
  }
  return out;
}

/** Dishes the kitchen finished (done) on the menus customers can see now, with the menu they are on */
export async function detailedActiveDishes(restaurant: { id: string; menuPdfUrl: string | null; primaryMenu: string }): Promise<{ items: { dish: Dish; menu: string }[]; withoutDetails: number }> {
  const menus = (await listMenusForDetails(restaurant)).filter((m) => m.active.length);
  const items: { dish: Dish; menu: string }[] = [];
  let withoutDetails = 0;
  for (const m of menus) {
    const d = await getDishDetails(restaurant.id, m.key);
    for (const dish of d?.dishes ?? []) {
      if (dish.done) items.push({ dish, menu: m.title });
      else withoutDetails++;
    }
  }
  return { items, withoutDetails };
}
