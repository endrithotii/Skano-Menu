"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, UtensilsCrossed, QrCode,
  MessageSquare, Settings, LogOut, Menu, X, Utensils, ChevronRight, ChevronDown,
  Stamp, Clock, Search, Palette, BookCopy, CalendarClock, Share2, Megaphone, ChefHat, Users, ScanLine, Lock, History, LayoutGrid, CalendarCheck, Timer, Briefcase, BedDouble, HandPlatter, UserCog, CalendarDays, Star, CircleHelp,
} from "lucide-react";
import type { Permission } from "@/lib/permissions";
import toast from "react-hot-toast";
import { NotificationBell } from "@/components/dashboard/notifications";
import { AccountModal } from "@/components/dashboard/account-modal";
import { GuidedTour } from "@/components/tour/tour";
import { NavigationGuardProvider, useNavigationGuard } from "@/lib/navigation-guard";

// need: the page shows for anyone with one of these actions (Staff & roles). No need = everyone.
type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; need?: Permission[]; staffOnly?: boolean };
// The sidebar, in groups of pages that belong together. Groups with nothing this person may open are hidden.
const navGroups: { name: string | null; items: NavItem[] }[] = [
  { name: null, items: [
    { href: "/dashboard",                     label: "Dashboard",         icon: LayoutDashboard },
    { href: "/dashboard/check-in",            label: "Check in / out",    icon: Timer, staffOnly: true },
    { href: "/dashboard/my-work",             label: "My work",           icon: CalendarDays, staffOnly: true },
    { href: "/dashboard/my-feedback",         label: "My feedback",       icon: Star, staffOnly: true },
  ] },
  { name: "Menu", items: [
    { href: "/dashboard/menu",                label: "Menu Management",   icon: UtensilsCrossed, need: ["menu.edit", "menu.live"] },
    { href: "/dashboard/all-menus",           label: "All menus",         icon: BookCopy, need: ["menu.edit", "menu.live"] },
    { href: "/dashboard/design-menu",         label: "Design your digital Menu", icon: Palette, need: ["design.edit"] },
    { href: "/dashboard/ingredients",         label: "Ingredients & details", icon: ChefHat, need: ["details.edit", "details.ask"] },
    { href: "/dashboard/schedule-menu",       label: "Schedule menu",     icon: CalendarClock, need: ["schedule.manage"] },
    { href: "/dashboard/qrcode",              label: "QR Code",           icon: QrCode, need: ["qr.view"] },
  ] },
  { name: "Tables & reservations", items: [
    { href: "/dashboard/reservations",        label: "Reservations",      icon: CalendarCheck, need: ["reservations.manage"] },
    { href: "/dashboard/floor-plan",          label: "Floor plan & tables", icon: LayoutGrid, need: ["floor.edit"] },
    { href: "/dashboard/table-service",       label: "Table ordering",    icon: HandPlatter, need: ["tableservice.orders", "tableservice.manage"] },
    { href: "/dashboard/exceptions",          label: "Open hours & holidays", icon: Clock, need: ["hours.edit"] },
  ] },
  { name: "Customers", items: [
    { href: "/dashboard/loyalty",             label: "Loyalty Cards",     icon: Stamp, need: ["loyalty.settings"] },
    { href: "/waiter",                        label: "Confirm stamps",    icon: ScanLine, need: ["loyalty.stamp"], staffOnly: true },
    { href: "/dashboard/feedback",            label: "Feedback",          icon: MessageSquare, need: ["feedback.manage"] },
    { href: "/dashboard/announcements",       label: "Announcement Banner", icon: Megaphone, need: ["announcements.manage"] },
  ] },
  { name: "Online presence", items: [
    { href: "/dashboard/social-media",        label: "Social medias",     icon: Share2, need: ["social.edit"] },
    { href: "/dashboard/seo",                 label: "SEO & Analytics",   icon: Search, need: ["seo.manage"] },
  ] },
  { name: "Hotel", items: [
    { href: "/dashboard/room-service",        label: "Room service",      icon: BedDouble, need: ["roomservice.orders", "roomservice.manage"] },
  ] },
  { name: "Team & account", items: [
    { href: "/dashboard/hr",                  label: "HR",                icon: Briefcase, need: ["hr.manage", "hr.documents"] },
    { href: "/dashboard/staff",               label: "Staff & roles",     icon: Users, need: ["staff.manage"] },
    { href: "/dashboard/history",             label: "Action history",    icon: History, need: ["history.view"] },
    { href: "/dashboard/settings",            label: "Settings",          icon: Settings, need: ["settings.edit"] },
  ] },
  { name: "Help", items: [
    { href: "/dashboard/faq",                 label: "FAQ",               icon: CircleHelp },
  ] },
];
const navItems: NavItem[] = navGroups.flatMap((g) => g.items);
const FOLDED_KEY = "skano.sidebar.folded";

