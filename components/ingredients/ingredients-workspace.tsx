"use client";

// Ingredients & details: pick an (active) menu, check its list of dishes, then go dish by dish:
// 1. what is in it (eggs, oil, cheese), 2. a comment for each ingredient (olive oil, cottage cheese).
// Used on the dashboard (manager) and on /kitchen (chef accounts).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChefHat, FileText, Images, Palette, LayoutList, ArrowLeft, ArrowRight, Loader2, Plus, Trash2, Check, RefreshCw,
  Sparkles, AlertTriangle, CheckCircle2, X, Eye, Pencil, ListChecks, MessageCircleQuestion,
} from "lucide-react";
import toast from "react-hot-toast";
import { parseMenuPages } from "@/lib/menu-pages";
import { readMenuText } from "@/components/ingredients/read-menu-text";

type Kind = "pdf" | "photos" | "design" | "digital";
interface MenuEntry {
  key: string; title: string; kind: Kind; active: ("live" | "tree" | "scheduled")[];
  menuPdfUrl: string | null; designId: string | null; dishes: number; done: number; listConfirmed: boolean; changedSince: boolean;
}
interface Ingredient { name: string; note: string }
interface Dish { id: string; name: string; section: string; menuText: string; ingredients: Ingredient[]; note: string; prepMinutes: number | null; done: boolean }
interface Found { name: string; section: string; menuText: string; ingredients: string[] }

