// ─── SkanoMenu Plan Definitions ──────────────────────────────────────────────
// Single source of truth for all plan data.
// Referenced by: landing page, /pricing, dashboard, admin panel, plan gates.

export type PlanId = "free" | "grow" | "pro" | "scale";

export interface PlanFeature {
  label: string;         // Short display label
  detail?: string;       // Tooltip/expanded explanation
  free: string | boolean;
  grow: string | boolean;
  pro:  string | boolean;
  scale: string | boolean;
}

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;        // One-line pitch
  description: string;   // Slightly longer
  monthlyPrice: number | null;   // null = free
  annualPrice: number | null;    // price per month when billed annually
  color: string;
  badge?: string;        // "Most Popular", "Best Value", etc.
  ctaText: string;
  ctaHref: string;
  highlight: boolean;
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Menu",
    tagline: "Your menu, online in minutes",
    description: "Perfect for new restaurants that want a digital menu without any commitment.",
    monthlyPrice: null,
    annualPrice: null,
    color: "#6b7280",
    ctaText: "Start for free",
    ctaHref: "/register",
    highlight: false,
  },
  {
    id: "grow",
    name: "Grow",
    tagline: "Look professional, attract more guests",
    description: "Everything a serious restaurant needs to stand out and keep customers coming back.",
    monthlyPrice: 19,
    annualPrice: 15,      // €15/mo billed annually → €180/yr (save €48)
    color: "#0891b2",
    ctaText: "Start 14-day free trial",
    ctaHref: "/register?plan=grow",
    highlight: false,
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Maximize every table, every night",
    description: "The complete platform for restaurants that want to drive revenue, not just show a menu.",
    monthlyPrice: 49,
    annualPrice: 39,      // €39/mo billed annually → €468/yr (save €120)
    color: "#f97316",
    badge: "Most Popular",
    ctaText: "Start 14-day free trial",
    ctaHref: "/register?plan=pro",
    highlight: true,
  },
  {
    id: "scale",
    name: "Scale",
    tagline: "One dashboard for all your locations",
    description: "Built for restaurant groups, chains, and operators who run multiple venues.",
    monthlyPrice: 99,
    annualPrice: 79,      // €79/mo billed annually → €948/yr (save €240)
    color: "#7c3aed",
    badge: "Multi-location",
    ctaText: "Start 14-day free trial",
    ctaHref: "/register?plan=scale",
    highlight: false,
  },
];

// ─── Feature comparison matrix ───────────────────────────────────────────────
// Organized into groups for the comparison table.

export interface FeatureGroup {
  name: string;
  emoji: string;
  features: PlanFeature[];
}

