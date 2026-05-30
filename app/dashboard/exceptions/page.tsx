"use client";
import { useEffect, useState } from "react";
import { CalendarX, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

interface Exception { id: string; date: string; label: string; closed: boolean; openTime?: string; closeTime?: string; }

export default function ExceptionsPage() {
  const [restaurantId, setRestaurantId] = useState("");
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: "", label: "", closed: true, openTime: "", closeTime: "" });

  useEffect(() => {
    (async () => {
      const s = await fetch("/api/dashboard/stats").then(r => r.json());
      setRestaurantId(s.restaurantId);
      load(s.restaurantId);
    })();
  }, []);

  async function load(rid?: string) {
    const id = rid ?? restaurantId;
    const d = await fetch(`/api/restaurants/${id}/exceptions`).then(r => r.json());
    setExceptions(d.exceptions ?? []);
    setLoading(false);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/restaurants/${restaurantId}/exceptions`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    if (res.ok) { toast.success("Exception added"); setShowForm(false); load(); }
    else toast.error("Failed to add");
  }

  async function remove(id: string) {
    if (!confirm("Remove this exception?")) return;
    await fetch(`/api/restaurants/${restaurantId}/exceptions?id=${id}`, { method: "DELETE" });
    setExceptions(e => e.filter(x => x.id !== id));
    toast.success("Removed");
  }

  if (loading) return <div className="p-6 flex justify-center h-64 items-center"><div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" /></div>;

  const upcoming = exceptions.filter(e => e.date >= new Date().toISOString().slice(0,10)).sort((a,b) => a.date.localeCompare(b.date));
  const past = exceptions.filter(e => e.date < new Date().toISOString().slice(0,10)).sort((a,b) => b.date.localeCompare(a.date));

  return (
    <div className="p-4 lg:p-6 max-w-2xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><CalendarX className="w-6 h-6 text-orange-500" /> Holiday Hours</h1>
          <p className="text-sm text-gray-500 mt-1">Override regular hours for holidays, special events, or closures</p>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Add Exception
        </button>
      </div>

      {showForm && (
        <form onSubmit={create} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">New Exception</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Date *</label>
              <input required type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30" />
            </div>
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Label *</label>
              <input required value={form.label} onChange={e => setForm({...form, label: e.target.value})} placeholder="e.g. Christmas Day" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="closed" checked={form.closed} onChange={e => setForm({...form, closed: e.target.checked})} className="w-4 h-4 accent-orange-500" />
            <label htmlFor="closed" className="text-sm font-medium text-gray-700">Closed all day</label>
          </div>
          {!form.closed && (
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Opens at</label>
                <input type="time" value={form.openTime} onChange={e => setForm({...form, openTime: e.target.value})} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30" />
              </div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Closes at</label>
                <input type="time" value={form.closeTime} onChange={e => setForm({...form, closeTime: e.target.value})} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30" />
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button type="submit" className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl">Add Exception</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 border border-gray-200 text-sm text-gray-600 rounded-xl hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      )}

      {exceptions.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
          <CalendarX className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="font-medium text-gray-500">No exceptions set</p>
          <p className="text-sm text-gray-400 mt-1">Add holiday closures or special hours here</p>
        </div>
      ) : (
        <div className="space-y-4">
          {upcoming.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Upcoming</p>
              <div className="space-y-2">{upcoming.map(ex => (
                <div key={ex.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex flex-col items-center justify-center bg-red-50 flex-shrink-0">
                    <span className="text-[10px] font-bold text-red-500 uppercase">{new Date(ex.date+"T12:00:00").toLocaleString("en",{month:"short"})}</span>
                    <span className="text-lg font-black text-red-600">{new Date(ex.date+"T12:00:00").getDate()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{ex.label}</p>
                    <p className="text-xs text-gray-400">{ex.closed ? "Closed all day" : `${ex.openTime} – ${ex.closeTime}`}</p>
                  </div>
                  <button onClick={() => remove(ex.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}</div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Past</p>
              <div className="space-y-2 opacity-50">{past.slice(0,3).map(ex => (
                <div key={ex.id} className="bg-white rounded-2xl border border-gray-100 p-3 flex items-center gap-3">
                  <div className="flex-1"><p className="text-sm font-medium text-gray-600">{ex.label}</p><p className="text-xs text-gray-400">{ex.date} · {ex.closed ? "Closed" : `${ex.openTime}–${ex.closeTime}`}</p></div>
                  <button onClick={() => remove(ex.id)} className="p-1 rounded text-gray-300 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                </div>
              ))}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
