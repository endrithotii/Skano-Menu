"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Save, RefreshCw, ExternalLink, ChevronDown, ChevronRight, Palette, Type, LayoutGrid, Eye, Smartphone, Check } from "lucide-react";
import toast from "react-hot-toast";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ThemeConfig {
  font: string;
  primaryColor: string;
  bgColor: string;
  cardBg: string;
  textColor: string;
  cardStyle: "shadow" | "border" | "flat" | "glass";
  borderRadius: "sharp" | "rounded" | "pill";
  spacing: "compact" | "normal" | "relaxed";
  cardLayout: "vertical" | "horizontal" | "minimal" | "bold";
  showImages: boolean;
  showDescriptions: boolean;
  showAllergens: boolean;
  showTags: boolean;
  showPrepTime: boolean;
  showBadges: boolean;
  showPrices: boolean;
  showRatings: boolean;
  headerStyle: "gradient" | "solid" | "minimal" | "image";
}

export const DEFAULT_THEME: ThemeConfig = {
  font: "inter",
  primaryColor: "#f97316",
  bgColor: "#f9fafb",
  cardBg: "#ffffff",
  textColor: "#111827",
  cardStyle: "shadow",
  borderRadius: "rounded",
  spacing: "normal",
  cardLayout: "vertical",
  showImages: true,
  showDescriptions: true,
  showAllergens: true,
  showTags: true,
  showPrepTime: true,
  showBadges: true,
  showPrices: true,
  showRatings: true,
  headerStyle: "gradient",
};

// ─── Data ───────────────────────────────────────────────────────────────────────

const TEMPLATES = [
  { id: "modern",        name: "Modern",        color: "#f97316", accent: "#fbbf24", dark: false },
  { id: "elegant",       name: "Elegant",       color: "#7c3aed", accent: "#c4b5fd", dark: false },
  { id: "classic",       name: "Classic",       color: "#92400e", accent: "#d97706", dark: false },
  { id: "minimal",       name: "Minimal",       color: "#374151", accent: "#9ca3af", dark: false },
  { id: "grid",          name: "Grid",          color: "#0891b2", accent: "#67e8f9", dark: false },
  { id: "vibrant",       name: "Vibrant",       color: "#db2777", accent: "#f472b6", dark: false },
  { id: "dark",          name: "Dark",          color: "#111827", accent: "#6b7280", dark: true  },
  { id: "neon",          name: "Neon",          color: "#10b981", accent: "#34d399", dark: true  },
  { id: "magazine",      name: "Magazine",      color: "#1e293b", accent: "#94a3b8", dark: false },
  { id: "flipbook",      name: "Flipbook",      color: "#f59e0b", accent: "#fcd34d", dark: false },
  { id: "tokyo",         name: "Tokyo",         color: "#ef4444", accent: "#fca5a5", dark: true  },
  { id: "brasserie",     name: "Brasserie",     color: "#c9a84c", accent: "#e8d5a0", dark: true  },
  { id: "mediterranean", name: "Mediterranean", color: "#2563eb", accent: "#93c5fd", dark: false },
  { id: "street",        name: "Street Food",   color: "#78716c", accent: "#d6d3d1", dark: true  },
  { id: "luxury",        name: "Luxury",        color: "#1c1c1c", accent: "#c9a84c", dark: true  },
];

const FONTS = [
  { id: "inter",       name: "Inter",            css: "Inter, system-ui, sans-serif",                  style: "Modern & Clean" },
  { id: "playfair",    name: "Playfair Display",  css: "'Playfair Display', Georgia, serif",            style: "Elegant & Classic" },
  { id: "poppins",     name: "Poppins",           css: "Poppins, sans-serif",                           style: "Friendly & Bold" },
  { id: "lora",        name: "Lora",              css: "Lora, Georgia, serif",                          style: "Literary & Warm" },
  { id: "montserrat",  name: "Montserrat",        css: "Montserrat, sans-serif",                        style: "Geometric & Strong" },
  { id: "raleway",     name: "Raleway",           css: "Raleway, sans-serif",                           style: "Stylish & Light" },
];

