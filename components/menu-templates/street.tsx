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

export function StreetMenu({ restaurant, dailyMenu }: { restaurant: Restaurant; dailyMenu?: DailyMenu | null }) {
  const [active, setActive] = React.useState(restaurant.categories[0]?.id ?? "");
  const refs = React.useRef<Record<string, HTMLElement>>({});
  const accent = restaurant.primaryColor ?? "#ff4d00";
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
    <div style={{ minHeight: "100vh", background: "#111", color: "#f5f5f5" }}>
      {/* Hero — bold, offset, punchy */}
      <div style={{ background: accent, padding: "40px 24px 60px", position: "relative", overflow: "hidden" }}>
        {/* Diagonal stripe pattern */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `repeating-linear-gradient(45deg, rgba(0,0,0,0.06) 0, rgba(0,0,0,0.06) 1px, transparent 0, transparent 50%)`,
          backgroundSize: "12px 12px"
        }} />
        <div className="max-w-2xl mx-auto relative">
          {restaurant.logo && (
            <img src={restaurant.logo} alt={restaurant.name}
              style={{ width: 60, height: 60, objectFit: "contain", borderRadius: 12, marginBottom: 14, filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.3))" }} />
          )}
          <div style={{ display: "inline-block", background: "rgba(0,0,0,0.25)", padding: "4px 12px", borderRadius: 4, marginBottom: 10 }}>
            <span style={{ fontSize: 10, letterSpacing: "0.4em", textTransform: "uppercase", color: "rgba(255,255,255,0.85)", fontWeight: 700 }}>Menu</span>
          </div>
          <h1 style={{ fontSize: 52, fontWeight: 900, color: "#fff", margin: 0, lineHeight: 0.95, letterSpacing: "-0.03em", textTransform: "uppercase" }}>
            {restaurant.name}
          </h1>
          {restaurant.description && (
            <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, marginTop: 12, maxWidth: 360, lineHeight: 1.6 }}>
              {restaurant.description}
            </p>
          )}
        </div>
        {/* Jagged bottom */}
        <svg viewBox="0 0 400 20" style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 20 }} preserveAspectRatio="none" fill="#111">
          <polygon points="0,20 20,0 40,20 60,0 80,20 100,0 120,20 140,0 160,20 180,0 200,20 220,0 240,20 260,0 280,20 300,0 320,20 340,0 360,20 380,0 400,20" />
        </svg>
      </div>

      {/* Category bar */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: "#111", borderBottom: "1px solid #222" }}>
        <div className="max-w-2xl mx-auto overflow-x-auto scrollbar-none">
          <div style={{ display: "flex", padding: "0 16px" }}>
            {restaurant.categories.map((cat) => (
              <button key={cat.id}
                onClick={() => { setActive(cat.id); refs.current[cat.id]?.scrollIntoView({ behavior: "smooth" }); }}
                style={{
                  padding: "14px 18px",
                  fontSize: 11, fontWeight: 800,
                  letterSpacing: "0.15em", textTransform: "uppercase",
                  color: active === cat.id ? accent : "#555",
                  borderBottom: active === cat.id ? `3px solid ${accent}` : "3px solid transparent",
                  background: "none", border: "none",
                  borderBottomStyle: "solid",
                  borderBottomWidth: 3,
                  borderBottomColor: active === cat.id ? accent : "transparent",
                  cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap",
                }}>
                {cat.icon && <span style={{ marginRight: 5 }}>{cat.icon}</span>}
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 pb-32">

        {/* Daily specials */}
        {dailyMenu?.specials && dailyMenu.specials.length > 0 && (
          <section style={{ marginBottom: 36 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={{ width: 4, height: 18, background: accent, borderRadius: 2 }} />
              <h2 style={{ fontSize: 12, fontWeight: 900, color: accent, letterSpacing: "0.3em", textTransform: "uppercase", margin: 0 }}>Today Only</h2>
            </div>
            <div style={{ border: `2px solid ${accent}`, borderRadius: 8, overflow: "hidden" }}>
              {dailyMenu.specials.map((s, idx) => (
                <div key={s.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
                  padding: "14px 18px", background: idx % 2 === 0 ? "#1a1a1a" : "#141414"
                }}>
                  <div>
                    <p style={{ fontWeight: 800, fontSize: 14, color: "#fff", margin: 0 }}>{s.name}</p>
                    {s.description && <p style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{s.description}</p>}
                  </div>
                  {s.price != null && <span style={{ fontWeight: 900, fontSize: 18, color: accent }}>{currency}{s.price.toFixed(2)}</span>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Categories */}
        {restaurant.categories.map((cat) => {
          const items = cat.items.filter((i) => i.isAvailable !== false);
          return (
            <section key={cat.id} id={cat.id} ref={(el) => { if (el) refs.current[cat.id] = el; }} style={{ marginBottom: 44 }}>
              {/* Category header */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, paddingBottom: 12, borderBottom: `2px solid ${accent}40` }}>
                <div style={{ width: 4, height: 28, background: accent, borderRadius: 2, flexShrink: 0 }} />
                <div>
                  {cat.icon && <span style={{ fontSize: 20, marginRight: 8 }}>{cat.icon}</span>}
                  <span style={{ fontSize: 20, fontWeight: 900, textTransform: "uppercase", letterSpacing: "-0.01em" }}>{cat.name}</span>
                </div>
                {cat.description && <span style={{ fontSize: 11, color: "#666", marginLeft: 4 }}>— {cat.description}</span>}
              </div>

              {/* Items */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {items.map((item) => {
                  const tags = parseTags(item.tags);
                  return (
                    <div key={item.id} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "12px 14px", borderRadius: 8, background: "#1a1a1a", border: "1px solid #252525", transition: "border-color 0.15s" }}>
                      {item.image && (
                        <div style={{ flexShrink: 0, width: 72, height: 72, borderRadius: 6, overflow: "hidden" }}>
                          <img src={item.image} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <h3 style={{ fontSize: 14, fontWeight: 800, color: "#f5f5f5", margin: 0, lineHeight: 1.2, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                                {item.name}
                              </h3>
                              {item.isFeatured && (
                                <span style={{ background: accent, color: "#fff", fontSize: 8, fontWeight: 900, letterSpacing: "0.2em", padding: "2px 5px", borderRadius: 3, textTransform: "uppercase" }}>
                                  HOT
                                </span>
                              )}
                            </div>
                            {item.description && (
                              <p style={{ fontSize: 11, color: "#666", marginTop: 4, lineHeight: 1.5 }} className="line-clamp-2">
                                {item.description}
                              </p>
                            )}
                            {tags.length > 0 && (
                              <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                                {tags.slice(0, 3).map((t) => (
                                  <span key={t} style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", background: "#2a2a2a", color: "#888", borderRadius: 3, padding: "2px 5px" }}>{t}</span>
                                ))}
                              </div>
                            )}
                          </div>
                          <span className="tc-price" style={{ fontSize: 18, fontWeight: 900, color: accent, whiteSpace: "nowrap", flexShrink: 0 }}>
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
    </div>
  );
}
