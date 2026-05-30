"use client";
import { useEffect, useState } from "react";
import { Users, Clock, CheckCircle, Hash, TrendingUp } from "lucide-react";

interface WaiterStats { id: string; name: string; email: string; assignedTables: string[]; resolved: number; pending: number; avgResponseMin: number | null; }

export default function WaiterPerformancePage() {
  const [stats, setStats] = useState<WaiterStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const s = await fetch("/api/dashboard/stats").then(r => r.json());
      const [staffRes, callsRes] = await Promise.all([
        fetch(`/api/restaurants/${s.restaurantId}/staff`).then(r => r.json()),
        fetch(`/api/restaurants/${s.restaurantId}/waiter-call`).then(r => r.json()),
      ]);
      const staff = staffRes.staff ?? [];
      const calls = callsRes.calls ?? [];

      const result: WaiterStats[] = staff.map((w: any) => {
        const tables: string[] = w.assignedTables ?? [];
        const relevant = tables.length === 0 ? calls : calls.filter((c: any) => !c.tableNumber || tables.includes(c.tableNumber));
        const resolved = relevant.filter((c: any) => c.status === "resolved").length;
        const pending = relevant.filter((c: any) => c.status === "pending").length;
        return { id: w.id, name: w.name, email: w.email, assignedTables: tables, resolved, pending, avgResponseMin: null };
      });

      setStats(result);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="p-6 flex justify-center h-64 items-center"><div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="p-4 lg:p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><TrendingUp className="w-6 h-6 text-orange-500" /> Waiter Performance</h1>
        <p className="text-sm text-gray-500 mt-1">Table call statistics per waiter</p>
      </div>

      {stats.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
          <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No waiter staff yet</p>
          <p className="text-sm text-gray-400 mt-1">Add waiters in Waiter Staff to see their performance</p>
        </div>
      ) : (
        <div className="space-y-3">
          {stats.map(w => (
            <div key={w.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600 font-bold text-lg flex-shrink-0">
                  {w.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900">{w.name}</p>
                    {w.assignedTables.length === 0
                      ? <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-semibold">All tables</span>
                      : <div className="flex gap-1 flex-wrap">{w.assignedTables.slice(0,5).map(t => <span key={t} className="text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded-md font-semibold flex items-center gap-0.5"><Hash className="w-2.5 h-2.5" />{t}</span>)}{w.assignedTables.length > 5 && <span className="text-[10px] text-gray-400">+{w.assignedTables.length-5}</span>}</div>
                    }
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{w.email}</p>
                  <div className="flex gap-4 mt-3">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <div><p className="text-sm font-bold text-gray-900">{w.resolved}</p><p className="text-[10px] text-gray-400">Resolved</p></div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-orange-400" />
                      <div><p className="text-sm font-bold text-gray-900">{w.pending}</p><p className="text-[10px] text-gray-400">Pending</p></div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-blue-400" />
                      <div><p className="text-sm font-bold text-gray-900">{w.resolved + w.pending}</p><p className="text-[10px] text-gray-400">Total calls</p></div>
                    </div>
                  </div>
                  {w.resolved + w.pending > 0 && (
                    <div className="mt-3">
                      <div className="flex justify-between mb-1"><span className="text-[10px] text-gray-400">Resolution rate</span><span className="text-[10px] font-medium text-gray-700">{w.resolved + w.pending > 0 ? Math.round((w.resolved / (w.resolved + w.pending)) * 100) : 0}%</span></div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-green-400 rounded-full" style={{ width: `${w.resolved + w.pending > 0 ? (w.resolved / (w.resolved + w.pending)) * 100 : 0}%` }} />
                      </div>
                    </div>
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
