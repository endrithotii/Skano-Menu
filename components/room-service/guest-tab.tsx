"use client";

// Room service > How guests order: on / off, writing or the menu, what menu they see, food feedback,
// the steps guests see at the top, and a welcome line. Nothing is saved until you press Save.

import { useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2, Info } from "lucide-react";
import { DEFAULT_STEPS, type MenuView, type OrderMode, type RoomServiceSettings } from "@/lib/room-service-types";
import { useUnsavedChanges } from "@/lib/navigation-guard";

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

function Choice<T extends string>({ value, onChange, options, label, cols }: { value: T; onChange: (v: T) => void; options: [T, string, string][]; label: string; cols: string }) {
  return (
    <div className={`grid ${cols} gap-2`} role="radiogroup" aria-label={label}>
      {options.map(([v, t, d]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)} data-choice={v}
          className={`text-left rounded-xl border p-3 ${value === v ? "border-blue-500 bg-blue-50/60 ring-1 ring-blue-500" : "border-gray-200 hover:border-gray-300"}`}>
          <div className="text-sm font-semibold text-gray-900">{t}</div>
          <div className="text-xs text-gray-600 mt-0.5">{d}</div>
        </button>
      ))}
    </div>
  );
}

export function GuestTab({ settings, dishCount, send }: { settings: RoomServiceSettings; dishCount: number; send: Send }) {
  const [enabled, setEnabled] = useState(settings.enabled);
  const [mode, setMode] = useState<OrderMode>(settings.mode);
  const [menuView, setMenuView] = useState<MenuView>(settings.menuView);
  const [feedback, setFeedback] = useState(settings.feedback);
  const [steps, setSteps] = useState<string[]>(settings.steps.length ? settings.steps : [""]);
  const [welcome, setWelcome] = useState(settings.welcome);
  const [askName, setAskName] = useState(settings.askName);
  const [saving, setSaving] = useState(false);

  const clean = steps.map((x) => x.trim()).filter(Boolean);
  const next = { enabled, mode, menuView, feedback, askName, steps: clean, welcome: welcome.trim() };
  const dirty = (Object.keys(next) as (keyof typeof next)[]).some((k) => JSON.stringify(next[k]) !== JSON.stringify(settings[k]));
  useUnsavedChanges(dirty, "You have changes in room service that are not saved. Leave without saving?");

  async function save() {
    setSaving(true);
    await send({ action: "settings", settings: next }, "Saved");
    setSaving(false);
  }
  function undo() {
    setEnabled(settings.enabled); setMode(settings.mode); setMenuView(settings.menuView); setFeedback(settings.feedback);
    setSteps(settings.steps.length ? settings.steps : [""]); setWelcome(settings.welcome); setAskName(settings.askName);
  }
  const move = (i: number, d: -1 | 1) => setSteps((s) => { const n = [...s]; [n[i], n[i + d]] = [n[i + d], n[i]]; return n; });

  return (
    <div className="space-y-5">
      <section className={`${card} p-5 flex items-start gap-4`}>
        <div className="flex-1 min-w-0">
          <label htmlFor="rs-on" className="font-semibold text-gray-900">Guests can order room service</label>
          <p className="text-sm text-gray-600 mt-0.5">{enabled ? "On. Guests who scan a room QR code can send orders." : "Off. Guests who scan a room QR code see that room service is closed."}</p>
        </div>
        <Switch id="rs-on" label="Guests can order room service" on={enabled} onChange={setEnabled} />
      </section>

      <section className={`${card} p-5 space-y-3`} data-mode-section>
        <h2 className="font-semibold text-gray-900">How guests order</h2>
        <Choice value={mode} onChange={setMode} label="How guests order" cols="sm:grid-cols-3" options={[
          ["text", "They write it", "A text box: Two coffees and a croissant, please."],
          ["menu", "From the menu", "They pick dishes and amounts, with a note for each."],
          ["both", "Both", "They pick dishes, and can write anything else."],
        ]} />
        {mode !== "text" && (
          <p className={`text-sm rounded-xl px-3 py-2 flex gap-2 ${dishCount ? "bg-gray-50 text-gray-600" : "bg-amber-50 text-amber-900"}`} data-dish-hint>
            <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
            <span>{dishCount
              ? <>Guests pick from the {dishCount} dishes of your menus in <Link href="/dashboard/ingredients" className="font-semibold underline">Ingredients & details</Link>, with their prices.</>
              : <>Your dishes are not in <Link href="/dashboard/ingredients" className="font-semibold underline">Ingredients & details</Link> yet, so guests write their order for now. Add the dishes there and the list shows up by itself.</>}</span>
          </p>
        )}
        <label className="flex items-center gap-3 pt-1">
          <Switch id="rs-name" label="Guests must write their name and surname" on={askName} onChange={setAskName} />
          <span className="text-sm text-gray-800">Guests must write their name and surname</span>
        </label>
      </section>

      <section className={`${card} p-5 space-y-3`} data-view-section>
        <div>
          <h2 className="font-semibold text-gray-900">What guests see</h2>
          <p className="text-sm text-gray-600 mt-0.5">{mode === "text" ? "Guests write their order. You can still show them your menu, so they know what to write." : "Guests always order from the list of dishes. You choose if they can also open your official menu."}</p>
        </div>
        <Choice value={menuView} onChange={setMenuView} label="What guests see" cols="sm:grid-cols-2" options={mode === "text" ? [
          ["dishes", "No menu", "Only the text box."],
          ["official", "The official menu", "A See the menu button opens the menu customers see with your QR code."],
        ] : [
          ["dishes", "Only the dishes", "A simple list of foods and drinks with prices, to pick from."],
          ["official", "The official menu and the dishes", "A See the menu button opens your real menu (PDF, photos or design). They pick from the list."],
        ]} />
      </section>

      <section className={`${card} p-5 flex items-start gap-4`}>
        <div className="flex-1 min-w-0">
          <label htmlFor="rs-feedback" className="font-semibold text-gray-900">Guests can rate the food</label>
          <p className="text-sm text-gray-600 mt-0.5">After an order is delivered, the guest can give stars to the order and to each dish, and write a comment. You see it on the Feedback tab here.</p>
        </div>
        <Switch id="rs-feedback" label="Guests can rate the food" on={feedback} onChange={setFeedback} />
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

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-end gap-3 rounded-2xl bg-white/90 backdrop-blur border border-gray-100 shadow-lg px-4 py-3" data-save-bar>
        <span className="text-sm text-gray-600 mr-auto" aria-live="polite">{dirty ? "You have changes that are not saved yet." : "Everything is saved."}</span>
        {dirty && <button type="button" onClick={undo} className="text-sm font-semibold text-gray-600 hover:text-gray-900 px-2 py-2" data-go="undo">Undo changes</button>}
        <button type="button" disabled={!dirty || saving} onClick={save} data-go="save-guest"
          className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl px-5 py-2.5 disabled:opacity-40">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save
        </button>
      </div>
    </div>
  );
}
