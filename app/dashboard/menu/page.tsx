"use client";

import React, { useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, BookOpen, Palette, ExternalLink, Save, Network } from "lucide-react";
import toast from "react-hot-toast";
import { DesignEditor } from "@/components/design/design-editor";
import { exportDesignPages } from "@/components/design/export-pages";
import { designImageUrls, type MenuDesign } from "@/lib/menu-design-types";
import { MenuBookEditor } from "@/components/dashboard/menu-book-editor";
import { MenuEditModal, MenuHistory, useMenuHistory, type MenuGroup, type MenuVersion } from "@/components/dashboard/menu-history";
import { MenuTreeEditor } from "@/components/dashboard/menu-tree-editor";
import { emptyTree, treeImageUrls, treeMenuIds, type MenuTree } from "@/lib/menu-tree-types";
import type { MenuState as BookDraft } from "@/components/dashboard/menu-book-editor";
import { defaultMenuName } from "@/lib/format-date";
import { allMenuFileUrls, parseMenuPages } from "@/lib/menu-pages";
import { useUnsavedChanges } from "@/lib/navigation-guard";

/** "dynamic" = digital menu (designer), "static" = one PDF / photo book, "tree" = buttons leading to several books */
type MenuMode = "dynamic" | "static" | "tree";

interface Restaurant {
  id: string;
  name: string;
  slug: string | null;
  /** "dynamic" = menu built in the designer, "static" = PDF / photos book, "tree" = menu tree */
  primaryMenu: MenuMode;
  menuPdfUrl: string | null;
  menuPdfName: string | null;
}

