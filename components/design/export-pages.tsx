"use client";

// Makes a JPEG picture of every design page and uploads it (staged), for the public flip book.
// Pages are drawn off screen at their real size, then captured with html-to-image.

import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { getFontEmbedCSS, toJpeg } from "html-to-image";
import { DesignPageView } from "@/components/design/design-render";
import { stageUpload } from "@/components/dashboard/menu-book-editor";
import { PAGE_SIZES, designFonts, googleFontsUrl, type MenuDesign } from "@/lib/menu-design-types";

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

/** Returns the uploaded picture URLs, one per page (throws if anything fails) */
export async function exportDesignPages(
  design: MenuDesign,
  restaurantId: string,
  onProgress?: (done: number, total: number) => void,
): Promise<string[]> {
  const { w, h } = PAGE_SIZES[design.size];
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
              <DesignPageView page={page} size={design.size} />
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
    const pixelRatio = TARGET_WIDTH / w;
    const urls: string[] = [];
    try {
      for (let i = 0; i < nodes.length; i++) {
        const dataUrl = await toJpeg(nodes[i], {
          width: w, height: h, pixelRatio, quality: 0.86, backgroundColor: "#ffffff", cacheBust: false,
          ...(fontEmbedCSS !== undefined ? { fontEmbedCSS } : {}),
        });
        const file = dataUrlToFile(dataUrl, `page-${i + 1}.jpg`);
        const { url } = await stageUpload(restaurantId, file, () => {});
        urls.push(url);
        onProgress?.(i + 1, nodes.length);
      }
    } catch (err) {
      // Remove the pictures that were already uploaded
      for (const url of urls) {
        fetch(`/api/restaurants/${restaurantId}/upload-menu?staged=${encodeURIComponent(url)}`, { method: "DELETE" }).catch(() => {});
      }
      throw err;
    }
    return urls;
  } finally {
    root.unmount();
    host.remove();
  }
}
