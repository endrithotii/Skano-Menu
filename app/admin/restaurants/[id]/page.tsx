"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, UserPlus, Trash2, Edit2, Check, X,
  Eye, EyeOff, Users, Hash, ChefHat, BellRing,
} from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";

interface Waiter {
  id: string;
  name: string;
  email: string;
  assignedTables: string[];
  createdAt: string;
}

interface RestaurantInfo {
  id: string;
  name: string;
}

// ── Table chip input ───────────────────────────────────────────────────────
function TableChipInput({
  value,
  onChange,
  placeholder = "e.g. 1, 2, 3  (empty = all tables)",
}: {
  value: string[];
  onChange: (tables: string[]) => void;
  placeholder?: string;
}) {
  const [inputVal, setInputVal] = useState("");

  function add(raw: string) {
    const parts = raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    const next = Array.from(new Set([...value, ...parts]));
    onChange(next);
    setInputVal("");
  }

  function remove(t: string) {
    onChange(value.filter((v) => v !== t));
  }

  return (
    <div className="border border-white/10 rounded-xl bg-gray-800 px-3 py-2 min-h-[42px] flex flex-wrap gap-1.5 items-center focus-within:border-violet-500/60">
      {value.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 bg-violet-500/20 text-violet-300 border border-violet-500/30 text-xs font-semibold px-2 py-0.5 rounded-lg">
          <Hash className="w-2.5 h-2.5" />{t}
          <button type="button" onClick={() => remove(t)} className="ml-0.5 hover:text-white">
            <X className="w-2.5 h-2.5" />
          </button>
        </span>
      ))}
      <input
        value={inputVal}
        onChange={(e) => setInputVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "," || e.key === " ") {
            e.preventDefault();
            add(inputVal);
          }
          if (e.key === "Backspace" && !inputVal && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => { if (inputVal.trim()) add(inputVal); }}
        placeholder={value.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[120px] bg-transparent text-sm text-white placeholder:text-gray-500 outline-none"
      />
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function AdminRestaurantWaitersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: restaurantId } = use(params);
  const router = useRouter();

  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null);
  const [staff, setStaff] = useState<Waiter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Create form state
  const [form, setForm] = useState({ name: "", email: "", password: "", tables: [] as string[] });
  const [showPass, setShowPass] = useState(false);

  // Edit state
  const [editName, setEditName] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editTables, setEditTables] = useState<string[]>([]);
  const [showEditPass, setShowEditPass] = useState(false);

  async function load() {
    const res = await fetch(`/api/admin/restaurants/${restaurantId}/waiters`);
    if (!res.ok) { router.push("/admin/restaurants"); return; }
    const data = await res.json();
    setRestaurant(data.restaurant);
    setStaff(data.staff ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/admin/restaurants/${restaurantId}/waiters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        email: form.email,
        password: form.password,
        assignedTables: form.tables,
      }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Waiter account created");
      setForm({ name: "", email: "", password: "", tables: [] });
      setShowForm(false);
      load();
    } else {
      const d = await res.json();
      toast.error(d.error || "Failed to create");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this waiter account? This also removes their push subscriptions.")) return;
    setDeletingId(id);
    const res = await fetch(`/api/admin/restaurants/${restaurantId}/waiters/${id}`, { method: "DELETE" });
    setDeletingId(null);
    if (res.ok) { toast.success("Waiter removed"); load(); }
    else toast.error("Failed to remove");
  }

  async function handleEdit(id: string) {
    if (!editName.trim() && !editPassword.trim() && editTables === staff.find((w) => w.id === id)?.assignedTables) {
      setEditingId(null); return;
    }
    const body: Record<string, unknown> = { assignedTables: editTables };
    if (editName.trim()) body.name = editName.trim();
    if (editPassword.trim()) body.password = editPassword.trim();
    const res = await fetch(`/api/admin/restaurants/${restaurantId}/waiters/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) { toast.success("Updated"); load(); }
    else toast.error("Failed to update");
    setEditingId(null); setEditName(""); setEditPassword(""); setEditTables([]);
  }

  if (loading) return (
    <div className="p-6 flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-4 lg:p-6 max-w-3xl space-y-6">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/restaurants"
          className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-violet-400 flex-shrink-0" />
            <h1 className="text-xl font-bold text-white truncate">{restaurant?.name}</h1>
          </div>
          <p className="text-gray-500 text-sm mt-0.5">Waiter accounts & table assignments</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-500 hover:bg-violet-600 text-white text-sm font-semibold rounded-xl transition-colors flex-shrink-0"
        >
          <UserPlus className="w-4 h-4" /> Add waiter
        </button>
      </div>

      {/* How table assignment works */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 flex gap-3">
        <BellRing className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-200/80">
          <p className="font-semibold text-blue-200 mb-0.5">How table assignments work</p>
          <p className="leading-relaxed">
            Assign specific table numbers to each waiter — they&apos;ll only receive push notifications for those tables.
            Leave tables <strong className="text-blue-200">empty</strong> to make the waiter a catch-all who gets alerts for <strong className="text-blue-200">every</strong> table.
          </p>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-gray-900 rounded-2xl border border-white/10 p-5">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-violet-400" /> New waiter account
          </h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Full name *</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Marco Rossi"
                  className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-gray-800 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-violet-500/60" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Email *</label>
                <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="waiter@restaurant.com"
                  className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-gray-800 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-violet-500/60" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Password * (min 6 chars)</label>
              <div className="relative">
                <input required type={showPass ? "text" : "password"} value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Choose a memorable password"
                  className="w-full px-3 py-2.5 pr-10 rounded-xl border border-white/10 bg-gray-800 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-violet-500/60" />
                <button type="button" onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Assigned tables <span className="text-gray-600">(empty = all tables)</span>
              </label>
              <TableChipInput value={form.tables} onChange={(t) => setForm({ ...form, tables: t })} />
              <p className="text-xs text-gray-600 mt-1">Type a table number and press Enter or Space. Press Backspace to remove.</p>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 bg-violet-500 hover:bg-violet-600 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-60">
                {saving ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <UserPlus className="w-4 h-4" />}
                {saving ? "Creating…" : "Create account"}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2.5 rounded-xl border border-white/10 text-sm text-gray-400 hover:bg-white/5 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Staff list */}
      {staff.length === 0 ? (
        <div className="bg-gray-900 rounded-2xl border-2 border-dashed border-white/10 p-12 text-center">
          <Users className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="font-medium text-gray-500">No waiters yet</p>
          <p className="text-sm text-gray-600 mt-1">Click &quot;Add waiter&quot; to create the first account</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {staff.length} waiter{staff.length !== 1 ? "s" : ""}
          </p>
          {staff.map((waiter) => (
            <div key={waiter.id} className="bg-gray-900 rounded-2xl border border-white/5 p-4">
              {editingId === waiter.id ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">Name</label>
                      <input value={editName} onChange={(e) => setEditName(e.target.value)}
                        placeholder={waiter.name}
                        className="w-full px-3 py-2 rounded-xl border border-white/10 bg-gray-800 text-sm text-white focus:outline-none focus:border-violet-500/60" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">New password (optional)</label>
                      <div className="relative">
                        <input type={showEditPass ? "text" : "password"} value={editPassword}
                          onChange={(e) => setEditPassword(e.target.value)}
                          placeholder="Leave blank to keep"
                          className="w-full px-3 py-2 pr-8 rounded-xl border border-white/10 bg-gray-800 text-sm text-white focus:outline-none focus:border-violet-500/60" />
                        <button type="button" onClick={() => setShowEditPass((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500">
                          {showEditPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">
                      Assigned tables <span className="text-gray-600">(empty = all tables)</span>
                    </label>
                    <TableChipInput value={editTables} onChange={setEditTables} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(waiter.id)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-violet-500 text-white text-xs font-semibold rounded-xl hover:bg-violet-600 transition-colors">
                      <Check className="w-3.5 h-3.5" /> Save
                    </button>
                    <button onClick={() => { setEditingId(null); setEditName(""); setEditPassword(""); setEditTables([]); }}
                      className="flex items-center gap-1.5 px-3 py-2 border border-white/10 text-gray-400 text-xs font-semibold rounded-xl hover:bg-white/5 transition-colors">
                      <X className="w-3.5 h-3.5" /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-violet-400 font-bold text-sm">{waiter.name.charAt(0).toUpperCase()}</span>
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-sm">{waiter.name}</p>
                    <p className="text-xs text-gray-500 truncate">{waiter.email}</p>
                    {/* Table chips */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {waiter.assignedTables.length === 0 ? (
                        <span className="inline-flex items-center gap-1 bg-green-500/15 text-green-400 border border-green-500/25 text-xs font-medium px-2 py-0.5 rounded-lg">
                          All tables
                        </span>
                      ) : (
                        waiter.assignedTables.map((t) => (
                          <span key={t} className="inline-flex items-center gap-0.5 bg-violet-500/15 text-violet-300 border border-violet-500/25 text-xs font-semibold px-2 py-0.5 rounded-lg">
                            <Hash className="w-2.5 h-2.5" />{t}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <a href="/waiter" target="_blank" rel="noopener noreferrer"
                      className="text-xs text-violet-400 font-semibold hover:text-violet-300 px-2 py-1.5 rounded-lg hover:bg-violet-500/10 transition-colors">
                      Preview ↗
                    </a>
                    <button
                      onClick={() => {
                        setEditingId(waiter.id);
                        setEditName(waiter.name);
                        setEditPassword("");
                        setEditTables([...waiter.assignedTables]);
                      }}
                      className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(waiter.id)} disabled={deletingId === waiter.id}
                      className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50">
                      {deletingId === waiter.id
                        ? <div className="w-3.5 h-3.5 border border-red-400/50 border-t-transparent rounded-full animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Login hints */}
      {staff.length > 0 && (
        <div className="bg-gray-900/50 rounded-2xl border border-white/5 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Waiter login details</p>
          <div className="space-y-2">
            {staff.map((w) => (
              <div key={w.id} className="flex items-center gap-3 text-xs">
                <span className="text-white font-medium w-32 truncate">{w.name}</span>
                <span className="text-gray-400 truncate flex-1">{w.email}</span>
                <span className="text-gray-600">→</span>
                <a href="/waiter" target="_blank" className="text-violet-400 hover:text-violet-300">skano-menu.vercel.app/waiter</a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
