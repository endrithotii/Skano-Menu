"use client";

// Makes a JPEG picture of every design page and uploads it (staged), for the public flip book.
// Pages are drawn off screen at their real size, then captured with html-to-image.

import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { getFontEmbedCSS, toJpeg } from "html-to-image";
import { DesignPageView } from "@/components/design/design-render";
import { stageUpload } from "@/components/dashboard/menu-book-editor";
import { designFonts, dimsOf, googleFontsUrl, type MenuDesign } from "@/lib/menu-design-types";

const TARGET_WIDTH = 1240; // px of the saved pictures

async function waitForImages(root: HTMLElement) {
  const imgs = [...root.querySelectorAll("img")];
  await Promise.all(imgs.map((img) => (img.complete ? Promise.resolve() : img.decode().catch(() => {}))));
}

function dataUrlToFile(dataUrl: string, name: string): File {
  const [head, b64] = dataUrl.split(",");
  const mime = head.match(/data:(.*?);/)?.[1] ?? "image/jpeg";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], name, { type: mime });
}

/** Draws every page and hands each JPEG (data URL) to `onPage` (throws if anything fails) */
async function renderPages(
  design: MenuDesign,
  onPage: (dataUrl: string, index: number, total: number) => Promise<void>,
  pixelWidth = TARGET_WIDTH,
  quality = 0.86,
): Promise<void> {
  const { w, h } = dimsOf(design);
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  Object.assign(host.style, { position: "fixed", left: "-100000px", top: "0", pointerEvents: "none" });
  document.body.appendChild(host);

  // Fonts used by the design
  const fontsHref = googleFontsUrl(designFonts(design));
  if (fontsHref && !document.querySelector(`link[data-design-fonts="${fontsHref}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = fontsHref;
    link.crossOrigin = "anonymous";
    link.dataset.designFonts = fontsHref;
    document.head.appendChild(link);
    await new Promise((r) => { link.onload = r; link.onerror = r; setTimeout(r, 4000); });
  }

  const root = createRoot(host);
  try {
    flushSync(() => {
      root.render(
        <div>
          {design.pages.map((page) => (
            <div key={page.id} data-export-page style={{ width: w, height: h }}>
              <DesignPageView page={page} size={dimsOf(design)} />
            </div>
          ))}
        </div>,
      );
    });
    await document.fonts.ready;
    await waitForImages(host);

    const nodes = [...host.querySelectorAll<HTMLElement>("[data-export-page]")];
    let fontEmbedCSS: string | undefined;
    try {
      fontEmbedCSS = await getFontEmbedCSS(host);
    } catch {
      fontEmbedCSS = undefined;
    }
    const pixelRatio = pixelWidth / w;
    for (let i = 0; i < nodes.length; i++) {
      const dataUrl = await toJpeg(nodes[i], {
        width: w, height: h, pixelRatio, quality, backgroundColor: "#ffffff", cacheBust: false,
        ...(fontEmbedCSS !== undefined ? { fontEmbedCSS } : {}),
      });
      await onPage(dataUrl, i, nodes.length);
    }
  } finally {
    root.unmount();
    host.remove();
  }
}

/** Pictures of the pages for the preview (nothing is uploaded) */
export async function previewDesignPages(design: MenuDesign): Promise<string[]> {
  const out: string[] = [];
  await renderPages(design, async (dataUrl) => { out.push(dataUrl); }, 1000);
  return out;
}

/** Uploads a picture of every page, returns their URLs in page order (throws if anything fails) */
export async function exportDesignPages(
  design: MenuDesign,
  restaurantId: string,
  onProgress?: (done: number, total: number) => void,
): Promise<string[]> {
  const urls: string[] = [];
  try {
    await renderPages(design, async (dataUrl, i, total) => {
      const { url } = await stageUpload(restaurantId, dataUrlToFile(dataUrl, `page-${i + 1}.jpg`), () => {});
      urls.push(url);
      onProgress?.(i + 1, total);
    });
  } catch (err) {
    // Remove the pictures that were already uploaded
    for (const url of urls) {
      fetch(`/api/restaurants/${restaurantId}/upload-menu?staged=${encodeURIComponent(url)}`, { method: "DELETE" }).catch(() => {});
    }
    throw err;
  }
  return urls;
}

// ── Downloads (made in the browser, nothing is uploaded) ──

const PRINT_WIDTH = 2000; // px, about 240 dpi on A4

function safeFileName(name: string) {
  return (name.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").trim() || "Menu").slice(0, 80);
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const bin = atob(dataUrl.split(",")[1]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** One PDF page per design page, at the page's real size */
export async function downloadDesignPdf(design: MenuDesign, name: string, onProgress?: (done: number, total: number) => void) {
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  pdf.setTitle(name);
  pdf.setCreator("Skano.Menu");
  const { w, h } = dimsOf(design);
  const pw = w * 0.75, ph = h * 0.75; // px (96 dpi) -> pt (72 dpi)
  await renderPages(design, async (dataUrl, i, total) => {
    const img = await pdf.embedJpg(dataUrlToBytes(dataUrl));
    pdf.addPage([pw, ph]).drawImage(img, { x: 0, y: 0, width: pw, height: ph });
    onProgress?.(i + 1, total);
  }, PRINT_WIDTH, 0.92);
  const bytes = await pdf.save();
  saveBlob(new Blob([bytes as BlobPart], { type: "application/pdf" }), `${safeFileName(name)}.pdf`);
}

/** A ZIP with a folder of JPEG pictures, one per page */
export async function downloadDesignImages(design: MenuDesign, name: string, onProgress?: (done: number, total: number) => void) {
  const { zipSync } = await import("fflate");
  const folder = safeFileName(name);
  const files: Record<string, Uint8Array> = {};
  await renderPages(design, async (dataUrl, i, total) => {
    files[`${folder}/page-${String(i + 1).padStart(2, "0")}.jpg`] = dataUrlToBytes(dataUrl);
    onProgress?.(i + 1, total);
  }, PRINT_WIDTH, 0.92);
  // JPEGs are already compressed, so store them as they are
  const zip = zipSync(files, { level: 0 });
  saveBlob(new Blob([zip as BlobPart], { type: "application/zip" }), `${folder}.zip`);
}
