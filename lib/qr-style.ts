// Styled QR codes (QR Code page): dots / rounded modules, eye shapes, colors, a frame with a text.
// Browser only (draws on a canvas). Error correction "H" keeps them easy to scan with any style.

export type ModuleShape = "square" | "rounded" | "dots" | "soft";
export type EyeShape = "square" | "rounded" | "circle";
export type FrameKind = "none" | "label" | "card";

export interface QrStyle {
  modules: ModuleShape;
  eyes: EyeShape;
  color: string;
  /** Second color: a gradient from color to color2 (null = one color) */
  color2: string | null;
  /** Color of the eyes (null = same as the modules) */
  eyeColor: string | null;
  background: string;
  frame: FrameKind;
  /** Frame text (empty = the default for each code) */
  frameText: string;
}

export const DEFAULT_STYLE: QrStyle = { modules: "square", eyes: "square", color: "#111827", color2: null, eyeColor: null, background: "#ffffff", frame: "none", frameText: "" };

/** Suggested styles: a click sets all of it, then colors can be changed */
export const PRESETS: { id: string; name: string; style: QrStyle }[] = [
  { id: "classic", name: "Classic", style: DEFAULT_STYLE },
  { id: "dots", name: "Modern dots", style: { ...DEFAULT_STYLE, modules: "dots", eyes: "circle", color: "#1e3a8a" } },
  { id: "soft", name: "Soft", style: { ...DEFAULT_STYLE, modules: "soft", eyes: "rounded", color: "#0f766e" } },
  { id: "rounded", name: "Rounded", style: { ...DEFAULT_STYLE, modules: "rounded", eyes: "rounded", color: "#7c2d12", eyeColor: "#c2410c" } },
  { id: "sunset", name: "Sunset", style: { ...DEFAULT_STYLE, modules: "dots", eyes: "rounded", color: "#be123c", color2: "#c2410c" } },
  { id: "night", name: "Night", style: { ...DEFAULT_STYLE, modules: "soft", eyes: "circle", color: "#fbbf24", background: "#111827" } },
  { id: "framed", name: "With a frame", style: { ...DEFAULT_STYLE, modules: "rounded", eyes: "rounded", color: "#111827", frame: "card" } },
  { id: "label", name: "With a text", style: { ...DEFAULT_STYLE, modules: "dots", eyes: "rounded", color: "#4338ca", frame: "label" } },
];

const hex = (v: unknown, d: string) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : d);
export function sanitizeStyle(v: unknown): QrStyle {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const one = <T extends string>(x: unknown, list: T[], d: T): T => (list.includes(x as T) ? (x as T) : d);
  return {
    modules: one(o.modules, ["square", "rounded", "dots", "soft"], "square"),
    eyes: one(o.eyes, ["square", "rounded", "circle"], "square"),
    color: hex(o.color, DEFAULT_STYLE.color),
    color2: o.color2 ? hex(o.color2, "") || null : null,
    eyeColor: o.eyeColor ? hex(o.eyeColor, "") || null : null,
    background: hex(o.background, "#ffffff"),
    frame: one(o.frame, ["none", "label", "card"], "none"),
    frameText: typeof o.frameText === "string" ? o.frameText.replace(/\s+/g, " ").trim().slice(0, 40) : "",
  };
}

// ── Contrast: a QR code needs a dark code on a light background (or very different colors) ──

