"use client";

// Public view of a menu built in the designer.
// "book": the saved page pictures in the flip book. "scroll": the pages one under the other.
// If the page pictures are missing (export failed), the book falls back to scrolling.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BookViewerPage, SocialNav, type SocialLinks } from "@/components/book-viewer-page";
import { ScaledPage, useDesignFonts } from "@/components/design/design-render";
import { PAGE_SIZES, designFonts, type MenuDesign } from "@/lib/menu-design-types";

export function DesignMenuPage({ name, design, socialLinks }: { name: string; design: MenuDesign; socialLinks: SocialLinks }) {
  const useBook = design.display === "book" && design.pageImages?.length === design.pages.length;
  useDesignFonts(useBook ? [] : designFonts(design));
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [useBook]);

  if (useBook) {
    return <BookViewerPage name={name} menuPdfUrl={JSON.stringify(design.pageImages)} socialLinks={socialLinks} />;
  }

  const pageW = PAGE_SIZES[design.size].w;
  // Full width on phones, at most the real page width (or 720px) on big screens
  const w = Math.min(width, Math.min(900, Math.max(pageW, 720)));

  return (
    <div className="min-h-screen bg-[#333333] text-white flex flex-col">
      <h1 className="sr-only">{name} menu</h1>
      <SocialNav socialLinks={socialLinks} className="px-4 pt-2.5 pb-2" />
      <main className="flex-1 w-full px-0 sm:px-4 py-3 sm:py-5">
        <div ref={wrapRef} className="w-full flex flex-col items-center gap-3 sm:gap-5">
          {w > 0 && design.pages.map((page) => (
            <ScaledPage key={page.id} page={page} size={design.size} width={w}
              className="shadow-2xl sm:rounded-sm" />
          ))}
        </div>
      </main>
      <footer className="shrink-0 py-3 text-center">
        <Link href="/" className="text-xs text-white/60 hover:text-white/90 transition-colors">
          Powered by <span className="font-semibold text-white/85">Skano.Menu</span>
        </Link>
      </footer>
    </div>
  );
}
