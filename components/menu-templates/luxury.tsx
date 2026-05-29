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

const GOLD_GRADIENT = "linear-gradient(135deg, #c9a84c 0%, #f0d080 40%, #b8872a 100%)";

export function LuxuryMenu({ restaurant, dailyMenu }: { restaurant: Restaurant; dailyMenu?: DailyMenu | null }) {
  const [active, setActive] = React.useState(restaurant.categories[0]?.id ?? "");
  const refs = React.useRef<Record<string, HTMLElement>>({});
  const accent = restaurant.primaryColor ?? "#c9a84c";
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
    <div style={{ minHeight: "100vh", background: "#0d0d0d", color: "#e8e0d0" }}>

      {/* Luxury header */}
      <div style={{ position: "relative", textAlign: "center", padding: "60px 24px 48px", overflow: "hidden" }}>
        {/* Gold corner accents */}
        <div style={{ position: "absolute", top: 16, left: 16, width: 40, height: 40, borderTop: `1px solid ${accent}80`, borderLeft: `1px solid ${accent}80` }} />
        <div style={{ position: "absolute", top: 16, right: 16, width: 40, height: 40, borderTop: `1px solid ${accent}80`, borderRight: `1px solid ${accent}80` }} />
        <div style={{ position: "absolute", bottom: 16, left: 16, width: 40, height: 40, borderBottom: `1px solid ${accent}80`, borderLeft: `1px solid ${accent}80` }} />
        <div style={{ position: "absolute", bottom: 16, right: 16, width: 40, height: 40, borderBottom: `1px solid ${accent}80`, borderRight: `1px solid ${accent}80` }} />

        {restaurant.logo && (
          <div style={{ display: "inline-flex", width: 80, height: 80, borderRadius: "50%", alignItems: "center", justifyContent: "center", marginBottom: 20, border: `1px solid ${accent}60`, background: "#1a1510" }}>
            <img src={restaurant.logo} alt={restaurant.name} style={{ width: 60, height: 60, objectFit: "contain" }} />
          </div>
        )}

        {/* Gold rule above */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 18 }}>
          <div style={{ height: 1, width: 50, background: GOLD_GRADIENT }} />
          <span style={{ background: GOLD_GRADIENT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontSize: 10, letterSpacing: "0.6em", textTransform: "uppercase", fontWeight: 700 }}>
            Tasting Menu
          </span>
          <div style={{ height: 1, width: 50, background: GOLD_GRADIENT }} />
        </div>

        <h1 style={{
          fontSize: 48, fontWeight: 300, letterSpacing: "0.12em", textTransform: "uppercase",
          margin: 0, lineHeight: 1, color: "#f5ede0",
          fontFamily: "'Georgia', 'Times New Roman', serif",
        }}>
          {restaurant.name}
        </h1>

        {restaurant.description && (
          <p style={{ color: "#6a5e4e", fontSize: 12, marginTop: 14, lineHeight: 1.8, maxWidth: 340, margin: "14px auto 0", fontStyle: "italic", fontFamily: "Georgia, serif" }}>
            {restaurant.description}
          </p>
        )}

        {/* Gold rule below */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 24 }}>
          <div style={{ height: 1, width: 30, background: GOLD_GRADIENT }} />
          <span style={{ background: GOLD_GRADIENT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontSize: 16 }}>◆</span>
          <div style={{ height: 1, width: 30, background: GOLD_GRADIENT }} />
        </div>
      </div>

      {/* Category nav */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: "#0d0d0d", borderBottom: "1px solid #1f1a10" }}>
        <div className="max-w-2xl mx-auto overflow-x-auto scrollbar-none">
          <div style={{ display: "flex", justifyContent: "center", gap: 0 }}>
            {restaurant.categories.map((cat) => (
              <button key={cat.id}
                onClick={() => { setActive(cat.id); refs.current[cat.id]?.scrollIntoView({ behavior: "smooth" }); }}
                style={{
                  padding: "14px 20px",
                  fontSize: 10, fontWeight: 600,
                  letterSpacing: "0.3em", textTransform: "uppercase",
                  fontFamily: "Georgia, serif",
                  background: GOLD_GRADIENT,
                  WebkitBackgroundClip: active === cat.id ? "text" : undefined,
                  WebkitTextFillColor: active === cat.id ? "transparent" : undefined,
                  color: active === cat.id ? "transparent" : "#4a3d2a",
                  borderBottom: active === cat.id ? `1px solid ${accent}` : "1px solid transparent",
                  cursor: "pointer", border: "none", transition: "all 0.2s", whiteSpace: "nowrap",
                }}>
                {cat.icon && <span style={{ marginRight: 5 }}>{cat.icon}</span>}
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-12 pb-32">

        {/* Daily specials */}
        {dailyMenu?.specials && dailyMenu.specials.length > 0 && (
          <section style={{ marginBottom: 52 }}>
            <LuxurySectionHeader label="Chef's Signatures" accent={accent} />
            <div style={{ border: `1px solid ${accent}30`, borderRadius: 4, overflow: "hidden", marginTop: 24 }}>
              {dailyMenu.specials.map((s, idx) => (
                <div key={s.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16,
                  padding: "18px 24px",
                  background: idx % 2 === 0 ? "#131108" : "#0f0d07",
                  borderBottom: idx < (dailyMenu.specials?.length ?? 0) - 1 ? `1px solid ${accent}15` : "none"
                }}>
                  <div>
                    <p style={{ fontFamily: "Georgia, serif", fontSize: 15, fontWeight: 400, color: "#e8dcc8", margin: 0 }}>{s.name}</p>
                    {s.description && <p style={{ fontSize: 11, color: "#6a5e4e", marginTop: 4, fontStyle: "italic" }}>{s.description}</p>}
                  </div>
                  {s.price != null && (
                    <span style={{ background: GOLD_GRADIENT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontSize: 18, fontWeight: 700, whiteSpace: "nowrap" }}>
                      {currency}{s.price.toFixed(2)}
                    </span>
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
            <section key={cat.id} id={cat.id} ref={(el) => { if (el) refs.current[cat.id] = el; }} style={{ marginBottom: 56 }}>
              <LuxurySectionHeader label={cat.name} accent={accent} icon={cat.icon ?? undefined} sub={cat.description ?? undefined} />

              <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 0 }}>
                {items.map((item, idx) => {
                  const tags = parseTags(item.tags);
                  const isLast = idx === items.length - 1;
                  return (
                    <div key={item.id} style={{
                      display: "flex", gap: 18, padding: "22px 0",
                      borderBottom: isLast ? "none" : `1px solid #1f1a10`
                    }}>
                      {item.image && (
                        <div style={{ flexShrink: 0, width: 90, height: 90, overflow: "hidden", borderRadius: 4, border: `1px solid ${accent}25` }}>
                          <img src={item.image} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.9 }} />
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <h3 style={{ fontFamily: "Georgia, serif", fontSize: 16, fontWeight: 400, color: "#e8dcc8", margin: 0, letterSpacing: "0.02em" }}>
                                {item.name}
                              </h3>
                              {item.isFeatured && (
                                <span style={{ background: GOLD_GRADIENT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontSize: 14 }}>◆</span>
                              )}
                            </div>
                            {item.description && (
                              <p style={{ fontSize: 12, color: "#5a4e3e", marginTop: 6, lineHeight: 1.7, fontStyle: "italic", fontFamily: "Georgia, serif" }} className="line-clamp-2">
                                {item.description}
                              </p>
                            )}
                            {tags.length > 0 && (
                              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                                {tags.slice(0, 4).map((t) => (
                                  <span key={t} style={{ fontSize: 9, letterSpacing: "0.25em", textTransform: "uppercase", border: `1px solid ${accent}35`, color: `${accent}aa`, borderRadius: 2, padding: "2px 6px" }}>{t}</span>
                                ))}
                              </div>
                            )}
                          </div>
                          <span style={{ background: GOLD_GRADIENT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontSize: 19, fontWeight: 700, flexShrink: 0 }}>
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

        {/* Footer */}
        <div style={{ textAlign: "center", paddingTop: 32 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <div style={{ height: 1, width: 60, background: GOLD_GRADIENT }} />
            <span style={{ background: GOLD_GRADIENT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontSize: 18 }}>✦</span>
            <div style={{ height: 1, width: 60, background: GOLD_GRADIENT }} />
          </div>
          <p style={{ fontSize: 10, letterSpacing: "0.4em", color: "#3a3020", textTransform: "uppercase", marginTop: 14 }}>
            Merci
          </p>
        </div>
      </div>
    </div>
  );
}

function LuxurySectionHeader({ label, accent, icon, sub }: { label: string; accent: string; icon?: string; sub?: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      {icon && <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ flex: 1, height: 1, background: `linear-gradient(to right, transparent, ${accent}40)` }} />
        <h2 style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: 11, letterSpacing: "0.45em", textTransform: "uppercase", fontWeight: 400,
          background: "linear-gradient(135deg, #c9a84c 0%, #f0d080 50%, #b8872a 100%)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          margin: 0
        }}>{label}</h2>
        <div style={{ flex: 1, height: 1, background: `linear-gradient(to left, transparent, ${accent}40)` }} />
      </div>
      {sub && <p style={{ fontSize: 11, color: "#5a4e3e", marginTop: 5, fontStyle: "italic", fontFamily: "Georgia, serif" }}>{sub}</p>}
    </div>
  );
}
