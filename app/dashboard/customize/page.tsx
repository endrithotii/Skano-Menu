"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Save, RefreshCw, ExternalLink, ChevronDown, ChevronRight,
  Palette, Type, LayoutGrid, Eye, Smartphone, Check,
  Sparkles, Layers, Settings2, Image, Zap, DollarSign,
} from "lucide-react";
import toast from "react-hot-toast";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ThemeConfig {
  // template
  templateId?: string;
  // colors
  primaryColor: string;
  bgColor: string;
  cardBg: string;
  textColor: string;
  accentColor: string;
  // background
  bgType: "solid" | "gradient" | "pattern";
  bgGradientTo: string;
  bgPattern: "none" | "dots" | "grid" | "lines";
  // typography
  font: string;
  fontSize: "sm" | "base" | "lg" | "xl";
  fontWeight: "normal" | "medium" | "bold";
  // cards
  cardStyle: "shadow" | "border" | "flat" | "glass";
  borderRadius: "sharp" | "rounded" | "pill";
  cardLayout: "vertical" | "horizontal" | "minimal" | "bold";
  imageRatio: "square" | "landscape" | "portrait";
  imageSize: "sm" | "md" | "lg";
  // layout
  spacing: "compact" | "normal" | "relaxed";
  headerStyle: "gradient" | "solid" | "minimal" | "image";
  headerHeight: "compact" | "normal" | "tall";
  // price
  priceStyle: "normal" | "badge" | "large";
  // animation
  animationLevel: "none" | "subtle" | "playful";
  // elements
  showImages: boolean;
  showDescriptions: boolean;
  showAllergens: boolean;
  showTags: boolean;
  showPrepTime: boolean;
  showBadges: boolean;
  showPrices: boolean;
  showRatings: boolean;
  showWaiterButton: boolean;
  showFeedbackButton: boolean;
  showSocialLinks: boolean;
  showOpenStatus: boolean;
}

const DEFAULT_THEME: ThemeConfig = {
  primaryColor: "#f97316",
  bgColor: "#f9fafb",
  cardBg: "#ffffff",
  textColor: "#111827",
  accentColor: "#f97316",
  bgType: "solid",
  bgGradientTo: "#fef3c7",
  bgPattern: "none",
  font: "inter",
  fontSize: "base",
  fontWeight: "normal",
  cardStyle: "shadow",
  borderRadius: "rounded",
  cardLayout: "vertical",
  imageRatio: "landscape",
  imageSize: "md",
  spacing: "normal",
  headerStyle: "gradient",
  headerHeight: "normal",
  priceStyle: "normal",
  animationLevel: "subtle",
  showImages: true,
  showDescriptions: true,
  showAllergens: true,
  showTags: true,
  showPrepTime: true,
  showBadges: true,
  showPrices: true,
  showRatings: true,
  showWaiterButton: true,
  showFeedbackButton: true,
  showSocialLinks: true,
  showOpenStatus: true,
};

// ─── Template data ──────────────────────────────────────────────────────────────

const TEMPLATES = [
  { id: "modern",        name: "Modern",        gradient: ["#f97316","#fbbf24"] },
  { id: "elegant",       name: "Elegant",       gradient: ["#7c3aed","#c4b5fd"] },
  { id: "classic",       name: "Classic",       gradient: ["#92400e","#d97706"] },
  { id: "minimal",       name: "Minimal",       gradient: ["#374151","#9ca3af"] },
  { id: "grid",          name: "Grid",          gradient: ["#0891b2","#67e8f9"] },
  { id: "vibrant",       name: "Vibrant",       gradient: ["#db2777","#f472b6"] },
  { id: "dark",          name: "Dark",          gradient: ["#111827","#374151"] },
  { id: "neon",          name: "Neon",          gradient: ["#064e3b","#10b981"] },
  { id: "magazine",      name: "Magazine",      gradient: ["#1e293b","#64748b"] },
  { id: "flipbook",      name: "Flipbook",      gradient: ["#92400e","#f59e0b"] },
  { id: "tokyo",         name: "Tokyo",         gradient: ["#7f1d1d","#ef4444"] },
  { id: "brasserie",     name: "Brasserie",     gradient: ["#1c1208","#c9a84c"] },
  { id: "mediterranean", name: "Mediter.",      gradient: ["#1e3a5f","#2563eb"] },
  { id: "street",        name: "Street Food",   gradient: ["#292524","#78716c"] },
  { id: "luxury",        name: "Luxury",        gradient: ["#0c0c0c","#c9a84c"] },
];

