// Starting templates for "Design your digital Menu". Each one is a full first page with sample dishes,
// laid out for the chosen page size (fonts and spacing shrink when the page is short, e.g. square).

import {
  PAGE_SIZES, blankDesign, defaultElement, newId, placed,
  type DesignElement, type DesignPage, type MenuDesign, type PageBackground, type PageSize,
} from "@/lib/menu-design-types";

export type TemplateId =
  | "blank" | "classic" | "dark" | "modern" | "chalk" | "rustic" | "fresh" | "pizzeria" | "cafe" | "navy" | "street" | "botanical";

export const TEMPLATES: { id: TemplateId; title: string; sub: string }[] = [
  { id: "blank", title: "Blank page", sub: "Start from an empty page" },
  { id: "classic", title: "Classic", sub: "Cream paper, serif headings" },
  { id: "dark", title: "Dark elegant", sub: "Dark background, gold text" },
  { id: "modern", title: "Modern minimal", sub: "White, clean letters, red prices" },
  { id: "chalk", title: "Chalkboard", sub: "Bistro board, handwritten title" },
  { id: "rustic", title: "Rustic", sub: "Kraft paper, slab letters, ornaments" },
  { id: "fresh", title: "Fresh & green", sub: "Light green, rounded cards" },
  { id: "pizzeria", title: "Bold pizzeria", sub: "Red header, big letters, two columns" },
  { id: "cafe", title: "Café pastel", sub: "Soft pink, coffee and pastries" },
  { id: "navy", title: "Navy & gold", sub: "Deep blue, gold double frame" },
  { id: "street", title: "Street food", sub: "Black, neon yellow labels" },
  { id: "botanical", title: "Botanical", sub: "Sage green, script title, two columns" },
];

/** All fonts the templates use (to load them for the previews) */
export const TEMPLATE_FONTS = [
  "Inter", "Playfair Display", "Lora", "Cormorant Garamond", "Montserrat", "Great Vibes", "Poppins", "Dancing Script",
  "Roboto Slab", "Bebas Neue", "Oswald", "Josefin Sans", "Raleway", "Libre Baskerville",
];

type Dish = [name: string, price: string, description: string];
type Section = [title: string, dishes: Dish[]];

