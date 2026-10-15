"use client";

// Loyalty stamp card: the program (on/off, stamps needed, reward), waiter accounts and who may give stamps.
// Customers find the card on the menu under More. A waiter confirms every stamp by scanning the customer's code.

import { useEffect, useState } from "react";
import { Stamp, Save, Gift, Users, UserPlus, Trash2, Loader2, Check, ShieldCheck, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";

interface Waiter { id: string; name: string; email: string }

const inputCls = "w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500";

export default function LoyaltyPage() {
  const [restaurantId, setRestaurantId] = useState("");
  const [form, setForm] = useState({ enabled: false, stamps: 10, reward: "Free item" });
  const [saved, setSaved] = useState(form);
  const [stats, setStats] = useState({ cards: 0, stampsOnCards: 0, rewardsGiven: 0 });
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [allowed, setAllowed] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyWaiter, setBusyWaiter] = useState<string | null>(null);
  const [newWaiter, setNewWaiter] = useState({ name: "", email: "", password: "", canStamp: true });
  const [showPw, setShowPw] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    (async () => {
      const s = await fetch("/api/dashboard/stats").then(r => r.json());
      setRestaurantId(s.restaurantId);
      const [l, st] = await Promise.all([
        fetch(`/api/restaurants/${s.restaurantId}/loyalty`).then(r => r.json()).catch(() => null),
        fetch(`/api/restaurants/${s.restaurantId}/staff`).then(r => r.json()).catch(() => null),
      ]);
      if (l?.program) {
        const f = { enabled: !!l.program.enabled, stamps: l.program.total ?? 10, reward: l.program.reward ?? "Free item" };
        setForm(f);
        setSaved(f);
      }
      if (l?.stats) setStats(l.stats);
      setAllowed(l?.stampWaiters ?? []);
      setWaiters((st?.staff ?? []).map((w: Waiter) => ({ id: w.id, name: w.name, email: w.email })));
      setLoading(false);
    })();
  }, []);

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  async function save() {
    if (form.stamps < 2 || form.stamps > 50) { toast.error("Stamps needed must be between 2 and 50."); return; }
    setSaving(true);
    const res = await fetch(`/api/restaurants/${restaurantId}/loyalty`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    }).catch(() => null);
    setSaving(false);
    if (res?.ok) { setSaved(form); toast.success(form.enabled ? "Saved. Customers find the card under More on your menu." : "Saved. The card is hidden from customers."); }
    else toast.error("Could not save");
  }

  async function saveAllowed(next: string[], who: string) {
    setBusyWaiter(who);
    const res = await fetch(`/api/restaurants/${restaurantId}/loyalty`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stampWaiters: next }),
    }).catch(() => null);
    setBusyWaiter(null);
    if (!res?.ok) { toast.error("Could not change it"); return false; }
    setAllowed(next);
    return true;
  }

  async function addWaiter(e: React.FormEvent) {
    e.preventDefault();
    if (adding) return;
    setAdding(true);
    const res = await fetch(`/api/restaurants/${restaurantId}/staff`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newWaiter.name, email: newWaiter.email, password: newWaiter.password }),
    }).catch(() => null);
    const d = await res?.json().catch(() => null);
    if (!res?.ok || !d?.waiter) { setAdding(false); toast.error(d?.error ?? "Could not add the waiter"); return; }
    const w: Waiter = { id: d.waiter.id, name: d.waiter.name, email: d.waiter.email };
    setWaiters((ws) => [...ws, w]);
    if (newWaiter.canStamp) await saveAllowed([...allowed, w.id], w.id);
    setAdding(false);
    setNewWaiter({ name: "", email: "", password: "", canStamp: true });
    toast.success(`${w.name} can now sign in with ${w.email}`);
  }

  async function removeWaiter(w: Waiter) {
    if (!confirm(`Delete the account of ${w.name}? They can't sign in anymore.`)) return;
    setBusyWaiter(w.id);
    const res = await fetch(`/api/restaurants/${restaurantId}/staff/${w.id}`, { method: "DELETE" }).catch(() => null);
    setBusyWaiter(null);
    if (!res?.ok) { toast.error("Could not delete the account"); return; }
    setWaiters((ws) => ws.filter((x) => x.id !== w.id));
    if (allowed.includes(w.id)) void saveAllowed(allowed.filter((x) => x !== w.id), w.id);
    toast.success("Account deleted");
  }

  if (loading) return <div className="p-6 flex justify-center h-64 items-center"><div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="p-4 lg:p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Stamp className="w-6 h-6 text-blue-500" /> Loyalty Stamp Card</h1>
        <p className="text-sm text-gray-500 mt-1">Customers collect stamps and get a reward. A waiter confirms every stamp.</p>
      </div>

      {/* How it works */}
      <ol className="grid sm:grid-cols-3 gap-3 text-sm">
        {[
          "The customer opens More > Loyalty stamp card on your menu and types their email or phone number.",
          "They tap Add a stamp and call the waiter. A code and QR code show on their phone.",
          "The waiter scans the QR code (or types the code on the waiter page) and confirms. Done.",
        ].map((t, i) => (
          <li key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3.5 flex gap-2.5">
            <span className="w-6 h-6 shrink-0 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">{i + 1}</span>
            <span className="text-gray-600 text-xs leading-relaxed">{t}</span>
          </li>
        ))}
      </ol>

      {saved.enabled && (
        <div className="grid grid-cols-3 gap-3">
          {[{ label: "Cards", value: stats.cards, icon: Users }, { label: "Stamps on cards", value: stats.stampsOnCards, icon: Stamp }, { label: "Rewards given", value: stats.rewardsGiven, icon: Gift }].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
              <Icon className="w-5 h-5 text-blue-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-400">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Program */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-gray-900">Loyalty stamp card</p>
            <p className="text-xs text-gray-500 mt-0.5">{form.enabled ? "On. Customers find it under More on your menu." : "Off. Customers don't see it."}</p>
          </div>
          <button type="button" role="switch" aria-checked={form.enabled} aria-label="Loyalty stamp card on or off" id="loyalty-switch"
            onClick={() => setForm(f => ({ ...f, enabled: !f.enabled }))}
            className={`relative w-14 h-8 shrink-0 rounded-full transition-colors ${form.enabled ? "bg-blue-600" : "bg-gray-300"}`}>
            <span className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${form.enabled ? "translate-x-6" : ""}`} />
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="loyalty-stamps" className="block text-xs font-medium text-gray-700 mb-1">Stamps needed for the reward</label>
            <input id="loyalty-stamps" type="number" min={2} max={50} value={form.stamps} onChange={e => setForm(f => ({ ...f, stamps: Number(e.target.value) }))} className={inputCls} />
          </div>
          <div>
            <label htmlFor="loyalty-reward" className="block text-xs font-medium text-gray-700 mb-1">Reward</label>
            <input id="loyalty-reward" value={form.reward} maxLength={80} onChange={e => setForm(f => ({ ...f, reward: e.target.value }))} placeholder="e.g. Free dessert" className={inputCls} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          {dirty && <span className="text-xs font-medium text-amber-700">Not saved yet</span>}
          <button onClick={save} disabled={saving || !dirty} className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-xl disabled:opacity-40">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
          </button>
        </div>
      </section>

      {/* Waiters */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-900 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-blue-500" /> Who can give stamps</h2>
          <p className="text-xs text-gray-500 mt-1">You (the manager) always can. Waiters sign in at the login page with the email and password you set here.</p>
        </div>

        {waiters.length === 0 ? (
          <p className="text-sm text-gray-400">No waiter accounts yet. Add one below.</p>
        ) : (
          <ul className="divide-y divide-gray-100 border border-gray-100 rounded-xl">
            {waiters.map((w) => {
              const can = allowed.includes(w.id);
              return (
                <li key={w.id} className="flex items-center gap-3 px-3 py-2.5 flex-wrap">
                  <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 text-sm font-bold flex items-center justify-center shrink-0">{w.name.slice(0, 1).toUpperCase()}</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-gray-900 truncate">{w.name}</div>
                    <div className="text-xs text-gray-500 truncate">{w.email}</div>
                  </div>
                  <label className={`inline-flex items-center gap-2 text-xs font-semibold rounded-lg border px-2.5 py-1.5 ${can ? "border-blue-200 bg-blue-50 text-blue-800" : "border-gray-200 text-gray-600"}`}>
                    {busyWaiter === w.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (
                      <input type="checkbox" id={`stamp-${w.id}`} checked={can} className="w-3.5 h-3.5 accent-blue-600"
                        onChange={(e) => void saveAllowed(e.target.checked ? [...allowed, w.id] : allowed.filter((x) => x !== w.id), w.id)} />
                    )}
                    Can give stamps
                  </label>
                  <button type="button" onClick={() => removeWaiter(w)} aria-label={`Delete ${w.name}`} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <form onSubmit={addWaiter} className="rounded-xl bg-gray-50 border border-gray-100 p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-900 flex items-center gap-2"><UserPlus className="w-4 h-4 text-blue-500" /> Add a waiter account</p>
          <div className="grid sm:grid-cols-3 gap-2">
            <input id="waiter-name" required value={newWaiter.name} onChange={(e) => setNewWaiter({ ...newWaiter, name: e.target.value })} placeholder="Name" className={inputCls} />
            <input id="waiter-email" required type="email" value={newWaiter.email} onChange={(e) => setNewWaiter({ ...newWaiter, email: e.target.value })} placeholder="Email" className={inputCls} />
            <div className="relative">
              <input id="waiter-password" required minLength={6} type={showPw ? "text" : "password"} value={newWaiter.password}
                onChange={(e) => setNewWaiter({ ...newWaiter, password: e.target.value })} placeholder="Password (6+)" className={`${inputCls} pr-9`} />
              <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" id="waiter-can-stamp" checked={newWaiter.canStamp} onChange={(e) => setNewWaiter({ ...newWaiter, canStamp: e.target.checked })} className="w-4 h-4 accent-blue-600" />
              Can give stamps
            </label>
            <button type="submit" disabled={adding} className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-black text-white text-sm font-semibold rounded-xl disabled:opacity-50">
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Add waiter
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