const newId = () => `d_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const toDishes = (found: Found[]): Dish[] => found.map((f) => ({
  id: newId(), name: f.name, section: f.section, menuText: f.menuText,
  ingredients: f.ingredients.map((n) => ({ name: n, note: "" })), note: "", prepMinutes: null, done: false,
}));

const KIND: Record<Kind, { label: string; icon: React.ReactNode }> = {
  pdf: { label: "PDF menu", icon: <FileText className="w-5 h-5 text-blue-500" /> },
  photos: { label: "Photo menu", icon: <Images className="w-5 h-5 text-blue-500" /> },
  design: { label: "Designed on Skano", icon: <Palette className="w-5 h-5 text-indigo-500" /> },
  digital: { label: "Digital menu", icon: <LayoutList className="w-5 h-5 text-gray-500" /> },
};
const ACTIVE_LABEL = { live: "Live now", tree: "In the menu tree", scheduled: "Scheduled now" } as const;

const inputCls = "w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500";

export function IngredientsWorkspace({ restaurantId }: { restaurantId: string }) {
  const [menus, setMenus] = useState<MenuEntry[] | null>(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState<MenuEntry | null>(null);
  // Customers can ask about the dishes (More > Ask about the dishes)
  const [askEnabled, setAskEnabled] = useState<boolean | null>(null);
  const [switching, setSwitching] = useState(false);
  async function setAsk(on: boolean) {
    setSwitching(true);
    const res = await fetch(`/api/restaurants/${restaurantId}/dish-details`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ askEnabled: on }),
    }).catch(() => null);
    setSwitching(false);
    if (!res?.ok) { toast.error("Could not change it"); return; }
    setAskEnabled(on);
    toast.success(on ? "Customers can ask about the dishes now." : "Turned off. Customers don't see it anymore.");
  }

  const load = useCallback(async () => {
    const d = await fetch(`/api/restaurants/${restaurantId}/dish-details`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (!d) { setError(true); return; }
    setMenus(d.menus);
    setAskEnabled(d.settings?.askEnabled !== false);
  }, [restaurantId]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  if (open) {
    return <MenuDetails key={open.key} restaurantId={restaurantId} entry={open} onBack={() => { setOpen(null); void load(); }} />;
  }
  if (error) return <p className="text-sm text-gray-500">Could not load your menus. Please refresh the page.</p>;
  if (!menus) return <div className="py-16 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-blue-500" /></div>;

  const active = menus.filter((m) => m.active.length);
  const others = menus.filter((m) => !m.active.length);
  const card = (m: MenuEntry) => {
    const pct = m.dishes ? Math.round((m.done / m.dishes) * 100) : 0;
    return (
      <li key={m.key}>
        <button type="button" onClick={() => setOpen(m)}
          className="w-full text-left bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:border-blue-200 hover:shadow-md transition-all flex items-center gap-4">
          <div className="w-11 h-11 shrink-0 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center">{KIND[m.kind].icon}</div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900 truncate">{m.title}</span>
              {m.active.map((a) => (
                <span key={a} className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-800 border border-green-200">{ACTIVE_LABEL[a]}</span>
              ))}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {KIND[m.kind].label} · {!m.dishes ? "Not started" : !m.listConfirmed ? `${m.dishes} dishes found, list not checked yet` : `${m.done} of ${m.dishes} dishes done`}
            </div>
            {m.dishes > 0 && m.listConfirmed && (
              <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} /></div>
            )}
            {m.changedSince && <div className="mt-1.5 text-xs text-amber-700 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> The menu has a newer version. Check the dish list.</div>}
          </div>
          <ArrowRight className="w-4 h-4 text-gray-400 shrink-0" />
        </button>
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <section className={`rounded-2xl border p-4 flex items-start gap-4 ${askEnabled ? "bg-white border-gray-100 shadow-sm" : "bg-gray-50 border-gray-200"}`}>
        <MessageCircleQuestion className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900 text-sm">Let customers ask about the dishes</div>
          <p className="text-xs text-gray-500 mt-0.5">
            {askEnabled
              ? "On. Under More on your menu, customers can ask things like \"I'm allergic to peanuts\" or \"Which main dish comes quickest?\". Answers use only the details entered here, and only dishes that are done."
              : "Off. Customers don't see the Ask about the dishes button."}
          </p>
        </div>
        <button type="button" role="switch" aria-checked={!!askEnabled} aria-label="Let customers ask about the dishes" id="ask-switch"
          disabled={askEnabled === null || switching} onClick={() => setAsk(!askEnabled)}
          className={`relative w-14 h-8 shrink-0 rounded-full transition-colors disabled:opacity-50 ${askEnabled ? "bg-blue-600" : "bg-gray-300"}`}>
          <span className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${askEnabled ? "translate-x-6" : ""}`} />
        </button>
      </section>
      <section>
        <h2 className="text-sm font-semibold text-gray-900">Active menus</h2>
        <p className="text-xs text-gray-500 mb-2">The menus customers can see right now</p>
        {active.length ? <ul className="space-y-2">{active.map(card)}</ul> : (
          <p className="text-sm text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200 p-6 text-center">No active menu yet. Make one active on the Menu Management page.</p>
        )}
      </section>
      <section>
        <h2 className="text-sm font-semibold text-gray-900">Other menus</h2>
        <p className="text-xs text-gray-500 mb-2">Saved menus customers don&apos;t see right now. Add their details too, so they are ready when you use them.</p>
        {others.length ? <ul className="space-y-2">{others.map(card)}</ul> : (
          <p className="text-sm text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200 p-6 text-center">No other saved menus.</p>
        )}
      </section>
    </div>
  );
}

// ── One menu ────────────────────────────────────────────────────────────────

