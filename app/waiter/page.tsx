"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Check, BellRing, LogOut, Volume2, VolumeX, Wifi, WifiOff } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

interface WaiterCall {
  id: string;
  tableNumber: string | null;
  message: string | null;
  status: "pending" | "resolved";
  createdAt: string;
}

interface WaiterSession {
  name: string;
  restaurantId: string;
  restaurantName: string;
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h`;
}

function playAlert(volume = 0.8) {
  try {
    const ctx = new AudioContext();
    const playTone = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(volume, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur + 0.05);
    };
    playTone(880, 0, 0.15);
    playTone(1100, 0.18, 0.15);
    playTone(880, 0.36, 0.25);
    setTimeout(() => ctx.close(), 1000);
  } catch { /* browsers may block autoplay */ }
}

export default function WaiterPage() {
  const router = useRouter();
  const [session, setSession] = useState<WaiterSession | null>(null);
  const [calls, setCalls] = useState<WaiterCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<Set<string>>(new Set());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [flash, setFlash] = useState(false);
  const [online, setOnline] = useState(true);
  const prevPendingCount = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (rid: string, silent = false) => {
    try {
      const res = await fetch(`/api/restaurants/${rid}/waiter-call`);
      if (!res.ok) {
        if (!silent) setOnline(false);
        return;
      }
      setOnline(true);
      const data = await res.json();
      const newCalls: WaiterCall[] = data.calls ?? [];
      const pending = newCalls.filter((c) => c.status === "pending");

      if (pending.length > prevPendingCount.current && prevPendingCount.current >= 0) {
        // New call arrived
        if (soundEnabled) playAlert();
        setFlash(true);
        setTimeout(() => setFlash(false), 1200);
      }
      prevPendingCount.current = pending.length;
      setCalls(newCalls);
    } catch {
      if (!silent) setOnline(false);
    }
  }, [soundEnabled]);

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch("/api/waiter/session");
        if (!res.ok) { router.replace("/login"); return; }
        const data = await res.json();
        setSession(data);
        await load(data.restaurantId);
        setLoading(false);
        // Poll every 3 seconds
        pollRef.current = setInterval(() => load(data.restaurantId, true), 3000);
      } catch {
        router.replace("/login");
      }
    }
    init();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-create poll when soundEnabled changes
  useEffect(() => {
    if (!session) return;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => load(session.restaurantId, true), 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [soundEnabled, session, load]);

  async function resolve(callId: string) {
    if (!session) return;
    setResolving((prev) => new Set(prev).add(callId));
    try {
      const res = await fetch(`/api/restaurants/${session.restaurantId}/waiter-call`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId }),
      });
      if (res.ok) {
        toast.success("Done ✓");
        await load(session.restaurantId, true);
      } else {
        toast.error("Failed");
      }
    } catch { toast.error("Network error"); }
    setResolving((prev) => { const s = new Set(prev); s.delete(callId); return s; });
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
  }

  const pending = calls.filter((c) => c.status === "pending");
  const recent = calls.filter((c) => c.status === "resolved").slice(0, 6);

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className={`min-h-screen transition-colors duration-200 ${flash ? "bg-orange-500" : "bg-gray-950"}`}>
      <Toaster position="top-center" toastOptions={{ style: { background: "#1f2937", color: "#fff" } }} />

      {/* Header */}
      <div className="bg-gray-900 border-b border-white/5 px-4 py-3 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${online ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
            <span className="text-white font-bold text-sm">{session?.restaurantName}</span>
          </div>
          <p className="text-gray-400 text-xs mt-0.5">👋 {session?.name}</p>
        </div>
        <div className="flex items-center gap-2">
          {!online && <WifiOff className="w-4 h-4 text-red-400" />}
          <button
            onClick={() => setSoundEnabled((v) => !v)}
            className={`p-2 rounded-xl border transition-colors ${soundEnabled ? "bg-orange-500/20 border-orange-500/40 text-orange-400" : "border-white/10 text-gray-500"}`}
            title={soundEnabled ? "Mute alerts" : "Enable alerts"}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <button onClick={logout} className="p-2 rounded-xl border border-white/10 text-gray-500 hover:text-white transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 pb-24 space-y-5">

        {/* Pending call count banner */}
        {pending.length > 0 && (
          <div className={`rounded-2xl p-4 flex items-center gap-3 transition-all ${flash ? "bg-white/20" : "bg-orange-500/15 border border-orange-500/30"}`}>
            <BellRing className="w-6 h-6 text-orange-400 flex-shrink-0 animate-bounce" />
            <div>
              <p className="text-white font-bold text-base">{pending.length} table{pending.length !== 1 ? "s" : ""} waiting</p>
              <p className="text-orange-300 text-xs mt-0.5">Tap Done when you've attended the table</p>
            </div>
          </div>
        )}

        {/* Pending calls */}
        {pending.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-5">
              <Check className="w-10 h-10 text-green-400" />
            </div>
            <p className="text-white font-bold text-xl">All clear!</p>
            <p className="text-gray-500 text-sm mt-2">No pending calls right now</p>
            <div className="mt-4 flex items-center gap-1.5 text-xs text-gray-600">
              <Wifi className="w-3 h-3" /> Checking every 3 seconds
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((call) => (
              <div key={call.id} className="bg-gray-900 border border-orange-500/30 rounded-2xl overflow-hidden shadow-lg shadow-orange-500/5">
                {/* Top accent */}
                <div className="h-1 bg-gradient-to-r from-orange-500 to-amber-400" />
                <div className="p-4 flex items-center gap-4">
                  {/* Bell */}
                  <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                    <BellRing className="w-7 h-7 text-red-400" />
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {call.tableNumber ? (
                      <p className="text-white font-black text-2xl leading-none">Table {call.tableNumber}</p>
                    ) : (
                      <p className="text-gray-400 font-semibold text-lg">Unknown table</p>
                    )}
                    {call.message && (
                      <p className="text-gray-300 text-sm mt-1.5 leading-relaxed">{call.message}</p>
                    )}
                    <p className="text-gray-600 text-xs mt-2">{timeAgo(call.createdAt)} ago</p>
                  </div>
                  {/* Done button */}
                  <button
                    onClick={() => resolve(call.id)}
                    disabled={resolving.has(call.id)}
                    className="flex-shrink-0 w-16 h-16 rounded-2xl bg-green-500 hover:bg-green-400 active:scale-95 transition-all flex items-center justify-center shadow-lg shadow-green-500/30 disabled:opacity-50"
                  >
                    {resolving.has(call.id) ? (
                      <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Check className="w-7 h-7 text-white stroke-[3]" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Recent resolved */}
        {recent.length > 0 && (
          <div>
            <p className="text-xs text-gray-600 uppercase tracking-widest font-semibold mb-3">Recently resolved</p>
            <div className="space-y-2">
              {recent.map((call) => (
                <div key={call.id} className="bg-gray-900/50 border border-white/5 rounded-xl px-4 py-3 flex items-center gap-3 opacity-50">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="text-sm text-gray-400 flex-1">
                    {call.tableNumber ? `Table ${call.tableNumber}` : "Unknown table"}
                    {call.message && ` · ${call.message}`}
                  </span>
                  <span className="text-xs text-gray-600">{timeAgo(call.createdAt)} ago</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom status bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-white/5 px-4 py-3 flex items-center justify-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full ${online ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
        <span className="text-xs text-gray-500">{online ? "Live · updates every 3s" : "Reconnecting…"}</span>
      </div>
    </div>
  );
}
