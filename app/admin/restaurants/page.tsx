"use client";

import { useEffect, useState } from "react";
import { Building2, CheckCircle2, Clock, XCircle, Eye, Search, Star, QrCode } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  status: string;
  cuisine: string;
  address: string | null;
  createdAt: string;
  owner: { name: string; email: string };
  stats: { totalScans: number; recentScanCount: number; avgRating: number; totalItems: number };
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-400/10 text-green-400 border-green-400/20",
  PENDING: "bg-amber-400/10 text-amber-400 border-amber-400/20",
  SUSPENDED: "bg-red-400/10 text-red-400 border-red-400/20",
};

export default function AdminRestaurantsPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/restaurants");
    if (res.ok) setRestaurants(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function updateStatus(id: string, status: string) {
    setUpdating(id);
    const res = await fetch(`/api/admin/restaurants/${id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setUpdating(null);
    if (res.ok) { toast.success(`Restaurant ${status.toLowerCase()}`); load(); }
    else toast.error("Failed to update status");
  }

  const filtered = restaurants.filter((r) => {
    const matchesSearch = !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.owner.email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Restaurants</h1>
          <p className="text-gray-400 text-sm mt-1">{restaurants.length} registered restaurants</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or owner email..."
            className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-white/10 rounded-xl text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-violet-500" />
        </div>
        <div className="flex gap-2">
          {["", "ACTIVE", "PENDING", "SUSPENDED"].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${statusFilter === s ? "bg-violet-500 text-white" : "bg-gray-800 text-gray-400 border border-white/10 hover:border-violet-500/50"}`}>
              {s || "All"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map((i) => <div key={i} className="h-24 bg-gray-800 rounded-2xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p>No restaurants found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div key={r.id} className="bg-gray-900 rounded-2xl border border-white/5 p-5">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-5 h-5 text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-white">{r.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[r.status]}`}>
                      {r.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mb-2">
                    Owner: <span className="text-gray-300">{r.owner.name}</span> ({r.owner.email})
                  </div>
                  {r.address && <div className="text-xs text-gray-500 mb-2">{r.address}</div>}
                  <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><QrCode className="w-3 h-3" />{r.stats.totalScans} scans</span>
                    {r.stats.avgRating > 0 && <span className="flex items-center gap-1"><Star className="w-3 h-3 fill-amber-400 text-amber-400" />{r.stats.avgRating.toFixed(1)}</span>}
                    <span>{r.stats.totalItems} menu items</span>
                    <span>Added {new Date(r.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link href={`/r/${r.slug}`} target="_blank"
                    className="p-2 text-gray-500 hover:text-white bg-gray-800 rounded-lg border border-white/10 hover:border-white/20 transition-all">
                    <Eye className="w-4 h-4" />
                  </Link>
                  {r.status !== "ACTIVE" && (
                    <button onClick={() => updateStatus(r.id, "ACTIVE")} disabled={updating === r.id}
                      className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-all disabled:opacity-50">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {r.status === "PENDING" ? "Approve" : "Activate"}
                    </button>
                  )}
                  {r.status !== "PENDING" && (
                    <button onClick={() => updateStatus(r.id, "PENDING")} disabled={updating === r.id}
                      className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all disabled:opacity-50">
                      <Clock className="w-3.5 h-3.5" /> Pending
                    </button>
                  )}
                  {r.status !== "SUSPENDED" && (
                    <button onClick={() => updateStatus(r.id, "SUSPENDED")} disabled={updating === r.id}
                      className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all disabled:opacity-50">
                      <XCircle className="w-3.5 h-3.5" /> Suspend
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
