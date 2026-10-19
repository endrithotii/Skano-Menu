"use client";

// Room service for hotels: Orders (live), QR codes & rooms, How guests order.

import { useCallback, useEffect, useState } from "react";
import { BedDouble, Loader2, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";
import type { QrStyle } from "@/lib/qr-style";
import type { OrderStatus, RoomOrder, RoomServiceSettings } from "@/lib/room-service-types";
import { OrdersTab } from "@/components/room-service/orders-tab";
import { QrTab, generalUrl } from "@/components/room-service/qr-tab";
import { GuestTab } from "@/components/room-service/guest-tab";

type Tab = "orders" | "qr" | "guests";
interface Data {
  canOrders: boolean; canManage: boolean; orders: RoomOrder[]; settings: RoomServiceSettings; baseStyle: QrStyle;
  name: string; slug: string; currency: string; dishCount: number;
}
const TABS: { key: Tab; label: string }[] = [{ key: "orders", label: "Orders" }, { key: "qr", label: "QR codes & rooms" }, { key: "guests", label: "How guests order" }];

export default function RoomServicePage() {
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("orders");
  const [days, setDays] = useState(3);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "qr" || t === "guests") void Promise.resolve().then(() => setTab(t));
    void fetch("/api/dashboard/access").then((r) => r.json()).then((a) => setRestaurantId(a?.restaurantId ?? null)).catch(() => setError("No connection to the server"));
  }, []);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    const res = await fetch(`/api/restaurants/${restaurantId}/room-service/manage?days=${days}`).catch(() => null);
    const d = await res?.json().catch(() => null);
    if (!res?.ok) { setError(d?.error || "Could not load room service"); return; }
    setError(""); setData(d); setNow(Date.now());
  }, [restaurantId, days]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  // New orders show up by themselves
  useEffect(() => {
    if (!data?.canOrders) return;
    const t = setInterval(() => { if (document.visibilityState === "visible") void load(); }, 15000);
    return () => clearInterval(t);
  }, [data?.canOrders, load]);

  const goTab = (t: Tab) => { setTab(t); try { history.replaceState(null, "", t === "orders" ? location.pathname : `?tab=${t}`); } catch { /* fine */ } };

  async function send(body: Record<string, unknown>, ok?: string): Promise<RoomServiceSettings | null> {
    const res = await fetch(`/api/restaurants/${restaurantId}/room-service/manage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const d = await res?.json().catch(() => null);
    if (!res?.ok) { toast.error(d?.error || "Could not save. Please try again."); return null; }
    if (d.settings) setData((x) => (x ? { ...x, settings: d.settings } : x));
    if (body.action === "rooms-add") toast.success(d.skipped ? `Added ${d.added} rooms. ${d.skipped} were already there.` : d.added === 1 ? "Room added" : `Added ${d.added} rooms`);
    else if (ok) toast.success(ok);
    return d.settings ?? null;
  }
  async function setStatus(o: RoomOrder, to: OrderStatus, reason?: string) {
    const res = await fetch(`/api/restaurants/${restaurantId}/room-service/manage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "status", id: o.id, status: to, reason }) }).catch(() => null);
    const d = await res?.json().catch(() => null);
    if (!res?.ok) { toast.error(d?.error || "Could not save. Please try again."); if (res?.status === 409) void load(); return false; }
    setData((x) => (x ? { ...x, orders: x.orders.map((y) => (y.id === o.id ? d.order : y)) } : x));
    return true;
  }

  if (error && !data) return <div className="p-4 sm:p-6"><div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">{error}</div></div>;
  if (!data) return <div className="p-6 flex items-center gap-2 text-gray-500"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>;

  const tabs = TABS.filter((t) => (t.key === "orders" ? data.canOrders : t.key === "guests" ? data.canManage : true));
  const shown = tabs.some((t) => t.key === tab) ? tab : tabs[0].key;
  const fresh = data.orders.filter((o) => o.status === "new").length;

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><BedDouble className="w-6 h-6 text-blue-600" aria-hidden /> Room service</h1>
          <p className="text-sm text-gray-500 mt-1">Hotel guests scan a QR code in their room and order food to their room.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${data.settings.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`} data-rs-state>{data.settings.enabled ? "On" : "Off"}</span>
          <a href={generalUrl(data.slug)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-700 border border-gray-200 rounded-xl px-3 py-2 hover:bg-gray-50"><ExternalLink className="w-4 h-4" /> See it as a guest</a>
        </div>
      </div>
      {!data.settings.enabled && data.canManage && shown !== "guests" && (
        <p className="text-sm rounded-xl bg-amber-50 border border-amber-100 text-amber-900 px-3 py-2">Room service is off, so guests can&apos;t order yet. <button type="button" onClick={() => goTab("guests")} className="font-semibold underline">Turn it on</button></p>
      )}
      <nav className="flex flex-wrap gap-x-1 border-b border-gray-200" aria-label="Room service sections">
        {tabs.map((t) => (
          <button key={t.key} type="button" onClick={() => goTab(t.key)} aria-current={shown === t.key ? "page" : undefined} data-tab={t.key}
            className={`shrink-0 px-3.5 py-2.5 text-sm font-semibold border-b-2 -mb-px ${shown === t.key ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-800"}`}>
            {t.label}{t.key === "orders" && fresh > 0 && <span className="ml-1.5 text-[11px] font-bold rounded-full px-1.5 bg-red-500 text-white">{fresh}</span>}
          </button>
        ))}
      </nav>
      {shown === "orders" && <OrdersTab orders={data.orders} currency={data.currency} days={days} setDays={setDays} setStatus={setStatus} now={now} />}
      {shown === "qr" && <QrTab data={data} send={send} hotel={data.name} />}
      {shown === "guests" && <GuestTab key={JSON.stringify([data.settings.mode, data.settings.steps, data.settings.welcome, data.settings.askName])} settings={data.settings} dishCount={data.dishCount} send={send} />}
    </div>
  );
}
