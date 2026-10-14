"use client";

// Dashboard editor for the "Menu tree": build the start screen and deeper screens, their buttons,
// the text under the logo and the background photos (dragged into place for phones and computers).
// Changes are a draft: the Menu page saves them with "Save changes".

import { useEffect, useRef, useState } from "react";
import {
  Plus, Trash2, ChevronRight, ArrowUp, ArrowDown, ImagePlus, Loader2, Smartphone, Monitor,
  FolderOpen, BookOpen, AlertCircle, Move, Home, Bold, Italic, CaseUpper, Paintbrush, RotateCcw, ChevronDown,
} from "lucide-react";
import toast from "react-hot-toast";
import { TreeScreen } from "@/components/menu-tree-view";
import { compressImage, stageUpload } from "@/components/dashboard/menu-book-editor";
import type { MenuGroup } from "@/components/dashboard/menu-history";
import {
  BUTTON_PRESETS, BUTTON_STYLE_KEYS, TREE_LIMITS, buttonLook, newNodeId, treeProblems, treeStyle, uniqueSlug, walkNodes,
  type MenuTree, type TreeBackground, type TreeNode, type TreeStyle,
} from "@/lib/menu-tree-types";
import { FONTS, fontStack } from "@/lib/menu-design-types";
import { useDesignFonts } from "@/components/design/design-render";

const smallInput = "w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500";

function StyleField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="block text-[11px] font-semibold text-gray-500 mb-1">{label}</span>
      {children}
    </label>
  );
}

/** Color picker that also allows "none" (transparent) */
function StyleColor({ label, value, onChange, allowNone }: { label: string; value: string; onChange: (v: string) => void; allowNone?: boolean }) {
  const hex = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#ffffff";
  const none = value === "transparent";
  return (
    <StyleField label={label}>
      <div className="flex items-center gap-1.5">
        <input type="color" value={hex} onChange={(e) => onChange(e.target.value)} disabled={none} aria-label={label}
          className="w-8 h-8 shrink-0 rounded-md border border-gray-200 p-0.5 bg-white cursor-pointer disabled:opacity-40" />
        <input value={value} onChange={(e) => onChange(e.target.value)} spellCheck={false} className={smallInput} />
        {allowNone && (
          <button type="button" onClick={() => onChange(none ? "#ffffff" : "transparent")} aria-pressed={none}
            className={`shrink-0 text-[11px] font-semibold px-2 py-1.5 rounded-lg border ${none ? "bg-blue-600 border-blue-600 text-white" : "border-gray-200 text-gray-600"}`}>None</button>
        )}
      </div>
    </StyleField>
  );
}

function StyleToggle({ on, onClick, title, children }: { on: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button type="button" title={title} aria-label={title} aria-pressed={on} onClick={onClick}
      className={`p-1.5 rounded-md border ${on ? "bg-blue-600 border-blue-600 text-white" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
      {children}
    </button>
  );
}

function FontSelect({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <StyleField label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={smallInput} style={{ fontFamily: value ? fontStack(value) : "Georgia, serif" }}>
        <option value="">Classic serif (default)</option>
        {FONTS.map((f) => <option key={f} value={f} style={{ fontFamily: fontStack(f) }}>{f}</option>)}
      </select>
    </StyleField>
  );
}

const IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

interface MenuTreeEditorProps {
  restaurantId: string;
  restaurantName: string;
  restaurantSlug: string | null;
  value: MenuTree;
  onChange: (tree: MenuTree) => void;
  /** Saved menus from the history (null while loading) */
  menus: MenuGroup[] | null;
  /** Opens the "New menu" pop-up; `assign` is called with the new menu's id */
  onCreateMenu: (assign: (menuId: string) => void) => void;
  /** Every uploaded photo, so the page can delete it again on Discard */
  onStaged: (url: string) => void;
}

/** Arrow row that opens a style section (like "2 versions" in the menu history) */
function StyleExpander({ open, onToggle, label, hint, children }: { open: boolean; onToggle: () => void; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/60">
      <button type="button" onClick={onToggle} aria-expanded={open}
        className="w-full flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 hover:text-gray-900">
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "" : "-rotate-90"}`} />
        <Paintbrush className="w-3.5 h-3.5 text-gray-400" /> {label}
        {hint && <span className="font-normal text-gray-400 truncate">· {hint}</span>}
      </button>
      {open && <div className="px-3 pb-3 pt-1 space-y-2.5 border-t border-gray-100">{children}</div>}
    </div>
  );
}

