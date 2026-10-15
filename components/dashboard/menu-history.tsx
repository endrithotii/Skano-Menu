"use client";

// History of PDF / photo menus on the Menu page.
// Each named menu shows its status, created / updated dates and, under "Versions", every saved version of it.
// "Make active" only puts a version in the draft: like every other change on the Menu page it goes live with Save changes.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FileText, Images, Eye, Trash2, History, CheckCircle2, Clock, X, Loader2, RotateCcw,
  ChevronDown, Pencil, Check, ArrowUpDown, FilePenLine, Search, Plus,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { MenuBook } from "@/components/menu-book";
import { formatDay, formatDayTime } from "@/lib/format-date";
import { MenuBookEditor, type MenuState } from "@/components/dashboard/menu-book-editor";
import { useRouter } from "next/navigation";
import { Palette } from "lucide-react";
import { useNavigationGuard } from "@/lib/navigation-guard";
import { allMenuFileUrls, parseMenuPages } from "@/lib/menu-pages";
import { CalendarClock } from "lucide-react";
import { ScheduleDialog, ScheduleFields, defaultScheduleValue, scheduleProblem, scheduleTimes, type ScheduleItem, type ScheduleValue } from "@/components/dashboard/menu-schedule";

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
  /** Made in "Design your digital Menu": the design it was saved from */
  designId?: string | null;
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
  /** A menu was made active from the edit pop-up (the page reloads what's live) */
  onActivated?: () => void;
  /** Tells the page when the edit pop-up has unsaved changes (for the leave-page warning) */
  onEditDirtyChange?: (dirty: boolean) => void;
  /** The restaurant shows a menu tree: no "Make active", show which menus the tree uses instead */
  treeMode?: boolean;
  usedMenuIds?: string[];
  /** Opens the "New menu" pop-up */
  onNewMenu?: () => void;
  /** Scheduled menus (shows badges and the Schedule button) */
  schedules?: ScheduleItem[] | null;
  onSchedulesChanged?: () => void;
  /** Customers see a menu tree right now (changes the schedule texts) */
  treeLive?: boolean;
  /** Heading and text above the list (default: "Menu history") */
  title?: string;
  description?: string;
}

