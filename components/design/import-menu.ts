"use client";

// Opens an uploaded menu (a PDF or photos) in the designer.
// Every page becomes a design page with the page as its background picture.
// PDFs that contain real text also get that text as editable text boxes on top: each box covers the
// original words with the color behind them, so changing the text in the box changes what customers see.
// Photos and scanned PDFs have no text we can read, so they can only be drawn on.

import { stageUpload } from "@/components/dashboard/menu-book-editor";
import { parseMenuPages } from "@/lib/menu-pages";
import { DESIGN_LIMITS, newId, type DesignElement, type DesignPage, type Dims, type MenuDesign } from "@/lib/menu-design-types";

const PDF_WORKER_SRC = "/pdfjs/pdf.worker.min.mjs";
const RENDER_WIDTH = 1600; // px of the page pictures
const DESIGN_WIDTH = 794; // design units across a page (same as A4)
const MAX_TEXT_BOXES = 250;

export interface ImportedMenu {
  design: MenuDesign;
  /** How many text boxes could be made editable (0 = pictures only) */
  textBoxes: number;
  kind: "pdf" | "photos";
  /** Uploaded page pictures (so the page can clean them up when not saved) */
  staged: string[];
}

type Rgb = [number, number, number];
const hex = ([r, g, b]: Rgb) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
const dist = (a: Rgb, b: Rgb) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);

function pixel(data: ImageData, x: number, y: number): Rgb {
  const xi = Math.min(data.width - 1, Math.max(0, Math.round(x)));
  const yi = Math.min(data.height - 1, Math.max(0, Math.round(y)));
  const i = (yi * data.width + xi) * 4;
  return [data.data[i], data.data[i + 1], data.data[i + 2]];
}

/** Color behind a box (most common of the pixels around it) and the text color (most different pixel inside) */
function sampleColors(data: ImageData, x: number, y: number, w: number, h: number): { bg: Rgb; ink: Rgb } {
  const around: Rgb[] = [];
  const pad = Math.max(2, h * 0.15);
  for (let i = 0; i <= 8; i++) {
    const px = x + (w * i) / 8;
    around.push(pixel(data, px, y - pad), pixel(data, px, y + h + pad));
  }
  around.push(pixel(data, x - pad, y + h / 2), pixel(data, x + w + pad, y + h / 2));
  // Most common (rounded) color
  const counts = new Map<string, { c: Rgb; n: number }>();
  for (const c of around) {
    const key = c.map((v) => Math.round(v / 16)).join(",");
    const e = counts.get(key);
    if (e) e.n++; else counts.set(key, { c, n: 1 });
  }
  const bg = [...counts.values()].sort((a, b) => b.n - a.n)[0].c;
  let ink: Rgb = bg;
  let best = -1;
  const stepX = Math.max(1, w / 40), stepY = Math.max(1, h / 8);
  for (let py = y + h * 0.15; py < y + h * 0.9; py += stepY) {
    for (let px = x; px < x + w; px += stepX) {
      const c = pixel(data, px, py);
      const d = dist(c, bg);
      if (d > best) { best = d; ink = c; }
    }
  }
  if (best < 60) ink = dist(bg, [255, 255, 255]) > dist(bg, [0, 0, 0]) ? [255, 255, 255] : [17, 24, 39];
  return { bg, ink };
}

function canvasToFile(canvas: HTMLCanvasElement, name: string): Promise<File> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(new File([b], name, { type: "image/jpeg" })) : reject(new Error("Could not make the page picture"))), "image/jpeg", 0.88));
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load a page of the menu"));
    img.src = url;
  });
}

interface TextRun { str: string; x: number; y: number; w: number; h: number; family: string; bold: boolean; italic: boolean }

/** Joins pieces of text on the same line that are close together */
function joinRuns(runs: TextRun[]): TextRun[] {
  const sorted = [...runs].sort((a, b) => (Math.abs(a.y - b.y) > Math.min(a.h, b.h) * 0.4 ? a.y - b.y : a.x - b.x));
  const out: TextRun[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.y - r.y) < Math.min(last.h, r.h) * 0.4 && Math.abs(last.h - r.h) < last.h * 0.25
      && r.x - (last.x + last.w) < last.h * 1.2 && r.x >= last.x + last.w - last.h * 0.5
      && last.family === r.family && last.bold === r.bold) {
      const gap = r.x - (last.x + last.w);
      last.str += (gap > last.h * 0.15 && !last.str.endsWith(" ") && !r.str.startsWith(" ") ? " " : "") + r.str;
      last.w = r.x + r.w - last.x;
      continue;
    }
    out.push({ ...r });
  }
  return out.filter((r) => r.str.trim());
}

function fontFor(family: string, fontName: string): string {
  const f = `${family} ${fontName}`.toLowerCase();
  if (/mono|courier/.test(f)) return "Roboto Slab";
  if (/serif|times|georgia|garamond|baskerville|playfair|lora|merriweather|book|roman/.test(f) && !/sans/.test(f)) return "Lora";
  return "Inter";
}

