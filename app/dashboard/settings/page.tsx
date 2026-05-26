"use client";

import { useEffect, useState } from "react";
import { Save, Palette, Globe, LayoutTemplate, UtensilsCrossed, FileText } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import { CUISINE_TYPES, MENU_TEMPLATES } from "@/lib/utils";

interface RestaurantData {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  cuisine: string | string[];
  primaryColor: string;
  templateId: string;
  slug: string;
  primaryMenu: string;
  menuPdfUrl: string | null;
}

export default function SettingsPage() {
  const [restaurant, setRestaurant] = useState<RestaurantData | null>(null);
  const [form, setForm] = useState({
    name: "", description: "", address: "", phone: "", email: "",
    website: "", cuisine: [] as string[], primaryColor: "#f97316",
    templateId: "modern", primaryMenu: "dynamic",
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const statsRes = await fetch("/api/dashboard/stats");
      const stats = await statsRes.json();
      const res = await fetch(`/api/restaurants/${stats.restaurantId}`);
      if (res.ok) {
        const data = await res.json();
        const r: RestaurantData = data.restaurant;
        setRestaurant(r);
        const cuisineArr = Array.isArray(r.cuisine)
          ? r.cuisine
          : (() => { try { return JSON.parse(r.cuisine as string || "[]"); } catch { return []; } })();
        setForm({
          name: r.name, description: r.description || "", address: r.address || "",
          phone: r.phone || "", email: r.email || "", website: r.website || "",
          cuisine: cuisineArr, primaryColor: r.primaryColor, templateId: r.templateId,
          primaryMenu: r.primaryMenu || "dynamic",
        });
      }
      setLoading(false);
    }
    load();
  }, []);

  function toggleCuisine(c: string) {
    setForm((f) => ({ ...f, cuisine: f.cuisine.includes(c) ? f.cuisine.filter((x) => x !== c) : [...f.cuisine, c] }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!restaurant) return;
    setSaving(true);
    const res = await fetch(`/api/restaurants/${restaurant.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form }),
    });
    setSaving(false);
    if (res.ok) toast.success("Settings saved!");
    else { const d = await res.json(); toast.error(d.error || "Failed to save"); }
  }

  if (loading) return <div className="p-6 flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="p-4 lg:p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Restaurant Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Update your restaurant&apos;s profile and appearance</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Basic info */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Globe className="w-4 h-4 text-orange-500" /> Basic Information
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Restaurant Name *</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3} placeholder="Tell customers about your restaurant..."
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+383 44 ..." className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="info@restaurant.com" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Address</label>
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Street, City, Kosovo" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Website</label>
              <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })}
                placeholder="https://yourrestaurant.com" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Cuisine Types</label>
            <div className="flex flex-wrap gap-2">
              {CUISINE_TYPES.map((c) => (
                <button key={c} type="button" onClick={() => toggleCuisine(c)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${form.cuisine.includes(c) ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Menu Display */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
          <div>
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <LayoutTemplate className="w-4 h-4 text-orange-500" /> Primary Menu Type
            </h2>
            <p className="text-sm text-gray-500 mt-1">Choose which menu customers see first when they scan your QR code. You can have both — just pick which is primary.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setForm({ ...form, primaryMenu: "dynamic" })}
              className={`p-4 rounded-xl border-2 text-left transition-all ${form.primaryMenu === "dynamic" ? "border-orange-500 bg-orange-50" : "border-gray-200 hover:border-gray-300"}`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${form.primaryMenu === "dynamic" ? "bg-orange-500" : "bg-gray-100"}`}>
                  <UtensilsCrossed className={`w-4 h-4 ${form.primaryMenu === "dynamic" ? "text-white" : "text-gray-500"}`} />
                </div>
                <span className="font-semibold text-gray-900 text-sm">Digital Menu</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">Interactive menu with categories, items, prices and filters.</p>
              {form.primaryMenu === "dynamic" && (
                <div className="mt-3 text-xs text-orange-600 font-semibold">✓ Set as primary</div>
              )}
            </button>

            <button type="button" onClick={() => setForm({ ...form, primaryMenu: "static" })}
              className={`p-4 rounded-xl border-2 text-left transition-all ${form.primaryMenu === "static" ? "border-orange-500 bg-orange-50" : "border-gray-200 hover:border-gray-300"}`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${form.primaryMenu === "static" ? "bg-orange-500" : "bg-gray-100"}`}>
                  <FileText className={`w-4 h-4 ${form.primaryMenu === "static" ? "text-white" : "text-gray-500"}`} />
                </div>
                <span className="font-semibold text-gray-900 text-sm">Scanned Menu</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">Your physical menu uploaded as a PDF or image.</p>
              {form.primaryMenu === "static" && (
                <div className="mt-3 text-xs text-orange-600 font-semibold">✓ Set as primary</div>
              )}
            </button>
          </div>

          {form.primaryMenu === "static" && !restaurant?.menuPdfUrl && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
              <span>⚠️</span>
              <span>
                No scanned menu uploaded yet.{" "}
                <Link href="/dashboard/upload-menu" className="font-semibold underline hover:text-amber-900">
                  Upload one here →
                </Link>
              </span>
            </div>
          )}

          {form.primaryMenu === "dynamic" && restaurant?.menuPdfUrl && (
            <p className="text-xs text-gray-500 bg-gray-50 rounded-xl px-4 py-3">
              Your scanned menu will still be accessible as a secondary option on the public page.
            </p>
          )}
        </div>

        {/* Appearance */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-5">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Palette className="w-4 h-4 text-orange-500" /> Menu Appearance
          </h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Brand Color</label>
            <div className="flex items-center gap-3">
              <input type="color" value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                className="w-10 h-10 rounded-xl cursor-pointer border border-gray-200" />
              <input value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                className="w-32 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 font-mono" />
              <div className="flex gap-2">
                {["#f97316", "#3b82f6", "#10b981", "#8b5cf6", "#ef4444", "#c9a84c"].map((c) => (
                  <button key={c} type="button" onClick={() => setForm({ ...form, primaryColor: c })}
                    className={`w-7 h-7 rounded-lg transition-transform hover:scale-110 ${form.primaryColor === c ? "ring-2 ring-offset-1 ring-gray-900 scale-110" : ""}`}
                    style={{ background: c }} />
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Menu Template</label>
            <p className="text-xs text-gray-400 mb-3">Choose how your digital menu looks to customers. 10 designs available.</p>
            <div className="grid grid-cols-2 gap-2.5">
              {MENU_TEMPLATES.map((t) => (
                <button key={t.id} type="button" onClick={() => setForm({ ...form, templateId: t.id })}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${form.templateId === t.id ? "border-orange-500 bg-orange-50" : "border-gray-200 bg-white hover:border-gray-300"}`}>
                  <div className="font-semibold text-gray-900 text-sm leading-snug">{t.name}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5 leading-snug line-clamp-2">{t.description}</div>
                  {form.templateId === t.id && (
                    <div className="mt-1.5 text-[11px] text-orange-600 font-semibold">✓ Active</div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {restaurant && (
            <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
              <span className="text-sm text-gray-600">Preview your menu</span>
              <a href={`/r/${restaurant.slug}`} target="_blank" rel="noopener noreferrer"
                className="text-sm text-orange-600 font-semibold hover:text-orange-700">
                Open preview →
              </a>
            </div>
          )}
        </div>

        <button type="submit" disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold py-3 rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all shadow-lg shadow-orange-500/25 disabled:opacity-60">
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </form>
    </div>
  );
}
