"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { QrCode, Download, Copy, ExternalLink, Smartphone, CalendarCheck, Palette, Check, Loader2, AlertTriangle, RotateCcw } from "lucide-react";
import toast from "react-hot-toast";
import { DEFAULT_STYLE, PRESETS, renderQr, scanWarning, type EyeShape, type FrameKind, type ModuleShape, type QrStyle } from "@/lib/qr-style";

interface RestaurantInfo { id: string; name: string; slug: string }

const MENU_LABEL = "Scan for the menu", RESERVE_LABEL = "Scan to reserve";

function downloadQR(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
  toast.success("Downloaded!");
}

function copyLink(url: string) {
  navigator.clipboard.writeText(url);
  toast.success("Link copied!");
}

/** One QR code with its link, download and preview */
function QrCard({ title, subtitle, url, image, file, gradient, scanText, preview, id, children }: {
  title: string; subtitle: string; url: string; image: string; file: string; gradient: string; scanText: string; preview: string; id: string; children?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col" data-qr={id}>
      <div className={`${gradient} p-5 text-white`}>
        <div className="flex items-center gap-3">
          {id === "reserve" ? <CalendarCheck className="w-6 h-6" /> : <QrCode className="w-6 h-6" />}
          <div>
            <div className="font-bold">{title}</div>
            <div className="text-white/80 text-sm">{subtitle}</div>
          </div>
        </div>
      </div>
      <div className="p-8 flex flex-col items-center flex-1">
        {image ? (
          <div className="relative">
            <div className="absolute -inset-3 bg-gradient-to-br from-gray-100 to-gray-50 rounded-2xl" />
            <div className="relative bg-white p-3 rounded-xl shadow-inner">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt={`${title} QR code`} className="w-56 h-auto" />
            </div>
          </div>
        ) : (
          <div className="w-56 h-56 bg-gray-100 rounded-xl flex items-center justify-center"><QrCode className="w-12 h-12 text-gray-400" /></div>
        )}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500 mb-1">{scanText}</p>
          <p className="text-sm font-medium text-gray-900 break-all max-w-xs">{url}</p>
        </div>
        <div className="flex gap-3 mt-6 w-full max-w-xs">
          <button onClick={() => downloadQR(image, file)}
            className="flex-1 flex items-center justify-center gap-2 bg-gray-900 text-white font-semibold py-3 rounded-xl hover:bg-black transition-all text-sm">
            <Download className="w-4 h-4" /> Download PNG
          </button>
          <button onClick={() => copyLink(url)}
            className="flex-1 flex items-center justify-center gap-2 border border-gray-200 text-gray-700 font-semibold py-3 rounded-xl hover:bg-gray-50 transition-all text-sm">
            <Copy className="w-4 h-4" /> Copy Link
          </button>
        </div>
        <a href={url} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium">
          <ExternalLink className="w-3.5 h-3.5" /> {preview}
        </a>
        {children}
      </div>
    </div>
  );
}

