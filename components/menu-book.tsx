"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, FileText, Loader2 } from "lucide-react";
import type { PageFlip } from "page-flip";
import { parseMenuPages } from "@/lib/menu-pages";

// Renders the uploaded menu (PDF or photos) as a book with page-turn animation.
// PDFs are rendered to images in the browser with pdf.js, then handed to StPageFlip.

const PDF_WORKER_SRC = "/pdfjs/pdf.worker.min.mjs";
const PDF_RENDER_WIDTH = 1400; // px, sharp enough for phones and desktop
const MAX_PDF_PAGES = 60;
// Below 2x this width the book shows one page at a time (phones)
const MIN_PAGE_WIDTH = 280;

type Status = "loading" | "ready" | "error";

interface MenuBookProps {
  /** Restaurant.menuPdfUrl: a PDF url, an image url, or a JSON array of image urls */
  source: string | null;
  accentColor?: string;
  /** Max book height as a fraction of the window height */
  maxHeightRatio?: number;
}

function loadImageRatio(url: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth ? img.naturalHeight / img.naturalWidth : 1.414);
    img.onerror = () => resolve(1.414);
    img.src = url;
  });
}

async function renderPdfToImages(
  url: string,
  onProgress: (done: number, total: number) => void,
  isCancelled: () => boolean,
): Promise<{ images: string[]; ratio: number }> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;

  const doc = await pdfjs.getDocument({ url }).promise;
  const total = Math.min(doc.numPages, MAX_PDF_PAGES);
  const images: string[] = [];
  let ratio = 1.414;
  onProgress(0, total);

  try {
    for (let i = 1; i <= total; i++) {
      if (isCancelled()) break;
      const page = await doc.getPage(i);
      const base = page.getViewport({ scale: 1 });
      if (i === 1) ratio = base.height / base.width;
      const scale = Math.min(2.5, PDF_RENDER_WIDTH / base.width);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      await page.render({ canvas, viewport }).promise;

      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.88));
      if (blob) images.push(URL.createObjectURL(blob));
      page.cleanup();
      onProgress(i, total);
    }
  } finally {
    await doc.destroy();
  }

  return { images, ratio };
}

