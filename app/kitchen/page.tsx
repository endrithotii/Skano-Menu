"use client";

// Chef page: Ingredients & details for the restaurant the chef works at (chef accounts are made by the manager)

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChefHat, LogOut } from "lucide-react";
import { Toaster } from "react-hot-toast";
import { IngredientsWorkspace } from "@/components/ingredients/ingredients-workspace";

export default function KitchenPage() {
  const router = useRouter();
  const [session, setSession] = useState<{ name: string; restaurantId: string; restaurantName: string } | null>(null);

  useEffect(() => {
    fetch("/api/kitchen/session")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("auth"))))
      .then(setSession)
      .catch(() => router.replace("/login?next=/kitchen"));
  }, [router]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
  }

  if (!session) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-center" />
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChefHat className="w-5 h-5 text-blue-600" />
          <div>
            <div className="text-sm font-bold text-gray-900">{session.restaurantName}</div>
            <div className="text-xs text-gray-500">Ingredients &amp; details · {session.name}</div>
          </div>
        </div>
        <button onClick={logout} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-100">
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </header>
      <main className="max-w-[1600px] mx-auto p-4 lg:p-6 pb-28">
        <IngredientsWorkspace restaurantId={session.restaurantId} />
      </main>
    </div>
  );
}
