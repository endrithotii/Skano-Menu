"use client";

// Room service > QR codes: one code for all rooms (the guest writes the room or their name), and one code per room
// (the room is already known). The style comes from QR Codes, or its own, with the room number in the middle and / or under it.

import { useEffect, useMemo, useState } from "react";
import { Download, Copy, Plus, Trash2, Pencil, Check, X, Loader2, FileDown, BedDouble, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";
import { renderQr, type QrStyle } from "@/lib/qr-style";
import { roomQrStyle, roomTitle, type Room, type RoomLabel, type RoomServiceSettings } from "@/lib/room-service-types";
import { StylePanel } from "@/components/qr-style-panel";

export interface RsData { settings: RoomServiceSettings; baseStyle: QrStyle; slug: string; canManage: boolean }
type Send = (body: Record<string, unknown>, ok?: string) => Promise<RoomServiceSettings | null>;

const card = "bg-white rounded-2xl border border-gray-100 shadow-sm";
const origin = () => (typeof window === "undefined" ? "" : window.location.origin);
export const generalUrl = (slug: string) => `${origin()}/room/${encodeURIComponent(slug)}`;
export const roomUrl = (slug: string, room: Room) => `${origin()}/room/${encodeURIComponent(slug)}/${room.id}`;

function download(dataUrl: string, name: string) {
  const a = document.createElement("a"); a.href = dataUrl; a.download = name; a.click();
}
const fileName = (s: string) => s.replace(/[^\w-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "room";

/** "101-120" -> ["101", ..., "120"], "1-5" with prefix -> numbers; anything else: one name per line or comma */
export function parseRooms(from: string, to: string): string[] {
  const a = Number(from), b = Number(to);
  if (/^\d+$/.test(from.trim()) && /^\d+$/.test(to.trim()) && b >= a && b - a < 500) {
    const width = from.trim().length > String(a).length ? from.trim().length : 0;
    return Array.from({ length: b - a + 1 }, (_, i) => String(a + i).padStart(width, "0"));
  }
  return [];
}

async function allRoomsPdf(rooms: Room[], render: (room: Room | null, size: number) => Promise<string>, hotel: string) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  // A4, 2 columns x 3 rows, with a cut line around each code
  const W = 595.28, H = 841.89, cols = 2, rows = 3, mx = 36, my = 40;
  const cw = (W - mx * 2) / cols, ch = (H - my * 2) / rows;
  const list: (Room | null)[] = [null, ...rooms];
  for (let i = 0; i < list.length; i++) {
    if (i % (cols * rows) === 0) pdf.addPage([W, H]);
    const page = pdf.getPages()[pdf.getPageCount() - 1];
    const k = i % (cols * rows), c = k % cols, r = Math.floor(k / cols);
    const x = mx + c * cw, y = H - my - (r + 1) * ch;
    page.drawRectangle({ x: x + 6, y: y + 6, width: cw - 12, height: ch - 12, borderColor: rgb(0.85, 0.85, 0.85), borderWidth: 0.6, borderDashArray: [3, 3] });
    const png = await pdf.embedPng(await render(list[i], 700));
    const max = Math.min(cw - 50, ch - 64);
    const scale = Math.min(max / png.width, max / png.height);
    const w = png.width * scale, h = png.height * scale;
    page.drawImage(png, { x: x + (cw - w) / 2, y: y + 36 + (ch - 48 - h) / 2, width: w, height: h });
    const title = list[i] ? list[i]!.name : "All rooms";
    const sub = list[i] ? `${hotel} · Room service` : `${hotel} · Guests write their room`;
    page.drawText(title, { x: x + (cw - bold.widthOfTextAtSize(title, 13)) / 2, y: y + 22, size: 13, font: bold, color: rgb(0.07, 0.09, 0.15) });
    page.drawText(sub, { x: x + (cw - font.widthOfTextAtSize(sub, 8)) / 2, y: y + 11, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
  }
  const bytes = await pdf.save();
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  download(url, "room-service-qr-codes.pdf");
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function QrTab({ data, send, hotel }: { data: RsData; send: Send; hotel: string }) {
  const s = data.settings;
  const saved = s.qrStyle ?? data.baseStyle;
  const [style, setStyle] = useState<QrStyle>(saved);
  const [label, setLabel] = useState<RoomLabel>(s.roomLabel);
  const [prefix, setPrefix] = useState(s.roomPrefix);
  const [own, setOwn] = useState(!!s.qrStyle);
  const [saving, setSaving] = useState(false);
  const [images, setImages] = useState<Record<string, string>>({});
  const [from, setFrom] = useState(""); const [to, setTo] = useState(""); const [one, setOne] = useState("");
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [q, setQ] = useState("");

  const look = useMemo(() => ({ roomLabel: label, roomPrefix: prefix }), [label, prefix]);
  const render = useMemo(() => async (room: Room | null, size: number) => {
    const r = roomQrStyle(style, look, room ? room.name : null);
    return renderQr(room ? roomUrl(data.slug, room) : generalUrl(data.slug), r.style, room ? roomTitle(prefix, room.name) : "Room service", size, { center: r.center });
  }, [style, look, data.slug, prefix]);

  // Pictures for the general code and the first rooms (the rest are drawn when downloaded)
  const shown = s.rooms.filter((r) => !q.trim() || r.name.toLowerCase().includes(q.trim().toLowerCase()));
  useEffect(() => {
    let stop = false;
    const first = shown.slice(0, 60);
    void (async () => {
      const out: Record<string, string> = { all: await render(null, 360) };
      for (const r of first) out[r.id] = await render(r, 300);
      if (!stop) setImages(out);
    })();
    return () => { stop = true; };
  }, [render, shown.map((r) => r.id + r.name).join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = own !== !!s.qrStyle || (own && JSON.stringify(style) !== JSON.stringify(s.qrStyle)) || label !== s.roomLabel || prefix !== s.roomPrefix;
  async function saveLook() {
    setSaving(true);
    await send({ action: "settings", settings: { qrStyle: own ? style : null, roomLabel: label, roomPrefix: prefix } }, "QR style saved");
    setSaving(false);
  }
  async function addRooms(names: string[]) {
    if (!names.length) { toast.error("Write a room, or a first and last room number"); return; }
    setAdding(true);
    const next = await send({ action: "rooms-add", names });
    setAdding(false);
    if (next) { setFrom(""); setTo(""); setOne(""); }
  }
  async function downloadOne(room: Room | null) {
    const img = await render(room, 1024);
    download(img, room ? `qr-${fileName(room.name)}.png` : "qr-room-service-all-rooms.png");
  }

  return (
    <div className="space-y-6">
      <section className={`${card} p-5 flex flex-col sm:flex-row gap-5 items-center`} aria-label="QR code for all rooms" data-general-qr>
        {images.all
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={images.all} alt="QR code for all rooms" className="w-44 h-auto rounded-xl border border-gray-100" />
          : <div className="w-44 aspect-square rounded-xl bg-gray-100 animate-pulse" />}
        <div className="flex-1 min-w-0 space-y-2 text-center sm:text-left">
          <h2 className="font-semibold text-gray-900">One QR code for all rooms</h2>
          <p className="text-sm text-gray-600">Put it in every room, at the reception or in the elevator. The guest writes their room number, or their name and surname.</p>
          <p className="text-xs text-gray-500 break-all">{generalUrl(data.slug)}</p>
          <div className="flex flex-wrap gap-2 justify-center sm:justify-start pt-1">
            <button type="button" onClick={() => downloadOne(null)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-gray-900 hover:bg-black rounded-xl px-4 py-2.5" data-go="download-all-rooms"><Download className="w-4 h-4" /> Download</button>
            <button type="button" onClick={() => { void navigator.clipboard.writeText(generalUrl(data.slug)); toast.success("Link copied"); }} className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-700 border border-gray-200 rounded-xl px-4 py-2.5 hover:bg-gray-50"><Copy className="w-4 h-4" /> Copy link</button>
            <a href={generalUrl(data.slug)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-700 border border-gray-200 rounded-xl px-4 py-2.5 hover:bg-gray-50"><ExternalLink className="w-4 h-4" /> Open</a>
          </div>
        </div>
      </section>

      <section className={`${card} p-5 space-y-4`} aria-label="Rooms">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-semibold text-gray-900 flex items-center gap-2"><BedDouble className="w-4 h-4 text-blue-600" aria-hidden /> A QR code for each room ({s.rooms.length})</h2>
            <p className="text-sm text-gray-600 mt-0.5">Each code already knows its room, so the guest doesn&apos;t have to write it.</p>
          </div>
          {s.rooms.length > 0 && (
            <button type="button" disabled={pdfBusy} onClick={async () => { setPdfBusy(true); try { await allRoomsPdf(s.rooms, render, hotel); toast.success("PDF ready"); } catch (e) { console.error(e); toast.error("Could not make the PDF"); } setPdfBusy(false); }}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl px-4 py-2.5 disabled:opacity-50" data-go="pdf">
              {pdfBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} Download all as PDF to print
            </button>
          )}
        </div>
        {data.canManage && (
          <div className="grid lg:grid-cols-2 gap-3">
            <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3 space-y-2">
              <p className="text-sm font-semibold text-gray-800">Add many rooms at once</p>
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-xs text-gray-600">First room<input value={from} onChange={(e) => setFrom(e.target.value)} inputMode="numeric" placeholder="101" id="rooms-from" className="block mt-0.5 w-24 text-sm border border-gray-200 rounded-lg px-2.5 py-2 bg-white" /></label>
                <label className="text-xs text-gray-600">Last room<input value={to} onChange={(e) => setTo(e.target.value)} inputMode="numeric" placeholder="120" id="rooms-to" className="block mt-0.5 w-24 text-sm border border-gray-200 rounded-lg px-2.5 py-2 bg-white" /></label>
                <button type="button" disabled={adding} onClick={() => addRooms(parseRooms(from, to))} className="inline-flex items-center gap-1 text-sm font-semibold text-white bg-gray-900 rounded-lg px-3 py-2 disabled:opacity-50" data-go="add-range">
                  {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add {parseRooms(from, to).length || ""} rooms
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3 space-y-2">
              <p className="text-sm font-semibold text-gray-800">Add one room</p>
              <div className="flex gap-2">
                <label className="sr-only" htmlFor="room-one">Room number or name</label>
                <input id="room-one" value={one} onChange={(e) => setOne(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void addRooms(one.split(",").map((x) => x.trim()).filter(Boolean)); }}
                  placeholder="For example: 305, or Suite Panorama" className="flex-1 text-sm border border-gray-200 rounded-lg px-2.5 py-2 bg-white" />
                <button type="button" disabled={adding} onClick={() => addRooms(one.split(",").map((x) => x.trim()).filter(Boolean))} className="inline-flex items-center gap-1 text-sm font-semibold text-white bg-gray-900 rounded-lg px-3 py-2 disabled:opacity-50" data-go="add-one"><Plus className="w-4 h-4" /> Add</button>
              </div>
            </div>
          </div>
        )}
        {s.rooms.length === 0 ? <p className="text-sm text-gray-500">No rooms yet. Add them above, then download their QR codes.</p> : (
          <>
            {s.rooms.length > 12 && (
              <div><label htmlFor="room-q" className="sr-only">Find a room</label>
                <input id="room-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a room" className="w-full sm:max-w-xs text-sm border border-gray-200 rounded-xl px-3 py-2" /></div>
            )}
            <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" data-rooms>
              {shown.map((r) => (
                <li key={r.id} className="rounded-xl border border-gray-100 p-2.5 flex flex-col items-center gap-2" data-room={r.name}>
                  {images[r.id]
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={images[r.id]} alt={`QR code for ${r.name}`} className="w-full h-auto rounded-lg" />
                    : <div className="w-full aspect-square rounded-lg bg-gray-100" />}
                  {renaming?.id === r.id ? (
                    <div className="flex items-center gap-1 w-full">
                      <label className="sr-only" htmlFor={`rn-${r.id}`}>New name</label>
                      <input id={`rn-${r.id}`} value={renaming.name} autoFocus maxLength={30} onChange={(e) => setRenaming({ ...renaming, name: e.target.value })} className="min-w-0 flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1" />
                      <button type="button" aria-label="Save" onClick={async () => { if (await send({ action: "room-rename", id: r.id, name: renaming.name }, "Renamed")) setRenaming(null); }} className="p-1 text-green-700"><Check className="w-4 h-4" /></button>
                      <button type="button" aria-label="Cancel" onClick={() => setRenaming(null)} className="p-1 text-gray-500"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 w-full">
                      <span className="flex-1 min-w-0 truncate text-sm font-semibold text-gray-900" title={r.name}>{r.name}</span>
                      <button type="button" onClick={() => downloadOne(r)} aria-label={`Download the QR code of ${r.name}`} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"><Download className="w-4 h-4" /></button>
                      {data.canManage && <button type="button" onClick={() => setRenaming({ id: r.id, name: r.name })} aria-label={`Rename ${r.name}`} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"><Pencil className="w-4 h-4" /></button>}
                      {data.canManage && <button type="button" onClick={() => confirm(`Remove ${r.name}? Its QR code stops knowing the room (guests can still write it).`) && send({ action: "room-delete", id: r.id }, "Removed")} aria-label={`Remove ${r.name}`} className="p-1.5 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>}
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {shown.length > 60 && <p className="text-xs text-gray-500">The first 60 are shown with their picture. The PDF has all of them.</p>}
          </>
        )}
      </section>

      {data.canManage && (
        <StylePanel style={style} onChange={(v) => { setStyle(v); setOwn(true); }} dirty={dirty} saving={saving} onSave={saveLook}
          onReset={() => { setStyle(saved); setOwn(!!s.qrStyle); setLabel(s.roomLabel); setPrefix(s.roomPrefix); }}
          title="Style of the room service QR codes" framePlaceholder="Empty: the room, like Room 101"
          description={own ? "Your own style for room service. Rooms get their number where you choose below." : "Now the same style as on QR Codes. Change anything to give room service its own style."}>
          <div className="border-t border-gray-100 pt-4 grid sm:grid-cols-2 gap-4" data-room-label>
            <div>
              <div className="text-xs font-semibold text-gray-500 mb-1.5">Room number on the code</div>
              <div className="inline-flex flex-wrap rounded-xl bg-gray-100 p-1 gap-1" role="radiogroup">
                {([["center", "In the middle"], ["below", "Under it"], ["both", "Both"], ["none", "No number"]] as [RoomLabel, string][]).map(([v, l]) => (
                  <button key={v} type="button" role="radio" aria-checked={label === v} onClick={() => setLabel(v)} data-label={v}
                    className={`text-xs font-semibold rounded-lg px-3 py-1.5 ${label === v ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-800"}`}>{l}</button>
                ))}
              </div>
            </div>
            <label className="block">
              <span className="block text-xs font-semibold text-gray-500 mb-1">Text before the number under the code</span>
              <span className="block text-xs text-gray-500 mb-1.5">Room numbers get it (Room 101). Names stay as they are (Suite Panorama), and names longer than 8 letters go under the code.</span>
              <input value={prefix} onChange={(e) => setPrefix(e.target.value.slice(0, 12))} placeholder="Room " id="room-prefix" className="w-full sm:max-w-[12rem] text-sm border border-gray-200 rounded-xl px-3 py-2.5" />
            </label>
            {own && <button type="button" onClick={() => { setStyle(data.baseStyle); setOwn(false); }} className="text-xs font-semibold text-blue-700 justify-self-start">Use the same style as QR Codes again</button>}
          </div>
        </StylePanel>
      )}
    </div>
  );
}