export function MenuBook({ source, accentColor = "#3b82f6", maxHeightRatio = 0.78 }: MenuBookProps) {
  const pages = parseMenuPages(source);
  const pdfUrl = pages?.kind === "pdf" ? pages.url : null;

  const [status, setStatus] = useState<Status>("loading");
  const [images, setImages] = useState<string[]>([]);
  const [ratio, setRatio] = useState(1.414);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [page, setPage] = useState(0);
  const [landscape, setLandscape] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const flipRef = useRef<PageFlip | null>(null);
  const pageRef = useRef(0);

  // 1) Turn the source into a list of page images
  useEffect(() => {
    let cancelled = false;
    const objectUrls: string[] = [];
    const parsed = parseMenuPages(source);

    (async () => {
      try {
        if (!parsed) throw new Error("No menu");
        if (parsed.kind === "images") {
          const r = await loadImageRatio(parsed.urls[0]);
          if (cancelled) return;
          setRatio(r);
          setImages(parsed.urls);
          setStatus("ready");
          return;
        }
        const result = await renderPdfToImages(
          parsed.url,
          (done, total) => { if (!cancelled) setProgress({ done, total }); },
          () => cancelled,
        );
        objectUrls.push(...result.images);
        if (cancelled) return;
        if (!result.images.length) throw new Error("Empty PDF");
        setRatio(result.ratio);
        setImages(result.images);
        setStatus("ready");
      } catch (err) {
        console.error("[MenuBook] failed to load menu", err);
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      objectUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [source]);

  // 2) Build the flip book once the images are ready (and rebuild on fullscreen change)
  useEffect(() => {
    if (status !== "ready" || images.length < 2 || !hostRef.current) return;
    let disposed = false;
    let instance: PageFlip | null = null;

    const host = hostRef.current;
    const maxHeight = () => window.innerHeight * (isFullscreen ? 0.86 : maxHeightRatio);

    // StPageFlip sizes the book from its width only, so cap the width to keep it on screen
    const fitHost = () => {
      const avail = host.parentElement?.clientWidth ?? window.innerWidth;
      let w = Math.min(avail, (2 * maxHeight()) / ratio); // two-page spread
      if (w < 2 * MIN_PAGE_WIDTH) w = Math.min(avail, maxHeight() / ratio); // single page
      host.style.maxWidth = `${Math.floor(w)}px`;
    };
    fitHost();

    // StPageFlip removes its root element on destroy, so give it its own child div
    const block = document.createElement("div");
    host.appendChild(block);

    let raf = 0;
    const onResize = () => {
      fitHost();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => instance?.update());
    };
    window.addEventListener("resize", onResize);

    (async () => {
      const { PageFlip } = await import("page-flip");
      if (disposed) return;

      const baseWidth = 600;
      instance = new PageFlip(block, {
        width: baseWidth,
        height: Math.round(baseWidth * ratio),
        size: "stretch",
        minWidth: MIN_PAGE_WIDTH,
        maxWidth: 1100,
        minHeight: Math.round(MIN_PAGE_WIDTH * ratio),
        maxHeight: Math.round(maxHeight()),
        showCover: true,
        usePortrait: true,
        mobileScrollSupport: true,
        drawShadow: true,
        maxShadowOpacity: 0.45,
        flippingTime: 750,
        startPage: Math.min(pageRef.current, images.length - 1),
      });

      instance.on("flip", (e) => {
        const p = Number(e.data);
        pageRef.current = p;
        setPage(p);
      });
      const onMode = (e: { data: unknown }) => {
        const mode = typeof e.data === "object" && e.data && "mode" in e.data ? (e.data as { mode: string }).mode : e.data;
        setLandscape(mode === "landscape");
      };
      instance.on("init", onMode);
      instance.on("changeOrientation", onMode);

      instance.loadFromImages(images);
      // The library paints the whole canvas white every frame. Make it transparent instead,
      // so the cover sits on its own like a closed book instead of next to a blank page.
      const render = instance.getRender() as unknown as {
        ctx?: CanvasRenderingContext2D;
        canvas?: HTMLCanvasElement;
        clear?: () => void;
      };
      if (render && typeof render.clear === "function") {
        render.clear = function (this: typeof render) {
          if (this.ctx && this.canvas) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        };
      }
      flipRef.current = instance;
    })();

    return () => {
      disposed = true;
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
      flipRef.current = null;
      if (instance) instance.destroy();
      else block.remove();
    };
  }, [status, images, ratio, isFullscreen, maxHeightRatio]);

  const prev = useCallback(() => flipRef.current?.flipPrev(), []);
  const next = useCallback(() => flipRef.current?.flipNext(), []);

  // Keyboard arrows
  useEffect(() => {
    if (status !== "ready") return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status, prev, next]);

  // Track fullscreen changes (also when the user presses Esc)
  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === wrapperRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else el.requestFullscreen?.().catch(() => {});
  }, []);

  const total = images.length;
  const canFullscreen = typeof document !== "undefined" && !!document.fullscreenEnabled;

  let pageLabel = `${page + 1}`;
  if (landscape && page > 0 && page + 1 < total) pageLabel = `${page + 1}–${page + 2}`;

  if (!pages) {
    return (
      <div className="py-20 text-center">
        <div className="text-5xl mb-4">📋</div>
        <p className="text-gray-500 font-medium">Menu not uploaded yet</p>
      </div>
    );
  }

  if (status === "error") {
    // Fall back to the browser's own viewer so the menu is still readable
    return (
      <div className="space-y-3">
        {pdfUrl ? (
          <iframe src={pdfUrl} title="Menu" className="w-full rounded-2xl border border-gray-200 shadow-sm" style={{ minHeight: "78vh" }} />
        ) : (
          images.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={src} alt={`Menu page ${i + 1}`} className="w-full rounded-2xl shadow-sm" />
          ))
        )}
      </div>
    );
  }

  if (status === "loading") {
    const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-gray-500">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: accentColor }} />
        <p className="text-sm font-medium">
          {progress ? `Preparing page ${Math.min(progress.done + 1, progress.total)} of ${progress.total}` : "Opening menu"}
        </p>
        {progress && (
          <div className="w-48 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: accentColor }} />
          </div>
        )}
      </div>
    );
  }

  // Single photo: no book needed
  if (total === 1) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={images[0]} alt="Menu" className="max-w-full mx-auto rounded-2xl shadow-lg border border-gray-100" />
    );
  }

  return (
    <div
      ref={wrapperRef}
      className={`flex flex-col items-center gap-4 ${isFullscreen ? "bg-neutral-900 justify-center h-full p-4" : ""}`}
    >
      <div className="w-full" style={{ filter: "drop-shadow(0 18px 30px rgba(0,0,0,0.18))" }}>
        <div ref={hostRef} className="w-full mx-auto" />
      </div>

      <div
        className={`flex items-center gap-2 rounded-full px-2 py-1.5 shadow-sm border ${
          isFullscreen ? "bg-white/10 border-white/10 text-white" : "bg-white border-gray-100 text-gray-700"
        }`}
      >
        <button
          onClick={prev}
          disabled={page === 0}
          aria-label="Previous page"
          className="w-9 h-9 rounded-full flex items-center justify-center text-white transition-opacity disabled:opacity-30"
          style={{ background: accentColor }}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-sm font-semibold tabular-nums min-w-[72px] text-center">
          {pageLabel} / {total}
        </span>
        <button
          onClick={next}
          disabled={landscape && page > 0 ? page + 2 >= total : page + 1 >= total}
          aria-label="Next page"
          className="w-9 h-9 rounded-full flex items-center justify-center text-white transition-opacity disabled:opacity-30"
          style={{ background: accentColor }}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        {canFullscreen && (
          <button
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit full screen" : "Full screen"}
            className={`w-9 h-9 rounded-full flex items-center justify-center ${isFullscreen ? "hover:bg-white/10" : "hover:bg-gray-100"}`}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        )}
      </div>

      {!isFullscreen && (
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span>Swipe or tap the page corners to turn</span>
          {pdfUrl && (
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-gray-600">
              <FileText className="w-3.5 h-3.5" /> Open PDF
            </a>
          )}
        </div>
      )}
    </div>
  );
}
