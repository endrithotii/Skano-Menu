"use client";

import * as React from "react";
import { Clock } from "lucide-react";
import type { ModernMenuProps } from "./modern";

function parseArr(v?: string | null): string[] {
  if (!v) return [];
  try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; }
}

export function MinimalMenu({ restaurant }: ModernMenuProps) {
  const [active, setActive] = React.useState(restaurant.categories[0]?.id ?? "");
  const refs = React.useRef<Record<string, HTMLElement>>({});
  const color = restaurant.primaryColor ?? "#111111";

  React.useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => { for (const e of entries) if (e.isIntersecting) setActive(e.target.id); },
      { rootMargin: "-30% 0px -60% 0px" }
    );
    Object.values(refs.current).forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [restaurant.categories]);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="px-6 pt-14 pb-8 border-b border-gray-100">
        <h1 className="text-4xl font-light tracking-tight text-gray-900">{restaurant.name}</h1>
        {restaurant.description && (
          <p className="mt-2 text-sm text-gray-400 max-w-sm leading-relaxed">{restaurant.description}</p>
        )}
      </div>

      {/* Category nav — simple underline */}
      {restaurant.categories.length > 0 && (
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-100">
          <div className="overflow-x-auto scrollbar-hide">
            <div className="flex min-w-max px-6 gap-6">
              {restaurant.categories.map((cat) => (
                <button key={cat.id}
                  onClick={() => { setActive(cat.id); refs.current[cat.id]?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                  className="py-4 text-sm font-medium transition-colors border-b-2 whitespace-nowrap"
                  style={{ color: active === cat.id ? color : "#9ca3af", borderBottomColor: active === cat.id ? color : "transparent" }}>
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-xl mx-auto px-6 py-10 space-y-16">
        {restaurant.categories.map((cat) => {
          const items = cat.items.filter((i) => i.isAvailable !== false);
          return (
            <section key={cat.id} id={cat.id} ref={(el) => { if (el) refs.current[cat.id] = el; }}>
              <div className="mb-6 flex items-center gap-4">
                <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">{cat.name}</h2>
                <div className="flex-1 h-px bg-gray-100" />
              </div>
              <div className="space-y-0">
                {items.map((item, i) => {
                  const tags = parseArr(item.tags);
                  const allergens = parseArr(item.allergens);
                  return (
                    <div key={item.id} className={`py-4 ${i < items.length - 1 ? "border-b border-gray-50" : ""}`}>
                      <div className="flex items-baseline gap-3">
                        <span className="font-medium text-gray-900 text-[15px]">{item.name}</span>
                        {item.isFeatured && (
                          <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color }}>pick</span>
                        )}
                        <span className="flex-1 border-b border-dotted border-gray-200 mb-1" />
                        <span className="tc-price font-medium text-gray-900 tabular-nums text-[15px]">€{item.price.toFixed(2)}</span>
                      </div>
                      {item.description && (
                        <p className="text-sm text-gray-400 mt-1 leading-relaxed">{item.description}</p>
                      )}
                      {item.prepTime && (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-300 mt-1">
                          <Clock className="w-3 h-3" />~{item.prepTime} min
                        </span>
                      )}
                      {(tags.length > 0 || allergens.length > 0) && (
                        <p className="text-xs text-gray-300 mt-1">
                          {tags.join(" · ")}{tags.length > 0 && allergens.length > 0 ? " — " : ""}{allergens.length > 0 ? `Contains: ${allergens.join(", ")}` : ""}
                        </p>
                      )}
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
