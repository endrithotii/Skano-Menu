"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
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

export function ClassicMenu({ restaurant, dailyMenu }: ModernMenuProps) {
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

  const primaryColor = restaurant.primaryColor ?? "#92400e";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#faf7f0" }}>
      {/* Header */}
      <div
        className="text-center py-12 px-4 border-b-2"
        style={{ borderColor: `${primaryColor}30` }}
      >
        {/* Ornamental top line */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="h-px w-24" style={{ backgroundColor: primaryColor }} />
          <span className="text-lg" style={{ color: primaryColor }}>✦</span>
          <div className="h-px w-24" style={{ backgroundColor: primaryColor }} />
        </div>

        <p
          className="text-xs tracking-[0.3em] uppercase mb-3"
          style={{ color: primaryColor, fontFamily: "Georgia, serif" }}
        >
          Est. Menu
        </p>
        <h1
          className="text-5xl font-bold"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif", color: "#1c1208" }}
        >
          {restaurant.name}
        </h1>
        {restaurant.description && (
          <p
            className="mt-4 text-sm italic max-w-sm mx-auto leading-relaxed"
            style={{ color: "#7a6040", fontFamily: "Georgia, serif" }}
          >
            &ldquo;{restaurant.description}&rdquo;
          </p>
        )}

        <div className="flex items-center justify-center gap-2 mt-6">
          <div className="h-px w-24" style={{ backgroundColor: primaryColor }} />
          <span className="text-lg" style={{ color: primaryColor }}>✦</span>
          <div className="h-px w-24" style={{ backgroundColor: primaryColor }} />
        </div>
      </div>

      {/* Category navigation */}
      {restaurant.categories.length > 0 && (
        <div
          className="sticky top-0 z-10 border-b"
          style={{ backgroundColor: "#faf7f0e8", borderColor: `${primaryColor}20`, backdropFilter: "blur(6px)" }}
        >
          <div className="overflow-x-auto">
            <div className="flex justify-center gap-0 px-4 py-2 min-w-max mx-auto">
              {restaurant.categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => scrollToCategory(cat.id)}
                  className={cn(
                    "px-5 py-3 text-sm transition-all duration-150 border-b-2",
                    activeCategory === cat.id ? "font-semibold border-current" : "font-normal border-transparent hover:border-current"
                  )}
                  style={{
                    fontFamily: "Georgia, serif",
                    color: activeCategory === cat.id ? primaryColor : "#7a6040",
                  }}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-12 flex flex-col gap-14">
        {/* Daily specials */}
        {dailyMenu && dailyMenu.specials && dailyMenu.specials.length > 0 && (
          <section>
            <div className="text-center mb-8">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-px flex-1" style={{ backgroundColor: `${primaryColor}40` }} />
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" style={{ color: primaryColor }} />
                  <h2
                    className="text-xl font-semibold uppercase tracking-widest"
                    style={{ fontFamily: "Georgia, serif", color: "#1c1208" }}
                  >
                    Today's Specials
                  </h2>
                  <Sparkles className="w-4 h-4" style={{ color: primaryColor }} />
                </div>
                <div className="h-px flex-1" style={{ backgroundColor: `${primaryColor}40` }} />
              </div>
              {dailyMenu.notes && (
                <p className="text-xs italic" style={{ color: "#7a6040", fontFamily: "Georgia, serif" }}>
                  {dailyMenu.notes}
                </p>
              )}
            </div>
            {dailyMenu.specials.map((special) => (
              <div
                key={special.id}
                className="flex items-baseline gap-2 py-3 border-b"
                style={{ borderColor: `${primaryColor}15` }}
              >
                <span
                  className="font-semibold text-base shrink-0"
                  style={{ fontFamily: "Georgia, serif", color: "#1c1208" }}
                >
                  {special.name}
                </span>
                {/* Dotted leader */}
                <span className="flex-1 border-b border-dotted mb-1" style={{ borderColor: `${primaryColor}40` }} />
                {special.price != null && (
                  <span
                    className="font-bold shrink-0 tabular-nums"
                    style={{ color: primaryColor }}
                  >
                    €{special.price.toFixed(2)}
                  </span>
                )}
              </div>
            ))}
          </section>
        )}

        {/* Categories */}
        {restaurant.categories.map((category) => {
          const availableItems = category.items.filter((i) => i.isAvailable !== false);
          return (
            <section
              key={category.id}
              id={category.id}
              ref={(el) => { if (el) categoryRefs.current[category.id] = el; }}
            >
              {/* Section header */}
              <div className="text-center mb-8">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1" style={{ backgroundColor: `${primaryColor}40` }} />
                  <div className="text-center">
                    <h2
                      className="text-2xl font-bold uppercase tracking-widest"
                      style={{ fontFamily: "Georgia, 'Times New Roman', serif", color: "#1c1208" }}
                    >
                      {category.name}
                    </h2>
                    {category.description && (
                      <p
                        className="text-xs italic mt-1"
                        style={{ color: "#7a6040", fontFamily: "Georgia, serif" }}
                      >
                        {category.description}
                      </p>
                    )}
                  </div>
                  <div className="h-px flex-1" style={{ backgroundColor: `${primaryColor}40` }} />
                </div>
              </div>

              {/* Items — traditional dotted price leader style */}
              <div className="flex flex-col">
                {availableItems.map((item) => {
                  const tags = parseJsonTags(item.tags);
                  const allergens = parseJsonTags(item.allergens);
                  return (
                    <div
                      key={item.id}
                      className="py-4 border-b"
                      style={{ borderColor: `${primaryColor}10` }}
                    >
                      <div className="flex items-baseline gap-2">
                        <span
                          className="font-semibold text-base shrink-0"
                          style={{ fontFamily: "Georgia, serif", color: "#1c1208" }}
                        >
                          {item.name}
                          {item.isFeatured && (
                            <span
                              className="ml-2 text-xs font-normal italic"
                              style={{ color: primaryColor }}
                            >
                              (Chef's Special)
                            </span>
                          )}
                        </span>
                        {/* Dotted price leader */}
                        <span
                          className="flex-1 border-b border-dotted mb-1"
                          style={{ borderColor: `${primaryColor}40` }}
                        />
                        <span
                          className="tc-price font-bold shrink-0 tabular-nums"
                          style={{ color: primaryColor }}
                        >
                          €{item.price.toFixed(2)}
                        </span>
                      </div>

                      {item.description && (
                        <p
                          className="text-sm mt-1 leading-relaxed italic"
                          style={{ color: "#7a6040", fontFamily: "Georgia, serif" }}
                        >
                          {item.description}
                        </p>
                      )}

                      {(tags.length > 0 || allergens.length > 0) && (
                        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{ color: "#9a8060" }}>
                          {tags.length > 0 && (
                            <span className="italic">{tags.join(" · ")}</span>
                          )}
                          {allergens.length > 0 && (
                            <span>Contains: {allergens.join(", ")}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {availableItems.length === 0 && (
                  <p
                    className="text-center py-6 text-sm italic"
                    style={{ color: "#9a8060", fontFamily: "Georgia, serif" }}
                  >
                    Not available at this time.
                  </p>
                )}
              </div>
            </section>
          );
        })}

        {/* Footer ornament */}
        <div className="flex items-center justify-center gap-2 py-6">
          <div className="h-px w-20" style={{ backgroundColor: `${primaryColor}40` }} />
          <span style={{ color: primaryColor }}>✦</span>
          <div className="h-px w-20" style={{ backgroundColor: `${primaryColor}40` }} />
        </div>
      </div>
    </div>
  );
}
