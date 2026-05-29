"use client";

import * as React from "react";
import { Clock, Zap } from "lucide-react";
import type { ModernMenuProps } from "./modern";

function parseArr(v?: string | null): string[] {
  if (!v) return [];
  try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; }
}

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

export function NeonMenu({ restaurant }: ModernMenuProps) {
  const [active, setActive] = React.useState(restaurant.categories[0]?.id ?? "");
  const refs = React.useRef<Record<string, HTMLElement>>({});
  const color = restaurant.primaryColor ?? "#f97316";
  const rgb = React.useMemo(() => { try { return hexToRgb(color); } catch { return "249, 115, 22"; } }, [color]);

  React.useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => { for (const e of entries) if (e.isIntersecting) setActive(e.target.id); },
      { rootMargin: "-30% 0px -60% 0px" }
    );
    Object.values(refs.current).forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [restaurant.categories]);

  return (
    <div className="min-h-screen" style={{ background: "#050508" }}>
      {/* Glow header */}
      <div className="relative text-center px-6 pt-12 pb-8 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse 60% 40% at 50% 0%, rgba(${rgb},0.25) 0%, transparent 70%)` }} />
        <div className="relative">
          <div className="inline-flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4" style={{ color, filter: `drop-shadow(0 0 6px rgba(${rgb},0.9))` }} />
            <span className="text-xs font-black uppercase tracking-[0.25em]"
              style={{ color, textShadow: `0 0 12px rgba(${rgb},0.8)` }}>
              Menu
            </span>
            <Zap className="w-4 h-4" style={{ color, filter: `drop-shadow(0 0 6px rgba(${rgb},0.9))` }} />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight"
            style={{ textShadow: `0 0 30px rgba(${rgb},0.4)` }}>
            {restaurant.name}
          </h1>
          {restaurant.description && (
            <p className="mt-2 text-sm max-w-sm mx-auto" style={{ color: "rgba(255,255,255,0.35)" }}>
              {restaurant.description}
            </p>
          )}
        </div>
      </div>

      {/* Category nav */}
      {restaurant.categories.length > 0 && (
        <div className="sticky top-0 z-10 backdrop-blur-md"
          style={{ background: "rgba(5,5,8,0.85)", borderBottom: `1px solid rgba(${rgb},0.15)` }}>
          <div className="overflow-x-auto scrollbar-hide">
            <div className="flex gap-1 px-4 py-3 min-w-max">
              {restaurant.categories.map((cat) => (
                <button key={cat.id}
                  onClick={() => { setActive(cat.id); refs.current[cat.id]?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                  className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                  style={active === cat.id
                    ? { background: `rgba(${rgb},0.15)`, color, border: `1px solid rgba(${rgb},0.5)`, boxShadow: `0 0 12px rgba(${rgb},0.3)` }
                    : { color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.05)" }}>
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
              {/* Section header with neon line */}
              <div className="flex items-center gap-3 mb-5">
                <h2 className="text-sm font-black uppercase tracking-[0.2em] whitespace-nowrap" style={{ color }}>
                  {cat.icon} {cat.name}
                </h2>
                <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, rgba(${rgb},0.5), transparent)` }} />
              </div>

              <div className="space-y-2">
                {items.map((item) => {
                  const tags = parseArr(item.tags);
                  const allergens = parseArr(item.allergens);
                  const prepTime = item.prepTime;
                  const glowing = item.isFeatured;
                  return (
                    <div key={item.id}
                      className="rounded-2xl p-4 transition-all"
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        border: glowing ? `1px solid rgba(${rgb},0.4)` : "1px solid rgba(255,255,255,0.06)",
                        boxShadow: glowing ? `0 0 20px rgba(${rgb},0.15), inset 0 0 20px rgba(${rgb},0.05)` : undefined,
                      }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-white">{item.name}</span>
                            {item.isFeatured && (
                              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
                                style={{ background: `rgba(${rgb},0.2)`, color, boxShadow: `0 0 8px rgba(${rgb},0.4)` }}>
                                ★ Hot
                              </span>
                            )}
                          </div>
                          {item.description && (
                            <p className="text-sm mt-1 leading-relaxed" style={{ color: "rgba(255,255,255,0.35)" }}>
                              {item.description}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-3 mt-2">
                            {prepTime && (
                              <span className="inline-flex items-center gap-0.5 text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
                                <Clock className="w-2.5 h-2.5" />~{prepTime} min
                              </span>
                            )}
                            {tags.map((t) => (
                              <span key={t} className="text-xs px-2 py-0.5 rounded-full capitalize"
                                style={{ background: `rgba(${rgb},0.1)`, color: `rgba(${rgb},0.8)` }}>
                                {t}
                              </span>
                            ))}
                            {allergens.length > 0 && (
                              <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
                                Contains: {allergens.join(", ")}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="tc-price font-black text-base tabular-nums shrink-0"
                          style={{ color, textShadow: `0 0 10px rgba(${rgb},0.6)` }}>
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