export default function QRCodePage() {
  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null);
  const [menuQr, setMenuQr] = useState("");
  const [reserveQr, setReserveQr] = useState("");
  const [loading, setLoading] = useState(true);
  // The saved style, and the one being tried
  const [saved, setSaved] = useState<QrStyle>(DEFAULT_STYLE);
  const [style, setStyle] = useState<QrStyle>(DEFAULT_STYLE);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const stats = await fetch("/api/dashboard/stats").then((r) => r.json());
      const r: RestaurantInfo = { id: stats.restaurantId, name: stats.restaurant.name, slug: stats.restaurant.slug };
      const st = await fetch(`/api/restaurants/${r.id}/qr-style`).then((x) => (x.ok ? x.json() : null)).catch(() => null);
      if (st?.style) { setSaved(st.style); setStyle(st.style); }
      setRestaurant(r);
      setLoading(false);
    })();
  }, []);

  // Draw both codes again when the style changes
  useEffect(() => {
    if (!restaurant) return;
    let stop = false;
    const origin = window.location.origin;
    void (async () => {
      const [a, b] = await Promise.all([renderQr(`${origin}/r/${restaurant.slug}`, style, MENU_LABEL, 1024), renderQr(`${origin}/reserve/${restaurant.slug}`, style, RESERVE_LABEL, 1024)]);
      if (!stop) { setMenuQr(a); setReserveQr(b); }
    })();
    return () => { stop = true; };
  }, [restaurant, style]);

  async function saveStyle() {
    if (!restaurant) return;
    setSaving(true);
    const res = await fetch(`/api/restaurants/${restaurant.id}/qr-style`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ style }) }).catch(() => null);
    const d = await res?.json().catch(() => null);
    setSaving(false);
    if (!res?.ok) { toast.error(d?.error ?? "Could not save"); return; }
    setSaved(d.style); setStyle(d.style); toast.success("QR code style saved");
  }

  if (loading || !restaurant) return (
    <div className="p-6 flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
    </div>
  );

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const menuUrl = `${origin}/r/${restaurant.slug}`;
  const reserveUrl = `${origin}/reserve/${restaurant.slug}`;

  return (
    <div className="p-4 lg:p-6 max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">QR Codes</h1>
        <p className="text-sm text-gray-500 mt-1">One QR code opens your menu, the other one lets customers reserve a table</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <QrCard id="menu" title={restaurant.name} subtitle="Digital Menu QR Code" url={menuUrl} image={menuQr} file={`${restaurant.slug}-menu-qr.png`}
          gradient="bg-gradient-to-r from-blue-500 to-indigo-500" scanText="Scan to open menu" preview="Preview menu in new tab" />
        <QrCard id="reserve" title={restaurant.name} subtitle="Reserve a table QR Code" url={reserveUrl} image={reserveQr} file={`${restaurant.slug}-reserve-qr.png`}
          gradient="bg-gradient-to-r from-emerald-500 to-teal-500" scanText="Scan to reserve a table" preview="Preview the reservation page">
          <p className="mt-4 text-xs text-gray-500 text-center max-w-xs">
            Customers pick a day, a time and a table from your <Link href="/dashboard/floor-plan" className="font-semibold text-blue-600">Floor plan</Link>. You accept or refuse on <Link href="/dashboard/reservations" className="font-semibold text-blue-600">Reservations</Link>.
          </p>
        </QrCard>
      </div>

      <StylePanel style={style} onChange={setStyle} dirty={JSON.stringify(style) !== JSON.stringify(saved)} saving={saving} onSave={saveStyle} onReset={() => setStyle(saved)} />

      {/* Tips */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-blue-500" /> Placement Tips
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { title: "Table tents", desc: "Print and fold for tabletop display. Works great for casual dining." },
                { title: "Acrylic stands", desc: "Professional look for fine dining. Use UV-resistant print." },
                { title: "Stickers on tables", desc: "Low cost option. Place near the center of each table." },
                { title: "Entry/reception area", desc: "Let guests preview the menu before being seated." },
                { title: "Reservations", desc: "Put the reservation QR code on your door, website, receipts and social media." },
              ].map((tip) => (
                <div key={tip.title} className="bg-blue-50 rounded-xl p-3">
                  <div className="font-medium text-gray-900 text-sm mb-1">{tip.title}</div>
                  <div className="text-xs text-gray-600">{tip.desc}</div>
                </div>
              ))}
            </div>
          </div>
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
        <p className="text-sm text-blue-700">
          <span className="font-semibold">Print tip:</span> Download the QR code and print at minimum 3×3cm (1.2×1.2 inches) for reliable scanning.
        </p>
      </div>
    </div>
  );
}

