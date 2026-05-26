"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Calendar, Save, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";

interface DailyItem { name: string; price: number; description: string; }
interface DailyMenu { id: string; date: string; title: string | null; description: string | null; items: string; isActive: boolean; }

export default function DailyMenuPage() {
  const [restaurantId, setRestaurantId] = useState("");
  const [todayMenu, setTodayMenu] = useState<DailyMenu | null>(null);
  const [pastMenus, setPastMenus] = useState<DailyMenu[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    items: [] as DailyItem[],
    isActive: true,
  });

  const today = new Date().toISOString().split("T")[0];

  async function load() {
    const statsRes = await fetch("/api/dashboard/stats");
    const stats = await statsRes.json();
    setRestaurantId(stats.restaurantId);

    const res = await fetch(`/api/restaurants/${stats.restaurantId}/daily-menu`);
    const d = await res.json();
    const data: DailyMenu[] = d.dailyMenus ?? [];
    const todayEntry = data.find((d) => d.date === today);
    const past = data.filter((d) => d.date !== today).slice(0, 10);
    setTodayMenu(todayEntry ?? null);
    setPastMenus(past);

    if (todayEntry) {
      setForm({
        title: todayEntry.title ?? "",
        description: todayEntry.description ?? "",
        items: JSON.parse(todayEntry.items || "[]"),
        isActive: todayEntry.isActive,
      });
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function addItem() {
    setForm({ ...form, items: [...form.items, { name: "", price: 0, description: "" }] });
  }

  function updateItem(i: number, field: keyof DailyItem, value: string | number) {
    const items = [...form.items];
    items[i] = { ...items[i], [field]: value };
    setForm({ ...form, items });
  }

  function removeItem(i: number) {
    setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });
  }

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/restaurants/${restaurantId}/daily-menu`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, date: today, items: JSON.stringify(form.items) }),
    });
    setSaving(false);
    if (res.ok) { toast.success("Daily menu saved!"); load(); }
    else { const d = await res.json(); toast.error(d.error || "Failed to save"); }
  }

  if (loading) return <div className="p-6 flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="p-4 lg:p-6 max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Daily Specials</h1>
          <p className="text-sm text-gray-500 mt-1">Today: {new Date(today).toLocaleDateString("en", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
        {todayMenu && (
          <span className="flex items-center gap-1.5 text-sm text-green-600 bg-green-50 px-3 py-1.5 rounded-full border border-green-100">
            <CheckCircle className="w-3.5 h-3.5" /> Menu set for today
          </span>
        )}
      </div>

      {/* Today's menu editor */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-4">
          <div className="flex items-center gap-2 text-white">
            <Calendar className="w-5 h-5" />
            <span className="font-semibold">Today&apos;s Menu</span>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Menu title</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Today&apos;s Chef Specials" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description (optional)</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Fresh seasonal ingredients curated by our chef..." rows={2}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 resize-none" />
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">Specials ({form.items.length})</label>
              <button onClick={addItem} className="flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 font-medium">
                <Plus className="w-4 h-4" /> Add Special
              </button>
            </div>
            <div className="space-y-3">
              {form.items.map((item, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <input value={item.name} onChange={(e) => updateItem(i, "name", e.target.value)}
                        placeholder="Dish name" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 bg-white" />
                    </div>
                    <div className="w-28">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
                        <input type="number" step="0.01" min="0" value={item.price || ""}
                          onChange={(e) => updateItem(i, "price", parseFloat(e.target.value) || 0)}
                          placeholder="0.00" className="w-full pl-7 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 bg-white" />
                      </div>
                    </div>
                    <button onClick={() => removeItem(i)} className="text-gray-400 hover:text-red-500 transition-colors p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <input value={item.description} onChange={(e) => updateItem(i, "description", e.target.value)}
                    placeholder="Description (optional)" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 bg-white" />
                </div>
              ))}
              {form.items.length === 0 && (
                <div className="text-center py-6 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl">
                  No specials added yet. Click &quot;Add Special&quot; above.
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <button type="button" onClick={() => setForm({ ...form, isActive: !form.isActive })}
                className={`w-10 h-5 rounded-full transition-colors relative ${form.isActive ? "bg-green-400" : "bg-gray-300"}`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isActive ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
              <span className="text-gray-700 font-medium">Show on menu</span>
            </label>
            <div className="flex-1" />
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all shadow-lg shadow-orange-500/25 disabled:opacity-60">
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Save Today&apos;s Menu"}
            </button>
          </div>
        </div>
      </div>

      {/* Past menus */}
      {pastMenus.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Past Menus</h2>
          <div className="space-y-3">
            {pastMenus.map((menu) => {
              const items = JSON.parse(menu.items || "[]") as DailyItem[];
              return (
                <div key={menu.id} className="flex items-start gap-4 p-3 rounded-xl bg-gray-50">
                  <div className="text-center min-w-[48px]">
                    <div className="text-lg font-bold text-gray-900">{new Date(menu.date).getDate()}</div>
                    <div className="text-xs text-gray-500">{new Date(menu.date).toLocaleDateString("en", { month: "short" })}</div>
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 text-sm">{menu.title || "Daily Specials"}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{items.length} item{items.length !== 1 ? "s" : ""}</div>
                    {items.slice(0, 2).map((item, i) => (
                      <div key={i} className="text-xs text-gray-600 mt-1">• {item.name} — €{item.price.toFixed(2)}</div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
