"use client";

import * as React from "react";

interface MenuItem {
  id: string; name: string; description?: string | null; price: number;
  image?: string | null; tags?: string | null; isFeatured?: boolean; isAvailable?: boolean;
}
interface MenuCategory { id: string; name: string; description?: string | null; icon?: string | null; items: MenuItem[]; }
interface DailyMenuSpecial { id: string; name: string; description?: string | null; price?: number | null; }
interface DailyMenu { id: string; specials?: DailyMenuSpecial[]; notes?: string | null; }
interface Restaurant {
  name: string; description?: string | null; logo?: string | null;
  primaryColor?: string | null; currency?: string; categories: MenuCategory[];
}

function parseTags(v?: string | null): string[] {
  try { const p = JSON.parse(v ?? "[]"); return Array.isArray(p) ? p : []; } catch { return []; }
}

export function TokyoMenu({ restaurant, dailyMenu }: { restaurant: Restaurant; dailyMenu?: DailyMenu | null }) {
  const [active, setActive] = React.useState(restaurant.categories[0]?.id ?? "");
  const refs = React.useRef<Record<string, HTMLElement>>({});
  const color = restaurant.primaryColor ?? "#e63946";
  const currency = restaurant.currency ?? "€";

  React.useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => { for (const e of entries) { if (e.isIntersecting) setActive(e.target.id); } },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    Object.values(refs.current).forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [restaurant.categories]);

  return (
    <div className="min-h-screen" style={{ background: "#0a0a0a", color: "#f5f5f5" }}>
      {/* Hero header */}
      <div className="relative overflow-hidden" style={{ borderBottom: `1px solid #1f1f1f` }}>
        <div className="max-w-2xl mx-auto px-6 py-14 text-center">
          {restaurant.logo && (
            <img src={restaurant.logo} alt={restaurant.name}
              className="w-16 h-16 object-contain mx-auto mb-6 rounded-2xl" />
          )}
          <div className="text-xs tracking-[0.4em] uppercase mb-3" style={{ color }}>Menu</div>
          <h1 className="text-5xl font-black tracking-tight leading-none" style={{ letterSpacing: "-0.03em" }}>
            {restaurant.name}
          </h1>
          {restaurant.description && (
            <p className="mt-4 text-sm leading-relaxed max-w-sm mx-auto" style={{ color: "#888" }}>
              {restaurant.description}
            </p>
          )}
        </div>
        {/* Decorative lines */}
        <div className="absolute top-0 left-0 w-px h-full" style={{ background: `linear-gradient(to bottom, transparent, ${color}40, transparent)` }} />
        <div className="absolute top-0 right-0 w-px h-full" style={{ background: `linear-gradient(to bottom, transparent, ${color}40, transparent)` }} />
      </div>

      {/* Category nav — minimal horizontal pills */}
      <div className="sticky top-0 z-20" style={{ background: "#0a0a0a", borderBottom: "1px solid #1a1a1a" }}>
        <div className="max-w-2xl mx-auto overflow-x-auto scrollbar-none">
          <div className="flex gap-0 px-6 py-0">
            {restaurant.categories.map((cat) => (
              <button key={cat.id}
                onClick={() => { setActive(cat.id); refs.current[cat.id]?.scrollIntoView({ behavior: "smooth" }); }}
                className="relative px-5 py-4 text-xs tracking-widest uppercase font-semibold transition-colors whitespace-nowrap"
                style={{ color: active === cat.id ? color : "#555" }}>
                {cat.name}
                {active === cat.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-px" style={{ background: color }} />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-12 space-y-20 pb-32">
        {/* Daily specials */}
        {dailyMenu?.specials && dailyMenu.specials.length > 0 && (
          <section>
            <div className="flex items-center gap-4 mb-8">
              <div className="h-px flex-1" style={{ background: "#1f1f1f" }} />
              <span className="text-[10px] tracking-[0.5em] uppercase font-bold" style={{ color }}>
                Today's Specials
              </span>
              <div className="h-px flex-1" style={{ background: "#1f1f1f" }} />
            </div>
            <div className="space-y-6">
              {dailyMenu.specials.map((s) => (
                <div key={s.id} className="flex items-baseline justify-between gap-4">
                  <div className="flex-1">
                    <span className="font-semibold text-base text-white">{s.name}</span>
                    {s.description && <p className="text-xs mt-0.5" style={{ color: "#777" }}>{s.description}</p>}
                  </div>
                  {s.price != null && (
                    <span className="font-black text-xl tabular-nums" style={{ color }}>{currency}{s.price.toFixed(2)}</span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Categories */}
        {restaurant.categories.map((cat) => {
          const items = cat.items.filter((i) => i.isAvailable !== false);
          return (
            <section key={cat.id} id={cat.id} ref={(el) => { if (el) refs.current[cat.id] = el; }}>
              {/* Category header */}
              <div className="flex items-center gap-4 mb-10">
                <div className="h-px flex-1" style={{ background: "#1f1f1f" }} />
                <div className="text-center">
                  {cat.icon && <div className="text-2xl mb-1">{cat.icon}</div>}
                  <h2 className="text-xs tracking-[0.5em] uppercase font-bold" style={{ color }}>
                    {cat.name}
                  </h2>
                  {cat.description && (
                    <p className="text-xs mt-1" style={{ color: "#555" }}>{cat.description}</p>
                  )}
                </div>
                <div className="h-px flex-1" style={{ background: "#1f1f1f" }} />
              </div>

              {/* Items — ultra-minimal list */}
              <div className="space-y-0">
                {items.map((item, idx) => {
                  const tags = parseTags(item.tags);
                  return (
                    <div key={item.id}
                      className="group flex items-start gap-4 py-5 transition-all"
                      style={{ borderTop: idx === 0 ? "none" : "1px solid #141414" }}>
                      {/* Number */}
                      <span className="text-[10px] tabular-nums mt-1 w-6 shrink-0 text-right" style={{ color: "#333" }}>
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      {/* Image */}
                      {item.image && (
                        <img src={item.image} alt={item.name}
                          className="w-14 h-14 rounded-lg object-cover shrink-0 opacity-80 group-hover:opacity-100 transition-opacity" />
                      )}
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-bold text-sm text-white leading-snug group-hover:text-gray-100">
                              {item.name}
                              {item.isFeatured && (
                                <span className="ml-2 text-[10px] tracking-widest uppercase font-normal" style={{ color }}>
                                  ★
                                </span>
                              )}
                            </h3>
                            {item.description && (
                              <p className="text-xs mt-1 leading-relaxed line-clamp-2" style={{ color: "#666" }}>
                                {item.description}
                              </p>
                            )}
                            {tags.length > 0 && (
                              <div className="flex gap-1.5 mt-1.5 flex-wrap">
                                {tags.slice(0, 3).map((t) => (
                                  <span key={t} className="text-[9px] tracking-widest uppercase px-1.5 py-0.5 rounded"
                                    style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}>
                                    {t}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <span className="font-black text-lg tabular-nums shrink-0 leading-none" style={{ color }}>
                            {currency}{item.price.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* Footer mark */}
      <div className="fixed bottom-10 left-4 z-10">
        <div className="w-1.5 h-8 rounded-full" style={{ background: `linear-gradient(to bottom, ${color}, transparent)` }} />
      </div>
    </div>
  );
}
