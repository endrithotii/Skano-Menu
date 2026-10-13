"use client";

// History of PDF / photo menus on the Menu page.
// Each named menu shows its status, created / updated dates and, under "Versions", every saved version of it.
// "Make active" only puts a version in the draft: like every other change on the Menu page it goes live with Save changes.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FileText, Images, Eye, Trash2, History, CheckCircle2, Clock, X, Loader2, RotateCcw,
  ChevronDown, Pencil, Check, ArrowUpDown, FilePenLine,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { MenuBook } from "@/components/menu-book";
import { formatDay, formatDayTime } from "@/lib/format-date";
import { MenuBookEditor, type MenuState } from "@/components/dashboard/menu-book-editor";

export interface MenuVersion {
  id: string;
  number: number;
  files: string;
  menuPdfUrl: string;
  menuPdfName: string | null;
  kind: "pdf" | "photos";
  pageCount: number | null;
  thumbnail: string | null;
  createdAt: string;
  approximateDate: boolean;
  isLive: boolean;
}

export interface MenuGroup {
  menuId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  isLive: boolean;
  versions: MenuVersion[];
}

export interface MenuHistoryData {
  liveMenuPdfUrl: string | null;
  primaryMenu: string;
  defaultTitle: string;
  menus: MenuGroup[];
}

/** Loads the history; reloads when any of `deps` changes. */
export function useMenuHistory(restaurantId: string | null | undefined, deps: unknown[]) {
  const [data, setData] = useState<MenuHistoryData | null>(null);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  const depKey = JSON.stringify(deps);

  useEffect(() => {
    if (!restaurantId) return;
    let cancelled = false;
    fetch(`/api/restaurants/${restaurantId}/menu-history`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("history"))))
      .then((d: MenuHistoryData) => { if (!cancelled) { setData(d); setFailed(false); } })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [restaurantId, depKey, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data, failed, reload, setData };
}

type SortKey = "updated-desc" | "updated-asc" | "created-desc" | "created-asc";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "updated-desc", label: "Last updated · newest first" },
  { key: "updated-asc", label: "Last updated · oldest first" },
  { key: "created-desc", label: "Date created · newest first" },
  { key: "created-asc", label: "Date created · oldest first" },
];
const SORT_STORAGE = "skano.menuHistorySort";

interface MenuHistoryProps {
  restaurantId: string;
  history: ReturnType<typeof useMenuHistory>;
  liveMode: "dynamic" | "static";
  /** The book currently in the editor (may be unsaved) */
  draftMenuPdfUrl: string | null;
  onUseVersion: (menu: MenuGroup, version: MenuVersion) => void;
  /** Tells the page when the edit pop-up has unsaved changes (for the leave-page warning) */
  onEditDirtyChange?: (dirty: boolean) => void;
}

const normTitle = (t: string | null | undefined) => (t ?? "").replace(/\s+/g, " ").trim();

