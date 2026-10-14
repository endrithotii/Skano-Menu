"use client";

// Menu tree helpers on the Menu page:
// - TreeGuide: three short steps and the "Start a new menu tree" button
// - TreeHistory: older menu trees (kept automatically when a tree is replaced), use / rename / delete them

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { History, RotateCcw, Pencil, Trash2, X, Loader2, Network, FilePlus2, Check, ChevronDown, Palette, Eye, Smartphone, Monitor, BookOpen } from "lucide-react";
import toast from "react-hot-toast";
import { TreeScreen } from "@/components/menu-tree-view";
import { formatDay, formatDayTime } from "@/lib/format-date";
import { buttonLook, effectiveBackground, treeStyle, type MenuTree, type TreeNode } from "@/lib/menu-tree-types";

export interface TreeArchive { id: string; name: string; savedAt: string; buttons: number; tree: MenuTree }

export function useTreeArchives(restaurantId: string | undefined) {
  const [archives, setArchives] = useState<TreeArchive[] | null>(null);
  const [tick, setTick] = useState(0);
  const pending = useRef<(() => void)[]>([]);
  useEffect(() => {
    if (!restaurantId) return;
    let cancelled = false;
    fetch(`/api/restaurants/${restaurantId}/menu-tree?history=1`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((d) => {
        if (!cancelled) setArchives(d?.archives ?? []);
        pending.current.splice(0).forEach((done) => done());
      });
    return () => { cancelled = true; };
  }, [restaurantId, tick]);
  /** Loads the list again (resolves when it's there) */
  const reload = useCallback(() => new Promise<void>((done) => { pending.current.push(done); setTick((t) => t + 1); }), []);
  return { archives, reload };
}

export function TreeGuide({ onStartNew, canStartNew }: { onStartNew: () => void; canStartNew: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-start justify-between gap-4 flex-wrap">
      <ol className="flex flex-col sm:flex-row gap-2 sm:gap-5 text-sm text-gray-600 min-w-0">
        <li className="flex items-start gap-2"><Step n={1} /><span>Make your menus: upload a PDF or photos, or design one in{" "}
          <Link href="/dashboard/design-menu" className="font-medium text-blue-600 hover:text-blue-700 inline-flex items-center gap-0.5"><Palette className="w-3.5 h-3.5" /> Design your digital Menu</Link>.</span></li>
        <li className="flex items-start gap-2"><Step n={2} /><span>Add buttons below and pick which menu each one opens.</span></li>
        <li className="flex items-start gap-2"><Step n={3} /><span>Press Save changes. Customers see it right away.</span></li>
      </ol>
      <button type="button" onClick={onStartNew} disabled={!canStartNew}
        title={canStartNew ? undefined : "Your tree is already empty"}
        className="shrink-0 inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:text-blue-700 disabled:opacity-40">
        <FilePlus2 className="w-4 h-4" /> Start a new menu tree
      </button>
    </div>
  );
}

function Step({ n }: { n: number }) {
  return <span className="w-5 h-5 shrink-0 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center mt-0.5">{n}</span>;
}

/** Confirms starting over; the current tree is kept in the history under the given name */
export function StartNewTreeDialog({ onClose, onConfirm }: {
  onClose: () => void;
  onConfirm: (name: string, keepLook: boolean) => Promise<boolean>;
}) {
  const placeholder = `Menu tree - ${formatDay(new Date())}`;
  const [name, setName] = useState("");
  const [keepLook, setKeepLook] = useState(true);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const ok = await onConfirm(name.trim() || placeholder, keepLook);
    setBusy(false);
    if (ok) onClose();
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => !busy && onClose()}>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
      <form role="dialog" aria-modal="true" aria-label="Start a new menu tree" onSubmit={submit} onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === "Escape" && !busy) onClose(); }}
        className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Start a new menu tree</h2>
            <p className="text-sm text-gray-500">Your current tree is kept in the menu tree history, so you can bring it back any time.</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        <label className="block">
          <span className="block text-xs font-semibold text-gray-600 mb-1">Name for the current tree</span>
          <input id="tree-archive-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder={placeholder}
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" />
          <span className="block text-xs text-gray-400 mt-1">Leave it empty to use &quot;{placeholder}&quot;.</span>
        </label>
        <label className="flex items-start gap-2.5 rounded-xl border border-gray-200 px-3 py-2.5 cursor-pointer hover:bg-gray-50">
          <input type="checkbox" checked={keepLook} onChange={(e) => setKeepLook(e.target.checked)} className="mt-0.5 w-4 h-4 accent-blue-600" />
          <span>
            <span className="block text-sm font-semibold text-gray-900">Keep the logo and background photo</span>
            <span className="block text-xs text-gray-500">Only the buttons start empty.</span>
          </span>
        </label>
        <p className="text-xs text-gray-500">Customers keep seeing the current tree until you save the new one with Save changes.</p>
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="text-sm font-medium text-gray-600 px-4 py-2 rounded-xl hover:bg-gray-100 disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={busy}
            className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl text-white bg-gradient-to-r from-blue-500 to-indigo-500 disabled:opacity-60">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FilePlus2 className="w-4 h-4" />} Start new tree
          </button>
        </div>
      </form>
    </div>
  );
}

