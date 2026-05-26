"use client";

import * as React from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

type StarSize = "sm" | "md" | "lg";

interface StarRatingProps {
  rating: number;
  onChange?: (rating: number) => void;
  size?: StarSize;
  className?: string;
}

const sizeMap: Record<StarSize, string> = {
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-8 h-8",
};

const gapMap: Record<StarSize, string> = {
  sm: "gap-0.5",
  md: "gap-1",
  lg: "gap-1.5",
};

export function StarRating({
  rating,
  onChange,
  size = "md",
  className,
}: StarRatingProps) {
  const [hovered, setHovered] = React.useState<number | null>(null);
  const isInteractive = typeof onChange === "function";
  const displayRating = hovered ?? rating;

  return (
    <div
      className={cn(
        "flex items-center",
        gapMap[size],
        isInteractive && "cursor-pointer",
        className
      )}
      role={isInteractive ? "radiogroup" : undefined}
      aria-label="Star rating"
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= displayRating;

        return (
          <button
            key={star}
            type="button"
            role={isInteractive ? "radio" : undefined}
            aria-checked={isInteractive ? star === rating : undefined}
            aria-label={`${star} star${star !== 1 ? "s" : ""}`}
            disabled={!isInteractive}
            onClick={() => isInteractive && onChange(star)}
            onMouseEnter={() => isInteractive && setHovered(star)}
            onMouseLeave={() => isInteractive && setHovered(null)}
            className={cn(
              "transition-all duration-100",
              isInteractive
                ? "hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 rounded"
                : "pointer-events-none"
            )}
          >
            <Star
              className={cn(
                sizeMap[size],
                "transition-colors duration-100",
                filled
                  ? "fill-amber-400 text-amber-400"
                  : "fill-transparent text-gray-300"
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

export type { StarRatingProps, StarSize };
