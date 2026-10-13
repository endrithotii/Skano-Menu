"use client";

// Dashboard editor for the "Menu tree": build the start screen and deeper screens, their buttons,
// the text under the logo and the background photos (dragged into place for phones and computers).
// Changes are a draft: the Menu page saves them with "Save changes".

import { useEffect, useRef, useState } from "react";
import {
  Plus, Trash2, ChevronRight, ArrowUp, ArrowDown, ImagePlus, Loader2, Smartphone, Monitor,
  FolderOpen, BookOpen, AlertCircle, Move, Home,
} from "lucide-react";
import toast from "react-hot-toast";
import { TreeScreen } from "@/components/menu-tree-view";
import { compressImage, stageUpload } from "@/components/dashboard/menu-book-editor";
import type { MenuGroup } from "@/components/dashboard/menu-history";
import {
  TREE_LIMITS, newNodeId, treeProblems, uniqueSlug,
  type MenuTree, type TreeBackground, type TreeNode,
} from "@/lib/menu-tree-types";

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
            onBack={chain.length ? () => setPath(validPath.slice(0, -1)) : undefined}
            buttons={kids.map((n) => ({
              key: n.id,
              label: n.label || "(no name)",
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
