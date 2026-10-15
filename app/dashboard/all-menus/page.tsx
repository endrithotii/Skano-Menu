"use client";

// "All menus": every saved PDF / photo menu of the restaurant, the same list as the Menu history on the Menu page.
// Here "Make active" makes a menu live right away (there is no Save bar on this page).

import { useEffect, useState } from "react";
import { BookCopy } from "lucide-react";
import toast from "react-hot-toast";
import { MenuEditModal, MenuHistory, useMenuHistory, type MenuGroup, type MenuVersion } from "@/components/dashboard/menu-history";
import { ScheduledMenus, useSchedules } from "@/components/dashboard/menu-schedule";
import { defaultMenuName } from "@/lib/format-date";
import { treeMenuIds } from "@/lib/menu-tree-types";
import { useUnsavedChanges } from "@/lib/navigation-guard";

interface Restaurant {
  id: string;
  name: string;
  primaryMenu: string;
  menuPdfUrl: string | null;
}

export default function AllMenusPage() {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);
  const [usedMenuIds, setUsedMenuIds] = useState<string[]>([]);
  const [newMenu, setNewMenu] = useState(false);
  const [editDirty, setEditDirty] = useState(false);

  useUnsavedChanges(editDirty, "You are editing a menu that isn't saved yet. Leave without saving?");

  // The restaurant and what customers see right now
  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/stats")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("stats"))))
      .then((s) => {
        if (cancelled) return;
        setRestaurant({
          id: s.restaurantId,
          name: s.restaurant?.name ?? "",
          primaryMenu: s.restaurant?.primaryMenu ?? "dynamic",
          menuPdfUrl: s.restaurant?.menuPdfUrl ?? null,
        });
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [tick]);
  const reloadLive = () => setTick((t) => t + 1);

  // Menus used in the menu tree can't be deleted
  const rid = restaurant?.id;
  useEffect(() => {
    if (!rid) return;
    let cancelled = false;
    fetch(`/api/restaurants/${rid}/menu-tree`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d?.tree) setUsedMenuIds(treeMenuIds(d.tree)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [rid]);

  const savedMode = restaurant?.primaryMenu ?? "dynamic";
  const treeLive = savedMode === "tree";
  const history = useMenuHistory(rid, [restaurant?.menuPdfUrl ?? null, savedMode]);
  const schedules = useSchedules(rid, reloadLive);
  const schedulesChanged = () => { schedules.reload().then(reloadLive); };

  async function makeActive(menu: MenuGroup, v: MenuVersion) {
    if (!restaurant) return;
    const which = menu.versions.length > 1 ? ` (version ${v.number})` : "";
    const instead = treeLive ? " It replaces your menu tree." : "";
    if (!window.confirm(`Make "${menu.title}"${which} the menu customers see?${instead}`)) return;
    const json = { "Content-Type": "application/json" };
    // Same files as the saved version, so this only makes it live (no extra version)
    const live = await fetch(`/api/restaurants/${restaurant.id}/upload-menu`, {
      method: "PUT", headers: json,
      body: JSON.stringify({ menuPdfUrl: v.menuPdfUrl, menuPdfName: v.menuPdfName ?? v.files, title: menu.title, basedOn: v.menuPdfUrl }),
    }).catch(() => null);
    const mode = live?.ok
      ? await fetch(`/api/restaurants/${restaurant.id}`, { method: "PUT", headers: json, body: JSON.stringify({ primaryMenu: "static" }) }).catch(() => null)
      : null;
    if (!mode?.ok) { toast.error("Could not make it active. Please try again."); return; }
    toast.success(`"${menu.title}" is active. Customers see it now.`);
    reloadLive();
  }

  if (failed) return <div className="p-6 text-sm text-gray-500">Could not load your menus. Please refresh the page.</div>;
  if (!restaurant) {
    return <div className="p-6 flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><BookCopy className="w-6 h-6 text-blue-600" /> All menus</h1>
        <p className="text-gray-500 text-sm mt-1">Every menu of {restaurant.name || "your restaurant"}, uploaded or designed, with all its versions</p>
      </div>

      <ScheduledMenus restaurantId={restaurant.id} items={schedules.items} reload={async () => { await schedules.reload(); reloadLive(); }} treeLive={treeLive} />

      <MenuHistory
        restaurantId={restaurant.id}
        history={history}
        title="All menus"
        description={treeLive
          ? "Customers see your menu tree right now. Make active on a menu replaces the tree with that menu."
          : "Make active shows a menu to customers right away. Edit adds a new version."}
        liveMode={savedMode === "static" ? "static" : "dynamic"}
        // Nothing is drafted here: when a tree is shown, the last PDF / photo menu can be made active again
        draftMenuPdfUrl={savedMode === "static" ? restaurant.menuPdfUrl : null}
        onUseVersion={makeActive}
        onActivated={reloadLive}
        onEditDirtyChange={setEditDirty}
        usedMenuIds={usedMenuIds}
        onNewMenu={() => setNewMenu(true)}
        schedules={schedules.items}
        onSchedulesChanged={schedulesChanged}
        treeLive={treeLive}
      />

      {newMenu && (
        <MenuEditModal
          restaurantId={restaurant.id}
          defaultTitle={defaultMenuName(restaurant.name)}
          treeLive={treeLive}
          onDirtyChange={setEditDirty}
          onClose={() => setNewMenu(false)}
          onSaved={({ title, activated, scheduled }) => {
            setNewMenu(false);
            history.reload();
            if (scheduled) { schedulesChanged(); toast.success(`"${title}" saved and scheduled.`); return; }
            if (activated) { reloadLive(); toast.success(`"${title}" saved and active. Customers see it now.`); return; }
            toast.success(`"${title}" saved.`);
          }}
        />
      )}
    </div>
  );
}
