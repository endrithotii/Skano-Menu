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
    name: "Modern",
    description: "Clean, minimal design with bold typography",
    preview: "/templates/modern.png",
  },
  {
    id: "elegant",
    name: "Elegant",
    description: "Sophisticated dark theme with gold accents",
    preview: "/templates/elegant.png",
  },
  {
    id: "vibrant",
    name: "Vibrant",
    description: "Colorful and energetic for casual dining",
    preview: "/templates/vibrant.png",
  },
  {
    id: "classic",
    name: "Classic",
    description: "Traditional restaurant menu with warm tones",
    preview: "/templates/classic.png",
  },
];
