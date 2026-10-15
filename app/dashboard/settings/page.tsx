"use client";

import { useEffect, useRef, useState } from "react";
import { Save, Palette, Globe, LayoutTemplate, UtensilsCrossed, FileText, Clock, Megaphone, Share2, Wifi, CalendarCheck, DollarSign, Plus, X } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import { CUISINE_TYPES, MENU_TEMPLATES } from "@/lib/utils";

interface RestaurantData {
  id: string; name: string; description: string | null; address: string | null;
  phone: string | null; email: string | null; website: string | null;
  cuisine: string | string[]; primaryColor: string; templateId: string;
  slug: string; primaryMenu: string; menuPdfUrl: string | null;
  openingHours: string; announcement: string | null; socialLinks: string; wifiPassword: string | null;
  bookingUrl: string | null; currency: string;
}

export default function SettingsPage() {
  const [restaurant, setRestaurant] = useState<RestaurantData | null>(null);
  const [form, setForm] = useState({
    name: "", description: "", address: "", phone: "", email: "",
    website: "", cuisine: [] as string[], primaryColor: "#3b82f6",
    templateId: "modern", primaryMenu: "dynamic",
    wifiPassword: "", bookingUrl: "", currency: "€",
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
            cuisine: cuisineArr, primaryColor: r.primaryColor, templateId: r.templateId,
            primaryMenu: r.primaryMenu || "dynamic",
            wifiPassword: r.wifiPassword || "",
            bookingUrl: r.bookingUrl || "", currency: r.currency || "€",
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
      body: JSON.stringify({
        ...form,
        bookingUrl: form.bookingUrl || null,
        currency: form.currency || "€",
      }),
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
        <p className="text-sm text-gray-500 mt-1">Update your restaurant&apos;s profile and appearance</p>
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

        {/* ── Opening hours: have their own page now ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" /> Opening hours
            </h2>
            <p className="text-xs text-gray-500 mt-1">Set your weekly hours and special days like holidays.</p>
          </div>
          <Link href="/dashboard/exceptions" className="text-sm font-semibold text-blue-600 hover:text-blue-700">Open hours &amp; holidays</Link>
        </div>

        {/* ── Announcements: have their own page now ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-blue-500" /> Announcements
            </h2>
            <p className="text-xs text-gray-500 mt-1">Show a message to customers when they open your menu, now or at a time you choose.</p>
          </div>
          <Link href="/dashboard/announcements" className="text-sm font-semibold text-blue-600 hover:text-blue-700">Open Announcements</Link>
        </div>

        {/* ── Social media: has its own page now ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Share2 className="w-4 h-4 text-blue-500" /> Social media
            </h2>
            <p className="text-xs text-gray-500 mt-1">Link your social media and choose which ones customers see above the menu.</p>
          </div>
          <Link href="/dashboard/social-media" className="text-sm font-semibold text-blue-600 hover:text-blue-700">Open Social media</Link>
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

        {/* ── Reservations & Currency ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-blue-500" /> Reservations &amp; Currency
          </h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Booking / Reservation URL
            </label>
            <p className="text-xs text-gray-400 mb-2">
              Paste your Google Reserve, OpenTable, or any booking link. A &quot;Book a Table&quot; button will appear on your menu.
            </p>
            <input
              value={form.bookingUrl}
              onChange={(e) => setForm({ ...form, bookingUrl: e.target.value })}
              placeholder="https://reserve.google.com/... or https://opentable.com/..."
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-gray-400" /> Currency Symbol
            </label>
            <div className="flex flex-wrap gap-2">
              {["€","$","£","CHF","ALL","kr","₺","₹","¥"].map((c) => (
                <button key={c} type="button" onClick={() => setForm({ ...form, currency: c })}
                  className={`px-3 py-1.5 rounded-full text-sm font-semibold border-2 transition-all ${
                    form.currency === c
                      ? "border-blue-500 bg-blue-50 text-blue-600"
                      : "border-gray-200 text-gray-700 hover:border-gray-300"
                  }`}>
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Primary Menu Type ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
          <div>
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <LayoutTemplate className="w-4 h-4 text-blue-500" /> Primary Menu Type
            </h2>
            <p className="text-sm text-gray-500 mt-1">Choose which menu customers see when they scan your QR code. Only the selected type is shown — no switching.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setForm({ ...form, primaryMenu: "dynamic" })}
              className={`p-4 rounded-xl border-2 text-left transition-all ${form.primaryMenu === "dynamic" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${form.primaryMenu === "dynamic" ? "bg-blue-500" : "bg-gray-100"}`}>
                  <UtensilsCrossed className={`w-4 h-4 ${form.primaryMenu === "dynamic" ? "text-white" : "text-gray-500"}`} />
                </div>
                <span className="font-semibold text-gray-900 text-sm">Digital Menu</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">Interactive menu with categories, items, prices and filters.</p>
              {form.primaryMenu === "dynamic" && <div className="mt-3 text-xs text-blue-600 font-semibold">✓ Currently active</div>}
            </button>
            <button type="button" onClick={() => setForm({ ...form, primaryMenu: "static" })}
              className={`p-4 rounded-xl border-2 text-left transition-all ${form.primaryMenu === "static" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${form.primaryMenu === "static" ? "bg-blue-500" : "bg-gray-100"}`}>
                  <FileText className={`w-4 h-4 ${form.primaryMenu === "static" ? "text-white" : "text-gray-500"}`} />
                </div>
                <span className="font-semibold text-gray-900 text-sm">Menu Book</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">Your menu as a PDF or photos, shown as a flip book.</p>
              {form.primaryMenu === "static" && <div className="mt-3 text-xs text-blue-600 font-semibold">✓ Currently active</div>}
            </button>
          </div>
          {form.primaryMenu === "static" && restaurant?.menuPdfUrl && (
            <Link href="/dashboard/menu" className="inline-block text-sm font-semibold text-blue-600 hover:text-blue-700 underline">
              Upload or edit your menu book →
            </Link>
          )}
          {form.primaryMenu === "static" && !restaurant?.menuPdfUrl && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
              <span>⚠️</span>
              <span>No scanned menu uploaded yet. <Link href="/dashboard/menu" className="font-semibold underline hover:text-amber-900">Upload one here →</Link></span>
            </div>
          )}
        </div>

        {/* ── Appearance ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-6">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Palette className="w-4 h-4 text-blue-500" /> Menu Appearance
          </h2>

          {/* Brand Colour */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Brand / Accent Colour</label>
            <div className="flex items-center gap-3 flex-wrap">
              <input type="color" value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                className="w-10 h-10 rounded-xl cursor-pointer border border-gray-200 shrink-0" />
              <input value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                className="w-28 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 font-mono" />
              <div className="flex gap-2 flex-wrap">
                {[
                  { color: "#f97316", name: "Orange" }, { color: "#3b82f6", name: "Blue" },
                  { color: "#10b981", name: "Green" }, { color: "#8b5cf6", name: "Purple" },
                  { color: "#ef4444", name: "Red" }, { color: "#c9a84c", name: "Gold" },
                  { color: "#ec4899", name: "Pink" }, { color: "#14b8a6", name: "Teal" },
                  { color: "#1a6b8a", name: "Ocean" }, { color: "#e63946", name: "Crimson" },
                  { color: "#ff4d00", name: "Fire" }, { color: "#2d2d2d", name: "Noir" },
                ].map(({ color, name }) => (
                  <button key={color} type="button" title={name}
                    onClick={() => setForm({ ...form, primaryColor: color })}
                    className={`w-7 h-7 rounded-lg transition-all hover:scale-110 ${form.primaryColor === color ? "ring-2 ring-offset-1 ring-gray-900 scale-110" : "hover:shadow-md"}`}
                    style={{ background: color }} />
                ))}
              </div>
            </div>
            {/* Live preview strip */}
            <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: `linear-gradient(to right, ${form.primaryColor}, ${form.primaryColor}80)` }} />
          </div>

          {/* Menu Template Visual Picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Menu Template</label>
            <p className="text-xs text-gray-400 mb-3">
              {MENU_TEMPLATES.length} unique designs. Your brand colour applies to all templates.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {MENU_TEMPLATES.map((t) => {
                const isActive = form.templateId === t.id;
                const themePalette: Record<string, string[]> = {
                  modern:        ["#ffffff", "#f3f4f6", form.primaryColor],
                  elegant:       ["#1a1a1a", "#2d2d2d", "#c9a84c"],
                  vibrant:       ["#f97316", "#8b5cf6", "#3b82f6"],
                  classic:       ["#faf6ef", "#c9a84c", "#3d2b1f"],
                  minimal:       ["#ffffff", "#f9f9f9", "#111111"],
                  grid:          ["#ffffff", "#f3f4f6", form.primaryColor],
                  dark:          ["#111111", "#1f1f1f", form.primaryColor],
                  flipbook:      ["#fefefe", "#f0f0f0", form.primaryColor],
                  magazine:      ["#ffffff", "#f5f5f5", form.primaryColor],
                  neon:          ["#0a0a0a", "#1a1a1a", "#39ff14"],
                  tokyo:         ["#0a0a0a", "#141414", form.primaryColor],
                  brasserie:     ["#faf6ef", "#1c1208", "#c9a84c"],
                  mediterranean: ["#f0f7fa", "#1a6b8a", "#ffffff"],
                  street:        ["#111111", form.primaryColor, "#f5f5f5"],
                  luxury:        ["#0d0d0d", "#c9a84c", "#f5ede0"],
                };
                const palette = themePalette[t.id] ?? ["#f9f9f9", "#e5e5e5", form.primaryColor];
                return (
                  <button key={t.id} type="button" onClick={() => setForm({ ...form, templateId: t.id })}
                    className={`rounded-xl border-2 text-left transition-all overflow-hidden ${isActive ? "border-blue-500 shadow-md shadow-blue-100" : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"}`}>
                    {/* Mini design preview */}
                    <div className="h-16 relative overflow-hidden" style={{ background: palette[0] }}>
                      {/* Header bar */}
                      <div className="absolute top-0 left-0 right-0 h-4" style={{ background: palette[1] }} />
                      {/* Color accent */}
                      <div className="absolute top-1 left-0 right-0 h-0.5" style={{ background: palette[2] }} />
                      {/* Fake content lines */}
                      <div className="absolute top-6 left-3 right-3 space-y-1.5">
                        <div className="h-1.5 rounded-full" style={{ background: `${palette[2]}90`, width: "70%" }} />
                        <div className="h-1 rounded-full" style={{ background: `${palette[1] === "#ffffff" ? "#e5e5e5" : palette[1]}80`, width: "50%" }} />
                        <div className="h-1 rounded-full" style={{ background: `${palette[1] === "#ffffff" ? "#e5e5e5" : palette[1]}60`, width: "60%" }} />
                      </div>
                      {/* Accent dot */}
                      <div className="absolute bottom-2 right-3 w-4 h-4 rounded-full opacity-70" style={{ background: palette[2] }} />
                      {isActive && (
                        <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                          <span className="text-white text-[8px] font-bold">✓</span>
                        </div>
                      )}
                    </div>
                    <div className="p-2.5">
                      <div className={`font-semibold text-xs leading-snug ${isActive ? "text-blue-600" : "text-gray-900"}`}>{t.name}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5 leading-tight line-clamp-2">{t.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {restaurant && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-3 flex items-center justify-between border border-blue-100">
              <div>
                <span className="text-sm font-medium text-gray-700">Live preview</span>
                <p className="text-xs text-gray-500 mt-0.5">Changes shown after saving</p>
              </div>
              <a href={`/r/${restaurant.slug}`} target="_blank" rel="noopener noreferrer"
                className="text-sm text-blue-600 font-semibold hover:text-blue-700 flex items-center gap-1">
                Open menu ↗
              </a>
            </div>
          )}
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
