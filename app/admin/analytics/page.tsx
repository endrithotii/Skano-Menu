"use client";

import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";
import { QrCode, Star, Building2, Users, TrendingUp } from "lucide-react";

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

const COLORS = ["#8b5cf6", "#6d28d9", "#5b21b6", "#4c1d95", "#3b0764"];

export default function AdminAnalyticsPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats").then((r) => r.json()).then((d) => { setStats(d); setLoading(false); });
  }, []);

  if (loading) return <div className="p-6 flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" /></div>;
  if (!stats) return null;

  const weekTotal = stats.scansLast7Days.reduce((a, b) => a + b.count, 0);

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Platform Analytics</h1>
        <p className="text-gray-400 text-sm mt-1">Aggregated metrics across all restaurants</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Weekly Scans", value: weekTotal.toLocaleString(), icon: <QrCode className="w-4 h-4 text-violet-400" />, color: "bg-violet-500/10" },
          { label: "Active Restaurants", value: `${stats.activeRestaurants} / ${stats.totalRestaurants}`, icon: <Building2 className="w-4 h-4 text-green-400" />, color: "bg-green-500/10" },
          { label: "Total Reviews", value: stats.totalFeedbacks.toString(), icon: <Star className="w-4 h-4 text-amber-400" />, color: "bg-amber-500/10" },
          { label: "Platform Users", value: stats.totalUsers.toString(), icon: <Users className="w-4 h-4 text-blue-400" />, color: "bg-blue-500/10" },
        ].map((card) => (
          <div key={card.label} className="bg-gray-900 rounded-2xl p-5 border border-white/5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${card.color}`}>{card.icon}</div>
            <div className="text-2xl font-bold text-white">{card.value}</div>
            <div className="text-xs text-gray-500 mt-1">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Scan trend */}
      <div className="bg-gray-900 rounded-2xl p-5 border border-white/5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-semibold text-white">Scan Volume Trend</h2>
            <p className="text-xs text-gray-500">All restaurants combined, last 7 days</p>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-violet-400 bg-violet-400/10 px-3 py-1 rounded-full">
            <TrendingUp className="w-3.5 h-3.5" /> {weekTotal} this week
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={stats.scansLast7Days}>
            <defs>
              <linearGradient id="adminAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#6b7280" }} tickLine={false} axisLine={false}
              tickFormatter={(v) => new Date(v).toLocaleDateString("en", { weekday: "short", day: "numeric" })} />
            <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ background: "#1f2937", border: "none", borderRadius: "12px", color: "#f9fafb" }}
              labelFormatter={(v) => new Date(v).toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" })} />
            <Area type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#adminAreaGrad)"
              dot={{ fill: "#8b5cf6", r: 4 }} activeDot={{ r: 6 }} name="Scans" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Top restaurants comparison */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 rounded-2xl p-5 border border-white/5">
          <h2 className="font-semibold text-white mb-4">Top Restaurants by Scans</h2>
          {stats.topRestaurants.length === 0 ? (
            <div className="text-center py-12 text-gray-600 text-sm">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.topRestaurants.slice(0, 5)} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11, fill: "#6b7280" }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "#1f2937", border: "none", borderRadius: "12px", color: "#f9fafb" }} />
                <Bar dataKey="_count.scans" radius={[0, 6, 6, 0]} name="Scans">
                  {stats.topRestaurants.slice(0, 5).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Restaurant status donut */}
        <div className="bg-gray-900 rounded-2xl p-5 border border-white/5">
          <h2 className="font-semibold text-white mb-4">Restaurant Status Breakdown</h2>
          <div className="space-y-4 mt-6">
            {[
              { label: "Active", count: stats.activeRestaurants, color: "bg-green-400", pct: stats.totalRestaurants ? Math.round((stats.activeRestaurants / stats.totalRestaurants) * 100) : 0 },
              { label: "Pending", count: stats.pendingRestaurants, color: "bg-amber-400", pct: stats.totalRestaurants ? Math.round((stats.pendingRestaurants / stats.totalRestaurants) * 100) : 0 },
              { label: "Suspended", count: stats.totalRestaurants - stats.activeRestaurants - stats.pendingRestaurants, color: "bg-red-400", pct: stats.totalRestaurants ? Math.round(((stats.totalRestaurants - stats.activeRestaurants - stats.pendingRestaurants) / stats.totalRestaurants) * 100) : 0 },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${s.color}`} />
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-300">{s.label}</span>
                    <span className="text-gray-400">{s.count} ({s.pct}%)</span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full">
                    <div className={`h-2 rounded-full transition-all ${s.color}`} style={{ width: `${s.pct}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-white/5 text-center">
            <div className="text-3xl font-bold text-white">{stats.totalRestaurants}</div>
            <div className="text-sm text-gray-500">Total restaurants</div>
          </div>
        </div>
      </div>
    </div>
  );
}