const CARD_LAYOUTS = [
  { id: "vertical",   name: "Image Top",    desc: "Photo on top, details below" },
  { id: "horizontal", name: "Side by Side", desc: "Photo left, text right" },
  { id: "minimal",    name: "Text Only",    desc: "Clean list without images" },
  { id: "bold",       name: "Bold Card",    desc: "Large image, overlay text" },
];

const CARD_STYLES = [
  { id: "shadow", name: "Shadow",  desc: "Soft drop shadow" },
  { id: "border", name: "Border",  desc: "Thin outline" },
  { id: "flat",   name: "Flat",    desc: "No decoration" },
  { id: "glass",  name: "Glass",   desc: "Frosted glass" },
];

const RADII = [
  { id: "sharp",   name: "Sharp",   class: "rounded-none" },
  { id: "rounded", name: "Rounded", class: "rounded-xl" },
  { id: "pill",    name: "Pill",    class: "rounded-full" },
];

const SPACINGS = [
  { id: "compact",  name: "Compact",  desc: "More items visible" },
  { id: "normal",   name: "Normal",   desc: "Balanced spacing" },
  { id: "relaxed",  name: "Relaxed",  desc: "Generous whitespace" },
];

const HEADER_STYLES = [
  { id: "gradient", name: "Gradient" },
  { id: "solid",    name: "Solid" },
  { id: "minimal",  name: "Minimal" },
  { id: "image",    name: "Cover Photo" },
];

const ELEMENTS = [
  { key: "showImages",       label: "Item photos",       desc: "Product images on cards" },
  { key: "showDescriptions", label: "Descriptions",      desc: "Item description text" },
  { key: "showPrices",       label: "Prices",            desc: "Price labels" },
  { key: "showTags",         label: "Tags",              desc: "Vegan, Spicy, etc." },
  { key: "showAllergens",    label: "Allergens",         desc: "Gluten, Dairy, etc." },
  { key: "showPrepTime",     label: "Prep time",         desc: "Cooking time indicator" },
  { key: "showBadges",       label: "Badges",            desc: "New, Popular, Featured" },
  { key: "showRatings",      label: "Ratings",           desc: "Customer rating stars" },
] as const;

// ─── Helpers ────────────────────────────────────────────────────────────────────

function getFontCss(id: string) {
  return FONTS.find((f) => f.id === id)?.css ?? FONTS[0].css;
}

// ─── Color picker ───────────────────────────────────────────────────────────────

function ColorSwatch({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  const id = `cp-${label.replace(/\s/g, "-")}`;
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-600">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono text-gray-400 w-16 text-right">{value}</span>
        <label
          htmlFor={id}
          className="w-7 h-7 rounded-lg cursor-pointer border-2 border-white shadow-md ring-1 ring-gray-200 hover:scale-110 transition-transform"
          style={{ backgroundColor: value }}
        />
        <input id={id} type="color" value={value} onChange={(e) => onChange(e.target.value)} className="sr-only" />
      </div>
    </div>
  );
}

// ─── Section wrapper ────────────────────────────────────────────────────────────