const normTitle = (t: string | null | undefined) => (t ?? "").replace(/\s+/g, " ").trim();
// For search: lower case, no accents ("Çaj" matches "caj"), single spaces
const searchKey = (t: string) => normTitle(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/**
 * Pop-up with the book editor.
 * - With a version: saving adds a new version to that menu without making it active.
 * - Without one: creates a brand-new menu (also without making it active).
 */
export function MenuEditModal({ restaurantId, menu, version, defaultTitle, onClose, onSaved, onDirtyChange, treeMode = false, treeLive = false }: {
  restaurantId: string;
  menu?: MenuGroup | null;
  version?: MenuVersion | null;
  defaultTitle: string;
  onClose: () => void;
  onSaved: (result: { created: boolean; titleChanged: boolean; menuId: string | null; title: string; activated?: boolean; scheduled?: boolean }) => void;
  onDirtyChange?: (dirty: boolean) => void;
  /** The restaurant shows a menu tree (changes the explanation texts) */
  treeMode?: boolean;
  /** Customers see a menu tree right now */
  treeLive?: boolean;
}) {
  const isNew = !version || !menu;
  const initial: MenuState = isNew
    ? { menuPdfUrl: null, name: null, title: "", basedOn: null }
    : { menuPdfUrl: version.menuPdfUrl, name: version.menuPdfName ?? version.files, title: menu.title, basedOn: version.menuPdfUrl };
  const [value, setValue] = useState<MenuState>(initial);
  const [saving, setSaving] = useState(false);
  // After saving: only keep it in the history, make it the menu customers see right away, or schedule it
  const [after, setAfter] = useState<"keep" | "active" | "schedule">("keep");
  const [schedule, setSchedule] = useState<ScheduleValue>(() => defaultScheduleValue());
  const alreadyLive = !isNew && version.isLive;
  const canMakeActive = !treeMode && !alreadyLive;
  const makeActive = after === "active" && canMakeActive;
  const scheduling = after === "schedule";
  const scheduleIssue = scheduling ? scheduleProblem(schedule) : null;
  const router = useRouter();
  const guard = useNavigationGuard();
  const designId = !isNew ? menu.designId ?? null : null;
  function editDesign() {
    if (isNew || !guard.confirmLeave()) return;
    discardStaged();
    onDirtyChange?.(false);
    router.push(designId
      ? `/dashboard/design-menu?design=${encodeURIComponent(designId)}`
      : `/dashboard/design-menu?from=${encodeURIComponent(menu.menuId)}`);
  }
  const staged = useRef<string[]>([]);
  const schedulePanel = useRef<HTMLDivElement>(null);

  const filesChanged = value.menuPdfUrl !== initial.menuPdfUrl;
  const titleChanged = !isNew && normTitle(value.title) !== "" && normTitle(value.title) !== menu.title;
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
    if (dirty && !window.confirm(isNew ? "This menu isn't saved yet. Close without saving?" : "You have unsaved changes in this version. Close without saving?")) return;
    discardStaged();
    onClose();
  }

  async function save() {
    if (!dirty || empty || saving || scheduleIssue) return;
    setSaving(true);
    const res = await fetch(`/api/restaurants/${restaurantId}/menu-history`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        basedOn: isNew ? null : version.menuPdfUrl,
        menuPdfUrl: value.menuPdfUrl,
        menuPdfName: value.name,
        title: normTitle(value.title) || (isNew ? defaultTitle : ""),
      }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      const d = await res?.json().catch(() => null);
      toast.error(d?.error ?? "Could not save this version");
      return;
    }
    const d = await res.json();
    const keep = allMenuFileUrls(parseMenuPages(value.menuPdfUrl));
    discardStaged(keep);
    const title = normTitle(value.title) || (isNew ? defaultTitle : menu.title);
    let activated = false;
    if (makeActive && !treeMode) {
      // Same files as the version just saved, so this only makes it live (no extra version)
      const json = { "Content-Type": "application/json" };
      const live = await fetch(`/api/restaurants/${restaurantId}/upload-menu`, {
        method: "PUT", headers: json,
        body: JSON.stringify({ menuPdfUrl: value.menuPdfUrl, menuPdfName: value.name, title, basedOn: value.menuPdfUrl }),
      }).catch(() => null);
      const mode = live?.ok
        ? await fetch(`/api/restaurants/${restaurantId}`, { method: "PUT", headers: json, body: JSON.stringify({ primaryMenu: "static" }) }).catch(() => null)
        : null;
      activated = !!mode?.ok;
      if (!activated) toast.error("Saved in the history, but it could not be made active. Use Make active in the history.");
    }
    let scheduled = false;
    if (scheduling && d.menuId) {
      const sr = await fetch(`/api/restaurants/${restaurantId}/menu-schedule`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menuId: d.menuId, ...scheduleTimes(schedule) }),
      }).catch(() => null);
      scheduled = !!sr?.ok;
      if (!scheduled) {
        const e = await sr?.json().catch(() => null);
        toast.error(`Saved in the history, but it could not be scheduled${e?.error ? `: ${e.error}` : "."} Use Schedule in the history.`);
      }
    }
    onDirtyChange?.(false);
    onSaved({ created: !!d.created, titleChanged, menuId: d.menuId ?? null, title, activated, scheduled });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4" onClick={close}>
      <motion.div className="fixed inset-0 bg-black/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      <motion.div
        role="dialog" aria-modal="true" aria-label={isNew ? "New menu" : `Edit ${menu.title}`}
        className="relative z-10 bg-gray-50 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[94vh] overflow-hidden flex flex-col"
        initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 bg-white border-b border-gray-100">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-blue-600">{isNew ? "New menu" : "Editing a saved version"}</div>
            <div className="font-semibold text-gray-900 truncate">{isNew ? "Add a PDF or photos" : `${menu.title} · version ${version.number}`}</div>
            <div className="text-xs text-gray-500">
              {isNew
                ? scheduling ? "It's saved in your menu history and shown to customers at the time you choose." : treeMode ? "It's saved in your menu history, then you can link it to a button." : makeActive ? "It's saved in your menu history and becomes the menu customers see." : "It's saved in your menu history. It doesn't change what customers see."
                : treeMode
                  ? `Saving adds version ${menu.versions.length + 1}. The menu tree always shows the newest version.`
                  : makeActive ? `Saving adds version ${menu.versions.length + 1} and makes it the menu customers see.` : `Saving adds version ${menu.versions.length + 1}. Customers keep seeing the active menu until you make it active.`}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!isNew && (
              <button type="button" onClick={editDesign}
                className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl text-white bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 shadow-sm">
                <Palette className="w-4 h-4" /> {designId ? "Edit the design" : "Edit in the designer"}
              </button>
            )}
            <button onClick={close} aria-label="Close" className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {!isNew && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 text-sm text-blue-800">
              <Palette className="w-4 h-4 mt-0.5 shrink-0" />
              {designId ? (
                <span>This menu was made in Design your digital Menu. To change its texts, photos or layout, click Edit the design. Here you can only change the pages as pictures.</span>
              ) : (
                <span>Want to change texts or add things to this menu? Click Edit in the designer. Text in a PDF becomes editable there. Photos and scanned pages can&apos;t be edited, but you can add new text and shapes on top of them. For a menu you can change completely, make it in{" "}
                  <button type="button" onClick={() => { if (guard.confirmLeave()) { discardStaged(); onDirtyChange?.(false); router.push("/dashboard/design-menu"); } }} className="font-semibold underline">Design your digital Menu</button>.</span>
              )}
            </div>
          )}
          <MenuBookEditor
            context="history"
            restaurantId={restaurantId}
            value={value}
            onChange={setValue}
            savedValue={initial}
            onStaged={(url) => { staged.current.push(url); }}
            editingTitle={menu?.title ?? null}
            defaultTitle={defaultTitle}
          />
          {scheduling && (
            <div ref={schedulePanel} className="mt-4 bg-white rounded-2xl border border-gray-100 p-4">
              <div className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2"><CalendarClock className="w-4 h-4 text-blue-600" /> When should customers see it?</div>
              <ScheduleFields value={schedule} onChange={setSchedule} treeLive={treeLive}
                menuTitle={normTitle(value.title) || (isNew ? defaultTitle : menu.title)} />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-3 bg-white border-t border-gray-100 flex-wrap">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-xs text-gray-500">
              {empty ? "Add at least one page to save." : dirty ? (filesChanged ? "Unsaved changes" : "Name changed") : "No changes yet"}
            </span>
            <div role="radiogroup" aria-label="After saving" className="inline-flex items-center gap-1 p-1 bg-gray-100 rounded-xl">
              {([
                { value: "keep", label: "Keep in history", show: true },
                { value: "active", label: "Make active now", show: canMakeActive },
                { value: "schedule", label: "Schedule", show: true },
              ] as const).filter((o) => o.show).map((o) => (
                <button key={o.value} type="button" role="radio" aria-checked={after === o.value} id={`after-${o.value}`}
                  onClick={() => {
                    setAfter(o.value);
                    if (o.value === "schedule") setTimeout(() => schedulePanel.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
                  }}
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg ${after === o.value ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}>
                  {o.value === "schedule" && <CalendarClock className="w-3.5 h-3.5" />}{o.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={close} disabled={saving} className="text-sm font-medium text-gray-600 px-4 py-2 rounded-xl hover:bg-gray-100 disabled:opacity-50">
              Cancel
            </button>
            <button onClick={save} disabled={!dirty || empty || saving || !!scheduleIssue}
              className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 px-4 py-2 rounded-xl disabled:opacity-40">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {isNew ? "Save menu" : filesChanged || !dirty ? "Save version" : "Save name"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

type Status = { text: string; cls: string; icon: React.ReactNode };

export function MenuHistory({ restaurantId, history, liveMode, draftMenuPdfUrl, onUseVersion, onActivated, onEditDirtyChange, treeMode = false, usedMenuIds = [], onNewMenu, schedules, onSchedulesChanged, treeLive = false, title, description }: MenuHistoryProps) {
  const [scheduling, setScheduling] = useState<MenuGroup | null>(null);
  const scheduleOf = (menuId: string) => (schedules ?? []).filter((s) => s.menuId === menuId && s.status !== "finished");
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

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const q = searchKey(query);

  function openSearch() {
    setSearchOpen(true);
    requestAnimationFrame(() => searchRef.current?.focus());
  }
  function closeSearch() {
    setQuery("");
    setSearchOpen(false);
  }

  const menus = useMemo(() => {
    const list = (data?.menus ?? []).filter((m) => !q || searchKey(m.title).includes(q));
    const [field, dir] = sort.split("-") as ["updated" | "created", "asc" | "desc"];
    const key = (m: MenuGroup) => new Date(field === "updated" ? m.updatedAt : m.createdAt).getTime();
    list.sort((a, b) => (dir === "asc" ? key(a) - key(b) : key(b) - key(a)));
    return list;
  }, [data, sort, q]);

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

  function versionStatus(v: MenuVersion, m?: MenuGroup): Status {
    if (treeMode) {
      const shown = !!m && usedMenuIds.includes(m.menuId) && m.versions[0]?.id === v.id;
      return shown
        ? { text: "Shown in the tree", cls: "bg-green-100 text-green-800 border-green-200", icon: <CheckCircle2 className="w-3.5 h-3.5" /> }
        : { text: m && m.versions[0]?.id === v.id ? "Newest" : "Older version", cls: "bg-gray-100 text-gray-500 border-gray-200", icon: null };
    }
    const shown = v.isLive && liveMode === "static";
    const pending = !v.isLive && draftIsDifferent && v.menuPdfUrl === draftMenuPdfUrl;
    if (pending) return { text: "Active after you save", cls: "bg-amber-100 text-amber-800 border-amber-200", icon: <Clock className="w-3.5 h-3.5" /> };
    if (shown && !draftIsDifferent) return { text: "Active", cls: "bg-green-100 text-green-800 border-green-200", icon: <CheckCircle2 className="w-3.5 h-3.5" /> };
    if (shown) return { text: "Active now · replaced when you save", cls: "bg-green-50 text-green-700 border-green-200", icon: <CheckCircle2 className="w-3.5 h-3.5" /> };
    if (v.isLive) return { text: treeLive ? "Saved · menu tree is shown" : "Saved · digital menu is shown", cls: "bg-blue-50 text-blue-700 border-blue-100", icon: <CheckCircle2 className="w-3.5 h-3.5" /> };
    return { text: "Inactive", cls: "bg-gray-100 text-gray-500 border-gray-200", icon: null };
  }

  function menuStatus(m: MenuGroup): Status & { tone: "green" | "amber" | "gray" } {
    if (treeMode) {
      return usedMenuIds.includes(m.menuId)
        ? { text: "In the menu tree", cls: "bg-green-100 text-green-800 border-green-200", icon: <CheckCircle2 className="w-3.5 h-3.5" />, tone: "green" }
        : { text: "Not in the tree", cls: "bg-gray-100 text-gray-500 border-gray-200", icon: null, tone: "gray" };
    }
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
            <h2 className="text-sm font-semibold text-gray-900">{title ?? "Menu history"}</h2>
            {data && (
              <span className="text-xs text-gray-400">
                · {q ? `${menus.length} of ${data.menus.length}` : data.menus.length} menu{data.menus.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {description ?? (treeMode
              ? "Your saved PDF / photo menus. Link them to buttons in the menu tree. The tree always shows the newest version."
              : "Every menu you save is kept here, with all its versions. Pick one to make it active again.")}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
        {onNewMenu && (
          <button type="button" onClick={onNewMenu}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-3 py-1.5">
            <Plus className="w-3.5 h-3.5" /> New menu
          </button>
        )}
        {data && data.menus.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          {searchOpen ? (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") closeSearch(); }}
                onBlur={() => { if (!query.trim()) setSearchOpen(false); }}
                placeholder="Search menu name"
                aria-label="Search menu name"
                className="w-48 sm:w-56 text-xs text-gray-800 border border-gray-200 rounded-lg pl-8 pr-7 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 [&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={closeSearch} aria-label="Clear search"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-gray-400 hover:text-gray-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            <button type="button" onClick={openSearch} title="Search menu name"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white hover:border-blue-300 hover:text-blue-700">
              <Search className="w-3.5 h-3.5" /> Search
            </button>
          )}
          <label className="inline-flex items-center gap-2 text-xs text-gray-500">
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span className="sr-only sm:not-sr-only">Sort by</span>
            <select value={sort} onChange={(e) => changeSort(e.target.value as SortKey)}
              className="text-xs font-medium text-gray-700 border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30">
              {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </label>
        </div>
        )}
        </div>
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

      {data && data.menus.length > 0 && q && menus.length === 0 && (
        <div className="text-sm text-gray-500 py-6 text-center">
          No menu name matches &ldquo;{query.trim()}&rdquo;.{" "}
          <button onClick={closeSearch} className="text-blue-600 font-medium underline">Clear search</button>
        </div>
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
            const canActivateLatest = !treeMode && !(latest.isLive && liveMode === "static" && !draftIsDifferent) && latest.menuPdfUrl !== draftMenuPdfUrl;
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
                          // Clicking anywhere else throws the new name away (the ✓ button keeps focus, see below)
                          onBlur={() => { if (busy !== m.menuId) setRenaming(null); }}
                          className="flex-1 min-w-0 text-sm font-semibold text-gray-900 border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" />
                        <button type="submit" disabled={busy === m.menuId} aria-label="Save name"
                          onMouseDown={(e) => e.preventDefault()}
                          className="p-1.5 rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
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
                        {!(st.text === "Inactive" && scheduleOf(m.menuId).some((s) => s.status === "running")) && (
                          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${st.cls}`}>
                            {st.icon}{st.text}
                          </span>
                        )}
                        {scheduleOf(m.menuId).map((s) => (
                          <span key={s.id} title={s.endAt ? `${formatDayTime(s.startAt)} until ${formatDayTime(s.endAt)}` : `From ${formatDayTime(s.startAt)}`}
                            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${s.status === "running" ? "bg-green-100 text-green-800 border-green-200" : "bg-amber-50 text-amber-800 border-amber-200"}`}>
                            <CalendarClock className="w-3 h-3" />
                            {s.status === "running" ? `Showing now until ${formatDayTime(s.endAt!)}` : `Scheduled ${formatDayTime(s.startAt)}`}
                          </span>
                        ))}
                        {m.designId && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-100">
                            <Palette className="w-3 h-3" /> Designed
                          </span>
                        )}
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
                    {schedules && (
                      <button onClick={() => setScheduling(m)} title="Schedule"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-gray-200 text-gray-700 bg-white hover:border-blue-300 hover:text-blue-700">
                        <CalendarClock className="w-3.5 h-3.5" /> Schedule
                      </button>
                    )}
                    {canActivateLatest && (
                      <button onClick={() => onUseVersion(m, latest)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
                        <RotateCcw className="w-3.5 h-3.5" /> Make active
                      </button>
                    )}
                    {!m.isLive && !usedMenuIds.includes(m.menuId) && !scheduleOf(m.menuId).length && (
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
                        const vs = versionStatus(v, m);
                        const canActivate = !treeMode && !(v.isLive && liveMode === "static" && !draftIsDifferent) && v.menuPdfUrl !== draftMenuPdfUrl;
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
          <MenuEditModal
            key={editing.version.id}
            restaurantId={restaurantId}
            menu={editing.menu}
            version={editing.version}
            defaultTitle={data?.defaultTitle ?? "Menu"}
            onDirtyChange={onEditDirtyChange}
            treeMode={treeMode}
            treeLive={treeLive}
            onClose={() => setEditing(null)}
            onSaved={({ created, titleChanged, activated, scheduled }) => {
              const name = editing.menu.title;
              setEditing(null);
              reload();
              if (scheduled) {
                onSchedulesChanged?.();
                toast.success(`"${name}" saved and scheduled.`);
              } else if (activated) {
                onActivated?.();
                toast.success(`"${name}" saved and active. Customers see it now.`);
              } else if (created) {
                setOpen((prev) => new Set(prev).add(editing.menu.menuId));
                toast.success(`Saved as a new version of "${name}". Use Make active when you want customers to see it.`);
              } else if (titleChanged) toast.success("Menu renamed");
              else toast("That version already exists in the history, nothing new was added.");
            }}
          />
        )}
      </AnimatePresence>

      {scheduling && (
        <ScheduleDialog restaurantId={restaurantId} menuId={scheduling.menuId} menuTitle={scheduling.title} treeLive={treeLive}
          onClose={() => setScheduling(null)} onSaved={() => onSchedulesChanged?.()} />
      )}

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
                  {!treeMode && !(preview.version.isLive && liveMode === "static" && !draftIsDifferent) && preview.version.menuPdfUrl !== draftMenuPdfUrl && (
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