/** Look through a tree from the history: click buttons to open their screens */
export function TreePreviewModal({ archive, restaurantName, menuTitle, onClose, onUse }: {
  archive: TreeArchive;
  restaurantName: string;
  menuTitle: (menuId?: string | null) => string | undefined;
  onClose: () => void;
  onUse: () => void;
}) {
  const [path, setPath] = useState<TreeNode[]>([]);
  const [display, setDisplay] = useState<"phone" | "desktop">("phone");
  const [note, setNote] = useState<string | null>(null);
  const virtual = display === "phone" ? { w: 390, h: 823 } : { w: 1280, h: 800 };
  const frameW = display === "phone" ? 300 : 760;
  const scale = frameW / virtual.w;
  const tree = archive.tree;
  const here = path.length ? path[path.length - 1] : null;
  const kids = here ? here.children ?? [] : tree.children;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div role="dialog" aria-modal="true" aria-label={`Preview of ${archive.name}`} onClick={(e) => e.stopPropagation()}
        className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-[820px] max-h-[94vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-gray-100">
          <div className="min-w-0">
            <div className="font-semibold text-gray-900 truncate">{archive.name}</div>
            <div className="text-xs text-gray-500">{archive.buttons} button{archive.buttons === 1 ? "" : "s"} · kept {formatDayTime(archive.savedAt)} · click the buttons to look inside</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="inline-flex p-0.5 bg-gray-100 rounded-lg">
              {([{ k: "phone", icon: Smartphone, label: "Phone" }, { k: "desktop", icon: Monitor, label: "Computer" }] as const).map(({ k, icon: Icon, label }) => (
                <button key={k} type="button" onClick={() => setDisplay(k)} aria-pressed={display === k}
                  className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md ${display === k ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}>
                  <Icon className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100"><X className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-gray-50 p-4 flex flex-col items-center gap-3">
          <div className="text-xs text-gray-500 flex items-center gap-1 flex-wrap justify-center">
            <button type="button" onClick={() => setPath([])} className={`font-semibold ${path.length ? "text-blue-600 hover:underline" : "text-gray-900"}`}>Start screen</button>
            {path.map((n, i) => (
              <span key={n.id} className="inline-flex items-center gap-1">›
                <button type="button" onClick={() => setPath(path.slice(0, i + 1))} className={`font-semibold ${i === path.length - 1 ? "text-gray-900" : "text-blue-600 hover:underline"}`}>{n.label || "(no name)"}</button>
              </span>
            ))}
          </div>
          <div className="relative overflow-hidden rounded-2xl border-4 border-gray-900 shadow-xl bg-gray-900 max-w-full"
            style={{ width: frameW, aspectRatio: `${virtual.w} / ${virtual.h}` }}>
            <div className="absolute left-0 top-0 origin-top-left" style={{ width: virtual.w, height: virtual.h, transform: `scale(${scale})` }}>
              <TreeScreen
                fill="box" boxHeight={virtual.h} display={display}
                restaurantName={restaurantName}
                logo={tree.logo}
                subtitle={here ? here.subtitle : tree.subtitle}
                background={effectiveBackground(tree, path)}
                look={treeStyle(tree)}
                onBack={path.length ? () => setPath(path.slice(0, -1)) : undefined}
                buttons={kids.map((n) => ({
                  key: n.id,
                  label: n.label || "(no name)",
                  look: buttonLook(tree, n),
                  onClick: () => {
                    if (n.kind === "submenu") { setPath([...path, n]); setNote(null); return; }
                    const t = menuTitle(n.menuId);
                    setNote(t ? `"${n.label}" opens the menu "${t}".` : `"${n.label}" opens a menu that was deleted.`);
                  },
                }))}
              />
            </div>
          </div>
          {note && <div className="text-xs text-gray-600 bg-white border border-gray-200 rounded-lg px-3 py-2 inline-flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5 text-blue-500" /> {note}</div>}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100">
          <button type="button" onClick={onClose} className="text-sm font-medium text-gray-600 px-4 py-2 rounded-xl hover:bg-gray-100">Close</button>
          <button type="button" onClick={onUse}
            className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl text-white bg-gradient-to-r from-blue-500 to-indigo-500">
            <RotateCcw className="w-4 h-4" /> Use this tree
          </button>
        </div>
      </div>
    </div>
  );
}

export function TreeHistory({ restaurantId, restaurantName, menuTitle, archives, reload, onUse }: {
  restaurantId: string;
  restaurantName: string;
  menuTitle: (menuId?: string | null) => string | undefined;
  archives: TreeArchive[] | null;
  reload: () => Promise<void>;
  onUse: (a: TreeArchive) => void;
}) {
  const [open, setOpen] = useState(true);
  const [previewing, setPreviewing] = useState<TreeArchive | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);

  async function rename() {
    if (!renaming || !renaming.name.trim()) return;
    const r = await fetch(`/api/restaurants/${restaurantId}/menu-tree`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ archiveId: renaming.id, name: renaming.name }),
    }).catch(() => null);
    if (!r?.ok) { toast.error("Could not rename."); return; }
    setRenaming(null);
    await reload();
  }

  async function remove(a: TreeArchive) {
    if (!window.confirm(`Delete "${a.name}" from the menu tree history? This can't be undone.`)) return;
    const r = await fetch(`/api/restaurants/${restaurantId}/menu-tree?archiveId=${encodeURIComponent(a.id)}`, { method: "DELETE" }).catch(() => null);
    if (!r?.ok) { toast.error("Could not delete."); return; }
    toast.success("Deleted from the history");
    await reload();
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-2 px-5 py-4 text-left">
        <History className="w-4 h-4 text-gray-500" />
        <span className="font-semibold text-gray-900">Menu tree history</span>
        <span className="text-xs text-gray-400">{archives ? `${archives.length} saved` : ""}</span>
        <ChevronDown className={`w-4 h-4 ml-auto text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-5 pb-5">
          <p className="text-xs text-gray-500 mb-3">Every time you start a new tree or save a changed one, the one before is kept here.</p>
          {archives === null ? (
            <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
          ) : archives.length === 0 ? (
            <div className="text-sm text-gray-400 py-4 text-center">No older menu trees yet.</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {archives.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-2.5">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><Network className="w-4 h-4" /></div>
                  <div className="min-w-0 flex-1">
                    {renaming?.id === a.id ? (
                      <div className="flex items-center gap-1">
                        <input autoFocus value={renaming.name} maxLength={80} onChange={(e) => setRenaming({ id: a.id, name: e.target.value })}
                          onKeyDown={(e) => { if (e.key === "Enter") rename(); if (e.key === "Escape") setRenaming(null); }}
                          onBlur={() => setRenaming(null)}
                          aria-label="New name"
                          className="text-sm border border-gray-200 rounded-lg px-2 py-1 w-full max-w-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={rename} aria-label="Save name"
                          className="p-1 rounded-md text-blue-600 hover:bg-blue-50"><Check className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <div className="text-sm font-semibold text-gray-900 truncate">{a.name}</div>
                    )}
                    <div className="text-xs text-gray-500">
                      {a.buttons} button{a.buttons === 1 ? "" : "s"} · kept {formatDayTime(a.savedAt)}
                    </div>
                  </div>
                  <button type="button" onClick={() => setPreviewing(a)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 px-2.5 py-1.5 rounded-lg hover:bg-gray-100">
                    <Eye className="w-3.5 h-3.5" /> Preview
                  </button>
                  <button type="button" onClick={() => onUse(a)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 px-2.5 py-1.5 rounded-lg hover:bg-blue-50">
                    <RotateCcw className="w-3.5 h-3.5" /> Use this tree
                  </button>
                  <button type="button" onClick={() => setRenaming({ id: a.id, name: a.name })} title="Rename" aria-label="Rename"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"><Pencil className="w-3.5 h-3.5" /></button>
                  <button type="button" onClick={() => remove(a)} title="Delete" aria-label="Delete"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {previewing && (
        <TreePreviewModal archive={previewing} restaurantName={restaurantName} menuTitle={menuTitle}
          onClose={() => setPreviewing(null)} onUse={() => { const a = previewing; setPreviewing(null); onUse(a); }} />
      )}
    </div>
  );
}
