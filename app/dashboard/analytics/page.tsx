"use client";

import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie, Legend } from "recharts";
import { QrCode, Star, MessageSquare, TrendingUp, UtensilsCrossed, Search } from "lucide-react";

interface Stats {
  totalScans: number;
  scansLast7Days: { date: string; count: number }[];
  totalFeedbacks: number;
  avgRating: number;
  totalItems: number;
  popularItems: { id: string; name: string; price: number; _count: { feedbacks: number } }[];
  restaurant: { name: string; status: string; slug: string };
  restaurantId: string;
  peakHours: { hour: string; scans: number }[];
  ratingDist: { rating: string; count: number }[];
}

interface SearchTerm {
  term: string;
  count: number;
  lastSearchedAt: string;
}

const COLORS = ["#f97316", "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b"];

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>{icon}</div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [searchTerms, setSearchTerms] = useState<SearchTerm[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/stats").then((r) => r.json()).then((d) => {
      setStats(d);
      setLoading(false);
      // Load search terms for this restaurant
      if (d.restaurantId) {
        fetch(`/api/restaurants/${d.restaurantId}/search-track?limit=15`)
          .then((r) => r.json())
          .then((sd) => setSearchTerms(sd.terms ?? []))
          .catch(() => {});
      }
    });
  }, []);

  if (loading) return <div className="p-6 flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" /></div>;
  if (!stats) return null;

  const ratingDist = stats.ratingDist ?? [];
  const peakHours = stats.peakHours ?? [];

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">{stats.restaurant.name} — Performance overview</p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Scans" value={stats.totalScans.toLocaleString()} icon={<QrCode className="w-5 h-5 text-orange-600" />} color="bg-orange-50" />
        <StatCard label="Menu Items" value={stats.totalItems.toString()} icon={<UtensilsCrossed className="w-5 h-5 text-blue-600" />} color="bg-blue-50" />
        <StatCard label="Total Reviews" value={stats.totalFeedbacks.toString()} icon={<MessageSquare className="w-5 h-5 text-purple-600" />} color="bg-purple-50" />
        <StatCard label="Average Rating" value={stats.avgRating > 0 ? `${stats.avgRating.toFixed(1)} / 5` : "N/A"} icon={<Star className="w-5 h-5 text-amber-500" />} color="bg-amber-50" />
      </div>

      {/* Scans over time */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-semibold text-gray-900">Menu Scans</h2>
            <p className="text-xs text-gray-500">Last 7 days</p>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full">
            <TrendingUp className="w-3.5 h-3.5" />
            <span className="font-medium">
              {stats.scansLast7Days.reduce((a, b) => a + b.count, 0)} total
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={stats.scansLast7Days}>
            <defs>
              <linearGradient id="scanGrad2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f97316" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false}
              tickFormatter={(v) => new Date(v).toLocaleDateString("en", { weekday: "short", day: "numeric" })} />
            <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}
              labelFormatter={(v) => new Date(v).toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" })} />
            <Area type="monotone" dataKey="count" stroke="#f97316" strokeWidth={2.5} fill="url(#scanGrad2)"
              dot={{ fill: "#f97316", r: 4 }} activeDot={{ r: 6 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Peak hours */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-900 mb-1">Peak Hours</h2>
          <p className="text-xs text-gray-500 mb-4">When customers scan your menu most</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={peakHours}>
              <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }} />
              <Bar dataKey="scans" radius={[6, 6, 0, 0]} name="Scans">
                {peakHours.map((_, i) => (
                  <Cell key={i} fill={_.scans === Math.max(...peakHours.map((h) => h.scans)) ? "#f97316" : "#fed7aa"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Rating distribution */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-900 mb-1">Rating Distribution</h2>
          <p className="text-xs text-gray-500 mb-4">Customer satisfaction breakdown</p>
          {stats.totalFeedbacks === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <Star className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">No reviews yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={ratingDist} dataKey="count" nameKey="rating" cx="50%" cy="50%" outerRadius={65} innerRadius={35}>
                  {ratingDist.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Legend iconType="circle" />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Popular items + Search terms side-by-side */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Popular items */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-900 mb-4">Most Reviewed Items</h2>
          {stats.popularItems.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">No reviews yet. Share your menu to get started!</div>
          ) : (
            <div className="space-y-3">
              {stats.popularItems.map((item, i) => (
                <div key={item.id} className="flex items-center gap-4">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold text-white"
                    style={{ background: COLORS[i] || "#9ca3af" }}>
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 text-sm">{item.name}</div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                      <div className="h-1.5 rounded-full transition-all"
                        style={{ width: `${(item._count.feedbacks / (stats.popularItems[0]?._count.feedbacks || 1)) * 100}%`, background: COLORS[i] || "#9ca3af" }} />
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-gray-900">{item._count.feedbacks} reviews</div>
                    <div className="text-xs text-gray-500">€{item.price.toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Search terms */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-1">
            <Search className="w-4 h-4 text-orange-500" />
            <h2 className="font-semibold text-gray-900">Top Search Terms</h2>
          </div>
          <p className="text-xs text-gray-400 mb-4">What customers are looking for in your menu</p>
          {searchTerms.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <Search className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">No searches tracked yet</p>
              <p className="text-xs mt-1 text-gray-300">Customers typing in search will appear here</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {searchTerms.map((st, i) => {
                const max = searchTerms[0]?.count || 1;
                const pct = Math.round((st.count / max) * 100);
                return (
                  <div key={st.term} className="flex items-center gap-3">
                    <div className="w-5 text-xs font-bold text-gray-300 text-right shrink-0">{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-sm font-medium text-gray-800 truncate">{st.term}</span>
                        <span className="text-xs font-bold text-gray-500 ml-2 shrink-0">{st.count}×</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full transition-all bg-orange-400"
                          style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
