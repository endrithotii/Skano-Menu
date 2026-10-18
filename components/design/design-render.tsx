"use client";

// Draws design pages and their elements. Used by the editor, the public menu and the page-picture export,
// so a design looks the same everywhere.

import { useEffect } from "react";
import {
  backgroundCss, clipCss, fillColor, fillCss, fontStack, googleFontsUrl, toDims,
  type DesignElement, type DesignPage, type Dims, type PageSize,
} from "@/lib/menu-design-types";
import { DietBadge, dietTag } from "@/lib/diet-icons";

/** Loads the Google Fonts a design uses (once per family set) */
export function useDesignFonts(families: string[]) {
  const href = googleFontsUrl(families);
  useEffect(() => {
    if (!href || typeof document === "undefined") return;
    if (document.querySelector(`link[data-design-fonts="${href}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.crossOrigin = "anonymous";
    link.dataset.designFonts = href;
    document.head.appendChild(link);
  }, [href]);
}

function textStyle(e: DesignElement): React.CSSProperties {
  return {
    fontFamily: fontStack(e.fontFamily),
    fontSize: e.fontSize ?? 16,
    fontWeight: e.fontWeight ?? 400,
    fontStyle: e.italic ? "italic" : "normal",
    textDecoration: e.underline ? "underline" : "none",
    textTransform: e.uppercase ? "uppercase" : "none",
    color: e.color ?? "#111827",
    textAlign: e.align ?? "left",
    lineHeight: e.lineHeight ?? 1.3,
    letterSpacing: e.letterSpacing ?? 0,
  };
}

/** The inside of one element (no position) */
export function ElementContent({ el }: { el: DesignElement }) {
  switch (el.type) {
    case "text":
      if (el.textFill) {
        // Label / tag: text on a colored background, centered vertically
        return (
          <div style={{
            ...textStyle(el), width: "100%", height: "100%", boxSizing: "border-box", display: "flex", alignItems: "center",
            justifyContent: el.align === "center" ? "center" : el.align === "right" ? "flex-end" : "flex-start",
            background: fillCss(el.textFill), borderRadius: el.radius ?? 0, padding: `0 ${el.padding ?? 8}px`,
            whiteSpace: "pre-wrap", overflowWrap: "break-word",
          }}>
            <span style={{ width: "100%" }}>{el.text}</span>
          </div>
        );
      }
      return (
        <div style={{ ...textStyle(el), width: "100%", height: "100%", whiteSpace: "pre-wrap", overflowWrap: "break-word" }}>
          {el.text}
        </div>
      );
    case "item": {
      const s = textStyle(el);
      return (
        <div style={{ ...s, width: "100%", height: "100%", display: "flex", flexDirection: "column", gap: (el.fontSize ?? 16) * 0.15 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: (el.fontSize ?? 16) * 0.4 }}>
            <span style={{ flexShrink: 1, minWidth: 0, overflowWrap: "break-word" }}>
              {el.name}
              {!!el.diet?.length && (
                <span data-diet style={{ display: "inline-flex", gap: Math.max(2, (el.fontSize ?? 16) * 0.18), marginLeft: (el.fontSize ?? 16) * 0.35, verticalAlign: "middle", transform: "translateY(-0.08em)" }}>
                  {el.diet.map((d) => <DietBadge key={d} tag={d} size={Math.round((el.fontSize ?? 16) * 1.05)} title />)}
                </span>
              )}
            </span>
            <span aria-hidden style={{ flex: 1, minWidth: 12, borderBottom: `${Math.max(1, (el.fontSize ?? 16) / 12)}px dotted currentColor`, opacity: 0.45, transform: `translateY(-${(el.fontSize ?? 16) * 0.25}px)` }} />
            <span style={{ flexShrink: 0, color: el.accentColor ?? s.color }}>{el.price}</span>
          </div>
          {el.description && (
            <div style={{ fontSize: (el.fontSize ?? 16) * 0.72, fontWeight: 400, fontStyle: "italic", opacity: 0.75, lineHeight: 1.35, textTransform: "none", letterSpacing: 0 }}>
              {el.description}
            </div>
          )}
        </div>
      );
    }
    case "image":
      return el.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={el.src} alt="" draggable={false} crossOrigin="anonymous"
          style={{
            width: "100%", height: "100%", objectFit: el.fit ?? "cover", display: "block",
            borderRadius: el.radius ?? 0, ...clipCss(el.clip, el.w),
            border: el.borderWidth ? `${el.borderWidth}px solid ${el.borderColor}` : undefined,
            boxSizing: "border-box",
          }} />
      ) : (
        <div style={{ width: "100%", height: "100%", borderRadius: el.radius ?? 0, background: "repeating-linear-gradient(45deg,#e5e7eb,#e5e7eb 10px,#f3f4f6 10px,#f3f4f6 20px)", display: "flex", alignItems: "center", justifyContent: "center", color: "#6b7280", fontFamily: "system-ui", fontSize: 14 }}>
          Photo
        </div>
      );
    case "rect":
    case "ellipse":
      return (
        <div style={{
          width: "100%", height: "100%", boxSizing: "border-box",
          background: fillCss(el.fill),
          border: el.borderWidth ? `${el.borderWidth}px solid ${el.borderColor}` : undefined,
          borderRadius: el.type === "ellipse" ? "50%" : el.radius ?? 0,
          ...clipCss(el.clip, el.w),
        }} />
      );
    case "line": {
      const style = el.lineStyle ?? "solid";
      if (style === "solid") return <div style={{ width: "100%", height: "100%", background: fillCss(el.fill), borderRadius: 999 }} />;
      // Dashed / dotted / double lines are drawn with a border (one color)
      const t = el.vertical ? el.w : el.h;
      const border = `${style === "double" ? Math.max(3, t) : t}px ${style} ${fillColor(el.fill)}`;
      return el.vertical
        ? <div style={{ width: 0, height: "100%", margin: "0 auto", borderLeft: border }} />
        : <div style={{ width: "100%", height: 0, marginTop: (el.h - t) / 2, borderTop: border }} />;
    }
    case "legend": {
      // The key: each icon with what it means
      const fs = el.fontSize ?? 13;
      const just = el.align === "left" ? "flex-start" : el.align === "right" ? "flex-end" : "center";
      return (
        <div data-legend style={{ ...textStyle(el), width: "100%", height: "100%", display: "flex", flexWrap: "wrap", alignItems: "center", alignContent: "center", justifyContent: just, columnGap: fs * 1.1, rowGap: fs * 0.5 }}>
          {(el.diet ?? []).filter((d) => dietTag(d)).map((d) => (
            <span key={d} style={{ display: "inline-flex", alignItems: "center", gap: fs * 0.4, whiteSpace: "nowrap" }}>
              <DietBadge tag={d} size={Math.round(fs * 1.5)} /> {dietTag(d)!.label}
            </span>
          ))}
        </div>
      );
    }
    case "divider": {
      const c = el.color ?? "#9a7b4f";
      const line = <span style={{ flex: 1, minWidth: 0, borderTop: `${el.borderWidth ?? 1}px ${el.lineStyle ?? "solid"} ${c}` }} />;
      return (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", gap: el.symbol ? el.h * 0.35 : 0 }}>
          {line}
          {el.symbol && <span style={{ color: c, fontSize: el.h * 0.75, lineHeight: 1, fontFamily: "Georgia, serif" }}>{el.symbol}</span>}
          {el.symbol && line}
        </div>
      );
    }
  }
}

export function elementBoxStyle(el: DesignElement): React.CSSProperties {
  return {
    position: "absolute",
    left: el.x,
    top: el.y,
    width: el.w,
    height: el.h,
    opacity: el.opacity ?? 1,
    transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
    filter: el.shadow ? "drop-shadow(0 6px 12px rgba(0,0,0,0.28))" : undefined,
  };
}

/** Page background (colors, gradient, or photo with optional dimming) */
export function PageBackgroundView({ page }: { page: DesignPage }) {
  const bg = page.background;
  return (
    <div style={{ position: "absolute", inset: 0, ...backgroundCss(bg) }}>
      {bg.type === "image" && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={bg.url} alt="" draggable={false} crossOrigin="anonymous"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: bg.fit, objectPosition: `${bg.x}% ${bg.y}%` }} />
          {bg.dim > 0 && <div style={{ position: "absolute", inset: 0, background: `rgba(0,0,0,${bg.dim})` }} />}
        </>
      )}
    </div>
  );
}

/** A whole page at its real size (scale it from outside) */
export function DesignPageView({ page, size, renderElement }: {
  page: DesignPage;
  size: PageSize | Dims;
  /** The editor wraps elements with its own handles */
  renderElement?: (el: DesignElement) => React.ReactNode;
}) {
  const { w, h } = toDims(size);
  return (
    <div style={{ position: "relative", width: w, height: h, overflow: "hidden" }}>
      <PageBackgroundView page={page} />
      {page.elements.filter((el) => renderElement || !el.hidden).map((el) =>
        renderElement ? renderElement(el) : (
          <div key={el.id} style={elementBoxStyle(el)}>
            <ElementContent el={el} />
          </div>
        ),
      )}
    </div>
  );
}

/** A page scaled to a given width */
export function ScaledPage({ page, size, width, className }: { page: DesignPage; size: PageSize | Dims; width: number; className?: string }) {
  const { w, h } = toDims(size);
  const scale = width / w;
  return (
    <div className={className} style={{ width, height: h * scale, position: "relative", overflow: "hidden" }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", position: "absolute", left: 0, top: 0 }}>
        <DesignPageView page={page} size={size} />
      </div>
    </div>
  );
}
