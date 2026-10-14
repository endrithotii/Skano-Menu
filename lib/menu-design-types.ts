// "Design" menus: menus built freely in a Canva-style editor (Digital menu tab).
// A design is a list of fixed-size pages; each page has a background and absolutely positioned elements.
// Shared by the editor, the public pages and the API (no server-only imports here).

export type PageSize = "a4" | "a5" | "square" | "phone";
export type DisplayMode = "book" | "scroll";

/** Page sizes in design units (px at 96 dpi) */
export const PAGE_SIZES: Record<PageSize, { w: number; h: number; label: string }> = {
  a4: { w: 794, h: 1123, label: "A4 (portrait)" },
  a5: { w: 559, h: 794, label: "A5 (portrait)" },
  square: { w: 1000, h: 1000, label: "Square" },
  phone: { w: 430, h: 932, label: "Phone" },
};

export const FONTS = [
  "Inter", "Playfair Display", "Lora", "Cormorant Garamond", "Libre Baskerville", "Merriweather",
  "Montserrat", "Poppins", "Raleway", "Josefin Sans", "Oswald", "Bebas Neue",
  "Great Vibes", "Dancing Script", "Roboto Slab",
] as const;

export function fontStack(family?: string) {
  const f = family && (FONTS as readonly string[]).includes(family) ? family : "Inter";
  const serif = ["Playfair Display", "Lora", "Cormorant Garamond", "Libre Baskerville", "Merriweather", "Roboto Slab"];
  const script = ["Great Vibes", "Dancing Script"];
  const fallback = serif.includes(f) ? "Georgia, serif" : script.includes(f) ? "cursive" : "system-ui, sans-serif";
  return `"${f}", ${fallback}`;
}

/** Google Fonts stylesheet for the given families */
export function googleFontsUrl(families: string[]) {
  const list = [...new Set(families.filter((f) => (FONTS as readonly string[]).includes(f)))];
  if (!list.length) return null;
  const parts = list.map((f) => {
    const name = f.replace(/ /g, "+");
    const single = ["Great Vibes", "Bebas Neue"].includes(f); // only one weight
    return single ? `family=${name}` : `family=${name}:ital,wght@0,400;0,600;0,700;1,400`;
  });
  return `https://fonts.googleapis.com/css2?${parts.join("&")}&display=swap`;
}

export type Fill =
  | { type: "solid"; color: string }
  | { type: "linear"; from: string; to: string; angle: number }
  | { type: "none" };

export type PageBackground =
  | { type: "solid"; color: string }
  | { type: "linear"; from: string; to: string; angle: number }
  | { type: "image"; url: string; fit: "cover" | "contain"; x: number; y: number; dim: number; color: string };

export type ElementType = "text" | "item" | "image" | "rect" | "ellipse" | "line";

export interface DesignElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  opacity?: number; // 0-1
  groupId?: string | null;
  // text + item
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  italic?: boolean;
  underline?: boolean;
  uppercase?: boolean;
  color?: string;
  align?: "left" | "center" | "right";
  lineHeight?: number;
  letterSpacing?: number;
  // item (menu item)
  name?: string;
  description?: string;
  price?: string;
  accentColor?: string;
  // shapes
  fill?: Fill;
  borderColor?: string;
  borderWidth?: number;
  radius?: number;
  // image
  src?: string;
  fit?: "cover" | "contain";
}

export interface DesignPage {
  id: string;
  background: PageBackground;
  elements: DesignElement[];
}

export interface MenuDesign {
  version: 1;
  size: PageSize;
  display: DisplayMode;
  pages: DesignPage[];
  /** Pictures of the pages, made when saving, used by the flip book */
  pageImages?: string[];
}

export const DESIGN_LIMITS = { pages: 40, elements: 300, text: 3000 };