function luminance(c: string): number {
  const n = parseInt(c.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
/** null = fine, else a warning to show */
export function scanWarning(s: QrStyle): string | null {
  const worst = Math.min(contrast(s.color, s.background), s.color2 ? contrast(s.color2, s.background) : 99, s.eyeColor ? contrast(s.eyeColor, s.background) : 99);
  if (worst < 3) return "These colors are too close: phones may not read this QR code. Use a darker code or a lighter background.";
  if (luminance(s.background) < luminance(s.color)) return "A light code on a dark background: most phones read it, but some older cameras don't.";
  return null;
}

// ── Drawing ──────────────────────────────────────────────────────────────────

/** A PNG (data URL) of the QR code for `url` in this style. `label` is the frame text when the style has none. */
/** center: a short text (like a room number) in a badge in the middle of the code. Error correction "H" keeps it scannable. */
export async function renderQr(url: string, style: QrStyle, label: string, size = 1024, opts: { center?: string | null } = {}): Promise<string> {
  const QRCode = (await import("qrcode")).default;
  const qr = QRCode.create(url, { errorCorrectionLevel: "H" });
  const n = qr.modules.size;
  const dark = (r: number, c: number) => r >= 0 && c >= 0 && r < n && c < n && !!qr.modules.data[r * n + c];
  const quiet = 3;
  const cell = size / (n + quiet * 2);

  const text = style.frame === "none" ? "" : style.frameText || label;
  const pad = style.frame === "card" ? size * 0.06 : 0;
  const textH = text ? size * 0.16 : 0;
  const W = size + pad * 2, H = size + pad * 2 + textH;

  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Frame / background
  if (style.frame === "card") {
    ctx.fillStyle = style.color;
    ctx.beginPath(); ctx.roundRect(0, 0, W, H, size * 0.07); ctx.fill();
    ctx.fillStyle = style.background;
    ctx.beginPath(); ctx.roundRect(pad, pad, size, size, size * 0.045); ctx.fill();
  } else {
    ctx.fillStyle = style.background;
    ctx.fillRect(0, 0, W, H);
  }

  const ox = pad + quiet * cell, oy = pad + quiet * cell;
  const paint = (c: string, c2: string | null): string | CanvasGradient => {
    if (!c2) return c;
    const g = ctx.createLinearGradient(ox, oy, ox + n * cell, oy + n * cell);
    g.addColorStop(0, c); g.addColorStop(1, c2);
    return g;
  };

  // The three eyes (7 x 7 corners) are drawn on their own
  const inEye = (r: number, c: number) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  ctx.fillStyle = paint(style.color, style.color2);
  ctx.beginPath();
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!dark(r, c) || inEye(r, c)) continue;
      const x = ox + c * cell, y = oy + r * cell;
      if (style.modules === "square") ctx.rect(x, y, cell + 0.5, cell + 0.5);
      else if (style.modules === "dots") { ctx.moveTo(x + cell * 0.92, y + cell / 2); ctx.arc(x + cell / 2, y + cell / 2, cell * 0.42, 0, Math.PI * 2); }
      else if (style.modules === "rounded") ctx.roundRect(x + cell * 0.06, y + cell * 0.06, cell * 0.88, cell * 0.88, cell * 0.3);
      else {
        // soft: round only the corners with no neighbor on both sides, so touching modules flow together
        const up = dark(r - 1, c), down = dark(r + 1, c), left = dark(r, c - 1), right = dark(r, c + 1);
        const k = cell * 0.5;
        ctx.roundRect(x, y, cell + 0.5, cell + 0.5, [!up && !left ? k : 0, !up && !right ? k : 0, !down && !right ? k : 0, !down && !left ? k : 0]);
      }
    }
  }
  ctx.fill();

  ctx.fillStyle = style.eyeColor ?? paint(style.color, style.color2);
  for (const [er, ec] of [[0, 0], [0, n - 7], [n - 7, 0]]) {
    const x = ox + ec * cell, y = oy + er * cell, s7 = cell * 7, s5 = cell * 5, s3 = cell * 3;
    ctx.beginPath();
    if (style.eyes === "circle") {
      ctx.arc(x + s7 / 2, y + s7 / 2, s7 / 2, 0, Math.PI * 2);
      ctx.moveTo(x + s7 / 2 + s5 / 2, y + s7 / 2);
      ctx.arc(x + s7 / 2, y + s7 / 2, s5 / 2, 0, Math.PI * 2, true);
      ctx.moveTo(x + s7 / 2 + s3 / 2, y + s7 / 2);
      ctx.arc(x + s7 / 2, y + s7 / 2, s3 / 2, 0, Math.PI * 2);
    } else {
      const ro = style.eyes === "rounded" ? cell * 2 : 0, ri = style.eyes === "rounded" ? cell * 1.3 : 0, rc = style.eyes === "rounded" ? cell * 0.9 : 0;
      ctx.roundRect(x, y, s7, s7, ro);
      ctx.roundRect(x + cell, y + cell, s5, s5, ri);
      ctx.roundRect(x + cell * 2, y + cell * 2, s3, s3, rc);
    }
    ctx.fill("evenodd");
  }

  // A badge in the middle (room number). Small enough to stay well inside what error correction "H" can repair.
  const center = (opts.center ?? "").trim().slice(0, 8);
  if (center) {
    const codeW = n * cell, cx = ox + codeW / 2, cy = oy + codeW / 2;
    const fontFor = (px: number) => `800 ${Math.round(px)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    const maxW = codeW * 0.3, maxH = codeW * 0.17;
    let fs = maxH * 0.62;
    ctx.font = fontFor(fs);
    while (ctx.measureText(center).width > maxW - cell * 1.6 && fs > cell * 1.2) { fs *= 0.92; ctx.font = fontFor(fs); }
    const bw = Math.min(maxW, Math.max(maxH, ctx.measureText(center).width + cell * 1.8)), bh = maxH;
    ctx.fillStyle = style.background;
    ctx.beginPath(); ctx.roundRect(cx - bw / 2 - cell * 0.5, cy - bh / 2 - cell * 0.5, bw + cell, bh + cell, cell * 1.4); ctx.fill();
    ctx.lineWidth = Math.max(2, cell * 0.45);
    ctx.strokeStyle = style.eyeColor ?? style.color;
    ctx.beginPath(); ctx.roundRect(cx - bw / 2, cy - bh / 2, bw, bh, cell * 1.1); ctx.stroke();
    ctx.fillStyle = style.eyeColor ?? style.color;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(center, cx, cy + fs * 0.04);
  }

  // The text under the code
  if (text) {
    ctx.fillStyle = style.frame === "card" ? style.background : style.color;
    ctx.font = `700 ${Math.round(size * 0.075)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(text, W / 2, size + pad * 2 + textH / 2 - (style.frame === "card" ? pad * 0.5 : size * 0.02), W - pad * 2);
  }
  return canvas.toDataURL("image/png");
}
