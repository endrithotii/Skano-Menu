"use client";
import { useEffect, useState } from "react";
import { Zap, Plus, Trash2, ToggleLeft, ToggleRight, Clock } from "lucide-react";
import toast from "react-hot-toast";

interface FlashSale { id: string; title: string; discountType: string; discountValue: number; itemIds: string[]; startsAt: string; endsAt: string; isActive: boolean; }

export default function FlashSalesPage() {
  const [sales, setSales] = useState<FlashSale[]>([]);
  const [restaurantId, setRestaurantId] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", discountType: "percent", discountValue: 10, startsAt: "", endsAt: "" });

  useEffect(() => {
    (async () => {
      const s = await fetch("/api/dashboard/stats").then(r => r.json());
      setRestaurantId(s.restaurantId);
      const d = await fetch(`/api/restaurants/${s.restaurantId}/flash-sales`).then(r => r.json());
      setSales(d.flashSales ?? []);
      setLoading(false);
    })();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/restaurants/${restaurantId}/flash-sales`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    if (res.ok) {
      toast.success("Flash sale created!");
      setShowForm(false);
      const d = await fetch(`/api/restaurants/${restaurantId}/flash-sales`).then(r => r.json());
      setSales(d.flashSales ?? []);
    } else toast.error("Failed to create");
  }

  async function toggle(id: string, current: boolean) {
    await fetch(`/api/restaurants/${restaurantId}/flash-sales/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !current }),
    });
    setSales(s => s.map(x => x.id === id ? { ...x, isActive: !current } : x));
  }

  async function remove(id: string) {
    if (!confirm("Delete this flash sale?")) return;
    await fetch(`/api/restaurants/${restaurantId}/flash-sales/${id}`, { method: "DELETE" });
    setSales(s => s.filter(x => x.id !== id));
    toast.success("Deleted");
  }

  const now = new Date();
  const isLive = (s: FlashSale) => s.isActive && new Date(s.startsAt) <= now && new Date(s.endsAt) >= now;

  if (loading) return <div className="p-6 flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="p-4 lg:p-6 max-w-2xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Zap className="w-6 h-6 text-orange-500" /> Flash Sales</h1>
          <p className="text-sm text-gray-500 mt-1">Time-limited discounts shown as a banner on your menu</p>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> New Sale
        </button>
      </div>

      {showForm && (
        <form onSubmit={create} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Create Flash Sale</h2>
          <div><label className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
            <input required value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g. Happy Hour 50% Off!" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Discount type</label>
              <select value={form.discountType} onChange={e => setForm({...form, discountType: e.target.value})} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30">
                <option value="percent">Percentage (%)</option>
                <option value="fixed">Fixed amount (€)</option>
              </select>
            </div>
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Value *</label>
              <input required type="number" min="1" max="100" value={form.discountValue} onChange={e => setForm({...form, discountValue: Number(e.target.value)})} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Starts at *</label>
              <input required type="datetime-local" value={form.startsAt} onChange={e => setForm({...form, startsAt: e.target.value})} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30" />
            </div>
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Ends at *</label>
              <input required type="datetime-local" value={form.endsAt} onChange={e => setForm({...form, endsAt: e.target.value})} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors">Create</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 border border-gray-200 text-sm text-gray-600 rounded-xl hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      )}

      {sales.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
          <Zap className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="font-medium text-gray-500">No flash sales yet</p>
          <p className="text-sm text-gray-400 mt-1">Create time-limited deals to attract customers</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sales.map(sale => (
            <div key={sale.id} className={`bg-white rounded-2xl border shadow-sm p-4 ${isLive(sale) ? "border-orange-200 ring-1 ring-orange-300" : "border-gray-100"}`}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900">{sale.title}</p>
                    {isLive(sale) && <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-bold animate-pulse">LIVE</span>}
                    {!sale.isActive && <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Paused</span>}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {sale.discountType === "percent" ? `${sale.discountValue}% off` : `€${sale.discountValue} off`} · whole menu
                  </p>
                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(sale.startsAt).toLocaleString()} → {new Date(sale.endsAt).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => toggle(sale.id, sale.isActive)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                    {sale.isActive ? <ToggleRight className="w-5 h-5 text-orange-500" /> : <ToggleLeft className="w-5 h-5" />}
                  </button>
                  <button onClick={() => remove(sale.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
