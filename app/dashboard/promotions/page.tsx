"use client";

import { useEffect, useState } from "react";
import { Plus, Tag, Trash2, Clock, Percent, BadgeAlert, ToggleLeft, ToggleRight } from "lucide-react";
import toast from "react-hot-toast";

interface Promotion {
  id: string;
  title: string;
  description: string;
  type: "percent" | "fixed" | "badge";
  value: number;
  startTime?: string;
  endTime?: string;
  days?: string[];
  active: boolean;
  itemIds?: string[];
  color?: string;
}

interface MenuItem { id: string; name: string; price: number; category: string; }

const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAYS_FULL = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const COLORS = ["#f97316", "#ef4444", "#8b5cf6", "#10b981", "#3b82f6", "#f59e0b", "#ec4899"];

function uid() { return `promo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`; }

const DEFAULT_PROMO: Omit<Promotion, "id"> = {
  title: "",
  description: "",
  type: "percent",
  value: 10,
  startTime: "12:00",
  endTime: "15:00",
  days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
  active: true,
  itemIds: [],
  color: "#f97316",
};

export default function PromotionsPage() {
  const [restaurantId, setRestaurantId] = useState("");
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [form, setForm] = useState<Omit<Promotion, "id">>(DEFAULT_PROMO);

  useEffect(() => {
    async function load() {
      const statsRes = await fetch("/api/dashboard/stats");
      const stats = await statsRes.json();
      const rid = stats.restaurantId;
      setRestaurantId(rid);

      const rRes = await fetch(`/api/restaurants/${rid}`);
      const rData = await rRes.json();
      const r = rData.restaurant;
      try {
        const promos: Promotion[] = typeof r.promotions === "string"
          ? JSON.parse(r.promotions)
          : (r.promotions ?? []);
        setPromotions(promos);
      } catch { setPromotions([]); }

      // Load all items
      const catRes = await fetch(`/api/restaurants/${rid}/categories`);
      const catData = await catRes.json();
      const cats = catData.categories ?? [];
      const items: MenuItem[] = cats.flatMap((c: { name: string; items: { id: string; name: string; price: number }[] }) =>
        c.items.map((i) => ({ id: i.id, name: i.name, price: i.price, category: c.name }))
      );
      setMenuItems(items);
      setLoading(false);
    }
    load();
  }, []);

  async function saveAll(updated: Promotion[]) {
    setSaving(true);
    const res = await fetch(`/api/restaurants/${restaurantId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promotions: updated }),
    });
    setSaving(false);
    if (res.ok) { toast.success("Promotions saved!"); setPromotions(updated); }
    else toast.error("Failed to save");
  }

  function openNew() {
    setEditing(null);
    setForm(DEFAULT_PROMO);
    setShowForm(true);
  }

  function openEdit(promo: Promotion) {
    setEditing(promo);
    setForm({ ...promo });
    setShowForm(true);
  }

  function handleSave() {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    if (editing) {
      saveAll(promotions.map((p) => p.id === editing.id ? { ...form, id: editing.id } : p));
    } else {
      saveAll([...promotions, { ...form, id: uid() }]);
    }
    setShowForm(false);
  }

  function deletePromo(id: string) {
    if (!confirm("Delete this promotion?")) return;
    saveAll(promotions.filter((p) => p.id !== id));
  }

  function toggleActive(id: string) {
    saveAll(promotions.map((p) => p.id === id ? { ...p, active: !p.active } : p));
  }

  function toggleDay(day: string) {
    const days = form.days ?? [];
    setForm((f) => ({
      ...f,
      days: days.includes(day) ? days.filter((d) => d !== day) : [...days, day],
    }));
  }

  if (loading) return <div className="p-6 flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="p-4 lg:p-6 max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Promotions</h1>
          <p className="text-sm text-gray-500 mt-1">Time-based deals and badges shown on your public menu</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all shadow-lg shadow-orange-500/25">
          <Plus className="w-4 h-4" /> New Promotion
        </button>
      </div>

      {/* Promotions list */}
      {promotions.length === 0 && !showForm ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
          <Percent className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="font-medium text-gray-500">No promotions yet</p>
          <p className="text-sm text-gray-400 mt-1">Add happy hour deals, weekly specials, or promo badges</p>
          <button onClick={openNew}
            className="mt-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-semibold px-5 py-2 rounded-xl">
            Create First Promotion
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {promotions.map((promo) => (
            <div key={promo.id}
              className={`bg-white rounded-2xl border shadow-sm p-4 flex items-start gap-4 transition-all ${promo.active ? "border-gray-100" : "border-dashed border-gray-200 opacity-60"}`}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${promo.color ?? "#f97316"}20` }}>
                {promo.type === "percent" && <Percent className="w-5 h-5" style={{ color: promo.color ?? "#f97316" }} />}
                {promo.type === "fixed" && <Tag className="w-5 h-5" style={{ color: promo.color ?? "#f97316" }} />}
                {promo.type === "badge" && <BadgeAlert className="w-5 h-5" style={{ color: promo.color ?? "#f97316" }} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900 text-sm">{promo.title}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: `${promo.color ?? "#f97316"}20`, color: promo.color ?? "#f97316" }}>
                    {promo.type === "percent" ? `-${promo.value}%`
                      : promo.type === "fixed" ? `-€${promo.value}`
                      : "Badge"}
                  </span>
                  {!promo.active && <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">Paused</span>}
                </div>
                {promo.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{promo.description}</p>}
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  {promo.startTime && promo.endTime && (
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="w-3 h-3" />{promo.startTime} – {promo.endTime}
                    </span>
                  )}
                  {promo.days && promo.days.length > 0 && (
                    <div className="flex gap-0.5">
                      {DAYS_SHORT.map((d, i) => (
                        <span key={d} className={`text-[10px] w-5 h-5 flex items-center justify-center rounded font-medium ${promo.days!.includes(DAYS_FULL[i]) ? "text-white" : "text-gray-300"}`}
                          style={promo.days!.includes(DAYS_FULL[i]) ? { background: promo.color ?? "#f97316" } : { background: "#f3f4f6" }}>
                          {d[0]}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => toggleActive(promo.id)} title={promo.active ? "Pause" : "Activate"}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-orange-500 hover:bg-orange-50 transition-colors">
                  {promo.active ? <ToggleRight className="w-4 h-4 text-green-500" /> : <ToggleLeft className="w-4 h-4" />}
                </button>
                <button onClick={() => openEdit(promo)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-orange-500 hover:bg-orange-50 transition-colors text-xs font-medium px-2">
                  Edit
                </button>
                <button onClick={() => deletePromo(promo.id)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="p-6 space-y-5">
              <h2 className="text-lg font-bold text-gray-900">{editing ? "Edit Promotion" : "New Promotion"}</h2>

              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
                <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Happy Hour · 20% Off All Cocktails"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30" />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Short description shown to customers"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30" />
              </div>

              {/* Type + Value */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                  <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as Promotion["type"] }))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 bg-white">
                    <option value="percent">% Discount</option>
                    <option value="fixed">Fixed Amount Off</option>
                    <option value="badge">Badge Only (no discount)</option>
                  </select>
                </div>
                {form.type !== "badge" && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      {form.type === "percent" ? "Discount %" : "Amount (€)"}
                    </label>
                    <input type="number" min="1" max={form.type === "percent" ? 100 : 1000}
                      value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: Number(e.target.value) }))}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30" />
                  </div>
                )}
              </div>

              {/* Time range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Start time</label>
                  <input type="time" value={form.startTime ?? ""} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">End time</label>
                  <input type="time" value={form.endTime ?? ""} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30" />
                </div>
              </div>

              {/* Days */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Active days</label>
                <div className="flex gap-1.5 flex-wrap">
                  {DAYS_SHORT.map((d, i) => {
                    const dayFull = DAYS_FULL[i];
                    const active = form.days?.includes(dayFull) ?? false;
                    return (
                      <button key={d} type="button" onClick={() => toggleDay(dayFull)}
                        className={`w-9 h-9 rounded-xl text-xs font-semibold transition-all border ${active ? "text-white border-transparent" : "bg-white text-gray-500 border-gray-200 hover:border-orange-300"}`}
                        style={active ? { background: form.color ?? "#f97316" } : {}}>
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Badge color</label>
                <div className="flex gap-2">
                  {COLORS.map((c) => (
                    <button key={c} type="button" onClick={() => setForm((f) => ({ ...f, color: c }))}
                      className={`w-7 h-7 rounded-full transition-transform ${form.color === c ? "scale-125 ring-2 ring-offset-1 ring-gray-400" : "hover:scale-110"}`}
                      style={{ background: c }} />
                  ))}
                </div>
              </div>

              {/* Items filter (optional) */}
              {menuItems.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Apply to specific items <span className="text-gray-400">(leave empty = applies to all)</span>
                  </label>
                  <div className="max-h-36 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
                    {menuItems.map((item) => {
                      const checked = form.itemIds?.includes(item.id) ?? false;
                      return (
                        <label key={item.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                          <input type="checkbox" checked={checked}
                            onChange={() => setForm((f) => ({
                              ...f,
                              itemIds: checked
                                ? (f.itemIds ?? []).filter((x) => x !== item.id)
                                : [...(f.itemIds ?? []), item.id],
                            }))}
                            className="accent-orange-500" />
                          <span className="text-xs text-gray-700 flex-1">{item.name}</span>
                          <span className="text-xs text-gray-400">€{item.price.toFixed(2)}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold py-2.5 rounded-xl text-sm hover:from-orange-600 hover:to-amber-600 transition-all disabled:opacity-60">
                  {saving ? "Saving…" : editing ? "Update Promotion" : "Create Promotion"}
                </button>
                <button onClick={() => setShowForm(false)}
                  className="px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4">
        <p className="text-sm text-orange-700">
          <span className="font-semibold">How it works:</span> Active promotions appear as coloured badges on your public menu during the set hours and days. Discount promotions show the reduced price inline.
        </p>
      </div>
    </div>
  );
}
