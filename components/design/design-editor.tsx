"use client";

// Canva-style menu designer (Digital menu tab).
// Left: elements to drag (or click) onto a page. Middle: the pages. Right: settings of what is selected.
// Shortcuts: Ctrl/Cmd + C X V D Z Y A G, Shift+Ctrl+G, Delete, arrows (Shift = 10px), Esc.
// Changes are a draft: the Menu page saves them with "Save changes".

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Type, Heading1, Heading2, ImagePlus, Square, Circle, Minus, UtensilsCrossed, RectangleHorizontal,
  Undo2, Redo2, Copy, ClipboardPaste, CopyPlus, Trash2, Group, Ungroup, ArrowUpToLine, ArrowDownToLine,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical, AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
  ZoomIn, ZoomOut, Plus, ChevronUp, ChevronDown, Bold, Italic, Underline, CaseUpper, AlignLeft, AlignCenter, AlignRight,
  Loader2, BookOpen, ScrollText, LayoutTemplate, FilePlus2,
} from "lucide-react";
import toast from "react-hot-toast";
import { DesignPageView, ElementContent, elementBoxStyle, useDesignFonts } from "@/components/design/design-render";
import { compressImage, stageUpload } from "@/components/dashboard/menu-book-editor";
import {
  FONTS, PAGE_SIZES, DESIGN_LIMITS, clonePage, cloneElements, defaultElement, newId, templateDesign, fontStack,
  type DesignElement, type DesignPage, type ElementType, type Fill, type MenuDesign, type PageBackground, type PageSize, type TemplateId,
} from "@/lib/menu-design-types";

const IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const DRAG_MIME = "application/x-skano-element";
const CLIP_KEY = "skano.designClipboard";
const SNAP = 6; // design units

type Clip = { kind: "elements"; els: DesignElement[]; fromPage: string } | { kind: "page"; page: DesignPage };

interface DesignEditorProps {
  restaurantId: string;
  restaurantName: string;
  value: MenuDesign | null;
  onChange: (d: MenuDesign) => void;
  /** Every uploaded photo, so the page can delete it again on Discard */
  onStaged: (url: string) => void;
}

const TILES: { type: ElementType; preset?: string; label: string; icon: React.ElementType }[] = [
  { type: "text", preset: "heading", label: "Heading", icon: Heading1 },
  { type: "text", preset: "subheading", label: "Subheading", icon: Heading2 },
  { type: "text", label: "Text", icon: Type },
  { type: "item", label: "Menu item", icon: UtensilsCrossed },
  { type: "image", label: "Photo", icon: ImagePlus },
  { type: "rect", preset: "box", label: "Box", icon: RectangleHorizontal },
  { type: "rect", label: "Rectangle", icon: Square },
  { type: "ellipse", label: "Circle", icon: Circle },
  { type: "line", label: "Line", icon: Minus },
];

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  if (!el) return false;
  // Sliders, color pickers and buttons don't take text, so shortcuts keep working there
  if (el.tagName === "INPUT") return ["text", "number", "search", "email", "url", "tel", "password", ""].includes((el as HTMLInputElement).type);
  return el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable;
};

function bbox(els: DesignElement[]) {
  const l = Math.min(...els.map((e) => e.x));
  const t = Math.min(...els.map((e) => e.y));
  const r = Math.max(...els.map((e) => e.x + e.w));
  const b = Math.max(...els.map((e) => e.y + e.h));
  return { l, t, r, b, w: r - l, h: b - t };
}

// ── small form controls ─────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold text-gray-500 mb-1">{label}</span>
      {children}
    </label>
  );
}

const inputCls = "w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500";

function ColorInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const hex = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000";
  return (
    <Field label={label}>
      <div className="flex items-center gap-1.5">
        <input type="color" value={hex} onChange={(e) => onChange(e.target.value)} className="w-8 h-8 rounded-md border border-gray-200 p-0.5 bg-white cursor-pointer shrink-0" aria-label={label} />
        <input value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} spellCheck={false} />
      </div>
    </Field>
  );
}

function NumberInput({ value, onChange, label, min, max, step = 1 }: { value: number; onChange: (v: number) => void; label: string; min?: number; max?: number; step?: number }) {
  return (
    <Field label={label}>
      <input type="number" value={Number.isFinite(value) ? value : 0} min={min} max={max} step={step}
        onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) onChange(n); }} className={inputCls} />
    </Field>
  );
}

function Toggle({ on, onClick, title, children }: { on?: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button type="button" title={title} aria-label={title} aria-pressed={!!on} onClick={onClick}
      className={`p-1.5 rounded-md border ${on ? "bg-blue-50 border-blue-300 text-blue-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
      {children}
    </button>
  );
}

function ToolBtn({ title, onClick, disabled, children }: { title: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick} disabled={disabled}
      className="p-1.5 rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-30 disabled:hover:bg-transparent">
      {children}
    </button>
  );
}

function FillEditor({ fill, onChange, allowNone = true }: { fill: Fill; onChange: (f: Fill) => void; allowNone?: boolean }) {
  return (
    <div className="space-y-2">
      <div className="inline-flex p-0.5 bg-gray-100 rounded-lg">
        {([...(allowNone ? [["none", "None"]] : []), ["solid", "Color"], ["linear", "Gradient"]] as [Fill["type"], string][]).map(([t, label]) => (
          <button key={t} type="button" onClick={() => {
            if (t === fill.type) return;
            if (t === "none") onChange({ type: "none" });
            else if (t === "solid") onChange({ type: "solid", color: fill.type === "linear" ? fill.from : "#e5e7eb" });
            else onChange({ type: "linear", from: fill.type === "solid" ? fill.color : "#fde68a", to: "#f59e0b", angle: 135 });
          }}
            className={`text-[11px] font-semibold px-2 py-1 rounded-md ${fill.type === t ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}>
            {label}
          </button>
        ))}
      </div>
      {fill.type === "solid" && <ColorInput label="Color" value={fill.color} onChange={(color) => onChange({ type: "solid", color })} />}
      {fill.type === "linear" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <ColorInput label="From" value={fill.from} onChange={(from) => onChange({ ...fill, from })} />
            <ColorInput label="To" value={fill.to} onChange={(to) => onChange({ ...fill, to })} />
          </div>
          <Field label={`Angle ${fill.angle}°`}>
            <input type="range" min={0} max={360} value={fill.angle} onChange={(e) => onChange({ ...fill, angle: Number(e.target.value) })} className="w-full" />
          </Field>
        </>
      )}
    </div>
  );
}

// ── the editor ──────────────────────────────────────────────────────────────