const SAMPLE: Record<"restaurant" | "cafe" | "pizza" | "street" | "fresh", Section[]> = {
  restaurant: [
    ["Starters", [["Bruschetta", "5.50 €", "Toasted bread, tomatoes, basil, olive oil"], ["Soup of the day", "4.00 €", "Ask your waiter"], ["Caprese salad", "7.00 €", "Mozzarella, tomatoes, fresh basil"]]],
    ["Main courses", [["Grilled salmon", "16.00 €", "Seasonal vegetables, lemon butter"], ["Beef fillet", "22.00 €", "Potato gratin, pepper sauce"], ["Mushroom risotto", "12.00 €", "Arborio rice, parmesan, truffle oil"]]],
    ["Desserts", [["Tiramisu", "6.00 €", "Mascarpone, coffee, cocoa"], ["Panna cotta", "5.50 €", "Vanilla cream, berry sauce"]]],
  ],
  cafe: [
    ["Coffee", [["Espresso", "1.50 €", "Short and strong"], ["Cappuccino", "2.50 €", "Espresso, steamed milk, foam"], ["Flat white", "3.00 €", "Double shot, silky milk"]]],
    ["Pastries", [["Croissant", "2.00 €", "Butter, baked every morning"], ["Cheesecake", "4.50 €", "Baked, with berry sauce"], ["Chocolate muffin", "3.00 €", "Dark chocolate chunks"]]],
    ["Breakfast", [["Avocado toast", "7.50 €", "Sourdough, avocado, poached egg"], ["Pancakes", "6.00 €", "Maple syrup, fresh fruit"]]],
  ],
  pizza: [
    ["Pizza", [["Margherita", "8.00 €", "Tomato, mozzarella, basil"], ["Diavola", "10.00 €", "Spicy salami, chili"], ["Quattro formaggi", "11.00 €", "Four cheeses"], ["Capricciosa", "10.50 €", "Ham, mushrooms, artichokes"]]],
    ["Pasta", [["Carbonara", "9.50 €", "Egg, pecorino, guanciale"], ["Bolognese", "9.00 €", "Slow-cooked beef ragù"], ["Arrabbiata", "8.50 €", "Tomato, garlic, chili"]]],
    ["Salads", [["Mixed salad", "5.00 €", "Seasonal greens"], ["Caesar salad", "7.50 €", "Chicken, parmesan, croutons"]]],
    ["Drinks", [["Cola", "2.50 €", ""], ["House wine", "4.00 €", "Glass, red or white"], ["Water", "1.50 €", ""]]],
  ],
  street: [
    ["Burgers", [["Classic burger", "8.50 €", "Beef, cheddar, pickles, house sauce"], ["Chicken burger", "8.00 €", "Crispy chicken, slaw"], ["Veggie burger", "7.50 €", "Bean patty, avocado"]]],
    ["Sides", [["Fries", "3.00 €", "Sea salt"], ["Onion rings", "3.50 €", "Beer batter"], ["Coleslaw", "2.50 €", ""]]],
    ["Drinks", [["Lemonade", "3.00 €", "Homemade"], ["Milkshake", "4.50 €", "Vanilla, chocolate or strawberry"]]],
  ],
  fresh: [
    ["Salads & bowls", [["Greek salad", "7.00 €", "Tomato, cucumber, feta, olives"], ["Quinoa bowl", "9.50 €", "Roasted vegetables, hummus"], ["Caesar salad", "8.50 €", "Chicken, parmesan, croutons"]]],
    ["Wraps", [["Falafel wrap", "7.50 €", "Tahini, pickles, greens"], ["Chicken wrap", "8.00 €", "Grilled chicken, yogurt sauce"]]],
    ["Smoothies", [["Green detox", "5.00 €", "Spinach, apple, ginger"], ["Berry boost", "5.50 €", "Berries, banana, oat milk"]]],
  ],
};

interface Style {
  bg: PageBackground;
  ink: string;
  accent: string;
  sample: keyof typeof SAMPLE;
  /** Title (restaurant name) */
  titleFont: string; titleSize: number; titleWeight?: number; titleUpper?: boolean; titleSpacing?: number; titleColor?: string;
  titleAlign?: "left" | "center";
  tagline?: string; taglineFont?: string; taglineColor?: string;
  /** Section headings ("STARTERS") */
  sectionFont: string; sectionSize: number; sectionSpacing?: number; sectionColor?: string; sectionUpper?: boolean; sectionWeight?: number;
  sectionAlign?: "left" | "center";
  /** Section heading as a colored label */
  sectionPill?: { fill: string; color: string };
  /** Menu items */
  itemFont: string; itemSize: number; itemWeight?: number; itemUpper?: boolean; priceColor?: string;
  frame?: { kind: "single" | "double"; color: string };
  /** Colored band behind the title */
  band?: { color: string; height: number; titleColor: string; taglineColor?: string };
  divider?: { kind: "line" | "ornament" | "dots"; color: string; symbol?: string };
  /** A card behind every section */
  cards?: { fill: string; border?: string; radius: number; shadow?: boolean };
  columns: 1 | 2;
  /** Line between the two columns */
  columnLine?: string;
  icon?: string;
  footer?: string; footerColor?: string;
}