export const newId = (p = "e") => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export function fillCss(fill?: Fill): string {
  if (!fill || fill.type === "none") return "transparent";
  if (fill.type === "solid") return fill.color;
  return `linear-gradient(${fill.angle}deg, ${fill.from}, ${fill.to})`;
}

export function backgroundCss(bg: PageBackground): React.CSSProperties {
  if (bg.type === "solid") return { background: bg.color };
  if (bg.type === "linear") return { background: `linear-gradient(${bg.angle}deg, ${bg.from}, ${bg.to})` };
  return { backgroundColor: bg.color };
}

/** All fonts a design uses (to load them) */
export function designFonts(design: MenuDesign): string[] {
  const set = new Set<string>(["Inter"]);
  for (const p of design.pages) for (const e of p.elements) if (e.fontFamily) set.add(e.fontFamily);
  return [...set];
}

export function designImageUrls(design: MenuDesign): string[] {
  const urls: string[] = [];
  for (const p of design.pages) {
    if (p.background.type === "image") urls.push(p.background.url);
    for (const e of p.elements) if (e.type === "image" && e.src) urls.push(e.src);
  }
  return [...urls, ...(design.pageImages ?? [])];
}

/** Copies elements with fresh ids (and fresh group ids, kept together) */
export function cloneElements(els: DesignElement[], dx = 0, dy = 0): DesignElement[] {
  const groups = new Map<string, string>();
  return els.map((e) => {
    let groupId = e.groupId ?? null;
    if (groupId) {
      if (!groups.has(groupId)) groups.set(groupId, newId("g"));
      groupId = groups.get(groupId)!;
    }
    return { ...structuredClone(e), id: newId(), groupId, x: e.x + dx, y: e.y + dy };
  });
}

export function clonePage(page: DesignPage): DesignPage {
  return { id: newId("p"), background: structuredClone(page.background), elements: cloneElements(page.elements) };
}

// ── Starting points ─────────────────────────────────────────────────────────

export function defaultElement(type: ElementType, size: PageSize, preset?: string): Omit<DesignElement, "x" | "y"> & { x?: number; y?: number } {
  const W = PAGE_SIZES[size].w;
  const base = { id: newId(), opacity: 1, rotation: 0 };
  switch (type) {
    case "text": {
      if (preset === "heading") return { ...base, type, w: Math.round(W * 0.7), h: 70, text: "Menu", fontFamily: "Playfair Display", fontSize: 56, fontWeight: 700, color: "#1f2937", align: "center", lineHeight: 1.15, letterSpacing: 0 };
      if (preset === "subheading") return { ...base, type, w: Math.round(W * 0.6), h: 40, text: "STARTERS", fontFamily: "Montserrat", fontSize: 22, fontWeight: 600, color: "#1f2937", align: "center", lineHeight: 1.2, letterSpacing: 3 };
      return { ...base, type, w: Math.round(W * 0.6), h: 60, text: "Write something here", fontFamily: "Inter", fontSize: 16, fontWeight: 400, color: "#374151", align: "left", lineHeight: 1.4, letterSpacing: 0 };
    }
    case "item":
      return { ...base, type, w: Math.round(W * 0.8), h: 56, name: "Dish name", price: "8.50 €", description: "Short description of the dish", fontFamily: "Lora", fontSize: 18, fontWeight: 600, color: "#1f2937", accentColor: "#92400e", lineHeight: 1.3 };
    case "image":
      return { ...base, type, w: Math.round(W * 0.5), h: Math.round(W * 0.35), src: "", fit: "cover", radius: 8 };
    case "rect":
      return { ...base, type, w: 220, h: 140, fill: { type: "solid", color: "#e5e7eb" }, borderColor: "#9ca3af", borderWidth: 0, radius: preset === "box" ? 16 : 0 };
    case "ellipse":
      return { ...base, type, w: 140, h: 140, fill: { type: "solid", color: "#fbbf24" }, borderColor: "#92400e", borderWidth: 0 };
    case "line":
      return { ...base, type, w: Math.round(W * 0.6), h: 2, fill: { type: "solid", color: "#9ca3af" } };
  }
}

