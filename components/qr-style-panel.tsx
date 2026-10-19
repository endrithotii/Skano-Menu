"use client";

// The QR code style editor: suggested styles, shapes, frame and colors. Used on QR Codes and Room service.

import { useEffect, useState } from "react";
import { Palette, Check, Loader2, AlertTriangle, RotateCcw } from "lucide-react";
import { PRESETS, renderQr, scanWarning, type EyeShape, type FrameKind, type ModuleShape, type QrStyle } from "@/lib/qr-style";

/** Suggested styles and the colors */
export function StylePanel({ style, onChange, dirty, saving, onSave, onReset, title = "Style of your QR codes", description = "Pick a style, then change the colors. Both codes use it, and everyone on your team sees the saved style.", framePlaceholder = "", children }: {
  style: QrStyle; onChange: (s: QrStyle) => void; dirty: boolean; saving: boolean; onSave: () => void; onReset: () => void;
  title?: string; description?: string; framePlaceholder?: string;
  /** Extra settings shown under the colors (e.g. where the room number goes) */
  children?: React.ReactNode;
}) {
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
          <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Palette className="w-4 h-4 text-blue-500" /> {title}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
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
              <input value={style.frameText} onChange={(e) => set({ frameText: e.target.value.slice(0, 40) })} placeholder={framePlaceholder} id="frame-text"
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
      {children}
    </section>
  );
}
