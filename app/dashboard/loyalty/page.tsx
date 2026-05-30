"use client";
import { useEffect, useState } from "react";
import { Stamp, Save, ToggleRight, ToggleLeft, Gift, Users } from "lucide-react";
import toast from "react-hot-toast";

export default function LoyaltyPage() {
  const [restaurantId, setRestaurantId] = useState("");
  const [form, setForm] = useState({ enabled: false, stamps: 10, reward: "Free item" });
  const [stats, setStats] = useState({ total: 0, completed: 0, active: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const s = await fetch("/api/dashboard/stats").then(r => r.json());
      setRestaurantId(s.restaurantId);
      const r = await fetch(`/api/restaurants/${s.restaurantId}`).then(r => r.json());
      const rest = r.restaurant;
      setForm({ enabled: !!rest.loyaltyEnabled, stamps: rest.loyaltyStamps ?? 10, reward: rest.loyaltyReward ?? "Free item" });
      // Get loyalty stats
      const cards = await fetch(`/api/restaurants/${s.restaurantId}/loyalty?stats=1`).then(r => r.json()).catch(() => ({}));
      if (cards.stats) setStats(cards.stats);
      setLoading(false);
    })();
  }, []);

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/restaurants/${restaurantId}/loyalty`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) toast.success("Loyalty program saved!"); else toast.error("Failed to save");
  }

  if (loading) return <div className="p-6 flex justify-center h-64 items-center"><div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="p-4 lg:p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Stamp className="w-6 h-6 text-orange-500" /> Loyalty Stamp Card</h1>
        <p className="text-sm text-gray-500 mt-1">Digital punch card — customers collect stamps and earn rewards</p>
      </div>

      {/* Stats */}
      {form.enabled && (
        <div className="grid grid-cols-3 gap-3">
          {[{ label: "Total Cards", value: stats.total, icon: Users }, { label: "Completed", value: stats.completed, icon: Gift }, { label: "Active", value: stats.active, icon: Stamp }].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
              <Icon className="w-5 h-5 text-orange-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-400">{label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-900">Enable loyalty program</p>
            <p className="text-xs text-gray-400 mt-0.5">Show stamp card widget on your menu page</p>
          </div>
          <button onClick={() => setForm(f => ({ ...f, enabled: !f.enabled }))} className="transition-colors">
            {form.enabled ? <ToggleRight className="w-8 h-8 text-orange-500" /> : <ToggleLeft className="w-8 h-8 text-gray-300" />}
          </button>
        </div>

        {form.enabled && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Stamps needed for reward</label>
              <input type="number" min="3" max="50" value={form.stamps} onChange={e => setForm(f => ({ ...f, stamps: Number(e.target.value) }))}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30" />
              <p className="text-[10px] text-gray-400 mt-1">Customer gets 1 stamp per visit (menu scan)</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Reward description</label>
              <input value={form.reward} onChange={e => setForm(f => ({ ...f, reward: e.target.value }))}
                placeholder="e.g. Free dessert, 20% off your bill"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30" />
            </div>

            {/* Preview */}
            <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4">
              <p className="text-xs font-semibold text-orange-700 mb-2">Customer view preview</p>
              <div className="bg-white rounded-xl p-3 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Stamp className="w-5 h-5 text-orange-500" />
                  <p className="text-sm font-bold text-gray-900">Loyalty Card</p>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {Array.from({ length: form.stamps }).map((_, i) => (
                    <div key={i} className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-[10px] ${i < Math.floor(form.stamps * 0.4) ? "bg-orange-500 border-orange-500 text-white" : "border-gray-200 text-gray-300"}`}>
                      {i < Math.floor(form.stamps * 0.4) ? "✓" : "○"}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500">{Math.floor(form.stamps * 0.4)}/{form.stamps} stamps · Reward: <span className="font-semibold text-orange-600">{form.reward}</span></p>
              </div>
            </div>
          </>
        )}

        <button onClick={save} disabled={saving} className="w-full flex items-center justify-center gap-2 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60">
          <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save Loyalty Program"}
        </button>
      </div>
    </div>
  );
}
