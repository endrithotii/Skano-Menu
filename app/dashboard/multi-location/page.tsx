"use client";
import { useEffect, useState } from "react";
import { Building2, Plus, ExternalLink, ChevronRight, Check } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";

interface Restaurant { id: string; name: string; slug: string; status: string; primaryColor: string; accessType: string; }

export default function MultiLocationPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [activeId, setActiveId] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", address: "" });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    (async () => {
      const s = await fetch("/api/dashboard/stats").then(r => r.json());
      setActiveId(s.restaurantId);
      const d = await fetch("/api/manager/restaurants").then(r => r.json());
      setRestaurants(d.restaurants ?? []);
      setLoading(false);
    })();
  }, []);

  function switchTo(id: string) {
    try { localStorage.setItem("skano_active_restaurant", id); } catch { /**/ }
    setActiveId(id);
    toast.success("Switched restaurant — refresh dashboard pages to update");
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const res = await fetch("/api/manager/restaurants", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    setCreating(false);
    if (res.ok) {
      const data = await res.json();
      toast.success(`"${data.name}" created!`);
      setShowForm(false);
      setForm({ name: "", description: "", address: "" });
      const d = await fetch("/api/manager/restaurants").then(r => r.json());
      setRestaurants(d.restaurants ?? []);
    } else {
      const err = await res.json();
      toast.error(err.error || "Failed to create");
    }
  }

  if (loading) return <div className="p-6 flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="p-4 lg:p-6 max-w-2xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Building2 className="w-6 h-6 text-orange-500" /> My Restaurants</h1>
          <p className="text-sm text-gray-500 mt-1">Manage multiple locations from one account</p>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Add Location
        </button>
      </div>

      {showForm && (
        <form onSubmit={create} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">New Restaurant Location</h2>
          <div><label className="block text-xs font-medium text-gray-700 mb-1">Restaurant name *</label>
            <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Bella Vista — Peja" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30" />
          </div>
          <div><label className="block text-xs font-medium text-gray-700 mb-1">Address</label>
            <input value={form.address} onChange={e => setForm({...form, address: e.target.value})} placeholder="Street, City" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30" />
          </div>
          <div><label className="block text-xs font-medium text-gray-700 mb-1">Short description</label>
            <input value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="A brief intro" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={creating} className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl disabled:opacity-60">
              {creating ? "Creating…" : "Create Location"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 border border-gray-200 text-sm text-gray-600 rounded-xl hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {restaurants.map(r => (
          <div key={r.id} className={`bg-white rounded-2xl border shadow-sm p-4 ${r.id === activeId ? "border-orange-300 ring-1 ring-orange-200" : "border-gray-100"}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: r.primaryColor + "20" }}>
                <Building2 className="w-5 h-5" style={{ color: r.primaryColor }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-900 text-sm truncate">{r.name}</p>
                  {r.id === activeId && <span className="text-[10px] px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full font-bold flex items-center gap-1"><Check className="w-2.5 h-2.5" /> Active</span>}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${r.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{r.status}</span>
                </div>
                <p className="text-xs text-gray-400 truncate">/{r.slug}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {r.id !== activeId && (
                  <button onClick={() => switchTo(r.id)} className="text-xs px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-600 font-semibold rounded-lg transition-colors">Switch</button>
                )}
                <a href={`/r/${r.slug}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <Link href="/dashboard" className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-sm text-blue-700">
        <p className="font-semibold mb-1">How multi-location works</p>
        <ul className="space-y-0.5 text-xs opacity-80">
          <li>• Click <strong>Switch</strong> to make a restaurant active in your dashboard</li>
          <li>• Each location has its own menu, QR code, analytics, and settings</li>
          <li>• Super admins can also grant you access to restaurants owned by others</li>
        </ul>
      </div>
    </div>
  );
}
