"use client";

// Public "Menu tree" pages: /r/<slug>  ->  /r/<slug>/<button>  ->  ...  ->  a saved PDF / photo menu.
// TreeScreen is also used as the live preview in the dashboard editor.

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Loader2 } from "lucide-react";
import { BookViewerPage, parseSocialLinks } from "@/components/book-viewer-page";
import { effectiveBackground, resolvePath, treeStyle, DEFAULT_TREE_STYLE, type MenuTree, type TreeBackground, type TreeStyle } from "@/lib/menu-tree-types";
import { fontStack } from "@/lib/menu-design-types";
import { useDesignFonts } from "@/components/design/design-render";

export interface TreeButton {
  key: string;
  label: string;
  href?: string;
  onClick?: () => void;
}

/** One screen: background photo, logo, short text and the buttons. */
export function TreeScreen({
  restaurantName, logo, subtitle, background, buttons, backHref, onBack, display = "auto", fill = "screen", boxHeight, children,
  look = DEFAULT_TREE_STYLE,
}: {
  /** Fonts, colors and buttons */
  look?: TreeStyle;
  restaurantName: string;
  logo?: string | null;
  subtitle?: string;
  background: TreeBackground | null;
  buttons: TreeButton[];
  backHref?: string;
  /** Instead of backHref (editor preview) */
  onBack?: () => void;
  /** "auto" picks the photo position by screen shape; the editor forces one */
  display?: "auto" | "desktop" | "phone";
  /** "screen" = full page, "box" = fills its parent (editor preview) */
  fill?: "screen" | "box";
  /** Height of the box in px (fill "box"), so spacing matches a real screen of that size */
  boxHeight?: number;
  /** Extra layers (the editor's drag handle) */
  children?: React.ReactNode;
}) {
  const posD = background ? `${background.x}% ${background.y}%` : "50% 50%";
  const posM = background ? `${background.mx}% ${background.my}%` : "50% 50%";
  const imgStyle: React.CSSProperties =
    display === "desktop" ? { objectPosition: posD }
    : display === "phone" ? { objectPosition: posM }
    : ({ "--pd": posD, "--pm": posM } as React.CSSProperties);

  useDesignFonts([look.font, look.buttonFont].filter(Boolean));
  const fam = (f: string) => (f ? fontStack(f) : undefined);
  const btnClass = "block w-full text-center px-5 py-3 leading-tight hover:brightness-110 hover:opacity-90 active:opacity-80 transition break-words";
  const btnStyle: React.CSSProperties = {
    fontFamily: fam(look.buttonFont),
    fontSize: look.buttonSize,
    color: look.buttonText,
    background: look.buttonFill,
    border: look.buttonBorder === "transparent" ? "1px solid transparent" : `1px solid ${look.buttonBorder}`,
    borderRadius: look.buttonShape === "pill" ? 999 : look.buttonShape === "rounded" ? 12 : 0,
    fontWeight: look.buttonBold ? 700 : 400,
    textTransform: look.buttonUppercase ? "uppercase" : "none",
    letterSpacing: look.buttonUppercase ? "0.08em" : undefined,
  };

  return (
    <div className={`${fill === "screen" ? "fixed inset-0" : "absolute inset-0"} overflow-hidden bg-neutral-900 text-white font-serif select-none`}>
      {background?.url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={background.url}
          alt=""
          draggable={false}
          className={`absolute inset-0 w-full h-full object-cover pointer-events-none ${display === "auto" ? "[object-position:var(--pm)] landscape:[object-position:var(--pd)]" : ""}`}
          style={imgStyle}
        />
      )}
      {/* Darken the photo so the white text stays readable */}
      <div className={`absolute inset-0 pointer-events-none ${background?.url ? "" : "bg-gradient-to-b from-neutral-800 to-neutral-950"}`}
        style={background?.url ? { background: `rgba(0,0,0,${look.overlay})` } : undefined} />
      {children}

      <div className="relative z-10 h-full overflow-y-auto pointer-events-none">
        {(backHref || onBack) && (() => {
          const cls = "pointer-events-auto absolute left-3 top-3 inline-flex items-center gap-0.5 font-sans text-xs font-medium text-white/85 hover:text-white bg-black/30 hover:bg-black/45 rounded-full pl-1.5 pr-3 py-1 transition-colors";
          return backHref
            ? <Link href={backHref} aria-label="Back" className={cls}><ChevronLeft className="w-4 h-4" /> Back</Link>
            : <button type="button" onClick={onBack} aria-label="Back" className={cls}><ChevronLeft className="w-4 h-4" /> Back</button>;
        })()}
        <div className={`mx-auto flex flex-col items-center px-6 ${fill === "screen" ? "pt-[14vh] pb-10" : "pb-6"}`}
          style={fill === "box" ? { paddingTop: Math.round((boxHeight ?? 600) * 0.14) } : undefined}>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={restaurantName} className="max-h-20 max-w-[220px] object-contain drop-shadow mb-5" />
          ) : (
            <div className="tracking-wide mb-5 text-center" style={{ fontFamily: fam(look.font), fontSize: look.nameSize, color: look.textColor }}>{restaurantName}</div>
          )}
          {subtitle && (
            <p className="text-center mb-5 max-w-sm leading-snug drop-shadow" style={{
              fontFamily: fam(look.font), fontSize: look.textSize, color: look.textColor,
              fontWeight: look.textBold ? 700 : 400, fontStyle: look.textItalic ? "italic" : "normal",
              textTransform: look.textUppercase ? "uppercase" : "none", letterSpacing: look.textUppercase ? "0.08em" : undefined,
            }}>{subtitle}</p>
          )}
          <nav className="w-full flex flex-col gap-2.5 pointer-events-auto" style={{ maxWidth: look.buttonWidth }}>
            {buttons.map((b) =>
              b.href ? (
                <Link key={b.key} href={b.href} className={btnClass} style={btnStyle}>{b.label}</Link>
              ) : (
                <button key={b.key} type="button" onClick={b.onClick} className={btnClass} style={btnStyle}>{b.label}</button>
              ),
            )}
          </nav>
        </div>
      </div>
    </div>
  );
}

