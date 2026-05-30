"use client";
import { useEffect, useState } from "react";
import { TrendingUp, Users, Building2, Star, Eye, Activity, BarChart3, Shield } from "lucide-react";

interface PlatformStats {
  restaurants: { total: number; active: number; pending: number };
  users: { managers: number; waiters: number };
  scans: { total: number; thisMonth: number; lastMonth: number; growthPercent: number | null };
  feedback: { total: number; avgRating: number };
  topRestaurants: any[];
  scansByDay: { day: string; count: number }[];
  planBreakdown: { tier: string; count: number }[];
}
function KPI({ label, value, sub, icon, color = "orange" }: { label: string; value: string | number; sub?: string; icon: React.ReactNode; color?: string }) {
  const bg = { blue: "bg-blue-50 text-blue-500", green: "bg-green-50 text-green-500", purple: "bg-purple-50 text-purple-500", orange: "bg-orange-50 text-orange-500" }[color] ?? "bg-orange-50 text-orange-500";
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-start gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>{icon}</div>
      <div><p className="text-xs font-medium text-gray-500">{label}</p><p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>{sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}</div>
    </div>
  );
}
function MiniBar({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return <div className="flex items-end gap-0.5 h-16">{data.map((d,i) => <div key={i} className="flex-1" title={`${d.label}: ${d.value}`}><div className="w-full bg-orange-400 rounded-t-sm" style={{ height: `${(d.value/max)*56}px`, minHeight: d.value > 0 ? "2px" : "0" }} /></div>)}</div>;
}
export default function PlatformPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/admin/platform-stats").then(r=>r.json()).then(setStats).catch(console.error).finally(()=>setLoading(false)); }, []);
  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" /></div>;
  if (!stats) return <div className="p-6 text-center text-gray-400">Could not load</div>;
  const dayData = (stats.scansByDay ?? []).slice(-14).map(d => ({ label: d.day?.slice(5), value: Number(d.count) }));
  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-6xl">
      <div><h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Activity className="w-6 h-6 text-orange-500" /> Platform Overview</h1><p className="text-sm text-gray-500 mt-1">Real-time across all restaurants</p></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Restaurants" value={stats.restaurants.total} sub={`${stats.restaurants.active} active · ${stats.restaurants.pending} pending`} icon={<Building2 className="w-5 h-5" />} color="blue" />
        <KPI label="Total Scans" value={stats.scans.total.toLocaleString()} sub={`${stats.scans.thisMonth} this month`} icon={<Eye className="w-5 h-5" />} />
        <KPI label="Users" value={stats.users.managers + stats.users.waiters} sub={`${stats.users.managers} managers · ${stats.users.waiters} waiters`} icon={<Users className="w-5 h-5" />} color="purple" />
        <KPI label="Avg Rating" value={stats.feedback.avgRating ? Number(stats.feedback.avgRating).toFixed(1)+" ★" : "—"} sub={`${stats.feedback.total} reviews`} icon={<Star className="w-5 h-5" />} color="green" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 text-sm mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-gray-400" /> Global Daily Scans (14d)</h3>
          {dayData.length > 0 ? <><MiniBar data={dayData} /><div className="flex justify-between mt-1"><span className="text-[10px] text-gray-400">{dayData[0]?.label}</span><span className="text-[10px] text-gray-400">{dayData[dayData.length-1]?.label}</span></div></> : <p className="text-sm text-gray-400 text-center py-6">No data</p>}
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 text-sm mb-4 flex items-center gap-2"><Shield className="w-4 h-4 text-gray-400" /> Plans</h3>
          <div className="space-y-2">{(stats.planBreakdown ?? []).map(p => <div key={p.tier} className="flex items-center gap-2"><span className="text-xs font-medium text-gray-700 capitalize w-20">{p.tier}</span><div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-orange-400 rounded-full" style={{ width: `${stats.restaurants.total > 0 ? (Number(p.count)/stats.restaurants.total)*100 : 0}%` }} /></div><span className="text-xs text-gray-400 w-5">{Number(p.count)}</span></div>)}</div>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 text-sm mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-gray-400" /> Top Restaurants</h3>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left border-b border-gray-100">{["Name","Slug","Status","Plan","Scans"].map(h=><th key={h} className="pb-2 font-semibold text-gray-500 text-xs pr-4">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-50">{(stats.topRestaurants??[]).map((r:any)=><tr key={r.id} className="hover:bg-gray-50"><td className="py-2.5 pr-4 font-medium text-gray-900">{r.name}</td><td className="py-2.5 pr-4 text-gray-400 font-mono text-xs">/{r.slug}</td><td className="py-2.5 pr-4"><span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${r.status==="ACTIVE"?"bg-green-100 text-green-700":"bg-gray-100 text-gray-500"}`}>{r.status}</span></td><td className="py-2.5 pr-4 text-gray-400 capitalize text-xs">{r.planTier||"free"}</td><td className="py-2.5 font-bold text-orange-500">{Number(r.scanCount).toLocaleString()}</td></tr>)}</tbody>
        </table></div>
      </div>
    </div>
  );
}
