// Icons next to a dish on the digital menu: what meat it is, vegetarian / vegan, spicy, ...
// Small colored circles, so customers see at a glance what to expect. Used by the design editor and its export.

import { Beef, Drumstick, Fish, Flame, Ham, Leaf, Nut, Shrimp, Vegan, WheatOff, Egg, Milk } from "lucide-react";
import type { ComponentType } from "react";

type IconCmp = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

/** A sheep, drawn like the lucide icons (lucide has none) */
function Lamb({ size = 24, color = "currentColor", strokeWidth = 2 }: { size?: number; color?: string; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 16.5a3 3 0 0 1-1-5.8 3 3 0 0 1 4.2-3.3 3 3 0 0 1 5.1.4 3 3 0 0 1 3.7 3.4 3 3 0 0 1-1 5.3" />
      <path d="M6.5 16.5h11" />
      <path d="M8.5 16.5v3M15.5 16.5v3" />
      <path d="M17.6 10.6c1.1-.4 2.4.1 2.9 1.2.4.9.1 2-.7 2.6" />
      <circle cx="19.2" cy="12.2" r=".4" fill={color} />
    </svg>
  );
}

/** label: in the icon key customers see. short: in the editor (defaults to label) */
export const DIET_TAGS: { key: string; label: string; short?: string; color: string; Icon: IconCmp }[] = [
  { key: "chicken", label: "Chicken", color: "#d97706", Icon: Drumstick },
  { key: "beef", label: "Beef", color: "#b91c1c", Icon: Beef },
  { key: "pork", label: "Pork", color: "#db2777", Icon: Ham },
  { key: "lamb", label: "Lamb", color: "#7c5c3b", Icon: Lamb },
  { key: "fish", label: "Fish", color: "#0369a1", Icon: Fish },
  { key: "seafood", label: "Seafood", color: "#ea580c", Icon: Shrimp },
  { key: "vegetarian", label: "Vegetarian", color: "#16a34a", Icon: Leaf },
  { key: "vegan", label: "Vegan", color: "#15803d", Icon: Vegan },
  { key: "spicy", label: "Spicy", color: "#dc2626", Icon: Flame },
  { key: "gluten-free", label: "Gluten free", color: "#a16207", Icon: WheatOff },
  { key: "nuts", label: "Contains nuts", short: "Nuts", color: "#92400e", Icon: Nut },
  { key: "egg", label: "Contains egg", short: "Egg", color: "#ca8a04", Icon: Egg },
  { key: "dairy", label: "Contains dairy", short: "Dairy", color: "#0284c7", Icon: Milk },
];
export { DIET_KEYS } from "@/lib/diet-keys";
export const dietTag = (key: string) => DIET_TAGS.find((t) => t.key === key);

/** One icon: a colored circle with a white symbol. size = the circle in px */
export function DietBadge({ tag, size, title }: { tag: string; size: number; title?: boolean }) {
  const t = dietTag(tag);
  if (!t) return null;
  return (
    <span title={title ? t.label : undefined} aria-label={t.label} role="img"
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: size, height: size, borderRadius: "50%", background: t.color, flexShrink: 0, verticalAlign: "middle" }}>
      <t.Icon size={Math.round(size * 0.62)} color="#ffffff" strokeWidth={2.4} />
    </span>
  );
}