export function DesignEditor({ restaurantId, restaurantName, value, onChange, onStaged }: DesignEditorProps) {
  useDesignFonts([...FONTS]);

  const [startSize, setStartSize] = useState<PageSize>("a4");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [editingText, setEditingText] = useState<string | null>(null);
  const [zoomMode, setZoomMode] = useState<"fit" | number>("fit");
  const [fitZoom, setFitZoom] = useState(0.6);
  const [guides, setGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] });
  const [marquee, setMarquee] = useState<{ pageId: string; x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [, setHistoryTick] = useState(0);

  const canvasRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const past = useRef<MenuDesign[]>([]);
  const future = useRef<MenuDesign[]>([]);
  const clip = useRef<Clip | null>(null);
  const pendingImage = useRef<{ pageId: string; x?: number; y?: number; replaceId?: string; background?: boolean } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const itemNameRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<null | {
    kind: "move" | "resize" | "rotate" | "marquee";
    pageId: string; sx: number; sy: number; start: MenuDesign; moved: boolean;
    handle?: string; ids?: string[]; additive?: string[];
  }>(null);

  const design = value;
  const size = design ? PAGE_SIZES[design.size] : PAGE_SIZES.a4;
  const zoom = zoomMode === "fit" ? fitZoom : zoomMode;
  const hasDesign = design !== null;
  const activePage = design?.pages.find((p) => p.id === activeId) ?? design?.pages[0] ?? null;
  const selectedEls = useMemo(() => activePage?.elements.filter((e) => selected.includes(e.id)) ?? [], [activePage, selected]);
  const single = selectedEls.length === 1 ? selectedEls[0] : null;

  // Fit the page width into the canvas
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const update = () => setFitZoom(Math.min(1, Math.max(0.2, (el.clientWidth - 64) / size.w)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [size.w, hasDesign]);

  // ── history ──
  const commit = useCallback((next: MenuDesign, base: MenuDesign | null = design) => {
    if (base) {
      past.current.push(base);
      if (past.current.length > 100) past.current.shift();
    }
    future.current = [];
    setHistoryTick((t) => t + 1);
    onChange(next);
  }, [design, onChange]);

  function undo() {
    const prev = past.current.pop();
    if (!prev || !design) return;
    future.current.push(design);
    setHistoryTick((t) => t + 1);
    onChange(prev);
    setEditingText(null);
  }
  function redo() {
    const next = future.current.pop();
    if (!next || !design) return;
    past.current.push(design);
    setHistoryTick((t) => t + 1);
    onChange(next);
  }

  /** Change the active page (copy of the design) */
  function editPage(fn: (page: DesignPage, d: MenuDesign) => void, pageId = activePage?.id) {
    if (!design || !pageId) return;
    const d = structuredClone(design);
    const page = d.pages.find((p) => p.id === pageId);
    if (!page) return;
    fn(page, d);
    commit(d);
  }
  function editSelected(patch: Partial<DesignElement> | ((e: DesignElement) => void)) {
    editPage((page) => {
      for (const e of page.elements) {
        if (!selected.includes(e.id)) continue;
        if (typeof patch === "function") patch(e);
        else Object.assign(e, patch);
      }
    });
  }

  /** Clicking one element of a group selects the whole group */
  function withGroups(ids: string[], page: DesignPage) {
    const groups = new Set(page.elements.filter((e) => ids.includes(e.id) && e.groupId).map((e) => e.groupId));
    return page.elements.filter((e) => ids.includes(e.id) || (e.groupId && groups.has(e.groupId))).map((e) => e.id);
  }

  // ── adding elements ──
  function addElement(type: ElementType, preset: string | undefined, pageId: string, at?: { x: number; y: number }) {
    if (!design) return;
    const page = design.pages.find((p) => p.id === pageId);
    if (!page) return;
    if (page.elements.length >= DESIGN_LIMITS.elements) { toast.error(`At most ${DESIGN_LIMITS.elements} elements per page.`); return; }
    if (type === "image") {
      pendingImage.current = { pageId, ...at };
      fileInput.current?.click();
      return;
    }
    const base = defaultElement(type, design.size, preset);
    const offset = (page.elements.length % 8) * 14;
    const x = at ? at.x - base.w / 2 : (size.w - base.w) / 2 + offset;
    const y = at ? at.y - base.h / 2 : Math.min(size.h - base.h, size.h * 0.3 + offset);
    const el = { ...base, x: Math.round(x), y: Math.round(y) } as DesignElement;
    editPage((p) => { p.elements.push(el); }, pageId);
    setActiveId(pageId);
    setSelected([el.id]);
  }

  async function uploadImage(file: File): Promise<{ url: string; ratio: number } | null> {
    if (!IMAGE_TYPES.includes(file.type)) { toast.error("Please choose a JPG, PNG or WEBP photo."); return null; }
    setUploading(true);
    try {
      const small = await compressImage(file);
      const ratio = await new Promise<number>((res) => {
        const img = new Image();
        img.onload = () => res(img.naturalWidth ? img.naturalHeight / img.naturalWidth : 0.75);
        img.onerror = () => res(0.75);
        img.src = URL.createObjectURL(small);
      });
      const { url } = await stageUpload(restaurantId, small, () => {});
      onStaged(url);
      return { url, ratio };
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
      return null;
    } finally {
      setUploading(false);
    }
  }

  async function onFilePicked(file: File | undefined) {
    const target = pendingImage.current;
    pendingImage.current = null;
    if (!file || !target || !design) return;
    const up = await uploadImage(file);
    if (!up) return;
    if (target.background) {
      editPage((p) => { p.background = { type: "image", url: up.url, fit: "cover", x: 50, y: 50, dim: 0, color: "#000000" }; }, target.pageId);
      return;
    }
    if (target.replaceId) {
      editPage((p) => { const e = p.elements.find((x) => x.id === target.replaceId); if (e) e.src = up.url; }, target.pageId);
      return;
    }
    const w = Math.round(size.w * 0.5);
    const h = Math.round(w * up.ratio);
    const x = target.x !== undefined ? target.x - w / 2 : (size.w - w) / 2;
    const y = target.y !== undefined ? target.y - h / 2 : (size.h - h) / 2;
    const el = { ...defaultElement("image", design.size), x: Math.round(x), y: Math.round(y), w, h, src: up.url } as DesignElement;
    editPage((p) => { p.elements.push(el); }, target.pageId);
    setActiveId(target.pageId);
    setSelected([el.id]);
  }

  // ── clipboard ──
  function writeClip(c: Clip) {
    clip.current = c;
    try { localStorage.setItem(CLIP_KEY, JSON.stringify(c)); } catch { /* ignore */ }
  }
  function readClip(): Clip | null {
    if (clip.current) return clip.current;
    try { const raw = localStorage.getItem(CLIP_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
  }
  function copy() {
    if (!activePage) return;
    if (selectedEls.length) {
      writeClip({ kind: "elements", els: structuredClone(selectedEls), fromPage: activePage.id });
      toast.success(selectedEls.length === 1 ? "Copied" : `Copied ${selectedEls.length} elements`);
    } else {
      writeClip({ kind: "page", page: structuredClone(activePage) });
      toast.success("Page copied");
    }
  }
  function cut() {
    if (!selectedEls.length) return;
    copy();
    removeSelected();
  }
  function paste() {
    const c = readClip();
    if (!c || !design || !activePage) return;
    if (c.kind === "page") {
      insertPage(clonePage(c.page), activePage.id);
      return;
    }
    const sameSpot = c.fromPage === activePage.id && c.els.every((e) => activePage.elements.some((x) => x.x === e.x && x.y === e.y));
    const pasted = cloneElements(c.els, sameSpot ? 16 : 0, sameSpot ? 16 : 0);
    editPage((p) => { p.elements.push(...pasted); });
    // next paste goes a bit further
    writeClip({ kind: "elements", els: pasted.map((e) => structuredClone(e)), fromPage: activePage.id });
    setSelected(pasted.map((e) => e.id));
  }
  function duplicate() {
    if (!activePage) return;
    if (!selectedEls.length) { insertPage(clonePage(activePage), activePage.id); return; }
    const copies = cloneElements(selectedEls, 16, 16);
    editPage((p) => { p.elements.push(...copies); });
    setSelected(copies.map((e) => e.id));
  }
  function removeSelected() {
    if (!selected.length) return;
    editPage((p) => { p.elements = p.elements.filter((e) => !selected.includes(e.id)); });
    setSelected([]);
  }

  // ── groups / layers / align ──
  function group() {
    if (selectedEls.length < 2) return;
    const gid = newId("g");
    editSelected({ groupId: gid });
    toast.success("Grouped");
  }
  function ungroup() {
    if (!selectedEls.some((e) => e.groupId)) return;
    editSelected({ groupId: null });
  }
  function layer(dir: "front" | "back") {
    editPage((p) => {
      const sel = p.elements.filter((e) => selected.includes(e.id));
      const rest = p.elements.filter((e) => !selected.includes(e.id));
      p.elements = dir === "front" ? [...rest, ...sel] : [...sel, ...rest];
    });
  }
  function align(how: "l" | "c" | "r" | "t" | "m" | "b") {
    if (!selectedEls.length) return;
    // One element (or one group) aligns to the page, several to their common box
    const oneUnit = selectedEls.length === 1 || new Set(selectedEls.map((e) => e.groupId ?? e.id)).size === 1;
    const box = oneUnit ? { l: 0, t: 0, r: size.w, b: size.h, w: size.w, h: size.h } : bbox(selectedEls);
    const unitBox = oneUnit ? bbox(selectedEls) : null;
    editSelected((e) => {
      const src = unitBox ?? { l: e.x, t: e.y, w: e.w, h: e.h };
      let dx = 0;
      let dy = 0;
      if (how === "l") dx = box.l - src.l;
      if (how === "c") dx = box.l + box.w / 2 - (src.l + src.w / 2);
      if (how === "r") dx = box.r - (src.l + src.w);
      if (how === "t") dy = box.t - src.t;
      if (how === "m") dy = box.t + box.h / 2 - (src.t + src.h / 2);
      if (how === "b") dy = box.b - (src.t + src.h);
      e.x = Math.round(e.x + dx);
      e.y = Math.round(e.y + dy);
    });
  }

  // ── pages ──
  function insertPage(page: DesignPage, afterId?: string) {
    if (!design) return;
    if (design.pages.length >= DESIGN_LIMITS.pages) { toast.error(`At most ${DESIGN_LIMITS.pages} pages.`); return; }
    const d = structuredClone(design);
    const i = afterId ? d.pages.findIndex((p) => p.id === afterId) : d.pages.length - 1;
    d.pages.splice(i + 1, 0, page);
    delete d.pageImages;
    commit(d);
    setActiveId(page.id);
    setSelected([]);
    requestAnimationFrame(() => pageRefs.current[page.id]?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
  function addPage(afterId?: string) {
    const bg = activePage?.background ?? { type: "solid", color: "#ffffff" };
    insertPage({ id: newId("p"), background: structuredClone(bg) as PageBackground, elements: [] }, afterId);
  }
  function deletePage(id: string) {
    if (!design || design.pages.length <= 1) { toast.error("A design needs at least one page."); return; }
    if (!window.confirm("Delete this page?")) return;
    const d = structuredClone(design);
    d.pages = d.pages.filter((p) => p.id !== id);
    delete d.pageImages;
    commit(d);
    setSelected([]);
    if (activeId === id) setActiveId(d.pages[0].id);
  }
  function movePage(id: string, dir: -1 | 1) {
    if (!design) return;
    const d = structuredClone(design);
    const i = d.pages.findIndex((p) => p.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= d.pages.length) return;
    [d.pages[i], d.pages[j]] = [d.pages[j], d.pages[i]];
    commit(d);
  }

  // ── keyboard ──
  useEffect(() => {
    if (!design) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      // Arrow keys move a focused slider, not the selection
      if ((e.target as HTMLInputElement | null)?.type === "range" && e.key.startsWith("Arrow")) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (mod && (k === "y" || (k === "z" && e.shiftKey))) { e.preventDefault(); redo(); return; }
      if (mod && k === "c") { e.preventDefault(); copy(); return; }
      if (mod && k === "x") { e.preventDefault(); cut(); return; }
      if (mod && k === "v") { e.preventDefault(); paste(); return; }
      if (mod && k === "d") { e.preventDefault(); duplicate(); return; }
      if (mod && k === "a") { e.preventDefault(); if (activePage) setSelected(activePage.elements.map((x) => x.id)); return; }
      if (mod && k === "g") { e.preventDefault(); if (e.shiftKey) ungroup(); else group(); return; }
      if (e.key === "Escape") { setSelected([]); setEditingText(null); return; }
      if ((e.key === "Delete" || e.key === "Backspace") && selected.length) { e.preventDefault(); removeSelected(); return; }
      if (e.key.startsWith("Arrow") && selected.length) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        editSelected((el) => { el.x += dx; el.y += dy; });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ── pointer: move / resize / rotate / marquee ──
  function pagePoint(pageId: string, clientX: number, clientY: number) {
    const el = pageRefs.current[pageId];
    const r = el?.getBoundingClientRect();
    return r ? { x: (clientX - r.left) / zoom, y: (clientY - r.top) / zoom } : { x: 0, y: 0 };
  }

  function startDrag(kind: "move" | "resize" | "rotate" | "marquee", e: React.PointerEvent, pageId: string, extra: { handle?: string; ids?: string[]; additive?: string[] } = {}) {
    if (!design) return;
    dragRef.current = { kind, pageId, sx: e.clientX, sy: e.clientY, start: design, moved: false, ...extra };
    window.addEventListener("pointermove", onDragMove);
    window.addEventListener("pointerup", onDragEnd, { once: true });
  }

  const onDragMove = (ev: PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = (ev.clientX - d.sx) / zoom;
    const dy = (ev.clientY - d.sy) / zoom;
    if (!d.moved && Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
    d.moved = true;
    const next = structuredClone(d.start);
    const page = next.pages.find((p) => p.id === d.pageId);
    const startPage = d.start.pages.find((p) => p.id === d.pageId);
    if (!page || !startPage) return;
    const { w: W, h: H } = PAGE_SIZES[next.size];

    if (d.kind === "marquee") {
      const p0 = pagePoint(d.pageId, d.sx, d.sy);
      const p1 = pagePoint(d.pageId, ev.clientX, ev.clientY);
      setMarquee({ pageId: d.pageId, x0: p0.x, y0: p0.y, x1: p1.x, y1: p1.y });
      const l = Math.min(p0.x, p1.x), r = Math.max(p0.x, p1.x), t = Math.min(p0.y, p1.y), b = Math.max(p0.y, p1.y);
      const hit = startPage.elements.filter((el) => el.x < r && el.x + el.w > l && el.y < b && el.y + el.h > t).map((el) => el.id);
      setSelected([...new Set([...(d.additive ?? []), ...withGroups(hit, startPage)])]);
      return;
    }

    const ids = d.ids ?? [];
    const moving = startPage.elements.filter((el) => ids.includes(el.id));
    if (!moving.length) return;

    if (d.kind === "move") {
      // Snap the selection's edges / center to the page and to other elements
      const box = bbox(moving);
      const others = startPage.elements.filter((el) => !ids.includes(el.id));
      const xs = [0, W / 2, W, ...others.flatMap((o) => [o.x, o.x + o.w / 2, o.x + o.w])];
      const ys = [0, H / 2, H, ...others.flatMap((o) => [o.y, o.y + o.h / 2, o.y + o.h])];
      let sdx = dx, sdy = dy;
      const vg: number[] = [], hg: number[] = [];
      if (!ev.altKey) {
        let best = SNAP + 1;
        for (const target of xs) for (const edge of [box.l, box.l + box.w / 2, box.r]) {
          const diff = target - (edge + dx);
          if (Math.abs(diff) < best) { best = Math.abs(diff); sdx = dx + diff; vg.length = 0; vg.push(target); }
        }
        best = SNAP + 1;
        for (const target of ys) for (const edge of [box.t, box.t + box.h / 2, box.b]) {
          const diff = target - (edge + dy);
          if (Math.abs(diff) < best) { best = Math.abs(diff); sdy = dy + diff; hg.length = 0; hg.push(target); }
        }
      }
      setGuides({ v: vg, h: hg });
      for (const el of page.elements) {
        const s = moving.find((m) => m.id === el.id);
        if (s) { el.x = Math.round(s.x + sdx); el.y = Math.round(s.y + sdy); }
      }
    } else if (d.kind === "resize") {
      const s = moving[0];
      const el = page.elements.find((x) => x.id === s.id)!;
      const h = d.handle ?? "se";
      let { x, y, w, h: hh } = s;
      if (h.includes("e")) w = Math.max(8, s.w + dx);
      if (h.includes("s")) hh = Math.max(4, s.h + dy);
      if (h.includes("w")) { w = Math.max(8, s.w - dx); x = s.x + (s.w - w); }
      if (h.includes("n")) { hh = Math.max(4, s.h - dy); y = s.y + (s.h - hh); }
      const corner = h.length === 2;
      if (corner && (ev.shiftKey || s.type === "image" || s.type === "ellipse" && ev.shiftKey)) {
        const ratio = s.h / s.w;
        hh = w * ratio;
        if (h.includes("n")) y = s.y + (s.h - hh);
      }
      // Corner-dragging text scales the font with it (like Canva)
      if (corner && (s.type === "text" || s.type === "item") && !ev.altKey) {
        const f = w / s.w;
        el.fontSize = Math.max(4, Math.round((s.fontSize ?? 16) * f * 10) / 10);
        hh = s.h * f;
        if (h.includes("n")) y = s.y + (s.h - hh);
      }
      Object.assign(el, { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(hh) });
    } else if (d.kind === "rotate") {
      const s = moving[0];
      const el = page.elements.find((x) => x.id === s.id)!;
      const p = pagePoint(d.pageId, ev.clientX, ev.clientY);
      const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
      let deg = (Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI + 90;
      if (deg > 180) deg -= 360;
      const snapTo = ev.shiftKey ? 15 : 45;
      const nearest = Math.round(deg / snapTo) * snapTo;
      if (ev.shiftKey || Math.abs(deg - nearest) < 4) deg = nearest;
      el.rotation = Math.round(deg);
    }
    onChange(next);
  };

  const onDragEnd = () => {
    window.removeEventListener("pointermove", onDragMove);
    const d = dragRef.current;
    dragRef.current = null;
    setGuides({ v: [], h: [] });
    setMarquee(null);
    if (d && d.moved && d.kind !== "marquee") {
      past.current.push(d.start);
      if (past.current.length > 100) past.current.shift();
      future.current = [];
      setHistoryTick((t) => t + 1);
    }
  };

  function onElementPointerDown(e: React.PointerEvent, page: DesignPage, el: DesignElement) {
    if (editingText === el.id) { e.stopPropagation(); return; }
    if (e.button !== 0) return;
    e.stopPropagation();
    if (editingText) setEditingText(null);
    setActiveId(page.id);
    const ids = withGroups([el.id], page);
    let sel: string[];
    if (e.shiftKey) {
      sel = selected.includes(el.id) ? selected.filter((x) => !ids.includes(x)) : [...new Set([...selected, ...ids])];
      setSelected(sel);
      return;
    }
    sel = selected.includes(el.id) && activePage?.id === page.id ? selected : ids;
    setSelected(sel);
    startDrag("move", e, page.id, { ids: sel });
  }

  function onPagePointerDown(e: React.PointerEvent, page: DesignPage) {
    if (e.button !== 0) return;
    if (editingText) setEditingText(null);
    if (activeId !== page.id) setActiveId(page.id);
    const keep = e.shiftKey ? selected : [];
    setSelected(keep);
    startDrag("marquee", e, page.id, { additive: keep });
  }

  function onDrop(e: React.DragEvent, page: DesignPage) {
    e.preventDefault();
    const p = pagePoint(page.id, e.clientX, e.clientY);
    const raw = e.dataTransfer.getData(DRAG_MIME);
    if (raw) {
      try {
        const { type, preset } = JSON.parse(raw) as { type: ElementType; preset?: string };
        addElement(type, preset, page.id, p);
      } catch { /* ignore */ }
      return;
    }
    // Photos dropped from the computer
    const file = Array.from(e.dataTransfer.files).find((f) => IMAGE_TYPES.includes(f.type));
    if (file) {
      pendingImage.current = { pageId: page.id, x: p.x, y: p.y };
      onFilePicked(file);
    }
  }

  // ── start screen (no design yet) ──
  if (!design) {
    const pick = (t: TemplateId) => {
      const d = templateDesign(t, startSize, restaurantName);
      past.current = [];
      future.current = [];
      onChange(d);
      setActiveId(d.pages[0].id);
    };
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Design your menu</h2>
            <p className="text-sm text-gray-500">Drag text, menu items, photos and shapes onto pages, like in Canva. Start from a template or a blank page.</p>
          </div>
          <Field label="Page size">
            <select value={startSize} onChange={(e) => setStartSize(e.target.value as PageSize)} className={`${inputCls} w-44`}>
              {(Object.keys(PAGE_SIZES) as PageSize[]).map((s) => <option key={s} value={s}>{PAGE_SIZES[s].label}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          {([["blank", "Blank page", "Start from an empty page"], ["classic", "Classic", "Cream paper, serif headings"], ["dark", "Dark elegant", "Dark background, gold text"]] as [TemplateId, string, string][]).map(([id, title, sub]) => {
            const d = templateDesign(id, startSize, restaurantName);
            const pw = 180;
            const sc = pw / PAGE_SIZES[startSize].w;
            return (
              <button key={id} type="button" onClick={() => pick(id)}
                className="group text-left rounded-xl border border-gray-200 hover:border-blue-400 hover:shadow-md p-3 transition-all">
                <div className="mx-auto bg-gray-100 rounded-lg overflow-hidden flex justify-center py-3">
                  <div style={{ width: pw, height: PAGE_SIZES[startSize].h * sc, position: "relative", boxShadow: "0 2px 8px rgba(0,0,0,.15)" }}>
                    <div style={{ transform: `scale(${sc})`, transformOrigin: "top left", position: "absolute" }}>
                      <DesignPageView page={d.pages[0]} size={startSize} />
                    </div>
                  </div>
                </div>
                <div className="mt-2 font-semibold text-sm text-gray-900">{title}</div>
                <div className="text-xs text-gray-500">{sub}</div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── properties panel ──
  const textLike = selectedEls.filter((e) => e.type === "text" || e.type === "item");
  const shared = <K extends keyof DesignElement>(k: K) => (textLike[0]?.[k]);

  const typography = textLike.length > 0 && (
    <div className="space-y-2.5">
      <Field label="Font">
        <select value={(shared("fontFamily") as string) ?? "Inter"} onChange={(e) => editSelected((x) => { if (x.type === "text" || x.type === "item") x.fontFamily = e.target.value; })}
          className={inputCls} style={{ fontFamily: fontStack(shared("fontFamily") as string) }}>
          {FONTS.map((f) => <option key={f} value={f} style={{ fontFamily: fontStack(f) }}>{f}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <NumberInput label="Size" value={(shared("fontSize") as number) ?? 16} min={4} max={400}
          onChange={(v) => editSelected((x) => { if (x.type === "text" || x.type === "item") x.fontSize = v; })} />
        <Field label="Weight">
          <select value={(shared("fontWeight") as number) ?? 400} onChange={(e) => editSelected((x) => { if (x.type === "text" || x.type === "item") x.fontWeight = Number(e.target.value); })} className={inputCls}>
            <option value={400}>Regular</option><option value={600}>Semibold</option><option value={700}>Bold</option>
          </select>
        </Field>
      </div>
      <div className="flex items-center gap-1 flex-wrap">
        <Toggle title="Bold" on={(shared("fontWeight") as number) >= 700} onClick={() => editSelected((x) => { if (x.type === "text" || x.type === "item") x.fontWeight = (x.fontWeight ?? 400) >= 700 ? 400 : 700; })}><Bold className="w-3.5 h-3.5" /></Toggle>
        <Toggle title="Italic" on={!!shared("italic")} onClick={() => editSelected((x) => { x.italic = !x.italic; })}><Italic className="w-3.5 h-3.5" /></Toggle>
        <Toggle title="Underline" on={!!shared("underline")} onClick={() => editSelected((x) => { x.underline = !x.underline; })}><Underline className="w-3.5 h-3.5" /></Toggle>
        <Toggle title="Uppercase" on={!!shared("uppercase")} onClick={() => editSelected((x) => { x.uppercase = !x.uppercase; })}><CaseUpper className="w-3.5 h-3.5" /></Toggle>
        <span className="w-px h-5 bg-gray-200 mx-1" />
        {([["left", AlignLeft], ["center", AlignCenter], ["right", AlignRight]] as const).map(([a, Icon]) => (
          <Toggle key={a} title={`Align ${a}`} on={(shared("align") ?? "left") === a} onClick={() => editSelected({ align: a })}><Icon className="w-3.5 h-3.5" /></Toggle>
        ))}
      </div>
      <ColorInput label="Text color" value={(shared("color") as string) ?? "#111827"} onChange={(c) => editSelected((x) => { if (x.type === "text" || x.type === "item") x.color = c; })} />
      <div className="grid grid-cols-2 gap-2">
        <NumberInput label="Line height" value={(shared("lineHeight") as number) ?? 1.3} step={0.05} min={0.6} max={4} onChange={(v) => editSelected((x) => { x.lineHeight = v; })} />
        <NumberInput label="Letter spacing" value={(shared("letterSpacing") as number) ?? 0} step={0.5} min={-10} max={50} onChange={(v) => editSelected((x) => { x.letterSpacing = v; })} />
      </div>
    </div>
  );

  const bg = activePage?.background;
  const pagePanel = activePage && bg && (
    <div className="space-y-4">
      <div className="text-xs font-bold text-gray-900 uppercase tracking-wide">Page {design.pages.findIndex((p) => p.id === activePage.id) + 1} background</div>
      <div className="inline-flex p-0.5 bg-gray-100 rounded-lg">
        {([["solid", "Color"], ["linear", "Gradient"], ["image", "Photo"]] as [PageBackground["type"], string][]).map(([t, label]) => (
          <button key={t} type="button" onClick={() => {
            if (t === bg.type) return;
            if (t === "image") { pendingImage.current = { pageId: activePage.id, background: true }; fileInput.current?.click(); return; }
            editPage((p) => {
              p.background = t === "solid"
                ? { type: "solid", color: bg.type === "linear" ? bg.from : "#ffffff" }
                : { type: "linear", from: bg.type === "solid" ? bg.color : "#fdf6e3", to: "#e7d7b8", angle: 160 };
            });
          }} className={`text-[11px] font-semibold px-2.5 py-1 rounded-md ${bg.type === t ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}>
            {label}
          </button>
        ))}
      </div>
      {bg.type === "solid" && <ColorInput label="Color" value={bg.color} onChange={(color) => editPage((p) => { p.background = { type: "solid", color }; })} />}
      {bg.type === "linear" && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <ColorInput label="From" value={bg.from} onChange={(from) => editPage((p) => { p.background = { ...bg, from }; })} />
            <ColorInput label="To" value={bg.to} onChange={(to) => editPage((p) => { p.background = { ...bg, to }; })} />
          </div>
          <Field label={`Angle ${bg.angle}°`}>
            <input type="range" min={0} max={360} value={bg.angle} onChange={(e) => editPage((p) => { p.background = { ...bg, angle: Number(e.target.value) }; })} className="w-full" />
          </Field>
        </div>
      )}
      {bg.type === "image" && (
        <div className="space-y-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={bg.url} alt="" className="w-full h-24 object-cover rounded-lg border border-gray-200" />
          <button type="button" onClick={() => { pendingImage.current = { pageId: activePage.id, background: true }; fileInput.current?.click(); }}
            className="w-full text-xs font-semibold py-1.5 rounded-lg border border-gray-200 hover:border-blue-300">Change photo</button>
          <Field label={`Darken ${Math.round(bg.dim * 100)}%`}>
            <input type="range" min={0} max={0.9} step={0.05} value={bg.dim} onChange={(e) => editPage((p) => { p.background = { ...bg, dim: Number(e.target.value) }; })} className="w-full" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label={`Left / right ${bg.x}%`}><input type="range" min={0} max={100} value={bg.x} onChange={(e) => editPage((p) => { p.background = { ...bg, x: Number(e.target.value) }; })} className="w-full" /></Field>
            <Field label={`Up / down ${bg.y}%`}><input type="range" min={0} max={100} value={bg.y} onChange={(e) => editPage((p) => { p.background = { ...bg, y: Number(e.target.value) }; })} className="w-full" /></Field>
          </div>
        </div>
      )}
      <button type="button" onClick={() => {
        const d = structuredClone(design);
        d.pages.forEach((p) => { p.background = structuredClone(bg); });
        commit(d);
        toast.success("Background used on all pages");
      }} className="w-full text-xs font-semibold py-1.5 rounded-lg border border-gray-200 hover:border-blue-300">Use this background on all pages</button>

      <div className="pt-3 border-t border-gray-100 space-y-2">
        <div className="text-xs font-bold text-gray-900 uppercase tracking-wide">Whole menu</div>
        <Field label="Font for all text">
          <select value="" onChange={(e) => {
            const f = e.target.value;
            if (!f) return;
            const d = structuredClone(design);
            d.pages.forEach((p) => p.elements.forEach((x) => { if (x.type === "text" || x.type === "item") x.fontFamily = f; }));
            commit(d);
            toast.success(`All text now uses ${f}`);
          }} className={inputCls}>
            <option value="">Choose a font…</option>
            {FONTS.map((f) => <option key={f} value={f} style={{ fontFamily: fontStack(f) }}>{f}</option>)}
          </select>
        </Field>
        <p className="text-[11px] text-gray-400 leading-snug">Tip: click empty space and drag to select several elements. Shift-click adds to the selection. Ctrl+C / Ctrl+V copies, with nothing selected it copies the whole page.</p>
      </div>
    </div>
  );

  const elementPanel = selectedEls.length > 0 && (
    <div className="space-y-4">
      <div className="text-xs font-bold text-gray-900 uppercase tracking-wide">
        {single ? ({ text: "Text", item: "Menu item", image: "Photo", rect: "Shape", ellipse: "Circle", line: "Line" } as const)[single.type] : `${selectedEls.length} elements`}
      </div>

      {single?.type === "text" && (
        <Field label="Text">
          <textarea value={single.text ?? ""} rows={3} onChange={(e) => editSelected({ text: e.target.value })} className={`${inputCls} resize-y`} />
        </Field>
      )}
      {single?.type === "item" && (
        <div className="space-y-2">
          <Field label="Dish name"><input ref={itemNameRef} value={single.name ?? ""} onChange={(e) => editSelected({ name: e.target.value })} className={inputCls} /></Field>
          <Field label="Price"><input value={single.price ?? ""} onChange={(e) => editSelected({ price: e.target.value })} className={inputCls} placeholder="8.50 €" /></Field>
          <Field label="Description"><textarea value={single.description ?? ""} rows={2} onChange={(e) => editSelected({ description: e.target.value })} className={`${inputCls} resize-y`} /></Field>
          <ColorInput label="Price color" value={single.accentColor ?? single.color ?? "#111827"} onChange={(c) => editSelected({ accentColor: c })} />
        </div>
      )}
      {typography}

      {single?.type === "image" && (
        <div className="space-y-2.5">
          <button type="button" onClick={() => { pendingImage.current = { pageId: activePage!.id, replaceId: single.id }; fileInput.current?.click(); }}
            className="w-full text-xs font-semibold py-1.5 rounded-lg border border-gray-200 hover:border-blue-300">{single.src ? "Replace photo" : "Choose photo"}</button>
          <Field label="Fit">
            <select value={single.fit ?? "cover"} onChange={(e) => editSelected({ fit: e.target.value as "cover" | "contain" })} className={inputCls}>
              <option value="cover">Fill the box</option><option value="contain">Show the whole photo</option>
            </select>
          </Field>
          <NumberInput label="Rounded corners" value={single.radius ?? 0} min={0} onChange={(v) => editSelected({ radius: v })} />
        </div>
      )}
      {single && (single.type === "rect" || single.type === "ellipse") && (
        <div className="space-y-2.5">
          <Field label="Fill"><span /></Field>
          <FillEditor fill={single.fill ?? { type: "solid", color: "#e5e7eb" }} onChange={(fill) => editSelected({ fill })} />
          <div className="grid grid-cols-2 gap-2">
            <NumberInput label="Border" value={single.borderWidth ?? 0} min={0} max={100} onChange={(v) => editSelected({ borderWidth: v })} />
            {single.type === "rect" && <NumberInput label="Rounded corners" value={single.radius ?? 0} min={0} onChange={(v) => editSelected({ radius: v })} />}
          </div>
          {(single.borderWidth ?? 0) > 0 && <ColorInput label="Border color" value={single.borderColor ?? "#111827"} onChange={(c) => editSelected({ borderColor: c })} />}
        </div>
      )}
      {single?.type === "line" && (
        <div className="space-y-2.5">
          <FillEditor allowNone={false} fill={single.fill ?? { type: "solid", color: "#9ca3af" }} onChange={(fill) => editSelected({ fill })} />
          <NumberInput label="Thickness" value={single.h} min={1} max={200} onChange={(v) => editSelected({ h: v })} />
        </div>
      )}

      <div className="pt-3 border-t border-gray-100 space-y-2.5">
        <Field label={`Transparency ${Math.round((1 - (selectedEls[0].opacity ?? 1)) * 100)}%`}>
          <input type="range" min={0.05} max={1} step={0.05} value={selectedEls[0].opacity ?? 1} onChange={(e) => editSelected({ opacity: Number(e.target.value) })} className="w-full" style={{ direction: "rtl" }} />
        </Field>
        {single && (
          <div className="grid grid-cols-2 gap-2">
            <NumberInput label="X" value={single.x} onChange={(v) => editSelected({ x: v })} />
            <NumberInput label="Y" value={single.y} onChange={(v) => editSelected({ y: v })} />
            <NumberInput label="Width" value={single.w} min={1} onChange={(v) => editSelected({ w: Math.max(1, v) })} />
            <NumberInput label="Height" value={single.h} min={1} onChange={(v) => editSelected({ h: Math.max(1, v) })} />
            <NumberInput label="Rotation °" value={single.rotation ?? 0} min={-360} max={360} onChange={(v) => editSelected({ rotation: v })} />
          </div>
        )}
      </div>
    </div>
  );

  // ── render ──
  const handleSize = 10 / zoom;
  const toolbarBtn = "w-4 h-4";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
        onChange={(e) => { onFilePicked(e.target.files?.[0]); e.target.value = ""; }} />

      {/* Toolbar */}
      <div className="flex items-center gap-0.5 flex-wrap px-3 py-2 border-b border-gray-100 bg-gray-50/60">
        <ToolBtn title="Undo (Ctrl+Z)" onClick={undo} disabled={!past.current.length}><Undo2 className={toolbarBtn} /></ToolBtn>
        <ToolBtn title="Redo (Ctrl+Y)" onClick={redo} disabled={!future.current.length}><Redo2 className={toolbarBtn} /></ToolBtn>
        <span className="w-px h-5 bg-gray-200 mx-1" />
        <ToolBtn title="Copy (Ctrl+C) · with nothing selected copies the page" onClick={copy}><Copy className={toolbarBtn} /></ToolBtn>
        <ToolBtn title="Paste (Ctrl+V)" onClick={paste}><ClipboardPaste className={toolbarBtn} /></ToolBtn>
        <ToolBtn title="Duplicate (Ctrl+D)" onClick={duplicate}><CopyPlus className={toolbarBtn} /></ToolBtn>
        <ToolBtn title="Delete (Del)" onClick={removeSelected} disabled={!selected.length}><Trash2 className={toolbarBtn} /></ToolBtn>
        <span className="w-px h-5 bg-gray-200 mx-1" />
        <ToolBtn title="Group (Ctrl+G)" onClick={group} disabled={selectedEls.length < 2}><Group className={toolbarBtn} /></ToolBtn>
        <ToolBtn title="Ungroup (Ctrl+Shift+G)" onClick={ungroup} disabled={!selectedEls.some((e) => e.groupId)}><Ungroup className={toolbarBtn} /></ToolBtn>
        <ToolBtn title="Bring to front" onClick={() => layer("front")} disabled={!selected.length}><ArrowUpToLine className={toolbarBtn} /></ToolBtn>
        <ToolBtn title="Send to back" onClick={() => layer("back")} disabled={!selected.length}><ArrowDownToLine className={toolbarBtn} /></ToolBtn>
        <span className="w-px h-5 bg-gray-200 mx-1" />
        <ToolBtn title="Align left" onClick={() => align("l")} disabled={!selected.length}><AlignStartVertical className={toolbarBtn} /></ToolBtn>
        <ToolBtn title="Align center" onClick={() => align("c")} disabled={!selected.length}><AlignCenterVertical className={toolbarBtn} /></ToolBtn>
        <ToolBtn title="Align right" onClick={() => align("r")} disabled={!selected.length}><AlignEndVertical className={toolbarBtn} /></ToolBtn>
        <ToolBtn title="Align top" onClick={() => align("t")} disabled={!selected.length}><AlignStartHorizontal className={toolbarBtn} /></ToolBtn>
        <ToolBtn title="Align middle" onClick={() => align("m")} disabled={!selected.length}><AlignCenterHorizontal className={toolbarBtn} /></ToolBtn>
        <ToolBtn title="Align bottom" onClick={() => align("b")} disabled={!selected.length}><AlignEndHorizontal className={toolbarBtn} /></ToolBtn>

        <div className="ml-auto flex items-center gap-1.5 flex-wrap">
          {uploading && <span className="inline-flex items-center gap-1 text-xs text-gray-500"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading</span>}
          <select title="Page size" value={design.size} onChange={(e) => {
            const d = structuredClone(design);
            d.size = e.target.value as PageSize;
            delete d.pageImages;
            commit(d);
          }} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
            {(Object.keys(PAGE_SIZES) as PageSize[]).map((s) => <option key={s} value={s}>{PAGE_SIZES[s].label}</option>)}
          </select>
          <div className="inline-flex p-0.5 bg-gray-100 rounded-lg" role="radiogroup" aria-label="How customers see it">
            {([["book", "Book", BookOpen], ["scroll", "Scroll", ScrollText]] as const).map(([m, label, Icon]) => (
              <button key={m} type="button" role="radio" aria-checked={design.display === m}
                title={m === "book" ? "Customers flip through the pages like a book" : "Customers scroll down through the pages"}
                onClick={() => { if (design.display !== m) { const d = structuredClone(design); d.display = m; commit(d); } }}
                className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md ${design.display === m ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}>
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>
          <span className="w-px h-5 bg-gray-200 mx-0.5" />
          <ToolBtn title="Zoom out" onClick={() => setZoomMode(Math.max(0.2, Math.round((zoom - 0.1) * 10) / 10))}><ZoomOut className={toolbarBtn} /></ToolBtn>
          <button type="button" onClick={() => setZoomMode("fit")} title="Fit to width" className="text-xs font-semibold text-gray-600 w-12 text-center hover:text-gray-900">{Math.round(zoom * 100)}%</button>
          <ToolBtn title="Zoom in" onClick={() => setZoomMode(Math.min(2, Math.round((zoom + 0.1) * 10) / 10))}><ZoomIn className={toolbarBtn} /></ToolBtn>
          <ToolBtn title="Start over from a template" onClick={() => {
            if (!window.confirm("Start over from a template? Your current design is replaced (you can still Discard before saving).")) return;
            commit(templateDesign("classic", design.size, restaurantName));
          }}><LayoutTemplate className={toolbarBtn} /></ToolBtn>
        </div>
      </div>

      <div className="grid grid-cols-[150px_minmax(0,1fr)_240px] xl:grid-cols-[170px_minmax(0,1fr)_260px]" style={{ height: "calc(100vh - 230px)", minHeight: 560 }}>
        {/* Elements */}
        <aside className="border-r border-gray-100 overflow-y-auto p-3 space-y-2">
          <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Elements</div>
          <p className="text-[11px] text-gray-400 leading-snug">Drag onto a page, or click to add.</p>
          <div className="grid grid-cols-1 gap-1.5">
            {TILES.map((t) => (
              <button key={t.label} type="button" draggable
                onDragStart={(e) => { e.dataTransfer.setData(DRAG_MIME, JSON.stringify({ type: t.type, preset: t.preset })); e.dataTransfer.effectAllowed = "copy"; }}
                onClick={() => activePage && addElement(t.type, t.preset, activePage.id)}
                className="flex items-center gap-2 text-xs font-semibold text-gray-700 px-2.5 py-2 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/40 cursor-grab active:cursor-grabbing">
                <t.icon className="w-4 h-4 text-gray-500 shrink-0" /> {t.label}
              </button>
            ))}
          </div>
          <div className="pt-2 border-t border-gray-100 space-y-1.5">
            <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Pages</div>
            <button type="button" onClick={() => addPage(activePage?.id)}
              className="w-full flex items-center gap-2 text-xs font-semibold text-gray-700 px-2.5 py-2 rounded-lg border border-gray-200 hover:border-blue-300"><FilePlus2 className="w-4 h-4 text-gray-500" /> Add page</button>
          </div>
        </aside>

        {/* Canvas */}
        <div ref={canvasRef} className="overflow-auto bg-gray-200/70 py-6 px-8" onPointerDown={(e) => { if (e.target === e.currentTarget) { setSelected([]); setEditingText(null); } }}>
          <div className="flex flex-col items-center gap-6 min-w-fit">
            {design.pages.map((page, pi) => {
              const isActive = activePage?.id === page.id;
              return (
                <div key={page.id} className="flex flex-col gap-1.5" ref={(el) => { pageRefs.current[page.id] = el ? (el.querySelector("[data-page]") as HTMLDivElement) : null; }}>
                  <div className="flex items-center justify-between text-xs text-gray-500" style={{ width: size.w * zoom }}>
                    <span className={`font-semibold ${isActive ? "text-blue-700" : ""}`}>Page {pi + 1} of {design.pages.length}</span>
                    <span className="flex items-center gap-0.5">
                      <ToolBtn title="Move page up" onClick={() => movePage(page.id, -1)} disabled={pi === 0}><ChevronUp className="w-3.5 h-3.5" /></ToolBtn>
                      <ToolBtn title="Move page down" onClick={() => movePage(page.id, 1)} disabled={pi === design.pages.length - 1}><ChevronDown className="w-3.5 h-3.5" /></ToolBtn>
                      <ToolBtn title="Copy page" onClick={() => { writeClip({ kind: "page", page: structuredClone(page) }); toast.success("Page copied. Ctrl+V pastes it after the selected page."); }}><Copy className="w-3.5 h-3.5" /></ToolBtn>
                      <ToolBtn title="Duplicate page" onClick={() => insertPage(clonePage(page), page.id)}><CopyPlus className="w-3.5 h-3.5" /></ToolBtn>
                      <ToolBtn title="Add page after" onClick={() => { setActiveId(page.id); addPage(page.id); }}><Plus className="w-3.5 h-3.5" /></ToolBtn>
                      <ToolBtn title="Delete page" onClick={() => deletePage(page.id)} disabled={design.pages.length <= 1}><Trash2 className="w-3.5 h-3.5" /></ToolBtn>
                    </span>
                  </div>
                  <div
                    style={{ width: size.w * zoom, height: size.h * zoom }}
                    className={`relative bg-white shadow-md ${isActive ? "ring-2 ring-blue-400" : ""}`}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
                    onDrop={(e) => onDrop(e, page)}
                  >
                    <div data-page style={{ position: "absolute", left: 0, top: 0, transform: `scale(${zoom})`, transformOrigin: "top left" }}
                      onPointerDown={(e) => onPagePointerDown(e, page)}>
                      <DesignPageView page={page} size={design.size} renderElement={(el) => {
                        const editing = editingText === el.id;
                        // Frames (shapes without fill) only react on their edge, so you can still click and select what is inside
                        const hollow = (el.type === "rect" || el.type === "ellipse") && el.fill?.type === "none" && !selected.includes(el.id);
                        const edge = Math.max(10 / zoom, el.borderWidth ?? 0);
                        return (
                          <div key={el.id} data-el={el.id}
                            style={{ ...elementBoxStyle(el), cursor: editing ? "text" : "move", touchAction: "none", ...(hollow ? { pointerEvents: "none" } : {}) }}
                            onPointerDown={(e) => onElementPointerDown(e, page, el)}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              if (el.type === "text") { setSelected([el.id]); setEditingText(el.id); }
                              if (el.type === "item") { setSelected([el.id]); requestAnimationFrame(() => itemNameRef.current?.focus()); }
                              if (el.type === "image") { pendingImage.current = { pageId: page.id, replaceId: el.id }; fileInput.current?.click(); }
                            }}>
                            {editing ? (
                              <EditableText el={el} onDone={(text) => {
                                setEditingText(null);
                                if (text !== el.text) editPage((p) => { const x = p.elements.find((y) => y.id === el.id); if (x) x.text = text; }, page.id);
                              }} />
                            ) : (
                              <ElementContent el={el} />
                            )}
                            {hollow && ([
                              { left: 0, top: 0, right: 0, height: edge },
                              { left: 0, bottom: 0, right: 0, height: edge },
                              { left: 0, top: 0, bottom: 0, width: edge },
                              { right: 0, top: 0, bottom: 0, width: edge },
                            ] as React.CSSProperties[]).map((s, i) => (
                              <div key={i} style={{ position: "absolute", ...s, pointerEvents: "auto" }} />
                            ))}
                          </div>
                        );
                      }} />

                      {/* Selection, handles, guides */}
                      {isActive && selectedEls.map((el) => (
                        <div key={`sel-${el.id}`} style={{ ...elementBoxStyle(el), opacity: 1, pointerEvents: "none", outline: `${1.5 / zoom}px solid #3b82f6`, outlineOffset: 1 / zoom }} />
                      ))}
                      {isActive && single && !editingText && (
                        <div style={{ ...elementBoxStyle(single), opacity: 1, pointerEvents: "none" }}>
                          {["nw", "n", "ne", "e", "se", "s", "sw", "w"].map((h) => {
                            const pos: React.CSSProperties = {
                              left: h.includes("w") ? 0 : h.includes("e") ? "100%" : "50%",
                              top: h.includes("n") ? 0 : h.includes("s") ? "100%" : "50%",
                            };
                            const cursor = { n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize", ne: "nesw-resize", sw: "nesw-resize", nw: "nwse-resize", se: "nwse-resize" }[h];
                            if (single.type === "line" && (h.includes("n") || h.includes("s"))) return null;
                            return (
                              <div key={h} data-handle={h}
                                onPointerDown={(e) => { e.stopPropagation(); startDrag("resize", e, page.id, { handle: h, ids: [single.id] }); }}
                                style={{ position: "absolute", ...pos, width: handleSize, height: handleSize, marginLeft: -handleSize / 2, marginTop: -handleSize / 2, background: "#fff", border: `${1.5 / zoom}px solid #3b82f6`, borderRadius: h.length === 2 ? "50%" : 2 / zoom, cursor, pointerEvents: "auto", touchAction: "none" }} />
                            );
                          })}
                          <div data-handle="rotate" title="Rotate"
                            onPointerDown={(e) => { e.stopPropagation(); startDrag("rotate", e, page.id, { ids: [single.id] }); }}
                            style={{ position: "absolute", left: "50%", top: -26 / zoom, width: handleSize * 1.4, height: handleSize * 1.4, marginLeft: -(handleSize * 1.4) / 2, background: "#fff", border: `${1.5 / zoom}px solid #3b82f6`, borderRadius: "50%", cursor: "grab", pointerEvents: "auto", touchAction: "none" }} />
                        </div>
                      )}
                      {isActive && selectedEls.length > 1 && (() => {
                        const b = bbox(selectedEls);
                        return <div style={{ position: "absolute", left: b.l, top: b.t, width: b.w, height: b.h, border: `${1 / zoom}px dashed #3b82f6`, pointerEvents: "none" }} />;
                      })()}
                      {isActive && guides.v.map((x, i) => <div key={`v${i}`} style={{ position: "absolute", left: x, top: 0, width: 1 / zoom, height: size.h, background: "#ec4899", pointerEvents: "none" }} />)}
                      {isActive && guides.h.map((y, i) => <div key={`h${i}`} style={{ position: "absolute", top: y, left: 0, height: 1 / zoom, width: size.w, background: "#ec4899", pointerEvents: "none" }} />)}
                      {marquee?.pageId === page.id && (
                        <div style={{ position: "absolute", left: Math.min(marquee.x0, marquee.x1), top: Math.min(marquee.y0, marquee.y1), width: Math.abs(marquee.x1 - marquee.x0), height: Math.abs(marquee.y1 - marquee.y0), background: "rgba(59,130,246,.08)", border: `${1 / zoom}px solid #3b82f6`, pointerEvents: "none" }} />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <button type="button" onClick={() => addPage(design.pages[design.pages.length - 1].id)}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-blue-700 px-4 py-2 rounded-xl border-2 border-dashed border-gray-300 hover:border-blue-300 bg-white/60">
              <Plus className="w-4 h-4" /> Add page
            </button>
          </div>
        </div>

        {/* Settings */}
        <aside className="border-l border-gray-100 overflow-y-auto p-3">
          {selectedEls.length ? elementPanel : pagePanel}
        </aside>
      </div>
    </div>
  );
}

/** Inline text editing (double-click a text) */
function EditableText({ el, onDone }: { el: DesignElement; onDone: (text: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.innerText = el.text ?? "";
    node.focus();
    const range = document.createRange();
    range.selectNodeContents(node);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onPointerDown={(e) => e.stopPropagation()}
      onBlur={(e) => onDone(e.currentTarget.innerText.replace(/\n$/, ""))}
      onKeyDown={(e) => { if (e.key === "Escape") (e.currentTarget as HTMLDivElement).blur(); }}
      style={{
        width: "100%", minHeight: "100%", outline: "none", whiteSpace: "pre-wrap", overflowWrap: "break-word",
        fontFamily: fontStack(el.fontFamily), fontSize: el.fontSize, fontWeight: el.fontWeight, fontStyle: el.italic ? "italic" : "normal",
        textDecoration: el.underline ? "underline" : "none", textTransform: el.uppercase ? "uppercase" : "none",
        color: el.color, textAlign: el.align, lineHeight: el.lineHeight, letterSpacing: el.letterSpacing,
        caretColor: "#3b82f6", background: "rgba(59,130,246,.06)",
      }}
    />
  );
}
