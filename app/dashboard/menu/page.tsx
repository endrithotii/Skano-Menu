"use client";

import React, { useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, BookOpen, ExternalLink, Save, Network, Palette, Plus, FileText, Images, LayoutList, CalendarClock } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import { MenuBookEditor } from "@/components/dashboard/menu-book-editor";
import { MenuEditModal, MenuHistory, useMenuHistory, type MenuGroup, type MenuVersion } from "@/components/dashboard/menu-history";
import { MenuTreeEditor } from "@/components/dashboard/menu-tree-editor";
import { StartNewTreeDialog, TreeGuide, TreeHistory, useTreeArchives } from "@/components/dashboard/tree-history";
import { emptyTree, treeImageUrls, treeMenuIds, type MenuTree } from "@/lib/menu-tree-types";
import type { MenuState as BookDraft } from "@/components/dashboard/menu-book-editor";
import { defaultMenuName, formatDayTime } from "@/lib/format-date";
import { allMenuFileUrls, parseMenuPages } from "@/lib/menu-pages";
import { useUnsavedChanges } from "@/lib/navigation-guard";
import { ScheduledMenus, useSchedules } from "@/components/dashboard/menu-schedule";

/** "static" = one PDF / photo menu, "tree" = buttons leading to several menus.
 *  "dynamic" (the old categories & items menu) can't be picked anymore, restaurants still on it keep it until they save another type */
type MenuMode = "dynamic" | "static" | "tree";

interface Restaurant {
  id: string;
  name: string;
  slug: string | null;
  /** What the QR code shows (see MenuMode) */
  primaryMenu: MenuMode;
  menuPdfUrl: string | null;
  menuPdfName: string | null;
  /** Dishes on the old digital menu (a new restaurant has none) */
  items: number;
}