function textElements(runs: TextRun[], scale: number, data: ImageData): DesignElement[] {
  return joinRuns(runs).slice(0, MAX_TEXT_BOXES).map((r) => {
    const { bg, ink } = sampleColors(data, r.x, r.y, r.w, r.h);
    const fontSize = Math.max(4, Math.round(r.h * scale * 0.86 * 10) / 10);
    const padX = r.h * 0.12;
    return {
      id: newId(),
      type: "text",
      x: Math.round((r.x - padX) * scale),
      y: Math.round((r.y - r.h * 0.1) * scale),
      w: Math.max(8, Math.round((r.w + padX * 2) * scale * 1.04)),
      // Tall enough to also cover the parts of letters below the line (g, p, y)
      h: Math.max(6, Math.round(r.h * 1.45 * scale)),
      rotation: 0,
      opacity: 1,
      text: r.str.trim(),
      fontFamily: r.family,
      fontSize,
      fontWeight: r.bold ? 700 : 400,
      italic: r.italic,
      color: hex(ink),
      align: "left",
      lineHeight: 1.1,
      letterSpacing: 0,
      // Covers the original words, so the edited text replaces them
      textFill: { type: "solid", color: hex(bg) },
      padding: Math.round(padX * scale),
      radius: 0,
    } as DesignElement;
  });
}

function pageFromPicture(url: string, elements: DesignElement[] = []): DesignPage {
  return { id: newId("p"), background: { type: "image", url, fit: "cover", x: 50, y: 50, dim: 0, color: "#ffffff" }, elements };
}

export async function importMenuAsDesign(
  menuPdfUrl: string,
  restaurantId: string,
  onProgress?: (text: string) => void,
): Promise<ImportedMenu> {
  const pages = parseMenuPages(menuPdfUrl);
  if (!pages) throw new Error("This menu has no pages.");
  const display = pages.display === "scroll" ? "scroll" : "book";
  const staged: string[] = [];

  if (pages.kind === "images") {
    const urls = pages.urls.slice(0, DESIGN_LIMITS.pages);
    onProgress?.("Opening the photos…");
    const first = await loadImage(urls[0]);
    const custom: Dims = { w: DESIGN_WIDTH, h: Math.round(DESIGN_WIDTH * (first.naturalHeight / first.naturalWidth || 1.414)) };
    // The photos are already uploaded: use them as they are
    return { design: { version: 1, size: "custom", custom, display, pages: urls.map((u) => pageFromPicture(u)) }, textBoxes: 0, kind: "photos", staged };
  }

  // PDF: draw each page, read its text
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;
  const doc = await pdfjs.getDocument({ url: pages.url }).promise;
  const total = Math.min(doc.numPages, DESIGN_LIMITS.pages);
  const designPages: DesignPage[] = [];
  let custom: Dims | null = null;
  let textBoxes = 0;
  try {
    for (let i = 1; i <= total; i++) {
      onProgress?.(`Opening page ${i} of ${total}…`);
      const page = await doc.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: RENDER_WIDTH / base.width });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      await page.render({ canvas, viewport }).promise;
      if (!custom) custom = { w: DESIGN_WIDTH, h: Math.round(DESIGN_WIDTH * (canvas.height / canvas.width)) };
      const scale = custom.w / canvas.width;

      const content = await page.getTextContent();
      const styles = content.styles as Record<string, { fontFamily?: string }>;
      const runs: TextRun[] = [];
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        const t = pdfjs.Util.transform(viewport.transform, item.transform);
        const h = Math.hypot(t[2], t[3]);
        if (h < 3) continue;
        // Turned text can't be covered with a straight box
        if (Math.abs(t[1]) > 0.01 * h || Math.abs(t[2]) > 0.01 * h) continue;
        const name = item.fontName ?? "";
        const fam = styles[name]?.fontFamily ?? "";
        runs.push({
          str: item.str, x: t[4], y: t[5] - h, w: item.width * viewport.scale, h,
          family: fontFor(fam, name), bold: /bold|black|heavy|semibold/i.test(name), italic: /italic|oblique/i.test(name),
        });
      }
      const ctx = canvas.getContext("2d");
      const data = ctx ? ctx.getImageData(0, 0, canvas.width, canvas.height) : null;
      const els = data ? textElements(runs, scale, data) : [];
      textBoxes += els.length;

      const { url } = await stageUpload(restaurantId, await canvasToFile(canvas, `page-${i}.jpg`), () => {});
      staged.push(url);
      designPages.push(pageFromPicture(url, els));
      page.cleanup();
    }
  } catch (err) {
    for (const url of staged) fetch(`/api/restaurants/${restaurantId}/upload-menu?staged=${encodeURIComponent(url)}`, { method: "DELETE" }).catch(() => {});
    throw err;
  } finally {
    await doc.destroy();
  }
  return {
    design: { version: 1, size: "custom", custom: custom ?? { w: DESIGN_WIDTH, h: 1123 }, display, pages: designPages },
    textBoxes, kind: "pdf", staged,
  };
}
