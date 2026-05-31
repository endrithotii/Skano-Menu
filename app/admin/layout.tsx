"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Building2, Users, BarChart3,
  Settings, LogOut, Menu, X, Utensils, ChevronRight, Shield, Activity, FileText, Sliders
} from "lucide-react";
import toast from "react-hot-toast";

const navItems = [
  { href: "/admin",                 label: "Dashboard",   icon: LayoutDashboard },
  { href: "/admin/platform",        label: "Platform",    icon: Activity },
  { href: "/admin/restaurants",     label: "Restaurants", icon: Building2 },
  { href: "/admin/users",           label: "Users",       icon: Users },
  { href: "/admin/feature-flags",   label: "Controls",    icon: Sliders },
  { href: "/admin/analytics",       label: "Analytics",   icon: BarChart3 },
  { href: "/admin/audit",           label: "Audit Log",   icon: FileText },
  { href: "/admin/settings",        label: "Settings",    icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then(async (res) => {
      if (!res.ok) { router.push("/login"); return; }
      const data = await res.json();
      if (data.user?.role !== "SUPER_ADMIN") { router.push("/dashboard"); return; }
      setUser(data.user);
    });
  }, [router]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success("Logged out");
    router.push("/login");
  }

  const Sidebar = () => (
    <div className="flex flex-col h-full p-6">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center">
          <Utensils className="w-4 h-4 text-white" />
        </div>
        <span className="text-lg font-bold text-white">SkanoMenu</span>
      </div>
      <div className="mb-6">
        <span className="inline-flex items-center gap-1 text-xs bg-violet-500/20 text-violet-200 px-2 py-0.5 rounded-full border border-violet-500/30">
          <Shield className="w-2.5 h-2.5" /> SUPER ADMIN
        </span>
      </div>

      {user && (
        <div className="mb-6 p-3 bg-white/5 rounded-xl">
          <div className="text-sm font-semibold text-white truncate">{user.name}</div>
          <div className="text-xs text-gray-400 truncate">{user.email}</div>
        </div>
      )}

      <nav className="flex-1 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href} onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active ? "bg-violet-500 text-white shadow-lg shadow-violet-500/25" : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
              {active && <ChevronRight className="w-3 h-3 ml-auto" />}
            </Link>
          );
        })}
      </nav>

      <div className="pt-4 border-t border-white/10">
        <Link href="/" className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs text-gray-500 hover:text-gray-300 transition-colors mb-1">
          View public site →
        </Link>
        <button onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-red-500/10 hover:text-red-400 w-full transition-all">
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      <aside className="hidden lg:flex flex-col w-64 bg-gray-900 border-r border-white/5 flex-shrink-0">
        <Sidebar />
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-gray-900 shadow-xl">
            <button onClick={() => setSidebarOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <Sidebar />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-gray-900 border-b border-white/5 px-4 lg:px-6 py-3 flex items-center gap-4">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-gray-400 hover:text-white">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <div className="text-xs text-gray-500">Admin Panel</div>
        </header>
        <main className="flex-1 overflow-y-auto bg-gray-950">
          {children}
        </main>
      </div>
    </div>
  );
}
