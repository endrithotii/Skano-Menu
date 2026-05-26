"use client";

import * as React from "react";
import { UtensilsCrossed, Star, Flame, Leaf, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface MenuItem {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  image?: string | null;
  tags?: string | null; // JSON array
  allergens?: string | null; // JSON array
  isFeatured?: boolean;
  isAvailable?: boolean;
}

interface MenuCategory {
  id: string;
  name: string;
  description?: string | null;
  items: MenuItem[];
}

interface DailyMenuSpecial {
  id: string;
  name: string;
  description?: string | null;
  price?: number | null;
}

interface DailyMenu {
  id: string;
  specials?: DailyMenuSpecial[];
  notes?: string | null;
  date?: string;
}

interface Restaurant {
  name: string;
  description?: string | null;
  primaryColor?: string | null;
  categories: MenuCategory[];
}

interface ModernMenuProps {
  restaurant: Restaurant;
  dailyMenu?: DailyMenu | null;
}

function parseJsonTags(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const TAG_ICONS: Record<string, React.ReactNode> = {
  vegetarian: <Leaf className="w-3 h-3" />,
  vegan: <Leaf className="w-3 h-3" />,
  spicy: <Flame className="w-3 h-3" />,
  popular: <Star className="w-3 h-3" />,
  new: <Sparkles className="w-3 h-3" />,
};

function ItemCard({ item, primaryColor }: { item: MenuItem; primaryColor?: string | null }) {
  const tags = parseJsonTags(item.tags);
  const allergens = parseJsonTags(item.allergens);

  return (
    <div
      className={cn(
        "flex gap-4 p-4 rounded-2xl border border-gray-100 bg-white hover:shadow-md transition-shadow duration-200",
        !item.isAvailable && "opacity-50"
      )}
    >
      {/* Image placeholder */}
      <div
        className="w-20 h-20 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden"
        style={{ backgroundColor: primaryColor ? `${primaryColor}20` : "#fff7ed" }}
      >
        {item.image ? (
          <img src={item.image} alt={item.name} className="w-full h-full object-cover rounded-xl" />
        ) : (
          <UtensilsCrossed
            className="w-7 h-7"
            style={{ color: primaryColor ?? "#f97316" }}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <h4 className="font-semibold text-gray-900 text-sm leading-tight">{item.name}</h4>
            {item.isFeatured && (
              <Badge variant="default" className="text-xs">Featured</Badge>
            )}
          </div>
          <span
            className="font-bold text-base shrink-0 tabular-nums"
            style={{ color: primaryColor ?? "#f97316" }}
          >
            €{item.price.toFixed(2)}
          </span>
        </div>

        {item.description && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
            {item.description}
          </p>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
              >
                {TAG_ICONS[tag]}
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Allergens */}
        {allergens.length > 0 && (
          <p className="text-xs text-gray-400 mt-1.5">
            Contains: {allergens.join(", ")}
          </p>
        )}
      </div>
    </div>
  );
}

export function ModernMenu({ restaurant, dailyMenu }: ModernMenuProps) {
  const [activeCategory, setActiveCategory] = React.useState<string>(
    restaurant.categories[0]?.id ?? ""
  );
  const categoryRefs = React.useRef<Record<string, HTMLElement>>({});

  const scrollToCategory = (id: string) => {
    setActiveCategory(id);
    categoryRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Intersection observer to highlight active category while scrolling
  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveCategory(entry.target.id);
          }
        }
      },
      { rootMargin: "-30% 0px -60% 0px" }
    );
    Object.values(categoryRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [restaurant.categories]);

  const primaryColor = restaurant.primaryColor ?? "#f97316";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900">{restaurant.name}</h1>
        {restaurant.description && (
          <p className="mt-2 text-gray-500 text-sm max-w-lg mx-auto leading-relaxed">
            {restaurant.description}
          </p>
        )}
      </div>

      {/* Sticky category tabs */}
      {restaurant.categories.length > 0 && (
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 shadow-sm">
          <div className="overflow-x-auto scrollbar-hide">
            <div className="flex gap-1 px-4 py-3 min-w-max">
              {restaurant.categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => scrollToCategory(cat.id)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-150",
                    activeCategory === cat.id
                      ? "text-white shadow-sm"
                      : "text-gray-600 hover:bg-gray-100"
                  )}
                  style={
                    activeCategory === cat.id
                      ? { backgroundColor: primaryColor }
                      : undefined
                  }
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-12">
        {/* Daily specials */}
        {dailyMenu && dailyMenu.specials && dailyMenu.specials.length > 0 && (
          <section className="rounded-2xl border-2 border-dashed p-6 bg-white" style={{ borderColor: primaryColor }}>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5" style={{ color: primaryColor }} />
              <h2 className="text-lg font-bold text-gray-900">Today's Specials</h2>
            </div>
            {dailyMenu.notes && (
              <p className="text-sm text-gray-500 mb-4 italic">{dailyMenu.notes}</p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {dailyMenu.specials.map((special) => (
                <div key={special.id} className="flex items-start justify-between gap-2 p-3 rounded-xl bg-gray-50">
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{special.name}</p>
                    {special.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{special.description}</p>
                    )}
                  </div>
                  {special.price != null && (
                    <span className="font-bold text-sm shrink-0" style={{ color: primaryColor }}>
                      €{special.price.toFixed(2)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Categories */}
        {restaurant.categories.map((category) => {
          const availableItems = category.items.filter((i) => i.isAvailable !== false);
          return (
            <section
              key={category.id}
              id={category.id}
              ref={(el) => {
                if (el) categoryRefs.current[category.id] = el;
              }}
            >
              <div className="mb-5">
                <h2 className="text-xl font-bold text-gray-900">{category.name}</h2>
                {category.description && (
                  <p className="text-sm text-gray-500 mt-1">{category.description}</p>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availableItems.map((item) => (
                  <ItemCard key={item.id} item={item} primaryColor={primaryColor} />
                ))}
                {availableItems.length === 0 && (
                  <p className="text-sm text-gray-400 col-span-2 py-4 text-center">
                    No items available in this category.
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export type { ModernMenuProps, Restaurant, MenuCategory, MenuItem, DailyMenu };
