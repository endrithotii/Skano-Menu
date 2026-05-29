"use client";

import * as React from "react";
import { Clock } from "lucide-react";
import type { ModernMenuProps } from "./modern";

function parseArr(v?: string | null): string[] {
  if (!v) return [];
  try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; }
}

export function DarkMenu({ restaurant }: ModernMenuProps) {
  const [active, setActive] = React.useState(restaurant.categories[0]?.id ?? "");
  const refs = React.useRef<Record<string, HTMLElement>>({});
  const color = restaurant.primaryColor ?? "#f97316";

  React.useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => { for (const e of entries) if (e.isIntersecting) setActive(e.target.id); },
      { rootMargin: "-30% 0px -60% 0px" }
    );
    Object.values(refs.current).forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [restaurant.categories]);

  return (
    <div className="min-h-screen" style={{ background: "#0d0d0d", color: "#e5e5e5" }}>
      {/* Header */}
      <div className="px-6 pt-12 pb-8 text-center" style={{ borderBottom: "1px solid #1f1f1f" }}>
        <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest"
          style={{ background: `${color}20`, color }}>
          ✦ Menu
        </div>
        <h1 className="text-4xl font-bold text-white tracking-tight">{restaurant.name}</h1>
        {restaurant.description && (
          <p className="mt-2 text-sm max-w-sm mx-auto leading-relaxed" style={{ color: "#6b6b6b" }}>
            {restaurant.description}
          </p>
        )}
      </div>

      {/* Category nav */}
      {restaurant.categories.length > 0 && (
        <div className="sticky top-0 z-10" style={{ background: "#0d0d0ddd", borderBottom: "1px solid #1f1f1f", backdropFilter: "blur(12px)" }}>
          <div className="overflow-x-auto scrollbar-hide">
            <div className="flex gap-1 px-4 py-3 min-w-max">
              {restaurant.categories.map((cat) => (
                <button key={cat.id}
                  onClick={() => { setActive(cat.id); refs.current[cat.id]?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                  style={active === cat.id
                    ? { background: color, color: "#000", fontWeight: 700 }
                    : { background: "#1a1a1a", color: "#666" }}>
                  {cat.icon} {cat.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-xl mx-auto px-4 py-8 space-y-12 pb-24">
        {restaurant.categories.map((cat) => {
          const items = cat.items.filter((i) => i.isAvailable !== false);
          return (
            <section key={cat.id} id={cat.id} ref={(el) => { if (el) refs.current[cat.id] = el; }}>
              <div className="flex items-center gap-3 mb-5">
                <span className="text-xl">{cat.icon || "🍴"}</span>
                <h2 className="text-lg font-bold text-white">{cat.name}</h2>
                <div className="flex-1 h-px" style={{ background: "#1f1f1f" }} />
              </div>
              <div className="space-y-2">
                {items.map((item) => {
                  const tags = parseArr(item.tags);
                  const allergens = parseArr(item.allergens);
                  const prepTime = item.prepTime;
                  return (
                    <div key={item.id}
                      className="rounded-2xl p-4 transition-all hover:scale-[1.01]"
                      style={{ background: "#161616", border: "1px solid #222", boxShadow: item.isFeatured ? `0 0 20px ${color}22` : undefined }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-white">{item.name}</span>
                            {item.isFeatured && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                                style={{ background: `${color}30`, color }}>
                                ★ Featured
                              </span>
                            )}
                          </div>
                          {item.description && (
                            <p className="text-sm mt-1 leading-relaxed" style={{ color: "#6b6b6b" }}>{item.description}</p>
                          )}
                          {prepTime && (
                            <span className="inline-flex items-center gap-1 mt-1.5 text-xs" style={{ color: "#444" }}>
                              <Clock className="w-3 h-3" />~{prepTime} min
                            </span>
                          )}
                          {tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {tags.map((t) => (
                                <span key={t} className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#1f1f1f", color: "#888" }}>{t}</span>
                              ))}
                            </div>
                          )}
                          {allergens.length > 0 && (
                            <p className="text-xs mt-1" style={{ color: "#444" }}>Contains: {allergens.join(", ")}</p>
                          )}
                        </div>
                        <span className="tc-price font-bold text-base tabular-nums shrink-0" style={{ color }}>
                          €{item.price.toFixed(2)}
                        </span>
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