const STYLES: Record<Exclude<TemplateId, "blank" | "classic" | "dark">, Style> = {
  modern: {
    bg: { type: "solid", color: "#ffffff" }, ink: "#111111", accent: "#dc2626", sample: "restaurant",
    titleFont: "Montserrat", titleSize: 46, titleWeight: 700, titleUpper: true, titleSpacing: 6, titleAlign: "left",
    tagline: "Kitchen & bar", taglineFont: "Montserrat", taglineColor: "#6b7280",
    sectionFont: "Montserrat", sectionSize: 15, sectionSpacing: 4, sectionUpper: true, sectionColor: "#dc2626", sectionAlign: "left", sectionWeight: 700,
    itemFont: "Inter", itemSize: 17, itemWeight: 600, priceColor: "#dc2626",
    divider: { kind: "line", color: "#111111" }, columns: 1,
    footer: "Please tell us about any allergies.", footerColor: "#9ca3af",
  },
  chalk: {
    bg: { type: "linear", from: "#2f3a33", to: "#1f2622", angle: 170 }, ink: "#f5f5f0", accent: "#fde68a", sample: "restaurant",
    titleFont: "Dancing Script", titleSize: 70, titleWeight: 700, titleColor: "#ffffff",
    tagline: "Today's menu", taglineFont: "Josefin Sans", taglineColor: "#d1d5db",
    sectionFont: "Josefin Sans", sectionSize: 20, sectionSpacing: 3, sectionUpper: true, sectionColor: "#fde68a", sectionWeight: 700,
    itemFont: "Josefin Sans", itemSize: 18, itemWeight: 600, priceColor: "#fde68a",
    frame: { kind: "single", color: "#e5e7eb" }, divider: { kind: "dots", color: "#e5e7eb" }, columns: 1,
  },
  rustic: {
    bg: { type: "solid", color: "#e9d8b8" }, ink: "#3b2a1a", accent: "#7c4a1e", sample: "restaurant",
    titleFont: "Roboto Slab", titleSize: 50, titleWeight: 700, titleUpper: true, titleSpacing: 3,
    tagline: "Homemade since 1998", taglineFont: "Lora",
    sectionFont: "Roboto Slab", sectionSize: 21, sectionSpacing: 2, sectionUpper: true, sectionWeight: 700,
    itemFont: "Lora", itemSize: 19, itemWeight: 600,
    frame: { kind: "double", color: "#7c4a1e" }, divider: { kind: "ornament", color: "#7c4a1e", symbol: "❦" }, columns: 1,
  },
  fresh: {
    bg: { type: "linear", from: "#ecfdf5", to: "#ffffff", angle: 180 }, ink: "#14532d", accent: "#16a34a", sample: "fresh",
    titleFont: "Poppins", titleSize: 48, titleWeight: 700, icon: "🥗",
    tagline: "Fresh, light and local", taglineFont: "Poppins", taglineColor: "#4b5563",
    sectionFont: "Poppins", sectionSize: 16, sectionSpacing: 1, sectionUpper: true, sectionWeight: 600,
    sectionPill: { fill: "#16a34a", color: "#ffffff" },
    itemFont: "Poppins", itemSize: 16, itemWeight: 600, priceColor: "#16a34a",
    cards: { fill: "#ffffff", border: "#d1fae5", radius: 22, shadow: true }, columns: 1,
  },
  pizzeria: {
    bg: { type: "solid", color: "#fffaf0" }, ink: "#1f2937", accent: "#b91c1c", sample: "pizza",
    titleFont: "Bebas Neue", titleSize: 84, titleWeight: 400, titleSpacing: 4,
    tagline: "Pizza · Pasta · Vino", taglineFont: "Oswald",
    band: { color: "#b91c1c", height: 0.17, titleColor: "#ffffff", taglineColor: "#fde68a" },
    sectionFont: "Oswald", sectionSize: 22, sectionSpacing: 2, sectionUpper: true, sectionColor: "#b91c1c", sectionAlign: "left", sectionWeight: 700,
    itemFont: "Oswald", itemSize: 17, itemWeight: 400, priceColor: "#15803d",
    columns: 2, columnLine: "#e5e7eb",
    footer: "Gluten-free dough on request.", footerColor: "#6b7280",
  },
  cafe: {
    bg: { type: "solid", color: "#fdf2f4" }, ink: "#4a2c2a", accent: "#be6a7c", sample: "cafe",
    titleFont: "Josefin Sans", titleSize: 44, titleWeight: 700, titleUpper: true, titleSpacing: 8, icon: "☕",
    tagline: "coffee · cakes · breakfast", taglineFont: "Dancing Script", taglineColor: "#be6a7c",
    sectionFont: "Dancing Script", sectionSize: 34, sectionWeight: 700, sectionColor: "#be6a7c",
    itemFont: "Josefin Sans", itemSize: 17, itemWeight: 600, priceColor: "#be6a7c",
    divider: { kind: "ornament", color: "#be6a7c", symbol: "♥" }, columns: 1,
  },
  navy: {
    bg: { type: "linear", from: "#132a4a", to: "#0b1a30", angle: 165 }, ink: "#f3ead7", accent: "#c9a14a", sample: "restaurant",
    titleFont: "Cormorant Garamond", titleSize: 62, titleWeight: 600, titleUpper: true, titleSpacing: 6, titleColor: "#c9a14a",
    tagline: "Fine dining", taglineFont: "Cormorant Garamond", taglineColor: "#d6c7a1",
    sectionFont: "Cormorant Garamond", sectionSize: 24, sectionSpacing: 5, sectionUpper: true, sectionColor: "#c9a14a", sectionWeight: 600,
    itemFont: "Cormorant Garamond", itemSize: 21, itemWeight: 600, priceColor: "#c9a14a",
    frame: { kind: "double", color: "#c9a14a" }, divider: { kind: "ornament", color: "#c9a14a", symbol: "◆" }, columns: 1,
  },
  street: {
    bg: { type: "solid", color: "#0a0a0a" }, ink: "#ffffff", accent: "#facc15", sample: "street",
    titleFont: "Bebas Neue", titleSize: 92, titleWeight: 400, titleSpacing: 3, titleColor: "#facc15", titleAlign: "left",
    tagline: "Burgers · Fries · Shakes", taglineFont: "Oswald", taglineColor: "#ffffff",
    sectionFont: "Oswald", sectionSize: 18, sectionSpacing: 3, sectionUpper: true, sectionAlign: "left", sectionWeight: 700,
    sectionPill: { fill: "#facc15", color: "#0a0a0a" },
    itemFont: "Oswald", itemSize: 19, itemWeight: 400, itemUpper: true, priceColor: "#facc15",
    columns: 1,
    footer: "Order at the counter", footerColor: "#facc15",
  },
  botanical: {
    bg: { type: "solid", color: "#eef2ea" }, ink: "#2f3e2c", accent: "#6b8f5e", sample: "fresh",
    titleFont: "Great Vibes", titleSize: 76, titleWeight: 400, titleColor: "#3f5a36", icon: "🌿",
    tagline: "garden kitchen", taglineFont: "Raleway", taglineColor: "#6b8f5e",
    sectionFont: "Raleway", sectionSize: 17, sectionSpacing: 4, sectionUpper: true, sectionColor: "#3f5a36", sectionWeight: 700,
    itemFont: "Raleway", itemSize: 15, itemWeight: 600, priceColor: "#6b8f5e",
    frame: { kind: "single", color: "#9bb58e" }, divider: { kind: "ornament", color: "#6b8f5e", symbol: "✻" },
    columns: 2, columnLine: "#c5d3bd",
  },
};

