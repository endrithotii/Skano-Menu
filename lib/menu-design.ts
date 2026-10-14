// Server-side storage for "Design" menus (see lib/menu-design-types.ts).
// One design per restaurant, stored in the MenuSnapshot table (no migration): data = '{"type":"design","design":{...}}'.

import { prisma } from "@/lib/db";
import { isOwnMenuUpload } from "@/lib/menu-files";
import {
  DESIGN_LIMITS, FONTS, PAGE_SIZES, newId,
  type DesignElement, type DesignPage, type Fill, type MenuDesign, type PageBackground, type PageSize,
} from "@/lib/menu-design-types";

export const DESIGN_DATA_PREFIX = '{"type":"design"';

const num = (v: unknown, min: number, max: number, fallback: number) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n * 100) / 100)) : fallback;
};
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const COLOR = /^(#[0-9a-fA-F]{3,8}|rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(,\s*[\d.]+\s*)?\)|transparent)$/;
const color = (v: unknown, fallback: string) => (typeof v === "string" && COLOR.test(v.trim()) ? v.trim() : fallback);
const ID = /^[\w-]{1,40}$/;

function cleanFill(v: unknown, fallback: Fill): Fill {
  if (!v || typeof v !== "object") return fallback;
  const f = v as Record<string, unknown>;
  if (f.type === "none") return { type: "none" };
  if (f.type === "linear") return { type: "linear", from: color(f.from, "#ffffff"), to: color(f.to, "#000000"), angle: num(f.angle, 0, 360, 180) };
  return { type: "solid", color: color(f.color, "#e5e7eb") };
}

function cleanBackground(v: unknown, restaurantId: string): PageBackground {
  const b = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  if (b.type === "linear") return { type: "linear", from: color(b.from, "#ffffff"), to: color(b.to, "#e5e7eb"), angle: num(b.angle, 0, 360, 180) };
  if (b.type === "image" && typeof b.url === "string" && isOwnMenuUpload(b.url, restaurantId)) {
    return {
      type: "image", url: b.url, fit: b.fit === "contain" ? "contain" : "cover",
      x: num(b.x, 0, 100, 50), y: num(b.y, 0, 100, 50), dim: num(b.dim, 0, 0.9, 0), color: color(b.color, "#000000"),
    };
  }
  return { type: "solid", color: color(b.color, "#ffffff") };
}

function cleanElement(v: unknown, restaurantId: string): DesignElement | null {
  if (!v || typeof v !== "object") return null;
  const e = v as Record<string, unknown>;
  const type = e.type;
  if (!["text", "item", "image", "rect", "ellipse", "line"].includes(type as string)) return null;
  const el: DesignElement = {
    id: typeof e.id === "string" && ID.test(e.id) ? e.id : newId(),
    type: type as DesignElement["type"],
    x: num(e.x, -5000, 5000, 0),
    y: num(e.y, -5000, 5000, 0),
    w: num(e.w, 1, 5000, 100),
    h: num(e.h, 1, 5000, 40),
    rotation: num(e.rotation, -360, 360, 0),
    opacity: num(e.opacity, 0, 1, 1),
    groupId: typeof e.groupId === "string" && ID.test(e.groupId) ? e.groupId : null,
  };
  if (el.type === "text" || el.type === "item") {
    el.fontFamily = (FONTS as readonly string[]).includes(e.fontFamily as string) ? (e.fontFamily as string) : "Inter";
    el.fontSize = num(e.fontSize, 4, 400, 16);
    el.fontWeight = num(e.fontWeight, 100, 900, 400);
    el.italic = e.italic === true;
    el.underline = e.underline === true;
    el.uppercase = e.uppercase === true;
    el.color = color(e.color, "#111827");
    el.align = e.align === "center" || e.align === "right" ? e.align : "left";
    el.lineHeight = num(e.lineHeight, 0.6, 4, 1.3);
    el.letterSpacing = num(e.letterSpacing, -10, 50, 0);
  }
  if (el.type === "text") el.text = str(e.text, DESIGN_LIMITS.text);
  if (el.type === "item") {
    el.name = str(e.name, 200);
    el.description = str(e.description, 600);
    el.price = str(e.price, 40);
    el.accentColor = color(e.accentColor, el.color ?? "#111827");
  }
  if (el.type === "rect" || el.type === "ellipse" || el.type === "line") {
    el.fill = cleanFill(e.fill, { type: "solid", color: "#e5e7eb" });
    el.borderColor = color(e.borderColor, "#111827");
    el.borderWidth = num(e.borderWidth, 0, 100, 0);
  }
  if (el.type === "rect" || el.type === "image") el.radius = num(e.radius, 0, 2000, 0);
  if (el.type === "image") {
    el.src = typeof e.src === "string" && isOwnMenuUpload(e.src, restaurantId) ? e.src : "";
    el.fit = e.fit === "contain" ? "contain" : "cover";
    el.borderColor = color(e.borderColor, "#111827");
    el.borderWidth = num(e.borderWidth, 0, 100, 0);
  }
  return el;
}

export function sanitizeDesign(input: unknown, restaurantId: string): MenuDesign {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const size: PageSize = (Object.keys(PAGE_SIZES) as PageSize[]).includes(raw.size as PageSize) ? (raw.size as PageSize) : "a4";
  const pages: DesignPage[] = (Array.isArray(raw.pages) ? raw.pages : []).slice(0, DESIGN_LIMITS.pages).map((p) => {
    const page = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
    return {
      id: typeof page.id === "string" && ID.test(page.id) ? page.id : newId("p"),
      background: cleanBackground(page.background, restaurantId),
      elements: (Array.isArray(page.elements) ? page.elements : [])
        .slice(0, DESIGN_LIMITS.elements)
        .map((e) => cleanElement(e, restaurantId))
        .filter((e): e is DesignElement => !!e),
    };
  });
  const pageImages = Array.isArray(raw.pageImages)
    ? raw.pageImages.filter((u): u is string => typeof u === "string" && isOwnMenuUpload(u, restaurantId)).slice(0, DESIGN_LIMITS.pages)
    : [];
  return {
    version: 1,
    size,
    display: raw.display === "scroll" ? "scroll" : "book",
    pages,
    // Page pictures are only valid if there is one per page
    ...(pageImages.length === pages.length && pages.length ? { pageImages } : {}),
  };
}

async function findRow(restaurantId: string) {
  const rows: { id: string; data: string }[] = await prisma.menuSnapshot.findMany({
    where: { restaurantId, data: { startsWith: DESIGN_DATA_PREFIX } },
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { id: true, data: true },
  });
  return rows[0] ?? null;
}

export async function loadMenuDesign(restaurantId: string): Promise<MenuDesign | null> {
  const row = await findRow(restaurantId);
  if (!row) return null;
  try {
    return sanitizeDesign(JSON.parse(row.data)?.design, restaurantId);
  } catch {
    return null;
  }
}

export async function saveMenuDesign(restaurantId: string, design: MenuDesign): Promise<void> {
  const data = JSON.stringify({ type: "design", design });
  const row = await findRow(restaurantId);
  if (row) await prisma.menuSnapshot.update({ where: { id: row.id }, data: { data, label: "Menu design" } });
  else await prisma.menuSnapshot.create({ data: { restaurantId, label: "Menu design", data } });
}
