"use client";
import { useEffect, useState } from "react";
import { Search, Save, Globe, BarChart3 } from "lucide-react";
import toast from "react-hot-toast";

export default function SEOPage() {
  const [restaurantId, setRestaurantId] = useState("");
  const [slug, setSlug] = useState("");
  const [form, setForm] = useState({
    metaTitle: "", metaDescription: "", googleAnalyticsId: "", googlePlaceId: "",
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const s = await fetch("/api/dashboard/stats").then(r => r.json());
      setRestaurantId(s.restaurantId);
      const d = await fetch(`/api/restaurants/${s.restaurantId}`).then(r => r.json());
      const r = d.restaurant;
      setSlug(r.slug);
      setForm({
        metaTitle: r.metaTitle ?? "",
        metaDescription: r.metaDescription ?? "",
        googleAnalyticsId: r.googleAnalyticsId ?? "",
        googlePlaceId: r.googlePlaceId ?? "",
      });
      setLoading(false);
    })();
  }, []);

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/restaurants/${restaurantId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) toast.success("SEO settings saved!"); else toast.error("Failed to save");
  }

  const previewTitle = form.metaTitle || "Restaurant Menu";
  const previewDesc = form.metaDescription || "View our full menu, daily specials and more.";
  const previewUrl = `skano-menu.vercel.app/r/${slug}`;

  if (loading) return <div className="p-6 flex justify-center h-64 items-center"><div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="p-4 lg:p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Search className="w-6 h-6 text-orange-500" /> SEO & Integrations</h1>
        <p className="text-sm text-gray-500 mt-1">Control how your menu appears in search engines and connect analytics</p>
      </div>

      {/* Google SERP Preview */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h2 className="font-semibold text-gray-900 text-sm flex items-center gap-2"><Globe className="w-4 h-4 text-gray-400" /> Search Preview</h2>
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
          <p className="text-xs text-green-700 mb-0.5">{previewUrl}</p>
          <p className="text-blue-700 text-base font-medium leading-tight hover:underline cursor-pointer">{previewTitle}</p>
          <p className="text-sm text-gray-500 mt-1 line-clamp-2">{previewDesc}</p>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Meta title <span className="text-gray-400 font-normal">(50–60 chars ideal)</span></label>
            <input value={form.metaTitle} onChange={e => setForm({...form, metaTitle: e.target.value})}
              placeholder="Restaurant Name — Menu & Reservations"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30" />
            <p className="text-[10px] text-gray-400 mt-1">{form.metaTitle.length}/60 characters</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Meta description <span className="text-gray-400 font-normal">(150–160 chars ideal)</span></label>
            <textarea value={form.metaDescription} onChange={e => setForm({...form, metaDescription: e.target.value})}
              rows={3} placeholder="Discover our seasonal menu featuring fresh local ingredients..."
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 resize-none" />
            <p className="text-[10px] text-gray-400 mt-1">{form.metaDescription.length}/160 characters</p>
          </div>
        </div>
      </div>

      {/* Analytics integrations */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h2 className="font-semibold text-gray-900 text-sm flex items-center gap-2"><BarChart3 className="w-4 h-4 text-gray-400" /> Analytics Integrations</h2>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Google Analytics 4 Measurement ID</label>
          <input value={form.googleAnalyticsId} onChange={e => setForm({...form, googleAnalyticsId: e.target.value})}
            placeholder="G-XXXXXXXXXX"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 font-mono" />
          <p className="text-[10px] text-gray-400 mt-1">Find in Google Analytics → Admin → Data Streams</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Google Place ID <span className="text-gray-400 font-normal">(for review count display)</span></label>
          <input value={form.googlePlaceId} onChange={e => setForm({...form, googlePlaceId: e.target.value})}
            placeholder="ChIJ..."
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 font-mono" />
          <p className="text-[10px] text-gray-400 mt-1">
            Find at <a href="https://developers.google.com/maps/documentation/places/web-service/place-id" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline">Google Place ID Finder</a>
          </p>
        </div>
      </div>

      <button onClick={save} disabled={saving} className="w-full flex items-center justify-center gap-2 py-3 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60 shadow-sm">
        <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save SEO Settings"}
      </button>
    </div>
  );
}
