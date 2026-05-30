"use client";
import { useEffect, useState, useCallback } from "react";
import { Bell, Check, Clock, Hash, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

interface WaiterCall { id: string; tableNumber: string | null; message: string | null; status: string; createdAt: string; }

export default function WaiterCallsPage() {
  const [calls, setCalls] = useState<WaiterCall[]>([]);
  const [restaurantId, setRestaurantId] = useState("");
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const load = useCallback(async (rid?: string) => {
    const id = rid ?? restaurantId;
    if (!id) return;
    const d = await fetch(`/api/restaurants/${id}/waiter-call`).then(r => r.json());
    setCalls(d.calls ?? []);
  }, [restaurantId]);

  useEffect(() => {
    (async () => {
      const s = await fetch("/api/dashboard/stats").then(r => r.json());
      setRestaurantId(s.restaurantId);
      await load(s.restaurantId);
      setLoading(false);
    })();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh || !restaurantId) return;
    const timer = setInterval(() => load(), 5000);
    return () => clearInterval(timer);
  }, [autoRefresh, restaurantId, load]);

  async function resolve(callId: string) {
    setResolving(callId);
    await fetch(`/api/restaurants/${restaurantId}/waiter-call`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callId }),
    });
    setResolving(null);
    load();
    toast.success("Call resolved");
  }

  const pending = calls.filter(c => c.status === "pending");
  const resolved = calls.filter(c => c.status === "resolved");

  if (loading) return <div className="p-6 flex justify-center h-64 items-center"><div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-2xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Bell className="w-6 h-6 text-orange-500" /> Waiter Calls</h1>
          <p className="text-sm text-gray-500 mt-1">Live table call board · auto-refreshes every 5s</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setAutoRefresh(v => !v)} className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${autoRefresh ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
            {autoRefresh ? "Live ●" : "Paused"}
          </button>
          <button onClick={() => load()} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Pending calls */}
      {pending.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
          <Bell className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="font-medium text-gray-500">No pending calls</p>
          <p className="text-sm text-gray-400 mt-1">All tables are served ✓</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" /> {pending.length} pending call{pending.length !== 1 ? "s" : ""}
          </p>
          {pending.map(c => (
            <div key={c.id} className="bg-white rounded-2xl border-2 border-orange-200 shadow-sm p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-orange-100 flex flex-col items-center justify-center flex-shrink-0">
                <Hash className="w-3 h-3 text-orange-500" />
                <span className="text-lg font-black text-orange-600 leading-none">{c.tableNumber ?? "?"}</span>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900 text-sm">Table {c.tableNumber ?? "Unknown"} calling</p>
                {c.message && <p className="text-xs text-gray-500 mt-0.5">"{c.message}"</p>}
                <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(c.createdAt).toLocaleTimeString("en",{hour:"2-digit",minute:"2-digit"})}</p>
              </div>
              <button onClick={() => resolve(c.id)} disabled={resolving === c.id}
                className="flex items-center gap-1.5 px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold rounded-xl disabled:opacity-60 transition-colors">
                <Check className="w-3.5 h-3.5" /> {resolving === c.id ? "..." : "Done"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Resolved calls */}
      {resolved.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Recently resolved ({resolved.length})</p>
          <div className="space-y-2 opacity-60">
            {resolved.slice(0,5).map(c => (
              <div key={c.id} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3">
                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                <p className="flex-1 text-xs text-gray-600">Table {c.tableNumber ?? "?"}{c.message ? ` · "${c.message}"` : ""}</p>
                <p className="text-[10px] text-gray-400">{new Date(c.createdAt).toLocaleTimeString("en",{hour:"2-digit",minute:"2-digit"})}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