interface TreeResponse {
  restaurant: { name: string; slug: string; socialLinks: string; primaryMenu: string };
  tree: MenuTree;
  menus: Record<string, { title: string; menuPdfUrl: string }>;
}

/** Public page for one place in the tree. `path` = the slugs after /r/<slug>/ */
export function MenuTreePage({ slug, path }: { slug: string; path: string[] }) {
  const [data, setData] = useState<TreeResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/restaurants/${encodeURIComponent(slug)}/menu-tree`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("tree"))))
      .then((d: TreeResponse) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [slug]);

  const chain = data ? resolvePath(data.tree, path) : null;
  const current = chain && chain.length ? chain[chain.length - 1] : null;

  useEffect(() => {
    if (!data) return;
    const parts = [data.restaurant.name, ...(chain ?? []).map((n) => n.label)];
    document.title = parts.reverse().join(" · ");
  }, [data, chain]);

  if (failed) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-neutral-900 text-white/80 text-center px-6">
        <p className="font-medium">This menu could not be loaded.</p>
        <button onClick={() => location.reload()} className="mt-3 text-sm underline">Try again</button>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-neutral-900">
        <Loader2 className="w-7 h-7 animate-spin text-white/70" />
      </div>
    );
  }

  const base = `/r/${data.restaurant.slug}`;
  const hrefFor = (slugs: string[]) => (slugs.length ? `${base}/${slugs.map(encodeURIComponent).join("/")}` : base);
  const parentHref = path.length ? hrefFor(path.slice(0, -1)) : undefined;

  if (!chain || (data.tree.children.length === 0 && path.length === 0)) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-neutral-900 text-white/80 text-center px-6">
        <p className="font-medium">{chain ? "This menu is being prepared." : "This page doesn't exist anymore."}</p>
        {path.length > 0 && <Link href={base} className="mt-3 text-sm underline">Go to the start</Link>}
      </div>
    );
  }

  // A button that opens a saved menu: show the book
  if (current?.kind === "menu") {
    const menu = current.menuId ? data.menus[current.menuId] : undefined;
    return (
      <BookViewerPage
        name={`${data.restaurant.name} · ${current.label}`}
        menuPdfUrl={menu?.menuPdfUrl ?? null}
        socialLinks={parseSocialLinks(data.restaurant.socialLinks)}
        backHref={parentHref}
      />
    );
  }

  const level = current ? current.children ?? [] : data.tree.children;
  return (
    <TreeScreen
      restaurantName={data.restaurant.name}
      logo={data.tree.logo}
      subtitle={current ? current.subtitle : data.tree.subtitle}
      background={effectiveBackground(data.tree, chain)}
      look={treeStyle(data.tree)}
      backHref={parentHref}
      buttons={level.map((n) => ({ key: n.id, label: n.label, href: hrefFor([...path, n.slug]) }))}
    />
  );
}
