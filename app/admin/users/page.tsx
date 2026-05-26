"use client";

import { useEffect, useState } from "react";
import { Users, Building2, Shield, User, Search } from "lucide-react";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  restaurant?: { name: string; slug: string; status: string } | null;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  useEffect(() => {
    fetch("/api/admin/users").then((r) => r.json()).then((d) => { setUsers(d); setLoading(false); });
  }, []);

  const filtered = users.filter((u) => {
    const ms = !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const mr = !roleFilter || u.role === roleFilter;
    return ms && mr;
  });

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Users</h1>
        <p className="text-gray-400 text-sm mt-1">{users.length} registered users</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users..."
            className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-white/10 rounded-xl text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-violet-500" />
        </div>
        <div className="flex gap-2">
          {["", "SUPER_ADMIN", "RESTAURANT_OWNER"].map((r) => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${roleFilter === r ? "bg-violet-500 text-white" : "bg-gray-800 text-gray-400 border border-white/10"}`}>
              {r === "" ? "All" : r === "SUPER_ADMIN" ? "Admins" : "Owners"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3,4].map((i) => <div key={i} className="h-16 bg-gray-800 rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="bg-gray-900 rounded-2xl border border-white/5 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">User</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3 hidden md:table-cell">Role</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3 hidden lg:table-cell">Restaurant</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3 hidden xl:table-cell">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-white/2 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                        u.role === "SUPER_ADMIN" ? "bg-violet-500/20 text-violet-400" : "bg-orange-500/20 text-orange-400"
                      }`}>
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-white text-sm">{u.name}</div>
                        <div className="text-xs text-gray-500">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 hidden md:table-cell">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border font-medium ${
                      u.role === "SUPER_ADMIN" ? "bg-violet-500/10 text-violet-400 border-violet-500/20" : "bg-orange-500/10 text-orange-400 border-orange-500/20"
                    }`}>
                      {u.role === "SUPER_ADMIN" ? <Shield className="w-3 h-3" /> : <User className="w-3 h-3" />}
                      {u.role === "SUPER_ADMIN" ? "Admin" : "Owner"}
                    </span>
                  </td>
                  <td className="px-5 py-4 hidden lg:table-cell">
                    {u.restaurant ? (
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-gray-500" />
                        <span className="text-sm text-gray-300">{u.restaurant.name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                          u.restaurant.status === "ACTIVE" ? "bg-green-500/10 text-green-400" :
                          u.restaurant.status === "PENDING" ? "bg-amber-500/10 text-amber-400" :
                          "bg-red-500/10 text-red-400"
                        }`}>{u.restaurant.status}</span>
                      </div>
                    ) : (
                      <span className="text-gray-600 text-sm">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4 hidden xl:table-cell text-xs text-gray-500">
                    {new Date(u.createdAt).toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" })}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-10 text-center text-gray-600 text-sm">No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Super Admins", count: users.filter((u) => u.role === "SUPER_ADMIN").length, icon: <Shield className="w-4 h-4" />, color: "text-violet-400 bg-violet-500/10 border-violet-500/20" },
          { label: "Restaurant Owners", count: users.filter((u) => u.role === "RESTAURANT_OWNER").length, icon: <Building2 className="w-4 h-4" />, color: "text-orange-400 bg-orange-500/10 border-orange-500/20" },
          { label: "Total Users", count: users.length, icon: <Users className="w-4 h-4" />, color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
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
    </div>
  );
}
