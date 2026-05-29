"use client";

import * as React from "react";
import { Clock } from "lucide-react";
import type { ModernMenuProps } from "./modern";

function parseArr(v?: string | null): string[] {
  if (!v) return [];
  try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; }
}

export function MagazineMenu({ restaurant }: ModernMenuProps) {
  const [active, setActive] = React.useState(restaurant.categories[0]?.id ?? "");
  const refs = React.useRef<Record<string, HTMLElement>>({});
  const color = restaurant.primaryColor ?? "#f97316";

  React.useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => { for (const e of entries) if (e.isIntersecting) setActive(e.target.id); },
      { rootMargin: "-20% 0px -60% 0px" }
    );
    Object.values(refs.current).forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [restaurant.categories]);

  return (
    <div className="min-h-screen bg-white">
      {/* Full-bleed masthead */}
      <div className="relative overflow-hidden" style={{ background: "#111" }}>
        <div className="absolute inset-0" style={{
          background: `radial-gradient(ellipse at 60% 40%, ${color}55 0%, transparent 65%)`,
        }} />
        <div className="relative max-w-2xl mx-auto px-6 py-16">
          <div className="mb-3">
            <span className="text-xs uppercase tracking-[0.3em] font-bold" style={{ color }}>Menu</span>
            <span className="mx-2 text-gray-600">·</span>
            <span className="text-xs text-gray-500 uppercase tracking-widest">Today's Edition</span>
          </div>
          <h1 className="text-5xl font-black text-white leading-none tracking-tight mb-3">
            {restaurant.name}
          </h1>
          {restaurant.description && (
            <p className="text-base text-gray-400 max-w-sm leading-relaxed border-l-2 pl-4" style={{ borderColor: color }}>
              {restaurant.description}
            </p>
          )}
        </div>
      </div>

      {/* Sticky section navigation */}
      {restaurant.categories.length > 0 && (
        <div className="sticky top-0 z-10 bg-white border-b-2 border-gray-900">
          <div className="overflow-x-auto scrollbar-hide max-w-2xl mx-auto">
            <div className="flex min-w-max">
              {restaurant.categories.map((cat) => (
                <button key={cat.id}
                  onClick={() => { setActive(cat.id); refs.current[cat.id]?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                  className="px-5 py-3.5 text-xs font-bold uppercase tracking-widest border-r border-gray-100 transition-colors whitespace-nowrap"
                  style={active === cat.id ? { background: color, color: "#fff" } : { color: "#999" }}>
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-0">
        {restaurant.categories.map((cat, catIdx) => {
          const items = cat.items.filter((i) => i.isAvailable !== false);
          const featured = items.filter((i) => i.isFeatured);
          const regular = items.filter((i) => !i.isFeatured);

          return (
            <section key={cat.id} id={cat.id}
              ref={(el) => { if (el) refs.current[cat.id] = el; }}
              className="py-10 border-b-2 border-gray-900">

              {/* Section banner */}
              <div className="flex items-end gap-4 mb-8">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-black"
                      style={{ background: color }}>
                      {(catIdx + 1).toString().padStart(2, "0")}
                    </div>
                    <span className="text-xs uppercase tracking-[0.2em] text-gray-400 font-semibold">Section</span>
                  </div>
                  <h2 className="text-4xl font-black text-gray-900 tracking-tight leading-none">{cat.name}</h2>
                  {cat.description && <p className="text-sm text-gray-500 mt-2">{cat.description}</p>}
                </div>
              </div>

              {/* Featured items — full-width highlight */}
              {featured.map((item) => {
                const tags = parseArr(item.tags);
                const allergens = parseArr(item.allergens);
                const prepTime = item.prepTime;
                return (
                  <div key={item.id} className="mb-6 rounded-2xl overflow-hidden border-2 border-gray-900">
                    <div className="px-5 py-1.5 text-xs font-black uppercase tracking-widest text-white"
                      style={{ background: color }}>Editor's Pick</div>
                    <div className="p-5">
                      <div className="flex items-baseline justify-between gap-4">
                        <h3 className="text-2xl font-black text-gray-900 leading-tight">{item.name}</h3>
                        <span className="tc-price text-2xl font-black tabular-nums" style={{ color }}>€{item.price.toFixed(2)}</span>
                      </div>
                      {item.description && <p className="text-gray-600 mt-2 text-sm leading-relaxed">{item.description}</p>}
                      <div className="flex items-center gap-3 mt-3 flex-wrap">
                        {prepTime && <span className="inline-flex items-center gap-1 text-xs text-gray-400"><Clock className="w-3 h-3" />~{prepTime} min</span>}
                        {tags.map((t) => <span key={t} className="text-xs font-semibold uppercase tracking-wide" style={{ color }}>{t}</span>)}
                        {allergens.length > 0 && <span className="text-xs text-gray-300">Contains: {allergens.join(", ")}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Regular items — 2-col text grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0">
                {regular.map((item, i) => {
                  const tags = parseArr(item.tags);
                  const allergens = parseArr(item.allergens);
                  const prepTime = item.prepTime;
                  return (
                    <div key={item.id} className={`py-4 ${i < regular.length - 2 || (regular.length % 2 === 1 && i < regular.length - 1) ? "border-b border-gray-100" : ""}`}>
                      <div className="flex items-baseline gap-2">
                        <span className="font-bold text-gray-900 text-sm">{item.name}</span>
                        <span className="flex-1 border-b border-dotted border-gray-200 mb-0.5" />
                        <span className="tc-price font-bold tabular-nums text-sm" style={{ color }}>€{item.price.toFixed(2)}</span>
                      </div>
                      {item.description && <p className="text-xs text-gray-500 mt-0.5 leading-relaxed line-clamp-2">{item.description}</p>}
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        {prepTime && <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-300"><Clock className="w-2.5 h-2.5" />{prepTime}m</span>}
                        {tags.length > 0 && <span className="text-[10px] text-gray-400 capitalize">{tags.join(" · ")}</span>}
                        {allergens.length > 0 && <span className="text-[10px] text-gray-300">Contains: {allergens.join(", ")}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
