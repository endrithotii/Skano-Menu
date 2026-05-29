"use client";

import { useEffect, useState, useCallback } from "react";
import { BellRing, Check, Clock, Table2, RefreshCw, Volume2 } from "lucide-react";
import toast from "react-hot-toast";

interface WaiterCall {
  id: string;
  tableNumber: string | null;
  message: string | null;
  status: "pending" | "resolved";
  createdAt: string;
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export default function WaiterCallsPage() {
  const [restaurantId, setRestaurantId] = useState("");
  const [calls, setCalls] = useState<WaiterCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastCallCount, setLastCallCount] = useState(0);

  const load = useCallback(async (rid?: string) => {
    const id = rid ?? restaurantId;
    if (!id) return;
    try {
      const res = await fetch(`/api/restaurants/${id}/waiter-call`);
      if (!res.ok) return;
      const data = await res.json();
      const newCalls: WaiterCall[] = data.calls ?? [];
      const pendingCount = newCalls.filter((c) => c.status === "pending").length;

      // Play sound if new pending calls arrived
      if (pendingCount > lastCallCount && lastCallCount > 0 && soundEnabled) {
        try {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = 880;
          gain.gain.value = 0.3;
          osc.start();
          setTimeout(() => { osc.stop(); ctx.close(); }, 300);
        } catch { /* */ }
      }

      setCalls(newCalls);
      setLastCallCount(pendingCount);
    } catch { /* */ }
  }, [restaurantId, lastCallCount, soundEnabled]);

  useEffect(() => {
    async function init() {
      const statsRes = await fetch("/api/dashboard/stats");
      const stats = await statsRes.json();
      setRestaurantId(stats.restaurantId);
      await load(stats.restaurantId);
      setLoading(false);
    }
    init();
  }, []);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    if (!restaurantId) return;
    const interval = setInterval(() => load(), 5000);
    return () => clearInterval(interval);
  }, [restaurantId, load]);

  async function resolve(callId: string) {
    setResolving(callId);
    const res = await fetch(`/api/restaurants/${restaurantId}/waiter-call`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callId }),
    });
    setResolving(null);
    if (res.ok) { toast.success("Marked as resolved"); load(); }
    else toast.error("Failed");
  }

  const pending = calls.filter((c) => c.status === "pending");
  const resolved = calls.filter((c) => c.status === "resolved");

  if (loading) return (
    <div className="p-6 flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="p-4 lg:p-6 max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Waiter Calls</h1>
          <p className="text-sm text-gray-500 mt-1">Live table requests from customers · auto-refreshes every 5s</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setSoundEnabled((v) => !v)} title="Toggle notification sound"
            className={`p-2 rounded-xl border transition-colors text-sm ${soundEnabled ? "bg-orange-50 border-orange-200 text-orange-600" : "border-gray-200 text-gray-400 hover:bg-gray-50"}`}>
            <Volume2 className="w-4 h-4" />
          </button>
          <button onClick={() => load()} title="Refresh"
            className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Live indicator */}
      <div className="flex items-center gap-2 text-xs font-medium text-green-600">
        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
        Live · auto-refreshing
        {pending.length > 0 && (
          <span className="ml-auto bg-red-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
            {pending.length} pending
          </span>
        )}
      </div>

      {/* Pending calls */}
      {pending.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
          <BellRing className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="font-medium text-gray-500">No pending calls</p>
          <p className="text-sm text-gray-400 mt-1">When a customer taps "Call Waiter", it appears here instantly</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pending ({pending.length})</p>
          {pending.map((call) => (
            <div key={call.id}
              className="bg-white rounded-2xl border border-orange-200 shadow-sm p-4 flex items-center gap-4 animate-pulse-slow">
              <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <BellRing className="w-5 h-5 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {call.tableNumber && (
                    <span className="flex items-center gap-1 font-bold text-gray-900 text-sm">
                      <Table2 className="w-3.5 h-3.5" />
                      Table {call.tableNumber}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <Clock className="w-3 h-3" />{timeAgo(call.createdAt)}
                  </span>
                </div>
                {call.message && <p className="text-sm text-gray-600 mt-0.5 truncate">{call.message}</p>}
              </div>
              <button onClick={() => resolve(call.id)} disabled={resolving === call.id}
                className="flex items-center gap-1.5 px-3 py-2 bg-green-500 text-white text-xs font-semibold rounded-xl hover:bg-green-600 transition-colors disabled:opacity-60 flex-shrink-0">
                {resolving === call.id
                  ? <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <Check className="w-3.5 h-3.5" />}
                Done
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Recent resolved */}
      {resolved.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Recently Resolved</p>
          {resolved.slice(0, 10).map((call) => (
            <div key={call.id} className="bg-gray-50 rounded-xl border border-gray-100 p-3 flex items-center gap-3 opacity-60">
              <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm text-gray-600">
                  {call.tableNumber ? `Table ${call.tableNumber}` : "Unknown table"}
                  {call.message && ` · ${call.message}`}
                </span>
              </div>
              <span className="text-xs text-gray-400">{timeAgo(call.createdAt)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
        <p className="text-sm text-blue-700">
          <span className="font-semibold">Tip:</span> Keep this page open on a tablet at the bar or kitchen. It refreshes automatically and plays a sound when a new call arrives (if sound is enabled).
        </p>
      </div>
    </div>
  );
}
