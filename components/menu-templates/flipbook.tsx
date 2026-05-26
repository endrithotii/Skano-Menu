"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import type { ModernMenuProps } from "./modern";

function parseArr(v?: string | null): string[] {
  if (!v) return [];
  try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; }
}

export function FlipbookMenu({ restaurant }: ModernMenuProps) {
  const [page, setPage] = React.useState(0);
  const [dir, setDir] = React.useState<"next" | "prev">("next");
  const [animating, setAnimating] = React.useState(false);
  const cats = restaurant.categories;
  const color = restaurant.primaryColor ?? "#f97316";
  const current = cats[page];

  function go(newPage: number, direction: "next" | "prev") {
    if (animating || newPage < 0 || newPage >= cats.length) return;
    setDir(direction);
    setAnimating(true);
    setTimeout(() => { setPage(newPage); setAnimating(false); }, 280);
  }

  if (!current) return (
    <div className="min-h-screen flex items-center justify-center bg-amber-50">
      <p className="text-gray-400">No categories yet.</p>
    </div>
  );

  const items = current.items.filter((i) => i.isAvailable !== false);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#f9f5ef" }}>
      {/* Restaurant header */}
      <div className="text-center pt-10 pb-4 px-4">
        <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "Georgia, serif", color: "#1c1208" }}>
          {restaurant.name}
        </h1>
        {restaurant.description && (
          <p className="text-sm mt-1 text-amber-800/60 italic">{restaurant.description}</p>
        )}
      </div>

      {/* Page counter + category dots */}
      <div className="flex items-center justify-center gap-2 mb-4">
        {cats.map((_, i) => (
          <button key={i} onClick={() => go(i, i > page ? "next" : "prev")}
            className="w-2 h-2 rounded-full transition-all"
            style={{ background: i === page ? color : "#d6c9b0", transform: i === page ? "scale(1.4)" : "scale(1)" }} />
        ))}
      </div>

      {/* Book page */}
      <div className="flex-1 max-w-lg mx-auto w-full px-4 pb-8">
        <div
          className="relative bg-white rounded-2xl shadow-xl overflow-hidden transition-all duration-[280ms]"
          style={{
            minHeight: 480,
            boxShadow: "0 8px 40px rgba(0,0,0,0.14), 4px 0 0 #e8dfd0, 8px 0 0 #efe8dc",
            opacity: animating ? 0 : 1,
            transform: animating
              ? `translateX(${dir === "next" ? "-16px" : "16px"}) scale(0.97)`
              : "translateX(0) scale(1)",
          }}>
          {/* Page top strip */}
          <div className="h-2 w-full" style={{ background: `linear-gradient(to right, ${color}, ${color}99)` }} />

          {/* Category title */}
          <div className="px-6 pt-6 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{current.icon || "🍽️"}</span>
              <div>
                <p className="text-xs uppercase tracking-widest font-semibold" style={{ color }}>
                  {page + 1} / {cats.length}
                </p>
                <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "Georgia, serif" }}>
                  {current.name}
                </h2>
              </div>
            </div>
            {current.description && (
              <p className="text-sm text-gray-400 mt-2 italic">{current.description}</p>
            )}
          </div>

          {/* Items */}
          <div className="px-6 py-4 space-y-0 overflow-y-auto" style={{ maxHeight: 420 }}>
            {items.map((item, i) => {
              const tags = parseArr(item.tags);
              const allergens = parseArr(item.allergens);
              const prepTime = item.prepTime;
              return (
                <div key={item.id} className={`py-4 ${i < items.length - 1 ? "border-b border-gray-50" : ""}`}>
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-gray-900 text-[15px]" style={{ fontFamily: "Georgia, serif" }}>
                      {item.name}
                      {item.isFeatured && <span className="ml-1.5 text-xs italic font-normal" style={{ color }}>(Chef's pick)</span>}
                    </span>
                    <span className="flex-1 border-b border-dotted border-gray-200 mb-1" />
                    <span className="font-bold tabular-nums text-[15px]" style={{ color }}>€{item.price.toFixed(2)}</span>
                  </div>
                  {item.description && <p className="text-sm text-gray-500 mt-0.5 italic leading-snug">{item.description}</p>}
                  <div className="flex flex-wrap items-center gap-3 mt-1">
                    {prepTime && (
                      <span className="inline-flex items-center gap-0.5 text-xs text-gray-300">
                        <Clock className="w-2.5 h-2.5" />{prepTime} min
                      </span>
                    )}
                    {tags.length > 0 && <span className="text-xs text-gray-400">{tags.join(" · ")}</span>}
                    {allergens.length > 0 && <span className="text-xs text-gray-300">Contains: {allergens.join(", ")}</span>}
                  </div>
                </div>
              );
            })}
            {items.length === 0 && <p className="text-center text-sm text-gray-300 py-8 italic">Nothing available right now.</p>}
          </div>

          {/* Page number at bottom */}
          <div className="absolute bottom-3 right-5 text-xs text-gray-300 select-none"
            style={{ fontFamily: "Georgia, serif" }}>— {page + 1} —</div>
        </div>

        {/* Prev / Next */}
        <div className="flex items-center justify-between mt-5 px-2">
          <button onClick={() => go(page - 1, "prev")} disabled={page === 0}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-medium text-sm transition-all disabled:opacity-25"
            style={page > 0 ? { background: color, color: "#fff" } : { background: "#e8e0d4", color: "#999" }}>
            <ChevronLeft className="w-4 h-4" /> Prev
          </button>
          <span className="text-xs text-gray-400">{current.name}</span>
          <button onClick={() => go(page + 1, "next")} disabled={page === cats.length - 1}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-medium text-sm transition-all disabled:opacity-25"
            style={page < cats.length - 1 ? { background: color, color: "#fff" } : { background: "#e8e0d4", color: "#999" }}>
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
