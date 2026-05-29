"use client";

import { useEffect, useState } from "react";
import {
  Users, Building2, Shield, ChefHat, BellRing,
  Search, UserPlus, Eye, EyeOff, Hash, Trash2,
  X, ChevronRight, ChevronDown,
} from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────
interface WaiterUser {
  id: string;
  name: string;
  email: string;
  assignedTables: string[];
  createdAt: string;
}

interface ManagerUser {
  id: string;
  name: string;
  email: string;
  role: "MANAGER" | "RESTAURANT_OWNER";
  createdAt: string;
  restaurant: { id: string; name: string; slug: string; status: string } | null;
  waiters?: WaiterUser[];
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN";
  createdAt: string;
}

// ── Role badge ────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  if (role === "SUPER_ADMIN") return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/25 font-medium">
      <Shield className="w-3 h-3" /> Super Admin
    </span>
  );
  if (role === "MANAGER" || role === "RESTAURANT_OWNER") return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/25 font-medium">
      <ChefHat className="w-3 h-3" /> Manager
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25 font-medium">
      <BellRing className="w-3 h-3" /> Waiter
    </span>
  );
}

// ── Manager row (expandable to show waiters) ──────────────────────────────
function ManagerRow({
  manager,
  onDelete,
  deleting,
}: {
  manager: ManagerUser;
  onDelete: (id: string, name: string) => void;
  deleting: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [waiters, setWaiters] = useState<WaiterUser[] | null>(null);
  const [loadingWaiters, setLoadingWaiters] = useState(false);

  async function toggleWaiters() {
    if (!manager.restaurant) return;
    if (expanded) { setExpanded(false); return; }
    setExpanded(true);
    if (waiters !== null) return; // already loaded
    setLoadingWaiters(true);
    try {
      const res = await fetch(`/api/admin/restaurants/${manager.restaurant.id}/waiters`);
      if (res.ok) {
        const d = await res.json();
        setWaiters(d.staff ?? []);
      }
    } finally {
      setLoadingWaiters(false);
    }
  }

  const statusColor =
    manager.restaurant?.status === "ACTIVE" ? "text-green-400 bg-green-500/10 border-green-500/20" :
    manager.restaurant?.status === "PENDING" ? "text-amber-400 bg-amber-500/10 border-amber-500/20" :
    "text-red-400 bg-red-500/10 border-red-500/20";

  return (
    <div className="bg-gray-900 rounded-2xl border border-white/5 overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center flex-shrink-0">
          <span className="text-orange-400 font-bold text-sm">{manager.name.charAt(0).toUpperCase()}</span>
        </div>
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white text-sm">{manager.name}</span>
            <RoleBadge role={manager.role} />
          </div>
          <p className="text-xs text-gray-500 truncate">{manager.email}</p>
          {manager.restaurant && (
            <div className="flex items-center gap-2 mt-1">
              <Building2 className="w-3 h-3 text-gray-600" />
              <span className="text-xs text-gray-400">{manager.restaurant.name}</span>
              <span className={`text-xs px-1.5 py-px rounded-full border ${statusColor}`}>
                {manager.restaurant.status}
              </span>
            </div>
          )}
        </div>
        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {manager.restaurant && (
            <Link href={`/admin/restaurants/${manager.restaurant.id}`}
              className="text-xs text-violet-400 hover:text-violet-300 px-2 py-1.5 rounded-lg hover:bg-violet-500/10 transition-colors font-medium">
              Waiters →
            </Link>
          )}
          <button onClick={toggleWaiters} disabled={!manager.restaurant}
            className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-30"
            title="Show waiters">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          <button onClick={() => onDelete(manager.id, manager.name)} disabled={deleting === manager.id}
            className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50">
            {deleting === manager.id
              ? <div className="w-3.5 h-3.5 border border-red-400/40 border-t-transparent rounded-full animate-spin" />
              : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Waiter sub-rows */}
      {expanded && (
        <div className="border-t border-white/5 bg-gray-950/50">
          {loadingWaiters ? (
            <div className="px-5 py-3 text-xs text-gray-600 animate-pulse">Loading waiters…</div>
          ) : waiters && waiters.length === 0 ? (
            <div className="px-5 py-3 text-xs text-gray-600">No waiters assigned to this restaurant yet.</div>
          ) : (
            (waiters ?? []).map((w) => (
              <div key={w.id} className="flex items-center gap-3 px-5 py-2.5 border-b border-white/5 last:border-0">
                <div className="w-1 h-full self-stretch flex items-center">
                  <div className="w-px h-5 bg-white/10 mx-auto" />
                </div>
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-400 font-bold text-xs">{w.name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-300 font-medium">{w.name}</p>
                  <p className="text-xs text-gray-600 truncate">{w.email}</p>
                </div>
                <div className="flex flex-wrap gap-1 flex-shrink-0">
                  {w.assignedTables.length === 0 ? (
                    <span className="text-xs bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-lg">All tables</span>
                  ) : (
                    w.assignedTables.slice(0, 6).map((t) => (
                      <span key={t} className="inline-flex items-center gap-0.5 text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded-lg font-semibold">
                        <Hash className="w-2.5 h-2.5" />{t}
                      </span>
                    ))
                  )}
                  {w.assignedTables.length > 6 && (
                    <span className="text-xs text-gray-600">+{w.assignedTables.length - 6} more</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function AdminUsersPage() {
  const [allUsers, setAllUsers] = useState<(ManagerUser | AdminUser)[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "admins" | "managers" | "waiters">("all");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", restaurantName: "" });

  async function load() {
    const res = await fetch("/api/admin/users");
    if (res.ok) {
      setAllUsers(await res.json());
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const admins = allUsers.filter((u) => u.role === "SUPER_ADMIN") as AdminUser[];
  const managers = allUsers.filter((u) => u.role === "MANAGER" || u.role === "RESTAURANT_OWNER") as ManagerUser[];

  const filtered = (() => {
    let list = allUsers;
    if (activeTab === "admins") list = admins;
    else if (activeTab === "managers") list = managers;
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter((u) =>
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      ((u as ManagerUser).restaurant?.name ?? "").toLowerCase().includes(q)
    );
  })();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setCreating(false);
    if (res.ok) {
      toast.success(`Manager account created for ${form.name}`);
      setForm({ name: "", email: "", password: "", restaurantName: "" });
      setShowCreate(false);
      load();
    } else {
      const d = await res.json();
      toast.error(d.error || "Failed to create");
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Remove ${name}? This will also delete their restaurant and all data.`)) return;
    setDeleting(id);
    const res = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: id }),
    });
    setDeleting(null);
    if (res.ok) { toast.success("User deleted"); load(); }
    else toast.error("Failed to delete");
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">User Hierarchy</h1>
          <p className="text-gray-500 text-sm mt-1">Manage all accounts across the platform</p>
        </div>
        <button onClick={() => setShowCreate((v) => !v)}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-500 hover:bg-violet-600 text-white text-sm font-semibold rounded-xl transition-colors flex-shrink-0">
          <UserPlus className="w-4 h-4" /> New Manager
        </button>
      </div>

      {/* Hierarchy legend */}
      <div className="bg-gray-900 rounded-2xl border border-white/5 p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Role hierarchy</p>
        <div className="flex flex-wrap gap-3 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-violet-500/20 flex items-center justify-center">
              <Shield className="w-3.5 h-3.5 text-violet-400" />
            </span>
            <span><span className="text-white font-medium">Super Admin</span> — full platform access</span>
          </div>
          <span className="text-gray-700">→</span>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-orange-500/20 flex items-center justify-center">
              <ChefHat className="w-3.5 h-3.5 text-orange-400" />
            </span>
            <span><span className="text-white font-medium">Manager</span> — manages one restaurant, adds waiters</span>
          </div>
          <span className="text-gray-700">→</span>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <BellRing className="w-3.5 h-3.5 text-blue-400" />
            </span>
            <span><span className="text-white font-medium">Waiter</span> — receives table call notifications</span>
          </div>
        </div>
      </div>

      {/* Create Manager form */}
      {showCreate && (
        <div className="bg-gray-900 rounded-2xl border border-white/10 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-violet-400" /> Create Manager Account
            </h2>
            <button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Full name *</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Arben Krasniqi"
                  className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-gray-800 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-violet-500/60" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Email *</label>
                <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="manager@restaurant.com"
                  className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-gray-800 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-violet-500/60" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Password * (min 6)</label>
                <div className="relative">
                  <input required type={showPass ? "text" : "password"} value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-3 py-2.5 pr-10 rounded-xl border border-white/10 bg-gray-800 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-violet-500/60" />
                  <button type="button" onClick={() => setShowPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Restaurant name *</label>
                <input required value={form.restaurantName} onChange={(e) => setForm({ ...form, restaurantName: e.target.value })}
                  placeholder="e.g. Bella Vista"
                  className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-gray-800 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-violet-500/60" />
              </div>
            </div>
            <p className="text-xs text-gray-600">
              A restaurant will be created automatically and set to <strong className="text-gray-400">ACTIVE</strong>. The manager can customise it from their dashboard.
            </p>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={creating}
                className="flex-1 flex items-center justify-center gap-2 bg-violet-500 hover:bg-violet-600 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-60">
                {creating ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <UserPlus className="w-4 h-4" />}
                {creating ? "Creating…" : "Create Manager"}
              </button>
              <button type="button" onClick={() => setShowCreate(false)}
                className="px-4 py-2.5 rounded-xl border border-white/10 text-sm text-gray-400 hover:bg-white/5 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Stats chips */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Super Admins", count: admins.length, icon: <Shield className="w-4 h-4" />, color: "text-violet-400 bg-violet-500/10 border-violet-500/20" },
          { label: "Managers", count: managers.length, icon: <ChefHat className="w-4 h-4" />, color: "text-orange-400 bg-orange-500/10 border-orange-500/20" },
          { label: "Total Users", count: allUsers.length, icon: <Users className="w-4 h-4" />, color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl p-4 border flex items-center gap-3 ${s.color}`}>
            {s.icon}
            <div>
              <div className="text-xl font-bold">{s.count}</div>
              <div className="text-xs opacity-80">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs + search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 bg-gray-900 border border-white/5 rounded-xl p-1">
          {(["all", "admins", "managers"] as const).map((t) => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${activeTab === t ? "bg-violet-500 text-white" : "text-gray-500 hover:text-white"}`}>
              {t === "all" ? "All" : t === "admins" ? "Super Admins" : "Managers"}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email or restaurant…"
            className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-white/5 rounded-xl text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-violet-500/50" />
        </div>
      </div>

      {/* User list */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map((i) => <div key={i} className="h-20 bg-gray-900 rounded-2xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>No users found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Super Admins section */}
          {(activeTab === "all" || activeTab === "admins") && admins.filter((u) => {
            if (!search) return true;
            const q = search.toLowerCase();
            return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
          }).map((admin) => (
            <div key={admin.id} className="bg-gray-900 rounded-2xl border border-violet-500/15 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5 text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white text-sm">{admin.name}</span>
                  <RoleBadge role={admin.role} />
                </div>
                <p className="text-xs text-gray-500">{admin.email}</p>
              </div>
              <span className="text-xs text-gray-600">
                {new Date(admin.createdAt).toLocaleDateString("en", { month: "short", year: "numeric" })}
              </span>
            </div>
          ))}

          {/* Managers section */}
          {(activeTab === "all" || activeTab === "managers") && managers.filter((u) => {
            if (!search) return true;
            const q = search.toLowerCase();
            return u.name.toLowerCase().includes(q) ||
              u.email.toLowerCase().includes(q) ||
              (u.restaurant?.name ?? "").toLowerCase().includes(q);
          }).map((manager) => (
            <ManagerRow key={manager.id} manager={manager} onDelete={handleDelete} deleting={deleting} />
          ))}
        </div>
      )}
    </div>
  );
}
