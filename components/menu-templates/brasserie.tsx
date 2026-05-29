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

const GOLD = "#c9a84c";
const CREAM = "#faf6ef";
const DARK = "#1c1208";
const MUTED = "#8b7355";

export function BrasserieMenu({ restaurant, dailyMenu }: { restaurant: Restaurant; dailyMenu?: DailyMenu | null }) {
  const [active, setActive] = React.useState(restaurant.categories[0]?.id ?? "");
  const refs = React.useRef<Record<string, HTMLElement>>({});
  const accent = restaurant.primaryColor ?? GOLD;
  const currency = restaurant.currency ?? "€";

  React.useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => { for (const e of entries) { if (e.isIntersecting) setActive(e.target.id); } },
      { rootMargin: "-20% 0px -65% 0px" }
    );
    Object.values(refs.current).forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [restaurant.categories]);

  return (
    <div style={{ background: CREAM, color: DARK, minHeight: "100vh", fontFamily: "'Georgia', 'Times New Roman', serif" }}>

      {/* Hero */}
      <div style={{ background: DARK, paddingBottom: "0" }} className="relative overflow-hidden">
        {/* Top ornamental border */}
        <div style={{ height: 4, background: `linear-gradient(to right, transparent, ${accent}, transparent)` }} />

        <div className="max-w-2xl mx-auto px-6 py-12 text-center relative">
          {/* Ornament above */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <div style={{ height: 1, width: 60, background: `linear-gradient(to right, transparent, ${accent})` }} />
            <span style={{ color: accent, fontSize: 18 }}>✦</span>
            <div style={{ height: 1, width: 60, background: `linear-gradient(to left, transparent, ${accent})` }} />
          </div>

          {restaurant.logo && (
            <div className="relative inline-block mb-5">
              <div style={{ width: 80, height: 80, borderRadius: "50%", border: `2px solid ${accent}`, overflow: "hidden", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#2a1e0e" }}>
                <img src={restaurant.logo} alt={restaurant.name} style={{ width: 64, height: 64, objectFit: "contain" }} />
              </div>
            </div>
          )}

          <div style={{ fontSize: 11, letterSpacing: "0.5em", color: accent, textTransform: "uppercase", marginBottom: 10 }}>
            La Carte
          </div>
          <h1 style={{ fontSize: 42, fontWeight: 400, color: "#fff", letterSpacing: "0.02em", lineHeight: 1.1, margin: 0 }}>
            {restaurant.name}
          </h1>
          {restaurant.description && (
            <p style={{ color: MUTED, fontSize: 13, marginTop: 12, lineHeight: 1.7, maxWidth: 360, margin: "12px auto 0" }}>
              {restaurant.description}
            </p>
          )}

          {/* Ornament below */}
          <div className="flex items-center justify-center gap-3 mt-8">
            <div style={{ height: 1, width: 40, background: `linear-gradient(to right, transparent, ${accent}60)` }} />
            <span style={{ color: `${accent}80`, fontSize: 10 }}>◆ ◆ ◆</span>
            <div style={{ height: 1, width: 40, background: `linear-gradient(to left, transparent, ${accent}60)` }} />
          </div>
        </div>

        {/* Bottom wave */}
        <svg viewBox="0 0 1440 40" style={{ display: "block", marginTop: -1, fill: CREAM }} preserveAspectRatio="none" height={40}>
          <path d="M0,20 C360,40 1080,0 1440,20 L1440,40 L0,40 Z" />
        </svg>
      </div>

      {/* Category nav */}
      <div className="sticky top-0 z-20" style={{ background: CREAM, borderBottom: `1px solid ${accent}30`, boxShadow: `0 2px 12px ${accent}15` }}>
        <div className="max-w-2xl mx-auto overflow-x-auto scrollbar-none">
          <div className="flex justify-center gap-0 px-4 py-0">
            {restaurant.categories.map((cat) => (
              <button key={cat.id}
                onClick={() => { setActive(cat.id); refs.current[cat.id]?.scrollIntoView({ behavior: "smooth" }); }}
                style={{
                  fontFamily: "inherit",
                  color: active === cat.id ? accent : MUTED,
                  borderBottom: active === cat.id ? `2px solid ${accent}` : "2px solid transparent",
                  padding: "14px 18px 12px",
                  fontSize: 11,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  fontWeight: active === cat.id ? 600 : 400,
                  background: "none",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  whiteSpace: "nowrap",
                }}>
                {cat.icon && <span style={{ marginRight: 4 }}>{cat.icon}</span>}
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10 pb-32">

        {/* Daily specials */}
        {dailyMenu?.specials && dailyMenu.specials.length > 0 && (
          <section style={{ marginBottom: 48 }}>
            <SectionDivider accent={accent} label="Plats du Jour" />
            <div style={{ background: "#fff", borderRadius: 4, border: `1px solid ${accent}30`, padding: "24px 28px", marginTop: 20 }}>
              {dailyMenu.specials.map((s, idx) => (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, paddingTop: idx > 0 ? 14 : 0, marginTop: idx > 0 ? 14 : 0, borderTop: idx > 0 ? `1px dashed ${accent}30` : "none" }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: DARK }}>{s.name}</span>
                    {s.description && <p style={{ fontSize: 12, color: MUTED, marginTop: 2, fontStyle: "italic" }}>{s.description}</p>}
                  </div>
                  {s.price != null && (
                    <span style={{ fontWeight: 600, fontSize: 16, color: accent, whiteSpace: "nowrap" }}>{currency}{s.price.toFixed(2)}</span>
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
            <section key={cat.id} id={cat.id} ref={(el) => { if (el) refs.current[cat.id] = el; }} style={{ marginBottom: 52 }}>
              <SectionDivider accent={accent} label={cat.name} icon={cat.icon ?? undefined} sub={cat.description ?? undefined} />

              <div style={{ marginTop: 24 }}>
                {items.map((item, idx) => {
                  const tags = parseTags(item.tags);
                  const isLast = idx === items.length - 1;
                  return (
                    <div key={item.id} style={{
                      display: "flex", gap: 16, paddingBottom: 20, marginBottom: isLast ? 0 : 20,
                      borderBottom: isLast ? "none" : `1px solid ${accent}20`
                    }}>
                      {/* Image */}
                      {item.image && (
                        <div style={{ flexShrink: 0, width: 80, height: 80, borderRadius: 4, overflow: "hidden", border: `1px solid ${accent}20` }}>
                          <img src={item.image} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </div>
                      )}
                      {/* Text */}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <h3 style={{ fontSize: 15, fontWeight: 600, color: DARK, margin: 0, lineHeight: 1.3 }}>{item.name}</h3>
                              {item.isFeatured && <span style={{ fontSize: 10, color: accent }}>✦</span>}
                            </div>
                            {item.description && (
                              <p style={{ fontSize: 12, color: MUTED, marginTop: 4, lineHeight: 1.6, fontStyle: "italic" }}>
                                {item.description}
                              </p>
                            )}
                            {tags.length > 0 && (
                              <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                                {tags.slice(0, 4).map((t) => (
                                  <span key={t} style={{
                                    fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase",
                                    border: `1px solid ${accent}50`, color: accent, borderRadius: 2,
                                    padding: "2px 6px"
                                  }}>{t}</span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
                            <span style={{ fontSize: 17, fontWeight: 600, color: DARK }}>{currency}{item.price.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        {/* Footer ornament */}
        <div className="flex items-center justify-center gap-3 pt-8" style={{ borderTop: `1px solid ${accent}30` }}>
          <div style={{ height: 1, width: 50, background: `linear-gradient(to right, transparent, ${accent}60)` }} />
          <span style={{ color: accent, fontSize: 14 }}>✦</span>
          <div style={{ height: 1, width: 50, background: `linear-gradient(to left, transparent, ${accent}60)` }} />
        </div>
      </div>
    </div>
  );
}

function SectionDivider({ label, accent, icon, sub }: { label: string; accent: string; icon?: string; sub?: string }) {
  return (
    <div style={{ textAlign: "center", padding: "0 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ flex: 1, height: 1, background: `linear-gradient(to right, transparent, ${accent}40)` }} />
        <div>
          {icon && <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>}
          <h2 style={{ fontFamily: "inherit", fontSize: 13, letterSpacing: "0.35em", textTransform: "uppercase", color: accent, fontWeight: 400, margin: 0 }}>
            {label}
          </h2>
          {sub && <p style={{ fontSize: 11, color: "#9b8060", marginTop: 3, fontStyle: "italic", letterSpacing: "0.05em" }}>{sub}</p>}
        </div>
        <div style={{ flex: 1, height: 1, background: `linear-gradient(to left, transparent, ${accent}40)` }} />
      </div>
    </div>
  );
}
