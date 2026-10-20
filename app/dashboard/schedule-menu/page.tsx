"use client";

// "Schedule menu": add a schedule for any saved menu, see what is scheduled and the schedules that are over.

import { useEffect, useState } from "react";
import { CalendarClock, Plus } from "lucide-react";
import Link from "next/link";
import { useMenuHistory } from "@/components/dashboard/menu-history";
import { ScheduleDialog, ScheduleHistory, ScheduledMenus, useSchedules, type ScheduleItem } from "@/components/dashboard/menu-schedule";

interface Restaurant { id: string; primaryMenu: string; menuPdfUrl: string | null }

export default function ScheduleMenuPage() {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);
  // null = closed, "new" = pick a menu, or schedule this menu again
  const [dialog, setDialog] = useState<"new" | ScheduleItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/stats")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("stats"))))
      .then((s) => {
        if (!cancelled) setRestaurant({ id: s.restaurantId, primaryMenu: s.restaurant?.primaryMenu ?? "dynamic", menuPdfUrl: s.restaurant?.menuPdfUrl ?? null });
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [tick]);
  const reloadLive = () => setTick((t) => t + 1);

  const rid = restaurant?.id;
  const treeLive = restaurant?.primaryMenu === "tree";
  const history = useMenuHistory(rid, [restaurant?.menuPdfUrl ?? null, restaurant?.primaryMenu ?? null]);
  const schedules = useSchedules(rid, reloadLive);
  const reload = async () => { await schedules.reload(); reloadLive(); };
  const menus = (history.data?.menus ?? []).map((m) => ({ menuId: m.menuId, title: m.title }));

  if (failed) return <div className="p-6 text-sm text-gray-500">Could not load your schedules. Please refresh the page.</div>;
  if (!restaurant) {
    return <div className="p-6 flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><CalendarClock className="w-6 h-6 text-blue-600" /> Schedule menu</h1>
          <p className="text-gray-500 text-sm mt-1">Choose when a menu is shown to customers. With an end time, the menu that was active before comes back automatically.</p>
        </div>
        <button data-tour="schedule-add" type="button" onClick={() => setDialog("new")}
          className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl text-white bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 shadow-sm">
          <Plus className="w-4 h-4" /> Add schedule
        </button>
      </div>

      {history.data && !menus.length && (
        <div className="text-sm text-gray-600 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          You have no saved menus yet. Add one in <Link href="/dashboard/all-menus" className="font-semibold text-blue-600 underline">All menus</Link>, then come back to schedule it.
        </div>
      )}

      <ScheduledMenus restaurantId={restaurant.id} items={schedules.items} reload={reload} treeLive={treeLive} showEmpty />
      <ScheduleHistory items={schedules.items} onScheduleAgain={(s) => setDialog(s)} />

      {dialog && (
        <ScheduleDialog
          key={dialog === "new" ? "new" : dialog.id}
          restaurantId={restaurant.id}
          {...(dialog === "new" ? { menus } : { menuId: dialog.menuId, menuTitle: dialog.title ?? "Menu" })}
          treeLive={treeLive}
          onClose={() => setDialog(null)}
          onSaved={() => { reload(); }}
        />
      )}
    </div>
  );
}
