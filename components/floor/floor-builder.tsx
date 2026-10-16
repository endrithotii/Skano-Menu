"use client";

// Floor plan builder: the restaurant as a plan, in meters.
// Left: things to add (drag onto the plan or click). Middle: the plan (move, resize from the corner, rotate from
// the top handle). Right: the settings of what is selected. Areas (Main hall, Terrace…) as tabs.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Save, Loader2, Undo2, Redo2, ZoomIn, ZoomOut, Maximize, Magnet, Plus, Trash2, Copy, RotateCcw, RotateCw, X, AlertTriangle, Info, CalendarClock, Pencil,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  OBJECT_KINDS, duplicateLabels, emptyPlan, makeObject, newArea, newId, nextTableLabel, planStats, tableSize,
  type FloorArea, type FloorObject, type FloorPlan, type ScheduledPlan, type TableShape,
} from "@/lib/floor-plan";
import { useUnsavedChanges } from "@/lib/navigation-guard";
import { Shape } from "@/components/floor/floor-shapes";

const DRAG_MIME = "application/x-floor-object";
const GRID = 0.25; // snap step (meters)
const strip = (p: FloorPlan) => JSON.stringify(p);
const r2 = (n: number) => Math.round(n * 100) / 100;
const snapTo = (n: number, on: boolean, step = GRID) => (on ? Math.round(n / step) * step : r2(n));
const rad = (d: number) => (d * Math.PI) / 180;

const SWATCHES = ["#475569", "#1f2937", "#92400e", "#b91c1c", "#15803d", "#1d4ed8", "#f1f5f9", "#fef3c7", "#dcfce7", "#e0f2fe", "#fce7f3", "#ffffff"];

/** Small picture for the palette */
function PaletteIcon({ index }: { index: number }) {
  const o = { ...makeObject(index, 0, 0), x: 0, y: 0 };
  const isTable = o.type === "table";
  const span = Math.max(o.w + (isTable ? 0.9 : 0.2), o.h + (isTable ? 0.9 : 0.2), 1);
  const big = Math.max(o.w, o.h);
  const view = o.type === "wall" || o.type === "window" || o.type === "bar" || o.type === "room" || o.type === "text" ? big * 1.1 : span;
  return (
    <svg viewBox={`${-view / 2} ${-view / 2} ${view} ${view}`} className="w-10 h-10" aria-hidden>
      <Shape o={o.type === "wall" || o.type === "window" ? { ...o, h: Math.max(o.h, big * 0.08) } : o.type === "room" ? { ...o, label: "", } : o} />
    </svg>
  );
}

// ── The builder ──────────────────────────────────────────────────────────────

type Drag =
  | { kind: "move"; start: { x: number; y: number }; items: { id: string; x: number; y: number }[]; before: string; moved: boolean }
  | { kind: "resize"; id: string; o: FloorObject; before: string }
  | { kind: "rotate"; id: string; before: string };

