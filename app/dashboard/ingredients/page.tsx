"use client";

// Ingredients & details: the workspace. Who may use it (chefs and others) is set on Staff & roles.

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChefHat } from "lucide-react";
import { IngredientsWorkspace } from "@/components/ingredients/ingredients-workspace";

export default function IngredientsPage() {
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [owner, setOwner] = useState(false);

  useEffect(() => {
    (async () => {
      const a = await fetch("/api/dashboard/access").then((r) => r.json()).catch(() => null);
      setRestaurantId(a?.restaurantId ?? null);
      setOwner(!!a?.permissions?.includes("staff.manage"));
    })();
  }, []);

  if (!restaurantId) return <div className="p-6 flex justify-center h-64 items-center"><div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="p-4 lg:p-6 max-w-[1600px] space-y-6 pb-28">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><ChefHat className="w-6 h-6 text-blue-500" /> Ingredients &amp; details</h1>
        <p className="text-sm text-gray-500 mt-1">For every dish on your menus: what it is made of, as precisely as you like</p>
      </div>

      <IngredientsWorkspace restaurantId={restaurantId} />

      {owner && (
        <p className="max-w-3xl text-xs text-gray-500">
          Want a chef to fill this in? Add them on <Link href="/dashboard/staff" className="font-semibold text-blue-600 hover:text-blue-700">Staff &amp; roles</Link> with the Chef role.
        </p>
      )}
    </div>
  );
}
