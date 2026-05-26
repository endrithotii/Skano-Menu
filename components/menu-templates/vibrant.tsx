"use client";

import * as React from "react";
import { UtensilsCrossed, Sparkles, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ModernMenuProps } from "./modern";

function parseJsonTags(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const CATEGORY_GRADIENTS = [
  { bg: "from-orange-400 to-pink-500", pill: "bg-orange-500", light: "bg-orange-50 border-orange-100" },
  { bg: "from-violet-500 to-purple-600", pill: "bg-violet-500", light: "bg-violet-50 border-violet-100" },
  { bg: "from-cyan-400 to-blue-500", pill: "bg-cyan-500", light: "bg-cyan-50 border-cyan-100" },
  { bg: "from-emerald-400 to-teal-500", pill: "bg-emerald-500", light: "bg-emerald-50 border-emerald-100" },
  { bg: "from-rose-400 to-red-500", pill: "bg-rose-500", light: "bg-rose-50 border-rose-100" },
  { bg: "from-amber-400 to-yellow-500", pill: "bg-amber-500", light: "bg-amber-50 border-amber-100" },
];

export function VibrantMenu({ restaurant, dailyMenu }: ModernMenuProps) {
  const [activeCategory, setActiveCategory] = React.useState<string>(
    restaurant.categories[0]?.id ?? ""
  );
  const categoryRefs = React.useRef<Record<string, HTMLElement>>({});

  const scrollToCategory = (id: string) => {
    setActiveCategory(id);
    categoryRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveCategory(entry.target.id);
        }
      },
      { rootMargin: "-30% 0px -60% 0px" }
    );
    Object.values(categoryRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [restaurant.categories]);

  return (
    <div className="min-h-screen bg-white">
      {/* Hero header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-orange-400 via-pink-500 to-violet-500 py-14 px-4 text-center text-white">
        <div className="absolute inset-0 opacity-10">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                width: `${80 + i * 40}px`,
                height: `${80 + i * 40}px`,
                top: `${10 + i * 12}%`,
                left: `${5 + i * 15}%`,
              }}
            />
          ))}
        </div>
        <div className="relative z-10">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Zap className="w-6 h-6 fill-current" />
            <span className="text-sm font-bold uppercase tracking-widest opacity-90">Menu</span>
            <Zap className="w-6 h-6 fill-current" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight drop-shadow-sm">
            {restaurant.name}
          </h1>
          {restaurant.description && (
            <p className="mt-2 text-sm opacity-80 max-w-sm mx-auto">{restaurant.description}</p>
          )}
        </div>
      </div>

      {/* Category pill navigation */}
      {restaurant.categories.length > 0 && (
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 shadow-sm">
          <div className="overflow-x-auto">
            <div className="flex gap-2 px-4 py-3 min-w-max">
              {restaurant.categories.map((cat, idx) => {
                const colors = CATEGORY_GRADIENTS[idx % CATEGORY_GRADIENTS.length];
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => scrollToCategory(cat.id)}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-200",
                      isActive
                        ? `${colors.pill} text-white shadow-md scale-105`
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    )}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-12">
        {/* Daily specials */}
        {dailyMenu && dailyMenu.specials && dailyMenu.specials.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-5">
              <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 shadow-md">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-2xl font-extrabold text-gray-900">Today's Specials</h2>
            </div>
            {dailyMenu.notes && (
              <p className="text-sm text-gray-500 mb-4">{dailyMenu.notes}</p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {dailyMenu.specials.map((special) => (
                <div
                  key={special.id}
                  className="rounded-2xl bg-gradient-to-br from-yellow-50 to-orange-50 border border-orange-100 p-4 flex justify-between items-start gap-2"
                >
                  <div>
                    <p className="font-bold text-gray-900">{special.name}</p>
                    {special.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{special.description}</p>
                    )}
                  </div>
                  {special.price != null && (
                    <span className="font-extrabold text-orange-500 text-base shrink-0 tabular-nums">
                      €{special.price.toFixed(2)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Categories */}
        {restaurant.categories.map((category, catIdx) => {
          const colors = CATEGORY_GRADIENTS[catIdx % CATEGORY_GRADIENTS.length];
          const availableItems = category.items.filter((i) => i.isAvailable !== false);
          return (
            <section
              key={category.id}
              id={category.id}
              ref={(el) => { if (el) categoryRefs.current[category.id] = el; }}
            >
              {/* Category header card */}
              <div
                className={cn(
                  "rounded-2xl bg-gradient-to-r p-5 mb-5 text-white",
                  colors.bg
                )}
              >
                <h2 className="text-xl font-extrabold">{category.name}</h2>
                {category.description && (
                  <p className="text-sm opacity-80 mt-1">{category.description}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {availableItems.map((item) => {
                  const tags = parseJsonTags(item.tags);
                  const allergens = parseJsonTags(item.allergens);
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "rounded-2xl border p-4 flex gap-3 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5",
                        colors.light
                      )}
                    >
                      {/* Image / icon */}
                      <div
                        className={cn(
                          "w-16 h-16 rounded-xl shrink-0 flex items-center justify-center bg-gradient-to-br",
                          colors.bg
                        )}
                      >
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover rounded-xl" />
                        ) : (
                          <UtensilsCrossed className="w-6 h-6 text-white" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1">
                          <p className="font-bold text-gray-900 text-sm leading-tight line-clamp-1">
                            {item.name}
                          </p>
                          <span className={cn("font-extrabold text-sm shrink-0 tabular-nums", colors.pill.replace("bg-", "text-"))}>
                            €{item.price.toFixed(2)}
                          </span>
                        </div>
                        {item.description && (
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.description}</p>
                        )}
                        {item.isFeatured && (
                          <span className={cn("inline-flex items-center gap-1 mt-1 text-xs font-bold text-white px-2 py-0.5 rounded-full", colors.pill)}>
                            <Sparkles className="w-2.5 h-2.5" /> Featured
                          </span>
                        )}
                        {tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {tags.map((tag) => (
                              <span key={tag} className="text-xs bg-white/70 rounded-full px-2 py-0.5 text-gray-600 font-medium">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        {allergens.length > 0 && (
                          <p className="text-xs text-gray-400 mt-1">
                            Allergens: {allergens.join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
                {availableItems.length === 0 && (
                  <p className="text-sm text-gray-400 col-span-2 text-center py-4">
                    No items currently available.
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