interface DashboardAccess { restaurantId: string | null; owner: boolean; staff: boolean; permissions: Permission[]; roleName: string | null }
const STAFF_ROLES = ["WAITER", "CHEF", "STAFF"];

function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // What this person may do (the owner: everything). Checked again on every page change, so dates take effect.
  const [access, setAccess] = useState<DashboardAccess | null>(null);
  // Sidebar groups this person folded (remembered in this browser)
  const [folded, setFolded] = useState<string[]>([]);
  useEffect(() => {
    void Promise.resolve().then(() => {
      try { const v = JSON.parse(localStorage.getItem(FOLDED_KEY) ?? "[]"); if (Array.isArray(v)) setFolded(v.filter((x) => typeof x === "string")); } catch { /* nothing saved */ }
    });
  }, []);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetch("/api/dashboard/access").then((r) => (r.ok ? r.json() : null)).then((d) => { if (!cancelled && d) setAccess(d); }).catch(() => {});
    return () => { cancelled = true; };
  }, [user, pathname]);

  useEffect(() => {
    // Only a real "not signed in" answer goes to the login page; a server hiccup is tried again
    const getMe = async (tries = 3): Promise<Response | null> => {
      const res = await fetch("/api/auth/me").catch(() => null);
      if (res && (res.ok || res.status === 401 || res.status === 404)) return res;
      if (tries <= 1) return res;
      await new Promise((r) => setTimeout(r, 1500));
      return getMe(tries - 1);
    };
    getMe().then(async (res) => {
      if (!res) { toast.error("Can't reach the server. Check your connection and reload the page."); return; }
      if (!res.ok && res.status !== 401 && res.status !== 404) { toast.error("Something went wrong. Please reload the page."); return; }
      if (!res.ok) { router.push("/login"); return; }
      const data = await res.json();
      const role = data.user?.role;
      if (role === "SUPER_ADMIN") { router.push("/admin"); return; }
      // Owners (MANAGER and legacy RESTAURANT_OWNER) and staff (they see the pages they have access to)
      if (role !== "MANAGER" && role !== "RESTAURANT_OWNER" && !STAFF_ROLES.includes(role)) { router.push("/login"); return; }
      setUser(data.user);
    });
  }, [router]);

  const { confirmLeave } = useNavigationGuard();
  // Ask before leaving a page with unsaved changes (Link onNavigate only runs for client-side navigation)
  const guardNavigate = (e: { preventDefault: () => void }) => { if (!confirmLeave()) e.preventDefault(); };

  async function logout() {
    if (!confirmLeave()) return;
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success("Logged out");
    router.push("/login");
  }

  const allowed = (need?: Permission[]) => !need || !!access?.owner || need.some((p) => access?.permissions.includes(p));
  const canSee = (i: NavItem) => (access ? allowed(i.need) && (!i.staffOnly || access.staff) : !i.need && !i.staffOnly);
  const visibleGroups = navGroups.map((g) => ({ ...g, items: g.items.filter(canSee) })).filter((g) => g.items.length);
  const toggleGroup = (name: string) => setFolded((f) => {
    const next = f.includes(name) ? f.filter((x) => x !== name) : [...f, name];
    try { localStorage.setItem(FOLDED_KEY, JSON.stringify(next)); } catch { /* private window */ }
    return next;
  });
  // This page: staff only see pages they have access to (pages not in the sidebar are for the owner)
  const page = navItems.find((i) => i.href === pathname);
  const blocked = !!access && !access.owner && (page ? !allowed(page.need) : pathname !== "/dashboard");

  const roleLabel = access?.staff ? (access.roleName ?? "Staff") : "Manager";
  const logo = (
    <Link href="/dashboard" onNavigate={guardNavigate} className="flex items-center gap-2 shrink-0" aria-label="SkanoMenu, to the dashboard">
      <span className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
        <Utensils className="w-4 h-4 text-white" />
      </span>
      <span className="text-lg font-bold bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent">SkanoMenu</span>
    </Link>
  );
  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={`flex flex-col h-full min-h-0 ${mobile ? "p-4 pt-14" : "px-4 py-4"}`}>
      {mobile && <div className="absolute top-4 left-4">{logo}</div>}
      {user && (
        <div className="mb-4 p-3 bg-blue-50 rounded-xl shrink-0 flex items-start gap-2" data-profile>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-0.5">{roleLabel}</div>
            <div className="text-sm font-semibold text-gray-900 truncate">{user.name}</div>
            <div className="text-xs text-gray-500 truncate">{user.email}</div>
          </div>
          <button type="button" onClick={() => { setSidebarOpen(false); setAccountOpen(true); }} title="My account: name, email, password" data-go="account"
            className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-white hover:bg-blue-100 border border-blue-100 rounded-lg px-2 py-1.5">
            <UserCog className="w-3.5 h-3.5" aria-hidden /> Account
          </button>
        </div>
      )}

      <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain -mr-2 pr-2 space-y-4">
        {visibleGroups.map((g) => {
          const hasActive = g.items.some((i) => i.href === pathname);
          // The group of the page you're on always stays open
          const open = !g.name || hasActive || !folded.includes(g.name);
          return (
            <div key={g.name ?? "top"} data-nav-group={g.name ?? ""}>
              {g.name && (
                <button type="button" onClick={() => toggleGroup(g.name!)} aria-expanded={open} disabled={hasActive}
                  className="w-full flex items-center gap-1 px-3 mb-1 text-xs font-semibold text-gray-400 hover:text-gray-600 disabled:hover:text-gray-400 disabled:cursor-default">
                  <span className="truncate">{g.name}</span>
                  {!hasActive && <ChevronDown className={`w-3.5 h-3.5 ml-auto transition-transform ${open ? "" : "-rotate-90"}`} />}
                </button>
              )}
              {open && (
                <div className="space-y-0.5">
                  {g.items.map(({ href, label, icon: Icon }) => {
                    const active = pathname === href;
                    return (
                      <Link
                        key={href}
                        href={href}
                        onNavigate={guardNavigate}
                        onClick={() => setSidebarOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                          active
                            ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/25"
                            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                        }`}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        <span className="min-w-0 truncate whitespace-nowrap">{label}</span>
                        {active && <ChevronRight className="w-3 h-3 ml-auto" />}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="pt-4 border-t border-gray-100 shrink-0">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 w-full transition-all"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  );

  // Phones and tablets scroll the whole page (an inner scroll box gets cut short there).
  // Desktop, and pages that need a fixed-height split view, keep the screen-high shell.
  const boxed = pathname === "/dashboard/customize";
  return (
    <div className={`flex flex-col bg-gray-50 lg:h-dvh lg:overflow-hidden ${boxed ? "h-dvh overflow-hidden" : "min-h-dvh"}`}>
      {/* Top bar, over the whole width: the logo on the left */}
      <header className="sticky top-0 z-40 lg:static bg-white border-b border-gray-100 pl-4 pr-4 lg:pr-6 py-3 flex items-center gap-3 shrink-0">
        <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-gray-500 hover:text-gray-700" aria-label="Open the menu">
          <Menu className="w-5 h-5" />
        </button>
        {logo}
        <div className="flex-1 min-w-0" />
        <Link href="/" onNavigate={guardNavigate} className="text-xs text-gray-400 hover:text-gray-600 transition-colors whitespace-nowrap shrink-0">
          <span className="sm:hidden">Landing page</span><span className="hidden sm:inline">View landing page</span>
        </Link>
        {access?.restaurantId && <NotificationBell restaurantId={access.restaurantId} />}
      </header>
      <GuidedTour />
      {accountOpen && user && <AccountModal user={user} roleLabel={roleLabel} onClose={() => setAccountOpen(false)} onSaved={(u) => setUser((x) => (x ? { ...x, ...u } : x))} />}

      <div className={`flex flex-1 lg:min-h-0 ${boxed ? "min-h-0" : ""}`}>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-[300px] min-h-0 overflow-y-auto bg-white border-r border-gray-100 flex-shrink-0">
        <Sidebar />
      </aside>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-[300px] max-w-[90vw] bg-white shadow-xl overflow-y-auto">
            <button onClick={() => setSidebarOpen(false)} className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 z-10">
              <X className="w-5 h-5" />
            </button>
            <Sidebar mobile />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className={`flex-1 flex flex-col min-w-0 lg:overflow-hidden ${boxed ? "overflow-hidden" : ""}`}>
        <main className={`flex-1 lg:overflow-y-auto ${boxed ? "min-h-0 overflow-y-auto" : ""}`} data-dash-ready={user && access ? "" : undefined}>
          {!user || !access ? (
            <div className="p-6 flex justify-center"><div className="animate-spin w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full" /></div>
          ) : blocked ? (
            <div className="p-6">
              <div className="max-w-lg mx-auto mt-10 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
                <Lock className="w-8 h-8 text-gray-300 mx-auto" />
                <h1 className="mt-3 text-lg font-bold text-gray-900">You don&apos;t have access to this page</h1>
                <p className="mt-1 text-sm text-gray-500">Ask the manager to give you access on Staff &amp; roles. Access can also start or end on a date.</p>
                <Link href="/dashboard" className="mt-4 inline-block text-sm font-semibold text-blue-600 hover:text-blue-700">Back to the dashboard</Link>
              </div>
            </div>
          ) : children}
        </main>
      </div>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <NavigationGuardProvider>
      <DashboardShell>{children}</DashboardShell>
    </NavigationGuardProvider>
  );
}
