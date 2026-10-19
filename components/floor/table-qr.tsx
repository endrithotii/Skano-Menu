"use client";

// Floor plan & tables > a table > "QR code for ordering": which Table ordering QR code belongs to this table.
// One table has one QR code, and one QR code belongs to one table (the server keeps it that way too).
// Shown only to people who may change the Table ordering settings.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Download, Loader2, QrCode, Plus, Link2, Unlink } from "lucide-react";
import toast from "react-hot-toast";
import { renderQr, type QrStyle } from "@/lib/qr-style";
import { roomQrStyle, roomTitle, type Room, type RoomServiceSettings } from "@/lib/room-service-types";
import type { FloorObject, FloorPlan } from "@/lib/floor-plan";

export interface TableQr {
  settings: RoomServiceSettings; baseStyle: QrStyle; slug: string;
  send: (body: Record<string, unknown>, ok: string) => Promise<boolean>;
  image: (room: Room, size: number) => Promise<string>;
}

export function useTableQr(restaurantId: string): TableQr | null {
  const [d, setD] = useState<{ settings: RoomServiceSettings; baseStyle: QrStyle; slug: string } | null>(null);
  useEffect(() => {
    void fetch(`/api/restaurants/${restaurantId}/table-service/manage?days=1`).then((r) => (r.ok ? r.json() : null)).then((x) => {
      if (x?.canManage) setD({ settings: x.settings, baseStyle: x.baseStyle, slug: x.slug });
    }).catch(() => {});
  }, [restaurantId]);
  const send = useCallback(async (body: Record<string, unknown>, ok: string) => {
    const res = await fetch(`/api/restaurants/${restaurantId}/table-service/manage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const x = await res?.json().catch(() => null);
    if (!res?.ok) { toast.error(x?.error || "Could not save. Please try again."); return false; }
    setD((v) => (v ? { ...v, settings: x.settings } : v));
    toast.success(ok);
    return true;
  }, [restaurantId]);
  const image = useCallback(async (room: Room, size: number) => {
    if (!d) return "";
    const s = d.settings;
    const r = roomQrStyle(s.qrStyle ?? d.baseStyle, s, room.name, "table");
    return renderQr(`${window.location.origin}/table/${encodeURIComponent(d.slug)}/${room.id}`, r.style, roomTitle(s.roomPrefix, room.name), size, { center: r.center });
  }, [d]);
  return d ? { ...d, send, image } : null;
}

const fileName = (s: string) => s.replace(/[^\w-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "table";

export function TableQrBox({ tq, table, plan }: { tq: TableQr; table: FloorObject; plan: FloorPlan }) {
  const rooms = tq.settings.rooms;
  // Which table of this plan has each QR code (a link to a table that isn't on the plan counts as free)
  const tables = plan.areas.flatMap((a) => a.objects).filter((o) => o.type === "table");
  const onTable = (r: Room) => (r.floorId ? tables.find((t) => t.id === r.floorId) ?? null : null);
  const mine = rooms.find((r) => r.floorId === table.id) ?? null;
  const label = (table.label ?? "").trim();
  const sameName = label ? rooms.find((r) => r.name.toLowerCase() === label.toLowerCase()) ?? null : null;
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const [changing, setChanging] = useState(false);
  const [img, setImg] = useState("");

  useEffect(() => {
    let stop = false;
    if (mine) void tq.image(mine, 240).then((x) => { if (!stop) setImg(x); });
    return () => { stop = true; };
  }, [mine, tq]);

  async function run(body: Record<string, unknown>, ok: string) {
    setBusy(true);
    const done = await tq.send({ ...body, floorId: table.id }, ok);
    setBusy(false);
    if (done) { setPick(""); setChanging(false); }
  }
  async function download(r: Room) {
    const a = document.createElement("a");
    a.href = await tq.image(r, 1024); a.download = `qr-table-${fileName(r.name)}.png`; a.click();
  }

  const chooser = (
    <div className="space-y-1.5">
      <label className="block">
        <span className="block text-[11px] font-semibold text-gray-500 mb-1">{mine ? "Give this table another QR code" : "Or pick a QR code you already made"}</span>
        <select id="table-qr-pick" value={pick} onChange={(e) => setPick(e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-2 bg-white">
          <option value="">Choose a QR code</option>
          {rooms.filter((r) => r.id !== mine?.id).map((r) => {
            const t = onTable(r);
            return <option key={r.id} value={r.id} disabled={!!t}>{roomTitle(tq.settings.roomPrefix, r.name)}{t ? ` (on table ${t.label || "without number"})` : ""}</option>;
          })}
        </select>
      </label>
      {pick && (
        <button type="button" disabled={busy} onClick={() => run({ action: "room-link", id: pick }, "QR code linked to this table")} data-go="qr-link"
          className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-white bg-gray-900 rounded-lg px-3 py-2 disabled:opacity-50">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />} Use this QR code for this table
        </button>
      )}
      <p className="text-[11px] text-gray-500">QR codes already on another table can&apos;t be picked. Take them off that table first.</p>
    </div>
  );

  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 space-y-2.5" data-table-qr>
      <div className="text-[11px] font-semibold text-indigo-800 flex items-center gap-1"><QrCode className="w-3.5 h-3.5" /> QR code for ordering</div>
      {mine ? (
        <>
          <div className="flex items-center gap-3">
            {img
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={img} alt={`QR code of ${mine.name}`} className="w-20 h-auto rounded-lg border border-white bg-white" />
              : <div className="w-20 aspect-square rounded-lg bg-white" />}
            <div className="min-w-0 text-sm">
              <div className="font-semibold text-gray-900" data-table-qr-name>{roomTitle(tq.settings.roomPrefix, mine.name)}</div>
              <div className="text-[11px] text-gray-600">Guests who scan it order for this table.</div>
              {label && mine.name.toLowerCase() !== label.toLowerCase() && <div className="text-[11px] text-amber-700 mt-0.5">The code says {mine.name}, the table says {label}.</div>}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => download(mine)} className="inline-flex items-center gap-1 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5"><Download className="w-3.5 h-3.5" /> Download</button>
            <button type="button" onClick={() => setChanging((v) => !v)} className="inline-flex items-center gap-1 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5" data-go="qr-change">Change</button>
            <button type="button" disabled={busy} onClick={() => run({ action: "room-link", id: null }, "QR code taken off this table")} className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-red-700 px-2 py-1.5" data-go="qr-unlink"><Unlink className="w-3.5 h-3.5" /> Take it off</button>
          </div>
          {changing && chooser}
        </>
      ) : !label ? (
        <p className="text-[11px] text-gray-600">Give the table a number first, then you can make its QR code.</p>
      ) : (
        <>
          {sameName && !onTable(sameName) ? (
            <button type="button" disabled={busy} onClick={() => run({ action: "room-link", id: sameName.id }, "QR code linked to this table")} data-go="qr-same"
              className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg px-3 py-2 disabled:opacity-50">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />} Use the QR code {roomTitle(tq.settings.roomPrefix, sameName.name)}
            </button>
          ) : !sameName ? (
            <button type="button" disabled={busy} onClick={() => run({ action: "room-link-new", name: label }, "QR code made for this table")} data-go="qr-new"
              className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg px-3 py-2 disabled:opacity-50">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Make a QR code {roomTitle(tq.settings.roomPrefix, label)}
            </button>
          ) : (
            <p className="text-[11px] text-amber-700">The QR code {sameName.name} is already on table {onTable(sameName)?.label || "without number"}.</p>
          )}
          {rooms.length > 0 && chooser}
        </>
      )}
      <p className="text-[11px] text-gray-500">This is saved as soon as you press the button, you don&apos;t need to save the floor plan for it. All codes are on <Link href="/dashboard/table-service?tab=qr" className="font-semibold underline">Table ordering</Link>.</p>
    </div>
  );
}