/** Pop-up to edit any saved version. Saving adds a new version to that menu without making it active. */
function EditVersionModal({ restaurantId, menu, version, defaultTitle, onClose, onSaved, onDirtyChange }: {
  restaurantId: string;
  menu: MenuGroup;
  version: MenuVersion;
  defaultTitle: string;
  onClose: () => void;
  onSaved: (result: { created: boolean; titleChanged: boolean }) => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const initial: MenuState = { menuPdfUrl: version.menuPdfUrl, name: version.menuPdfName ?? version.files, title: menu.title, basedOn: version.menuPdfUrl };
  const [value, setValue] = useState<MenuState>(initial);
  const [saving, setSaving] = useState(false);
  const staged = useRef<string[]>([]);

  const filesChanged = value.menuPdfUrl !== initial.menuPdfUrl;
  const titleChanged = normTitle(value.title) !== "" && normTitle(value.title) !== menu.title;
  const dirty = filesChanged || titleChanged;
  const empty = !value.menuPdfUrl;

  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  const discardStaged = (keep: string[] = []) => {
    for (const url of staged.current) {
      if (keep.includes(url)) continue;
      fetch(`/api/restaurants/${restaurantId}/upload-menu?staged=${encodeURIComponent(url)}`, { method: "DELETE" }).catch(() => {});
    }
    staged.current = [];
  };

  function close() {
    if (saving) return;
    if (dirty && !window.confirm("You have unsaved changes in this version. Close without saving?")) return;
    discardStaged();
    onClose();
  }

  async function save() {
    if (!dirty || empty || saving) return;
    setSaving(true);
    const res = await fetch(`/api/restaurants/${restaurantId}/menu-history`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ basedOn: version.menuPdfUrl, menuPdfUrl: value.menuPdfUrl, menuPdfName: value.name, title: normTitle(value.title) }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      const d = await res?.json().catch(() => null);
      toast.error(d?.error ?? "Could not save this version");
      return;
    }
    const d = await res.json();
    const keep = value.menuPdfUrl ? (value.menuPdfUrl.startsWith("[") ? (JSON.parse(value.menuPdfUrl) as string[]) : [value.menuPdfUrl]) : [];
    discardStaged(keep);
    onDirtyChange?.(false);
    onSaved({ created: !!d.created, titleChanged });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4" onClick={close}>
      <motion.div className="fixed inset-0 bg-black/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      <motion.div
        role="dialog" aria-modal="true" aria-label={`Edit ${menu.title}`}
        className="relative z-10 bg-gray-50 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[94vh] overflow-hidden flex flex-col"
        initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 bg-white border-b border-gray-100">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-blue-600">Editing a saved version</div>
            <div className="font-semibold text-gray-900 truncate">{menu.title} · version {version.number}</div>
            <div className="text-xs text-gray-500">Saving adds version {menu.versions.length + 1}. Customers keep seeing the active menu until you make it active.</div>
          </div>
          <button onClick={close} aria-label="Close" className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          <MenuBookEditor
            context="history"
            restaurantId={restaurantId}
            value={value}
            onChange={setValue}
            savedValue={initial}
            onStaged={(url) => { staged.current.push(url); }}
            editingTitle={menu.title}
            defaultTitle={defaultTitle}
          />
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-3 bg-white border-t border-gray-100">
          <span className="text-xs text-gray-500">
            {empty ? "Add at least one page to save." : dirty ? (filesChanged ? "Unsaved changes" : "Name changed") : "No changes yet"}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={close} disabled={saving} className="text-sm font-medium text-gray-600 px-4 py-2 rounded-xl hover:bg-gray-100 disabled:opacity-50">
              Cancel
            </button>
            <button onClick={save} disabled={!dirty || empty || saving}
              className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 px-4 py-2 rounded-xl disabled:opacity-40">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {filesChanged || !dirty ? "Save version" : "Save name"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

type Status = { text: string; cls: string; icon: React.ReactNode };

export function MenuHistory({ restaurantId, history, liveMode, draftMenuPdfUrl, onUseVersion, onEditDirtyChange }: MenuHistoryProps) {
  const { data, failed, reload, setData } = history;
  const [sort, setSort] = useState<SortKey>(() => {
    try {
      const v = typeof window !== "undefined" ? window.localStorage.getItem(SORT_STORAGE) : null;
      return SORTS.some((s) => s.key === v) ? (v as SortKey) : "updated-desc";
    } catch {
      return "updated-desc";
    }
  });
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<{ menu: MenuGroup; version: MenuVersion } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ menuId: string; value: string } | null>(null);
  const [editing, setEditing] = useState<{ menu: MenuGroup; version: MenuVersion } | null>(null);

  const liveUrl = data?.liveMenuPdfUrl ?? null;
  const draftIsDifferent = draftMenuPdfUrl !== liveUrl;

  const menus = useMemo(() => {
    const list = [...(data?.menus ?? [])];
    const [field, dir] = sort.split("-") as ["updated" | "created", "asc" | "desc"];
    const key = (m: MenuGroup) => new Date(field === "updated" ? m.updatedAt : m.createdAt).getTime();
    list.sort((a, b) => (dir === "asc" ? key(a) - key(b) : key(b) - key(a)));
    return list;
  }, [data, sort]);

  function changeSort(next: SortKey) {
    setSort(next);
    try { window.localStorage.setItem(SORT_STORAGE, next); } catch { /* ignore */ }
  }

  function toggle(menuId: string) {
    setOpen((prev) => {
      const n = new Set(prev);
      if (n.has(menuId)) n.delete(menuId);
      else n.add(menuId);
      return n;
    });
  }

  function versionStatus(v: MenuVersion): Status {
    const shown = v.isLive && liveMode === "static";
    const pending = !v.isLive && draftIsDifferent && v.menuPdfUrl === draftMenuPdfUrl;
    if (pending) return { text: "Active after you save", cls: "bg-amber-100 text-amber-800 border-amber-200", icon: <Clock className="w-3.5 h-3.5" /> };
    if (shown && !draftIsDifferent) return { text: "Active", cls: "bg-green-100 text-green-800 border-green-200", icon: <CheckCircle2 className="w-3.5 h-3.5" /> };
    if (shown) return { text: "Active now · replaced when you save", cls: "bg-green-50 text-green-700 border-green-200", icon: <CheckCircle2 className="w-3.5 h-3.5" /> };
    if (v.isLive) return { text: "Saved · digital menu is shown", cls: "bg-blue-50 text-blue-700 border-blue-100", icon: <CheckCircle2 className="w-3.5 h-3.5" /> };
    return { text: "Inactive", cls: "bg-gray-100 text-gray-500 border-gray-200", icon: null };
  }

  function menuStatus(m: MenuGroup): Status & { tone: "green" | "amber" | "gray" } {
    const pendingV = m.versions.find((v) => !v.isLive && draftIsDifferent && v.menuPdfUrl === draftMenuPdfUrl);
    if (pendingV) return { ...versionStatus(pendingV), text: m.versions.length > 1 ? `Active after you save · version ${pendingV.number}` : "Active after you save", tone: "amber" };
    const liveV = m.versions.find((v) => v.isLive);
    if (liveV) {
      const s = versionStatus(liveV);
      const which = m.versions.length > 1 && liveV !== m.versions[0] ? ` · version ${liveV.number}` : "";
      return { ...s, text: s.text + which, tone: liveMode === "static" && !draftIsDifferent ? "green" : "gray" };
    }
    return { ...versionStatus(m.versions[0]), tone: "gray" };
  }

  async function saveRename() {
    if (!renaming) return;
    const title = renaming.value.replace(/\s+/g, " ").trim();
    if (!title) { toast.error("Please enter a name"); return; }
    setBusy(renaming.menuId);
    const res = await fetch(`/api/restaurants/${restaurantId}/menu-history`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ menuId: renaming.menuId, title }),
    }).catch(() => null);
    setBusy(null);
    if (res?.ok) {
      const menuId = renaming.menuId;
      setData((d) => (d ? { ...d, menus: d.menus.map((m) => (m.menuId === menuId ? { ...m, title } : m)) } : d));
      setRenaming(null);
      toast.success("Menu renamed");
    } else {
      toast.error("Could not rename the menu");
    }
  }

  async function remove(kind: "menu" | "version", id: string, label: string) {
    const msg = kind === "menu"
      ? `Delete the menu "${label}" and all its versions? This can't be undone.`
      : `Delete ${label}? This can't be undone.`;
    if (!window.confirm(msg)) return;
    setBusy(id);
    const q = kind === "menu" ? `menuId=${encodeURIComponent(id)}` : `versionId=${encodeURIComponent(id)}`;
    const res = await fetch(`/api/restaurants/${restaurantId}/menu-history?${q}`, { method: "DELETE" }).catch(() => null);
    setBusy(null);
    if (res?.ok) {
      toast.success(kind === "menu" ? "Menu deleted" : "Version deleted");
      reload();
    } else {
      const d = await res?.json().catch(() => null);
      toast.error(d?.error ?? "Could not delete");
    }
  }

  const dateText = (v: { createdAt: string; approximateDate?: boolean }) =>
    v.approximateDate ? `on or before ${formatDay(v.createdAt)}` : formatDayTime(v.createdAt);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-900">Menu history</h2>
            {data && <span className="text-xs text-gray-400">· {data.menus.length} menu{data.menus.length === 1 ? "" : "s"}</span>}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">Every menu you save is kept here, with all its versions. Pick one to make it active again.</p>
        </div>
        {data && data.menus.length > 1 && (
          <label className="inline-flex items-center gap-2 text-xs text-gray-500">
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span className="sr-only sm:not-sr-only">Sort by</span>
            <select value={sort} onChange={(e) => changeSort(e.target.value as SortKey)}
              className="text-xs font-medium text-gray-700 border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30">
              {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </label>
        )}
      </div>

      {!data && !failed && (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-6 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading history
        </div>
      )}
      {failed && !data && (
        <div className="text-sm text-gray-500 py-4 text-center">
          Could not load the history. <button onClick={reload} className="text-blue-600 font-medium underline">Try again</button>
        </div>
      )}
      {data && data.menus.length === 0 && (
        <div className="text-sm text-gray-400 py-6 text-center">No saved menus yet. After you save a PDF or photos, they show up here.</div>
      )}

      {data && menus.length > 0 && (
        <ul className="space-y-3">
          {menus.map((m) => {
            const st = menuStatus(m);
            const latest = m.versions[0];
            const liveV = m.versions.find((v) => v.isLive);
            const shownVersion = liveV ?? latest;
            const expanded = open.has(m.menuId);
            const border = st.tone === "green" ? "border-green-300 bg-green-50/30" : st.tone === "amber" ? "border-amber-300 bg-amber-50/30" : "border-gray-200";
            const canActivateLatest = !(latest.isLive && liveMode === "static" && !draftIsDifferent) && latest.menuPdfUrl !== draftMenuPdfUrl;
            const thumb = shownVersion.thumbnail;
            const approxCreated = m.versions[m.versions.length - 1].approximateDate;

            return (
              <li key={m.menuId} className={`rounded-xl border ${border}`}>
                <div className="flex items-center gap-3 p-3">
                  <button onClick={() => setPreview({ menu: m, version: shownVersion })} aria-label={`Preview ${m.title}`}
                    className="w-12 h-16 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 shrink-0 flex items-center justify-center">
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <FileText className="w-5 h-5 text-gray-400" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    {renaming?.menuId === m.menuId ? (
                      <form onSubmit={(e) => { e.preventDefault(); saveRename(); }} className="flex items-center gap-1.5">
                        <input autoFocus value={renaming.value} maxLength={80}
                          onChange={(e) => setRenaming({ menuId: m.menuId, value: e.target.value })}
                          onKeyDown={(e) => { if (e.key === "Escape") setRenaming(null); }}
                          className="flex-1 min-w-0 text-sm font-semibold text-gray-900 border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" />
                        <button type="submit" disabled={busy === m.menuId} aria-label="Save name" className="p-1.5 rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
                          {busy === m.menuId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        </button>
                        <button type="button" onClick={() => setRenaming(null)} aria-label="Cancel" className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100">
                          <X className="w-4 h-4" />
                        </button>
                      </form>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900 truncate max-w-[18rem]">{m.title}</span>
                        <button onClick={() => setRenaming({ menuId: m.menuId, value: m.title })} title="Rename"
                          className="p-1 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${st.cls}`}>
                          {st.icon}{st.text}
                        </span>
                      </div>
                    )}
                    <div className="text-xs text-gray-500 mt-1 flex items-center gap-x-1.5 gap-y-0.5 flex-wrap">
                      {latest.kind === "pdf" ? <FileText className="w-3.5 h-3.5" /> : <Images className="w-3.5 h-3.5" />}
                      <span>{latest.files}</span>
                      <span className="text-gray-300">·</span>
                      <span>Created {approxCreated ? `on or before ${formatDay(m.createdAt)}` : m.versions.length > 1 ? formatDay(m.createdAt) : formatDayTime(m.createdAt)}</span>
                      {m.versions.length > 1 && (
                        <>
                          <span className="text-gray-300">·</span>
                          <span>Updated {formatDayTime(m.updatedAt)}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setPreview({ menu: m, version: shownVersion })} title="Preview"
                      className="p-2 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button onClick={() => setEditing({ menu: m, version: latest })} title={m.versions.length > 1 ? "Edit the latest version" : "Edit"}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-gray-200 text-gray-700 bg-white hover:border-blue-300 hover:text-blue-700">
                      <FilePenLine className="w-3.5 h-3.5" /> Edit
                    </button>
                    {canActivateLatest && (
                      <button onClick={() => onUseVersion(m, latest)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
                        <RotateCcw className="w-3.5 h-3.5" /> Make active
                      </button>
                    )}
                    {!m.isLive && (
                      <button onClick={() => remove("menu", m.menuId, m.title)} disabled={busy === m.menuId} title="Delete menu"
                        className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50">
                        {busy === m.menuId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Versions (subhistory), only when there is more than one */}
                {m.versions.length > 1 && (
                <div className="border-t border-gray-100">
                  <button onClick={() => toggle(m.menuId)} aria-expanded={expanded}
                    className="w-full flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-b-xl">
                    <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
                    {m.versions.length} versions
                  </button>
                  {expanded && (
                    <ol className="px-3 pb-3 space-y-1.5">
                      {m.versions.map((v, i) => {
                        const vs = versionStatus(v);
                        const canActivate = !(v.isLive && liveMode === "static" && !draftIsDifferent) && v.menuPdfUrl !== draftMenuPdfUrl;
                        return (
                          <li key={v.id} className="flex items-center gap-3 rounded-lg bg-gray-50 border border-gray-100 pl-3 pr-1.5 py-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold text-gray-800">
                                  Version {v.number}{i === 0 ? " · latest" : ""}{v.number === 1 ? " · first upload" : ""}
                                </span>
                                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${vs.cls}`}>
                                  {vs.icon}{vs.text}
                                </span>
                              </div>
                              <div className="text-[11px] text-gray-500">{v.files} · saved {dateText(v)}</div>
                            </div>
                            <button onClick={() => setPreview({ menu: m, version: v })} title="Preview"
                              className="p-1.5 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-white">
                              <Eye className="w-4 h-4" />
                            </button>
                            <button onClick={() => setEditing({ menu: m, version: v })} title={`Edit version ${v.number}`}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-700 bg-white hover:border-blue-300 hover:text-blue-700">
                              <FilePenLine className="w-3 h-3" /> Edit
                            </button>
                            {canActivate && (
                              <button onClick={() => onUseVersion(m, v)}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-blue-200 text-blue-700 bg-white hover:bg-blue-50">
                                <RotateCcw className="w-3 h-3" /> Make active
                              </button>
                            )}
                            {!v.isLive && m.versions.length > 1 && (
                              <button onClick={() => remove("version", v.id, `version ${v.number} of "${m.title}"`)} disabled={busy === v.id} title="Delete version"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-white disabled:opacity-50">
                                {busy === v.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Edit modal */}
      <AnimatePresence>
        {editing && (
          <EditVersionModal
            key={editing.version.id}
            restaurantId={restaurantId}
            menu={editing.menu}
            version={editing.version}
            defaultTitle={data?.defaultTitle ?? "Menu"}
            onDirtyChange={onEditDirtyChange}
            onClose={() => setEditing(null)}
            onSaved={({ created, titleChanged }) => {
              const name = editing.menu.title;
              setEditing(null);
              reload();
              if (created) {
                setOpen((prev) => new Set(prev).add(editing.menu.menuId));
                toast.success(`Saved as a new version of "${name}". Use Make active when you want customers to see it.`);
              } else if (titleChanged) toast.success("Menu renamed");
              else toast("That version already exists in the history, nothing new was added.");
            }}
          />
        )}
      </AnimatePresence>

      {/* Preview modal */}
      <AnimatePresence>
        {preview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
            <motion.div className="fixed inset-0 bg-black/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            <motion.div
              className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col"
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
                <div className="min-w-0">
                  <div className="font-semibold text-gray-900 truncate">{preview.menu.title}</div>
                  <div className="text-xs text-gray-500">Version {preview.version.number} · {preview.version.files} · saved {dateText(preview.version)}</div>
                </div>
                <div className="flex items-center gap-2">
                  {!(preview.version.isLive && liveMode === "static" && !draftIsDifferent) && preview.version.menuPdfUrl !== draftMenuPdfUrl && (
                    <button onClick={() => { onUseVersion(preview.menu, preview.version); setPreview(null); }}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
                      <RotateCcw className="w-4 h-4" /> Make active
                    </button>
                  )}
                  <button onClick={() => setPreview(null)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto bg-gray-50 p-4">
                <MenuBook key={preview.version.menuPdfUrl} source={preview.version.menuPdfUrl} maxHeightRatio={0.66} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