export default function MenuManagementPage() {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  // ── Unsaved changes ────────────────────────────────────────────────────────
  // Nothing below goes live until the user presses Save.
  const [draftMode, setDraftMode] = useState<MenuMode | null>(null);
  // Menu tree: saved version from the server and the unsaved draft
  const [savedTree, setSavedTree] = useState<MenuTree | null>(null);
  const [treeDraft, setTreeDraft] = useState<MenuTree | null>(null);
  const treeStagedRef = useRef<string[]>([]);
  const [startNewTree, setStartNewTree] = useState(false);
  // "New menu" pop-up; `assign` links the new menu to a tree button
  const [newMenu, setNewMenu] = useState<{ assign?: (menuId: string) => void } | null>(null);
  const [draftBook, setDraftBook] = useState<BookDraft | null>(null);
  // New / changed PDF or photos: make them live on save, or only keep them in the history
  const [bookMakeActive, setBookMakeActive] = useState(true);
  const [saving, setSaving] = useState(false);
  // Files uploaded for the book but not saved yet (deleted again on Discard)
  const stagedUploadsRef = useRef<string[]>([]);

  const savedMode = restaurant?.primaryMenu ?? "dynamic";
  // The old digital menu is still live for some restaurants: show the PDF / photo editor, it replaces it on save
  const legacyDigital = savedMode === "dynamic";
  const effectiveMode: MenuMode = draftMode ?? (legacyDigital ? "static" : savedMode);
  // Named menus with their versions (PDF / photo books)
  const treeArchives = useTreeArchives(restaurant?.id);
  const history = useMenuHistory(restaurant?.id, [restaurant?.menuPdfUrl ?? null, savedMode]);
  // Loading the schedules also starts the ones that are due: then reload what's live
  const schedules = useSchedules(restaurant?.id, () => { load(); });
  const treeLive = savedMode === "tree";
  // A schedule changed: it may have made a menu active, so reload what's live too
  const schedulesChanged = () => { schedules.reload().then(() => load()); };
  const menuOf = (url: string | null | undefined): MenuGroup | undefined =>
    url ? history.data?.menus.find((m) => m.versions.some((v) => v.menuPdfUrl === url)) : undefined;
  const normTitle = (t: string | null | undefined) => (t ?? "").replace(/\s+/g, " ").trim();
  const savedUrl = restaurant?.menuPdfUrl ?? null;
  const savedBook: BookDraft = {
    menuPdfUrl: savedUrl,
    name: restaurant?.menuPdfName ?? null,
    title: menuOf(savedUrl)?.title ?? "",
    basedOn: savedUrl,
  };
  const bookValue = draftBook ?? savedBook;
  const defaultTitle = defaultMenuName(restaurant?.name);
  const modeChanged = draftMode !== null && draftMode !== savedMode;
  const titleChanged = (d: BookDraft) => normTitle(d.title) !== "" && normTitle(d.title) !== normTitle(savedBook.title);
  // The draft has new or changed pages (not just an older version loaded from the history)
  const bookFilesNew = !!draftBook?.menuPdfUrl && draftBook.menuPdfUrl !== draftBook.basedOn;
  const bookChanged = draftBook !== null && (draftBook.menuPdfUrl !== savedBook.menuPdfUrl || titleChanged(draftBook));
  const treeValue: MenuTree = treeDraft ?? savedTree ?? emptyTree();
  const treeChanged = treeDraft !== null && JSON.stringify(treeDraft) !== JSON.stringify(savedTree ?? emptyTree());
  const changeCount = (modeChanged ? 1 : 0) + (bookChanged ? 1 : 0) + (treeChanged ? 1 : 0);
  // The "edit a saved version" pop-up in the history has unsaved changes
  const [historyEditDirty, setHistoryEditDirty] = useState(false);
  const hasUnsaved = changeCount > 0 || historyEditDirty;

  useUnsavedChanges(
    hasUnsaved,
    changeCount > 0
      ? `You have ${changeCount} unsaved change${changeCount === 1 ? "" : "s"} in your menu. Leave without saving?`
      : "You are editing a menu version that isn't saved yet. Leave without saving?",
  );

  // Remounts the book editor when a version from the history is loaded into it
  const [editorKey, setEditorKey] = useState(0);

  function loadHistoryVersion(menu: MenuGroup, v: MenuVersion) {
    setDraftBook(v.menuPdfUrl === savedBook.menuPdfUrl
      ? null
      : { menuPdfUrl: v.menuPdfUrl, name: v.menuPdfName ?? v.files, title: menu.title, basedOn: v.menuPdfUrl });
    if (savedMode !== "static") setDraftMode("static");
    setEditorKey((k) => k + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });
    const which = menu.versions.length > 1 ? ` (version ${v.number})` : "";
    toast(`"${menu.title}"${which} loaded. Press Save changes to make it active.`, { icon: "💾" });
  }

  // Load the saved menu tree
  useEffect(() => {
    if (!restaurant?.id) return;
    let cancelled = false;
    fetch(`/api/restaurants/${restaurant.id}/menu-tree`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setSavedTree(d?.tree ?? emptyTree()); })
      .catch(() => { if (!cancelled) setSavedTree(emptyTree()); });
    return () => { cancelled = true; };
  }, [restaurant?.id]);

  function discardTreeUploads(keep: string[]) {
    if (!restaurant) return;
    for (const url of treeStagedRef.current) {
      if (keep.includes(url)) continue;
      fetch(`/api/restaurants/${restaurant.id}/upload-menu?staged=${encodeURIComponent(url)}`, { method: "DELETE" }).catch(() => {});
    }
    treeStagedRef.current = [];
  }

  function setMenuMode(mode: MenuMode) {
    setDraftMode(mode === savedMode ? null : mode);
  }

  function discardChanges() {
    if (!restaurant) return;
    const keep = allMenuFileUrls(parseMenuPages(restaurant.menuPdfUrl));
    for (const url of stagedUploadsRef.current) {
      if (keep.includes(url)) continue;
      fetch(`/api/restaurants/${restaurant.id}/upload-menu?staged=${encodeURIComponent(url)}`, { method: "DELETE" }).catch(() => {});
    }
    stagedUploadsRef.current = [];
    discardTreeUploads(savedTree ? treeImageUrls(savedTree) : []);
    setTreeDraft(null);
    setDraftMode(null);
    setDraftBook(null);
  }

  async function saveChanges() {
    if (!restaurant || saving || changeCount === 0) return;
    setSaving(true);
    const rid = restaurant.id;
    const failed: string[] = [];
    const json = { "Content-Type": "application/json" };

    // 1. Uploaded menu (PDF / photos): live (PUT upload-menu) or only into the history (POST menu-history)
    const bookToHistoryOnly = bookChanged && !!draftBook && bookFilesNew && !bookMakeActive;
    let bookWentLive = false;
    if (bookChanged && draftBook) {
      const res = await fetch(`/api/restaurants/${rid}/${bookToHistoryOnly ? "menu-history" : "upload-menu"}`, {
        method: bookToHistoryOnly ? "POST" : "PUT", headers: json,
        body: JSON.stringify({
          menuPdfUrl: draftBook.menuPdfUrl,
          menuPdfName: draftBook.name,
          // New menu without a name gets "<Restaurant>'s menu - <today>" (in the user's own time zone)
          title: normTitle(draftBook.title) || (draftBook.basedOn ? "" : defaultTitle),
          basedOn: draftBook.basedOn ?? null,
        }),
      }).catch(() => null);
      if (res?.ok) {
        const saved = allMenuFileUrls(parseMenuPages(draftBook.menuPdfUrl));
        // Uploads that were removed again before saving are no longer needed
        for (const url of stagedUploadsRef.current) {
          if (!saved.includes(url)) {
            fetch(`/api/restaurants/${rid}/upload-menu?staged=${encodeURIComponent(url)}`, { method: "DELETE" }).catch(() => {});
          }
        }
        stagedUploadsRef.current = [];
        setDraftBook(null);
        setBookMakeActive(true);
        history.reload();
        bookWentLive = !bookToHistoryOnly;
        if (bookToHistoryOnly) toast.success("Saved in your menu history. Customers still see the current menu.");
      } else failed.push("menu file");
    }

    // 1b. Menu tree
    let treeOk = !treeChanged;
    if (treeChanged && treeDraft) {
      const res = await fetch(`/api/restaurants/${rid}/menu-tree`, {
        method: "PUT", headers: json, body: JSON.stringify({ tree: treeDraft }),
      }).catch(() => null);
      if (res?.ok) {
        const d = await res.json();
        const saved: MenuTree = d.tree ?? treeDraft;
        setSavedTree(saved);
        treeArchives.reload();
        setTreeDraft(null);
        discardTreeUploads(treeImageUrls(saved));
        treeOk = true;
      } else {
        const d = await res?.json().catch(() => null);
        failed.push(d?.error ? `menu tree: ${d.error}` : "menu tree");
      }
    }

    // 2. Menu type (what the QR code shows)
    const treeReady = (treeOk ? (treeDraft ?? savedTree) : savedTree)?.children.length;
    if (modeChanged && draftMode === "tree" && (!treeOk || !treeReady)) {
      failed.push("menu type (finish the menu tree first, customers keep seeing the current menu)");
    } else if (modeChanged && draftMode === "static" && !restaurant.menuPdfUrl && !bookWentLive) {
      // Nothing would be shown: the new menu was only kept in the history
      toast("Menu type not changed: there is no active PDF / photo menu yet. Make one active first.", { icon: "ℹ️" });
      setDraftMode(null);
    } else if ((modeChanged && draftMode) || (legacyDigital && bookWentLive && !failed.length)) {
      // Saving a PDF / photo menu while the old digital menu is live switches to it
      const res = await fetch(`/api/restaurants/${rid}`, {
        method: "PUT", headers: json, body: JSON.stringify({ primaryMenu: draftMode ?? "static" }),
      }).catch(() => null);
      if (res?.ok) setDraftMode(null);
      else failed.push("menu type");
    }

    await load();
    setSaving(false);

    if (failed.length) toast.error(`Some changes could not be saved (${[...new Set(failed)].join(", ")}). Please try again.`);
    else toast.success("Changes saved. Customers see them now.");
  }

  async function load() {
    const statsRes = await fetch("/api/dashboard/stats");
    const stats = await statsRes.json();
    const rid: string = stats.restaurantId;
    setRestaurant({
      id: rid,
      name: stats.restaurant.name,
      slug: stats.restaurant.slug ?? null,
      primaryMenu: (["static", "tree"].includes(stats.restaurant.primaryMenu) ? stats.restaurant.primaryMenu : "dynamic") as MenuMode,
      menuPdfUrl: stats.restaurant.menuPdfUrl ?? null,
      menuPdfName: stats.restaurant.menuPdfName ?? null,
      items: Number(stats.totalItems) || 0,
    });

    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div className="p-6 flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" /></div>;
  if (!restaurant) return null;

  const isBook = effectiveMode === "static";
  const isTree = effectiveMode === "tree";
  const modeName = (m: MenuMode) => (m === "static" ? "PDF / photo" : m === "tree" ? "menu tree" : "digital");
  const hasBook = !!parseMenuPages(bookValue.menuPdfUrl);

  // ── The menu customers see right now (saved, not the draft) ──
  const livePages = parseMenuPages(savedUrl);
  const liveMenu = menuOf(savedUrl);
  const liveThumb = liveMenu?.versions.find((v) => v.menuPdfUrl === savedUrl)?.thumbnail ?? null;
  const runningSchedule = (schedules.items ?? []).find((x) => x.status === "running") ?? null;
  // Nothing customers could see yet (they get "No menu uploaded yet")
  const noMenu = !runningSchedule && (savedMode === "tree" ? !savedTree?.children.length : savedMode === "static" ? !livePages : restaurant.items === 0);
  const current: { type: string; detail: string; name: string; icon: React.ReactNode } =
    noMenu
      ? { type: "None", detail: "Customers who scan your QR code see \"No menu uploaded yet\". Add a menu to show them one.", name: "No menu uploaded", icon: <AlertCircle className="w-6 h-6 text-amber-500" /> }
      : savedMode === "tree"
      ? {
          type: "Menu tree",
          detail: `${savedTree?.children.length ?? 0} button${savedTree?.children.length === 1 ? "" : "s"} on the start screen`,
          name: "Buttons that lead to your menus",
          icon: <Network className="w-6 h-6 text-indigo-500" />,
        }
      : savedMode === "static" && livePages
        ? {
            type: livePages.kind === "pdf" ? "PDF menu" : "Photo menu",
            detail: [
              livePages.kind === "pdf" ? restaurant.menuPdfName || "PDF file" : `${livePages.urls.length} photo${livePages.urls.length === 1 ? "" : "s"}`,
              livePages.display === "scroll" ? "shown as a scrolling menu" : "shown as a flip book",
            ].join(" · "),
            name: liveMenu?.title ?? restaurant.menuPdfName ?? "Your menu",
            icon: livePages.kind === "pdf" ? <FileText className="w-6 h-6 text-blue-500" /> : <Images className="w-6 h-6 text-blue-500" />,
          }
        : savedMode === "dynamic"
          ? { type: "Old digital menu", detail: "Categories and items", name: "Digital menu", icon: <LayoutList className="w-6 h-6 text-gray-500" /> }
          : { type: "No menu yet", detail: "Customers see an empty page", name: "Add your first menu", icon: <AlertCircle className="w-6 h-6 text-amber-500" /> };

  return (
    <div className={`p-4 lg:p-6 space-y-6 ${changeCount > 0 ? "pb-28" : ""}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Menu Management</h1>
          <p className="text-gray-500 text-sm mt-1">See which menu customers see now, change it, or add another one</p>
        </div>
        <button type="button" onClick={() => setNewMenu({})}
          className="inline-flex items-center gap-2 text-sm sm:text-base font-semibold text-white px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/25 ring-1 ring-blue-500/20 transition-all hover:-translate-y-px">
          <Plus className="w-5 h-5" /> Add a new menu
        </button>
      </div>

      {/* The menu customers see right now */}
      <section aria-label="Current menu" data-no-menu={noMenu || undefined} className={`relative overflow-hidden rounded-2xl border-2 p-4 sm:p-5 ${noMenu ? "border-amber-200 bg-gradient-to-br from-amber-50 to-white" : "border-green-200 bg-gradient-to-br from-green-50 to-white"}`}>
        <div className="flex items-center gap-2 mb-3">
          {noMenu ? <span className="inline-flex w-2.5 h-2.5 rounded-full bg-amber-400" /> : (
            <span className="relative flex w-2.5 h-2.5">
              <span className="absolute inline-flex w-full h-full rounded-full bg-green-400 opacity-60 animate-ping" />
              <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-green-500" />
            </span>
          )}
          <span className={`text-xs font-bold uppercase tracking-wider ${noMenu ? "text-amber-700" : "text-green-700"}`}>Current menu</span>
          <span className="text-xs text-gray-500">· what customers see when they scan your QR code</span>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="w-16 h-20 shrink-0 rounded-xl overflow-hidden bg-white border border-gray-200 shadow-sm flex items-center justify-center">
            {savedMode === "static" && liveThumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={liveThumb} alt="" className="w-full h-full object-cover" />
            ) : savedMode === "tree" && savedTree?.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={savedTree.logo} alt="" className="w-full h-full object-contain p-1.5" />
            ) : current.icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-gray-500">Type</div>
            <div className="text-sm font-semibold text-gray-900">{current.type}</div>
            <div className="text-xs font-semibold text-gray-500 mt-1.5">{savedMode === "tree" && !noMenu ? "Content" : "Menu name"}</div>
            <div className="text-lg font-bold text-gray-900 truncate leading-tight">{current.name}</div>
            <div className="text-xs text-gray-500 mt-0.5">{current.detail}</div>
          </div>
          {restaurant.slug && !noMenu && (savedMode !== "static" || livePages) && (
            <a href={`/r/${restaurant.slug}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-700 bg-white border border-green-200 hover:border-green-300 hover:bg-green-50 rounded-xl px-3 py-2">
              <ExternalLink className="w-4 h-4" /> View it
            </a>
          )}
        </div>
        {runningSchedule && (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900">
            <CalendarClock className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              Right now customers see the scheduled menu &quot;{runningSchedule.title ?? "Menu"}&quot;
              {runningSchedule.endAt ? ` until ${formatDayTime(runningSchedule.endAt)}. After that, the menu above comes back.` : "."}
            </span>
          </div>
        )}
        {noMenu ? (
          <div className="mt-3 pt-3 border-t border-amber-100 text-xs text-gray-600">
            Upload a PDF or photos below, or{" "}
            <button type="button" onClick={() => setNewMenu({})} className="font-semibold text-blue-600 hover:text-blue-700 underline">add a new menu</button>.
          </div>
        ) : (
          <div className="mt-3 pt-3 border-t border-green-100 text-xs text-gray-600">
            Want customers to see something else? Change this menu below, or{" "}
            <button type="button" onClick={() => setNewMenu({})} className="font-semibold text-blue-600 hover:text-blue-700 underline">add a new menu</button>.
          </div>
        )}
      </section>

      <div className="pt-1">
        <h2 className="text-base font-bold text-gray-900">Change the current menu</h2>
        <p className="text-xs text-gray-500">Changes here go live when you press Save changes. To keep this menu and make a separate one, use Add a new menu.</p>
      </div>

      {/* Menu type toggle: this is what the QR code shows */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-sm font-semibold text-gray-900">Menu type</div>
            <div className="text-xs text-gray-500">What customers see when they scan your QR code</div>
          </div>
          {restaurant.slug && (
            <a href={`/r/${restaurant.slug}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700">
              <ExternalLink className="w-3.5 h-3.5" /> Open public menu
            </a>
          )}
        </div>
        <div role="radiogroup" aria-label="Menu type" className="grid grid-cols-1 sm:grid-cols-2 gap-1 p-1 bg-gray-100 rounded-xl">
          {([
            { value: "static", label: "PDF / Photos", hint: "One menu", icon: BookOpen },
            { value: "tree", label: "Menu tree", hint: "Several menus", icon: Network },
          ] as const).map(({ value, label, hint, icon: Icon }) => {
            const active = effectiveMode === value;
            return (
              <button key={value} type="button" role="radio" aria-checked={active}
                onClick={() => setMenuMode(value)} disabled={saving}
                className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all disabled:cursor-wait ${
                  active ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}>
                <Icon className="w-4 h-4 shrink-0" />
                <span>{label}</span>
                <span className="hidden md:inline text-xs font-normal text-gray-400">· {hint}</span>
              </button>
            );
          })}
        </div>
        {legacyDigital && !modeChanged && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-sm text-amber-800">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>Customers still see your old digital menu (categories and items). Save a PDF / photo menu or a menu tree to replace it.</span>
          </div>
        )}
        {modeChanged && (
          <div className="text-xs font-medium text-amber-700">
            Not saved yet. Customers still see the {modeName(savedMode)} menu until you press Save.
          </div>
        )}
        {(isBook || isTree) && (
          <div className="flex items-start gap-2 text-xs text-gray-500">
            <Palette className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-500" />
            <span>
              Menus you make in{" "}
              <Link href="/dashboard/design-menu" className="font-medium text-blue-600 hover:text-blue-700">Design your digital Menu</Link>{" "}
              are in the menu history below. {isTree ? "Pick them for a button in the tree." : "Click Make active on one, then Save changes, to make it your menu."}
            </span>
          </div>
        )}
        {isBook && !hasBook && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-sm text-amber-800">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>Nothing uploaded yet. Upload a PDF or photos below before you save, otherwise customers see an empty menu.</span>
          </div>
        )}
      </div>

      <ScheduledMenus restaurantId={restaurant.id} items={schedules.items} reload={async () => { await schedules.reload(); load(); }} treeLive={treeLive} />

      {isTree ? (
        <div className="space-y-5">
          <TreeGuide canStartNew={treeValue.children.length > 0 || !!treeValue.logo || !!treeValue.background} onStartNew={() => setStartNewTree(true)} />
          <MenuTreeEditor
            restaurantId={restaurant.id}
            restaurantName={restaurant.name}
            restaurantSlug={restaurant.slug}
            value={treeValue}
            onChange={(t) => setTreeDraft(t)}
            menus={history.data?.menus ?? null}
            onCreateMenu={(assign) => setNewMenu({ assign })}
            onStaged={(url) => { treeStagedRef.current.push(url); }}
          />
          <TreeHistory
            restaurantId={restaurant.id}
            restaurantName={restaurant.name}
            menuTitle={(id) => history.data?.menus.find((m) => m.menuId === id)?.title}
            archives={treeArchives.archives}
            reload={treeArchives.reload}
            onUse={(a) => {
              if (treeChanged && !window.confirm("Your unsaved changes to the menu tree will be replaced. Continue?")) return;
              setTreeDraft(structuredClone(a.tree));
              window.scrollTo({ top: 0, behavior: "smooth" });
              document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });
              toast(`"${a.name}" loaded. Press Save changes to show it to customers.`, { icon: "💾" });
            }}
          />
          <MenuHistory
            restaurantId={restaurant.id}
            history={history}
            liveMode={savedMode === "tree" ? "dynamic" : savedMode}
            draftMenuPdfUrl={bookValue.menuPdfUrl}
            onUseVersion={loadHistoryVersion}
            onActivated={() => { load(); }}
            onEditDirtyChange={setHistoryEditDirty}
            treeMode
            usedMenuIds={treeMenuIds(treeValue)}
            onNewMenu={() => setNewMenu({})}
            schedules={schedules.items}
            onSchedulesChanged={schedulesChanged}
            treeLive={treeLive}
          />
        </div>
      ) : isBook ? (
        <div className="space-y-5">
        <MenuBookEditor
          key={editorKey}
          restaurantId={restaurant.id}
          restaurantSlug={restaurant.slug}
          value={bookValue}
          onChange={(next) => setDraftBook(
            next.menuPdfUrl === savedBook.menuPdfUrl && (next.basedOn ?? null) === savedBook.basedOn && normTitle(next.title) === normTitle(savedBook.title)
              ? null
              : next,
          )}
          savedValue={savedBook}
          onStaged={(url) => { stagedUploadsRef.current.push(url); }}
          editingTitle={menuOf(bookValue.basedOn)?.title ?? null}
          defaultTitle={defaultTitle}
          activeChoice={bookFilesNew ? { value: bookMakeActive, onChange: setBookMakeActive } : undefined}
        />
        <MenuHistory
          restaurantId={restaurant.id}
          history={history}
          liveMode={savedMode === "tree" ? "dynamic" : savedMode}
          draftMenuPdfUrl={bookValue.menuPdfUrl}
          onUseVersion={loadHistoryVersion}
          onActivated={() => { load(); }}
          onEditDirtyChange={setHistoryEditDirty}
          onNewMenu={() => setNewMenu({})}
          schedules={schedules.items}
          onSchedulesChanged={schedulesChanged}
          treeLive={treeLive}
        />
        </div>
      ) : null}

      {startNewTree && (
        <StartNewTreeDialog
          onClose={() => setStartNewTree(false)}
          onConfirm={async (name, keepLook) => {
            if (savedTree?.children.length) {
              const r = await fetch(`/api/restaurants/${restaurant.id}/menu-tree`, {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "archive", name }),
              }).catch(() => null);
              if (!r?.ok) { toast.error("Could not keep the current tree in the history. Please try again."); return false; }
              await treeArchives.reload();
            }
            const base = emptyTree();
            setTreeDraft(keepLook ? { ...base, logo: treeValue.logo ?? null, background: treeValue.background ?? null, subtitle: treeValue.subtitle ?? "" } : base);
            toast.success(savedTree?.children.length ? `"${name}" is kept in the menu tree history. Start adding buttons.` : "Start adding buttons.");
            return true;
          }}
        />
      )}

      {newMenu && (
        <MenuEditModal
          restaurantId={restaurant.id}
          defaultTitle={defaultTitle}
          treeMode={isTree}
          treeLive={treeLive}
          menus={history.data?.menus}
          onDirtyChange={setHistoryEditDirty}
          onClose={() => setNewMenu(null)}
          onSaved={({ menuId, title, activated, scheduled, versionOf }) => {
            const assign = newMenu.assign;
            setNewMenu(null);
            history.reload();
            if (scheduled) {
              schedulesChanged();
              if (menuId && assign) assign(menuId);
              toast.success(`"${title}" saved and scheduled.`);
              return;
            }
            if (activated) { load(); toast.success(`"${title}" saved and active. Customers see it now.`); return; }
            if (menuId && assign) {
              assign(menuId);
              toast.success(`"${title}" saved and linked to the button. Press Save changes to publish the tree.`);
            } else {
              toast.success(versionOf ? `Saved as a new version of "${title}".` : `"${title}" saved in your menu history.`);
            }
          }}
        />
      )}

      {/* Save bar: shows up after any change */}
      {changeCount > 0 && (
        <div className="sticky bottom-4 z-30">
          <div className="mx-auto max-w-2xl flex items-center gap-3 rounded-2xl bg-gray-900 text-white px-4 py-3 shadow-2xl">
            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
            <span className="text-sm font-medium flex-1">
              {changeCount} unsaved change{changeCount === 1 ? "" : "s"}
            </span>
            <button onClick={discardChanges} disabled={saving}
              className="text-sm font-medium text-gray-300 hover:text-white px-3 py-2 rounded-xl hover:bg-white/10 transition-colors disabled:opacity-50">
              Discard
            </button>
            <button onClick={saveChanges} disabled={saving}
              className="flex items-center gap-2 text-sm font-semibold bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 px-4 py-2 rounded-xl transition-all disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