export function FloorBuilder({ restaurantId }: { restaurantId: string }) {
  const [plan, setPlan] = useState<FloorPlan | null>(null);
  const [savedJson, setSavedJson] = useState<string | null>(null);
  // Scheduled changes: another plan from a date / time. target = the one being edited (null = the normal plan)
  const [basePlan, setBasePlan] = useState<FloorPlan | null>(null);
  const [schedules, setSchedules] = useState<ScheduledPlan[]>([]);
  const [target, setTarget] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState<null | { mode: "new" } | { mode: "edit"; s: ScheduledPlan }>(null);
  const [areaId, setAreaId] = useState<string>("");
  const [selected, setSelected] = useState<string[]>([]);
  const [zoom, setZoom] = useState(50); // pixels per meter
  const [snap, setSnap] = useState(true);
  const [saving, setSaving] = useState(false);
  const past = useRef<string[]>([]);
  const future = useRef<string[]>([]);
  // How many steps can be undone / redone (shown on the buttons)
  const [hist, setHist] = useState({ back: 0, forward: 0 });
  const bump = () => setHist({ back: past.current.length, forward: future.current.length });
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const planRef = useRef<FloorPlan | null>(null);
  useEffect(() => { planRef.current = plan; }, [plan]);

  const dirty = !!plan && savedJson !== null && strip(plan) !== savedJson;
  useUnsavedChanges(dirty, "Your floor plan isn't saved yet. Leave without saving?");

  // Load
  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/restaurants/${restaurantId}/floor-plan`).then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (cancelled) return;
      const p: FloorPlan = d?.plan?.areas?.length ? d.plan : emptyPlan();
      setPlan(p);
      setSavedJson(d?.plan?.areas?.length ? strip(p) : "");
      setBasePlan(d?.plan?.areas?.length ? d.plan : null);
      setSchedules(d?.schedules ?? []);
      setAreaId(p.areas[0].id);
    }).catch(() => toast.error("Could not load the floor plan"));
    return () => { cancelled = true; };
  }, [restaurantId]);

  const area: FloorArea | undefined = plan?.areas.find((a) => a.id === areaId) ?? plan?.areas[0];

  /** A change that can be undone */
  const commit = useCallback((next: FloorPlan) => {
    const cur = planRef.current;
    if (cur) { past.current.push(strip(cur)); if (past.current.length > 100) past.current.shift(); }
    future.current = [];
    setPlan(next);
    bump();
  }, []);
  const undo = useCallback(() => {
    const cur = planRef.current; const prev = past.current.pop();
    if (!cur || !prev) return;
    future.current.push(strip(cur)); setPlan(JSON.parse(prev)); bump();
  }, []);
  const redo = useCallback(() => {
    const cur = planRef.current; const next = future.current.pop();
    if (!cur || !next) return;
    past.current.push(strip(cur)); setPlan(JSON.parse(next)); bump();
  }, []);

  const updateArea = useCallback((fn: (a: FloorArea) => FloorArea, history = true) => {
    const cur = planRef.current; if (!cur) return;
    const next = { ...cur, areas: cur.areas.map((a) => (a.id === (area?.id ?? "") ? fn(a) : a)) };
    if (history) commit(next); else setPlan(next);
  }, [area?.id, commit]);
  const updateObject = useCallback((id: string, patch: Partial<FloorObject>, history = true) => {
    updateArea((a) => ({ ...a, objects: a.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)) }), history);
  }, [updateArea]);

  // Fit the area to the screen width
  const fit = useCallback(() => {
    const el = wrapRef.current; if (!el || !area) return;
    const z = Math.max(10, Math.min(200, Math.floor(Math.min((el.clientWidth - 48) / area.width, (Math.max(420, window.innerHeight - 260)) / area.height))));
    setZoom(z);
  }, [area]);
  useEffect(() => { if (area) fit(); }, [area?.id, area?.width, area?.height]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Pointer position in meters */
  const toPlan = (clientX: number, clientY: number) => {
    const svg = svgRef.current; if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint(); pt.x = clientX; pt.y = clientY;
    const m = svg.getScreenCTM(); if (!m) return { x: 0, y: 0 };
    const p = pt.matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };

  function add(kindIndex: number, at?: { x: number; y: number }) {
    if (!plan || !area) return;
    const k = OBJECT_KINDS[kindIndex];
    const spot = at ?? { x: area.width / 2 + (area.objects.length % 5) * 0.3, y: area.height / 2 + (area.objects.length % 5) * 0.3 };
    const o = makeObject(kindIndex, snapTo(spot.x, snap), snapTo(spot.y, snap), k.type === "table" ? nextTableLabel(plan) : undefined);
    updateArea((a) => ({ ...a, objects: [...a.objects, o] }));
    setSelected([o.id]);
  }

  function removeSelected() {
    if (!selected.length) return;
    updateArea((a) => ({ ...a, objects: a.objects.filter((o) => !selected.includes(o.id)) }));
    setSelected([]);
  }
  function duplicateSelected() {
    if (!plan || !area || !selected.length) return;
    let p = plan;
    const copies: FloorObject[] = [];
    for (const o of area.objects.filter((x) => selected.includes(x.id))) {
      const c: FloorObject = { ...o, id: newId(), x: r2(o.x + 0.5), y: r2(o.y + 0.5) };
      if (c.type === "table") { c.label = nextTableLabel(p); p = { ...p, areas: p.areas.map((a) => (a.id === area.id ? { ...a, objects: [...a.objects, c] } : a)) }; }
      copies.push(c);
    }
    updateArea((a) => ({ ...a, objects: [...a.objects, ...copies] }));
    setSelected(copies.map((c) => c.id));
  }

  // Keyboard: delete, undo/redo, duplicate, arrows, escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); return; }
      if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); duplicateSelected(); return; }
      if (!selected.length) return;
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeSelected(); return; }
      if (e.key === "Escape") { setSelected([]); return; }
      const step = e.shiftKey ? 0.5 : 0.1;
      const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (d) {
        e.preventDefault();
        updateArea((a) => ({ ...a, objects: a.objects.map((o) => (selected.includes(o.id) ? { ...o, x: r2(o.x + d[0]), y: r2(o.y + d[1]) } : o)) }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ── Pointer: move, resize, rotate ──
  function startMove(e: React.PointerEvent, o: FloorObject) {
    e.stopPropagation();
    if (!area || !plan) return;
    let sel = selected;
    if (e.shiftKey) sel = selected.includes(o.id) ? selected.filter((x) => x !== o.id) : [...selected, o.id];
    else if (!selected.includes(o.id)) sel = [o.id];
    setSelected(sel);
    const items = area.objects.filter((x) => sel.includes(x.id)).map((x) => ({ id: x.id, x: x.x, y: x.y }));
    drag.current = { kind: "move", start: toPlan(e.clientX, e.clientY), items, before: strip(plan), moved: false };
    svgRef.current?.setPointerCapture(e.pointerId);
  }
  function startResize(e: React.PointerEvent, o: FloorObject) {
    e.stopPropagation();
    if (!plan) return;
    drag.current = { kind: "resize", id: o.id, o: { ...o }, before: strip(plan) };
    svgRef.current?.setPointerCapture(e.pointerId);
  }
  function startRotate(e: React.PointerEvent, o: FloorObject) {
    e.stopPropagation();
    if (!plan) return;
    drag.current = { kind: "rotate", id: o.id, before: strip(plan) };
    svgRef.current?.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current; if (!d || !area) return;
    const p = toPlan(e.clientX, e.clientY);
    if (d.kind === "move") {
      const dx = p.x - d.start.x, dy = p.y - d.start.y;
      if (!d.moved && Math.hypot(dx, dy) < 0.04) return;
      d.moved = true;
      // Snap the first one to the grid, the others keep their distance
      const lead = d.items[0];
      const sx = snapTo(lead.x + dx, snap && !e.altKey) - lead.x, sy = snapTo(lead.y + dy, snap && !e.altKey) - lead.y;
      updateArea((a) => ({ ...a, objects: a.objects.map((o) => { const it = d.items.find((i) => i.id === o.id); return it ? { ...o, x: r2(it.x + sx), y: r2(it.y + sy) } : o; }) }), false);
    } else if (d.kind === "resize") {
      const o = d.o;
      const c = Math.cos(rad(o.rotation)), s = Math.sin(rad(o.rotation));
      // Pointer in the object's own frame (from its old center); the opposite corner stays where it is
      const lx = (p.x - o.x) * c + (p.y - o.y) * s, ly = -(p.x - o.x) * s + (p.y - o.y) * c;
      const thin = o.type === "wall" || o.type === "window";
      const min = 0.2;
      let w = Math.max(min, snapTo(lx + o.w / 2, snap && !e.altKey, 0.05));
      let h = thin ? o.h : Math.max(min, snapTo(ly + o.h / 2, snap && !e.altKey, 0.05));
      if ((o.type === "table" && o.shape !== "rect") || o.type === "plant") { const m = Math.max(w, h); w = m; h = m; }
      const fx = -o.w / 2, fy = -o.h / 2; // fixed corner
      const cxl = fx + w / 2, cyl = thin ? 0 : fy + h / 2;
      updateObject(o.id, { w: r2(w), h: r2(h), x: r2(o.x + cxl * c - cyl * s), y: r2(o.y + cxl * s + cyl * c) }, false);
    } else {
      const o = area.objects.find((x) => x.id === d.id); if (!o) return;
      let deg = (Math.atan2(p.y - o.y, p.x - o.x) * 180) / Math.PI + 90;
      if (snap && !e.altKey) deg = Math.round(deg / 15) * 15;
      deg = ((Math.round(deg) % 360) + 360) % 360;
      if (deg !== o.rotation) updateObject(o.id, { rotation: deg }, false);
    }
  }
  function onPointerUp() {
    const d = drag.current; drag.current = null;
    const cur = planRef.current;
    if (!d || !cur) return;
    if (strip(cur) !== d.before) { past.current.push(d.before); future.current = []; bump(); }
  }

  function onDrop(e: React.DragEvent) {
    const raw = e.dataTransfer.getData(DRAG_MIME);
    if (raw === "") return;
    e.preventDefault();
    add(Number(raw), toPlan(e.clientX, e.clientY));
  }

  async function save() {
    if (!plan) return;
    const dup = duplicateLabels(plan);
    setSaving(true);
    const res = await fetch(`/api/restaurants/${restaurantId}/floor-plan`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan, scheduleId: target }),
    }).catch(() => null);
    const d = await res?.json().catch(() => null);
    setSaving(false);
    if (!res?.ok || !d?.plan) { toast.error(d?.error ?? "Could not save. Please try again."); return; }
    setSavedJson(strip(plan));
    if (target) setSchedules(d.schedules ?? schedules); else setBasePlan(plan);
    toast.success(target ? "Scheduled plan saved" : "Floor plan saved");
    if (dup.length) toast(`Some tables have the same number: ${dup.join(", ")}. Give each table its own number so customers can pick one.`, { icon: "⚠️", duration: 7000 });
  }

  /** Edit another plan: the normal one (null) or a scheduled change */
  function switchTo(id: string | null, list = schedules, base = basePlan) {
    if (dirty && !window.confirm("Your changes to this plan aren't saved. Discard them?")) return false;
    const next = id ? list.find((s) => s.id === id)?.plan : base;
    if (!next) return false;
    const copy: FloorPlan = JSON.parse(JSON.stringify(next));
    setTarget(id); setPlan(copy); setSavedJson(strip(copy)); setAreaId(copy.areas[0].id); setSelected([]);
    past.current = []; future.current = []; bump();
    return true;
  }

  async function submitSchedule(v: { name: string; startAt: string; endAt: string | null }) {
    if (!plan || !scheduling) return;
    if (scheduling.mode === "new") {
      if (savedJson === "") { toast.error("Save your floor plan first, then schedule a change."); return; }
      const res = await fetch(`/api/restaurants/${restaurantId}/floor-plan`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...v, plan }),
      }).catch(() => null);
      const d = await res?.json().catch(() => null);
      if (!res?.ok || !d?.schedule) { toast.error(d?.error ?? "Could not schedule"); return; }
      setSchedules(d.schedules); setScheduling(null);
      // Edit the new scheduled plan right away (unsaved changes of the plan you were on went into it)
      const copy: FloorPlan = JSON.parse(JSON.stringify(d.schedule.plan));
      setTarget(d.schedule.id); setPlan(copy); setSavedJson(strip(copy)); setAreaId(copy.areas[0].id); setSelected([]);
      past.current = []; future.current = []; bump();
      toast.success(`"${d.schedule.name}" is scheduled. Change it as you like and press Save.`);
    } else {
      const res = await fetch(`/api/restaurants/${restaurantId}/floor-plan`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: scheduling.s.id, ...v }),
      }).catch(() => null);
      const d = await res?.json().catch(() => null);
      if (!res?.ok) { toast.error(d?.error ?? "Could not change it"); return; }
      setSchedules(d.schedules); setScheduling(null); toast.success("Saved");
    }
  }

  async function deleteSchedule(s: ScheduledPlan) {
    if (!window.confirm(`Delete the scheduled plan "${s.name}"? Customers keep seeing the normal plan.`)) return;
    const res = await fetch(`/api/restaurants/${restaurantId}/floor-plan?scheduleId=${encodeURIComponent(s.id)}`, { method: "DELETE" }).catch(() => null);
    const d = await res?.json().catch(() => null);
    if (!res?.ok) { toast.error(d?.error ?? "Could not delete"); return; }
    setSchedules(d.schedules);
    if (target === s.id) {
      const copy: FloorPlan = JSON.parse(JSON.stringify(basePlan ?? emptyPlan()));
      setTarget(null); setPlan(copy); setSavedJson(basePlan ? strip(copy) : ""); setAreaId(copy.areas[0].id); setSelected([]);
      past.current = []; future.current = []; bump();
    }
    toast.success("Deleted");
  }

  const stats = useMemo(() => (plan ? planStats(plan) : { tables: 0, seats: 0 }), [plan]);
  const areaStats = useMemo(() => (area ? planStats({ version: 1, areas: [area] }) : { tables: 0, seats: 0 }), [area]);
  const dups = useMemo(() => (plan ? duplicateLabels(plan) : []), [plan]);

  if (!plan || !area) return <div className="py-20 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-blue-500" /></div>;

  const one = selected.length === 1 ? area.objects.find((o) => o.id === selected[0]) ?? null : null;
  const handle = 9 / zoom; // handle radius in meters (about 9 px)
  const btn = "w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:text-blue-700 disabled:opacity-40";

  return (
    <div className="space-y-3">
      {/* Which plan: the normal one or a scheduled change */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-2 flex items-center gap-2 flex-wrap">
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 pl-1">
          Plan
          <select id="plan-target" value={target ?? ""} onChange={(e) => { const v = e.target.value || null; if (!switchTo(v)) e.target.value = target ?? ""; }}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white max-w-[260px]">
            <option value="">Normal plan</option>
            {schedules.map((s) => <option key={s.id} value={s.id}>{s.name} ({scheduleWhen(s)})</option>)}
          </select>
        </label>
        <button type="button" id="schedule-change" onClick={() => setScheduling({ mode: "new" })}
          className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl border-2 border-blue-500 text-blue-700 bg-blue-50 hover:bg-blue-100">
          <CalendarClock className="w-4 h-4" /> Schedule a change
        </button>
        {target && (() => {
          const s = schedules.find((x) => x.id === target);
          if (!s) return null;
          return (
            <div className="flex items-center gap-2 flex-wrap text-sm text-indigo-900 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-1.5" id="schedule-banner">
              <span>Customers see <span className="font-semibold">&quot;{s.name}&quot;</span> {scheduleWhen(s, true)}. Before and after that, the normal plan.</span>
              <button type="button" onClick={() => setScheduling({ mode: "edit", s })} className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:underline"><Pencil className="w-3 h-3" /> Name and times</button>
              <button type="button" onClick={() => deleteSchedule(s)} className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline"><Trash2 className="w-3 h-3" /> Delete</button>
            </div>
          );
        })()}
        {!target && schedules.length > 0 && <span className="text-xs text-gray-500">{schedules.length} scheduled change{schedules.length === 1 ? "" : "s"}, pick one above to edit it</span>}
      </div>
      {scheduling && (
        <ScheduleDialog initial={scheduling.mode === "edit" ? scheduling.s : null} onClose={() => setScheduling(null)} onSubmit={submitSchedule} />
      )}

      {/* Top bar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-2 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 flex-wrap" role="tablist" aria-label="Areas">
          {plan.areas.map((a) => (
            <button key={a.id} type="button" role="tab" aria-selected={a.id === area.id} onClick={() => { setAreaId(a.id); setSelected([]); }}
              className={`text-sm font-semibold px-3 py-2 rounded-xl ${a.id === area.id ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}>{a.name}</button>
          ))}
          <button type="button" id="add-area" onClick={() => {
            const name = window.prompt("Name of the new area (for example Terrace, First floor):", plan.areas.length === 1 ? "Terrace" : `Area ${plan.areas.length + 1}`);
            if (!name?.trim()) return;
            const a = newArea(name.trim().slice(0, 40));
            commit({ ...plan, areas: [...plan.areas, a] }); setAreaId(a.id); setSelected([]);
          }} disabled={plan.areas.length >= 10} className="inline-flex items-center gap-1 text-sm font-semibold px-3 py-2 rounded-xl text-blue-700 hover:bg-blue-50 disabled:opacity-40">
            <Plus className="w-4 h-4" /> Area
          </button>
        </div>
        <div className="flex-1" />
        <span className="text-xs text-gray-500 px-1" id="plan-stats">{stats.tables} table{stats.tables === 1 ? "" : "s"} · {stats.seats} seats</span>
        <button type="button" onClick={undo} disabled={!hist.back} className={btn} title="Undo (Ctrl+Z)" aria-label="Undo"><Undo2 className="w-4 h-4" /></button>
        <button type="button" onClick={redo} disabled={!hist.forward} className={btn} title="Redo (Ctrl+Shift+Z)" aria-label="Redo"><Redo2 className="w-4 h-4" /></button>
        <button type="button" onClick={() => setSnap((v) => !v)} aria-pressed={snap} title="Snap to the grid (hold Alt to move freely)"
          className={`${btn} ${snap ? "!border-blue-400 !text-blue-700 bg-blue-50" : ""}`} aria-label="Snap to the grid"><Magnet className="w-4 h-4" /></button>
        <button type="button" onClick={() => setZoom((z) => Math.max(10, Math.round(z / 1.25)))} className={btn} aria-label="Zoom out" title="Zoom out"><ZoomOut className="w-4 h-4" /></button>
        <button type="button" onClick={fit} className={btn} aria-label="Fit to screen" title="Fit to screen"><Maximize className="w-4 h-4" /></button>
        <button type="button" onClick={() => setZoom((z) => Math.min(200, Math.round(z * 1.25)))} className={btn} aria-label="Zoom in" title="Zoom in"><ZoomIn className="w-4 h-4" /></button>
        <button type="button" onClick={save} disabled={saving || (!dirty && savedJson !== "")} id="save-plan"
          className="inline-flex items-center gap-2 text-sm font-semibold text-white px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 disabled:opacity-40">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {dirty || savedJson === "" ? "Save" : "Saved"}
        </button>
      </div>

      <div className="grid gap-3 lg:grid-cols-[13rem_minmax(0,1fr)_17rem] items-start">
        {/* Palette */}
        <aside className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3" aria-label="Add to the plan">
          <div className="text-xs font-semibold text-gray-500 mb-2">Drag onto the plan, or click</div>
          <div className="grid grid-cols-3 lg:grid-cols-2 gap-2">
            {OBJECT_KINDS.map((k, i) => (
              <button key={k.label} type="button" draggable data-kind={k.label}
                onDragStart={(e) => { e.dataTransfer.setData(DRAG_MIME, String(i)); e.dataTransfer.effectAllowed = "copy"; }}
                onClick={() => add(i)}
                className="flex flex-col items-center gap-1 rounded-xl border border-gray-100 bg-gray-50 hover:border-blue-300 hover:bg-blue-50 p-2 text-[11px] font-semibold text-gray-700 cursor-grab active:cursor-grabbing">
                <PaletteIcon index={i} />
                <span className="text-center leading-tight">{k.label}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* Plan */}
        <div ref={wrapRef} className="bg-gray-100 rounded-2xl border border-gray-200 overflow-auto max-h-[calc(100vh-14rem)] min-h-[420px] p-6"
          onDragOver={(e) => { if (e.dataTransfer.types.includes(DRAG_MIME)) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } }} onDrop={onDrop}>
          <svg ref={svgRef} data-plan width={area.width * zoom} height={area.height * zoom} viewBox={`0 0 ${area.width} ${area.height}`}
            className="bg-white shadow-sm touch-none select-none mx-auto block" style={{ overflow: "visible" }}
            onPointerDown={() => setSelected([])} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
            <defs>
              <pattern id="grid-minor" width={0.5} height={0.5} patternUnits="userSpaceOnUse"><path d="M 0.5 0 L 0 0 0 0.5" fill="none" stroke="#eef2f7" strokeWidth={0.01} /></pattern>
              <pattern id="grid-major" width={1} height={1} patternUnits="userSpaceOnUse"><rect width={1} height={1} fill="url(#grid-minor)" /><path d="M 1 0 L 0 0 0 1" fill="none" stroke="#e2e8f0" strokeWidth={0.02} /></pattern>
            </defs>
            <rect width={area.width} height={area.height} fill="url(#grid-major)" />
            {/* Rooms first (under everything), then the rest in order */}
            {[...area.objects.filter((o) => o.type === "room"), ...area.objects.filter((o) => o.type !== "room")].map((o) => (
              <g key={o.id} data-object={o.type} data-label={o.label ?? ""} transform={`translate(${o.x} ${o.y}) rotate(${o.rotation})`}
                onPointerDown={(e) => startMove(e, o)} className="cursor-move">
                <Shape o={o} />
              </g>
            ))}
            {/* Selection */}
            {area.objects.filter((o) => selected.includes(o.id)).map((o) => {
              const pad = o.type === "table" ? 0.5 : 0.08;
              return (
                <g key={`sel-${o.id}`} transform={`translate(${o.x} ${o.y}) rotate(${o.rotation})`}>
                  <rect x={-o.w / 2 - pad} y={-o.h / 2 - pad} width={o.w + pad * 2} height={o.h + pad * 2} fill="none" stroke="#2563eb" strokeWidth={2 / zoom} strokeDasharray={`${6 / zoom} ${4 / zoom}`} pointerEvents="none" />
                  {one && one.id === o.id && (
                    <>
                      <line x1={0} y1={-o.h / 2 - pad} x2={0} y2={-o.h / 2 - pad - 24 / zoom} stroke="#2563eb" strokeWidth={1.5 / zoom} />
                      <circle data-handle="rotate" cx={0} cy={-o.h / 2 - pad - 24 / zoom} r={handle} fill="#fff" stroke="#2563eb" strokeWidth={2 / zoom} className="cursor-grab" onPointerDown={(e) => startRotate(e, o)} />
                      <rect data-handle="resize" x={o.w / 2 - handle} y={(o.type === "wall" || o.type === "window" ? 0 : o.h / 2) - handle} width={handle * 2} height={handle * 2} rx={handle * 0.3}
                        fill="#2563eb" stroke="#fff" strokeWidth={1.5 / zoom} className="cursor-nwse-resize" onPointerDown={(e) => startResize(e, o)} />
                    </>
                  )}
                </g>
              );
            })}
          </svg>
          <p className="mt-3 text-center text-[11px] text-gray-500">Grid: 1 m squares · {area.width} x {area.height} m · hold Alt to move without snapping</p>
        </div>

        {/* Settings */}
        <aside className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4" aria-label="Settings">
          {one ? (
            <ObjectSettings key={one.id} o={one} plan={plan} onChange={(patch) => updateObject(one.id, patch)} onDelete={removeSelected} onDuplicate={duplicateSelected} onClose={() => setSelected([])} />
          ) : selected.length > 1 ? (
            <div className="space-y-3">
              <div className="text-sm font-semibold text-gray-900">{selected.length} selected</div>
              <p className="text-xs text-gray-500">Drag one of them to move them together.</p>
              <div className="flex gap-2">
                <button type="button" onClick={duplicateSelected} className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-semibold rounded-xl border border-gray-200 py-2 hover:bg-gray-50"><Copy className="w-4 h-4" /> Duplicate</button>
                <button type="button" onClick={removeSelected} className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-semibold rounded-xl border border-red-200 text-red-600 py-2 hover:bg-red-50"><Trash2 className="w-4 h-4" /> Delete</button>
              </div>
            </div>
          ) : (
            <AreaSettings area={area} canDelete={plan.areas.length > 1} stats={areaStats}
              onChange={(patch) => updateArea((a) => ({ ...a, ...patch }))}
              onDelete={() => {
                if (!window.confirm(`Delete the area "${area.name}" with everything in it?`)) return;
                const rest = plan.areas.filter((a) => a.id !== area.id);
                commit({ ...plan, areas: rest }); setAreaId(rest[0].id); setSelected([]);
              }} />
          )}
          {dups.length > 0 && (
            <p className="flex items-start gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2" id="dup-warning">
              <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" /> Tables with the same number: {dups.join(", ")}. Give each table its own number, customers will pick tables by it.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

// ── Settings panels ──────────────────────────────────────────────────────────

const inputCls = "w-full text-sm border border-gray-200 rounded-lg px-2.5 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500";

function Num({ label, value, onChange, step = 0.1, min = 0.1, max = 200, suffix = "m", id }: { label: string; value: number; onChange: (n: number) => void; step?: number; min?: number; max?: number; suffix?: string; id?: string }) {
  const [text, setText] = useState(String(value));
  const [last, setLast] = useState(value);
  if (last !== value) { setLast(value); setText(String(value)); }
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold text-gray-500 mb-1">{label}</span>
      <span className="relative block">
        <input id={id} type="number" inputMode="decimal" step={step} min={min} max={max} value={text}
          onChange={(e) => { setText(e.target.value); const n = Number(e.target.value); if (e.target.value !== "" && Number.isFinite(n) && n >= min && n <= max) onChange(r2(n)); }}
          className={`${inputCls} pr-9`} />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">{suffix}</span>
      </span>
    </label>
  );
}

function Colors({ value, onChange }: { value?: string; onChange: (c: string) => void }) {
  return (
    <div>
      <span className="block text-[11px] font-semibold text-gray-500 mb-1">Color</span>
      <div className="flex flex-wrap gap-1.5">
        {SWATCHES.map((c) => (
          <button key={c} type="button" onClick={() => onChange(c)} aria-label={`Color ${c}`}
            className={`w-6 h-6 rounded-md border ${value === c ? "ring-2 ring-blue-500 ring-offset-1 border-white" : "border-gray-200"}`} style={{ background: c }} />
        ))}
      </div>
    </div>
  );
}

const TITLES: Record<string, string> = { table: "Table", wall: "Wall", window: "Window", door: "Door", plant: "Plant", room: "Room / zone", text: "Text", bar: "Bar counter", pillar: "Pillar" };

function ObjectSettings({ o, plan, onChange, onDelete, onDuplicate, onClose }: {
  o: FloorObject; plan: FloorPlan; onChange: (p: Partial<FloorObject>) => void; onDelete: () => void; onDuplicate: () => void; onClose: () => void;
}) {
  const sameNumber = o.type === "table" && !!o.label && plan.areas.flatMap((a) => a.objects).filter((x) => x.type === "table" && x.id !== o.id && (x.label ?? "").trim().toLowerCase() === o.label!.trim().toLowerCase()).length > 0;
  const thin = o.type === "wall" || o.type === "window";
  const setShape = (shape: TableShape) => onChange({ shape, ...tableSize(shape, o.seats ?? 4) });
  const setSeats = (seats: number) => {
    const s = Math.max(1, Math.min(30, Math.round(seats)));
    // "at least" can't be more than the seats
    onChange({ seats: s, ...tableSize(o.shape ?? "square", s), ...((o.minGuests ?? 1) > s ? { minGuests: s > 1 ? s : undefined } : {}) });
  };
  return (
    <div className="space-y-4" data-settings={o.type}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-bold text-gray-900">{TITLES[o.type]}{o.type === "table" && o.label ? ` ${o.label}` : ""}</div>
        <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded-lg text-gray-400 hover:bg-gray-100"><X className="w-4 h-4" /></button>
      </div>

      {o.type === "table" && (
        <>
          <label className="block">
            <span className="block text-[11px] font-semibold text-gray-500 mb-1">Table number or name</span>
            <input id="table-label" value={o.label ?? ""} maxLength={40} onChange={(e) => onChange({ label: e.target.value })} className={inputCls} placeholder="T1" />
            {sameNumber && <span className="block text-xs text-amber-700 mt-1">Another table has this number.</span>}
          </label>
          <div>
            <span className="block text-[11px] font-semibold text-gray-500 mb-1">Seats</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setSeats((o.seats ?? 1) - 1)} disabled={(o.seats ?? 1) <= 1} className="w-9 h-9 rounded-lg border border-gray-200 text-lg font-bold text-gray-700 disabled:opacity-40" aria-label="One seat less">−</button>
              <input id="table-seats" type="number" min={1} max={30} value={o.seats ?? 1} onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n) && n >= 1) setSeats(n); }} className={`${inputCls} w-16 text-center`} />
              <button type="button" onClick={() => setSeats((o.seats ?? 1) + 1)} disabled={(o.seats ?? 1) >= 30} className="w-9 h-9 rounded-lg border border-gray-200 text-lg font-bold text-gray-700 disabled:opacity-40" aria-label="One seat more">+</button>
            </div>
          </div>
          <div>
            <span className="block text-[11px] font-semibold text-gray-500 mb-1">Shape</span>
            <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Shape">
              {([["round", "Round"], ["square", "Square"], ["rect", "Long"]] as [TableShape, string][]).map(([s, l]) => (
                <button key={s} type="button" role="radio" aria-checked={o.shape === s} onClick={() => setShape(s)}
                  className={`text-xs font-semibold rounded-lg border py-2 ${o.shape === s ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>{l}</button>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-gray-500">The size follows the seats. You can still change it below or with the corner handle.</p>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 space-y-2" data-reserve-settings>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
              <input type="checkbox" id="table-reservable" checked={o.reservable !== false} onChange={(e) => onChange({ reservable: e.target.checked ? undefined : false })} className="accent-emerald-600 w-4 h-4" />
              Customers can reserve this table
            </label>
            {o.reservable !== false && (
              <label className="block">
                <span className="block text-[11px] font-semibold text-gray-500 mb-1">Reserve only for at least</span>
                <select id="table-min" value={Math.min(o.minGuests ?? 1, o.seats ?? 1)} onChange={(e) => { const n = Number(e.target.value); onChange({ minGuests: n > 1 ? n : undefined }); }} className={inputCls}>
                  {Array.from({ length: o.seats ?? 1 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} person{n === 1 ? "" : "s"}{n === 1 ? " (anyone)" : ""}</option>)}
                </select>
                <span className="block text-[11px] text-gray-500 mt-1">For example a table for {o.seats ?? 4} only for groups of {Math.max(1, (o.seats ?? 4) - 1)} or more.</span>
              </label>
            )}
          </div>
        </>
      )}

      {(o.type === "room" || o.type === "text" || o.type === "bar" || o.type === "door") && (
        <label className="block">
          <span className="block text-[11px] font-semibold text-gray-500 mb-1">{o.type === "room" ? "Name (for example Kitchen, WC)" : o.type === "door" ? "Name (optional, e.g. Entrance)" : "Text"}</span>
          <input id="object-label" value={o.label ?? ""} maxLength={o.type === "text" ? 120 : 40} onChange={(e) => onChange({ label: e.target.value })} className={inputCls} />
        </label>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Num id="object-w" label={thin ? "Length" : o.type === "table" && o.shape === "round" ? "Diameter" : "Width"} value={o.w}
          onChange={(w) => onChange(o.type === "table" && o.shape !== "rect" || o.type === "plant" ? { w, h: w } : { w })} />
        {!(o.type === "table" && o.shape !== "rect") && o.type !== "plant" && (
          <Num id="object-h" label={thin ? "Thickness" : "Depth"} value={o.h} step={thin ? 0.05 : 0.1} min={0.05} onChange={(h) => onChange({ h })} />
        )}
      </div>

      <div>
        <span className="block text-[11px] font-semibold text-gray-500 mb-1">Turn</span>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => onChange({ rotation: (o.rotation + 345) % 360 })} className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-700" aria-label="Turn left 15°"><RotateCcw className="w-4 h-4" /></button>
          <span className="text-sm font-semibold text-gray-800 w-12 text-center" id="object-rotation">{o.rotation}°</span>
          <button type="button" onClick={() => onChange({ rotation: (o.rotation + 15) % 360 })} className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-700" aria-label="Turn right 15°"><RotateCw className="w-4 h-4" /></button>
          <button type="button" onClick={() => onChange({ rotation: (o.rotation + 90) % 360 })} className="ml-auto text-xs font-semibold rounded-lg border border-gray-200 px-2.5 py-2 text-gray-700 hover:bg-gray-50">+90°</button>
        </div>
      </div>

      {(o.type === "room" || o.type === "text") && (
        <Num label="Text size" value={o.fontSize ?? 0.4} step={0.05} min={0.15} max={3} onChange={(fontSize) => onChange({ fontSize })} />
      )}
      {o.type === "door" && (
        <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={!!o.flip} onChange={(e) => onChange({ flip: e.target.checked })} className="accent-blue-600" /> Opens the other way</label>
      )}
      {(o.type === "wall" || o.type === "room" || o.type === "bar" || o.type === "text") && <Colors value={o.color} onChange={(color) => onChange({ color })} />}

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onDuplicate} className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-semibold rounded-xl border border-gray-200 py-2 hover:bg-gray-50" title="Ctrl+D"><Copy className="w-4 h-4" /> Duplicate</button>
        <button type="button" onClick={onDelete} id="delete-object" className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-semibold rounded-xl border border-red-200 text-red-600 py-2 hover:bg-red-50" title="Delete key"><Trash2 className="w-4 h-4" /> Delete</button>
      </div>
    </div>
  );
}

function AreaSettings({ area, canDelete, stats, onChange, onDelete }: {
  area: FloorArea; canDelete: boolean; stats: { tables: number; seats: number }; onChange: (p: Partial<FloorArea>) => void; onDelete: () => void;
}) {
  return (
    <div className="space-y-4" data-settings="area">
      <div className="text-sm font-bold text-gray-900">Area</div>
      <label className="block">
        <span className="block text-[11px] font-semibold text-gray-500 mb-1">Name</span>
        <input id="area-name" value={area.name} maxLength={40} onChange={(e) => onChange({ name: e.target.value })} className={inputCls} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <Num id="area-width" label="Width" value={area.width} step={0.5} min={3} max={200} onChange={(width) => onChange({ width })} />
        <Num id="area-height" label="Length" value={area.height} step={0.5} min={3} max={200} onChange={(height) => onChange({ height })} />
      </div>
      <div className="text-xs text-gray-600">{stats.tables} table{stats.tables === 1 ? "" : "s"} and {stats.seats} seats in this area</div>
      <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 text-xs text-gray-600 space-y-1">
        <div className="font-semibold text-gray-800 flex items-center gap-1"><Info className="w-3.5 h-3.5" /> How it works</div>
        <p>Drag things from the left onto the plan. Click one to change it, drag to move.</p>
        <p>Blue square: make it bigger or smaller. Round handle on top: turn it.</p>
        <p>Delete key removes, Ctrl+D duplicates, arrows nudge, Ctrl+Z undoes. Shift-click picks more than one.</p>
      </div>
      {canDelete && (
        <button type="button" onClick={onDelete} className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-semibold rounded-xl border border-red-200 text-red-600 py-2 hover:bg-red-50"><Trash2 className="w-4 h-4" /> Delete this area</button>
      )}
    </div>
  );
}

// ── Scheduled changes ────────────────────────────────────────────────────────

const fWhen = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
function scheduleWhen(s: ScheduledPlan, long = false) {
  const from = fWhen.format(new Date(s.startAt));
  if (!s.endAt) return long ? `from ${from} on` : `from ${from}`;
  return `${long ? "from " : ""}${from} to ${fWhen.format(new Date(s.endAt))}`;
}
const localValue = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

function ScheduleDialog({ initial, onClose, onSubmit }: { initial: ScheduledPlan | null; onClose: () => void; onSubmit: (v: { name: string; startAt: string; endAt: string | null }) => Promise<void> }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [from, setFrom] = useState(() => (initial ? localValue(initial.startAt) : ""));
  const [until, setUntil] = useState(() => (initial?.endAt ? localValue(initial.endAt) : ""));
  const [busy, setBusy] = useState(false);
  const ok = !!name.trim() && !!from && (!until || new Date(until) > new Date(from));
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={() => !busy && onClose()}>
      <div className="fixed inset-0 bg-black/40" />
      <form role="dialog" aria-modal="true" aria-label="Schedule a change" onClick={(e) => e.stopPropagation()}
        onSubmit={async (e) => { e.preventDefault(); if (!ok) return; setBusy(true); await onSubmit({ name: name.trim(), startAt: new Date(from).toISOString(), endAt: until ? new Date(until).toISOString() : null }); setBusy(false); }}
        className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 space-y-4">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"><X className="w-5 h-5" /></button>
        <div>
          <h2 className="text-lg font-bold text-gray-900">{initial ? "Name and times" : "Schedule a change of the floor plan"}</h2>
          <p className="text-sm text-gray-500">{initial ? "When customers see this plan." : "It starts as a copy of the plan you're on now. Then change it as you like, for example open the terrace in summer."}</p>
        </div>
        <label className="block"><span className="block text-sm font-medium text-gray-700 mb-1">Name</span>
          <input id="schedule-name" required value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. Summer terrace" className={inputCls} /></label>
        <label className="block"><span className="block text-sm font-medium text-gray-700 mb-1">From</span>
          <input id="schedule-from" required type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} /></label>
        <label className="block"><span className="block text-sm font-medium text-gray-700 mb-1">Until <span className="text-gray-400 font-normal">(optional)</span></span>
          <input id="schedule-until" type="datetime-local" value={until} min={from || undefined} onChange={(e) => setUntil(e.target.value)} className={inputCls} />
          <span className="block text-[11px] text-gray-500 mt-1">{until ? "After this, the normal plan counts again." : "No end: from then on this plan counts."}</span></label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="text-sm font-medium text-gray-600 px-3 py-2 rounded-xl hover:bg-gray-100">Cancel</button>
          <button type="submit" disabled={!ok || busy} id="schedule-save" className="inline-flex items-center gap-2 text-sm font-semibold text-white px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 disabled:opacity-40">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarClock className="w-4 h-4" />} {initial ? "Save" : "Schedule"}
          </button>
        </div>
      </form>
    </div>
  );
}
