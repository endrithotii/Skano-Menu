"use client";
import { useEffect, useState } from "react";
import { Sliders, Save, Building2, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

interface Restaurant { id: string; name: string; slug: string; planTier: string; isVerified: boolean; healthScore: number | null; notes: string | null; }

const PLANS = ["free","starter","pro","enterprise"] as const;

export default function FeatureFlagsPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string,Partial<Restaurant>>>({});

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const d = await fetch("/api/admin/platform-stats").then(r => r.json());
    // Fetch full restaurant list
    const all = await fetch("/api/admin/restaurants").then(r => r.json());
    setRestaurants((all.restaurants ?? []).map((r: any) => ({
      id: r.id, name: r.name, slug: r.slug,
      planTier: r.planTier ?? "free",
      isVerified: !!(r.isVerified === 1 || r.isVerified === true),
      healthScore: r.healthScore ?? null,
      notes: r.notes ?? null,
    })));
    setLoading(false);
  }

  function edit(id: string, patch: Partial<Restaurant>) {
    setEdits(e => ({ ...e, [id]: { ...(e[id] ?? {}), ...patch } }));
  }

  async function save(id: string) {
    const patch = edits[id];
    if (!patch) return;
    setSaving(id);
    const res = await fetch(`/api/admin/restaurant-health`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId: id, ...patch }),
    });
    setSaving(null);
    if (res.ok) {
      toast.success("Saved!");
      setEdits(e => { const n = {...e}; delete n[id]; return n; });
      setRestaurants(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r));
    } else toast.error("Failed to save");
  }

  if (loading) return <div className="flex justify-center p-12"><div className="animate-spin w-7 h-7 border-2 border-orange-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Sliders className="w-6 h-6 text-orange-500" /> Restaurant Control Panel</h1>
          <p className="text-sm text-gray-500 mt-1">Set plan tiers, verification badges, health scores, and notes per restaurant</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50"><RefreshCw className="w-4 h-4" /> Refresh</button>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left border-b border-gray-100 bg-gray-50">
              {["Restaurant","Plan","Verified","Health","Notes","Action"].map(h => <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {restaurants.map(r => {
                const e = edits[r.id] ?? {};
                const plan = (e.planTier ?? r.planTier) as string;
                const verified = e.isVerified ?? r.isVerified;
                const score = e.healthScore ?? r.healthScore;
                const notes = e.notes ?? r.notes ?? "";
                const isDirty = !!edits[r.id];
                return (
                  <tr key={r.id} className={`hover:bg-gray-50 transition-colors ${isDirty ? "bg-orange-50/30" : ""}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 text-sm">{r.name}</p>
                      <p className="text-[10px] text-gray-400 font-mono">/{r.slug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <select value={plan} onChange={e => edit(r.id, { planTier: e.target.value })} className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-orange-400">
                        {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={!!verified} onChange={e => edit(r.id, { isVerified: e.target.checked })} className="w-4 h-4 accent-orange-500" />
                    </td>
                    <td className="px-4 py-3">
                      <input type="number" min="0" max="100" value={score ?? ""} onChange={e => edit(r.id, { healthScore: e.target.value ? Number(e.target.value) : undefined })} placeholder="—" className="w-16 text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-orange-400" />
                    </td>
                    <td className="px-4 py-3">
                      <input value={notes} onChange={e => edit(r.id, { notes: e.target.value })} placeholder="Internal notes…" className="w-36 text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-orange-400" />
                    </td>
                    <td className="px-4 py-3">
                      {isDirty && (
                        <button onClick={() => save(r.id)} disabled={saving === r.id}
                          className="flex items-center gap-1 px-3 py-1.5 bg-orange-500 text-white text-[10px] font-bold rounded-lg hover:bg-orange-600 disabled:opacity-60 transition-colors">
                          <Save className="w-3 h-3" /> {saving === r.id ? "…" : "Save"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      {/* Mobile card view */}
      </div>
      <div className="md:hidden space-y-3">
        {restaurants.map(r => {
          const e = edits[r.id] ?? {};
          const plan = (e.planTier ?? r.planTier) as string;
          const verified = e.isVerified ?? r.isVerified;
          const score = e.healthScore ?? r.healthScore;
          const notes = e.notes ?? r.notes ?? "";
          const isDirty = !!edits[r.id];
          return (
            <div key={r.id} className={`bg-white rounded-2xl border shadow-sm p-4 space-y-3 ${isDirty ? "border-orange-300" : "border-gray-100"}`}>
              <div>
                <p className="font-semibold text-gray-900">{r.name}</p>
                <p className="text-xs text-gray-400 font-mono">/{r.slug}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-gray-500 block mb-1">Plan</label>
                  <select value={plan} onChange={ev => edit(r.id, { planTier: ev.target.value })} className="w-full text-sm border border-gray-200 rounded-lg px-2 py-2 focus:outline-none">
                    {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div><label className="text-xs text-gray-500 block mb-1">Health (0–100)</label>
                  <input type="number" min="0" max="100" value={score ?? ""} onChange={ev => edit(r.id, { healthScore: ev.target.value ? Number(ev.target.value) : undefined })} placeholder="—" className="w-full text-sm border border-gray-200 rounded-lg px-2 py-2 focus:outline-none" />
                </div>
              </div>
              <div><label className="text-xs text-gray-500 block mb-1">Notes</label>
                <input value={notes} onChange={ev => edit(r.id, { notes: ev.target.value })} placeholder="Internal notes…" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none" />
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={!!verified} onChange={ev => edit(r.id, { isVerified: ev.target.checked })} className="w-4 h-4 accent-orange-500" />
                  Verified
                </label>
                {isDirty && (
                  <button onClick={() => save(r.id)} disabled={saving === r.id}
                    className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white text-xs font-bold rounded-xl hover:bg-orange-600 disabled:opacity-60">
                    <Save className="w-3.5 h-3.5" /> {saving === r.id ? "Saving…" : "Save"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