/** Suggested styles and the colors */
function StylePanel({ style, onChange, dirty, saving, onSave, onReset }: { style: QrStyle; onChange: (s: QrStyle) => void; dirty: boolean; saving: boolean; onSave: () => void; onReset: () => void }) {
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  useEffect(() => {
    let stop = false;
    void Promise.all(PRESETS.map(async (p) => [p.id, await renderQr("https://skano.menu/r/example", p.style, "Scan me", 220)] as const)).then((list) => { if (!stop) setThumbs(Object.fromEntries(list)); });
    return () => { stop = true; };
  }, []);
  const warning = scanWarning(style);
  const set = (patch: Partial<QrStyle>) => onChange({ ...style, ...patch });
  const seg = <T extends string>(label: string, value: T, options: [T, string][], on: (v: T) => void, id: string) => (
    <div>
      <div className="text-xs font-semibold text-gray-500 mb-1.5">{label}</div>
      <div className="inline-flex flex-wrap rounded-xl bg-gray-100 p-1 gap-1" role="radiogroup" data-seg={id}>
        {options.map(([v, l]) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => on(v)} data-value={v}
            className={`text-xs font-semibold rounded-lg px-3 py-1.5 ${value === v ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-800"}`}>{l}</button>
        ))}
      </div>
    </div>
  );
  const color = (label: string, value: string, on: (v: string) => void, id: string) => (
    <label className="flex items-center gap-2 text-sm text-gray-700">
      <input type="color" value={value} onChange={(e) => on(e.target.value)} data-color={id} className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer bg-white p-0.5" />
      <span>{label}</span>
    </label>
  );
  const presetOn = PRESETS.find((p) => JSON.stringify(p.style) === JSON.stringify(style))?.id;

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-5" aria-label="QR code style" data-style-panel>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Palette className="w-4 h-4 text-blue-500" /> Style of your QR codes</h2>
          <p className="text-xs text-gray-500 mt-0.5">Pick a style, then change the colors. Both codes use it, and everyone on your team sees the saved style.</p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && <button type="button" onClick={onReset} className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-800"><RotateCcw className="w-3.5 h-3.5" /> Undo changes</button>}
          <button type="button" onClick={onSave} disabled={!dirty || saving} id="save-style"
            className="inline-flex items-center gap-2 text-sm font-semibold text-white px-4 py-2 rounded-xl bg-gray-900 hover:bg-black disabled:opacity-40">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save style
          </button>
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold text-gray-500 mb-2">Suggested styles</div>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2" data-presets>
          {PRESETS.map((p) => (
            <button key={p.id} type="button" onClick={() => onChange(p.style)} aria-pressed={presetOn === p.id} data-preset={p.id}
              className={`rounded-xl border p-1.5 text-center ${presetOn === p.id ? "border-blue-500 ring-2 ring-blue-500/20" : "border-gray-200 hover:border-gray-300"}`}>
              {thumbs[p.id]
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={thumbs[p.id]} alt="" className="w-full aspect-square object-contain rounded-lg" />
                : <div className="w-full aspect-square rounded-lg bg-gray-100" />}
              <div className="mt-1 text-[11px] font-medium text-gray-700 leading-tight">{p.name}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          {seg<ModuleShape>("Shape of the code", style.modules, [["square", "Squares"], ["rounded", "Rounded"], ["dots", "Dots"], ["soft", "Soft"]], (v) => set({ modules: v }), "modules")}
          {seg<EyeShape>("Corners", style.eyes, [["square", "Square"], ["rounded", "Rounded"], ["circle", "Circle"]], (v) => set({ eyes: v }), "eyes")}
          {seg<FrameKind>("Frame", style.frame, [["none", "None"], ["label", "Text under it"], ["card", "Frame with a text"]], (v) => set({ frame: v }), "frame")}
          {style.frame !== "none" && (
            <label className="block">
              <span className="block text-xs font-semibold text-gray-500 mb-1">Frame text</span>
              <input value={style.frameText} onChange={(e) => set({ frameText: e.target.value.slice(0, 40) })} placeholder={`Empty: "${MENU_LABEL}" and "${RESERVE_LABEL}"`} id="frame-text"
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </label>
          )}
        </div>
        <div className="space-y-3">
          <div className="text-xs font-semibold text-gray-500">Colors</div>
          {color(style.color2 ? "Code color (start)" : "Code color", style.color, (v) => set({ color: v }), "code")}
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={!!style.color2} onChange={(e) => set({ color2: e.target.checked ? "#f59e0b" : null })} id="use-gradient" className="w-4 h-4" /> Gradient
            </label>
            {style.color2 && color("Code color (end)", style.color2, (v) => set({ color2: v }), "code2")}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={!!style.eyeColor} onChange={(e) => set({ eyeColor: e.target.checked ? "#dc2626" : null })} id="use-eye-color" className="w-4 h-4" /> Other color for the corners
            </label>
            {style.eyeColor && color("Corner color", style.eyeColor, (v) => set({ eyeColor: v }), "eye")}
          </div>
          {color("Background", style.background, (v) => set({ background: v }), "bg")}
          {warning && <p className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2" data-warning><AlertTriangle className="w-4 h-4 shrink-0" /> {warning}</p>}
        </div>
      </div>
    </section>
  );
}
