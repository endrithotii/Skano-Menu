"use client";
import { useEffect, useState } from "react";
import { Pin, Plus, Trash2, Megaphone, AlertTriangle, Info } from "lucide-react";
import toast from "react-hot-toast";

interface Note { id: string; text: string; type: "info" | "alert" | "announcement"; createdAt: string; }

const STORAGE_KEY = "skano_bulletin_";

export default function BulletinPage() {
  const [restaurantId, setRestaurantId] = useState("");
  const [notes, setNotes] = useState<Note[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ text: "", type: "info" as Note["type"] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const s = await fetch("/api/dashboard/stats").then(r => r.json());
      setRestaurantId(s.restaurantId);
      // Store in localStorage (simple persistence without new API)
      try {
        const saved = localStorage.getItem(STORAGE_KEY + s.restaurantId);
        if (saved) setNotes(JSON.parse(saved));
      } catch { /**/ }
      setLoading(false);
    })();
  }, []);

  function save(updated: Note[]) {
    setNotes(updated);
    try { localStorage.setItem(STORAGE_KEY + restaurantId, JSON.stringify(updated)); } catch { /**/ }
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.text.trim()) return;
    const note: Note = { id: Date.now().toString(), text: form.text.trim(), type: form.type, createdAt: new Date().toISOString() };
    save([note, ...notes]);
    setForm({ text: "", type: "info" });
    setShowForm(false);
    toast.success("Note posted!");
  }

  function remove(id: string) {
    save(notes.filter(n => n.id !== id));
  }

  const ICONS = { info: <Info className="w-4 h-4 text-blue-500" />, alert: <AlertTriangle className="w-4 h-4 text-red-500" />, announcement: <Megaphone className="w-4 h-4 text-orange-500" /> };
  const BG = { info: "bg-blue-50 border-blue-100", alert: "bg-red-50 border-red-100", announcement: "bg-orange-50 border-orange-100" };

  if (loading) return <div className="p-6 flex justify-center h-64 items-center"><div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="p-4 lg:p-6 max-w-2xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Pin className="w-6 h-6 text-orange-500" /> Staff Bulletin Board</h1>
          <p className="text-sm text-gray-500 mt-1">Post daily briefings, alerts, and announcements for your team</p>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Post Note
        </button>
      </div>

      {showForm && (
        <form onSubmit={add} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex gap-2">
            {(["info","alert","announcement"] as const).map(t => (
              <button key={t} type="button" onClick={() => setForm(f => ({...f, type: t}))}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border-2 text-xs font-semibold transition-all ${form.type === t ? "border-orange-500 bg-orange-50 text-orange-600" : "border-gray-100 text-gray-500 hover:border-gray-200"}`}>
                {ICONS[t]} {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <textarea value={form.text} onChange={e => setForm(f => ({...f, text: e.target.value}))} rows={3}
            placeholder={form.type === "alert" ? "⚠️ Important: e.g. Kitchen equipment issue…" : form.type === "announcement" ? "📢 e.g. New happy hour starts today…" : "ℹ️ e.g. Today's special is the truffle pasta…"}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 resize-none" />
          <div className="flex gap-2">
            <button type="submit" className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl">Post</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 border border-gray-200 text-sm text-gray-600 rounded-xl hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      )}

      {notes.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
          <Pin className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">Board is empty</p>
          <p className="text-sm text-gray-400 mt-1">Post daily briefings, urgent alerts, or team announcements</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map(n => (
            <div key={n.id} className={`rounded-2xl border p-4 ${BG[n.type]}`}>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0">{ICONS[n.type]}</div>
                <div className="flex-1">
                  <p className="text-sm text-gray-800 leading-relaxed">{n.text}</p>
                  <p className="text-[10px] text-gray-400 mt-1.5">{new Date(n.createdAt).toLocaleString("en",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}</p>
                </div>
                <button onClick={() => remove(n.id)} className="p-1 rounded-lg text-gray-400 hover:text-red-500 flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