// ─── Font data ──────────────────────────────────────────────────────────────────

const FONTS = [
  { id: "inter",      name: "Inter",           css: "Inter, system-ui, sans-serif",            tag: "Modern" },
  { id: "playfair",   name: "Playfair Display", css: "'Playfair Display', Georgia, serif",      tag: "Classic" },
  { id: "poppins",    name: "Poppins",          css: "Poppins, sans-serif",                     tag: "Friendly" },
  { id: "lora",       name: "Lora",             css: "Lora, Georgia, serif",                    tag: "Literary" },
  { id: "montserrat", name: "Montserrat",       css: "Montserrat, sans-serif",                  tag: "Strong" },
  { id: "raleway",    name: "Raleway",          css: "Raleway, sans-serif",                     tag: "Elegant" },
];

// ─── Palettes ──────────────────────────────────────────────────────────────────

const PALETTES = [
  { name: "Default",     primary: "#f97316", bg: "#f9fafb", card: "#ffffff", text: "#111827", accent: "#f97316" },
  { name: "Ocean",       primary: "#0ea5e9", bg: "#f0f9ff", card: "#ffffff", text: "#0c4a6e", accent: "#06b6d4" },
  { name: "Rose",        primary: "#e11d48", bg: "#fff1f2", card: "#ffffff", text: "#1c0a0d", accent: "#fb7185" },
  { name: "Emerald",     primary: "#059669", bg: "#f0fdf4", card: "#ffffff", text: "#052e16", accent: "#34d399" },
  { name: "Midnight",    primary: "#818cf8", bg: "#0f172a", card: "#1e293b", text: "#f1f5f9", accent: "#a5b4fc" },
  { name: "Warm Sand",   primary: "#c9a84c", bg: "#faf6ef", card: "#fffdf7", text: "#1c1208", accent: "#e8d5a0" },
  { name: "Charcoal",    primary: "#ef4444", bg: "#1a1a1a", card: "#2a2a2a", text: "#f5f5f5", accent: "#fca5a5" },
  { name: "Lavender",    primary: "#7c3aed", bg: "#faf5ff", card: "#ffffff", text: "#2e1065", accent: "#c4b5fd" },
  { name: "Forest",      primary: "#15803d", bg: "#f0fdf4", card: "#ffffff", text: "#052e16", accent: "#86efac" },
  { name: "Slate",       primary: "#3b82f6", bg: "#f1f5f9", card: "#ffffff", text: "#0f172a", accent: "#93c5fd" },
  { name: "Sepia",       primary: "#b45309", bg: "#fdf8f0", card: "#fffbf5", text: "#1c0a00", accent: "#d97706" },
  { name: "Ink",         primary: "#6366f1", bg: "#18181b", card: "#27272a", text: "#fafafa", accent: "#a5b4fc" },
];

// ─── Sub-components ─────────────────────────────────────────────────────────────