function MenuDetails({ restaurantId, entry, onBack }: { restaurantId: string; entry: MenuEntry; onBack: () => void }) {
  const api = `/api/restaurants/${restaurantId}/dish-details`;
  const [dishes, setDishes] = useState<Dish[] | null>(null);
  const [listConfirmed, setListConfirmed] = useState(false);
  const [designText, setDesignText] = useState<string | null>(null);
  // Dishes taken straight from a design's menu items (exact, nothing to read)
  const [designDishes, setDesignDishes] = useState<Found[] | null>(null);
  const [step, setStep] = useState<"list" | "dishes">("list");
  const [editing, setEditing] = useState<number | null>(null);
  const [reading, setReading] = useState<{ message: string } | null>(null);
  const [readInfo, setReadInfo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const autoRead = useRef(false);

  const save = useCallback(async (next: Dish[], confirmed: boolean, quiet = false) => {
    setSaving(true);
    const res = await fetch(api, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: entry.key, dishes: next, listConfirmed: confirmed, sourceUrl: entry.menuPdfUrl }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) { toast.error("Could not save. Please try again."); return false; }
    if (!quiet) toast.success("Saved");
    return true;
  }, [api, entry.key, entry.menuPdfUrl]);

  /** Reads the menu and finds the dishes (replaces the list) */
  const findDishes = useCallback(async (textFromDesign?: string | null, fromDesign?: Found[] | null) => {
    setReadInfo(null);
    if (fromDesign?.length) {
      setDishes(toDishes(fromDesign));
      setReadInfo(`We took the ${fromDesign.length} dishes from your design. Check the list: remove what isn't a dish and add what is missing.`);
      return;
    }
    setReading({ message: "Reading your menu…" });
    try {
      let text = textFromDesign ?? "";
      let how = "the text of your design";
      if (!text) {
        if (!entry.menuPdfUrl) throw new Error("This menu has no file.");
        const r = await readMenuText(entry.menuPdfUrl, (m) => setReading({ message: m }));
        text = r.text;
        how = r.method === "pdf-text" ? "the text in your PDF" : "your menu pictures (text recognition)";
      }
      setReading({ message: "Finding the dishes…" });
      const res = await fetch(`${api}/identify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error ?? "Could not read the menu.");
      const found = toDishes(d.dishes ?? []);
      setDishes(found);
      setReadInfo(found.length
        ? `We found ${found.length} dishes in ${how}. This can have mistakes: check each name, remove what isn't a dish and add what is missing.`
        : "We couldn't find dishes in this menu. Add them below, one by one.");
    } catch (e) {
      setDishes((d) => d ?? []);
      setReadInfo(`${e instanceof Error ? e.message : "Could not read the menu."} You can add the dishes below by hand.`);
    }
    setReading(null);
  }, [api, entry.menuPdfUrl]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const d = await fetch(`${api}?key=${encodeURIComponent(entry.key)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (cancelled) return;
      if (!d) { toast.error("Could not load this menu"); onBack(); return; }
      setDesignText(d.designText ?? null);
      setDesignDishes(d.designDishes ?? null);
      if (d.details) {
        setDishes(d.details.dishes);
        setListConfirmed(d.details.listConfirmed);
        setStep(d.details.listConfirmed ? "dishes" : "list");
      } else if (d.startDishes) {
        setDishes(d.startDishes);
        setReadInfo(`These are the ${d.startDishes.length} items of your digital menu. Check them before you go on.`);
      } else if (!autoRead.current) {
        autoRead.current = true;
        void findDishes(d.designText ?? null, d.designDishes ?? null);
      }
    })();
    return () => { cancelled = true; };
  }, [api, entry.key, findDishes, onBack]);

  const header = (
    <div className="flex items-start gap-3 flex-wrap">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 px-2 py-1.5 -ml-2 rounded-lg hover:bg-gray-100">
        <ArrowLeft className="w-4 h-4" /> Back to menus
      </button>
      <div className="flex-1" />
      <ol className="flex items-center gap-2 text-xs font-semibold">
        <li className={`px-2.5 py-1 rounded-full ${step === "list" ? "bg-blue-600 text-white" : "bg-green-100 text-green-800"}`}>1. Check the dishes</li>
        <li className={`px-2.5 py-1 rounded-full ${step === "dishes" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"}`}>2. Ingredients</li>
      </ol>
    </div>
  );

  if (!dishes || reading) {
    return (
      <div className="space-y-4">
        {header}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3" />
          <p className="font-semibold text-gray-900">{reading ? reading.message : "Loading…"}</p>
          {reading && <p className="text-sm text-gray-500 mt-1">We are looking for every dish on &quot;{entry.title}&quot;. Photos can take a minute.</p>}
        </div>
      </div>
    );
  }

  if (step === "list") {
    return (
      <div className="space-y-4">
        {header}
        <DishListStep
          entry={entry} dishes={dishes} setDishes={setDishes} info={readInfo} saving={saving}
          canRead={entry.kind !== "digital"}
          onReadAgain={() => { if (window.confirm("Read the menu again? The list below is replaced, with its ingredients.")) void findDishes(designText, designDishes); }}
          onSave={() => save(dishes, false)}
          onConfirm={async () => {
            const clean = dishes.filter((d) => d.name.trim());
            if (!clean.length) { toast.error("Add at least one dish."); return; }
            if (await save(clean, true, true)) {
              setDishes(clean); setListConfirmed(true); setStep("dishes");
              toast.success("List saved. Now add the ingredients, dish by dish.");
            }
          }}
        />
      </div>
    );
  }

  if (editing !== null && dishes[editing]) {
    return (
      <div className="space-y-4">
        {header}
        <DishWizard
          key={dishes[editing].id}
          dish={dishes[editing]} index={editing} total={dishes.length} saving={saving}
          onClose={() => setEditing(null)}
          onSave={async (d, goNext) => {
            const next = dishes.map((x, i) => (i === editing ? d : x));
            if (!(await save(next, listConfirmed, true))) return;
            setDishes(next);
            if (!goNext) { setEditing(null); toast.success(`"${d.name}" saved`); return; }
            const after = next.findIndex((x, i) => i > editing && !x.done);
            const anyLeft = after >= 0 ? after : next.findIndex((x) => !x.done);
            if (anyLeft >= 0) setEditing(anyLeft);
            else { setEditing(null); toast.success("All dishes are done!"); }
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {header}
      <DishOverview entry={entry} dishes={dishes} onEdit={setEditing} onEditList={() => setStep("list")} />
    </div>
  );
}

// ── Step 1: the list of dishes ──────────────────────────────────────────────

function DishListStep({ entry, dishes, setDishes, info, saving, canRead, onReadAgain, onSave, onConfirm }: {
  entry: MenuEntry; dishes: Dish[]; setDishes: (d: Dish[]) => void; info: string | null; saving: boolean;
  canRead: boolean; onReadAgain: () => void; onSave: () => void; onConfirm: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const lastRef = useRef<HTMLInputElement | null>(null);
  // A new dish was added: put the cursor in it
  const focusNew = useRef(false);
  useEffect(() => { if (focusNew.current) { lastRef.current?.focus(); focusNew.current = false; } });

  const update = (i: number, patch: Partial<Dish>) => setDishes(dishes.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const add = () => {
    setDishes([...dishes, { id: newId(), name: "", section: dishes[dishes.length - 1]?.section ?? "", menuText: "", ingredients: [], note: "", prepMinutes: null, done: false }]);
    focusNew.current = true;
  };
  const pages = parseMenuPages(entry.menuPdfUrl);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{entry.title}</h2>
            <p className="text-sm text-gray-500">Step 1: make sure this is the full list of dishes on the menu</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {pages && (
              <button type="button" onClick={() => setShowMenu((v) => !v)} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:border-blue-300 hover:text-blue-700">
                <Eye className="w-3.5 h-3.5" /> {showMenu ? "Hide the menu" : "See the menu"}
              </button>
            )}
            {canRead && (
              <button type="button" onClick={onReadAgain} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:border-blue-300 hover:text-blue-700">
                <RefreshCw className="w-3.5 h-3.5" /> Read the menu again
              </button>
            )}
          </div>
        </div>
        {info && (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-blue-50 border border-blue-100 px-3 py-2.5 text-sm text-blue-900">
            <Sparkles className="w-4 h-4 mt-0.5 shrink-0" /> <span>{info}</span>
          </div>
        )}
        {showMenu && pages && (
          <div className="mt-3 rounded-xl bg-gray-50 border border-gray-100 p-2">
            {pages.kind === "images" ? (
              <div className="flex gap-2 overflow-x-auto">
                {pages.urls.map((u, i) => (
                  <a key={i} href={u} target="_blank" rel="noopener noreferrer" className="shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt={`Page ${i + 1}`} className="h-72 w-auto rounded-lg border border-gray-200 bg-white" />
                  </a>
                ))}
              </div>
            ) : (
              <iframe src={pages.url} title="Menu" className="w-full h-[28rem] rounded-lg bg-white" />
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="hidden sm:grid grid-cols-[10rem_1fr_2.5rem] gap-2 px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          <span>Section</span><span>Dish</span><span />
        </div>
        <ul className="divide-y divide-gray-50">
          {dishes.map((d, i) => (
            <li key={d.id} className="grid grid-cols-1 sm:grid-cols-[10rem_1fr_2.5rem] gap-2 px-4 py-2 items-start">
              <input value={d.section} onChange={(e) => update(i, { section: e.target.value })} placeholder="Section" aria-label={`Section of dish ${i + 1}`}
                className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              <div>
                <input ref={i === dishes.length - 1 ? lastRef : undefined} value={d.name} onChange={(e) => update(i, { name: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
                  placeholder="Dish name" aria-label={`Dish ${i + 1}`} id={`dish-name-${i}`}
                  className="w-full text-sm font-medium border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                {d.menuText && <p className="text-[11px] text-gray-400 mt-1 px-1 truncate">On the menu: {d.menuText}</p>}
              </div>
              <button type="button" onClick={() => setDishes(dishes.filter((_, j) => j !== i))} aria-label={`Remove ${d.name || "dish"}`}
                className="justify-self-end sm:justify-self-auto w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50">
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
        <div className="px-4 py-3 border-t border-gray-50">
          <button type="button" onClick={add} className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700">
            <Plus className="w-4 h-4" /> Add a dish
          </button>
        </div>
      </div>

      <div className="sticky bottom-4 z-20">
        <div className="mx-auto max-w-2xl flex items-center gap-3 rounded-2xl bg-gray-900 text-white px-4 py-3 shadow-2xl flex-wrap">
          <span className="text-sm font-medium flex-1">{dishes.filter((d) => d.name.trim()).length} dishes</span>
          <button type="button" onClick={onSave} disabled={saving} className="text-sm font-medium text-gray-300 hover:text-white px-3 py-2 rounded-xl hover:bg-white/10 disabled:opacity-50">Save for later</button>
          <button type="button" onClick={onConfirm} disabled={saving}
            className="inline-flex items-center gap-2 text-sm font-semibold bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 px-4 py-2 rounded-xl disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} The list is correct, next
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Step 2: overview of the dishes ──────────────────────────────────────────

function DishOverview({ entry, dishes, onEdit, onEditList }: { entry: MenuEntry; dishes: Dish[]; onEdit: (i: number) => void; onEditList: () => void }) {
  const done = dishes.filter((d) => d.done).length;
  const firstOpen = dishes.findIndex((d) => !d.done);
  const sections = useMemo(() => {
    const out: { name: string; items: { d: Dish; i: number }[] }[] = [];
    dishes.forEach((d, i) => {
      const name = d.section || "Other";
      let s = out.find((x) => x.name === name);
      if (!s) { s = { name, items: [] }; out.push(s); }
      s.items.push({ d, i });
    });
    return out;
  }, [dishes]);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{entry.title}</h2>
            <p className="text-sm text-gray-500">Step 2: for each dish, add what it is made of</p>
          </div>
          <button type="button" onClick={onEditList} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:border-blue-300 hover:text-blue-700">
            <ListChecks className="w-3.5 h-3.5" /> Edit the dish list
          </button>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden"><div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${dishes.length ? (done / dishes.length) * 100 : 0}%` }} /></div>
          <span className="text-sm font-semibold text-gray-700">{done} of {dishes.length}</span>
        </div>
        {firstOpen >= 0 ? (
          <button type="button" onClick={() => onEdit(firstOpen)}
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-white px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600">
            <ChefHat className="w-4 h-4" /> {done ? "Continue" : "Start"} with &quot;{dishes[firstOpen].name}&quot;
          </button>
        ) : (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-3 py-2.5 text-sm text-green-800">
            <CheckCircle2 className="w-4 h-4" /> Every dish has its ingredients. You can still change any of them below.
          </div>
        )}
      </div>

      {sections.map((s) => (
        <section key={s.name}>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{s.name}</p>
          <ul className="space-y-2">
            {s.items.map(({ d, i }) => (
              <li key={d.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3.5 flex items-start gap-3">
                <span className={`mt-0.5 w-5 h-5 shrink-0 rounded-full flex items-center justify-center ${d.done ? "bg-green-500 text-white" : "border-2 border-gray-200"}`}>
                  {d.done && <Check className="w-3 h-3" strokeWidth={3} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-gray-900">{d.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {d.ingredients.length
                      ? d.ingredients.map((g) => (g.note ? `${g.name} (${g.note})` : g.name)).join(", ")
                      : "No ingredients yet"}
                  </div>
                  {(d.prepMinutes || d.note) && (
                    <div className="text-xs text-gray-400 mt-0.5">
                      {d.prepMinutes ? `Served in about ${d.prepMinutes} min` : ""}{d.prepMinutes && d.note ? " · " : ""}{d.note ? `Note: ${d.note}` : ""}
                    </div>
                  )}
                </div>
                <button type="button" onClick={() => onEdit(i)} aria-label={`Edit ${d.name}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:border-blue-300 hover:text-blue-700">
                  <Pencil className="w-3 h-3" /> {d.done ? "Edit" : "Add"}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

// ── Step 2: one dish (ingredients, then a comment for each) ────────────────

const NOTE_EXAMPLES = ["e.g. which kind or brand", "e.g. homemade or bought", "e.g. how much", "e.g. fresh or frozen"];

function DishWizard({ dish, index, total, saving, onClose, onSave }: {
  dish: Dish; index: number; total: number; saving: boolean;
  onClose: () => void; onSave: (d: Dish, goNext: boolean) => void;
}) {
  const [phase, setPhase] = useState<"ingredients" | "comments">("ingredients");
  const [items, setItems] = useState<Ingredient[]>(dish.ingredients);
  const [note, setNote] = useState(dish.note);
  const [minutes, setMinutes] = useState(dish.prepMinutes ? String(dish.prepMinutes) : "");
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function addFromInput() {
    const names = input.split(",").map((s) => s.trim()).filter(Boolean);
    if (!names.length) return;
    setItems((list) => {
      const have = new Set(list.map((i) => i.name.toLowerCase()));
      return [...list, ...names.filter((n) => !have.has(n.toLowerCase())).map((n) => ({ name: n.slice(0, 80), note: "" }))];
    });
    setInput("");
    inputRef.current?.focus();
  }

  const mins = Math.round(Number(minutes));
  const finish = (goNext: boolean) => onSave({
    ...dish, ingredients: items, note: note.trim(), prepMinutes: minutes.trim() && mins >= 1 ? Math.min(600, mins) : null, done: true,
  }, goNext);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-blue-600">Dish {index + 1} of {total}{dish.section ? ` · ${dish.section}` : ""}</div>
          <h2 className="text-2xl font-bold text-gray-900">{dish.name}</h2>
          {dish.menuText && <p className="text-sm text-gray-500 mt-0.5">On the menu: {dish.menuText}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="p-2 rounded-lg text-gray-400 hover:bg-gray-100"><X className="w-5 h-5" /></button>
      </div>

      <ol className="flex items-center gap-2 text-xs font-semibold">
        <li className={`px-2.5 py-1 rounded-full ${phase === "ingredients" ? "bg-blue-600 text-white" : "bg-green-100 text-green-800"}`}>a. Ingredients</li>
        <li className={`px-2.5 py-1 rounded-full ${phase === "comments" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"}`}>b. Comments</li>
      </ol>

      {phase === "ingredients" ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-700">What is used to make <span className="font-semibold">{dish.name}</span>? Add every ingredient, one by one. For example: eggs, oil, cheese.</p>
          <div className="flex gap-2">
            <input ref={inputRef} id="ingredient-input" value={input} onChange={(e) => setInput(e.target.value)} autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addFromInput(); } }}
              placeholder="Type an ingredient and press Enter" className={inputCls} />
            <button type="button" onClick={addFromInput} disabled={!input.trim()}
              className="shrink-0 inline-flex items-center gap-1.5 text-sm font-semibold px-4 rounded-xl bg-gray-900 text-white hover:bg-black disabled:opacity-40">
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
          {items.length ? (
            <ul className="flex flex-wrap gap-2">
              {items.map((it, i) => (
                <li key={`${it.name}-${i}`} className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-900 text-sm font-medium pl-3 pr-1 py-1">
                  {it.name}
                  <button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label={`Remove ${it.name}`}
                    className="w-6 h-6 flex items-center justify-center rounded-full text-blue-400 hover:text-red-600 hover:bg-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">No ingredients yet.</p>
          )}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={() => setPhase("comments")} disabled={!items.length}
              className="inline-flex items-center gap-2 text-sm font-semibold text-white px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 disabled:opacity-40">
              Next: comments <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-700">Anything to add about an ingredient? Be specific, for example which oil or which cheese. Leave empty if there is nothing to add.</p>
          <ul className="space-y-2">
            {items.map((it, i) => (
              <li key={`${it.name}-${i}`} className="grid sm:grid-cols-[10rem_1fr] gap-2 items-center">
                <span className="text-sm font-semibold text-gray-900">{it.name}</span>
                <input value={it.note} id={`ingredient-note-${i}`} aria-label={`Comment for ${it.name}`} maxLength={200}
                  onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))}
                  placeholder={`About the ${it.name}, ${NOTE_EXAMPLES[i % NOTE_EXAMPLES.length]}`} className={inputCls} />
              </li>
            ))}
          </ul>
          <label className="block pt-2">
            <span className="block text-sm font-semibold text-gray-900 mb-1">Anything else about this dish? <span className="font-normal text-gray-400">(optional)</span></span>
            <textarea id="dish-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500}
              placeholder="e.g. cooked in butter, can be made without cheese" className={`${inputCls} resize-none`} />
          </label>
          <label className="block">
            <span className="block text-sm font-semibold text-gray-900 mb-1">How long until it is served? <span className="font-normal text-gray-400">(optional)</span></span>
            <span className="flex items-center gap-2">
              <input id="dish-minutes" type="number" inputMode="numeric" min={1} max={600} value={minutes} onChange={(e) => setMinutes(e.target.value)}
                placeholder="15" className={`${inputCls} w-28`} />
              <span className="text-sm text-gray-600">minutes, from ordering to the table</span>
            </span>
            <span className="block text-xs text-gray-400 mt-1">Customers can ask which dish comes the quickest.</span>
          </label>
          <div className="flex items-center justify-between gap-2 pt-2 flex-wrap">
            <button type="button" onClick={() => setPhase("ingredients")} className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 px-3 py-2 rounded-xl hover:bg-gray-100">
              <ArrowLeft className="w-4 h-4" /> Back to ingredients
            </button>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => finish(false)} disabled={saving} className="text-sm font-medium text-gray-600 px-3 py-2 rounded-xl hover:bg-gray-100 disabled:opacity-50">Save and close</button>
              <button type="button" onClick={() => finish(true)} disabled={saving}
                className="inline-flex items-center gap-2 text-sm font-semibold text-white px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 disabled:opacity-60">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save, next dish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
