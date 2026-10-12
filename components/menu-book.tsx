"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, FileText, Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { parseMenuPages } from "@/lib/menu-pages";
import { Flipbook3D, type FlipbookState } from "@/components/flipbook-3d";

// Renders the uploaded menu (PDF or photos) as a book with a 3D page turn (Flipbook3D).
// PDFs are rendered to images in the browser with pdf.js first.

const PDF_WORKER_SRC = "/pdfjs/pdf.worker.min.mjs";
const PDF_RENDER_WIDTH = 1400; // px, sharp enough for phones and desktop
const MAX_PDF_PAGES = 60;

type Status = "loading" | "ready" | "error";

interface MenuBookProps {
  /** Restaurant.menuPdfUrl: a PDF url, an image url, or a JSON array of image urls */
  source: string | null;
  accentColor?: string;
  /** Book area height as a fraction of the window height */
  maxHeightRatio?: number;
}

async function renderPdfToImages(
  url: string,
  onProgress: (done: number, total: number) => void,
  isCancelled: () => boolean,
): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;

  const doc = await pdfjs.getDocument({ url }).promise;
  const total = Math.min(doc.numPages, MAX_PDF_PAGES);
  const images: string[] = [];
  onProgress(0, total);

  try {
    for (let i = 1; i <= total; i++) {
      if (isCancelled()) break;
      const page = await doc.getPage(i);
      const base = page.getViewport({ scale: 1 });
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

  return images;
}

export function MenuBook({ source, accentColor = "#3b82f6", maxHeightRatio = 0.78 }: MenuBookProps) {
  const pages = parseMenuPages(source);
  const pdfUrl = pages?.kind === "pdf" ? pages.url : null;

  const [status, setStatus] = useState<Status>("loading");
  const [images, setImages] = useState<string[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [book, setBook] = useState<FlipbookState | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<Flipbook3D>(null);

  // Turn the source into a list of page images
  useEffect(() => {
    let cancelled = false;
    const objectUrls: string[] = [];
    const parsed = parseMenuPages(source);

    (async () => {
      try {
        if (!parsed) throw new Error("No menu");
        if (parsed.kind === "images") {
          setImages(parsed.urls);
          setStatus("ready");
          return;
        }
        const result = await renderPdfToImages(
          parsed.url,
          (done, total) => { if (!cancelled) setProgress({ done, total }); },
          () => cancelled,
        );
        objectUrls.push(...result);
        if (cancelled) return;
        if (!result.length) throw new Error("Empty PDF");
        setImages(result);
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

  const prev = useCallback(() => bookRef.current?.flipLeft(), []);
  const next = useCallback(() => bookRef.current?.flipRight(), []);
  const zoomIn = useCallback(() => bookRef.current?.zoomIn(), []);
  const zoomOut = useCallback(() => bookRef.current?.zoomOut(), []);

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

  // With more than one page, a leading null shows the cover alone on the right (like a closed book)
  const bookPages: (string | null)[] = images.length > 1 ? [null, ...images] : images;
  const canFullscreen = typeof document !== "undefined" && !!document.fullscreenEnabled;
  const label = book?.visiblePages.length ? book.visiblePages.join("–") : "1";
  const bookHeight = isFullscreen ? "calc(100vh - 96px)" : `max(320px, ${Math.round(maxHeightRatio * 100)}vh)`;

  return (
    <div
      ref={wrapperRef}
      className={`w-full flex flex-col items-center gap-4 ${isFullscreen ? "bg-neutral-900 justify-center h-full p-4" : ""}`}
    >
      <Flipbook3D
        ref={bookRef}
        pages={bookPages}
        className="w-full"
        style={{ height: bookHeight }}
        onStateChange={setBook}
      />

      <div
        className={`flex items-center gap-1.5 rounded-full px-2 py-1.5 shadow-sm border ${
          isFullscreen ? "bg-white/10 border-white/10 text-white" : "bg-white border-gray-100 text-gray-700"
        }`}
      >
        <button
          onClick={prev}
          disabled={!book?.canFlipLeft}
          aria-label="Previous page"
          className="w-9 h-9 rounded-full flex items-center justify-center text-white transition-opacity disabled:opacity-30"
          style={{ background: accentColor }}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-sm font-semibold tabular-nums min-w-[72px] text-center">
          {label} / {book?.numPages ?? images.length}
        </span>
        <button
          onClick={next}
          disabled={!book?.canFlipRight}
          aria-label="Next page"
          className="w-9 h-9 rounded-full flex items-center justify-center text-white transition-opacity disabled:opacity-30"
          style={{ background: accentColor }}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        <span className={`w-px h-5 mx-1 ${isFullscreen ? "bg-white/20" : "bg-gray-200"}`} />
        <button
          onClick={zoomOut}
          disabled={!book?.canZoomOut}
          aria-label="Zoom out"
          className={`w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-30 ${isFullscreen ? "hover:bg-white/10" : "hover:bg-gray-100"}`}
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={zoomIn}
          disabled={!book?.canZoomIn}
          aria-label="Zoom in"
          className={`w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-30 ${isFullscreen ? "hover:bg-white/10" : "hover:bg-gray-100"}`}
        >
          <ZoomIn className="w-4 h-4" />
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
        <div className="flex items-center gap-3 text-xs text-gray-400 text-center">
          <span>Swipe or tap beside the page to turn · Tap a page to zoom</span>
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
