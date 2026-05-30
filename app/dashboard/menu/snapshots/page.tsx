"use client";
import { useEffect, useState } from "react";
import { History, Trash2, Camera } from "lucide-react";
import toast from "react-hot-toast";

interface Snapshot { id: string; label: string; createdAt: string; }

export default function SnapshotsPage() {
  const [restaurantId, setRestaurantId] = useState("");
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const s = await fetch("/api/dashboard/stats").then(r => r.json());
      setRestaurantId(s.restaurantId);
      const d = await fetch(`/api/restaurants/${s.restaurantId}/snapshots`).then(r => r.json());
      setSnapshots(d.snapshots ?? []);
      setLoading(false);
    })();
  }, []);

  async function createSnapshot() {
    setSaving(true);
    const res = await fetch(`/api/restaurants/${restaurantId}/snapshots`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: newLabel || undefined }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Snapshot saved!");
      setNewLabel("");
      const d = await fetch(`/api/restaurants/${restaurantId}/snapshots`).then(r => r.json());
      setSnapshots(d.snapshots ?? []);
    } else toast.error("Failed to save");
  }

  async function deleteSnapshot(id: string) {
    if (!confirm("Delete this snapshot?")) return;
    await fetch(`/api/restaurants/${restaurantId}/snapshots?snapshotId=${id}`, { method: "DELETE" });
    setSnapshots(s => s.filter(x => x.id !== id));
    toast.success("Deleted");
  }

  if (loading) return <div className="p-6 flex justify-center h-64 items-center"><div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="p-4 lg:p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><History className="w-6 h-6 text-orange-500" /> Menu Snapshots</h1>
        <p className="text-sm text-gray-500 mt-1">Save a copy of your menu before big changes</p>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <p className="font-semibold text-gray-900 text-sm">Save current menu</p>
        <div className="flex gap-2">
          <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Name this snapshot (optional)" className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30" />
          <button onClick={createSnapshot} disabled={saving} className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl disabled:opacity-60">
            <Camera className="w-4 h-4" /> {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      {snapshots.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
          <History className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No snapshots yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {snapshots.map((s, i) => (
            <div key={s.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500 font-bold text-sm flex-shrink-0">{i+1}</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm">{s.label}</p>
                <p className="text-xs text-gray-400">{new Date(s.createdAt).toLocaleString("en",{month:"short",day:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit"})}</p>
              </div>
              <button onClick={() => deleteSnapshot(s.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
