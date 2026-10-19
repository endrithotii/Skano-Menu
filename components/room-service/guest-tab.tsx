"use client";

// Room service > How guests order: on / off, writing or the menu, the steps guests see at the top, and a welcome line.

import { useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2, Info } from "lucide-react";
import { DEFAULT_STEPS, type OrderMode, type RoomServiceSettings } from "@/lib/room-service-types";

const card = "bg-white rounded-2xl border border-gray-100 shadow-sm";
type Send = (body: Record<string, unknown>, ok?: string) => Promise<RoomServiceSettings | null>;

function Switch({ on, onChange, label, id }: { on: boolean; onChange: (v: boolean) => void; label: string; id: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} id={id} onClick={() => onChange(!on)}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-green-500" : "bg-gray-300"}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}

export function GuestTab({ settings, dishCount, send }: { settings: RoomServiceSettings; dishCount: number; send: Send }) {
  const [mode, setMode] = useState<OrderMode>(settings.mode);
  const [steps, setSteps] = useState<string[]>(settings.steps.length ? settings.steps : [""]);
  const [welcome, setWelcome] = useState(settings.welcome);
  const [askName, setAskName] = useState(settings.askName);
  const [saving, setSaving] = useState(false);
  const [switching, setSwitching] = useState(false);

  const clean = steps.map((x) => x.trim()).filter(Boolean);
  const dirty = JSON.stringify(clean) !== JSON.stringify(settings.steps) || welcome.trim() !== settings.welcome;
  // The mode and the name switch save right away, like the on / off switch
  async function quick(patch: { mode?: OrderMode; askName?: boolean }, ok: string) {
    if (patch.mode) setMode(patch.mode);
    if (patch.askName !== undefined) setAskName(patch.askName);
    if (!(await send({ action: "settings", settings: patch }, ok))) { setMode(settings.mode); setAskName(settings.askName); }
  }

  async function save() {
    setSaving(true);
    await send({ action: "settings", settings: { steps: clean, welcome: welcome.trim() } }, "Steps saved");
    setSaving(false);
  }
  const move = (i: number, d: -1 | 1) => setSteps((s) => { const n = [...s]; [n[i], n[i + d]] = [n[i + d], n[i]]; return n; });

  return (
    <div className="space-y-5">
      <section className={`${card} p-5 flex items-start gap-4`}>
        <div className="flex-1 min-w-0">
          <label htmlFor="rs-on" className="font-semibold text-gray-900">Guests can order room service</label>
          <p className="text-sm text-gray-600 mt-0.5">{settings.enabled ? "On. Guests who scan a room QR code can send orders." : "Off. Guests who scan a room QR code see that room service is closed."}</p>
        </div>
        {switching ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" /> : (
          <Switch id="rs-on" label="Guests can order room service" on={settings.enabled} onChange={async (v) => { setSwitching(true); await send({ action: "settings", settings: { enabled: v } }, v ? "Room service is on" : "Room service is off"); setSwitching(false); }} />
        )}
      </section>

      <section className={`${card} p-5 space-y-3`}>
        <div>
          <h2 className="font-semibold text-gray-900">How guests order</h2>
          <p className="text-sm text-gray-600 mt-0.5">Changes here save as soon as you click.</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-2" role="radiogroup" aria-label="How guests order">
          {([["text", "They write it", "A text box: Two coffees and a croissant, please."], ["menu", "From the menu", "They pick dishes and amounts, with a note for each."], ["both", "Both", "They pick dishes, and can write anything else."]] as [OrderMode, string, string][]).map(([v, t, d]) => (
            <button key={v} type="button" role="radio" aria-checked={mode === v} onClick={() => { if (v !== mode) void quick({ mode: v }, "Saved: guests order " + (v === "text" ? "by writing" : v === "menu" ? "from the menu" : "by writing or from the menu")); }} data-mode={v}
              className={`text-left rounded-xl border p-3 ${mode === v ? "border-blue-500 bg-blue-50/60 ring-1 ring-blue-500" : "border-gray-200 hover:border-gray-300"}`}>
              <div className="text-sm font-semibold text-gray-900">{t}</div>
              <div className="text-xs text-gray-600 mt-0.5">{d}</div>
            </button>
          ))}
        </div>
        {mode !== "text" && (
          <p className={`text-sm rounded-xl px-3 py-2 flex gap-2 ${dishCount ? "bg-gray-50 text-gray-600" : "bg-amber-50 text-amber-900"}`} data-dish-hint>
            <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
            <span>{dishCount
              ? <>Guests see the {dishCount} dishes of your menus from <Link href="/dashboard/ingredients" className="font-semibold underline">Ingredients & details</Link>, with their prices.</>
              : <>Your dishes are not in <Link href="/dashboard/ingredients" className="font-semibold underline">Ingredients & details</Link> yet, so guests write their order for now. Add the dishes there and the menu shows up here by itself.</>}</span>
          </p>
        )}
        <label className="flex items-center gap-3 pt-1">
          <Switch id="rs-name" label="Guests must write their name" on={askName} onChange={(v) => quick({ askName: v }, v ? "Saved: guests must write their name" : "Saved: the name is optional")} />
          <span className="text-sm text-gray-800">Guests must write their name and surname</span>
        </label>
      </section>

      <section className={`${card} p-5 space-y-3`}>
        <div>
          <h2 className="font-semibold text-gray-900">Steps for guests</h2>
          <p className="text-sm text-gray-600 mt-0.5">They see these at the top, before they order. Write how it works in your hotel: payment, delivery time, the reception number.</p>
        </div>
        <label className="block">
          <span className="block text-xs font-semibold text-gray-500 mb-1">Welcome line (optional)</span>
          <input value={welcome} maxLength={200} onChange={(e) => setWelcome(e.target.value)} placeholder="For example: Room service is open from 7:00 to 23:00" id="rs-welcome" className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5" />
        </label>
        <ol className="space-y-2" data-steps>
          {steps.map((st, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="w-7 h-7 shrink-0 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center" aria-hidden>{i + 1}</span>
              <label className="sr-only" htmlFor={`step-${i}`}>Step {i + 1}</label>
              <input id={`step-${i}`} value={st} maxLength={200} onChange={(e) => setSteps((s) => s.map((x, k) => (k === i ? e.target.value : x)))} className="flex-1 min-w-0 text-sm border border-gray-200 rounded-xl px-3 py-2" />
              <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move step ${i + 1} up`} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30"><ArrowUp className="w-4 h-4" /></button>
              <button type="button" disabled={i === steps.length - 1} onClick={() => move(i, 1)} aria-label={`Move step ${i + 1} down`} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30"><ArrowDown className="w-4 h-4" /></button>
              <button type="button" onClick={() => setSteps((s) => s.filter((_, k) => k !== i))} aria-label={`Remove step ${i + 1}`} className="p-1.5 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-3">
          {steps.length < 10 && <button type="button" onClick={() => setSteps((s) => [...s, ""])} className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700" data-go="add-step"><Plus className="w-4 h-4" /> Add a step</button>}
          <button type="button" onClick={() => setSteps(DEFAULT_STEPS)} className="text-sm font-semibold text-gray-500 hover:text-gray-800">Use the example steps</button>
        </div>
      </section>

      <div className="sticky bottom-3 flex justify-end">
        <button type="button" disabled={!dirty || saving} onClick={save} data-go="save-guest"
          className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl px-5 py-2.5 shadow-lg disabled:opacity-40 disabled:shadow-none">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} {dirty ? "Save steps" : "Steps saved"}
        </button>
      </div>
    </div>
  );
}
