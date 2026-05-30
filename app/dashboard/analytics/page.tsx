"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Eye, Star, Search, Smartphone, Monitor, BarChart3, ArrowUpRight } from "lucide-react";

interface Stats {
  totalScans: number; thisMonthScans: number; lastMonthScans: number; growthPercent: number | null;
  scansByDay: { day: string; count: number }[];
  scansByHour: { hour: string; count: number }[];
  scansByDevice: { deviceType: string; count: number }[];
  topSearchTerms: { term: string; count: number }[];
  feedbackStats: { total: number; avgRating: number; fiveStar: number; fourStar: number; threeStar: number; lowStar: number };
  itemViewStats: { id: string; name: string; viewCount: number; price: number }[];
}

function StatCard({ label, value, sub, icon, positive }: { label: string; value: string | number; sub?: string; icon: React.ReactNode; positive?: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {sub && <p className={`text-xs mt-1 font-medium ${positive === true ? "text-green-600" : positive === false ? "text-red-500" : "text-gray-400"}`}>{sub}</p>}
        </div>
        <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-orange-500">{icon}</div>
      </div>
    </div>
  );
}

function MiniBar({ data, maxVal, color = "#f97316" }: { data: { label: string; value: number }[]; maxVal: number; color?: string }) {
  return (
    <div className="flex items-end gap-0.5 h-20">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center" title={`${d.label}: ${d.value}`}>
          <div className="w-full rounded-t-sm" style={{ height: `${maxVal > 0 ? (d.value / maxVal) * 72 : 0}px`, backgroundColor: color, minHeight: d.value > 0 ? "2px" : "0" }} />
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const s = await fetch("/api/dashboard/stats").then(r => r.json());
        const data = await fetch(`/api/restaurants/${s.restaurantId}/analytics-advanced`).then(r => r.json());
        setStats(data);
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="p-6 flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" /></div>;
  if (!stats) return <div className="p-6 text-center text-gray-400">Could not load analytics</div>;

  const hourData = Array.from({ length: 24 }, (_, i) => ({ label: `${i}:00`, value: Number(stats.scansByHour.find(h => parseInt(h.hour) === i)?.count ?? 0) }));
  const maxHour = Math.max(...hourData.map(h => h.value), 1);
  const dayData = stats.scansByDay.slice(-14).map(d => ({ label: d.day, value: Number(d.count) }));
  const maxDay = Math.max(...dayData.map(d => d.value), 1);
  const totalDev = stats.scansByDevice.reduce((s, d) => s + Number(d.count), 0);
  const mobileCount = Number(stats.scansByDevice.find(d => d.deviceType === "mobile")?.count ?? 0);
  const mobilePercent = totalDev > 0 ? Math.round((mobileCount / totalDev) * 100) : 0;
  const growthPositive = stats.growthPercent !== null && stats.growthPercent >= 0;

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">Last 30 days · scans, searches, feedback & item performance</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Scans" value={stats.totalScans.toLocaleString()} icon={<Eye className="w-5 h-5" />} />
        <StatCard label="This Month" value={stats.thisMonthScans.toLocaleString()}
          sub={stats.growthPercent !== null ? `${growthPositive ? "+" : ""}${stats.growthPercent}% vs last month` : undefined}
          icon={growthPositive ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
          positive={stats.growthPercent !== null ? growthPositive : undefined} />
        <StatCard label="Avg Rating"
          value={stats.feedbackStats?.avgRating ? Number(stats.feedbackStats.avgRating).toFixed(1) + " ★" : "—"}
          sub={`${stats.feedbackStats?.total ?? 0} reviews`} icon={<Star className="w-5 h-5" />} />
        <StatCard label="Mobile" value={`${mobilePercent}%`} sub={`${mobileCount} of ${totalDev} scans`} icon={<Smartphone className="w-5 h-5" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 text-sm">Daily Scans (last 14 days)</h3>
            <BarChart3 className="w-4 h-4 text-gray-400" />
          </div>
          {dayData.length > 0 ? <><MiniBar data={dayData} maxVal={maxDay} /><div className="flex justify-between mt-1"><span className="text-[10px] text-gray-400">{dayData[0]?.label?.slice(5)}</span><span className="text-[10px] text-gray-400">{dayData[dayData.length-1]?.label?.slice(5)}</span></div></> : <p className="text-sm text-gray-400 text-center py-6">No data yet — share your QR code!</p>}
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 text-sm">Peak Hours</h3>
            <Monitor className="w-4 h-4 text-gray-400" />
          </div>
          <MiniBar data={hourData} maxVal={maxHour} color="#6366f1" />
          <div className="flex justify-between mt-1"><span className="text-[10px] text-gray-400">0h</span><span className="text-[10px] text-gray-400">12h</span><span className="text-[10px] text-gray-400">23h</span></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 text-sm mb-3 flex items-center gap-2"><Search className="w-4 h-4 text-gray-400" /> Top Searches</h3>
          {stats.topSearchTerms.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">No searches yet</p> : (
            <div className="space-y-2">{stats.topSearchTerms.slice(0, 8).map((t, i) => (
              <div key={t.term} className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400 w-4">{i+1}</span>
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-400 rounded-full" style={{ width: `${(t.count / stats.topSearchTerms[0].count) * 100}%` }} />
                </div>
                <span className="text-xs font-medium text-gray-700 truncate max-w-[80px]">{t.term}</span>
                <span className="text-[10px] text-gray-400 w-5 text-right">{t.count}</span>
              </div>
            ))}</div>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 text-sm mb-3 flex items-center gap-2"><Star className="w-4 h-4 text-gray-400" /> Rating Breakdown</h3>
          <div className="space-y-2">{([5,4,3,2] as const).map(rating => {
            const key = rating === 5 ? "fiveStar" : rating === 4 ? "fourStar" : rating === 3 ? "threeStar" : "lowStar";
            const count = Number(stats.feedbackStats?.[key as keyof typeof stats.feedbackStats] ?? 0);
            const total = Number(stats.feedbackStats?.total ?? 1);
            return (
              <div key={rating} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-5">{rating}★</span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${total > 0 ? (count/total)*100 : 0}%`, backgroundColor: rating >= 4 ? "#22c55e" : rating === 3 ? "#f59e0b" : "#ef4444" }} />
                </div>
                <span className="text-[10px] text-gray-400 w-5 text-right">{count}</span>
              </div>
            );
          })}</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 text-sm mb-3 flex items-center gap-2"><ArrowUpRight className="w-4 h-4 text-gray-400" /> Most Viewed Items</h3>
          {stats.itemViewStats.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">No data yet</p> : (
            <div className="space-y-2">{stats.itemViewStats.slice(0, 6).map((item, i) => (
              <div key={item.id} className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400 w-4">{i+1}</span>
                <p className="flex-1 text-xs text-gray-700 truncate">{item.name}</p>
                <div className="flex items-center gap-1 flex-shrink-0"><Eye className="w-3 h-3 text-gray-300" /><span className="text-[10px] text-gray-400">{Number(item.viewCount)}</span></div>
              </div>
            ))}</div>
          )}
        </div>
      </div>
    </div>
  );
}
