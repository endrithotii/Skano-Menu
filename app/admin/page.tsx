"use client";

import { useEffect, useState } from "react";
import { Building2, Users, QrCode, Star, TrendingUp, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import Link from "next/link";

interface AdminStats {
  totalRestaurants: number;
  activeRestaurants: number;
  pendingRestaurants: number;
  totalUsers: number;
  totalScans: number;
  totalFeedbacks: number;
  scansLast7Days: { date: string; count: number }[];
  topRestaurants: { id: string; name: string; slug: string; _count: { scans: number }; avgRating: number }[];
}

function StatCard({ label, value, icon, color, sub }: { label: string; value: number | string; icon: React.ReactNode; color: string; sub?: string }) {
  return (
    <div className="bg-gray-900 rounded-2xl p-5 border border-white/5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-gray-400">{label}</div>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>{icon}</div>
      </div>
      <div className="text-3xl font-bold text-white mb-1">{value}</div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats").then((r) => r.json()).then((d) => { setStats(d); setLoading(false); });
  }, []);

  if (loading) return (
    <div className="p-6 space-y-4">
      <div className="h-8 bg-gray-800 rounded-xl w-48 animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map((i) => <div key={i} className="h-28 bg-gray-800 rounded-2xl animate-pulse" />)}
      </div>
    </div>
  );

  if (!stats) return null;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">Platform-wide overview</p>
        </div>
        <div className="text-xs text-gray-500 bg-gray-800 px-3 py-1.5 rounded-full">
          {new Date().toLocaleDateString("en", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </div>
      </div>

      {/* Pending alert */}
      {stats.pendingRestaurants > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-amber-200 text-sm font-medium">{stats.pendingRestaurants} restaurant{stats.pendingRestaurants !== 1 ? "s" : ""} awaiting approval</div>
          </div>
          <Link href="/admin/restaurants" className="text-xs text-amber-400 hover:text-amber-300 font-semibold whitespace-nowrap">
            Review now →
          </Link>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Restaurants" value={stats.totalRestaurants} icon={<Building2 className="w-4 h-4 text-violet-400" />} color="bg-violet-500/10" sub={`${stats.activeRestaurants} active`} />
        <StatCard label="Total Users" value={stats.totalUsers} icon={<Users className="w-4 h-4 text-blue-400" />} color="bg-blue-500/10" />
        <StatCard label="Total Scans" value={stats.totalScans.toLocaleString()} icon={<QrCode className="w-4 h-4 text-orange-400" />} color="bg-orange-500/10" />
        <StatCard label="Total Reviews" value={stats.totalFeedbacks} icon={<Star className="w-4 h-4 text-amber-400" />} color="bg-amber-500/10" />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 rounded-2xl p-5 border border-white/5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-white">Platform Scans</h2>
              <p className="text-xs text-gray-500">Last 7 days across all restaurants</p>
            </div>
            <div className="flex items-center gap-1 text-sm text-green-400 bg-green-400/10 px-3 py-1 rounded-full">
              <TrendingUp className="w-3.5 h-3.5" />
              {stats.scansLast7Days.reduce((a, b) => a + b.count, 0)} total
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={stats.scansLast7Days}>
              <defs>
                <linearGradient id="adminScanGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#6b7280" }} tickLine={false} axisLine={false}
                tickFormatter={(v) => new Date(v).toLocaleDateString("en", { weekday: "short" })} />
              <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "#1f2937", border: "none", borderRadius: "12px", color: "#f9fafb" }}
                labelFormatter={(v) => new Date(v).toLocaleDateString("en", { weekday: "long", month: "short", day: "numeric" })} />
              <Area type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#adminScanGrad)" dot={{ fill: "#8b5cf6", r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Top restaurants */}
        <div className="bg-gray-900 rounded-2xl p-5 border border-white/5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">Top Restaurants</h2>
            <Link href="/admin/restaurants" className="text-xs text-gray-400 hover:text-white">View all →</Link>
          </div>
          {stats.topRestaurants.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-600">
              <Building2 className="w-8 h-8 mb-2" />
              <p className="text-sm">No active restaurants</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.topRestaurants.map((r, i) => (
                <div key={r.id} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{r.name}</div>
                    <div className="text-xs text-gray-500">{r._count.scans} scans</div>
                  </div>
                  {r.avgRating > 0 && (
                    <div className="flex items-center gap-1 text-xs text-amber-400">
                      <Star className="w-3 h-3 fill-amber-400" /> {r.avgRating.toFixed(1)}
                    </div>
                  )}
                  <Link href={`/r/${r.slug}`} target="_blank"
                    className="text-xs text-gray-500 hover:text-white px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                    View
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Restaurant status breakdown */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Active", count: stats.activeRestaurants, icon: <CheckCircle2 className="w-4 h-4" />, color: "text-green-400", bg: "bg-green-400/10 border-green-400/20" },
          { label: "Pending", count: stats.pendingRestaurants, icon: <Clock className="w-4 h-4" />, color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/20" },
          { label: "Suspended", count: stats.totalRestaurants - stats.activeRestaurants - stats.pendingRestaurants, icon: <AlertCircle className="w-4 h-4" />, color: "text-red-400", bg: "bg-red-400/10 border-red-400/20" },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl p-4 border ${s.bg}`}>
            <div className={`flex items-center gap-2 mb-2 ${s.color}`}>
              {s.icon} <span className="text-sm font-medium">{s.label}</span>
            </div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.count}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
