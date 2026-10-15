"use client";

// Reads the text of a menu in the browser, so the dishes can be found in it:
// - PDF with real text: read straight from the PDF (exact)
// - Scanned PDF or photos: text recognition (OCR) on each page. Less exact, the chef checks the list after.

import { parseMenuPages } from "@/lib/menu-pages";

const PDF_WORKER_SRC = "/pdfjs/pdf.worker.min.mjs";
/** OCR languages: English and Albanian */
const OCR_LANGS = "eng+sqi";
/** Text recognition files are served from this site (public/ocr), so it doesn't depend on another website:
 *  worker.min.js (tesseract.js), tesseract-core-(simd-)lstm.wasm.js (tesseract.js-core), *.traineddata.gz (@tesseract.js-data) */
const OCR_FILES = "/ocr";

type Progress = (text: string) => void;

/** Text items of a PDF page joined into lines (top to bottom, left to right) */
function linesFromItems(items: { str: string; x: number; y: number; h: number }[]): string[] {
  const sorted = [...items].filter((i) => i.str.trim()).sort((a, b) => (Math.abs(a.y - b.y) > Math.min(a.h, b.h) * 0.5 ? a.y - b.y : a.x - b.x));
  const lines: { y: number; h: number; parts: { x: number; str: string }[] }[] = [];
  for (const it of sorted) {
    const line = lines.find((l) => Math.abs(l.y - it.y) <= Math.min(l.h, it.h) * 0.5);
    if (line) line.parts.push({ x: it.x, str: it.str });
    else lines.push({ y: it.y, h: it.h, parts: [{ x: it.x, str: it.str }] });
  }
  return lines.sort((a, b) => a.y - b.y).map((l) => l.parts.sort((a, b) => a.x - b.x).map((p) => p.str.trim()).join("  "));
}

async function ocr(sources: (string | HTMLCanvasElement)[], onProgress: Progress): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  onProgress("Getting text recognition ready…");
  const worker = await createWorker(OCR_LANGS, 1, { workerPath: `${OCR_FILES}/worker.min.js`, corePath: OCR_FILES, langPath: OCR_FILES });
  try {
    const out: string[] = [];
    for (let i = 0; i < sources.length; i++) {
      onProgress(`Reading page ${i + 1} of ${sources.length}…`);
      const { data } = await worker.recognize(sources[i]);
      out.push(data.text);
    }
    return out.join("\n");
  } finally {
    await worker.terminate();
  }
}

/** All the text of a menu (menuPdfUrl in any of the stored formats) */
export async function readMenuText(menuPdfUrl: string, onProgress: Progress): Promise<{ text: string; method: "pdf-text" | "ocr" }> {
  const pages = parseMenuPages(menuPdfUrl);
  if (!pages) throw new Error("This menu has no pages.");
  if (pages.kind === "images") {
    return { text: await ocr(pages.urls.slice(0, 30), onProgress), method: "ocr" };
  }
  onProgress("Opening the PDF…");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;
  const doc = await pdfjs.getDocument({ url: pages.url }).promise;
  try {
    const total = Math.min(doc.numPages, 30);
    const lines: string[] = [];
    for (let i = 1; i <= total; i++) {
      onProgress(`Reading page ${i} of ${total}…`);
      const page = await doc.getPage(i);
      const vp = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const items: { str: string; x: number; y: number; h: number }[] = [];
      for (const it of content.items) {
        if (!("str" in it)) continue;
        const t = pdfjs.Util.transform(vp.transform, it.transform);
        items.push({ str: it.str, x: t[4], y: t[5], h: Math.hypot(t[2], t[3]) || 10 });
      }
      lines.push(...linesFromItems(items));
    }
    const text = lines.join("\n");
    if (text.replace(/\s/g, "").length >= 30) return { text, method: "pdf-text" };
    // A scanned PDF (pictures only): draw the pages and read them
    const canvases: HTMLCanvasElement[] = [];
    for (let i = 1; i <= total; i++) {
      onProgress(`Preparing page ${i} of ${total}…`);
      const page = await doc.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: 1800 / base.width });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      await page.render({ canvas, viewport }).promise;
      canvases.push(canvas);
    }
    return { text: await ocr(canvases, onProgress), method: "ocr" };
  } finally {
    await doc.destroy();
  }
}
