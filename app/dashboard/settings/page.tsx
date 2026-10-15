"use client";

import { useEffect, useRef, useState } from "react";
import { Save, Globe, Wifi, Plus, X } from "lucide-react";
import toast from "react-hot-toast";
import { CUISINE_TYPES } from "@/lib/utils";

interface RestaurantData {
  id: string; name: string; description: string | null; address: string | null;
  phone: string | null; email: string | null; website: string | null;
  cuisine: string | string[]; slug: string; wifiPassword: string | null;
}

export default function SettingsPage() {
  const [restaurant, setRestaurant] = useState<RestaurantData | null>(null);
  const [form, setForm] = useState({
    name: "", description: "", address: "", phone: "", email: "",
    website: "", cuisine: [] as string[], wifiPassword: "",
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const statsRes = await fetch("/api/dashboard/stats");
        const stats = await statsRes.json();
        const res = await fetch(`/api/restaurants/${stats.restaurantId}`);
        if (res.ok) {
          const data = await res.json();
          const r: RestaurantData = data.restaurant;
          setRestaurant(r);
          const cuisineArr = Array.isArray(r.cuisine) ? r.cuisine
            : (() => { try { return JSON.parse(r.cuisine as string || "[]"); } catch { return []; } })();
          setForm({
            name: r.name, description: r.description || "", address: r.address || "",
            phone: r.phone || "", email: r.email || "", website: r.website || "",
            cuisine: cuisineArr, wifiPassword: r.wifiPassword || "",
          });
        }
      } catch (e) { console.error(e); }
      setLoading(false);
    }
    load();
  }, []);

  const [customCuisineInput, setCustomCuisineInput] = useState("");
  const customCuisineRef = useRef<HTMLInputElement>(null);

  function toggleCuisine(c: string) {
    setForm((f) => ({ ...f, cuisine: f.cuisine.includes(c) ? f.cuisine.filter((x) => x !== c) : [...f.cuisine, c] }));
  }

  function addCustomCuisine(raw: string) {
    const value = raw.trim();
    if (!value) return;
    if (!form.cuisine.includes(value)) {
      setForm((f) => ({ ...f, cuisine: [...f.cuisine, value] }));
    }
    setCustomCuisineInput("");
  }

  function removeCuisine(c: string) {
    setForm((f) => ({ ...f, cuisine: f.cuisine.filter((x) => x !== c) }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!restaurant) return;
    setSaving(true);
    const res = await fetch(`/api/restaurants/${restaurant.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      // Only the fields on this page, so it never overwrites what other pages set (menu type, currency…)
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) toast.success("Settings saved!");
    else { const d = await res.json(); toast.error(d.error || "Failed to save"); }
  }

  if (loading) return (
    <div className="p-6 flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="p-4 lg:p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Restaurant Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Your restaurant&apos;s profile and Wi-Fi</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">

        {/* ── Basic info ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-500" /> Basic Information
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Restaurant Name *</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3} placeholder="Tell customers about your restaurant..."
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+383 44 ..." className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="info@restaurant.com" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Address</label>
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Street, City" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Website</label>
              <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })}
                placeholder="https://yourrestaurant.com" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Cuisine Types</label>

            {/* Selected custom tags (not in predefined list) */}
            {form.cuisine.filter((c) => !CUISINE_TYPES.includes(c)).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {form.cuisine.filter((c) => !CUISINE_TYPES.includes(c)).map((c) => (
                  <span key={c} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-blue-500 text-white">
                    {c}
                    <button type="button" onClick={() => removeCuisine(c)} className="hover:opacity-70 transition-opacity ml-0.5" aria-label={`Remove ${c}`}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Predefined chips */}
            <div className="flex flex-wrap gap-2">
              {CUISINE_TYPES.map((c) => (
                <button key={c} type="button" onClick={() => toggleCuisine(c)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${form.cuisine.includes(c) ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
                  {c}
                </button>
              ))}
            </div>

            {/* Add custom cuisine */}
            <div className="flex items-center gap-2 mt-3">
              <input
                ref={customCuisineRef}
                value={customCuisineInput}
                onChange={(e) => setCustomCuisineInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); addCustomCuisine(customCuisineInput); }
                  if (e.key === "," || e.key === ";") { e.preventDefault(); addCustomCuisine(customCuisineInput); }
                }}
                placeholder="Add custom cuisine…"
                className="flex-1 px-3 py-2 rounded-xl border border-dashed border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 placeholder-gray-300"
              />
              <button
                type="button"
                onClick={() => addCustomCuisine(customCuisineInput)}
                disabled={!customCuisineInput.trim()}
                className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5">Press Enter or comma to add a custom cuisine type</p>
          </div>
        </div>

        {/* ── Wi-Fi ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div>
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Wifi className="w-4 h-4 text-blue-500" /> Wi-Fi Password
            </h2>
            <p className="text-xs text-gray-500 mt-1">Show your Wi-Fi password on the menu so customers don&apos;t have to ask.</p>
          </div>
          <input
            value={form.wifiPassword}
            onChange={(e) => setForm({ ...form, wifiPassword: e.target.value })}
            placeholder="e.g. welcome2024"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
          />
        </div>

        <button type="submit" disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold py-3 rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-60">
          <Save className="w-4 h-4" />
          {saving ? "Saving…" : "Save Settings"}
        </button>
      </form>
    </div>
  );
}
