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

export function MediterraneanMenu({ restaurant, dailyMenu }: { restaurant: Restaurant; dailyMenu?: DailyMenu | null }) {
  const [active, setActive] = React.useState(restaurant.categories[0]?.id ?? "");
  const refs = React.useRef<Record<string, HTMLElement>>({});
  const accent = restaurant.primaryColor ?? "#1a6b8a";
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
    <div style={{ minHeight: "100vh", background: "#f0f7fa", color: "#1a2a35" }}>

      {/* Hero — full-bleed gradient with wave bottom */}
      <div style={{ background: `linear-gradient(160deg, ${accent} 0%, ${blend(accent, "#0d3d52", 0.5)} 100%)`, position: "relative", overflow: "hidden" }}>
        {/* Dot pattern overlay */}
        <div style={{ position: "absolute", inset: 0, opacity: 0.08, backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "24px 24px" }} />

        <div className="max-w-2xl mx-auto px-6 py-14 text-center relative">
          {restaurant.logo ? (
            <div style={{ marginBottom: 16, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 72, height: 72, borderRadius: "50%", background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", border: "1.5px solid rgba(255,255,255,0.3)" }}>
              <img src={restaurant.logo} alt={restaurant.name} style={{ width: 52, height: 52, objectFit: "contain" }} />
            </div>
          ) : (
            <div style={{ marginBottom: 12, fontSize: 36 }}>🌊</div>
          )}
          <div style={{ fontSize: 10, letterSpacing: "0.5em", color: "rgba(255,255,255,0.6)", textTransform: "uppercase", marginBottom: 10 }}>Menu</div>
          <h1 style={{ fontSize: 44, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.02em", textShadow: "0 2px 20px rgba(0,0,0,0.2)" }}>
            {restaurant.name}
          </h1>
          {restaurant.description && (
            <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, marginTop: 10, lineHeight: 1.7, maxWidth: 380, margin: "10px auto 0" }}>
              {restaurant.description}
            </p>
          )}
        </div>

        {/* Wave */}
        <svg viewBox="0 0 1440 50" style={{ display: "block", marginTop: -2 }} preserveAspectRatio="none" height={50} fill="#f0f7fa">
          <path d="M0,25 C200,50 400,0 600,25 C800,50 1000,10 1200,28 C1320,40 1400,30 1440,25 L1440,50 L0,50 Z" />
        </svg>
      </div>

      {/* Category pills */}
      <div className="sticky top-0 z-20" style={{ background: "#f0f7fa", borderBottom: "1px solid rgba(26,107,138,0.12)", boxShadow: "0 2px 16px rgba(26,107,138,0.08)" }}>
        <div className="max-w-2xl mx-auto overflow-x-auto scrollbar-none px-4 py-3">
          <div className="flex gap-2">
            {restaurant.categories.map((cat) => (
              <button key={cat.id}
                onClick={() => { setActive(cat.id); refs.current[cat.id]?.scrollIntoView({ behavior: "smooth" }); }}
                style={{
                  padding: "7px 16px",
                  borderRadius: 100,
                  fontSize: 12,
                  fontWeight: 600,
                  background: active === cat.id ? accent : "rgba(26,107,138,0.08)",
                  color: active === cat.id ? "#fff" : accent,
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  whiteSpace: "nowrap",
                  boxShadow: active === cat.id ? `0 4px 12px ${accent}40` : "none",
                }}>
                {cat.icon && <span style={{ marginRight: 4 }}>{cat.icon}</span>}
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
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 18 }}>☀️</span>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: accent, letterSpacing: "0.1em", textTransform: "uppercase", margin: 0 }}>Today's Catch</h2>
            </div>
            <div style={{ background: `linear-gradient(135deg, ${accent}12, ${accent}06)`, borderRadius: 16, border: `1px solid ${accent}25`, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
              {dailyMenu.specials.map((s) => (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 15, color: "#1a2a35", margin: 0 }}>{s.name}</p>
                    {s.description && <p style={{ fontSize: 12, color: "#5a7a8a", marginTop: 3 }}>{s.description}</p>}
                  </div>
                  {s.price != null && <span style={{ fontWeight: 800, fontSize: 16, color: accent, whiteSpace: "nowrap" }}>{currency}{s.price.toFixed(2)}</span>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Categories */}
        {restaurant.categories.map((cat) => {
          const items = cat.items.filter((i) => i.isAvailable !== false);
          const withImages = items.some((i) => i.image);

          return (
            <section key={cat.id} id={cat.id} ref={(el) => { if (el) refs.current[cat.id] = el; }} style={{ marginBottom: 40 }}>
              {/* Category header */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                {cat.icon && <span style={{ fontSize: 22 }}>{cat.icon}</span>}
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 800, color: "#1a2a35", margin: 0 }}>{cat.name}</h2>
                  {cat.description && <p style={{ fontSize: 12, color: "#5a7a8a", marginTop: 2 }}>{cat.description}</p>}
                </div>
                <div style={{ flex: 1, height: 2, background: `linear-gradient(to right, ${accent}30, transparent)`, marginLeft: 6 }} />
              </div>

              {/* Items — card grid if images, list if not */}
              {withImages ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {items.map((item) => {
                    const tags = parseTags(item.tags);
                    return (
                      <div key={item.id} style={{ background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 12px rgba(26,107,138,0.1)", border: "1px solid rgba(26,107,138,0.08)" }}>
                        {item.image ? (
                          <div style={{ height: 130, overflow: "hidden" }}>
                            <img src={item.image} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          </div>
                        ) : (
                          <div style={{ height: 80, background: `linear-gradient(135deg, ${accent}15, ${accent}08)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>
                            🍽️
                          </div>
                        )}
                        <div style={{ padding: "12px 14px 14px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 4 }}>
                            <h3 style={{ fontSize: 13, fontWeight: 700, color: "#1a2a35", margin: 0, lineHeight: 1.3, flex: 1 }}>
                              {item.name}
                              {item.isFeatured && <span style={{ marginLeft: 4, color: accent }}>★</span>}
                            </h3>
                            <span style={{ fontSize: 14, fontWeight: 800, color: accent, whiteSpace: "nowrap" }}>{currency}{item.price.toFixed(2)}</span>
                          </div>
                          {item.description && (
                            <p style={{ fontSize: 11, color: "#6a8a9a", marginTop: 4, lineHeight: 1.5 }} className="line-clamp-2">
                              {item.description}
                            </p>
                          )}
                          {tags.length > 0 && (
                            <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                              {tags.slice(0, 2).map((t) => (
                                <span key={t} style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", background: `${accent}15`, color: accent, borderRadius: 4, padding: "2px 5px" }}>{t}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {items.map((item, idx) => {
                    const tags = parseTags(item.tags);
                    return (
                      <div key={item.id} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                        gap: 12, padding: "16px 0",
                        borderBottom: idx < items.length - 1 ? "1px solid rgba(26,107,138,0.1)" : "none"
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1a2a35", margin: 0 }}>{item.name}</h3>
                            {item.isFeatured && <span style={{ color: accent, fontSize: 12 }}>★</span>}
                          </div>
                          {item.description && <p style={{ fontSize: 12, color: "#5a7a8a", marginTop: 3, lineHeight: 1.5 }}>{item.description}</p>}
                          {tags.length > 0 && (
                            <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                              {tags.slice(0, 3).map((t) => (
                                <span key={t} style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", background: `${accent}15`, color: accent, borderRadius: 4, padding: "2px 6px" }}>{t}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                          <span style={{ fontSize: 16, fontWeight: 800, color: accent }}>{currency}{item.price.toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* Footer wave */}
      <div style={{ background: `linear-gradient(to top, ${accent}20, transparent)`, padding: "20px 0 40px", textAlign: "center" }}>
        <div style={{ fontSize: 20, marginBottom: 6 }}>🌊</div>
        <div style={{ fontSize: 10, letterSpacing: "0.3em", color: accent, textTransform: "uppercase", opacity: 0.7 }}>Buon Appetito</div>
      </div>
    </div>
  );
}

/** Blend two hex colors by weight (0 = all c1, 1 = all c2) */
function blend(c1: string, c2: string, w: number): string {
  const h = (s: string) => [parseInt(s.slice(1,3),16), parseInt(s.slice(3,5),16), parseInt(s.slice(5,7),16)];
  const [r1,g1,b1] = h(c1.padEnd(7,"0")); const [r2,g2,b2] = h(c2.padEnd(7,"0"));
  const r = Math.round(r1*(1-w)+r2*w).toString(16).padStart(2,"0");
  const g = Math.round(g1*(1-w)+g2*w).toString(16).padStart(2,"0");
  const b = Math.round(b1*(1-w)+b2*w).toString(16).padStart(2,"0");
  return `#${r}${g}${b}`;
}
