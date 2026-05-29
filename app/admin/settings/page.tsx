"use client";

import { useEffect, useState } from "react";
import { Shield, Bell, Globe, Database, Zap, RefreshCw, CheckCircle2, AlertCircle, Activity } from "lucide-react";
import toast from "react-hot-toast";

interface SystemInfo {
  restaurantCount: number;
  userCount: number;
  scanCount: number;
  pendingCount: number;
  dbStatus: "ok" | "error";
  aiStatus: "ok" | "error" | "unknown";
  blobStatus: "ok" | "error" | "unknown";
}

export default function AdminSettingsPage() {
  const [migrating, setMigrating] = useState(false);
  const [migrateResults, setMigrateResults] = useState<string[]>([]);
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  const [loadingSys, setLoadingSys] = useState(true);

  useEffect(() => {
    // Load system info from stats
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then((d) => {
        setSysInfo({
          restaurantCount: d.totalRestaurants ?? 0,
          userCount: d.totalUsers ?? 0,
          scanCount: d.totalScans ?? 0,
          pendingCount: d.pendingRestaurants ?? 0,
          dbStatus: "ok",
          aiStatus: "unknown",
          blobStatus: "unknown",
        });
        setLoadingSys(false);
      })
      .catch(() => setLoadingSys(false));
  }, []);

  async function runMigrations() {
    setMigrating(true);
    setMigrateResults([]);
    try {
      const res = await fetch("/api/admin/migrate", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setMigrateResults(data.results ?? []);
        toast.success("Migration completed");
      } else {
        toast.error("Migration failed — check permissions");
      }
    } catch {
      toast.error("Network error");
    }
    setMigrating(false);
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Platform Settings</h1>
        <p className="text-gray-400 text-sm mt-1">System administration and configuration</p>
      </div>

      {/* System Health */}
      <div className="bg-gray-900 rounded-2xl border border-white/5 p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-green-400" /> System Health
          </h2>
          {loadingSys ? (
            <div className="w-4 h-4 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
          ) : (
            <span className="text-xs text-green-400 bg-green-400/10 px-3 py-1 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block animate-pulse" />
              All Systems Operational
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: "Database", status: sysInfo?.dbStatus ?? "unknown", icon: <Database className="w-4 h-4" /> },
            { label: "AI (Groq)", status: sysInfo?.aiStatus ?? "unknown", icon: <Zap className="w-4 h-4" /> },
            { label: "Blob Storage", status: sysInfo?.blobStatus ?? "unknown", icon: <Globe className="w-4 h-4" /> },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl p-3 border flex items-center gap-2 ${
              s.status === "ok" ? "bg-green-400/5 border-green-400/15" :
              s.status === "error" ? "bg-red-400/5 border-red-400/15" :
              "bg-gray-800/50 border-white/5"
            }`}>
              <div className={
                s.status === "ok" ? "text-green-400" :
                s.status === "error" ? "text-red-400" : "text-gray-500"
              }>
                {s.icon}
              </div>
              <div>
                <div className="text-xs font-medium text-gray-300">{s.label}</div>
                <div className={`text-[10px] font-semibold ${
                  s.status === "ok" ? "text-green-400" :
                  s.status === "error" ? "text-red-400" : "text-gray-500"
                }`}>
                  {s.status === "ok" ? "Online" : s.status === "error" ? "Error" : "Unknown"}
                </div>
              </div>
            </div>
          ))}
        </div>
        {sysInfo && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Restaurants", value: sysInfo.restaurantCount },
              { label: "Users", value: sysInfo.userCount },
              { label: "Total Scans", value: sysInfo.scanCount.toLocaleString() },
              { label: "Pending", value: sysInfo.pendingCount, warn: sysInfo.pendingCount > 0 },
            ].map((m) => (
              <div key={m.label} className="bg-gray-800/50 rounded-xl p-3 text-center">
                <div className={`text-xl font-bold ${m.warn ? "text-amber-400" : "text-white"}`}>{m.value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{m.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DB Migrations */}
      <div className="bg-gray-900 rounded-2xl border border-white/5 p-5">
        <h2 className="font-semibold text-white flex items-center gap-2 mb-2">
          <Database className="w-4 h-4 text-blue-400" /> Database Migrations
        </h2>
        <p className="text-xs text-gray-400 mb-4">
          Run this after each deployment to apply schema changes. Safe to run multiple times — already-applied migrations are skipped.
        </p>
        <button
          onClick={runMigrations}
          disabled={migrating}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${migrating ? "animate-spin" : ""}`} />
          {migrating ? "Running…" : "Run Migrations"}
        </button>
        {migrateResults.length > 0 && (
          <div className="mt-4 bg-black/30 rounded-xl border border-white/5 p-4 space-y-1">
            {migrateResults.map((r, i) => (
              <div key={i} className={`text-xs font-mono flex items-start gap-2 ${
                r.startsWith("✅") ? "text-green-400" :
                r.startsWith("⏭️") ? "text-gray-400" :
                r.startsWith("❌") ? "text-red-400" : "text-gray-300"
              }`}>
                {r}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Platform configuration */}
      <div className="bg-gray-900 rounded-2xl border border-white/5 p-5">
        <h2 className="font-semibold text-white flex items-center gap-2 mb-5">
          <Globe className="w-4 h-4 text-violet-400" /> Platform Configuration
        </h2>
        <div className="space-y-4">
          {[
            { label: "Platform Name", value: "SkanoMenu", type: "text" },
            { label: "Support Email", value: "support@skano.menu", type: "email" },
            { label: "Platform URL", value: "https://skano.menu", type: "url" },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0 gap-4">
              <label className="text-sm text-gray-300 w-40 shrink-0">{item.label}</label>
              <input defaultValue={item.value} type={item.type}
                className="flex-1 text-sm bg-gray-800 text-gray-300 px-3 py-1.5 rounded-lg border border-white/10 focus:outline-none focus:border-violet-500" />
            </div>
          ))}
        </div>
      </div>

      {/* Security & Feature Flags */}
      <div className="bg-gray-900 rounded-2xl border border-white/5 p-5">
        <h2 className="font-semibold text-white flex items-center gap-2 mb-5">
          <Shield className="w-4 h-4 text-green-400" /> Security &amp; Feature Flags
        </h2>
        <div className="space-y-1">
          {[
            { label: "Auto-approve new restaurants", value: false, desc: "Skip manual approval for new sign-ups" },
            { label: "Allow public registration", value: true, desc: "Anyone can create an account" },
            { label: "Require email verification", value: false, desc: "Email must be confirmed before login" },
            { label: "AI menu translation", value: true, desc: "Multi-language AI translation on public menus" },
            { label: "Waiter call feature", value: true, desc: "Customers can call a waiter from the menu" },
            { label: "Promotions banners", value: true, desc: "Show active promotions on public menus" },
            { label: "Menu search tracking", value: true, desc: "Track search terms for analytics" },
          ].map((flag) => (
            <div key={flag.label} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0 gap-4">
              <div>
                <div className="text-sm text-gray-200">{flag.label}</div>
                <div className="text-[11px] text-gray-500 mt-0.5">{flag.desc}</div>
              </div>
              <div className={`relative w-10 h-5 rounded-full cursor-pointer flex-shrink-0 transition-colors ${flag.value ? "bg-violet-500" : "bg-gray-600"}`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${flag.value ? "translate-x-5" : "translate-x-0.5"}`} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-gray-900 rounded-2xl border border-white/5 p-5">
        <h2 className="font-semibold text-white flex items-center gap-2 mb-5">
          <Bell className="w-4 h-4 text-amber-400" /> Notifications
        </h2>
        <div className="space-y-1">
          {[
            { label: "New restaurant alerts", value: true },
            { label: "Daily digest email", value: false },
            { label: "Low activity warnings", value: false },
            { label: "New feedback notifications", value: true },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
              <label className="text-sm text-gray-300">{item.label}</label>
              <div className={`relative w-10 h-5 rounded-full cursor-pointer flex-shrink-0 transition-colors ${item.value ? "bg-amber-500" : "bg-gray-600"}`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${item.value ? "translate-x-5" : "translate-x-0.5"}`} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* System info */}
      <div className="bg-gray-900 rounded-2xl border border-white/5 p-5">
        <h2 className="font-semibold text-white flex items-center gap-2 mb-4">
          <Database className="w-4 h-4 text-blue-400" /> System Information
        </h2>
        <div className="space-y-0">
          {[
            { label: "Database", value: "Turso (libSQL / SQLite)" },
            { label: "Framework", value: "Next.js 15 App Router" },
            { label: "ORM", value: "Prisma 7" },
            { label: "AI Provider", value: "Groq (llama-3.3-70b)" },
            { label: "Storage", value: "Vercel Blob" },
            { label: "Platform Version", value: "2.0.0" },
            { label: "Templates Available", value: "15 designs" },
          ].map((row) => (
            <div key={row.label} className="flex justify-between py-2.5 border-b border-white/5 last:border-0">
              <span className="text-sm text-gray-500">{row.label}</span>
              <span className="text-sm text-gray-300 font-mono">{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Danger zone */}
      <div className="bg-red-500/5 rounded-2xl border border-red-500/15 p-5">
        <h2 className="font-semibold text-red-400 flex items-center gap-2 mb-4">
          <AlertCircle className="w-4 h-4" /> Danger Zone
        </h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-red-500/10">
            <div>
              <div className="text-sm text-gray-300">Clear all search term history</div>
              <div className="text-xs text-gray-500 mt-0.5">Permanently delete all tracked search terms</div>
            </div>
            <button className="text-xs font-semibold text-red-400 hover:text-red-300 border border-red-400/30 hover:border-red-400/60 px-3 py-1.5 rounded-lg transition-colors">
              Clear
            </button>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <div className="text-sm text-gray-300">Purge all scan data older than 90 days</div>
              <div className="text-xs text-gray-500 mt-0.5">Free up database space — analytics will reset</div>
            </div>
            <button className="text-xs font-semibold text-red-400 hover:text-red-300 border border-red-400/30 hover:border-red-400/60 px-3 py-1.5 rounded-lg transition-colors">
              Purge
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
