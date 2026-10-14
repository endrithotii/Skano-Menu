// Server-side storage for "Design" menus (see lib/menu-design-types.ts).
// A restaurant can have many designs, stored in the MenuSnapshot table (no migration), one row each:
//   label = name, data = '{"type":"design","name":...,"design":{...},"menuId":...,"menuPdfUrl":...,"updatedAt":...}'
// Saving a design also saves its page pictures as a menu in the Menu history (see the menu-design API).

import { prisma } from "@/lib/db";
import { isOwnMenuUpload } from "@/lib/menu-files";
import {
  CLIP_SHAPES, DESIGN_LIMITS, FONTS, LINE_STYLES, PAGE_SIZES, designImageUrls, newId,
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
  if (!["text", "item", "image", "rect", "ellipse", "line", "divider"].includes(type as string)) return null;
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
  if (e.hidden === true) el.hidden = true;
  if (e.locked === true) el.locked = true;
  if (e.shadow === true) el.shadow = true;
  if ((el.type === "rect" || el.type === "ellipse" || el.type === "image") && CLIP_SHAPES.includes(e.clip as never) && e.clip !== "none") {
    el.clip = e.clip as DesignElement["clip"];
  }
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
  if (el.type === "text") {
    el.text = str(e.text, DESIGN_LIMITS.text);
    if (e.textFill && typeof e.textFill === "object" && (e.textFill as { type?: string }).type !== "none") {
      el.textFill = cleanFill(e.textFill, { type: "solid", color: "#111827" });
      el.radius = num(e.radius, 0, 2000, 0);
      el.padding = num(e.padding, 0, 200, 8);
    }
  }
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
  if (el.type === "line" || el.type === "divider") {
    el.vertical = el.type === "line" && e.vertical === true;
    el.lineStyle = LINE_STYLES.includes(e.lineStyle as never) ? (e.lineStyle as DesignElement["lineStyle"]) : "solid";
  }
  if (el.type === "divider") {
    el.symbol = str(e.symbol, 4);
    el.color = color(e.color, "#9a7b4f");
    el.borderWidth = num(e.borderWidth, 1, 40, 1);
  }
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
  const c = raw.custom && typeof raw.custom === "object" ? raw.custom as Record<string, unknown> : null;
  const custom = c ? { w: Math.round(num(c.w, 200, 3000, 794)), h: Math.round(num(c.h, 200, 4500, 1123)) } : null;
  const size: MenuDesign["size"] = raw.size === "custom" && custom ? "custom"
    : (Object.keys(PAGE_SIZES) as PageSize[]).includes(raw.size as PageSize) ? (raw.size as PageSize) : "a4";
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
    ...(custom ? { custom } : {}),
    display: raw.display === "scroll" ? "scroll" : "book",
    pages,
    // Page pictures are only valid if there is one per page
    ...(pageImages.length === pages.length && pages.length ? { pageImages } : {}),
  };
}

export interface StoredDesign {
  id: string;
  name: string;
  design: MenuDesign;
  /** The menu in the Menu history this design was saved as (each save = a new version of it) */
  menuId: string | null;
  menuPdfUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface DesignRow { id: string; label: string; data: string; createdAt: Date }

function toStored(row: DesignRow, restaurantId: string): StoredDesign | null {
  try {
    const d = JSON.parse(row.data);
    if (d?.type !== "design") return null;
    return {
      id: row.id,
      name: (typeof d.name === "string" && d.name.trim()) || row.label || "Digital Menu",
      design: sanitizeDesign(d.design, restaurantId),
      menuId: typeof d.menuId === "string" ? d.menuId : null,
      menuPdfUrl: typeof d.menuPdfUrl === "string" ? d.menuPdfUrl : null,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(typeof d.updatedAt === "string" ? d.updatedAt : row.createdAt),
    };
  } catch {
    return null;
  }
}

/** All designs of a restaurant, last changed first */
export async function listDesigns(restaurantId: string): Promise<StoredDesign[]> {
  const rows: DesignRow[] = await prisma.menuSnapshot.findMany({
    where: { restaurantId, data: { startsWith: DESIGN_DATA_PREFIX } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, label: true, data: true, createdAt: true },
  });
  return rows
    .map((r) => toStored(r, restaurantId))
    .filter((d): d is StoredDesign => !!d)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export async function getDesign(restaurantId: string, id: string): Promise<StoredDesign | null> {
  return (await listDesigns(restaurantId)).find((d) => d.id === id) ?? null;
}

export async function saveDesign(restaurantId: string, v: {
  id?: string | null; name: string; design: MenuDesign; menuId: string | null; menuPdfUrl: string | null;
}): Promise<string> {
  const data = JSON.stringify({
    type: "design", name: v.name, design: v.design, menuId: v.menuId, menuPdfUrl: v.menuPdfUrl, updatedAt: new Date().toISOString(),
  });
  if (v.id) {
    await prisma.menuSnapshot.update({ where: { id: v.id }, data: { label: v.name, data } });
    return v.id;
  }
  const row = await prisma.menuSnapshot.create({ data: { restaurantId, label: v.name, data } });
  return row.id;
}

/** Changes only the name (the design and its date stay the same) */
export async function renameDesign(restaurantId: string, id: string, name: string): Promise<boolean> {
  const rows: DesignRow[] = await prisma.menuSnapshot.findMany({
    where: { restaurantId, id, data: { startsWith: DESIGN_DATA_PREFIX } },
    take: 1,
    select: { id: true, label: true, data: true, createdAt: true },
  });
  const row = rows[0];
  if (!row) return false;
  const d = JSON.parse(row.data);
  d.name = name;
  await prisma.menuSnapshot.update({ where: { id: row.id }, data: { label: name, data: JSON.stringify(d) } });
  return true;
}

export async function deleteDesign(restaurantId: string, id: string): Promise<void> {
  await prisma.menuSnapshot.deleteMany({ where: { restaurantId, id } });
}

/** Photos and page pictures used by any design (so they are never deleted while a design needs them) */
export async function allDesignImageUrls(restaurantId: string): Promise<string[]> {
  return (await listDesigns(restaurantId)).flatMap((d) => designImageUrls(d.design));
}
