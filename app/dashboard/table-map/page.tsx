"use client";
import { useEffect, useRef, useState } from "react";
import { Save, Plus, Trash2, LayoutGrid, Move, Square } from "lucide-react";
import toast from "react-hot-toast";

interface Table { id: string; label: string; x: number; y: number; w: number; h: number; shape: "rect" | "round"; seats: number; section: string; status?: "free" | "occupied" | "reserved"; }

const COLORS: Record<string, string> = { "": "#f97316", "Indoor": "#3b82f6", "Outdoor": "#22c55e", "Bar": "#7c3aed", "Terrace": "#f59e0b" };

export default function TableMapPage() {
  const [restaurantId, setRestaurantId] = useState("");
  const [tables, setTables] = useState<Table[]>([]);
  const [sections, setSections] = useState<string[]>(["Indoor", "Outdoor", "Bar", "Terrace"]);
  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; ox: number; oy: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  useEffect(() => {
    (async () => {
      const s = await fetch("/api/dashboard/stats").then(r => r.json());
      setRestaurantId(s.restaurantId);
      const d = await fetch(`/api/restaurants/${s.restaurantId}/table-map`).then(r => r.json());
      if (d.tables?.length) { setTables(d.tables); nextId.current = d.tables.length + 1; }
      if (d.sections?.length) setSections(d.sections);
      setLoading(false);
    })();
  }, []);

  function addTable() {
    const id = `t${nextId.current++}`;
    setTables(t => [...t, { id, label: id, x: 40 + Math.random()*200, y: 40 + Math.random()*150, w: 80, h: 60, shape: "rect", seats: 4, section: sections[0] || "" }]);
    setSelected(id);
  }

  function deleteSelected() {
    if (!selected) return;
    setTables(t => t.filter(x => x.id !== selected));
    setSelected(null);
  }

  function updateSelected(patch: Partial<Table>) {
    if (!selected) return;
    setTables(t => t.map(x => x.id === selected ? { ...x, ...patch } : x));
  }

  const sel = tables.find(t => t.id === selected);

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/restaurants/${restaurantId}/table-map`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tables, sections }),
    });
    setSaving(false);
    if (res.ok) toast.success("Table map saved!"); else toast.error("Failed to save");
  }

  if (loading) return <div className="p-6 flex justify-center h-64 items-center"><div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><LayoutGrid className="w-6 h-6 text-orange-500" /> Table Map</h1>
          <p className="text-sm text-gray-500 mt-1">Drag tables to build your floor plan · click to edit details</p>
        </div>
        <div className="flex gap-2">
          <button onClick={addTable} className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl transition-colors">
            <Plus className="w-4 h-4" /> Add Table
          </button>
          <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60">
            <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save Map"}
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Canvas */}
        <div
          ref={canvasRef}
          className="flex-1 bg-white rounded-2xl border-2 border-dashed border-gray-200 relative overflow-hidden"
          style={{ minHeight: "400px", backgroundImage: "radial-gradient(circle, #e5e7eb 1px, transparent 1px)", backgroundSize: "24px 24px" }}
          onMouseMove={e => {
            if (!dragging || !canvasRef.current) return;
            const rect = canvasRef.current.getBoundingClientRect();
            const nx = e.clientX - rect.left - dragging.ox;
            const ny = e.clientY - rect.top - dragging.oy;
            setTables(t => t.map(x => x.id === dragging.id ? { ...x, x: Math.max(0, nx), y: Math.max(0, ny) } : x));
          }}
          onMouseUp={() => setDragging(null)}
          onMouseLeave={() => setDragging(null)}
          onClick={e => { if (e.target === canvasRef.current) setSelected(null); }}
        >
          {tables.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300 pointer-events-none">
              <Square className="w-12 h-12 mb-2" />
              <p className="text-sm font-medium">Click "Add Table" to start building your floor plan</p>
            </div>
          )}
          {tables.map(t => {
            const color = COLORS[t.section] ?? "#f97316";
            const isSelected = t.id === selected;
            return (
              <div key={t.id}
                className={`absolute cursor-move select-none flex flex-col items-center justify-center text-white text-xs font-bold transition-shadow ${isSelected ? "ring-2 ring-offset-1 ring-orange-400 shadow-lg" : "shadow"}`}
                style={{
                  left: t.x, top: t.y, width: t.w, height: t.h,
                  backgroundColor: color,
                  borderRadius: t.shape === "round" ? "50%" : "12px",
                  opacity: 0.9,
                }}
                onMouseDown={e => {
                  e.stopPropagation();
                  setSelected(t.id);
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  const canvas = canvasRef.current!.getBoundingClientRect();
                  setDragging({ id: t.id, ox: e.clientX - rect.left, oy: e.clientY - canvas.top - (rect.top - canvas.top) });
                }}
              >
                <span className="leading-none">{t.label}</span>
                <span className="text-[9px] opacity-80 leading-none mt-0.5">{t.seats}p</span>
              </div>
            );
          })}
        </div>

        {/* Inspector */}
        <div className="w-56 flex-shrink-0 space-y-3">
          {sel ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-gray-900 text-sm">Table {sel.label}</p>
                <button onClick={deleteSelected} className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              <div><label className="text-[10px] font-medium text-gray-500 block mb-1">Label</label>
                <input value={sel.label} onChange={e => updateSelected({ label: e.target.value })} className="w-full px-2.5 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/30" />
              </div>
              <div><label className="text-[10px] font-medium text-gray-500 block mb-1">Section</label>
                <select value={sel.section} onChange={e => updateSelected({ section: e.target.value })} className="w-full px-2.5 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/30">
                  {sections.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div><label className="text-[10px] font-medium text-gray-500 block mb-1">Seats</label>
                <input type="number" min="1" max="20" value={sel.seats} onChange={e => updateSelected({ seats: Number(e.target.value) })} className="w-full px-2.5 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/30" />
              </div>
              <div><label className="text-[10px] font-medium text-gray-500 block mb-1">Shape</label>
                <div className="flex gap-2">
                  {(["rect","round"] as const).map(s => (
                    <button key={s} onClick={() => updateSelected({ shape: s })}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border-2 transition-all ${sel.shape === s ? "border-orange-500 bg-orange-50 text-orange-600" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}>
                      {s === "rect" ? "Square" : "Round"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[10px] font-medium text-gray-500 block mb-1">Width</label>
                  <input type="number" min="40" max="200" value={sel.w} onChange={e => updateSelected({ w: Number(e.target.value) })} className="w-full px-2.5 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none" />
                </div>
                <div><label className="text-[10px] font-medium text-gray-500 block mb-1">Height</label>
                  <input type="number" min="40" max="200" value={sel.h} onChange={e => updateSelected({ h: Number(e.target.value) })} className="w-full px-2.5 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none" />
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-4 text-center">
              <Move className="w-6 h-6 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-400">Click a table to edit its details</p>
            </div>
          )}

          {/* Section legend */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-600 mb-2">Sections</p>
            <div className="space-y-1.5">
              {sections.map(s => (
                <div key={s} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: COLORS[s] ?? "#9ca3af" }} />
                  <span className="text-xs text-gray-600">{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Table list */}
      {tables.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{tables.length} table{tables.length !== 1 ? "s" : ""} · {tables.reduce((s,t) => s + t.seats, 0)} total seats</p>
          <div className="flex flex-wrap gap-2">
            {tables.map(t => (
              <button key={t.id} onClick={() => setSelected(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${selected === t.id ? "border-orange-500 bg-orange-50 text-orange-600" : "border-gray-100 text-gray-600 hover:border-gray-300"}`}>
                <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: COLORS[t.section] ?? "#9ca3af" }} />
                {t.label} · {t.seats}p
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
