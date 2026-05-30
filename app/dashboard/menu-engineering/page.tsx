"use client";
import { useEffect, useState } from "react";
import { Star, TrendingUp, BookOpen, Puzzle } from "lucide-react";

interface MatrixItem { id: string; name: string; price: number; costPrice: number | null; viewCount: number; feedbackCount: number; margin: number; popularity: number; quadrant: "star" | "plowHorse" | "puzzle" | "dog"; }

const QUADRANT_META = {
  star:      { label: "⭐ Stars",       desc: "High popularity + High margin — your best items",      bg: "bg-green-50",  border: "border-green-200", text: "text-green-800",  icon: Star },
  plowHorse: { label: "🐴 Plow Horses", desc: "High popularity + Low margin — popular but costly",   bg: "bg-blue-50",   border: "border-blue-200",  text: "text-blue-800",   icon: TrendingUp },
  puzzle:    { label: "❓ Puzzles",     desc: "Low popularity + High margin — promote these more",    bg: "bg-amber-50",  border: "border-amber-200", text: "text-amber-800",  icon: Puzzle },
  dog:       { label: "🐶 Dogs",        desc: "Low popularity + Low margin — consider removing",     bg: "bg-red-50",    border: "border-red-200",   text: "text-red-800",    icon: BookOpen },
};

export default function MenuEngineeringPage() {
  const [items, setItems] = useState<MatrixItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const s = await fetch("/api/dashboard/stats").then(r => r.json());
      const d = await fetch(`/api/restaurants/${s.restaurantId}/analytics-advanced`).then(r => r.json());
      const all = d.itemViewStats ?? [];

      // Calculate metrics
      const avgViews = all.length > 0 ? all.reduce((s: number, i: any) => s + Number(i.viewCount), 0) / all.length : 0;

      const enriched: MatrixItem[] = all.map((item: any) => {
        const cp = item.costPrice ? Number(item.costPrice) : null;
        const margin = cp != null && item.price > 0 ? ((item.price - cp) / item.price) * 100 : 50; // default 50% if no cost
        const popularity = Number(item.viewCount);
        const highPop = popularity >= avgViews;
        const highMargin = margin >= 50;
        let quadrant: MatrixItem["quadrant"] = "dog";
        if (highPop && highMargin) quadrant = "star";
        else if (highPop && !highMargin) quadrant = "plowHorse";
        else if (!highPop && highMargin) quadrant = "puzzle";
        return { id: item.id, name: item.name, price: Number(item.price), costPrice: cp, viewCount: popularity, feedbackCount: Number(item.feedbackCount ?? 0), margin, popularity, quadrant };
      });

      setItems(enriched);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="p-6 flex justify-center h-64 items-center"><div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" /></div>;

  const quadrants = ["star","plowHorse","puzzle","dog"] as const;

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Menu Engineering Matrix</h1>
        <p className="text-sm text-gray-500 mt-1">Boston Consulting Group matrix for your menu items — popularity vs. profit margin</p>
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
          <BookOpen className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">Not enough data yet</p>
          <p className="text-sm text-gray-400 mt-1">Your menu items will appear here once customers start viewing them</p>
        </div>
      ) : (
        <>
          {/* Matrix visual */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="relative" style={{ paddingBottom: "50%" }}>
              <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-1">
                {(["star","puzzle","plowHorse","dog"] as const).map(q => {
                  const qItems = items.filter(i => i.quadrant === q);
                  const meta = QUADRANT_META[q];
                  return (
                    <div key={q} className={`rounded-xl p-3 ${meta.bg} border ${meta.border} flex flex-col gap-1 overflow-hidden`}>
                      <p className={`text-xs font-bold ${meta.text}`}>{meta.label}</p>
                      {qItems.slice(0,3).map(item => (
                        <p key={item.id} className="text-[10px] text-gray-600 truncate">• {item.name}</p>
                      ))}
                      {qItems.length > 3 && <p className="text-[9px] text-gray-400">+{qItems.length - 3} more</p>}
                      {qItems.length === 0 && <p className="text-[10px] text-gray-400 italic">None</p>}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-gray-400">
              <span>← Low popularity</span><span>High popularity →</span>
            </div>
          </div>

          {/* Detailed list per quadrant */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {quadrants.map(q => {
              const qItems = items.filter(i => i.quadrant === q);
              const meta = QUADRANT_META[q];
              if (qItems.length === 0) return null;
              return (
                <div key={q} className={`rounded-2xl border p-5 ${meta.bg} ${meta.border}`}>
                  <h3 className={`font-bold text-sm mb-1 ${meta.text}`}>{meta.label}</h3>
                  <p className="text-xs text-gray-500 mb-3">{meta.desc}</p>
                  <div className="space-y-2">
                    {qItems.slice(0,6).map(item => (
                      <div key={item.id} className="flex items-center gap-2 bg-white/60 rounded-xl px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{item.name}</p>
                          <p className="text-[10px] text-gray-400">€{item.price.toFixed(2)} · {Math.round(item.margin)}% margin</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs font-bold text-gray-700">{item.viewCount}</p>
                          <p className="text-[9px] text-gray-400">views</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-sm text-amber-800">
            <p className="font-semibold mb-1">💡 Tip: Add cost prices to improve accuracy</p>
            <p className="text-xs opacity-80">Edit each menu item and fill in the "Cost Price" field. Without it, margin is estimated at 50%.</p>
          </div>
        </>
      )}
    </div>
  );
}
