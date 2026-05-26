"use client";

import * as React from "react";
import { UtensilsCrossed, Sparkles } from "lucide-react";
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

export function ElegantMenu({ restaurant, dailyMenu }: ModernMenuProps) {
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
    <div className="min-h-screen" style={{ backgroundColor: "#1a1a2e", color: "#e8e0d0" }}>
      {/* Header */}
      <div className="text-center py-12 px-4 border-b" style={{ borderColor: "#d4af3720" }}>
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="h-px w-16" style={{ backgroundColor: "#d4af37" }} />
          <UtensilsCrossed className="w-5 h-5" style={{ color: "#d4af37" }} />
          <div className="h-px w-16" style={{ backgroundColor: "#d4af37" }} />
        </div>
        <h1
          className="text-4xl font-bold tracking-wide uppercase"
          style={{ fontFamily: "Georgia, serif", color: "#f5f0e8" }}
        >
          {restaurant.name}
        </h1>
        {restaurant.description && (
          <p className="mt-3 text-sm max-w-md mx-auto leading-relaxed" style={{ color: "#a09070" }}>
            {restaurant.description}
          </p>
        )}
        <div className="flex items-center justify-center gap-3 mt-3">
          <div className="h-px w-24" style={{ backgroundColor: "#d4af3740" }} />
          <span className="text-xs tracking-widest uppercase" style={{ color: "#d4af37" }}>
            Est. Menu
          </span>
          <div className="h-px w-24" style={{ backgroundColor: "#d4af3740" }} />
        </div>
      </div>

      {/* Category tabs */}
      {restaurant.categories.length > 0 && (
        <div className="sticky top-0 z-10 border-b" style={{ backgroundColor: "#12122080", borderColor: "#d4af3720", backdropFilter: "blur(8px)" }}>
          <div className="overflow-x-auto">
            <div className="flex gap-0 px-6 min-w-max">
              {restaurant.categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => scrollToCategory(cat.id)}
                  className={cn(
                    "px-5 py-4 text-sm font-medium tracking-widest uppercase transition-all duration-200 border-b-2",
                    activeCategory === cat.id
                      ? "border-current"
                      : "border-transparent hover:border-current"
                  )}
                  style={{
                    color: activeCategory === cat.id ? "#d4af37" : "#7a6a50",
                  }}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 py-12 flex flex-col gap-16">
        {/* Daily specials */}
        {dailyMenu && dailyMenu.specials && dailyMenu.specials.length > 0 && (
          <section>
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-3 mb-2">
                <div className="h-px flex-1" style={{ backgroundColor: "#d4af3740" }} />
                <Sparkles className="w-4 h-4" style={{ color: "#d4af37" }} />
                <div className="h-px flex-1" style={{ backgroundColor: "#d4af3740" }} />
              </div>
              <h2 className="text-xl uppercase tracking-widest font-semibold" style={{ color: "#d4af37", fontFamily: "Georgia, serif" }}>
                Today's Specials
              </h2>
            </div>
            {dailyMenu.notes && (
              <p className="text-center text-sm italic mb-6" style={{ color: "#7a6a50" }}>
                {dailyMenu.notes}
              </p>
            )}
            <div className="flex flex-col gap-4">
              {dailyMenu.specials.map((special) => (
                <div
                  key={special.id}
                  className="flex items-center justify-between py-3 border-b border-dashed gap-4"
                  style={{ borderColor: "#d4af3730" }}
                >
                  <div>
                    <p className="font-semibold" style={{ color: "#f5f0e8", fontFamily: "Georgia, serif" }}>
                      {special.name}
                    </p>
                    {special.description && (
                      <p className="text-xs mt-0.5" style={{ color: "#7a6a50" }}>{special.description}</p>
                    )}
                  </div>
                  {special.price != null && (
                    <span className="font-bold text-lg shrink-0 tabular-nums" style={{ color: "#d4af37" }}>
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
              ref={(el) => { if (el) categoryRefs.current[category.id] = el; }}
            >
              <div className="text-center mb-8">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-px flex-1" style={{ backgroundColor: "#d4af3740" }} />
                  <h2
                    className="text-lg uppercase tracking-widest font-semibold px-2"
                    style={{ color: "#d4af37", fontFamily: "Georgia, serif" }}
                  >
                    {category.name}
                  </h2>
                  <div className="h-px flex-1" style={{ backgroundColor: "#d4af3740" }} />
                </div>
                {category.description && (
                  <p className="text-xs italic" style={{ color: "#7a6a50" }}>
                    {category.description}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1">
                {availableItems.map((item) => {
                  const tags = parseJsonTags(item.tags);
                  const allergens = parseJsonTags(item.allergens);
                  return (
                    <div
                      key={item.id}
                      className="py-5 border-b flex flex-col gap-1.5"
                      style={{ borderColor: "#ffffff0a" }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="font-semibold text-base"
                              style={{ fontFamily: "Georgia, serif", color: "#f5f0e8" }}
                            >
                              {item.name}
                            </span>
                            {item.isFeatured && (
                              <span
                                className="text-xs uppercase tracking-wider px-2 py-0.5 rounded-full border"
                                style={{ color: "#d4af37", borderColor: "#d4af3740" }}
                              >
                                Signature
                              </span>
                            )}
                          </div>
                          {item.description && (
                            <p className="text-sm mt-1 leading-relaxed" style={{ color: "#7a6a50" }}>
                              {item.description}
                            </p>
                          )}
                          {tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="text-xs px-2 py-0.5 rounded-full"
                                  style={{ backgroundColor: "#d4af3715", color: "#a08040" }}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                          {allergens.length > 0 && (
                            <p className="text-xs mt-1" style={{ color: "#5a4a30" }}>
                              Contains: {allergens.join(", ")}
                            </p>
                          )}
                        </div>
                        <span
                          className="font-bold text-lg shrink-0 tabular-nums"
                          style={{ color: "#d4af37" }}
                        >
                          €{item.price.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {availableItems.length === 0 && (
                  <p className="text-center py-6 text-sm italic" style={{ color: "#5a4a30" }}>
                    Not available at this time.
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
