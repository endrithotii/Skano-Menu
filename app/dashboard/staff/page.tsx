"use client";

import { useEffect, useRef, useState } from "react";
import { UserPlus, Trash2, Users, Eye, EyeOff, Edit2, Check, X, Smartphone, Hash } from "lucide-react";
import toast from "react-hot-toast";

interface Waiter {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  assignedTables: string[];
}

// ─── Table chip input ──────────────────────────────────────────────────────────
function TableChipInput({
  value,
  onChange,
  placeholder = "e.g. 1, 2, 3",
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function commit(raw: string) {
    const trimmed = raw.trim().replace(/^#/, "");
    if (!trimmed) return;
    if (!value.includes(trimmed)) onChange([...value, trimmed]);
    setInput("");
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "," || e.key === " ") {
      e.preventDefault();
      commit(input);
    }
    if (e.key === "Backspace" && input === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div
      className="min-h-[42px] flex flex-wrap gap-1.5 items-center px-3 py-2 rounded-xl border border-gray-200 cursor-text focus-within:ring-2 focus-within:ring-orange-500/30 focus-within:border-orange-500 bg-white"
      onClick={() => inputRef.current?.focus()}
    >
      {value.length === 0 && input === "" && (
        <span className="text-sm text-gray-400 pointer-events-none select-none">{placeholder}</span>
      )}
      {value.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-orange-100 text-orange-700 text-xs font-semibold"
        >
          <Hash className="w-2.5 h-2.5" />{t}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(value.filter((x) => x !== t)); }}
            className="hover:text-orange-900 ml-0.5"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKey}
        onBlur={() => commit(input)}
        className="flex-1 min-w-[60px] outline-none text-sm bg-transparent"
        style={{ width: input.length > 0 ? `${input.length + 2}ch` : "60px" }}
      />
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function StaffPage() {
  const [restaurantId, setRestaurantId] = useState("");
  const [staff, setStaff] = useState<Waiter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editTables, setEditTables] = useState<string[]>([]);
  const [showPass, setShowPass] = useState(false);
  const [showFormPass, setShowFormPass] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", password: "", assignedTables: [] as string[],
  });

  async function load(rid?: string) {
    const id = rid ?? restaurantId;
    if (!id) return;
    const res = await fetch(`/api/restaurants/${id}/staff`);
    if (res.ok) setStaff((await res.json()).staff ?? []);
  }

  useEffect(() => {
    async function init() {
      const statsRes = await fetch("/api/dashboard/stats");
      const stats = await statsRes.json();
      setRestaurantId(stats.restaurantId);
      await load(stats.restaurantId);
      setLoading(false);
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!restaurantId) return;
    setSaving(true);
    const res = await fetch(`/api/restaurants/${restaurantId}/staff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Waiter account created");
      setForm({ name: "", email: "", password: "", assignedTables: [] });
      setShowForm(false);
      load();
    } else {
      const d = await res.json();
      toast.error(d.error || "Failed to create");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this waiter account?")) return;
    setDeletingId(id);
    const res = await fetch(`/api/restaurants/${restaurantId}/staff/${id}`, { method: "DELETE" });
    setDeletingId(null);
    if (res.ok) { toast.success("Waiter removed"); load(); }
    else toast.error("Failed to remove");
  }

  function startEdit(waiter: Waiter) {
    setEditingId(waiter.id);
    setEditName(waiter.name);
    setEditPassword("");
    setEditTables(waiter.assignedTables);
  }

  async function handleEdit(id: string) {
    const body: Record<string, unknown> = {};
    if (editName.trim()) body.name = editName.trim();
    if (editPassword.trim()) body.password = editPassword.trim();
    body.assignedTables = editTables;

    const res = await fetch(`/api/restaurants/${restaurantId}/staff/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) { toast.success("Waiter updated"); load(); }
    else toast.error("Failed to update");
    setEditingId(null); setEditName(""); setEditPassword(""); setEditTables([]);
  }

  if (loading) return (
    <div className="p-6 flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="p-4 lg:p-6 max-w-2xl space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Waiter Staff</h1>
          <p className="text-sm text-gray-500 mt-1">
            Create logins for your waiters and assign them specific tables
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm shadow-orange-200 flex-shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          Add waiter
        </button>
      </div>

      {/* How it works */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-3">
        <Smartphone className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700">
          <p className="font-semibold mb-1">How it works</p>
          <ul className="space-y-0.5 opacity-80 text-xs leading-relaxed">
            <li>• Give each waiter their email + password to log in at <strong>skano-menu.vercel.app/waiter</strong> on their phone</li>
            <li>• Assign specific tables so they only get notified for their own tables</li>
            <li>• Leave tables empty → waiter gets notified for <strong>all</strong> table calls</li>
          </ul>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-orange-500" /> New waiter account
          </h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Full name *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Arben Krasniqi"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email *</label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="waiter@yourrestaurant.com"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Password * (min 6 characters)</label>
              <div className="relative">
                <input
                  required
                  type={showFormPass ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Choose a simple password they'll remember"
                  className="w-full px-3 py-2.5 pr-10 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                />
                <button type="button" onClick={() => setShowFormPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showFormPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Assigned tables
                <span className="ml-1 text-gray-400 font-normal">(optional — leave empty for all tables)</span>
              </label>
              <TableChipInput
                value={form.assignedTables}
                onChange={(v) => setForm({ ...form, assignedTables: v })}
                placeholder="Type a table number and press Enter or comma…"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Press Enter, comma, or Space after each table number
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-60"
              >
                {saving ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <UserPlus className="w-4 h-4" />}
                {saving ? "Creating…" : "Create account"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Staff list */}
      {staff.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
          <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="font-medium text-gray-500">No waiters yet</p>
          <p className="text-sm text-gray-400 mt-1">Click "Add waiter" to create the first account</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {staff.length} waiter{staff.length !== 1 ? "s" : ""}
          </p>
          {staff.map((waiter) => (
            <div key={waiter.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              {editingId === waiter.id ? (
                /* ── Edit mode ── */
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Name</label>
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder={waiter.name}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">New password (optional)</label>
                      <div className="relative">
                        <input
                          type={showPass ? "text" : "password"}
                          value={editPassword}
                          onChange={(e) => setEditPassword(e.target.value)}
                          placeholder="Leave blank to keep"
                          className="w-full px-3 py-2 pr-8 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                        />
                        <button type="button" onClick={() => setShowPass((v) => !v)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                          {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">
                      Assigned tables
                      <span className="ml-1 text-gray-400 font-normal">(empty = all tables)</span>
                    </label>
                    <TableChipInput value={editTables} onChange={setEditTables} />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(waiter.id)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-orange-500 text-white text-xs font-semibold rounded-xl hover:bg-orange-600 transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" /> Save changes
                    </button>
                    <button
                      onClick={() => { setEditingId(null); setEditName(""); setEditPassword(""); setEditTables([]); }}
                      className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 text-xs font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* ── View mode ── */
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-orange-600 font-bold text-sm">{waiter.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 text-sm">{waiter.name}</p>
                      {waiter.assignedTables.length === 0 ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">
                          All tables
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {waiter.assignedTables.map((t) => (
                            <span key={t} className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-md bg-orange-100 text-orange-700 font-semibold">
                              <Hash className="w-2.5 h-2.5" />{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{waiter.email}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => startEdit(waiter)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(waiter.id)}
                      disabled={deletingId === waiter.id}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                      title="Remove"
                    >
                      {deletingId === waiter.id
                        ? <div className="w-3.5 h-3.5 border border-red-400 border-t-transparent rounded-full animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
