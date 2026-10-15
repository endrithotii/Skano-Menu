"use client";

// Ingredients & details (manager): the workspace, plus chef accounts (chefs fill in the details at /kitchen)

import { useEffect, useState } from "react";
import { ChefHat, UserPlus, Trash2, Loader2, Check, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";
import { IngredientsWorkspace } from "@/components/ingredients/ingredients-workspace";

interface Chef { id: string; name: string; email: string }
const inputCls = "w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500";

export default function IngredientsPage() {
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [chefs, setChefs] = useState<Chef[]>([]);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    (async () => {
      const s = await fetch("/api/dashboard/stats").then((r) => r.json());
      setRestaurantId(s.restaurantId);
      const d = await fetch(`/api/restaurants/${s.restaurantId}/staff?role=CHEF`).then((r) => r.json()).catch(() => null);
      setChefs((d?.staff ?? []).map((c: Chef) => ({ id: c.id, name: c.name, email: c.email })));
    })();
  }, []);

  async function addChef(e: React.FormEvent) {
    e.preventDefault();
    if (!restaurantId || adding) return;
    setAdding(true);
    const res = await fetch(`/api/restaurants/${restaurantId}/staff`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, role: "CHEF" }),
    }).catch(() => null);
    const d = await res?.json().catch(() => null);
    setAdding(false);
    if (!res?.ok || !d?.waiter) { toast.error(d?.error ?? "Could not add the chef"); return; }
    setChefs((c) => [...c, { id: d.waiter.id, name: d.waiter.name, email: d.waiter.email }]);
    setForm({ name: "", email: "", password: "" });
    toast.success(`${d.waiter.name} can now sign in with ${d.waiter.email}`);
  }

  async function removeChef(c: Chef) {
    if (!restaurantId || !confirm(`Delete the account of ${c.name}?`)) return;
    const res = await fetch(`/api/restaurants/${restaurantId}/staff/${c.id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) { toast.error("Could not delete the account"); return; }
    setChefs((list) => list.filter((x) => x.id !== c.id));
    toast.success("Account deleted");
  }

  if (!restaurantId) return <div className="p-6 flex justify-center h-64 items-center"><div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="p-4 lg:p-6 max-w-[1600px] space-y-6 pb-28">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><ChefHat className="w-6 h-6 text-blue-500" /> Ingredients &amp; details</h1>
        <p className="text-sm text-gray-500 mt-1">For every dish on your menus: what it is made of, as precisely as you like</p>
      </div>

      <IngredientsWorkspace restaurantId={restaurantId} />

      <section className="max-w-3xl bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-900 flex items-center gap-2"><ChefHat className="w-4 h-4 text-blue-500" /> Chef accounts</h2>
          <p className="text-xs text-gray-500 mt-1">Chefs sign in at the login page and only see this page, so they can fill in the ingredients.</p>
        </div>
        {chefs.length > 0 && (
          <ul className="divide-y divide-gray-100 border border-gray-100 rounded-xl">
            {chefs.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="w-8 h-8 rounded-full bg-orange-50 text-orange-600 text-sm font-bold flex items-center justify-center shrink-0">{c.name.slice(0, 1).toUpperCase()}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-gray-900 truncate">{c.name}</div>
                  <div className="text-xs text-gray-500 truncate">{c.email}</div>
                </div>
                <button type="button" onClick={() => removeChef(c)} aria-label={`Delete ${c.name}`} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={addChef} className="rounded-xl bg-gray-50 border border-gray-100 p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-900 flex items-center gap-2"><UserPlus className="w-4 h-4 text-blue-500" /> Add a chef account</p>
          <div className="grid sm:grid-cols-3 gap-2">
            <input id="chef-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" className={inputCls} />
            <input id="chef-email" required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className={inputCls} />
            <div className="relative">
              <input id="chef-password" required minLength={6} type={showPw ? "text" : "password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Password (6+)" className={`${inputCls} pr-9`} />
              <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={adding} className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-black text-white text-sm font-semibold rounded-xl disabled:opacity-50">
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Add chef
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
