"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
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
  /**
   * "default": book in a page, turn buttons right beside the pages.
   * "viewer": full-screen public menu on a dark background, simple turn tabs at the screen edges.
   */
  variant?: "default" | "viewer";
  /** CSS height of the book area (overrides maxHeightRatio), e.g. "100%" */
  height?: string;
}

export async function renderPdfToImages(
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

export function MenuBook({ source, accentColor = "#3b82f6", maxHeightRatio = 0.78, variant = "default", height }: MenuBookProps) {
  const viewer = variant === "viewer";
  const pages = parseMenuPages(source);
  const pdfUrl = pages?.kind === "pdf" ? pages.url : null;

  const [status, setStatus] = useState<Status>("loading");
  const [images, setImages] = useState<string[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [book, setBook] = useState<FlipbookState | null>(null);

  const bookRef = useRef<Flipbook3D>(null);
  // On tablets / desktop leave room beside the book for the turn buttons. Phones use the full width.
  const [sidePad, setSidePad] = useState(0);
  useEffect(() => {
    const update = () => setSidePad(!viewer && window.innerWidth >= 640 ? 60 : 0);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [viewer]);

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
      <div className={`flex flex-col items-center justify-center gap-4 ${viewer ? "h-full text-white/70" : "py-24 text-gray-500"}`}>
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
  const bookHeight = height ?? `max(320px, ${Math.round(maxHeightRatio * 100)}vh)`;

  // Turn buttons sit right beside the pages. When there's no room (phones) they overlap the page edge a little.
  const BTN = 44;
  const GAP = 10;
  const b = book?.bounds;
  const btnTop = b ? b.top + b.height / 2 - BTN / 2 : null;
  const EDGE = 6; // keep buttons inside the screen
  // Positions are relative to the book; `sidePad` is the free space on each side of it
  const leftX = b ? Math.max(EDGE - sidePad, b.left - BTN - GAP) : EDGE;
  const rightX = b ? Math.min(b.width + sidePad - BTN - EDGE, b.right + GAP) : null;
  const showButtons = !!b && !book?.zoomed;

  const sideButton = (dir: "prev" | "next") => {
    const enabled = dir === "prev" ? book?.canFlipLeft : book?.canFlipRight;
    if (viewer) {
      // Simple dark tab stuck to the screen edge, vertically centered
      return (
        <button
          key={dir}
          type="button"
          onClick={dir === "prev" ? prev : next}
          disabled={!enabled}
          aria-label={dir === "prev" ? "Previous page" : "Next page"}
          className={`absolute top-1/2 -translate-y-1/2 z-[2000] flex items-center justify-center w-9 h-12 bg-black/45 hover:bg-black/70 text-white transition-opacity disabled:opacity-0 disabled:pointer-events-none ${
            dir === "prev" ? "left-0 rounded-r-full pr-1" : "right-0 rounded-l-full pl-1"
          }`}
          style={{ opacity: showButtons ? undefined : 0, pointerEvents: showButtons ? undefined : "none" }}
        >
          {dir === "prev" ? <ChevronLeft className="w-5 h-5" strokeWidth={3} /> : <ChevronRight className="w-5 h-5" strokeWidth={3} />}
        </button>
      );
    }
    return (
      <button
        key={dir}
        type="button"
        onClick={dir === "prev" ? prev : next}
        disabled={!enabled}
        aria-label={dir === "prev" ? "Previous page" : "Next page"}
        className="absolute z-[2000] flex items-center justify-center rounded-full text-white shadow-lg ring-2 ring-white/80 transition-[left,top,opacity,transform] duration-300 hover:scale-105 active:scale-95 disabled:opacity-0 disabled:pointer-events-none"
        style={{
          width: BTN,
          height: BTN,
          top: btnTop ?? 0,
          ...(dir === "prev"
            ? { left: leftX }
            : rightX !== null ? { left: rightX } : { right: 4 }),
          background: accentColor,
          opacity: showButtons ? undefined : 0,
          pointerEvents: showButtons ? undefined : "none",
        }}
      >
        {dir === "prev" ? <ChevronLeft className="w-6 h-6" /> : <ChevronRight className="w-6 h-6" />}
      </button>
    );
  };

  return (
    <div className={viewer ? "w-full h-full" : "w-full"} style={{ paddingLeft: sidePad, paddingRight: sidePad }}>
      <div className={viewer ? "relative w-full h-full" : "relative w-full"}>
        <Flipbook3D
          ref={bookRef}
          pages={bookPages}
          className="w-full"
          style={{ height: bookHeight }}
          onStateChange={setBook}
          // No zooming into the pages: a tap does nothing, swipe or the arrows turn the page
          clickToZoom={false}
          zooms={[1]}
        />
        {sideButton("prev")}
        {sideButton("next")}
      </div>
    </div>
  );
}