function placed(el: ReturnType<typeof defaultElement>, x: number, y: number, extra: Partial<DesignElement> = {}): DesignElement {
  return { ...el, x, y, ...extra } as DesignElement;
}

export function blankDesign(size: PageSize = "a4"): MenuDesign {
  return { version: 1, size, display: "book", pages: [{ id: newId("p"), background: { type: "solid", color: "#ffffff" }, elements: [] }] };
}

export type TemplateId = "blank" | "classic" | "dark";

export function templateDesign(id: TemplateId, size: PageSize, restaurantName: string): MenuDesign {
  if (id === "blank") return blankDesign(size);
  const { w: W, h: H } = PAGE_SIZES[size];
  const dark = id === "dark";
  const ink = dark ? "#f5e6c8" : "#2b2118";
  const accent = dark ? "#d4af37" : "#8b5a2b";
  const bg: PageBackground = dark
    ? { type: "linear", from: "#1c1917", to: "#0c0a09", angle: 160 }
    : { type: "solid", color: "#faf6ef" };
  const m = Math.round(W * 0.1);
  const iw = W - m * 2;
  const s = W / 794; // scale font sizes to the page width
  const items = (names: [string, string, string][], top: number) =>
    names.map(([name, price, description], i) =>
      placed(defaultElement("item", size), m, top + i * Math.round(78 * s), {
        w: iw, h: Math.round(60 * s), name, price, description,
        fontFamily: dark ? "Cormorant Garamond" : "Lora", fontSize: Math.round(19 * s), color: ink, accentColor: accent,
      }));
  const title = (text: string, y: number) =>
    placed(defaultElement("text", size, "subheading"), m, y, {
      w: iw, h: Math.round(36 * s), text, fontSize: Math.round(20 * s), color: accent, letterSpacing: 4,
      fontFamily: dark ? "Cormorant Garamond" : "Montserrat",
    });
  const line = (y: number) => placed(defaultElement("line", size), Math.round(W * 0.35), y, { w: Math.round(W * 0.3), h: 2, fill: { type: "solid", color: accent } });

  const page1: DesignPage = {
    id: newId("p"),
    background: bg,
    elements: [
      ...(dark ? [] : [placed(defaultElement("rect", size), Math.round(W * 0.04), Math.round(W * 0.04), {
        w: Math.round(W * 0.92), h: H - Math.round(W * 0.08), fill: { type: "none" }, borderColor: accent, borderWidth: 2, radius: 0,
      })]),
      placed(defaultElement("text", size, "heading"), m, Math.round(H * 0.07), {
        w: iw, h: Math.round(80 * s), text: restaurantName || "Our Menu",
        fontFamily: dark ? "Great Vibes" : "Playfair Display", fontSize: Math.round((dark ? 72 : 56) * s), color: ink,
      }),
      line(Math.round(H * 0.07 + 95 * s)),
      title("STARTERS", Math.round(H * 0.2)),
      ...items([["Bruschetta", "5.50 €", "Toasted bread, tomatoes, basil, olive oil"], ["Soup of the day", "4.00 €", "Ask your waiter"], ["Caprese salad", "7.00 €", "Mozzarella, tomatoes, fresh basil"]], Math.round(H * 0.2 + 55 * s)),
      title("MAIN COURSES", Math.round(H * 0.52)),
      ...items([["Grilled salmon", "16.00 €", "Seasonal vegetables, lemon butter"], ["Beef fillet", "22.00 €", "Potato gratin, pepper sauce"], ["Mushroom risotto", "12.00 €", "Arborio rice, parmesan, truffle oil"]], Math.round(H * 0.52 + 55 * s)),
    ],
  };
  return { version: 1, size, display: "book", pages: [page1] };
}
