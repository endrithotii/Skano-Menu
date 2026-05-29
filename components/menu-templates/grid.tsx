"use client";

import * as React from "react";
import { UtensilsCrossed, Clock, Flame, Leaf, Star, Sparkles } from "lucide-react";
import type { ModernMenuProps } from "./modern";

function parseArr(v?: string | null): string[] {
  if (!v) return [];
  try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; }
}

const TAG_ICONS: Record<string, React.ReactNode> = {
  spicy: <Flame className="w-2.5 h-2.5" />,
  vegetarian: <Leaf className="w-2.5 h-2.5" />,
  vegan: <Leaf className="w-2.5 h-2.5" />,
  popular: <Star className="w-2.5 h-2.5" />,
  new: <Sparkles className="w-2.5 h-2.5" />,
};

export function GridMenu({ restaurant }: ModernMenuProps) {
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
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="relative h-44 flex items-end p-6 overflow-hidden"
        style={{ background: `linear-gradient(145deg, ${color}ee, ${color}88)` }}>
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: `repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)`, backgroundSize: "20px 20px" }} />
        <div className="relative">
          <h1 className="text-3xl font-black text-white tracking-tight leading-none">{restaurant.name}</h1>
          {restaurant.description && <p className="text-white/70 text-sm mt-1">{restaurant.description}</p>}
        </div>
      </div>

      {/* Category pills */}
      {restaurant.categories.length > 0 && (
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 shadow-sm">
          <div className="overflow-x-auto scrollbar-hide">
            <div className="flex gap-2 px-4 py-3 min-w-max">
              {restaurant.categories.map((cat) => (
                <button key={cat.id}
                  onClick={() => { setActive(cat.id); refs.current[cat.id]?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                  className="px-4 py-1.5 rounded-full text-sm font-semibold transition-all"
                  style={active === cat.id
                    ? { background: color, color: "#fff", boxShadow: `0 4px 12px ${color}50` }
                    : { background: "#f3f4f6", color: "#6b7280" }}>
                  {cat.icon} {cat.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-10 pb-24">
        {restaurant.categories.map((cat) => {
          const items = cat.items.filter((i) => i.isAvailable !== false);
          return (
            <section key={cat.id} id={`cat-${cat.id}`} ref={(el) => { if (el) refs.current[cat.id] = el; }}>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">{cat.icon || "🍽️"}</span>
                <h2 className="text-lg font-bold text-gray-900">{cat.name}</h2>
                {cat.description && <span className="text-xs text-gray-400 font-normal">— {cat.description}</span>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {items.map((item) => {
                  const tags = parseArr(item.tags);
                  const allergens = parseArr(item.allergens);
                  const prepTime = item.prepTime;
                  return (
                    <div key={item.id}
                      className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                      {/* Image area */}
                      <div className="h-28 flex items-center justify-center"
                        style={{ background: `linear-gradient(135deg, ${color}18, ${color}08)` }}>
                        {item.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                            style={{ background: `${color}20` }}>
                            <UtensilsCrossed className="w-5 h-5" style={{ color }} />
                          </div>
                        )}
                      </div>
                      {/* Content */}
                      <div className="p-3">
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <span className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2">{item.name}</span>
                          {item.isFeatured && (
                            <span className="text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                              style={{ background: color }}>★</span>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-xs text-gray-400 line-clamp-2 mb-2">{item.description}</p>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="tc-price font-bold text-sm" style={{ color }}>€{item.price.toFixed(2)}</span>
                          {prepTime && (
                            <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />{prepTime}m
                            </span>
                          )}
                        </div>
                        {tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {tags.slice(0, 3).map((t) => (
                              <span key={t} className="inline-flex items-center gap-0.5 text-[10px] bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5 font-medium">
                                {TAG_ICONS[t]}{t}
                              </span>
                            ))}
                          </div>
                        )}
                        {allergens.length > 0 && (
                          <p className="text-[10px] text-gray-300 mt-1">Contains: {allergens.join(", ")}</p>
                        )}
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
