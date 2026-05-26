"use client";

import { Shield, Bell, Globe, Database } from "lucide-react";

export default function AdminSettingsPage() {
  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Platform Settings</h1>
        <p className="text-gray-400 text-sm mt-1">Configure platform-wide settings</p>
      </div>

      <div className="grid gap-6">
        {[
          {
            icon: <Globe className="w-5 h-5 text-violet-400" />,
            title: "Platform Configuration",
            items: [
              { label: "Platform Name", value: "SkanoMenu", type: "text" },
              { label: "Support Email", value: "support@skano.menu", type: "email" },
              { label: "Platform URL", value: "https://skano.menu", type: "url" },
            ],
          },
          {
            icon: <Shield className="w-5 h-5 text-green-400" />,
            title: "Security Settings",
            items: [
              { label: "Require email verification", value: "disabled", type: "toggle" },
              { label: "Auto-approve restaurants", value: "disabled", type: "toggle" },
              { label: "Allow public registration", value: "enabled", type: "toggle" },
            ],
          },
          {
            icon: <Bell className="w-5 h-5 text-amber-400" />,
            title: "Notifications",
            items: [
              { label: "New restaurant alerts", value: "enabled", type: "toggle" },
              { label: "Daily digest email", value: "disabled", type: "toggle" },
              { label: "Low activity warnings", value: "disabled", type: "toggle" },
            ],
          },
        ].map((section) => (
          <div key={section.title} className="bg-gray-900 rounded-2xl border border-white/5 p-5">
            <h2 className="font-semibold text-white flex items-center gap-2 mb-5">
              {section.icon} {section.title}
            </h2>
            <div className="space-y-4">
              {section.items.map((item) => (
                <div key={item.label} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <label className="text-sm text-gray-300">{item.label}</label>
                  {item.type === "toggle" ? (
                    <div className={`w-10 h-5 rounded-full relative ${item.value === "enabled" ? "bg-violet-500" : "bg-gray-600"}`}>
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${item.value === "enabled" ? "translate-x-5" : "translate-x-0.5"}`} />
                    </div>
                  ) : (
                    <input defaultValue={item.value} type={item.type}
                      className="text-sm bg-gray-800 text-gray-300 px-3 py-1.5 rounded-lg border border-white/10 focus:outline-none focus:border-violet-500 w-64" />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* DB info */}
        <div className="bg-gray-900 rounded-2xl border border-white/5 p-5">
          <h2 className="font-semibold text-white flex items-center gap-2 mb-4">
            <Database className="w-5 h-5 text-blue-400" /> System Information
          </h2>
          <div className="space-y-2 text-sm">
            {[
              { label: "Database", value: "SQLite (dev.db)" },
              { label: "Framework", value: "Next.js 14 App Router" },
              { label: "Version", value: "1.0.0" },
              { label: "Environment", value: process.env.NODE_ENV || "development" },
            ].map((row) => (
              <div key={row.label} className="flex justify-between py-2 border-b border-white/5 last:border-0">
                <span className="text-gray-500">{row.label}</span>
                <span className="text-gray-300 font-mono">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