/** Lays out one style on a page; k scales fonts and spacing (smaller k = more fits) */
function build(st: Style, size: PageSize, restaurantName: string, k: number): { elements: DesignElement[]; bottom: number; limit: number } {
  const { w: W, h: H } = PAGE_SIZES[size];
  const s = (W / 794) * k;
  const r = (n: number) => Math.round(n);
  const m = r(W * 0.09);
  const iw = W - m * 2;
  const els: DesignElement[] = [];
  const text = (preset: string, x: number, y: number, extra: Partial<DesignElement>) => {
    const e = placed(defaultElement("text", size, preset), x, y, extra);
    els.push(e);
    return e;
  };

  // Frame
  if (st.frame) {
    const out = r(W * 0.035);
    els.push(placed(defaultElement("rect", size), out, out, { w: W - out * 2, h: H - out * 2, fill: { type: "none" }, borderColor: st.frame.color, borderWidth: st.frame.kind === "double" ? 3 : 2, radius: 0 }));
    if (st.frame.kind === "double") {
      const inn = r(W * 0.05);
      els.push(placed(defaultElement("rect", size), inn, inn, { w: W - inn * 2, h: H - inn * 2, fill: { type: "none" }, borderColor: st.frame.color, borderWidth: 1, radius: 0 }));
    }
  }

  let y = r(H * 0.055);
  // Header band
  if (st.band) {
    els.push(placed(defaultElement("rect", size), 0, 0, { w: W, h: r(H * st.band.height), fill: { type: "solid", color: st.band.color }, borderWidth: 0, radius: 0 }));
    y = r(H * st.band.height * 0.18);
  }
  if (st.icon) {
    text("icon", r(W / 2 - 35 * s), y, { w: r(70 * s), h: r(64 * s), text: st.icon, fontSize: r(46 * s) });
    y += r(62 * s);
  }
  const titleAlign = st.titleAlign ?? "center";
  const titleH = r(st.titleSize * s * 1.25);
  text("heading", m, y, {
    w: iw, h: titleH, text: restaurantName || "Our Menu", fontFamily: st.titleFont, fontSize: r(st.titleSize * s),
    fontWeight: st.titleWeight ?? 700, uppercase: !!st.titleUpper, letterSpacing: st.titleSpacing ?? 0,
    color: st.band ? st.band.titleColor : st.titleColor ?? st.ink, align: titleAlign, lineHeight: 1.1,
  });
  y += titleH + r(4 * s);
  if (st.tagline) {
    const th = r(26 * s);
    text("text", m, y, {
      w: iw, h: th, text: st.tagline, fontFamily: st.taglineFont ?? st.itemFont, fontSize: r(16 * s), fontWeight: 400,
      color: st.band?.taglineColor ?? st.taglineColor ?? st.accent, align: titleAlign, letterSpacing: 1, lineHeight: 1.3,
    });
    y += th;
  }
  if (st.band) y = Math.max(y, r(H * st.band.height));
  y += r(18 * s);
  if (st.divider) {
    const dw = titleAlign === "left" ? r(iw * 0.25) : r(iw * 0.45);
    const dx = titleAlign === "left" ? m : r((W - dw) / 2);
    if (st.divider.kind === "line") {
      els.push(placed(defaultElement("line", size), dx, y, { w: dw, h: 2, fill: { type: "solid", color: st.divider.color } }));
      y += r(26 * s);
    } else {
      els.push(placed(defaultElement("divider", size, st.divider.kind === "dots" ? "dots" : undefined), dx, y, {
        w: dw, h: r(24 * s), color: st.divider.color, symbol: st.divider.kind === "dots" ? "•" : st.divider.symbol ?? "✦",
      }));
      y += r(40 * s);
    }
  } else {
    y += r(10 * s);
  }

  // Sections, in one or two columns
  const sections = SAMPLE[st.sample];
  const gap = r(W * 0.06);
  const cw = st.columns === 2 ? r((iw - gap) / 2) : iw;
  const cols = st.columns === 2 ? [m, m + cw + gap] : [m];
  const colY = cols.map(() => y);
  const itemH = r((st.columns === 2 ? 58 : 52) * s);
  const rowH = itemH + r(14 * s);
  const pad = st.cards ? r(18 * s) : 0;
  const headH = r((st.sectionPill ? 36 : st.sectionSize * 1.5) * s);
  const footerH = st.footer ? r(40 * s) : 0;
  const limit = H - (st.frame ? r(W * 0.07) : m * 0.6) - footerH;

  sections.forEach(([title, dishes], i) => {
    const c = st.columns === 2 ? (colY[0] <= colY[1] ? 0 : 1) : 0;
    const x = cols[c];
    let cy = colY[c];
    const blockH = pad * 2 + headH + r(12 * s) + dishes.length * rowH;
    if (st.cards) {
      els.push(placed(defaultElement("rect", size), x - r(4 * s), cy, {
        w: cw + r(8 * s), h: blockH, fill: { type: "solid", color: st.cards.fill }, borderColor: st.cards.border ?? st.cards.fill,
        borderWidth: st.cards.border ? 1 : 0, radius: r(st.cards.radius * s), shadow: !!st.cards.shadow,
      }));
    }
    cy += pad;
    const align = st.sectionAlign ?? (st.columns === 2 ? "left" : "center");
    if (st.sectionPill) {
      const pw = Math.min(cw - pad * 2, r((title.length * st.sectionSize * 0.72 + 40) * s));
      text("label", align === "center" ? r(x + (cw - pw) / 2) : x + pad, cy, {
        w: pw, h: headH, text: title.toUpperCase(), fontFamily: st.sectionFont, fontSize: r(st.sectionSize * s), fontWeight: st.sectionWeight ?? 700,
        letterSpacing: st.sectionSpacing ?? 1, uppercase: true, color: st.sectionPill.color, textFill: { type: "solid", color: st.sectionPill.fill },
        radius: 999, padding: r(6 * s), align: "center", lineHeight: 1.2,
      });
    } else {
      text("subheading", x + pad, cy, {
        w: cw - pad * 2, h: headH, text: st.sectionUpper ? title.toUpperCase() : title, fontFamily: st.sectionFont, fontSize: r(st.sectionSize * s),
        fontWeight: st.sectionWeight ?? 600, letterSpacing: st.sectionSpacing ?? 0, color: st.sectionColor ?? st.accent, align, lineHeight: 1.2,
      });
    }
    cy += headH + r(12 * s);
    for (const [name, price, description] of dishes) {
      els.push(placed(defaultElement("item", size), x + pad, cy, {
        w: cw - pad * 2, h: itemH, name, price, description, fontFamily: st.itemFont, fontSize: r(st.itemSize * s),
        fontWeight: st.itemWeight ?? 600, uppercase: !!st.itemUpper, color: st.ink, accentColor: st.priceColor ?? st.accent, lineHeight: 1.25,
      }));
      cy += rowH;
    }
    cy += pad + r((st.cards ? 22 : 16) * s);
    colY[c] = cy;
    void i;
  });

  // Line between the columns
  if (st.columns === 2 && st.columnLine) {
    const top = y;
    const h = Math.max(...colY) - top - r(16 * s);
    els.push(placed(defaultElement("line", size, "vertical"), r(m + cw + gap / 2), top, { w: 2, h: Math.max(20, h), vertical: true, lineStyle: "solid", fill: { type: "solid", color: st.columnLine } }));
  }
  const bottom = Math.max(...colY);
  if (st.footer) {
    text("note", m, Math.min(H - (st.frame ? r(W * 0.07) : m * 0.6) - r(30 * s), Math.max(bottom, H - r(110 * s))), {
      w: iw, h: r(28 * s), text: st.footer, fontFamily: st.itemFont, fontSize: r(13 * s), color: st.footerColor ?? st.ink, align: "center", italic: true,
    });
  }
  return { elements: els, bottom, limit };
}

