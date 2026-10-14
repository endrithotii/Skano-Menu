"use client";

// Menu tree helpers on the Menu page:
// - TreeGuide: three short steps and the "Start a new menu tree" button
// - TreeHistory: older menu trees (kept automatically when a tree is replaced), use / rename / delete them

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { History, RotateCcw, Pencil, Trash2, X, Loader2, Network, FilePlus2, Check, ChevronDown, Palette } from "lucide-react";
import toast from "react-hot-toast";
import { formatDay, formatDayTime } from "@/lib/format-date";
import type { MenuTree } from "@/lib/menu-tree-types";

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

export function TreeHistory({ restaurantId, archives, reload, onUse }: {
  restaurantId: string;
  archives: TreeArchive[] | null;
  reload: () => Promise<void>;
  onUse: (a: TreeArchive) => void;
}) {
  const [open, setOpen] = useState(true);
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
    </div>
  );
}