function Section({
  icon, title, children, defaultOpen = true,
}: { icon: React.ReactNode; title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          {icon}{title}
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
}

// ─── Toggle switch ──────────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors duration-200 ${value ? "bg-orange-500" : "bg-gray-200"}`}
    >
      <span className={`inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white shadow transition-transform duration-200 ${value ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────────

export default function CustomizePage() {
  const [restaurantId, setRestaurantId] = useState("");
  const [slug, setSlug] = useState("");
  const [templateId, setTemplateId] = useState("modern");
  const [theme, setTheme] = useState<ThemeConfig>(DEFAULT_THEME);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [previewKey, setPreviewKey] = useState(0);
  const [isMobilePreview, setIsMobilePreview] = useState(true);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");

  // Load restaurant data
  useEffect(() => {
    async function init() {
      try {
        const statsRes = await fetch("/api/dashboard/stats");
        const stats = await statsRes.json();
        const res = await fetch(`/api/restaurants/${stats.restaurantId}`);
        if (!res.ok) return;
        const { restaurant: r } = await res.json();
        setRestaurantId(r.id);
        setSlug(r.slug);
        setTemplateId(r.templateId || "modern");
        let saved: Partial<ThemeConfig> = {};
        try { saved = JSON.parse(r.themeConfig || "{}"); } catch { /* */ }
        setTheme({ ...DEFAULT_THEME, primaryColor: r.primaryColor || "#f97316", ...saved });
      } catch (e) { console.error(e); }
      setLoading(false);
    }
    init();
  }, []);

  // Build preview URL (debounced)
  const buildPreviewUrl = useCallback((slug: string, tid: string, tc: ThemeConfig) => {
    const encoded = btoa(JSON.stringify({ ...tc, templateId: tid }));
    return `/r/${slug}?pv=${encoded}`;
  }, []);

  useEffect(() => {
    if (!slug) return;
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => {
      setPreviewUrl(buildPreviewUrl(slug, templateId, theme));
      setPreviewKey((k) => k + 1);
    }, 600);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, templateId, slug]);

  function updateTheme(patch: Partial<ThemeConfig>) {
    setTheme((t) => ({ ...t, ...patch }));
  }

  async function handleSave() {
    if (!restaurantId) return;
    setSaving(true);
    const res = await fetch(`/api/restaurants/${restaurantId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateId,
        primaryColor: theme.primaryColor,
        themeConfig: JSON.stringify(theme),
      }),
    });
    setSaving(false);
    if (res.ok) toast.success("Theme saved!");
    else toast.error("Failed to save");
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" />
    </div>
  );

  const fontCss = getFontCss(theme.font);

  return (
    <div className="flex h-full overflow-hidden bg-gray-50">

      {/* Load Google Fonts */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Poppins:wght@400;500;600;700&family=Lora:wght@400;600;700&family=Montserrat:wght@400;500;600;700&family=Raleway:wght@400;500;600;700&display=swap');`}</style>

      {/* ── Left panel ── */}
      <div className="w-80 xl:w-96 flex-shrink-0 bg-white border-r border-gray-100 flex flex-col overflow-hidden">

        {/* Panel header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white sticky top-0 z-10">
          <div>
            <h1 className="text-sm font-bold text-gray-900">Menu Customizer</h1>
            <p className="text-[10px] text-gray-400 mt-0.5">Changes preview live on the right</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60 shadow-sm"
          >
            {saving ? <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

        {/* Scrollable sections */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Template ── */}
          <Section icon={<LayoutGrid className="w-4 h-4 text-orange-500" />} title="Template">
            <div className="grid grid-cols-3 gap-2">
              {TEMPLATES.map((t) => {
                const active = templateId === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTemplateId(t.id)}
                    className={`relative flex flex-col items-center rounded-xl overflow-hidden border-2 transition-all ${active ? "border-orange-500 shadow-md" : "border-gray-100 hover:border-gray-300"}`}
                  >
                    {/* Template color swatch */}
                    <div
                      className="w-full h-12 flex items-end justify-end p-1.5"
                      style={{ background: `linear-gradient(135deg, ${t.color}, ${t.accent})` }}
                    >
                      {active && (
                        <span className="w-4 h-4 bg-white rounded-full flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-orange-500" />
                        </span>
                      )}
                    </div>
                    {/* Template name */}
                    <div className={`w-full px-1.5 py-1.5 text-center ${active ? "bg-orange-50" : "bg-gray-50"}`}>
                      <p className={`text-[10px] font-semibold leading-tight truncate ${active ? "text-orange-600" : "text-gray-600"}`}>{t.name}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* ── Colors ── */}
          <Section icon={<Palette className="w-4 h-4 text-orange-500" />} title="Colors">
            <div className="space-y-2.5">
              <ColorSwatch label="Primary / Accent" value={theme.primaryColor} onChange={(v) => updateTheme({ primaryColor: v })} />
              <ColorSwatch label="Page background" value={theme.bgColor} onChange={(v) => updateTheme({ bgColor: v })} />
              <ColorSwatch label="Card background" value={theme.cardBg} onChange={(v) => updateTheme({ cardBg: v })} />
              <ColorSwatch label="Text color" value={theme.textColor} onChange={(v) => updateTheme({ textColor: v })} />
            </div>

            {/* Quick palettes */}
            <div className="mt-3">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Quick palettes</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { name: "Default",    p: "#f97316", bg: "#f9fafb", card: "#ffffff", text: "#111827" },
                  { name: "Slate",      p: "#3b82f6", bg: "#f1f5f9", card: "#ffffff", text: "#0f172a" },
                  { name: "Rose",       p: "#e11d48", bg: "#fff1f2", card: "#ffffff", text: "#1c0a0d" },
                  { name: "Emerald",    p: "#059669", bg: "#f0fdf4", card: "#ffffff", text: "#052e16" },
                  { name: "Midnight",   p: "#6366f1", bg: "#0f172a", card: "#1e293b", text: "#f1f5f9" },
                  { name: "Warm Sand",  p: "#c9a84c", bg: "#faf6ef", card: "#ffffff", text: "#1c1208" },
                  { name: "Charcoal",   p: "#ef4444", bg: "#1a1a1a", card: "#2a2a2a", text: "#f5f5f5" },
                  { name: "Sky",        p: "#0ea5e9", bg: "#f0f9ff", card: "#ffffff", text: "#0c4a6e" },
                ].map((pal) => (
                  <button
                    key={pal.name}
                    type="button"
                    onClick={() => updateTheme({ primaryColor: pal.p, bgColor: pal.bg, cardBg: pal.card, textColor: pal.text })}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-100 hover:border-gray-300 bg-white transition-colors text-[10px] font-medium text-gray-600 hover:text-gray-900"
                  >
                    <span className="flex gap-0.5">
                      {[pal.p, pal.bg, pal.card].map((c, i) => (
                        <span key={i} className="w-3 h-3 rounded-sm" style={{ backgroundColor: c }} />
                      ))}
                    </span>
                    {pal.name}
                  </button>
                ))}
              </div>
            </div>
          </Section>

          {/* ── Typography ── */}
          <Section icon={<Type className="w-4 h-4 text-orange-500" />} title="Typography" defaultOpen={false}>
            <div className="space-y-2">
              {FONTS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => updateTheme({ font: f.id })}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border-2 transition-all text-left ${theme.font === f.id ? "border-orange-500 bg-orange-50" : "border-gray-100 hover:border-gray-200 bg-white"}`}
                >
                  <div>
                    <p className="text-sm font-bold text-gray-900" style={{ fontFamily: f.css }}>{f.name}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{f.style}</p>
                  </div>
                  <p className="text-xs text-gray-400" style={{ fontFamily: f.css }}>Aa Bb</p>
                </button>
              ))}
            </div>
          </Section>

          {/* ── Card Layout ── */}
          <Section icon={<LayoutGrid className="w-4 h-4 text-orange-500" />} title="Card Layout" defaultOpen={false}>
            <div className="grid grid-cols-2 gap-2">
              {CARD_LAYOUTS.map((cl) => (
                <button
                  key={cl.id}
                  type="button"
                  onClick={() => updateTheme({ cardLayout: cl.id as ThemeConfig["cardLayout"] })}
                  className={`flex flex-col gap-1.5 p-3 rounded-xl border-2 transition-all text-left ${theme.cardLayout === cl.id ? "border-orange-500 bg-orange-50" : "border-gray-100 hover:border-gray-200 bg-white"}`}
                >
                  {/* Mini visual preview */}
                  <div className="w-full h-10 rounded-lg overflow-hidden bg-gray-100 flex">
                    {cl.id === "vertical" && (
                      <div className="flex flex-col flex-1 gap-1 p-1.5">
                        <div className="w-full h-4 bg-gray-200 rounded" />
                        <div className="w-3/4 h-1.5 bg-gray-300 rounded" />
                        <div className="w-1/2 h-1.5 bg-orange-300 rounded" />
                      </div>
                    )}
                    {cl.id === "horizontal" && (
                      <div className="flex flex-1 gap-1 p-1.5">
                        <div className="w-6 h-full bg-gray-200 rounded flex-shrink-0" />
                        <div className="flex flex-col gap-1 flex-1 justify-center">
                          <div className="w-full h-1.5 bg-gray-300 rounded" />
                          <div className="w-2/3 h-1.5 bg-orange-300 rounded" />
                        </div>
                      </div>
                    )}
                    {cl.id === "minimal" && (
                      <div className="flex flex-1 items-center justify-between gap-1 px-2">
                        <div className="flex flex-col gap-1">
                          <div className="w-16 h-1.5 bg-gray-300 rounded" />
                          <div className="w-10 h-1 bg-gray-200 rounded" />
                        </div>
                        <div className="w-8 h-1.5 bg-orange-300 rounded" />
                      </div>
                    )}
                    {cl.id === "bold" && (
                      <div className="flex-1 bg-gray-300 rounded relative">
                        <div className="absolute bottom-1 left-1.5 right-1.5 flex justify-between items-end">
                          <div className="w-8 h-1.5 bg-white/70 rounded" />
                          <div className="w-5 h-1.5 bg-orange-400/80 rounded" />
                        </div>
                      </div>
                    )}
                  </div>
                  <p className={`text-[10px] font-semibold ${theme.cardLayout === cl.id ? "text-orange-600" : "text-gray-600"}`}>{cl.name}</p>
                  <p className="text-[9px] text-gray-400 leading-tight">{cl.desc}</p>
                </button>
              ))}
            </div>
          </Section>

          {/* ── Card Style ── */}
          <Section icon={<Palette className="w-4 h-4 text-orange-500" />} title="Card Style & Spacing" defaultOpen={false}>
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Card frame</p>
              <div className="grid grid-cols-4 gap-1.5">
                {CARD_STYLES.map((cs) => (
                  <button
                    key={cs.id}
                    type="button"
                    onClick={() => updateTheme({ cardStyle: cs.id as ThemeConfig["cardStyle"] })}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all ${theme.cardStyle === cs.id ? "border-orange-500 bg-orange-50" : "border-gray-100 hover:border-gray-200"}`}
                  >
                    <div className={`w-8 h-5 rounded-md bg-white ${
                      cs.id === "shadow" ? "shadow-md" :
                      cs.id === "border" ? "border border-gray-300" :
                      cs.id === "glass"  ? "bg-white/60 backdrop-blur border border-white/30" : ""
                    }`} />
                    <p className={`text-[9px] font-semibold ${theme.cardStyle === cs.id ? "text-orange-600" : "text-gray-500"}`}>{cs.name}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Corner radius</p>
              <div className="flex gap-2">
                {RADII.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => updateTheme({ borderRadius: r.id as ThemeConfig["borderRadius"] })}
                    className={`flex-1 flex flex-col items-center gap-1.5 py-2 rounded-xl border-2 transition-all ${theme.borderRadius === r.id ? "border-orange-500 bg-orange-50" : "border-gray-100 hover:border-gray-200"}`}
                  >
                    <div className={`w-8 h-5 bg-gray-200 ${r.class}`} />
                    <p className={`text-[9px] font-semibold ${theme.borderRadius === r.id ? "text-orange-600" : "text-gray-500"}`}>{r.name}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Spacing density</p>
              <div className="flex gap-2">
                {SPACINGS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => updateTheme({ spacing: s.id as ThemeConfig["spacing"] })}
                    className={`flex-1 py-2 px-1 rounded-xl border-2 text-center transition-all ${theme.spacing === s.id ? "border-orange-500 bg-orange-50" : "border-gray-100 hover:border-gray-200"}`}
                  >
                    <p className={`text-[9px] font-semibold ${theme.spacing === s.id ? "text-orange-600" : "text-gray-500"}`}>{s.name}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Header style</p>
              <div className="grid grid-cols-4 gap-1.5">
                {HEADER_STYLES.map((hs) => (
                  <button
                    key={hs.id}
                    type="button"
                    onClick={() => updateTheme({ headerStyle: hs.id as ThemeConfig["headerStyle"] })}
                    className={`py-2 rounded-xl border-2 text-center transition-all ${theme.headerStyle === hs.id ? "border-orange-500 bg-orange-50" : "border-gray-100 hover:border-gray-200"}`}
                  >
                    <p className={`text-[9px] font-semibold ${theme.headerStyle === hs.id ? "text-orange-600" : "text-gray-500"}`}>{hs.name}</p>
                  </button>
                ))}
              </div>
            </div>
          </Section>

          {/* ── Elements ── */}
          <Section icon={<Eye className="w-4 h-4 text-orange-500" />} title="Show / Hide Elements" defaultOpen={false}>
            <div className="space-y-1">
              {ELEMENTS.map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-xs font-medium text-gray-800">{label}</p>
                    <p className="text-[10px] text-gray-400">{desc}</p>
                  </div>
                  <Toggle
                    value={theme[key] as boolean}
                    onChange={(v) => updateTheme({ [key]: v })}
                  />
                </div>
              ))}
            </div>
          </Section>

        </div>
      </div>

      {/* ── Right: Preview ── */}
      <div className="flex-1 flex flex-col bg-gray-100 overflow-hidden">

        {/* Preview header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-medium text-gray-500">Live Preview</span>
            <span className="text-[10px] text-gray-300">· updates in ~0.6s</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMobilePreview((v) => !v)}
              className="text-[10px] px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
            >
              {isMobilePreview ? "Widescreen" : "Mobile"}
            </button>
            <button
              onClick={() => { setPreviewUrl(buildPreviewUrl(slug, templateId, theme)); setPreviewKey((k) => k + 1); }}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              title="Refresh preview"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            {slug && (
              <a
                href={`/r/${slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
              >
                <ExternalLink className="w-3 h-3" /> Open live
              </a>
            )}
          </div>
        </div>

        {/* Phone/widescreen frame */}
        <div className="flex-1 overflow-hidden flex items-center justify-center p-6">
          {previewUrl ? (
            isMobilePreview ? (
              /* Phone frame */
              <div className="relative h-full max-h-[780px] flex items-center">
                <div className="relative bg-gray-900 rounded-[44px] p-3 shadow-2xl"
                  style={{ width: "390px", aspectRatio: "390/844" }}>
                  {/* Notch */}
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-5 bg-gray-900 rounded-full z-10" />
                  {/* Screen */}
                  <div className="w-full h-full bg-white rounded-[32px] overflow-hidden relative">
                    <iframe
                      key={previewKey}
                      src={previewUrl}
                      className="w-full h-full border-0"
                      title="Menu preview"
                    />
                  </div>
                  {/* Home bar */}
                  <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-28 h-1 bg-gray-600 rounded-full" />
                </div>
              </div>
            ) : (
              /* Widescreen */
              <div className="w-full h-full rounded-2xl overflow-hidden shadow-2xl border border-gray-200 bg-white">
                <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 border-b">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  <div className="flex-1 mx-4 px-3 py-1 bg-white rounded text-[10px] text-gray-400 font-mono truncate">
                    {previewUrl}
                  </div>
                </div>
                <iframe
                  key={previewKey + 1000}
                  src={previewUrl}
                  className="w-full border-0"
                  style={{ height: "calc(100% - 36px)" }}
                  title="Menu preview widescreen"
                />
              </div>
            )
          ) : (
            <div className="text-center text-gray-400">
              <div className="animate-spin w-8 h-8 border-2 border-orange-200 border-t-orange-500 rounded-full mx-auto mb-3" />
              <p className="text-sm">Loading preview…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