export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    name: "Menu & Catalog",
    emoji: "🍽️",
    features: [
      { label: "Menu items",        free: "Up to 30",  grow: "Unlimited", pro: "Unlimited", scale: "Unlimited" },
      { label: "Categories",        free: "Up to 5",   grow: "Unlimited", pro: "Unlimited", scale: "Unlimited" },
      { label: "Item photos",       free: false,       grow: true,        pro: true,        scale: true },
      { label: "Allergen labels",   free: false,       grow: true,        pro: true,        scale: true },
      { label: "Dietary tags",      free: false,       grow: true,        pro: true,        scale: true },
      { label: "Spice level",       free: false,       grow: true,        pro: true,        scale: true },
      { label: "Nutrition info",    free: false,       grow: false,       pro: true,        scale: true },
      { label: "Chef's notes",      free: false,       grow: false,       pro: true,        scale: true },
      { label: "Item variants (S/M/L, extras)", free: false, grow: false, pro: true,        scale: true },
      { label: "Hide items (seasonal preview)", free: false, grow: false, pro: true,        scale: true },
      { label: "Menu snapshots & version history", free: false, grow: false, pro: true,     scale: true },
      { label: "Copy menu between locations",      free: false, grow: false, pro: false,    scale: true },
    ],
  },
  {
    name: "Design & Branding",
    emoji: "🎨",
    features: [
      { label: "Templates",               free: "1 (Modern)", grow: "All 15",   pro: "All 15",   scale: "All 15" },
      { label: "Full visual customizer",  free: false,        grow: true,       pro: true,       scale: true },
      { label: "Custom colors & fonts",   free: false,        grow: true,       pro: true,       scale: true },
      { label: "Remove SkanoMenu branding", free: false,      grow: true,       pro: true,       scale: true },
      { label: "Background patterns & gradients", free: false, grow: true,     pro: true,       scale: true },
      { label: "Card layout modes",       free: false,        grow: true,       pro: true,       scale: true },
      { label: "Custom meta title & description (SEO)", free: false, grow: false, pro: true,   scale: true },
      { label: "Custom QR code design",   free: false,        grow: false,      pro: true,       scale: true },
      { label: "White label (no branding at all)", free: false, grow: false,   pro: false,      scale: true },
    ],
  },
  {
    name: "Analytics & Insights",
    emoji: "📊",
    features: [
      { label: "QR scan tracking",        free: "7 days",     grow: "30 days",  pro: "90 days",  scale: "365 days" },
      { label: "Peak hours heatmap",      free: false,        grow: false,      pro: true,       scale: true },
      { label: "Device breakdown",        free: false,        grow: false,      pro: true,       scale: true },
      { label: "Most viewed items",       free: false,        grow: false,      pro: true,       scale: true },
      { label: "Search term analytics",   free: false,        grow: false,      pro: true,       scale: true },
      { label: "Feedback sentiment score",free: false,        grow: false,      pro: true,       scale: true },
      { label: "Menu engineering matrix", detail: "See which dishes make you money vs. just sell well",
                                          free: false,        grow: false,      pro: true,       scale: true },
      { label: "Analytics export (CSV)",  free: false,        grow: false,      pro: false,      scale: true },
      { label: "Cross-location comparison", free: false,      grow: false,      pro: false,      scale: true },
    ],
  },
  {
    name: "Operations & Staff",
    emoji: "🛎️",
    features: [
      { label: "Call waiter button",      free: false,        grow: "Basic",    pro: true,       scale: true },
      { label: "Waiter accounts",         free: false,        grow: "1",        pro: "5",        scale: "Unlimited" },
      { label: "Table assignments per waiter", free: false,   grow: false,      pro: true,       scale: true },
      { label: "Web push notifications",  free: false,        grow: false,      pro: true,       scale: true },
      { label: "Table map editor",        free: false,        grow: false,      pro: true,       scale: true },
      { label: "QR codes bulk generator", free: false,        grow: "Single",   pro: true,       scale: true },
      { label: "Daily specials",          free: false,        grow: true,       pro: true,       scale: true },
      { label: "Category time scheduling",free: false,        grow: false,      pro: true,       scale: true },
      { label: "Holiday & exception hours",free: false,       grow: true,       pro: true,       scale: true },
    ],
  },
  {
    name: "Marketing & Growth",
    emoji: "🚀",
    features: [
      { label: "Customer feedback & ratings", free: false,    grow: true,       pro: true,       scale: true },
      { label: "Reply to reviews",        free: false,        grow: false,      pro: true,       scale: true },
      { label: "Flash sales with countdown", detail: "Time-limited deals that create urgency",
                                          free: false,        grow: false,      pro: true,       scale: true },
      { label: "Happy hour pricing",      free: false,        grow: false,      pro: true,       scale: true },
      { label: "Loyalty stamp card",      detail: "Digital punch card — 10 visits = free item",
                                          free: false,        grow: false,      pro: true,       scale: true },
      { label: "Promotions & banners",    free: false,        grow: false,      pro: true,       scale: true },
      { label: "AI menu assistant (chat)", detail: "Customers can ask your AI about dishes, allergens, pairings",
                                          free: false,        grow: false,      pro: true,       scale: true },
      { label: "Google Places integration", free: false,      grow: true,       pro: true,       scale: true },
      { label: "Social links & WiFi display", free: false,    grow: true,       pro: true,       scale: true },
      { label: "Custom announcement banner", free: false,     grow: true,       pro: true,       scale: true },
      { label: "Multi-language menu",     free: false,        grow: false,      pro: true,       scale: true },
    ],
  },
  {
    name: "Locations & Scale",
    emoji: "🏢",
    features: [
      { label: "Restaurants / locations", free: "1",          grow: "1",        pro: "1",        scale: "Up to 5" },
      { label: "Multi-location dashboard",free: false,        grow: false,      pro: false,      scale: true },
      { label: "API access",              free: false,        grow: false,      pro: false,      scale: true },
    ],
  },
  {
    name: "Support",
    emoji: "💬",
    features: [
      { label: "Support",                 free: "Community",  grow: "Email",    pro: "Priority email", scale: "Dedicated manager" },
      { label: "Onboarding call",         free: false,        grow: false,      pro: false,      scale: true },
      { label: "SLA uptime guarantee",    free: false,        grow: false,      pro: false,      scale: "99.9%" },
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getPlan(id: PlanId): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}

export function formatPrice(plan: Plan, annual: boolean): string {
  if (plan.monthlyPrice === null) return "Free";
  const price = annual ? plan.annualPrice! : plan.monthlyPrice;
  return `€${price}`;
}

export function annualSavings(plan: Plan): number | null {
  if (!plan.monthlyPrice || !plan.annualPrice) return null;
  return (plan.monthlyPrice - plan.annualPrice) * 12;
}