function ColorSwatch({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = `cp-${label}`;
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-gray-600 flex-1">{label}</span>
      <span className="text-[10px] font-mono text-gray-400 w-14 text-right">{value}</span>
      <label htmlFor={id} className="w-7 h-7 rounded-lg cursor-pointer border-2 border-white shadow-md ring-1 ring-gray-200 hover:scale-110 transition-transform flex-shrink-0" style={{ backgroundColor: value }} />
      <input id={id} type="color" value={value} onChange={(e) => onChange(e.target.value)} className="sr-only" />
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors ${value ? "bg-orange-500" : "bg-gray-200"}`}>
      <span className={`inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white shadow transition-transform ${value ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}

function Section({ icon, title, children, defaultOpen = true }: { icon: React.ReactNode; title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">{icon}{title}</div>
        {open ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
}

function OptionRow({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-800">{label}</p>
        {desc && <p className="text-[10px] text-gray-400 mt-0.5">{desc}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function SegmentedControl<T extends string>({ options, value, onChange }: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
      {options.map(o => (
        <button key={o.id} type="button" onClick={() => onChange(o.id)}
          className={`flex-1 py-1 px-1.5 rounded-md text-[10px] font-semibold transition-all ${value === o.id ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
          {o.label}
        </button>
      ))}
    </div>
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
  const [mobilePreview, setMobilePreview] = useState(true);
  const [previewUrl, setPreviewUrl] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const s = await fetch("/api/dashboard/stats").then(r => r.json());
        const { restaurant: r } = await fetch(`/api/restaurants/${s.restaurantId}`).then(r => r.json());
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

  const buildUrl = useCallback((slug: string, tid: string, tc: ThemeConfig) => {
    return `/r/${slug}?pv=${btoa(JSON.stringify({ ...tc, templateId: tid }))}`;
  }, []);

  useEffect(() => {
    if (!slug) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPreviewUrl(buildUrl(slug, templateId, theme));
      setPreviewKey(k => k + 1);
    }, 700);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, templateId, slug]);

  function set(patch: Partial<ThemeConfig>) { setTheme(t => ({ ...t, ...patch })); }

  async function handleSave() {
    if (!restaurantId) return;
    setSaving(true);
    const res = await fetch(`/api/restaurants/${restaurantId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId, primaryColor: theme.primaryColor, themeConfig: JSON.stringify(theme) }),
    });
    setSaving(false);
    if (res.ok) toast.success("Theme saved! ✨");
    else toast.error("Failed to save");
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="flex h-full overflow-hidden bg-gray-50">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Poppins:wght@400;500;600;700&family=Lora:wght@400;600;700&family=Montserrat:wght@400;500;600;700&family=Raleway:wght@400;500;600;700&display=swap');`}</style>

      {/* ── Controls panel ── */}
      <div className="w-80 xl:w-96 flex-shrink-0 bg-white border-r border-gray-100 flex flex-col overflow-hidden shadow-sm">

        {/* Sticky header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white z-10">
          <div>
            <h1 className="text-sm font-bold text-gray-900">Menu Customizer</h1>
            <p className="text-[10px] text-gray-400">Preview updates live · changes not saved until you click Save</p>
          </div>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60 shadow-sm">
            {saving ? <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* ── Template ── */}
          <Section icon={<LayoutGrid className="w-3.5 h-3.5 text-orange-500" />} title="Template">
            <div className="grid grid-cols-3 gap-2">
              {TEMPLATES.map(t => (
                <button key={t.id} type="button" onClick={() => setTemplateId(t.id)}
                  className={`relative flex flex-col overflow-hidden rounded-xl border-2 transition-all ${templateId === t.id ? "border-orange-500 shadow-md ring-2 ring-orange-200" : "border-gray-100 hover:border-gray-300"}`}>
                  <div className="w-full h-10" style={{ background: `linear-gradient(135deg, ${t.gradient[0]}, ${t.gradient[1]})` }}>
                    {templateId === t.id && (
                      <div className="absolute top-1 right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-orange-500" />
                      </div>
                    )}
                  </div>
                  <div className={`px-1.5 py-1.5 text-center ${templateId === t.id ? "bg-orange-50" : "bg-gray-50"}`}>
                    <p className={`text-[9px] font-bold truncate ${templateId === t.id ? "text-orange-600" : "text-gray-600"}`}>{t.name}</p>
                  </div>
                </button>
              ))}
            </div>
          </Section>

          {/* ── Colors ── */}
          <Section icon={<Palette className="w-3.5 h-3.5 text-orange-500" />} title="Colors">
            <div className="space-y-2">
              <ColorSwatch label="Primary / Accent" value={theme.primaryColor} onChange={v => set({ primaryColor: v, accentColor: v })} />
              <ColorSwatch label="Page background"  value={theme.bgColor}      onChange={v => set({ bgColor: v })} />
              <ColorSwatch label="Card background"  value={theme.cardBg}       onChange={v => set({ cardBg: v })} />
              <ColorSwatch label="Text color"       value={theme.textColor}    onChange={v => set({ textColor: v })} />
              <ColorSwatch label="Second accent"    value={theme.accentColor}  onChange={v => set({ accentColor: v })} />
            </div>

            {/* Quick palettes */}
            <div className="mt-3">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Quick palettes</p>
              <div className="grid grid-cols-3 gap-1.5">
                {PALETTES.map(p => (
                  <button key={p.name} type="button"
                    onClick={() => set({ primaryColor: p.primary, bgColor: p.bg, cardBg: p.card, textColor: p.text, accentColor: p.accent })}
                    className="flex flex-col items-center gap-1 p-2 rounded-xl border border-gray-100 hover:border-orange-300 hover:bg-orange-50 transition-all">
                    <div className="flex gap-0.5">
                      {[p.primary, p.bg, p.card].map((c, i) => (
                        <span key={i} className="w-3.5 h-3.5 rounded-sm border border-black/10" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                    <span className="text-[9px] font-medium text-gray-600">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </Section>

          {/* ── Background ── */}
          <Section icon={<Layers className="w-3.5 h-3.5 text-orange-500" />} title="Background Style" defaultOpen={false}>
            <OptionRow label="Type">
              <SegmentedControl
                options={[{ id: "solid", label: "Solid" }, { id: "gradient", label: "Gradient" }, { id: "pattern", label: "Pattern" }]}
                value={theme.bgType}
                onChange={v => set({ bgType: v })}
              />
            </OptionRow>

            {theme.bgType === "gradient" && (
              <div className="space-y-2 pl-2 border-l-2 border-orange-100">
                <ColorSwatch label="Gradient start" value={theme.bgColor}      onChange={v => set({ bgColor: v })} />
                <ColorSwatch label="Gradient end"   value={theme.bgGradientTo} onChange={v => set({ bgGradientTo: v })} />
                {/* Preview */}
                <div className="h-8 rounded-lg" style={{ background: `linear-gradient(160deg, ${theme.bgColor}, ${theme.bgGradientTo})` }} />
              </div>
            )}

            {theme.bgType === "pattern" && (
              <div className="space-y-2 pl-2 border-l-2 border-orange-100">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Pattern</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {(["none", "dots", "grid", "lines"] as const).map(p => (
                    <button key={p} type="button" onClick={() => set({ bgPattern: p })}
                      className={`py-2.5 rounded-lg border-2 text-[9px] font-semibold capitalize transition-all ${theme.bgPattern === p ? "border-orange-500 bg-orange-50 text-orange-600" : "border-gray-100 text-gray-500 hover:border-gray-200"}`}>
                      {p === "none" ? "None" : p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Section>

          {/* ── Typography ── */}
          <Section icon={<Type className="w-3.5 h-3.5 text-orange-500" />} title="Typography" defaultOpen={false}>
            <div className="space-y-2">
              {FONTS.map(f => (
                <button key={f.id} type="button" onClick={() => set({ font: f.id })}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border-2 transition-all ${theme.font === f.id ? "border-orange-500 bg-orange-50" : "border-gray-100 hover:border-gray-200 bg-white"}`}>
                  <div>
                    <p className="text-sm font-bold text-gray-900 leading-none" style={{ fontFamily: f.css }}>{f.name}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{f.tag}</p>
                  </div>
                  <p className="text-sm text-gray-400 leading-none" style={{ fontFamily: f.css }}>Aa 12</p>
                </button>
              ))}
            </div>

            <div className="space-y-3 mt-2">
              <OptionRow label="Size">
                <SegmentedControl
                  options={[{ id: "sm", label: "S" }, { id: "base", label: "M" }, { id: "lg", label: "L" }, { id: "xl", label: "XL" }]}
                  value={theme.fontSize}
                  onChange={v => set({ fontSize: v })}
                />
              </OptionRow>
              <OptionRow label="Weight">
                <SegmentedControl
                  options={[{ id: "normal", label: "Normal" }, { id: "medium", label: "Medium" }, { id: "bold", label: "Bold" }]}
                  value={theme.fontWeight}
                  onChange={v => set({ fontWeight: v })}
                />
              </OptionRow>
            </div>
          </Section>

          {/* ── Cards ── */}
          <Section icon={<Image className="w-3.5 h-3.5 text-orange-500" />} title="Card Design" defaultOpen={false}>

            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Layout</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: "vertical",   name: "Image Top",    preview: "vertical" },
                { id: "horizontal", name: "Side by Side", preview: "horizontal" },
                { id: "minimal",    name: "Text Only",    preview: "minimal" },
                { id: "bold",       name: "Bold / Hero",  preview: "bold" },
              ] as const).map(cl => (
                <button key={cl.id} type="button" onClick={() => set({ cardLayout: cl.id })}
                  className={`flex flex-col gap-1.5 p-2.5 rounded-xl border-2 transition-all ${theme.cardLayout === cl.id ? "border-orange-500 bg-orange-50" : "border-gray-100 hover:border-gray-200"}`}>
                  <div className="w-full h-8 rounded-lg bg-gray-100 overflow-hidden flex">
                    {cl.preview === "vertical"   && <div className="flex flex-col flex-1 gap-1 p-1.5"><div className="w-full h-3 bg-gray-200 rounded" /><div className="w-3/4 h-1.5 bg-gray-300 rounded" /><div className="w-1/2 h-1.5 rounded" style={{ backgroundColor: theme.primaryColor + "88" }} /></div>}
                    {cl.preview === "horizontal" && <div className="flex flex-1 gap-1 p-1.5"><div className="w-5 flex-shrink-0 bg-gray-200 rounded" /><div className="flex flex-col gap-1 flex-1 justify-center"><div className="h-1.5 bg-gray-300 rounded" /><div className="w-2/3 h-1.5 rounded" style={{ backgroundColor: theme.primaryColor + "88" }} /></div></div>}
                    {cl.preview === "minimal"    && <div className="flex flex-1 items-center justify-between px-2"><div className="h-1.5 w-16 bg-gray-300 rounded" /><div className="h-1.5 w-8 rounded" style={{ backgroundColor: theme.primaryColor + "88" }} /></div>}
                    {cl.preview === "bold"       && <div className="flex-1 relative bg-gray-300 rounded"><div className="absolute bottom-1 left-1.5 right-1.5 flex justify-between"><div className="h-1.5 w-8 bg-white/70 rounded" /><div className="h-1.5 w-6 rounded" style={{ backgroundColor: theme.primaryColor }} /></div></div>}
                  </div>
                  <p className={`text-[10px] font-semibold ${theme.cardLayout === cl.id ? "text-orange-600" : "text-gray-600"}`}>{cl.name}</p>
                </button>
              ))}
            </div>

            <div className="space-y-3 mt-1">
              <OptionRow label="Frame style">
                <SegmentedControl
                  options={[{ id: "shadow", label: "Shadow" }, { id: "border", label: "Border" }, { id: "flat", label: "Flat" }, { id: "glass", label: "Glass" }]}
                  value={theme.cardStyle}
                  onChange={v => set({ cardStyle: v })}
                />
              </OptionRow>
              <OptionRow label="Corner radius">
                <SegmentedControl
                  options={[{ id: "sharp", label: "Sharp" }, { id: "rounded", label: "Rounded" }, { id: "pill", label: "Pill" }]}
                  value={theme.borderRadius}
                  onChange={v => set({ borderRadius: v })}
                />
              </OptionRow>
              <OptionRow label="Image ratio">
                <SegmentedControl
                  options={[{ id: "square", label: "Square" }, { id: "landscape", label: "Wide" }, { id: "portrait", label: "Tall" }]}
                  value={theme.imageRatio}
                  onChange={v => set({ imageRatio: v })}
                />
              </OptionRow>
              <OptionRow label="Image size">
                <SegmentedControl
                  options={[{ id: "sm", label: "S" }, { id: "md", label: "M" }, { id: "lg", label: "L" }]}
                  value={theme.imageSize}
                  onChange={v => set({ imageSize: v })}
                />
              </OptionRow>
            </div>
          </Section>

          {/* ── Layout & Spacing ── */}
          <Section icon={<Settings2 className="w-3.5 h-3.5 text-orange-500" />} title="Layout & Spacing" defaultOpen={false}>
            <div className="space-y-3">
              <OptionRow label="Density">
                <SegmentedControl
                  options={[{ id: "compact", label: "Dense" }, { id: "normal", label: "Normal" }, { id: "relaxed", label: "Airy" }]}
                  value={theme.spacing}
                  onChange={v => set({ spacing: v })}
                />
              </OptionRow>
              <OptionRow label="Header style">
                <SegmentedControl
                  options={[{ id: "gradient", label: "Gradient" }, { id: "solid", label: "Solid" }, { id: "minimal", label: "Minimal" }, { id: "image", label: "Cover" }]}
                  value={theme.headerStyle}
                  onChange={v => set({ headerStyle: v })}
                />
              </OptionRow>
              <OptionRow label="Header height">
                <SegmentedControl
                  options={[{ id: "compact", label: "Small" }, { id: "normal", label: "Medium" }, { id: "tall", label: "Large" }]}
                  value={theme.headerHeight}
                  onChange={v => set({ headerHeight: v })}
                />
              </OptionRow>
            </div>
          </Section>

          {/* ── Price Display ── */}
          <Section icon={<DollarSign className="w-3.5 h-3.5 text-orange-500" />} title="Price Display" defaultOpen={false}>
            <OptionRow label="Show prices" desc="Toggle all price labels on/off">
              <Toggle value={theme.showPrices} onChange={v => set({ showPrices: v })} />
            </OptionRow>
            {theme.showPrices && (
              <OptionRow label="Price style">
                <SegmentedControl
                  options={[{ id: "normal", label: "Normal" }, { id: "badge", label: "Badge" }, { id: "large", label: "Large" }]}
                  value={theme.priceStyle}
                  onChange={v => set({ priceStyle: v })}
                />
              </OptionRow>
            )}
            {/* Preview */}
            <div className="flex items-center gap-3 mt-1 p-3 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 rounded-lg bg-gray-200 flex-shrink-0" />
              <div className="flex-1">
                <div className="h-2 w-20 bg-gray-300 rounded mb-1.5" />
                <div className="h-1.5 w-28 bg-gray-200 rounded" />
              </div>
              {theme.showPrices ? (
                theme.priceStyle === "badge"
                  ? <span className="px-2 py-0.5 rounded-full text-white text-xs font-bold" style={{ backgroundColor: theme.primaryColor }}>€12.50</span>
                  : theme.priceStyle === "large"
                  ? <span className="text-xl font-black" style={{ color: theme.primaryColor }}>€12.50</span>
                  : <span className="text-sm font-bold" style={{ color: theme.primaryColor }}>€12.50</span>
              ) : (
                <span className="text-xs text-gray-400 italic">hidden</span>
              )}
            </div>
          </Section>

          {/* ── Animations ── */}
          <Section icon={<Zap className="w-3.5 h-3.5 text-orange-500" />} title="Animations & Motion" defaultOpen={false}>
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: "none",    label: "None",    desc: "Instant" },
                { id: "subtle",  label: "Subtle",  desc: "Smooth" },
                { id: "playful", label: "Playful", desc: "Bouncy" },
              ] as const).map(a => (
                <button key={a.id} type="button" onClick={() => set({ animationLevel: a.id })}
                  className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-all ${theme.animationLevel === a.id ? "border-orange-500 bg-orange-50" : "border-gray-100 hover:border-gray-200"}`}>
                  <span className="text-lg">{a.id === "none" ? "⏸" : a.id === "subtle" ? "✨" : "🎉"}</span>
                  <p className={`text-[9px] font-bold ${theme.animationLevel === a.id ? "text-orange-600" : "text-gray-500"}`}>{a.label}</p>
                  <p className="text-[8px] text-gray-400">{a.desc}</p>
                </button>
              ))}
            </div>
          </Section>

          {/* ── Elements ── */}
          <Section icon={<Eye className="w-3.5 h-3.5 text-orange-500" />} title="Show / Hide Elements" defaultOpen={false}>
            <div className="space-y-0.5">
              {([
                { key: "showImages",        label: "Item photos",       desc: "Product images on cards" },
                { key: "showDescriptions",  label: "Descriptions",      desc: "Item description text" },
                { key: "showTags",          label: "Tags",              desc: "Vegan, Spicy, etc." },
                { key: "showAllergens",     label: "Allergens",         desc: "Gluten, Dairy, etc." },
                { key: "showPrepTime",      label: "Prep time",         desc: "Est. cooking time" },
                { key: "showBadges",        label: "Badges",            desc: "New, Popular, Featured" },
                { key: "showRatings",       label: "Rating stars",      desc: "Review score in header" },
                { key: "showWaiterButton",  label: "Call Waiter button",desc: "Customer call button" },
                { key: "showFeedbackButton",label: "Feedback button",   desc: "Leave a review button" },
                { key: "showSocialLinks",   label: "Social links",      desc: "Instagram, Facebook etc." },
                { key: "showOpenStatus",    label: "Open/closed badge", desc: "Live hours status" },
              ] as const).map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-xs font-medium text-gray-800">{label}</p>
                    <p className="text-[10px] text-gray-400">{desc}</p>
                  </div>
                  <Toggle value={theme[key] as boolean} onChange={v => set({ [key]: v })} />
                </div>
              ))}
            </div>
          </Section>

          {/* ── Inspiration ── */}
          <Section icon={<Sparkles className="w-3.5 h-3.5 text-orange-500" />} title="Inspired Presets" defaultOpen={false}>
            <div className="space-y-2">
              {[
                { name: "Italian Trattoria",   tid: "brasserie",     t: { primaryColor: "#c9a84c", bgColor: "#faf6ef", cardBg: "#fffdf7", textColor: "#1c1208", font: "playfair",   bgType: "solid"    as const } },
                { name: "Modern Sushi Bar",    tid: "tokyo",         t: { primaryColor: "#ef4444", bgColor: "#0c0c0c", cardBg: "#1a1a1a", textColor: "#f5f5f5", font: "montserrat", bgType: "solid"    as const } },
                { name: "Beach Café",          tid: "mediterranean", t: { primaryColor: "#0ea5e9", bgColor: "#f0f9ff", cardBg: "#ffffff", textColor: "#0c4a6e", font: "poppins",    bgType: "pattern"  as const, bgPattern: "dots" as const } },
                { name: "Luxury Steakhouse",   tid: "luxury",        t: { primaryColor: "#c9a84c", bgColor: "#0c0c0c", cardBg: "#181818", textColor: "#f5f5f5", font: "playfair",  bgType: "solid"    as const } },
                { name: "Street Food Truck",   tid: "street",        t: { primaryColor: "#f97316", bgColor: "#1c1917", cardBg: "#292524", textColor: "#fafaf9", font: "montserrat", bgType: "solid"   as const } },
                { name: "Healthy & Fresh",     tid: "minimal",       t: { primaryColor: "#059669", bgColor: "#f0fdf4", cardBg: "#ffffff", textColor: "#052e16", font: "poppins",    bgType: "pattern" as const, bgPattern: "dots" as const } },
                { name: "Rooftop Bar",         tid: "neon",          t: { primaryColor: "#6366f1", bgColor: "#0f172a", cardBg: "#1e293b", textColor: "#f1f5f9", font: "raleway",    bgType: "gradient" as const, bgGradientTo: "#1e1b4b" } },
                { name: "Family Bistro",       tid: "vibrant",       t: { primaryColor: "#f59e0b", bgColor: "#fffbeb", cardBg: "#ffffff", textColor: "#111827", font: "poppins",    bgType: "solid"    as const } },
              ].map(preset => (
                <button key={preset.name} type="button"
                  onClick={() => { setTemplateId(preset.tid); set(preset.t); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-100 hover:border-orange-300 hover:bg-orange-50 transition-all text-left group">
                  <div className="w-8 h-8 rounded-lg flex-shrink-0 border border-black/10"
                    style={{ background: `linear-gradient(135deg, ${preset.t.bgColor}, ${preset.t.primaryColor})` }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 group-hover:text-orange-700">{preset.name}</p>
                    <p className="text-[10px] text-gray-400 capitalize">{preset.tid} template · {preset.t.font} font</p>
                  </div>
                  <ChevronRight className="w-3 h-3 text-gray-300 group-hover:text-orange-400" />
                </button>
              ))}
            </div>
          </Section>

          {/* Bottom padding */}
          <div className="h-6" />
        </div>
      </div>

      {/* ── Preview panel ── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-100">

        {/* Preview toolbar */}
        <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-medium text-gray-600">Live Preview</span>
            <span className="text-[10px] text-gray-300">· ~0.7s debounce</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setMobilePreview(v => !v)}
              className="text-[10px] px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
              {mobilePreview ? "Desktop" : "Mobile"}
            </button>
            <button onClick={() => { setPreviewUrl(buildUrl(slug, templateId, theme)); setPreviewKey(k => k + 1); }}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            {slug && (
              <a href={`/r/${slug}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
                <ExternalLink className="w-3 h-3" /> Open live
              </a>
            )}
          </div>
        </div>

        {/* Frame */}
        <div className="flex-1 overflow-hidden flex items-center justify-center p-4">
          {previewUrl ? (
            mobilePreview ? (
              /* iPhone frame */
              <div className="h-full max-h-[780px] flex items-center">
                <div className="relative bg-gray-900 rounded-[44px] shadow-2xl" style={{ width: "375px", aspectRatio: "375 / 812" }}>
                  {/* Top pill */}
                  <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-20 h-4 bg-gray-900 rounded-full z-10" />
                  {/* Volume buttons */}
                  <div className="absolute left-0 top-20 w-0.5 h-10 bg-gray-700 rounded-r" />
                  <div className="absolute left-0 top-36 w-0.5 h-7 bg-gray-700 rounded-r" />
                  <div className="absolute left-0 top-48 w-0.5 h-7 bg-gray-700 rounded-r" />
                  {/* Power button */}
                  <div className="absolute right-0 top-28 w-0.5 h-12 bg-gray-700 rounded-l" />
                  {/* Screen */}
                  <div className="absolute inset-2 bg-white rounded-[36px] overflow-hidden">
                    <iframe key={previewKey} src={previewUrl} className="w-full h-full border-0" title="Preview" />
                  </div>
                  {/* Home indicator */}
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-24 h-0.5 bg-gray-500 rounded-full" />
                </div>
              </div>
            ) : (
              /* Browser frame */
              <div className="w-full h-full rounded-2xl overflow-hidden shadow-2xl border border-gray-200 flex flex-col bg-white">
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 border-b border-gray-200 flex-shrink-0">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                  </div>
                  <div className="flex-1 mx-3 px-3 py-0.5 bg-white rounded text-[10px] text-gray-400 font-mono truncate border border-gray-200">
                    skano-menu.vercel.app/r/{slug}
                  </div>
                </div>
                <iframe key={previewKey + 5000} src={previewUrl} className="flex-1 w-full border-0" title="Desktop preview" />
              </div>
            )
          ) : (
            <div className="text-center text-gray-400">
              <div className="animate-spin w-8 h-8 border-2 border-orange-200 border-t-orange-500 rounded-full mx-auto mb-3" />
              <p className="text-sm font-medium">Loading preview…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
