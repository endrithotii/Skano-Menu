import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatCurrency(amount: number, currency = "€"): string {
  return `${currency}${amount.toFixed(2)}`;
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function parseJsonField<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function generateSlug(name: string): string {
  return slugify(name) + "-" + Math.random().toString(36).slice(2, 6);
}

export const CUISINE_TYPES = [
  "Italian", "Mediterranean", "Albanian", "Balkan", "Turkish",
  "American", "Asian", "Sushi", "Pizza", "Burgers", "Seafood",
  "Vegetarian", "Vegan", "Coffee & Cafe", "Desserts", "Fast Food",
  "Grill & BBQ", "Traditional", "International", "Other"
];

export const ALLERGENS = [
  "Gluten", "Dairy", "Eggs", "Fish", "Shellfish",
  "Tree Nuts", "Peanuts", "Soy", "Sesame"
];

export const ITEM_TAGS = [
  "vegetarian", "vegan", "spicy", "popular", "new", "gluten-free",
  "chef-special", "seasonal", "healthy"
];

export const MENU_TEMPLATES = [
  {
    id: "modern",
    name: "Modern Cards",
    description: "Clean image cards with bold typography and category tabs",
    preview: "/templates/modern.png",
  },
  {
    id: "elegant",
    name: "Elegant",
    description: "Sophisticated dark theme with gold accents — perfect for fine dining",
    preview: "/templates/elegant.png",
  },
  {
    id: "vibrant",
    name: "Vibrant",
    description: "Colourful gradient cards per category — great for casual dining",
    preview: "/templates/vibrant.png",
  },
  {
    id: "classic",
    name: "Classic",
    description: "Traditional dotted price-leader style on warm parchment",
    preview: "/templates/classic.png",
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Ultra-clean white layout — name, price, nothing else in the way",
    preview: "/templates/minimal.png",
  },
  {
    id: "grid",
    name: "Photo Grid",
    description: "2-column card grid with large image placeholders",
    preview: "/templates/grid.png",
  },
  {
    id: "dark",
    name: "Dark Mode",
    description: "Sleek dark background with your brand colour as the accent",
    preview: "/templates/dark.png",
  },
  {
    id: "flipbook",
    name: "Flipbook",
    description: "One category per page — tap Next / Prev to flip through the menu",
    preview: "/templates/flipbook.png",
  },
  {
    id: "magazine",
    name: "Magazine",
    description: "Editorial layout with big section banners and featured spotlights",
    preview: "/templates/magazine.png",
  },
  {
    id: "neon",
    name: "Neon Night",
    description: "Dark background with glowing neon accents — made for night venues",
    preview: "/templates/neon.png",
  },
  {
    id: "tokyo",
    name: "Tokyo",
    description: "Ultra-minimal numbered list — dark, sleek, high-end Japanese-inspired vibe",
    preview: "/templates/tokyo.png",
  },
  {
    id: "brasserie",
    name: "Brasserie",
    description: "Warm cream & gold French bistro aesthetic — timeless and sophisticated",
    preview: "/templates/brasserie.png",
  },
  {
    id: "mediterranean",
    name: "Mediterranean",
    description: "Ocean-blue coastal freshness — cards grid with a relaxed sunny feel",
    preview: "/templates/mediterranean.png",
  },
  {
    id: "street",
    name: "Street Food",
    description: "Bold, energetic, urban — jagged accents and high-contrast typography",
    preview: "/templates/street.png",
  },
  {
    id: "luxury",
    name: "Luxury",
    description: "Black canvas with gold gradients and serif typography — pure prestige",
    preview: "/templates/luxury.png",
  },
];
