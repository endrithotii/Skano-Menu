"use client";

// Floor plan & tables: build the restaurant (areas, tables and seats, walls, windows, doors, rooms, plants, text).
// Later customers reserve tables from this plan.

import { useEffect, useState } from "react";
import { LayoutGrid } from "lucide-react";
import { FloorBuilder } from "@/components/floor/floor-builder";

export default function FloorPlanPage() {
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  useEffect(() => {
    void fetch("/api/dashboard/access").then((r) => r.json()).then((a) => setRestaurantId(a?.restaurantId ?? null)).catch(() => {});
  }, []);
  return (
    <div className="p-4 lg:p-6 space-y-4 pb-16">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><LayoutGrid className="w-6 h-6 text-blue-500" /> Floor plan &amp; tables</h1>
        <p className="text-sm text-gray-500 mt-1">Build your restaurant as it is: tables with their seats, walls, windows, doors, rooms like the kitchen, and more. Later customers will reserve tables from this plan.</p>
      </div>
      {restaurantId ? <FloorBuilder restaurantId={restaurantId} /> : <div className="py-20 flex justify-center"><div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" /></div>}
    </div>
  );
}