/** The page pictures are made again on every save, so they don't count as a change */
function withoutPictures(d: MenuDesign): MenuDesign {
  const { pageImages: _pictures, ...rest } = d;
  void _pictures;
  return rest;
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
  // "New menu" pop-up; `assign` links the new menu to a tree button
  const [newMenu, setNewMenu] = useState<{ assign?: (menuId: string) => void } | null>(null);
  const [draftBook, setDraftBook] = useState<BookDraft | null>(null);
  // Designed menu (Digital menu): saved version (undefined while loading) and the unsaved draft
  const [savedDesign, setSavedDesign] = useState<MenuDesign | null | undefined>(undefined);
  const [designDraft, setDesignDraft] = useState<MenuDesign | null>(null);
  const designStagedRef = useRef<string[]>([]);
  const [designKey, setDesignKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savingNote, setSavingNote] = useState<string | null>(null);
  // Files uploaded for the book but not saved yet (deleted again on Discard)
  const stagedUploadsRef = useRef<string[]>([]);

  const savedMode = restaurant?.primaryMenu ?? "dynamic";
  const effectiveMode = draftMode ?? savedMode;
  // Named menus with their versions (PDF / photo books)
  const history = useMenuHistory(restaurant?.id, [restaurant?.menuPdfUrl ?? null, savedMode]);
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
  const bookChanged = draftBook !== null && (draftBook.menuPdfUrl !== savedBook.menuPdfUrl || titleChanged(draftBook));
  const treeValue: MenuTree = treeDraft ?? savedTree ?? emptyTree();
  const treeChanged = treeDraft !== null && JSON.stringify(treeDraft) !== JSON.stringify(savedTree ?? emptyTree());
  const designValue: MenuDesign | null = designDraft ?? savedDesign ?? null;
  const designChanged = designDraft !== null && JSON.stringify(withoutPictures(designDraft)) !== JSON.stringify(savedDesign ? withoutPictures(savedDesign) : null);
  const changeCount = (modeChanged ? 1 : 0) + (bookChanged ? 1 : 0) + (treeChanged ? 1 : 0) + (designChanged ? 1 : 0);
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

  // Load the saved design (Digital menu)
  useEffect(() => {
    if (!restaurant?.id) return;
    let cancelled = false;
    fetch(`/api/restaurants/${restaurant.id}/menu-design`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setSavedDesign(d?.design ?? null); })
      .catch(() => { if (!cancelled) setSavedDesign(null); });
    return () => { cancelled = true; };
  }, [restaurant?.id]);

  /** Deletes photos uploaded in the designer that ended up unused */
  function discardDesignUploads(keep: string[]) {
    if (!restaurant) return;
    for (const url of designStagedRef.current) {
      if (keep.includes(url)) continue;
      fetch(`/api/restaurants/${restaurant.id}/upload-menu?staged=${encodeURIComponent(url)}`, { method: "DELETE" }).catch(() => {});
    }
    designStagedRef.current = [];
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
    discardDesignUploads(savedDesign ? designImageUrls(savedDesign) : []);
    setDesignDraft(null);
    setDesignKey((k) => k + 1);
    setDraftMode(null);
    setDraftBook(null);
  }

  async function saveChanges() {
    if (!restaurant || saving || changeCount === 0) return;
    setSaving(true);
    const rid = restaurant.id;
    const failed: string[] = [];
    const json = { "Content-Type": "application/json" };

    // 1. Uploaded menu (PDF / photos)
    if (bookChanged && draftBook) {
      const res = await fetch(`/api/restaurants/${rid}/upload-menu`, {
        method: "PUT", headers: json,
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
        history.reload();
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
        setTreeDraft(null);
        discardTreeUploads(treeImageUrls(saved));
        treeOk = true;
      } else {
        const d = await res?.json().catch(() => null);
        failed.push(d?.error ? `menu tree: ${d.error}` : "menu tree");
      }
    }

    // 1c. Designed menu (book mode also gets a picture of every page for the flip book)
    if (designChanged && designDraft) {
      let toSave = withoutPictures(designDraft);
      let pictures: string[] = [];
      if (toSave.display === "book" && toSave.pages.length) {
        try {
          setSavingNote("Preparing the book pages…");
          pictures = await exportDesignPages(toSave, rid, (done, total) => setSavingNote(`Preparing the book pages (${done}/${total})…`));
          toSave = { ...toSave, pageImages: pictures };
        } catch (err) {
          console.error("Page export failed", err);
          toast.error("Could not prepare the book pages. Customers see your menu as a scrolling menu until you save again.");
        }
        setSavingNote(null);
      }
      const res = await fetch(`/api/restaurants/${rid}/menu-design`, {
        method: "PUT", headers: json, body: JSON.stringify({ design: toSave }),
      }).catch(() => null);
      if (res?.ok) {
        const d = await res.json();
        const saved: MenuDesign = d.design ?? toSave;
        const keep = designImageUrls(saved);
        // Old page pictures are replaced by the new ones
        for (const url of savedDesign?.pageImages ?? []) {
          if (!keep.includes(url)) fetch(`/api/restaurants/${rid}/upload-menu?staged=${encodeURIComponent(url)}`, { method: "DELETE" }).catch(() => {});
        }
        discardDesignUploads(keep);
        setSavedDesign(saved);
        setDesignDraft(null);
      } else {
        for (const url of pictures) fetch(`/api/restaurants/${rid}/upload-menu?staged=${encodeURIComponent(url)}`, { method: "DELETE" }).catch(() => {});
        const d = await res?.json().catch(() => null);
        failed.push(d?.error ? `menu design: ${d.error}` : "menu design");
      }
    }

    // 2. Menu type (what the QR code shows)
    const treeReady = (treeOk ? (treeDraft ?? savedTree) : savedTree)?.children.length;
    if (modeChanged && draftMode === "tree" && (!treeOk || !treeReady)) {
      failed.push("menu type (finish the menu tree first, customers keep seeing the current menu)");
    } else if (modeChanged && draftMode) {
      const res = await fetch(`/api/restaurants/${rid}`, {
        method: "PUT", headers: json, body: JSON.stringify({ primaryMenu: draftMode }),
      }).catch(() => null);
      if (res?.ok) setDraftMode(null);
      else failed.push("menu type");
    }

    await load();
    setSaving(false);
    setSavingNote(null);

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

  return (
    <div className={`p-4 lg:p-6 space-y-6 ${changeCount > 0 ? "pb-28" : ""}`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Menu Management</h1>
          <p className="text-gray-500 text-sm mt-1">
            {isBook
              ? "Your menu is a PDF or photos that customers flip through like a book"
              : isTree
              ? "Customers pick from your buttons, then flip through the menu they chose"
              : "Design your menu yourself: drag elements onto the pages, style them, and save"}
          </p>
        </div>
      </div>

      {/* Menu type toggle      </div>

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
        <div role="radiogroup" aria-label="Menu type" className="grid grid-cols-1 sm:grid-cols-3 gap-1 p-1 bg-gray-100 rounded-xl">
          {([
            { value: "dynamic", label: "Digital menu", hint: "Design it yourself", icon: Palette },
            { value: "static", label: "PDF / Photos", hint: "One flip-book", icon: BookOpen },
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
        {modeChanged && (
          <div className="text-xs font-medium text-amber-700">
            Not saved yet. Customers still see the {modeName(savedMode)} menu until you press Save.
          </div>
        )}
        {isBook && !hasBook && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-sm text-amber-800">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>Nothing uploaded yet. Upload a PDF or photos below before you save, otherwise customers see an empty menu.</span>
          </div>
        )}
      </div>

      {isTree ? (
        <div className="space-y-5">
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
          <MenuHistory
            restaurantId={restaurant.id}
            history={history}
            liveMode={savedMode === "tree" ? "dynamic" : savedMode}
            draftMenuPdfUrl={bookValue.menuPdfUrl}
            onUseVersion={loadHistoryVersion}
            onEditDirtyChange={setHistoryEditDirty}
            treeMode
            usedMenuIds={treeMenuIds(treeValue)}
            onNewMenu={() => setNewMenu({})}
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
        />
        <MenuHistory
          restaurantId={restaurant.id}
          history={history}
          liveMode={savedMode === "tree" ? "dynamic" : savedMode}
          draftMenuPdfUrl={bookValue.menuPdfUrl}
          onUseVersion={loadHistoryVersion}
          onEditDirtyChange={setHistoryEditDirty}
          onNewMenu={() => setNewMenu({})}
        />
        </div>
      ) : savedDesign === undefined ? (
        <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
      ) : (
        <DesignEditor
          key={designKey}
          restaurantId={restaurant.id}
          restaurantName={restaurant.name}
          value={designValue}
          onChange={(d) => setDesignDraft(d)}
          onStaged={(url) => { designStagedRef.current.push(url); }}
        />
      )}

      {newMenu && (
        <MenuEditModal
          restaurantId={restaurant.id}
          defaultTitle={defaultTitle}
          treeMode={isTree}
          onDirtyChange={setHistoryEditDirty}
          onClose={() => setNewMenu(null)}
          onSaved={({ menuId, title }) => {
            const assign = newMenu.assign;
            setNewMenu(null);
            history.reload();
            if (menuId && assign) {
              assign(menuId);
              toast.success(`"${title}" saved and linked to the button. Press Save changes to publish the tree.`);
            } else {
              toast.success(`"${title}" saved in your menu history.`);
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
              {savingNote ?? `${changeCount} unsaved change${changeCount === 1 ? "" : "s"}`}
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
