"use client";

import { useEffect, useState } from "react";
import { QrCode, Star, UtensilsCrossed, MessageSquare, TrendingUp, TrendingDown, Eye, Calendar } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";
import Link from "next/link";

interface Stats {
  totalScans: number;
  scansLast7Days: { date: string; count: number }[];
  totalFeedbacks: number;
  avgRating: number;
  totalItems: number;
  popularItems: { id: string; name: string; price: number; _count: { feedbacks: number } }[];
  restaurant: { name: string; status: string; slug: string };
}

function StatCard({ title, value, icon, subtitle, trend }: {
  title: string; value: string | number; icon: React.ReactNode;
  subtitle?: string; trend?: "up" | "down" | "neutral";
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-medium text-gray-600">{title}</div>
        <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center text-orange-500">{icon}</div>
      </div>
      <div className="text-3xl font-bold text-gray-900 mb-1">{value}</div>
      {subtitle && (
        <div className={`text-xs flex items-center gap-1 ${trend === "up" ? "text-green-600" : trend === "down" ? "text-red-500" : "text-gray-500"}`}>
          {trend === "up" && <TrendingUp className="w-3 h-3" />}
          {trend === "down" && <TrendingDown className="w-3 h-3" />}
          {subtitle}
        </div>
      )}
    </div>
  );
}

const COLORS = ["#f97316", "#fb923c", "#fdba74", "#fed7aa", "#ffedd5"];

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then((d) => { if (!d.error) setStats(d); setLoading(false); });
  }, []);

  if (loading) return (
    <div className="p-6 space-y-4">
      <div className="h-8 bg-gray-200 rounded-xl w-48 animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map((i) => <div key={i} className="h-28 bg-gray-200 rounded-2xl animate-pulse" />)}
      </div>
    </div>
  );

  if (!stats) return null;

  const todayScans = stats.scansLast7Days[stats.scansLast7Days.length - 1]?.count ?? 0;
  const yesterdayScans = stats.scansLast7Days[stats.scansLast7Days.length - 2]?.count ?? 0;
  const scanTrend = todayScans >= yesterdayScans ? "up" : "down";

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{stats.restaurant.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              stats.restaurant.status === "ACTIVE" ? "bg-green-100 text-green-700" :
              stats.restaurant.status === "PENDING" ? "bg-yellow-100 text-yellow-700" :
              "bg-red-100 text-red-700"
            }`}>{stats.restaurant.status}</span>
            {stats.restaurant.status === "ACTIVE" && (
              <Link href={`/r/${stats.restaurant.slug}`} target="_blank"
                className="text-xs text-orange-600 hover:underline flex items-center gap-1">
                <Eye className="w-3 h-3" /> View public menu
              </Link>
            )}
          </div>
        </div>
        <Link href="/dashboard/menu"
          className="bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all shadow-lg shadow-orange-500/25">
          Manage Menu
        </Link>
      </div>

      {/* Status banner for pending restaurants */}
      {stats.restaurant.status === "PENDING" && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Calendar className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <div className="font-semibold text-amber-800 text-sm">Awaiting Approval</div>
            <div className="text-amber-700 text-xs mt-0.5">Your restaurant is pending admin approval. You can still set up your menu in the meantime.</div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Scans" value={stats.totalScans.toLocaleString()} icon={<QrCode className="w-4 h-4" />}
          subtitle={`${todayScans} today`} trend={scanTrend} />
        <StatCard title="Menu Items" value={stats.totalItems} icon={<UtensilsCrossed className="w-4 h-4" />}
          subtitle="across all categories" />
        <StatCard title="Reviews" value={stats.totalFeedbacks} icon={<MessageSquare className="w-4 h-4" />}
          subtitle="total feedback" />
        <StatCard title="Avg Rating" value={stats.avgRating > 0 ? `${stats.avgRating.toFixed(1)}★` : "—"} icon={<Star className="w-4 h-4" />}
          subtitle={stats.avgRating > 4 ? "Excellent!" : stats.avgRating > 3 ? "Good" : "Needs attention"} />
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Weekly scans chart */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Weekly Scans</h2>
            <span className="text-xs text-gray-500">Last 7 days</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={stats.scansLast7Days}>
              <defs>
                <linearGradient id="scanGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false}
                tickFormatter={(v) => new Date(v).toLocaleDateString("en", { weekday: "short" })} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}
                labelFormatter={(v) => new Date(v).toLocaleDateString("en", { weekday: "long", month: "short", day: "numeric" })} />
              <Area type="monotone" dataKey="count" stroke="#f97316" strokeWidth={2.5} fill="url(#scanGrad)" dot={{ fill: "#f97316", r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Popular items */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Popular Items</h2>
            <span className="text-xs text-gray-500">By reviews</span>
          </div>
          {stats.popularItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <UtensilsCrossed className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">No reviews yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={stats.popularItems} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: "#374151" }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }} />
                <Bar dataKey="_count.feedbacks" radius={[0, 6, 6, 0]} name="Reviews">
                  {stats.popularItems.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { href: "/dashboard/menu", label: "Add Menu Item", icon: <UtensilsCrossed className="w-5 h-5" />, color: "from-orange-500 to-amber-500" },
          { href: "/dashboard/daily-menu", label: "Set Daily Special", icon: <Calendar className="w-5 h-5" />, color: "from-green-500 to-emerald-500" },
          { href: "/dashboard/qrcode", label: "Download QR Code", icon: <QrCode className="w-5 h-5" />, color: "from-blue-500 to-cyan-500" },
          { href: "/dashboard/feedback", label: "View Reviews", icon: <MessageSquare className="w-5 h-5" />, color: "from-purple-500 to-pink-500" },
        ].map((action) => (
          <Link key={action.href} href={action.href}
            className={`bg-gradient-to-br ${action.color} p-4 rounded-2xl text-white hover:opacity-90 transition-opacity`}>
            <div className="mb-2">{action.icon}</div>
            <div className="text-sm font-semibold">{action.label}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