function styledDesign(st: Style, size: PageSize, restaurantName: string): MenuDesign {
  // Fill the page: shrink when it doesn't fit (square, A5), grow a little when there is a lot of space left
  let k = 1;
  let out = build(st, size, restaurantName, k);
  for (let i = 0; i < 8; i++) {
    const fill = out.bottom / out.limit;
    if (fill > 1) k *= Math.max(0.6, Math.min(0.97, 1 / fill));
    else if (fill < 0.88 && k < 1.3) k = Math.min(1.3, k * Math.min(1.12, 0.95 / fill));
    else break;
    const next = build(st, size, restaurantName, k);
    if (next.bottom > next.limit && fill <= 1) break; // growing went too far: keep the last one that fit
    out = next;
  }
  const page: DesignPage = { id: newId("p"), background: structuredClone(st.bg), elements: out.elements };
  return { version: 1, size, display: "book", pages: [page] };
}

export function templateDesign(id: TemplateId, size: PageSize, restaurantName: string): MenuDesign {
  if (id === "blank") return blankDesign(size);
  if (id === "classic" || id === "dark") return classicOrDark(id, size, restaurantName);
  return styledDesign(STYLES[id], size, restaurantName);
}

function classicOrDark(id: "classic" | "dark", size: PageSize, restaurantName: string): MenuDesign {
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