function ButtonStyleControls({ look, onChange }: { look: TreeStyle; onChange: (patch: Partial<TreeStyle>) => void }) {
  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {BUTTON_PRESETS.map((p) => {
          const active = Object.entries(p.style).every(([k, v]) => look[k as keyof TreeStyle] === v);
          return (
            <button key={p.name} type="button" onClick={() => onChange(p.style)} aria-pressed={active}
              className={`rounded-lg p-1 border bg-white ${active ? "border-blue-500 ring-2 ring-blue-200" : "border-gray-200 hover:border-gray-300"}`}>
              <span className="block bg-neutral-800 rounded-md px-2.5 py-1.5">
                <span className="block text-[11px] px-2.5 py-0.5 whitespace-nowrap" style={{
                  background: p.style.buttonFill, color: p.style.buttonText,
                  border: p.style.buttonBorder === "transparent" ? "1px solid transparent" : `1px solid ${p.style.buttonBorder}`,
                  borderRadius: look.buttonShape === "pill" ? 999 : look.buttonShape === "rounded" ? 6 : 0,
                }}>{p.name}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="grid sm:grid-cols-2 gap-2.5">
        <FontSelect label="Font" value={look.buttonFont} onChange={(buttonFont) => onChange({ buttonFont })} />
        <StyleField label={`Text size ${look.buttonSize}px`}>
          <input type="range" min={10} max={28} value={look.buttonSize} onChange={(e) => onChange({ buttonSize: Number(e.target.value) })} className="w-full" />
        </StyleField>
        <StyleColor label="Text color" value={look.buttonText} onChange={(buttonText) => onChange({ buttonText })} />
        <StyleColor label="Button color" value={look.buttonFill} onChange={(buttonFill) => onChange({ buttonFill })} allowNone />
        <StyleColor label="Border color" value={look.buttonBorder} onChange={(buttonBorder) => onChange({ buttonBorder })} allowNone />
        <StyleField label={`Width ${look.buttonWidth}px`}>
          <input type="range" min={140} max={420} step={10} value={look.buttonWidth} onChange={(e) => onChange({ buttonWidth: Number(e.target.value) })} className="w-full" />
        </StyleField>
        <StyleField label="Corners">
          <div className="inline-flex p-0.5 bg-gray-100 rounded-lg">
            {([["square", "Square"], ["rounded", "Rounded"], ["pill", "Round"]] as const).map(([k, label]) => (
              <button key={k} type="button" aria-pressed={look.buttonShape === k} onClick={() => onChange({ buttonShape: k })}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-md ${look.buttonShape === k ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}>{label}</button>
            ))}
          </div>
        </StyleField>
        <StyleField label="Style">
          <div className="flex items-center gap-1">
            <StyleToggle title="Bold" on={look.buttonBold} onClick={() => onChange({ buttonBold: !look.buttonBold })}><Bold className="w-3.5 h-3.5" /></StyleToggle>
            <StyleToggle title="Capital letters" on={look.buttonUppercase} onClick={() => onChange({ buttonUppercase: !look.buttonUppercase })}><CaseUpper className="w-3.5 h-3.5" /></StyleToggle>
          </div>
        </StyleField>
      </div>
    </>
  );
}

/** Nodes from the top down to the screen `ids` points at */
function chainOf(tree: MenuTree, ids: string[]): TreeNode[] {
  const chain: TreeNode[] = [];
  let level = tree.children;
  for (const id of ids) {
    const n = level.find((x) => x.id === id);
    if (!n || n.kind !== "submenu") break;
    chain.push(n);
    level = n.children ?? [];
  }
  return chain;
}

export function MenuTreeEditor({ restaurantId, restaurantName, restaurantSlug, value, onChange, menus, onCreateMenu, onStaged }: MenuTreeEditorProps) {
  const [path, setPath] = useState<string[]>([]); // ids of the submenus we're inside
  const [display, setDisplay] = useState<"phone" | "desktop">("phone");
  const [uploading, setUploading] = useState<"logo" | "background" | null>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const bgInput = useRef<HTMLInputElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; start: TreeBackground; ownerIds: string[] | null } | null>(null);

  // The preview is drawn at a real screen size and shrunk to fit, so it looks like the real page
  const virtual = display === "phone" ? { w: 390, h: 823 } : { w: 1280, h: 800 };
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / virtual.w || 0.5);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [virtual.w]);

  const chain = chainOf(value, path);
  const validPath = chain.map((n) => n.id);
  const here = chain.length ? chain[chain.length - 1] : null;
  const kids = here ? here.children ?? [] : value.children;
  const menuIds = menus?.map((m) => m.menuId);
  const problems = treeProblems(value, menuIds);
  const menuTitle = (id?: string | null) => menus?.find((m) => m.menuId === id)?.title;
  const look = treeStyle(value);
  useDesignFonts([...FONTS]);
  function setLook(patch: Partial<TreeStyle>) {
    mutate((d) => { d.style = { ...treeStyle(d), ...patch }; }, []);
  }
  const sameStyle = value.sameButtonStyle !== false;
  const [textStyleOpen, setTextStyleOpen] = useState(false);
  const [styleOpenFor, setStyleOpenFor] = useState<string | null>(null);
  /** Style of one button: with "same style for all buttons" it changes every button */
  function setButtonStyle(id: string, patch: Partial<TreeStyle>) {
    if (sameStyle) { setLook(patch); return; }
    mutate((_d, _h, k) => {
      const n = k.find((x) => x.id === id);
      if (!n) return;
      const own: Record<string, unknown> = { ...(n.buttonStyle ?? {}) };
      for (const key of BUTTON_STYLE_KEYS) if (key in patch) own[key] = patch[key];
      n.buttonStyle = own as TreeNode["buttonStyle"];
    });
  }
  function resetButtonStyle(id: string) {
    mutate((_d, _h, k) => { const n = k.find((x) => x.id === id); if (n) delete n.buttonStyle; });
  }
  function setSameStyle(on: boolean) {
    let hasOwn = false;
    walkNodes(value.children, (n) => { if (n.buttonStyle) hasOwn = true; });
    if (on && hasOwn && !window.confirm("Give every button the same style? Buttons with their own style get the shared style.")) return;
    mutate((d) => {
      if (on) { delete d.sameButtonStyle; walkNodes(d.children, (n) => { delete n.buttonStyle; }); }
      else d.sameButtonStyle = false;
    }, []);
  }

  // ── editing helpers (always work on a copy) ──
  function mutate(fn: (draft: MenuTree, here: TreeNode | null, kids: TreeNode[]) => void, ids: string[] = validPath) {
    const draft = structuredClone(value);
    const c = chainOf(draft, ids);
    const h = c.length ? c[c.length - 1] : null;
    const k = h ? (h.children ??= []) : draft.children;
    fn(draft, h, k);
    onChange(draft);
  }

  const otherSlugs = (list: TreeNode[], except: string) => list.filter((n) => n.id !== except).map((n) => n.slug);

  function addButton() {
    if (kids.length >= TREE_LIMITS.perLevel) { toast.error(`At most ${TREE_LIMITS.perLevel} buttons per screen.`); return; }
    mutate((_d, _h, k) => {
      const label = `Button ${k.length + 1}`;
      k.push({ id: newNodeId(), label, slug: uniqueSlug(label, k.map((n) => n.slug)), kind: "menu", menuId: null });
    });
  }

  function setLabel(id: string, label: string) {
    mutate((_d, _h, k) => {
      const n = k.find((x) => x.id === id);
      if (!n) return;
      n.label = label.slice(0, TREE_LIMITS.label);
      n.slug = uniqueSlug(label || "button", otherSlugs(k, id));
    });
  }

  function setKind(id: string, kind: TreeNode["kind"]) {
    const n = kids.find((x) => x.id === id);
    if (!n || n.kind === kind) return;
    if (kind === "menu" && n.children?.length && !window.confirm(`"${n.label}" has ${n.children.length} button(s) inside. Remove them and make it open a menu instead?`)) return;
    if (kind === "submenu" && path.length + 1 >= TREE_LIMITS.depth) { toast.error(`At most ${TREE_LIMITS.depth} levels.`); return; }
    mutate((_d, _h, k) => {
      const x = k.find((y) => y.id === id)!;
      if (kind === "submenu") {
        x.kind = "submenu";
        delete x.menuId;
        x.children = x.children ?? [];
        x.subtitle = x.subtitle ?? "";
        x.background = x.background ?? null;
      } else {
        x.kind = "menu";
        delete x.children;
        delete x.subtitle;
        delete x.background;
        x.menuId = null;
      }
    });
  }

  function setMenu(id: string, menuId: string) {
    if (menuId === "__new") {
      const ids = validPath;
      onCreateMenu((newId) => mutate((_d, _h, k) => { const x = k.find((y) => y.id === id); if (x) x.menuId = newId; }, ids));
      return;
    }
    mutate((_d, _h, k) => { const x = k.find((y) => y.id === id); if (x) x.menuId = menuId || null; });
  }

  function move(id: string, dir: -1 | 1) {
    mutate((_d, _h, k) => {
      const i = k.findIndex((x) => x.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= k.length) return;
      [k[i], k[j]] = [k[j], k[i]];
    });
  }

  function remove(id: string) {
    const n = kids.find((x) => x.id === id);
    if (!n) return;
    const inside = n.kind === "submenu" && n.children?.length ? ` and the ${n.children.length} button(s) inside it` : "";
    if (!window.confirm(`Remove "${n.label}"${inside}?`)) return;
    mutate((_d, _h, k) => { const i = k.findIndex((x) => x.id === id); if (i >= 0) k.splice(i, 1); });
  }

  function setSubtitle(text: string) {
    mutate((d, h) => {
      const t = text.slice(0, TREE_LIMITS.subtitle);
      if (h) h.subtitle = t;
      else d.subtitle = t;
    });
  }

  // ── photos ──
  async function upload(kind: "logo" | "background", file: File | undefined) {
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) { toast.error("Please choose a JPG, PNG or WEBP photo."); return; }
    setUploading(kind);
    try {
      const small = kind === "logo" ? file : await compressImage(file);
      const { url } = await stageUpload(restaurantId, small, () => {});
      onStaged(url);
      mutate((d, h) => {
        if (kind === "logo") d.logo = url;
        else {
          const bg: TreeBackground = { url, x: 50, y: 50, mx: 50, my: 50 };
          if (h) h.background = bg;
          else d.background = bg;
        }
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  }

  // Which screen's photo is shown here (own, a parent's, or the default)
  let ownerIds: string[] | null = null; // null = default photo of the start screen
  let ownerName = "Start screen";
  for (let i = chain.length - 1; i >= 0; i--) {
    if (chain[i].background?.url) { ownerIds = validPath.slice(0, i + 1); ownerName = chain[i].label || "this screen"; break; }
  }
  const shownBg = ownerIds ? chainOf(value, ownerIds).at(-1)?.background ?? null : value.background ?? null;
  const ownBg = here ? here.background ?? null : value.background ?? null;

  function onPointerDown(e: React.PointerEvent) {
    if (!shownBg) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, start: { ...shownBg }, ownerIds };
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    const frame = frameRef.current;
    if (!d || !frame) return;
    const w = frame.clientWidth || 1;
    const h = frame.clientHeight || 1;
    // Dragging the photo right shows more of its left side
    const dx = ((e.clientX - d.x) / w) * 100 * 1.3;
    const dy = ((e.clientY - d.y) / h) * 100 * 1.3;
    const clamp = (v: number) => Math.round(Math.min(100, Math.max(0, v)) * 10) / 10;
    const next: TreeBackground = display === "phone"
      ? { ...d.start, mx: clamp(d.start.mx - dx), my: clamp(d.start.my - dy) }
      : { ...d.start, x: clamp(d.start.x - dx), y: clamp(d.start.y - dy) };
    mutate((draft, h) => {
      if (d.ownerIds) { if (h) h.background = next; } else draft.background = next;
    }, d.ownerIds ?? []);
  }
  function onPointerUp() { drag.current = null; }

  const linkFor = (n?: TreeNode) => {
    const parts = [...chain.map((c) => c.slug), ...(n ? [n.slug] : [])];
    return `/r/${restaurantSlug ?? "your-restaurant"}${parts.length ? "/" + parts.join("/") : ""}`;
  };

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
      <div className="space-y-5 min-w-0">
        {/* Where we are */}
        <nav aria-label="Menu tree levels" className="flex items-center gap-1 flex-wrap text-sm">
          <button onClick={() => setPath([])}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold ${chain.length ? "text-blue-600 hover:bg-blue-50" : "bg-gray-900 text-white"}`}>
            <Home className="w-3.5 h-3.5" /> Start screen
          </button>
          {chain.map((n, i) => (
            <span key={n.id} className="inline-flex items-center gap-1">
              <ChevronRight className="w-4 h-4 text-gray-300" />
              <button onClick={() => setPath(validPath.slice(0, i + 1))}
                className={`px-2.5 py-1.5 rounded-lg font-semibold ${i === chain.length - 1 ? "bg-gray-900 text-white" : "text-blue-600 hover:bg-blue-50"}`}>
                {n.label || "(no name)"}
              </button>
            </span>
          ))}
        </nav>

        {/* This screen */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-gray-900">{here ? `"${here.label || "(no name)"}" screen` : "Start screen"}</div>
              <div className="text-xs text-gray-500 font-mono">{linkFor()}</div>
            </div>
          </div>

          {!here && (
            <div className="flex items-center gap-3">
              <div className="w-24 h-14 rounded-lg bg-gray-800 flex items-center justify-center overflow-hidden shrink-0">
                {value.logo
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={value.logo} alt="Logo" className="max-w-full max-h-full object-contain p-1" />
                  : <span className="text-[10px] text-white/70 px-1 text-center">{restaurantName}</span>}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-800">Logo</div>
                <div className="text-xs text-gray-500">Shown on top of every screen. Without one, the restaurant name is shown.</div>
                <div className="flex gap-3 mt-1.5">
                  <button onClick={() => logoInput.current?.click()} disabled={!!uploading}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50">
                    {uploading === "logo" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
                    {value.logo ? "Change logo" : "Upload logo"}
                  </button>
                  {value.logo && (
                    <button onClick={() => mutate((d) => { d.logo = null; })} className="text-xs font-medium text-red-500 hover:text-red-600">Remove</button>
                  )}
                </div>
                <input ref={logoInput} type="file" accept="image/png,image/webp,image/jpeg" className="hidden"
                  onChange={(e) => { upload("logo", e.target.files?.[0]); e.target.value = ""; }} />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="tree-subtitle" className="text-sm font-medium text-gray-800">Text under the logo <span className="text-gray-400 font-normal">(optional)</span></label>
            <input id="tree-subtitle" type="text" maxLength={TREE_LIMITS.subtitle}
              value={(here ? here.subtitle : value.subtitle) ?? ""}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder={here ? "e.g. Room Service Extra Charge 5.00€" : "e.g. Fine Dining"}
              className="mt-1.5 w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" />
            <div className="mt-2">
              <StyleExpander open={textStyleOpen} onToggle={() => setTextStyleOpen((o) => !o)} label="Style the text and logo" hint="used on every screen">
                <div className="grid sm:grid-cols-2 gap-2.5">
                  <FontSelect label="Font" value={look.font} onChange={(font) => setLook({ font })} />
                  <StyleColor label="Color" value={look.textColor} onChange={(textColor) => setLook({ textColor })} />
                  <StyleField label={`Text size ${look.textSize}px`}>
                    <input type="range" min={10} max={48} value={look.textSize} onChange={(e) => setLook({ textSize: Number(e.target.value) })} className="w-full" />
                  </StyleField>
                  <StyleField label="Style">
                    <div className="flex items-center gap-1">
                      <StyleToggle title="Bold" on={look.textBold} onClick={() => setLook({ textBold: !look.textBold })}><Bold className="w-3.5 h-3.5" /></StyleToggle>
                      <StyleToggle title="Italic" on={look.textItalic} onClick={() => setLook({ textItalic: !look.textItalic })}><Italic className="w-3.5 h-3.5" /></StyleToggle>
                      <StyleToggle title="Capital letters" on={look.textUppercase} onClick={() => setLook({ textUppercase: !look.textUppercase })}><CaseUpper className="w-3.5 h-3.5" /></StyleToggle>
                    </div>
                  </StyleField>
                  {value.logo ? (
                    <StyleField label={`Logo size ${look.logoSize}px`}>
                      <input type="range" min={30} max={240} step={5} value={look.logoSize} onChange={(e) => setLook({ logoSize: Number(e.target.value) })} className="w-full" />
                    </StyleField>
                  ) : (
                    <StyleField label={`Restaurant name size ${look.nameSize}px (shown without a logo)`}>
                      <input type="range" min={14} max={72} value={look.nameSize} onChange={(e) => setLook({ nameSize: Number(e.target.value) })} className="w-full" />
                    </StyleField>
                  )}
                  <StyleField label={`Darken the photo ${Math.round(look.overlay * 100)}%`}>
                    <input type="range" min={0} max={0.85} step={0.05} value={look.overlay} onChange={(e) => setLook({ overlay: Number(e.target.value) })} className="w-full" />
                  </StyleField>
                </div>
                <button type="button" onClick={() => setLook({
                  font: "", textSize: 18, textColor: "#ffffff", textBold: false, textItalic: false, textUppercase: false, nameSize: 30, logoSize: 80, overlay: 0.45,
                })} className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-gray-700">
                  <RotateCcw className="w-3 h-3" /> Back to the default text style
                </button>
              </StyleExpander>
            </div>
          </div>

          <div>
            <div className="text-sm font-medium text-gray-800">{here ? "Background photo" : "Background photo (used on every screen)"}</div>
            <div className="text-xs text-gray-500 mb-2">
              {here
                ? ownBg ? "This screen has its own photo." : `Uses the photo of "${ownerName}". Upload one to give this screen its own.`
                : "Screens without their own photo use this one."}
            </div>
            <div className="flex items-center gap-3">
              {ownBg && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ownBg.url} alt="" className="w-20 h-12 object-cover rounded-lg border border-gray-200" />
              )}
              <button onClick={() => bgInput.current?.click()} disabled={!!uploading}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-gray-200 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50">
                {uploading === "background" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
                {ownBg ? "Change photo" : here ? "Use its own photo" : "Upload photo"}
              </button>
              {ownBg && (
                <button onClick={() => mutate((d, h) => { if (h) h.background = null; else d.background = null; })}
                  className="text-xs font-medium text-red-500 hover:text-red-600">
                  {here ? "Use the parent's photo" : "Remove"}
                </button>
              )}
              <input ref={bgInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                onChange={(e) => { upload("background", e.target.files?.[0]); e.target.value = ""; }} />
            </div>
          </div>

          <div>
            <div className="text-sm font-medium text-gray-800">Background color (used on every screen)</div>
            <div className="text-xs text-gray-500 mb-2">Shown on screens without a photo.</div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="inline-flex p-0.5 bg-gray-100 rounded-lg" role="radiogroup" aria-label="Background color">
                {([["default", "Default"], ["solid", "One color"], ["gradient", "Gradient"]] as const).map(([k, label]) => (
                  <button key={k} type="button" role="radio" aria-checked={look.bgType === k} onClick={() => setLook({ bgType: k })}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-md ${look.bgType === k ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>{label}</button>
                ))}
              </div>
              <span className="w-16 h-9 rounded-lg border border-gray-200 shrink-0"
                style={{ background: look.bgType === "solid" ? look.bgColor : look.bgType === "gradient" ? `linear-gradient(${look.bgAngle}deg, ${look.bgFrom}, ${look.bgTo})` : "linear-gradient(180deg, #262626, #0a0a0a)" }} />
            </div>
            {look.bgType === "solid" && (
              <div className="mt-2.5 max-w-xs"><StyleColor label="Color" value={look.bgColor} onChange={(bgColor) => setLook({ bgColor })} /></div>
            )}
            {look.bgType === "gradient" && (
              <div className="mt-2.5 grid sm:grid-cols-3 gap-2.5">
                <StyleColor label="From" value={look.bgFrom} onChange={(bgFrom) => setLook({ bgFrom })} />
                <StyleColor label="To" value={look.bgTo} onChange={(bgTo) => setLook({ bgTo })} />
                <StyleField label={`Direction ${look.bgAngle}°`}>
                  <input type="range" min={0} max={360} step={5} value={look.bgAngle} onChange={(e) => setLook({ bgAngle: Number(e.target.value) })} className="w-full" />
                </StyleField>
              </div>
            )}
          </div>
        </div>

        {/* Buttons on this screen */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <div className="text-sm font-semibold text-gray-900">Buttons on this screen</div>
              <div className="text-xs text-gray-500">Each button opens more buttons, or one of your saved menus.</div>
            </div>
            <button onClick={addButton}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-3 py-2">
              <Plus className="w-3.5 h-3.5" /> Add button
            </button>
          </div>
          <label className="mb-3 flex items-start gap-2 rounded-xl border border-gray-200 px-3 py-2 cursor-pointer hover:bg-gray-50">
            <input type="checkbox" checked={sameStyle} onChange={(e) => setSameStyle(e.target.checked)} className="mt-0.5 w-4 h-4 accent-blue-600" />
            <span>
              <span className="block text-xs font-semibold text-gray-900">Same style for all buttons</span>
              <span className="block text-[11px] text-gray-500">
                {sameStyle ? "Styling one button changes every button in the menu tree." : "Each button can have its own style. Buttons you don't style use the shared style."}
              </span>
            </span>
          </label>

          {kids.length === 0 && (
            <div className="text-sm text-gray-400 text-center py-6 border-2 border-dashed border-gray-100 rounded-xl">
              No buttons yet. Add the first one, for example &ldquo;Menu Shqip&rdquo;.
            </div>
          )}

          <ul className="space-y-2">
            {kids.map((n, i) => {
              const missingMenu = n.kind === "menu" && (!n.menuId || (menuIds && !menuIds.includes(n.menuId)));
              const emptySub = n.kind === "submenu" && !(n.children?.length);
              return (
                <li key={n.id} className="rounded-xl border border-gray-200 p-3">
                  <div className="flex items-start gap-2">
                    <div className="flex flex-col gap-0.5 pt-0.5">
                      <button onClick={() => move(n.id, -1)} disabled={i === 0} aria-label="Move up"
                        className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-25"><ArrowUp className="w-3.5 h-3.5" /></button>
                      <button onClick={() => move(n.id, 1)} disabled={i === kids.length - 1} aria-label="Move down"
                        className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-25"><ArrowDown className="w-3.5 h-3.5" /></button>
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <input value={n.label} onChange={(e) => setLabel(n.id, e.target.value)} maxLength={TREE_LIMITS.label}
                        aria-label="Button name" placeholder="Button name"
                        className="w-full text-sm font-semibold border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" />
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="inline-flex p-0.5 bg-gray-100 rounded-lg" role="radiogroup" aria-label="What the button opens">
                          {([
                            { k: "submenu", label: "More buttons", icon: FolderOpen },
                            { k: "menu", label: "A menu", icon: BookOpen },
                          ] as const).map(({ k, label, icon: Icon }) => (
                            <button key={k} role="radio" aria-checked={n.kind === k} onClick={() => setKind(n.id, k)}
                              className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-md ${n.kind === k ? "bg-white shadow-sm text-blue-700" : "text-gray-500 hover:text-gray-700"}`}>
                              <Icon className="w-3.5 h-3.5" /> {label}
                            </button>
                          ))}
                        </div>
                        {n.kind === "menu" ? (
                          <select value={n.menuId && menuIds?.includes(n.menuId) ? n.menuId : ""} onChange={(e) => setMenu(n.id, e.target.value)}
                            aria-label="Menu it opens"
                            className={`text-xs font-medium border rounded-lg px-2 py-1.5 bg-white max-w-[16rem] focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${missingMenu ? "border-amber-300 text-amber-800" : "border-gray-200 text-gray-700"}`}>
                            <option value="">{menus ? "Choose a menu…" : "Loading menus…"}</option>
                            {(menus ?? []).map((m) => <option key={m.menuId} value={m.menuId}>{m.title}</option>)}
                            <option value="__new">+ Create a new menu…</option>
                          </select>
                        ) : (
                          <button onClick={() => setPath([...validPath, n.id])}
                            className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:border-blue-300 hover:text-blue-700">
                            Open · {n.children?.length ?? 0} button{(n.children?.length ?? 0) === 1 ? "" : "s"} <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-400 font-mono truncate">{linkFor(n)}</div>
                      <StyleExpander open={styleOpenFor === n.id} onToggle={() => setStyleOpenFor((o) => (o === n.id ? null : n.id))}
                        label="Style the button"
                        hint={sameStyle ? "all buttons" : n.buttonStyle ? "own style" : "shared style"}>
                        <ButtonStyleControls look={buttonLook(value, n)} onChange={(patch) => setButtonStyle(n.id, patch)} />
                        {!sameStyle && n.buttonStyle && (
                          <button type="button" onClick={() => resetButtonStyle(n.id)} className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-gray-700">
                            <RotateCcw className="w-3 h-3" /> Use the shared style again
                          </button>
                        )}
                      </StyleExpander>
                      {(missingMenu || emptySub) && (
                        <div className="text-[11px] font-medium text-amber-700">
                          {missingMenu ? "Choose which menu this button opens." : "Open it and add the buttons inside."}
                        </div>
                      )}
                    </div>
                    <button onClick={() => remove(n.id)} aria-label={`Remove ${n.label}`}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {problems.length > 0 && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold">Before you can save the menu tree</div>
              <ul className="list-disc list-inside text-xs mt-1 space-y-0.5">
                {problems.slice(0, 6).map((p) => <li key={p}>{p}</li>)}
                {problems.length > 6 && <li>and {problems.length - 6} more</li>}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Live preview */}
      <div className="lg:sticky lg:top-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Preview</span>
          <div className="inline-flex p-0.5 bg-gray-100 rounded-lg">
            {([{ k: "phone", icon: Smartphone, label: "Phone" }, { k: "desktop", icon: Monitor, label: "Computer" }] as const).map(({ k, icon: Icon, label }) => (
              <button key={k} onClick={() => setDisplay(k)} aria-pressed={display === k}
                className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md ${display === k ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}>
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>
        </div>
        <div ref={frameRef}
          className={`relative mx-auto overflow-hidden rounded-2xl border-4 border-gray-900 shadow-xl bg-gray-900 ${display === "phone" ? "w-[260px]" : "w-full"}`}
          style={{ aspectRatio: `${virtual.w} / ${virtual.h}` }}>
          <div className="absolute left-0 top-0 origin-top-left" style={{ width: virtual.w, height: virtual.h, transform: `scale(${scale})` }}>
          <TreeScreen
            fill="box"
            boxHeight={virtual.h}
            display={display}
            restaurantName={restaurantName}
            logo={value.logo}
            subtitle={here ? here.subtitle : value.subtitle}
            background={shownBg}
            look={look}
            onBack={chain.length ? () => setPath(validPath.slice(0, -1)) : undefined}
            buttons={kids.map((n) => ({
              key: n.id,
              label: n.label || "(no name)",
              look: buttonLook(value, n),
              onClick: () => {
                if (n.kind === "submenu") setPath([...validPath, n.id]);
                else toast(menuTitle(n.menuId) ? `Opens "${menuTitle(n.menuId)}" as a book` : "This button doesn't open a menu yet", { icon: "📖" });
              },
            }))}
          >
            {shownBg && (
              <div
                className="absolute inset-0 cursor-grab active:cursor-grabbing touch-none"
                onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
                title="Drag to position the photo"
              />
            )}
          </TreeScreen>
          </div>
        </div>
        <p className="text-[11px] text-gray-500 text-center flex items-center justify-center gap-1">
          {shownBg ? (
            <><Move className="w-3 h-3" /> Drag the photo to choose what shows on {display === "phone" ? "phones" : "computers"}.</>
          ) : "Upload a background photo to see it here."}
        </p>
        <p className="text-[11px] text-gray-400 text-center">Click a button in the preview to open that screen.</p>
      </div>
    </div>
  );
}
