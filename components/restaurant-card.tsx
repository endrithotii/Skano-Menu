"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { MapPin, UtensilsCrossed, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface RestaurantCardProps {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    cuisine?: string | null; // JSON string array e.g. '["Italian","Pizza"]'
    logo?: string | null;
    status: string;
    address?: string | null;
    primaryColor?: string | null;
    _count?: {
      menuItems?: number;
      feedback?: number;
    };
  };
  className?: string;
}

function parseCuisine(cuisine?: string | null): string[] {
  if (!cuisine) return [];
  try {
    const parsed = JSON.parse(cuisine);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Generate a deterministic gradient from the restaurant name
const GRADIENTS = [
  "from-orange-400 to-amber-500",
  "from-rose-400 to-orange-500",
  "from-violet-400 to-purple-500",
  "from-cyan-400 to-blue-500",
  "from-emerald-400 to-teal-500",
  "from-pink-400 to-rose-500",
];

function getGradient(name: string, primaryColor?: string | null): string {
  if (primaryColor) return "";
  const idx = name.charCodeAt(0) % GRADIENTS.length;
  return GRADIENTS[idx];
}

export function RestaurantCard({ restaurant, className }: RestaurantCardProps) {
  const cuisines = parseCuisine(restaurant.cuisine);
  const gradient = getGradient(restaurant.name, restaurant.primaryColor);
  const isActive = restaurant.status === "ACTIVE";

  return (
    <motion.div
      whileHover={{ y: -4, boxShadow: "0 16px 40px rgba(0,0,0,0.10)" }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn("group rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden flex flex-col", className)}
    >
      {/* Cover / logo placeholder */}
      <div
        className={cn(
          "relative h-40 flex items-center justify-center overflow-hidden",
          !restaurant.primaryColor && `bg-gradient-to-br ${gradient}`,
        )}
        style={restaurant.primaryColor ? { backgroundColor: restaurant.primaryColor } : undefined}
      >
        {restaurant.logo ? (
          <img
            src={restaurant.logo}
            alt={restaurant.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-white/80">
            <UtensilsCrossed className="w-10 h-10 text-white/60" />
            <span className="text-2xl font-bold text-white tracking-wide">
              {restaurant.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}
        {/* Status badge */}
        <div className="absolute top-3 right-3">
          <Badge variant={isActive ? "success" : "secondary"}>
            {isActive ? "Open" : "Closed"}
          </Badge>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-3 p-5 flex-1">
        <div className="flex flex-col gap-1">
          <h3 className="font-semibold text-gray-900 text-base leading-tight line-clamp-1 group-hover:text-orange-600 transition-colors duration-150">
            {restaurant.name}
          </h3>
          {restaurant.description && (
            <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">
              {restaurant.description}
            </p>
          )}
        </div>

        {/* Cuisine tags */}
        {cuisines.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {cuisines.slice(0, 3).map((c) => (
              <span
                key={c}
                className="inline-flex items-center rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-600 ring-1 ring-inset ring-orange-100"
              >
                {c}
              </span>
            ))}
            {cuisines.length > 3 && (
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                +{cuisines.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Address */}
        {restaurant.address && (
          <div className="flex items-start gap-1.5 text-xs text-gray-400">
            <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span className="line-clamp-1">{restaurant.address}</span>
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto pt-2">
          <Button size="sm" className="w-full gap-1.5" asChild>
            <Link href={`/r/${restaurant.slug}`}>
              View Menu
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

export type { RestaurantCardProps };
