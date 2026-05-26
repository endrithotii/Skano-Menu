"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, MapPin, Utensils, Star, QrCode, Filter, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { CUISINE_TYPES } from "@/lib/utils";

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  address: string | null;
  cuisine: string[] | string;
  primaryColor: string;
  status: string;
  recentScanCount?: number;
  itemsCount?: number;
  avgRating?: number;
}

export default function RestaurantsPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCuisine, setSelectedCuisine] = useState("");

  useEffect(() => {
    fetchRestaurants();
  }, [search, selectedCuisine]);

  async function fetchRestaurants() {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (selectedCuisine) params.set("cuisine", selectedCuisine);
    const res = await fetch(`/api/restaurants?${params}`);
    if (res.ok) {
      const data = await res.json();
      setRestaurants(Array.isArray(data) ? data : (data.restaurants ?? []));
    }
    setLoading(false);
  }

  const cuisines = ["All", ...CUISINE_TYPES.slice(0, 10)];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-orange-500 to-amber-500 py-16 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Link href="/" className="inline-flex items-center gap-2 text-white/80 hover:text-white text-sm mb-6 transition-colors">
              <Utensils className="w-4 h-4" />
              SkanoMenu
            </Link>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Discover Restaurants
            </h1>
            <p className="text-orange-100 text-lg mb-8">
              Browse digital menus from restaurants registered on SkanoMenu
            </p>

            {/* Search */}
            <div className="relative max-w-xl mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search restaurants..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none shadow-xl text-base"
              />
            </div>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Cuisine filter */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
          <Filter className="w-4 h-4 text-gray-500 flex-shrink-0" />
          {cuisines.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedCuisine(c === "All" ? "" : c)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                (c === "All" && !selectedCuisine) || selectedCuisine === c
                  ? "bg-orange-500 text-white shadow-lg shadow-orange-500/30"
                  : "bg-white text-gray-700 border border-gray-200 hover:border-orange-300"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Results */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden animate-pulse">
                <div className="h-40 bg-gray-200" />
                <div className="p-5 space-y-3">
                  <div className="h-5 bg-gray-200 rounded w-2/3" />
                  <div className="h-4 bg-gray-200 rounded w-full" />
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : restaurants.length === 0 ? (
          <div className="text-center py-20">
            <Utensils className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No restaurants found</h3>
            <p className="text-gray-500">Try a different search or filter</p>
          </div>
        ) : (
          <>
            <div className="text-sm text-gray-500 mb-4">{restaurants.length} restaurant{restaurants.length !== 1 ? "s" : ""} found</div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {restaurants.map((r, i) => {
                const cuisineArr = Array.isArray(r.cuisine) ? r.cuisine : (() => { try { return JSON.parse(r.cuisine as string) as string[]; } catch { return []; } })();
                return (
                  <motion.div
                    key={r.id}
                    className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all border border-gray-100 group"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    {/* Cover */}
                    <div
                      className="h-40 relative flex items-center justify-center"
                      style={{ background: `linear-gradient(135deg, ${r.primaryColor}dd, ${r.primaryColor}88)` }}
                    >
                      <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                        <Utensils className="w-8 h-8 text-white" />
                      </div>
                      <div className="absolute top-3 right-3 bg-black/20 backdrop-blur-sm rounded-lg px-2 py-1 flex items-center gap-1">
                        <QrCode className="w-3 h-3 text-white" />
                        <span className="text-xs text-white font-medium">{r.recentScanCount ?? 0} scans</span>
                      </div>
                    </div>

                    <div className="p-5">
                      <h3 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-orange-600 transition-colors">
                        {r.name}
                      </h3>
                      {r.description && (
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{r.description}</p>
                      )}

                      {cuisineArr.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {cuisineArr.slice(0, 3).map((c) => (
                            <span key={c} className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full font-medium">{c}</span>
                          ))}
                        </div>
                      )}

                      {r.address && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-4">
                          <MapPin className="w-3.5 h-3.5" />
                          {r.address}
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        {r.avgRating && r.avgRating > 0 ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                            <span className="font-semibold text-gray-900">{r.avgRating.toFixed(1)}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">No reviews yet</span>
                        )}
                        <Link
                          href={`/r/${r.slug}`}
                          className="inline-flex items-center gap-1.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all"
                        >
                          View Menu
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
