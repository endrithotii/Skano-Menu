"use client";

// Loyalty stamp card: the program (on/off, stamps needed, reward), waiter accounts and who may give stamps.
// Customers find the card on the menu under More. A waiter confirms every stamp by scanning the customer's code.

import { useEffect, useState } from "react";
import { Stamp, Save, Gift, Users, Loader2, ShieldCheck } from "lucide-react";
import { ReceiptQueue } from "@/components/loyalty-receipts";
import toast from "react-hot-toast";
import Link from "next/link";

const inputCls = "w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500";

export default function LoyaltyPage() {
  const [restaurantId, setRestaurantId] = useState("");
  const [form, setForm] = useState({ enabled: false, stamps: 10, reward: "Free item", receiptPhotos: false });
  const [saved, setSaved] = useState(form);
  const [stats, setStats] = useState({ cards: 0, stampsOnCards: 0, rewardsGiven: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const s = await fetch("/api/dashboard/stats").then(r => r.json());
      setRestaurantId(s.restaurantId);
      const l = await fetch(`/api/restaurants/${s.restaurantId}/loyalty`).then(r => r.json()).catch(() => null);
      if (l?.program) {
        const f = { enabled: !!l.program.enabled, stamps: l.program.total ?? 10, reward: l.program.reward ?? "Free item", receiptPhotos: !!l.receiptPhotos };
        setForm(f);
        setSaved(f);
      }
      if (l?.stats) setStats(l.stats);
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




  if (loading) return <div className="p-6 flex justify-center h-64 items-center"><div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Stamp className="w-6 h-6 text-blue-500" /> Loyalty Stamp Card</h1>
        <p className="text-sm text-gray-500 mt-1">Customers collect stamps and get a reward. A staff member confirms every stamp.</p>
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

        <label className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/60 p-3">
          <input type="checkbox" id="loyalty-receipts" checked={form.receiptPhotos} onChange={(e) => setForm((f) => ({ ...f, receiptPhotos: e.target.checked }))} className="w-4 h-4 mt-0.5" />
          <span>
            <span className="block text-sm font-semibold text-gray-900">Customers can send a photo of their receipt</span>
            <span className="block text-xs text-gray-500 mt-0.5">Optional. No waiter around? The customer sends a photo of the receipt from the card, and you or a waiter give the stamp later on this page or on the waiter page. One photo at a time per customer, at most 5 a day.</span>
          </span>
        </label>

        <div className="flex items-center justify-end gap-3">
          {dirty && <span className="text-xs font-medium text-amber-700">Not saved yet</span>}
          <button data-tour="loyalty-save" onClick={save} disabled={saving || !dirty} className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-xl disabled:opacity-40">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
          </button>
        </div>
      </section>

      {restaurantId && <ReceiptQueue restaurantId={restaurantId} />}

      {/* Who can give stamps: Staff & roles */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-start gap-3 flex-wrap">
        <ShieldCheck className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-[14rem]">
          <h2 className="font-semibold text-gray-900">Who can give stamps</h2>
          <p className="text-xs text-gray-500 mt-1">You always can. Staff can when they have &quot;Confirm loyalty stamps&quot; (the Waiter role has it). Add staff and choose their access on Staff &amp; roles.</p>
        </div>
        <Link href="/dashboard/staff" className="text-sm font-semibold text-blue-600 hover:text-blue-700">Open Staff &amp; roles</Link>
      </section>
    </div>
  );
}
